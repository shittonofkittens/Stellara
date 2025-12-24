// src/components/TherapySubcategoryPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import SubcategoryShell, {
  TAB_INPUT,
  TAB_HISTORY,
  TAB_TRACKER,
} from "./SubcategoryShell";
import { useCategoryTokenBalance } from "./Tokens";
import { earnTokens, spendTokens } from "../utils/tokens";

function emitTherapyDataChanged(categoryId, subcategoryId) {
  try {
    window.dispatchEvent(
      new CustomEvent("therapy-data-changed", {
        detail: { categoryId, subcategoryId },
      })
    );
  } catch {
    // ignore
  }
}

function formatEuropeanDate(dateKey) {
  if (!dateKey) return "";
  const [yyyy, mm, dd] = dateKey.split("-");
  const monthIndex = parseInt(mm, 10) - 1;

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return `${dd} ${monthNames[monthIndex]} ${yyyy}`;
}

function todayKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

const DEFAULT_FEELINGS = [
  "Calm",
  "Anxious",
  "Hopeful",
  "Overwhelmed",
  "Validated",
  "Drained",
];

function TherapySubcategoryPage({ category, subcategory, onBack, lowEnergy }) {
  const [activeTab, setActiveTab] = useState(TAB_INPUT);
  const [editingHistoryEntry, setEditingHistoryEntry] = useState(null);

  // Edit (reclassify) UI state
  const [editKind, setEditKind] = useState(null); // "scheduled" | "attended" | "rescheduled" | "skipped" | null
  const [editScheduleDate, setEditScheduleDate] = useState("");
  const [editFeelings, setEditFeelings] = useState([]);
  const [editKeyword, setEditKeyword] = useState("");
  const [editRescheduleDate, setEditRescheduleDate] = useState("");
  const [editSkipReason, setEditSkipReason] = useState("");
  const [editSkipOtherText, setEditSkipOtherText] = useState("");

  const APPT_KEY = `therapyAppointments:${category.id}:${subcategory.id}`;
  const HISTORY_KEY = `therapyHistory:${category.id}:${subcategory.id}`;
  const TOKEN_USE_KEY = `therapyTokens:${category.id}:${subcategory.id}`;

  const categoryTokenBalance = useCategoryTokenBalance(category.id);
  const TOKEN_COST_SKIP_HALF_STAR = 3;

  const tokenModalContent = (
    <>
      <p className="token-confirm-copy">Are you sure? All you have to do is reschedule your appointment.</p>
    </>
  );

  const [appointments, setAppointments] = useState(() => {
    try {
      const stored = localStorage.getItem(APPT_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [history, setHistory] = useState(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(parsed)) return [];
      // Back-compat: older scheduled logs stored a body text "Scheduled."; keep the card tag but hide body.
      const mapped = parsed.map((h) => {
        const kind = String(h?.timeOfDay || "").toLowerCase();
        const text = typeof h?.text === "string" ? h.text.trim() : "";
        if (kind === "scheduled" && text === "Scheduled.") {
          return { ...h, text: "" };
        }

        if (kind === "rescheduled") {
          const toKey = typeof h?.rescheduledToDateKey === "string" ? h.rescheduledToDateKey : "";
          const fromKeyExisting = typeof h?.rescheduledFromDateKey === "string" ? h.rescheduledFromDateKey : "";
          const originalExisting = typeof h?.originalAppointmentDateKey === "string" ? h.originalAppointmentDateKey : "";
          const dateKey = typeof h?.dateKey === "string" ? h.dateKey : "";

          // If we don't have an explicit "rescheduled on" date, infer it as best-effort:
          // - Old scheme: dateKey (original date) != rescheduledToDateKey (new date)
          // - Otherwise: use updatedAt/createdAt as the action day
          const actionKey =
            (typeof h?.updatedAt === "string" ? h.updatedAt.slice(0, 10) : "") ||
            (typeof h?.createdAt === "string" ? h.createdAt.slice(0, 10) : "");

          // Rescheduled-on = the day you performed the reschedule action.
          const rescheduledOnKey = fromKeyExisting || actionKey || dateKey;

          // Original appointment date = the date that was originally scheduled (best-effort for older data).
          const originalFromOldScheme = toKey && dateKey && dateKey !== toKey ? dateKey : "";
          const originalAppointmentDateKey = originalExisting || originalFromOldScheme || "";

          const nextText =
            rescheduledOnKey && originalAppointmentDateKey
              ? `Rescheduled on: ${formatEuropeanDate(rescheduledOnKey)}.\nOriginal Appointment Date: ${formatEuropeanDate(originalAppointmentDateKey)}.`
              : rescheduledOnKey
              ? `Rescheduled on: ${formatEuropeanDate(rescheduledOnKey)}.`
              : (h.text || "");

          // Migrate old scheme where dateKey was the original date; move the card to the new date.
          const nextDateKey = toKey && dateKey && dateKey !== toKey ? toKey : dateKey;

          return {
            ...h,
            dateKey: nextDateKey,
            title: nextDateKey ? formatEuropeanDate(nextDateKey) : h.title,
            rescheduledFromDateKey: rescheduledOnKey || undefined,
            originalAppointmentDateKey: originalAppointmentDateKey || undefined,
            text: nextText,
          };
        }
        return h;
      });

      // Fill missing originalAppointmentDateKey from the (earliest) scheduled entry for the same appointment.
      const earliestScheduledByAppt = new Map(); // apptId -> min dateKey
      for (let i = 0; i < mapped.length; i += 1) {
        const h = mapped[i];
        const kind = String(h?.timeOfDay || "").toLowerCase();
        if (kind !== "scheduled") continue;
        const apptId = typeof h?.appointmentId === "string" ? h.appointmentId : "";
        const dk = typeof h?.dateKey === "string" ? h.dateKey : "";
        if (!apptId || !dk) continue;
        const prev = earliestScheduledByAppt.get(apptId);
        if (!prev || dk.localeCompare(prev) < 0) earliestScheduledByAppt.set(apptId, dk);
      }

      const mappedWithOriginal = mapped.map((h) => {
        const kind = String(h?.timeOfDay || "").toLowerCase();
        if (kind !== "rescheduled") return h;
        const apptId = typeof h?.appointmentId === "string" ? h.appointmentId : "";
        const onKey = typeof h?.rescheduledFromDateKey === "string" ? h.rescheduledFromDateKey : "";
        const originalExisting = typeof h?.originalAppointmentDateKey === "string" ? h.originalAppointmentDateKey : "";
        const originalKey = originalExisting || (apptId ? (earliestScheduledByAppt.get(apptId) || "") : "");
        const nextText =
          onKey && originalKey
            ? `Rescheduled on: ${formatEuropeanDate(onKey)}.\nOriginal Appointment Date: ${formatEuropeanDate(originalKey)}.`
            : onKey
            ? `Rescheduled on: ${formatEuropeanDate(onKey)}.`
            : (h.text || "");
        return {
          ...h,
          originalAppointmentDateKey: originalKey || undefined,
          text: nextText,
        };
      });

      // Normalize:
      // 1) Ensure at most ONE rescheduled entry per appointment (keep the latest by updatedAt/createdAt).
      // 2) Ensure the original scheduled entry exists at originalAppointmentDateKey (best-effort).
      const rescheduledByAppt = new Map(); // apptId -> { idx, ts }
      const scheduledKeySet = new Set(); // `${apptId}|${dateKey}`

      const asTs = (iso) => {
        const t = Date.parse(iso);
        return Number.isFinite(t) ? t : 0;
      };

      for (let i = 0; i < mappedWithOriginal.length; i += 1) {
        const h = mappedWithOriginal[i];
        const kind = String(h?.timeOfDay || "").toLowerCase();
        const apptId = typeof h?.appointmentId === "string" ? h.appointmentId : "";
        const dk = typeof h?.dateKey === "string" ? h.dateKey : "";
        if (!apptId) continue;

        if (kind === "scheduled" && dk) {
          scheduledKeySet.add(`${apptId}|${dk}`);
        }

        if (kind === "rescheduled") {
          const ts = asTs(h?.updatedAt || h?.createdAt || "");
          const existing = rescheduledByAppt.get(apptId);
          if (!existing || ts >= existing.ts) {
            rescheduledByAppt.set(apptId, { idx: i, ts });
          }
        }
      }

      const removeIds = new Set();
      for (let i = 0; i < mappedWithOriginal.length; i += 1) {
        const h = mappedWithOriginal[i];
        const kind = String(h?.timeOfDay || "").toLowerCase();
        if (kind !== "rescheduled") continue;
        const apptId = typeof h?.appointmentId === "string" ? h.appointmentId : "";
        if (!apptId) continue;
        const keepIdx = rescheduledByAppt.get(apptId)?.idx;
        if (typeof keepIdx === "number" && i !== keepIdx && h?.id) {
          removeIds.add(h.id);
        }
      }

      let normalized = removeIds.size ? mappedWithOriginal.filter((h) => !(h?.id && removeIds.has(h.id))) : mappedWithOriginal;

      // Restore missing Scheduled entry at the original appointment date.
      // This fixes prior versions that converted Scheduled -> Rescheduled.
      const toAdd = [];
      normalized.forEach((h) => {
        const kind = String(h?.timeOfDay || "").toLowerCase();
        if (kind !== "rescheduled") return;
        const apptId = typeof h?.appointmentId === "string" ? h.appointmentId : "";
        const originalKey = typeof h?.originalAppointmentDateKey === "string" ? h.originalAppointmentDateKey : "";
        if (!apptId || !originalKey) return;
        const key = `${apptId}|${originalKey}`;
        if (scheduledKeySet.has(key)) return;
        scheduledKeySet.add(key);
        toAdd.push({
          id: `therapy-h-scheduled-${apptId}-${originalKey}`,
          appointmentId: apptId,
          dateKey: originalKey,
          timeOfDay: "scheduled",
          title: formatEuropeanDate(originalKey),
          text: "",
          createdAt: typeof h?.createdAt === "string" ? h.createdAt : new Date().toISOString(),
          updatedAt: typeof h?.updatedAt === "string" ? h.updatedAt : new Date().toISOString(),
        });
      });

      if (toAdd.length) {
        normalized = [...normalized, ...toAdd];
      }

      return normalized;
    } catch {
      return [];
    }
  });

  const [tokenUses, setTokenUses] = useState(() => {
    try {
      const stored = localStorage.getItem(TOKEN_USE_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(APPT_KEY, JSON.stringify(appointments));
    } catch {
      // ignore
    }

    emitTherapyDataChanged(category.id, subcategory.id);
  }, [APPT_KEY, appointments]);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      // ignore
    }

    emitTherapyDataChanged(category.id, subcategory.id);
  }, [HISTORY_KEY, history]);

  useEffect(() => {
    try {
      localStorage.setItem(TOKEN_USE_KEY, JSON.stringify(tokenUses));
    } catch {
      // ignore
    }

    emitTherapyDataChanged(category.id, subcategory.id);
  }, [TOKEN_USE_KEY, tokenUses]);

  const tKey = useMemo(() => todayKey(), []);
  const monthKey = tKey.slice(0, 7);
  const yearKey = tKey.slice(0, 4);

  // Therapy monthly cap: 1 star/month = 2 half-star fragments.
  const MONTHLY_FRAGMENTS_CAP = 2;

  const countFragmentsForMonth = (targetMonthKey) => {
    if (typeof targetMonthKey !== "string" || targetMonthKey.length < 7) return 0;
    const attended = (Array.isArray(appointments) ? appointments : []).filter(
      (a) =>
        a?.status === "attended" &&
        typeof a?.dateKey === "string" &&
        a.dateKey.startsWith(targetMonthKey)
    ).length;
    const tokens = (Array.isArray(tokenUses) ? tokenUses : []).filter(
      (u) => typeof u?.dateKey === "string" && u.dateKey.startsWith(targetMonthKey)
    ).length;
    return attended + tokens;
  };

  const scheduledAppointments = useMemo(() => {
    return appointments
      .filter((a) => a && a.status === "scheduled" && a.dateKey)
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
  }, [appointments]);

  const appointmentsById = useMemo(() => {
    return new Map(
      (Array.isArray(appointments) ? appointments : [])
        .filter((a) => a?.id)
        .map((a) => [a.id, a])
    );
  }, [appointments]);

  const todaysAppointment = useMemo(() => {
    return (
      scheduledAppointments.find((a) => a.dateKey === tKey) ||
      null
    );
  }, [scheduledAppointments, tKey]);

  const historyEntries = useMemo(() => {
    const timeOrder = {
      scheduled: 1,
      attended: 2,
      rescheduled: 3,
      skipped: 4,
    };

    const tokenHistoryEntries = (Array.isArray(tokenUses) ? tokenUses : []).map((u) => {
      const dk = typeof u?.dateKey === "string" ? u.dateKey : "";
      return {
        id: typeof u?.id === "string" ? u.id : `therapy-token-${u?.appointmentId || ""}-${dk}`,
        dateKey: dk,
        title: dk ? formatEuropeanDate(dk) : "",
        timeOfDay: "skipped",
        isToken: true,
        appointmentId: typeof u?.appointmentId === "string" ? u.appointmentId : undefined,
        tokensSpent: typeof u?.tokensSpent === "number" ? u.tokensSpent : undefined,
        createdAt: typeof u?.createdAt === "string" ? u.createdAt : new Date().toISOString(),
        lowEnergy: u?.lowEnergy === true,
      };
    });

    return [...history, ...tokenHistoryEntries].sort((a, b) => {
      if (a.dateKey !== b.dateKey) return b.dateKey.localeCompare(a.dateKey);
      const aT = timeOrder[a.timeOfDay] || 0;
      const bT = timeOrder[b.timeOfDay] || 0;
      if (aT !== bT) return aT - bT;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
  }, [history, tokenUses]);

  const stats = useMemo(() => computeTherapyStats(appointments, history, tokenUses), [appointments, history, tokenUses]);

  const monthlyFragments = useMemo(() => {
    const attended = appointments.filter(
      (a) => a?.status === "attended" && typeof a?.dateKey === "string" && a.dateKey.startsWith(monthKey)
    ).length;
    const tokens = (Array.isArray(tokenUses) ? tokenUses : []).filter(
      (u) => typeof u?.dateKey === "string" && u.dateKey.startsWith(monthKey)
    ).length;
    return attended + tokens;
  }, [appointments, monthKey, tokenUses]);

  const yearlyFragments = useMemo(() => {
    const attended = appointments.filter(
      (a) => a?.status === "attended" && typeof a?.dateKey === "string" && a.dateKey.startsWith(yearKey)
    ).length;
    const tokens = (Array.isArray(tokenUses) ? tokenUses : []).filter(
      (u) => typeof u?.dateKey === "string" && u.dateKey.startsWith(yearKey)
    ).length;
    return attended + tokens;
  }, [appointments, yearKey, tokenUses]);

  // Therapy cadence: 2 sessions/month (biweekly) → 2 fragments/month.
  const monthlyFragmentsMax = 2;
  const yearlyFragmentsMax = 24;

  const topKeywords = useMemo(() => {
    const counts = new Map();
    const labelByKey = new Map();

    const addKeyword = (raw) => {
      const part = typeof raw === "string" ? raw.trim() : "";
      if (!part) return;
      const key = part.toLowerCase();
      labelByKey.set(key, labelByKey.get(key) || part);
      counts.set(key, (counts.get(key) || 0) + 1);
    };

    const addKeywordsFromText = (text) => {
      const extracted = extractKeywordsFromTherapyHistoryText(text);
      if (!extracted.length) return false;
      extracted.forEach(addKeyword);
      return true;
    };

    const appointmentsById = new Map(
      (Array.isArray(appointments) ? appointments : [])
        .filter((a) => a?.id)
        .map((a) => [a.id, a])
    );

    (Array.isArray(history) ? history : [])
      .filter((h) => String(h?.timeOfDay || "").toLowerCase() === "attended")
      .forEach((h) => {
        const usedText = addKeywordsFromText(h?.text);
        if (usedText) return;

        // Back-compat: if a history entry has no keyword in text, fall back to the stored appt keyword.
        const appt = h?.appointmentId ? appointmentsById.get(h.appointmentId) : null;
        const raw = typeof appt?.keyword === "string" ? appt.keyword.trim() : "";
        if (!raw) return;
        raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .forEach(addKeyword);
      });

    return [...counts.entries()]
      .map(([key, count]) => ({ keyword: labelByKey.get(key) || key, count }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.keyword.localeCompare(b.keyword);
      })
      .slice(0, 5);
  }, [appointments, history]);

  const outcomeCounts = useMemo(() => {
    const counts = { attended: 0, rescheduled: 0, skipped: 0 };
    (Array.isArray(history) ? history : []).forEach((h) => {
      const kind = String(h?.timeOfDay || "").toLowerCase();
      if (kind === "attended") counts.attended += 1;
      if (kind === "rescheduled") counts.rescheduled += 1;
      if (kind === "skipped") counts.skipped += 1;
    });
    return counts;
  }, [history]);

  const outcomePercents = useMemo(() => {
    const total = outcomeCounts.attended + outcomeCounts.rescheduled + outcomeCounts.skipped;
    if (!total) {
      return { total: 0, attendedPct: 0, rescheduledPct: 0, skippedPct: 0 };
    }
    const attendedPct = Math.round((outcomeCounts.attended / total) * 100);
    const rescheduledPct = Math.round((outcomeCounts.rescheduled / total) * 100);
    const skippedPct = Math.round((outcomeCounts.skipped / total) * 100);

    // Keep the total visually consistent by distributing rounding drift.
    const sum = attendedPct + rescheduledPct + skippedPct;
    const drift = 100 - sum;
    if (drift === 0) return { total, attendedPct, rescheduledPct, skippedPct };

    const buckets = [
      { key: "attendedPct", value: attendedPct },
      { key: "rescheduledPct", value: rescheduledPct },
      { key: "skippedPct", value: skippedPct },
    ].sort((a, b) => b.value - a.value);

    const adjusted = { attendedPct, rescheduledPct, skippedPct };
    adjusted[buckets[0].key] = Math.max(0, Math.min(100, adjusted[buckets[0].key] + drift));
    return { total, ...adjusted };
  }, [outcomeCounts]);

  const pushHistory = (entry) => {
    const kind = String(entry?.timeOfDay || "").toLowerCase();
    const normalizedText =
      kind === "scheduled" && typeof entry?.text === "string" && entry.text.trim() === "Scheduled."
        ? ""
        : entry?.text;

    const normalizedReschedule =
      kind === "rescheduled"
        ? {
            rescheduledFromDateKey:
              typeof entry?.rescheduledFromDateKey === "string"
                ? entry.rescheduledFromDateKey
                : typeof entry?.dateKey === "string"
                ? entry.dateKey
                : undefined,
            originalAppointmentDateKey:
              typeof entry?.originalAppointmentDateKey === "string" ? entry.originalAppointmentDateKey : undefined,
            text:
              typeof entry?.rescheduledFromDateKey === "string" && entry.rescheduledFromDateKey
                ? (
                    typeof entry?.originalAppointmentDateKey === "string" && entry.originalAppointmentDateKey
                      ? `Rescheduled on: ${formatEuropeanDate(entry.rescheduledFromDateKey)}.\nOriginal Appointment Date: ${formatEuropeanDate(entry.originalAppointmentDateKey)}.`
                      : `Rescheduled on: ${formatEuropeanDate(entry.rescheduledFromDateKey)}.`
                  )
                : typeof entry?.dateKey === "string" && entry.dateKey
                ? `Rescheduled on: ${formatEuropeanDate(entry.dateKey)}.`
                : normalizedText,
          }
        : {};

    const normalized = {
      ...entry,
      text: normalizedText,
      ...normalizedReschedule,
      lowEnergy: typeof entry?.lowEnergy === "boolean" ? entry.lowEnergy : undefined,
    };
    setHistory((prev) => [normalized, ...prev]);
  };

  const handleDeleteHistoryEntry = (entry) => {
    if (!entry?.id) return;

    // Token entries: remove the token-use record and refund tokens.
    if (entry.isToken) {
      const tokenId = entry.id;
      const existing = (Array.isArray(tokenUses) ? tokenUses : []).find((u) => u?.id === tokenId);
      const fallbackMatch = !existing
        ? (Array.isArray(tokenUses) ? tokenUses : []).find(
            (u) =>
              (entry.appointmentId && u?.appointmentId === entry.appointmentId && u?.dateKey === entry.dateKey) ||
              (!entry.appointmentId && entry.dateKey && u?.dateKey === entry.dateKey)
          )
        : null;
      const match = existing || fallbackMatch;
      if (!match) return;

      setTokenUses((prev) => (Array.isArray(prev) ? prev.filter((u) => u?.id !== match.id) : []));

      const refund = Math.max(0, Math.floor(Number(match?.tokensSpent) || 0));
      if (refund > 0) {
        earnTokens({
          categoryId: category.id,
          amount: refund,
          source: "therapy-skip-refund",
          meta: {
            subcategoryId: subcategory.id,
            appointmentId: typeof match?.appointmentId === "string" ? match.appointmentId : undefined,
            dateKey: typeof match?.dateKey === "string" ? match.dateKey : undefined,
          },
        });
      }
      return;
    }

    setHistory((prev) => prev.filter((h) => h.id !== entry.id));

    // Best-effort: if this history item represents a concrete appointment state,
    // remove the corresponding appointment record too.
    const kind = String(entry?.timeOfDay || "").toLowerCase();
    if (!kind) return;

    if (kind === "skipped") {
      const apptId = typeof entry?.appointmentId === "string" ? entry.appointmentId : "";
      const dk = typeof entry?.dateKey === "string" ? entry.dateKey : "";
      const existing = (Array.isArray(tokenUses) ? tokenUses : []).find(
        (u) =>
          (apptId && u?.appointmentId === apptId && u?.dateKey === dk) ||
          (!apptId && dk && typeof u?.dateKey === "string" && u.dateKey === dk)
      );

      if (existing) {
        setTokenUses((prev) =>
          (Array.isArray(prev) ? prev : []).filter((u) => u?.id !== existing.id)
        );
        const refund = Math.max(0, Math.floor(Number(existing?.tokensSpent) || 0));
        if (refund > 0) {
          earnTokens({
            categoryId: category.id,
            amount: refund,
            source: "therapy-skip-refund",
            meta: { subcategoryId: subcategory.id, appointmentId: apptId, dateKey: dk },
          });
        }
      }
    }

    // Only delete the appointment itself for these actions.
    // (Rescheduled is a log entry; the appointment continues.)
    if (kind === "scheduled") {
      setAppointments((prev) =>
        prev.filter((a) => {
          if (!a) return false;
          if (a.status !== "scheduled") return true;
          if (entry.appointmentId && a.id === entry.appointmentId) return false;
          if (entry.dateKey && a.dateKey === entry.dateKey) return false;
          return true;
        })
      );
      return;
    }

    if (kind === "rescheduled") {
      // If the appointment is still scheduled, deleting this log should remove the upcoming appt.
      setAppointments((prev) =>
        prev.filter((a) => {
          if (!a) return false;
          if (a.status !== "scheduled") return true;
          if (entry.appointmentId && a.id === entry.appointmentId) return false;
          if (entry.rescheduledToDateKey && a.dateKey === entry.rescheduledToDateKey) return false;
          return true;
        })
      );
      return;
    }

    if (kind === "attended" || kind === "skipped") {
      if (entry.appointmentId) {
        setAppointments((prev) => prev.filter((a) => a?.id !== entry.appointmentId));
        return;
      }

      if (!entry?.dateKey) return;
      setAppointments((prev) =>
        prev.filter((a) => !(a?.dateKey === entry.dateKey && a?.status === kind))
      );
    }
  };

  const markAppointment = (appointmentId, patch) => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === appointmentId ? { ...a, ...patch } : a))
    );
  };

  const upsertRescheduledHistoryEntry = ({ appointmentId, toDateKey, rescheduledOnDateKey, originalAppointmentDateKey }) => {
    if (!appointmentId || !toDateKey) return false;
    const onKey = rescheduledOnDateKey || "";
    const originalKey = typeof originalAppointmentDateKey === "string" ? originalAppointmentDateKey : "";
    const nowIso = new Date().toISOString();

    let didUpdate = false;
    setHistory((prev) => {
      const next = prev.map((h) => {
        if (!h) return h;
        const kind = String(h?.timeOfDay || "").toLowerCase();
        if (kind !== "rescheduled") return h;
        if (h.appointmentId !== appointmentId) return h;
        didUpdate = true;
        const mergedOriginal = originalKey || (typeof h?.originalAppointmentDateKey === "string" ? h.originalAppointmentDateKey : "");
        return {
          ...h,
          dateKey: toDateKey,
          title: formatEuropeanDate(toDateKey),
          rescheduledToDateKey: toDateKey,
          rescheduledFromDateKey: onKey || h.rescheduledFromDateKey,
          originalAppointmentDateKey: mergedOriginal || undefined,
          text:
            onKey && mergedOriginal
              ? `Rescheduled on: ${formatEuropeanDate(onKey)}.\nOriginal Appointment Date: ${formatEuropeanDate(mergedOriginal)}.`
              : onKey
              ? `Rescheduled on: ${formatEuropeanDate(onKey)}.`
              : h.text,
          updatedAt: nowIso,
        };
      });
      return didUpdate ? next : prev;
    });

    return didUpdate;
  };

  // Scheduling UI state
  const [scheduleDate, setScheduleDate] = useState("");

  // Non-today logging: allow picking a scheduled appointment to log later.
  const [logAppointmentId, setLogAppointmentId] = useState("");
  const [showLogPanel, setShowLogPanel] = useState(false);

  // Today decision UI state
  const [decision, setDecision] = useState(null); // "attended" | "rescheduled" | "skipped" | null
  const [selectedFeelings, setSelectedFeelings] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [skipReason, setSkipReason] = useState(""); // "didnt-feel-like-it" | "forgot" | "other"
  const [skipOtherText, setSkipOtherText] = useState("");
  const [useTokensForSkip, setUseTokensForSkip] = useState(false);

  const logTargetAppointment = useMemo(() => {
    if (todaysAppointment) return todaysAppointment;
    if (logAppointmentId) {
      const match = scheduledAppointments.find((a) => a?.id === logAppointmentId);
      if (match) return match;
    }
    return scheduledAppointments[0] || null;
  }, [todaysAppointment, logAppointmentId, scheduledAppointments]);

  const tokenUseMatchesAppt = (tokenUse, appt) => {
    if (!tokenUse || !appt) return false;
    const apptId = typeof appt?.id === "string" ? appt.id : "";
    const apptDateKey = typeof appt?.dateKey === "string" ? appt.dateKey : "";
    const useApptId = typeof tokenUse?.appointmentId === "string" ? tokenUse.appointmentId : "";
    const useDateKey = typeof tokenUse?.dateKey === "string" ? tokenUse.dateKey : "";

    // Primary: appointmentId is stable even if the appointment date changes.
    if (useApptId && apptId) return useApptId === apptId;

    // Back-compat fallback: only when the token entry lacks appointmentId.
    if (!useApptId && useDateKey && apptDateKey) return useDateKey === apptDateKey;

    return false;
  };

  const isTokenAppliedForAppt = useMemo(() => {
    if (!logTargetAppointment?.id || !logTargetAppointment?.dateKey) return false;
    return (Array.isArray(tokenUses) ? tokenUses : []).some((u) =>
      tokenUseMatchesAppt(u, logTargetAppointment)
    );
  }, [logTargetAppointment?.dateKey, logTargetAppointment?.id, tokenUses]);

  const isTargetMonthAtCap = useMemo(() => {
    const dk = typeof logTargetAppointment?.dateKey === "string" ? logTargetAppointment.dateKey : "";
    const mk = dk ? dk.slice(0, 7) : "";
    if (!mk) return false;
    return countFragmentsForMonth(mk) >= MONTHLY_FRAGMENTS_CAP;
  }, [appointments, logTargetAppointment?.dateKey, tokenUses]);

  const applySkipTokenNow = ({ lowEnergy: lowEnergyCtx } = {}) => {
    if (decision !== "skipped") return;
    if (!logTargetAppointment?.id || !logTargetAppointment?.dateKey) return;
    if (categoryTokenBalance < TOKEN_COST_SKIP_HALF_STAR) return;

    const targetMonthKey = logTargetAppointment.dateKey.slice(0, 7);

    const already = (Array.isArray(tokenUses) ? tokenUses : []).some((u) =>
      tokenUseMatchesAppt(u, logTargetAppointment)
    );
    if (already) {
      setUseTokensForSkip(true);
      return;
    }

    // Enforce monthly cap: don't allow adding a new half-star token credit once month is full.
    if (countFragmentsForMonth(targetMonthKey) >= MONTHLY_FRAGMENTS_CAP) return;

    const spent = spendTokens({
      categoryId: category.id,
      amount: TOKEN_COST_SKIP_HALF_STAR,
      source: "therapy-skip",
      meta: {
        subcategoryId: subcategory.id,
        appointmentId: logTargetAppointment.id,
        dateKey: logTargetAppointment.dateKey,
      },
    });

    if (!spent?.ok) return;

    const nowIso = new Date().toISOString();
    setTokenUses((prev) => [
      {
        id: `therapy-token-${logTargetAppointment.id}-${logTargetAppointment.dateKey}`,
        appointmentId: logTargetAppointment.id,
        dateKey: logTargetAppointment.dateKey,
        tokensSpent: TOKEN_COST_SKIP_HALF_STAR,
        lowEnergy: lowEnergyCtx === undefined ? !!lowEnergy : !!lowEnergyCtx,
        createdAt: nowIso,
      },
      ...(Array.isArray(prev) ? prev : []),
    ]);
    setUseTokensForSkip(true);
  };

  const tokensUsed = useMemo(() => (Array.isArray(tokenUses) ? tokenUses.length : 0), [tokenUses]);

  useEffect(() => {
    if (todaysAppointment) setShowLogPanel(true);
  }, [todaysAppointment?.id]);

  useEffect(() => {
    // Keep a stable default selection when not logging "today".
    if (todaysAppointment) return;
    if (logAppointmentId) {
      const stillExists = scheduledAppointments.some((a) => a?.id === logAppointmentId);
      if (stillExists) return;
    }
    setLogAppointmentId(scheduledAppointments[0]?.id || "");
  }, [todaysAppointment, logAppointmentId, scheduledAppointments]);

  useEffect(() => {
    // Reset decision state when logging target changes.
    setDecision(null);
    setSelectedFeelings([]);
    setKeyword("");
    setRescheduleDate("");
    setSkipReason("");
    setSkipOtherText("");
    setUseTokensForSkip(false);
  }, [logTargetAppointment?.id]);

  useEffect(() => {
    if (decision !== "skipped") setUseTokensForSkip(false);
  }, [decision]);

  useEffect(() => {
    // If a token was applied for this appointment, lock it to the Skipped flow.
    if (!isTokenAppliedForAppt) return;
    if (decision !== "skipped") setDecision("skipped");
  }, [decision, isTokenAppliedForAppt]);

  useEffect(() => {
    if (decision !== "skipped") return;
    if (categoryTokenBalance >= TOKEN_COST_SKIP_HALF_STAR) return;
    if (!isTokenAppliedForAppt) setUseTokensForSkip(false);
  }, [categoryTokenBalance, decision, isTokenAppliedForAppt]);

  useEffect(() => {
    if (!editingHistoryEntry) return;
    const kind = String(editingHistoryEntry.timeOfDay || "").toLowerCase();
    setEditKind(kind || null);

    const appt = resolveAppointmentForHistoryEntry(editingHistoryEntry, appointmentsById, appointments);

    // Prefill fields from the appointment record when possible.
    if (kind === "scheduled") {
      setEditScheduleDate(
        (typeof appt?.dateKey === "string" && appt.dateKey) ||
          (typeof editingHistoryEntry?.dateKey === "string" ? editingHistoryEntry.dateKey : "")
      );
      return;
    }

    if (kind === "attended") {
      const feelings = Array.isArray(appt?.feelings)
        ? appt.feelings
        : extractFeelingsFromTherapyHistoryText(editingHistoryEntry.text);
      setEditFeelings(feelings);

      const kwFromText = extractKeywordsFromTherapyHistoryText(editingHistoryEntry.text).join(", ");
      const kw = kwFromText || (typeof appt?.keyword === "string" ? appt.keyword : "");
      setEditKeyword(kw);
      return;
    }

    if (kind === "rescheduled") {
      const nextDate =
        (typeof editingHistoryEntry?.rescheduledToDateKey === "string" && editingHistoryEntry.rescheduledToDateKey) ||
        (typeof appt?.dateKey === "string" ? appt.dateKey : "");
      setEditRescheduleDate(nextDate);
      return;
    }

    if (kind === "skipped") {
      const reason = typeof appt?.skipReason === "string" ? appt.skipReason : mapSkipReasonLabelToValue(extractSkipReasonLabelFromTherapyHistoryText(editingHistoryEntry.text));
      setEditSkipReason(reason);
      const other = typeof appt?.skipOtherText === "string" ? appt.skipOtherText : "";
      setEditSkipOtherText(other);
    }
  }, [editingHistoryEntry]);

  const renderInput = ({ TokenControl } = {}) => {
    if (editingHistoryEntry) {
      const originalDateKey = typeof editingHistoryEntry?.dateKey === "string" ? editingHistoryEntry.dateKey : "";
      const originalTitle = editingHistoryEntry?.title || formatEuropeanDate(originalDateKey);

      return (
        <div className="journal-input-fields">
          <div className="tracker-section">
            <div className="tracker-label">Editing</div>
            <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>{originalTitle}</div>

            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                flexWrap: "wrap",
                marginTop: "0.7rem",
              }}
            >
              <button
                type="button"
                className="journal-button-secondary"
                onClick={() => setEditKind("attended")}
                aria-pressed={editKind === "attended"}
              >
                Attended
              </button>
              <button
                type="button"
                className="journal-button-secondary"
                onClick={() => setEditKind("rescheduled")}
                aria-pressed={editKind === "rescheduled"}
              >
                Rescheduled
              </button>
              <button
                type="button"
                className="journal-button-secondary"
                onClick={() => setEditKind("skipped")}
                aria-pressed={editKind === "skipped"}
              >
                Skipped
              </button>
              <button
                type="button"
                className="journal-button-secondary"
                onClick={() => setEditKind("scheduled")}
                aria-pressed={editKind === "scheduled"}
              >
                Scheduled
              </button>
            </div>
          </div>

          {editKind === "scheduled" && (
            <>
              <div className="journal-field" style={{ marginTop: "0.9rem" }}>
                <label className="journal-label">Scheduled date</label>
                <input
                  type="date"
                  className="journal-input-text"
                  value={editScheduleDate}
                  onChange={(e) => setEditScheduleDate(e.target.value)}
                />
              </div>
            </>
          )}

          {editKind === "attended" && (
            <>
              <div className="tracker-section" style={{ marginTop: "0.9rem" }}>
                <div className="tracker-label">How did you feel?</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {DEFAULT_FEELINGS.map((f) => {
                    const selected = editFeelings.includes(f);
                    return (
                      <button
                        key={f}
                        type="button"
                        className={selected ? "journal-button-primary" : "journal-button-secondary"}
                        onClick={() => {
                          setEditFeelings((prev) =>
                            prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
                          );
                        }}
                        aria-pressed={selected}
                      >
                        {f}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="journal-field" style={{ marginTop: "0.9rem" }}>
                <label className="journal-label">Keyword</label>
                <input
                  type="text"
                  className="journal-input-text"
                  placeholder="school, work, family…"
                  value={editKeyword}
                  onChange={(e) => setEditKeyword(e.target.value)}
                />
              </div>
            </>
          )}

          {editKind === "rescheduled" && (
            <>
              <div className="journal-field" style={{ marginTop: "0.9rem" }}>
                <label className="journal-label">Reschedule to</label>
                <input
                  type="date"
                  className="journal-input-text"
                  value={editRescheduleDate}
                  onChange={(e) => setEditRescheduleDate(e.target.value)}
                />
              </div>

              <div className="tracker-note" style={{ marginTop: "0.5rem" }}>
                This will move the same appointment to the new date.
              </div>
            </>
          )}

          {editKind === "skipped" && (
            <>
              <div className="tracker-section" style={{ marginTop: "0.9rem" }}>
                <div className="tracker-label">Why?</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <input
                      type="radio"
                      name="edit-skip-reason"
                      value="didnt-feel-like-it"
                      checked={editSkipReason === "didnt-feel-like-it"}
                      onChange={(e) => setEditSkipReason(e.target.value)}
                    />
                    <span className="therapy-choice-text">Didn't feel like it</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <input
                      type="radio"
                      name="edit-skip-reason"
                      value="forgot"
                      checked={editSkipReason === "forgot"}
                      onChange={(e) => setEditSkipReason(e.target.value)}
                    />
                    <span className="therapy-choice-text">Forgot</span>
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <input
                      type="radio"
                      name="edit-skip-reason"
                      value="other"
                      checked={editSkipReason === "other"}
                      onChange={(e) => setEditSkipReason(e.target.value)}
                    />
                    <span className="therapy-choice-text">Other</span>
                  </label>
                </div>
              </div>

              {editSkipReason === "other" && (
                <div className="journal-field" style={{ marginTop: "0.9rem" }}>
                  <label className="journal-label">Reason</label>
                  <input
                    type="text"
                    className="journal-input-text"
                    value={editSkipOtherText}
                    onChange={(e) => setEditSkipOtherText(e.target.value)}
                  />
                </div>
              )}
            </>
          )}

          <div className="journal-actions-row" style={{ marginTop: "0.9rem" }}>
            <button
              type="button"
              className="journal-button-secondary"
              onClick={() => {
                setEditingHistoryEntry(null);
                setEditKind(null);
                setEditScheduleDate("");
                setEditFeelings([]);
                setEditKeyword("");
                setEditRescheduleDate("");
                setEditSkipReason("");
                setEditSkipOtherText("");
                setActiveTab(TAB_HISTORY);
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              className="journal-button-primary"
              disabled={
                !editKind ||
                (editKind === "scheduled" && !editScheduleDate) ||
                (editKind === "rescheduled" && !editRescheduleDate) ||
                (editKind === "skipped" && (!editSkipReason || (editSkipReason === "other" && !editSkipOtherText.trim())))
              }
              onClick={() => {
                if (!editKind) return;

                const nowIso = new Date().toISOString();
                const prevKind = String(editingHistoryEntry?.timeOfDay || "").toLowerCase();
                const baseDateKey = typeof editingHistoryEntry?.dateKey === "string" ? editingHistoryEntry.dateKey : "";

                const apptExisting = resolveAppointmentForHistoryEntry(editingHistoryEntry, appointmentsById, appointments);
                const apptId = apptExisting?.id || editingHistoryEntry?.appointmentId || `therapy-appt-${Date.now()}-${Math.random().toString(16).slice(2)}`;

                const conflict =
                  editKind === "rescheduled" &&
                  appointments.some((a) => a?.status === "scheduled" && a?.dateKey === editRescheduleDate && a?.id !== apptId);
                if (conflict) return;

                const nextHistoryPatch = {
                  timeOfDay: editKind,
                  updatedAt: nowIso,
                  appointmentId: apptId,
                  lowEnergy:
                    typeof editingHistoryEntry?.lowEnergy === "boolean" ? editingHistoryEntry.lowEnergy : !!lowEnergy,
                };

                // Scheduled edits change the history date (since it's literally the scheduled date)
                if (editKind === "scheduled") {
                  const nextDateKey = editScheduleDate;
                  setHistory((prev) =>
                    prev.map((h) =>
                      h.id === editingHistoryEntry.id
                        ? {
                            ...h,
                            ...nextHistoryPatch,
                            dateKey: nextDateKey,
                            title: formatEuropeanDate(nextDateKey),
                            text: "",
                            rescheduledToDateKey: undefined,
                          }
                        : h
                    )
                  );

                  setAppointments((prev) => {
                    const nextAppt = {
                      ...(apptExisting || {
                        id: apptId,
                        createdAt: nowIso,
                      }),
                      id: apptId,
                      status: "scheduled",
                      dateKey: nextDateKey,
                      updatedAt: nowIso,
                      attendedAt: undefined,
                      skippedAt: undefined,
                      feelings: undefined,
                      keyword: undefined,
                      skipReason: undefined,
                      skipOtherText: undefined,
                    };

                    const has = prev.some((a) => a?.id === apptId);
                    return has ? prev.map((a) => (a?.id === apptId ? nextAppt : a)) : [...prev, nextAppt];
                  });

                  setEditingHistoryEntry(null);
                  setEditKind(null);
                  setEditScheduleDate("");
                  setEditFeelings([]);
                  setEditKeyword("");
                  setEditRescheduleDate("");
                  setEditSkipReason("");
                  setEditSkipOtherText("");
                  setActiveTab(TAB_HISTORY);
                  return;
                }

                if (!baseDateKey) return;

                if (editKind === "attended") {
                  const targetMonthKey = baseDateKey.slice(0, 7);
                  const alreadyAttended =
                    prevKind === "attended" ||
                    String(apptExisting?.status || "").toLowerCase() === "attended";
                  if (!alreadyAttended && countFragmentsForMonth(targetMonthKey) >= MONTHLY_FRAGMENTS_CAP) {
                    return;
                  }
                }

                if (editKind === "attended") {
                  const feelings = editFeelings;
                  const kw = editKeyword.trim();
                  const nextText = [
                    feelings.length ? `Felt: ${feelings.join(", ")}` : "",
                    kw ? `Keyword: ${kw}` : "",
                  ]
                    .filter(Boolean)
                    .join("\n");

                  setHistory((prev) =>
                    prev.map((h) =>
                      h.id === editingHistoryEntry.id
                        ? {
                            ...h,
                            ...nextHistoryPatch,
                            dateKey: baseDateKey,
                            title: formatEuropeanDate(baseDateKey),
                            text: nextText,
                            rescheduledToDateKey: undefined,
                          }
                        : h
                    )
                  );

                  setAppointments((prev) => {
                    const nextAppt = {
                      ...(apptExisting || {
                        id: apptId,
                        createdAt: nowIso,
                      }),
                      id: apptId,
                      status: "attended",
                      dateKey: baseDateKey,
                      attendedAt: nowIso,
                      feelings,
                      keyword: kw,
                      updatedAt: nowIso,
                      skippedAt: undefined,
                      skipReason: undefined,
                      skipOtherText: undefined,
                    };

                    const has = prev.some((a) => a?.id === apptId);
                    return has ? prev.map((a) => (a?.id === apptId ? nextAppt : a)) : [...prev, nextAppt];
                  });
                }

                if (editKind === "rescheduled") {
                  const newDateKey = editRescheduleDate;
                  const prevRescheduledOn =
                    typeof editingHistoryEntry?.rescheduledFromDateKey === "string"
                      ? editingHistoryEntry.rescheduledFromDateKey
                      : "";
                  const rescheduledOnKey = prevRescheduledOn || tKey;
                  const originalKey =
                    typeof editingHistoryEntry?.originalAppointmentDateKey === "string"
                      ? editingHistoryEntry.originalAppointmentDateKey
                      : prevKind === "scheduled"
                      ? baseDateKey
                      : "";
                  const nextText =
                    rescheduledOnKey && originalKey
                      ? `Rescheduled on: ${formatEuropeanDate(rescheduledOnKey)}.\nOriginal Appointment Date: ${formatEuropeanDate(originalKey)}.`
                      : rescheduledOnKey
                      ? `Rescheduled on: ${formatEuropeanDate(rescheduledOnKey)}.`
                      : `Rescheduled on: ${formatEuropeanDate(newDateKey)}.`;

                  setHistory((prev) =>
                    prev.map((h) =>
                      h.id === editingHistoryEntry.id
                        ? {
                            ...h,
                            ...nextHistoryPatch,
                            dateKey: newDateKey,
                            title: formatEuropeanDate(newDateKey),
                            text: nextText,
                            rescheduledToDateKey: newDateKey,
                            rescheduledFromDateKey: rescheduledOnKey || undefined,
                            originalAppointmentDateKey: originalKey || undefined,
                          }
                        : h
                    )
                  );

                  setAppointments((prev) => {
                    const nextAppt = {
                      ...(apptExisting || {
                        id: apptId,
                        createdAt: nowIso,
                      }),
                      id: apptId,
                      status: "scheduled",
                      dateKey: newDateKey,
                      updatedAt: nowIso,
                      attendedAt: undefined,
                      skippedAt: undefined,
                      feelings: undefined,
                      keyword: undefined,
                      skipReason: undefined,
                      skipOtherText: undefined,
                    };

                    const has = prev.some((a) => a?.id === apptId);
                    return has ? prev.map((a) => (a?.id === apptId ? nextAppt : a)) : [...prev, nextAppt];
                  });
                }

                if (editKind === "skipped") {
                  const reasonLabel =
                    editSkipReason === "didnt-feel-like-it"
                      ? "Didn't feel like it"
                      : editSkipReason === "forgot"
                      ? "Forgot"
                      : editSkipReason === "other"
                      ? (editSkipOtherText.trim() || "Other")
                      : "";
                  const nextText = `Skipped. Reason: ${reasonLabel}.`;

                  setHistory((prev) =>
                    prev.map((h) =>
                      h.id === editingHistoryEntry.id
                        ? {
                            ...h,
                            ...nextHistoryPatch,
                            dateKey: baseDateKey,
                            title: formatEuropeanDate(baseDateKey),
                            text: nextText,
                            rescheduledToDateKey: undefined,
                          }
                        : h
                    )
                  );

                  setAppointments((prev) => {
                    const nextAppt = {
                      ...(apptExisting || {
                        id: apptId,
                        createdAt: nowIso,
                      }),
                      id: apptId,
                      status: "skipped",
                      dateKey: baseDateKey,
                      skippedAt: nowIso,
                      skipReason: editSkipReason,
                      skipOtherText: editSkipOtherText.trim(),
                      updatedAt: nowIso,
                      attendedAt: undefined,
                      feelings: undefined,
                      keyword: undefined,
                    };

                    const has = prev.some((a) => a?.id === apptId);
                    return has ? prev.map((a) => (a?.id === apptId ? nextAppt : a)) : [...prev, nextAppt];
                  });
                }

                // If the entry used to be a reschedule log, and we are reclassifying it to attended/skipped,
                // ensure the appointment is associated with the original date.
                if (prevKind === "rescheduled" && (editKind === "attended" || editKind === "skipped")) {
                  setAppointments((prev) =>
                    prev.map((a) =>
                      a?.id === apptId ? { ...a, dateKey: baseDateKey, updatedAt: nowIso } : a
                    )
                  );
                }

                setEditingHistoryEntry(null);
                setEditKind(null);
                setEditScheduleDate("");
                setEditFeelings([]);
                setEditKeyword("");
                setEditRescheduleDate("");
                setEditSkipReason("");
                setEditSkipOtherText("");
                setActiveTab(TAB_HISTORY);
              }}
            >
              Save Changes
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="journal-input-fields">
        <div className="journal-field">
          <label className="journal-label">Schedule therapy appointment</label>
          <input
            type="date"
            className="journal-input-text"
            value={scheduleDate}
            onChange={(e) => setScheduleDate(e.target.value)}
          />
        </div>

        <div className="journal-actions-row" style={{ marginTop: "0.7rem" }}>
          <button
            type="button"
            className="journal-button-primary"
            onClick={() => {
              const dateKey = scheduleDate;
              if (!dateKey) return;

              const exists = appointments.some(
                (a) => a?.status === "scheduled" && a?.dateKey === dateKey
              );
              if (exists) return;

              const appt = {
                id: `therapy-appt-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                dateKey,
                status: "scheduled",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };

              setAppointments((prev) => [...prev, appt]);

              pushHistory({
                id: `therapy-h-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                dateKey: appt.dateKey,
                timeOfDay: "scheduled",
                title: formatEuropeanDate(appt.dateKey),
                text: "",
                appointmentId: appt.id,
                createdAt: new Date().toISOString(),
              });

              setScheduleDate("");
            }}
            disabled={!scheduleDate}
          >
            Schedule
          </button>
        </div>

        {scheduledAppointments.length > 0 && (
          <div className="tracker-section" style={{ marginTop: "0.9rem" }}>
            <div className="tracker-label">Upcoming</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {scheduledAppointments.map((a) => (
                <div
                  key={a.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "0.6rem",
                  }}
                >
                  <div style={{ fontSize: "0.85rem" }}>{formatEuropeanDate(a.dateKey)}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>Scheduled</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginTop: "0.9rem", display: "flex", justifyContent: "center" }}>
          <button
            type="button"
            className="journal-history-tag"
            onClick={() => setShowLogPanel((v) => !v)}
            aria-expanded={showLogPanel}
            style={{ color: "var(--text-muted)" }}
          >
            LOG AN APPOINTMENT
          </button>
        </div>

        {showLogPanel && (
          <>
          <div className="tracker-section" style={{ marginTop: "0.6rem" }}>
            <div className="tracker-label">{todaysAppointment ? "Today’s appointment" : "Log an appointment"}</div>

          {!todaysAppointment && scheduledAppointments.length > 0 && (
            <div className="journal-field" style={{ marginTop: "0.6rem" }}>
              <label className="journal-label">Choose appointment</label>
              <select
                className="journal-input-text"
                value={logAppointmentId || (logTargetAppointment?.id || "")}
                onChange={(e) => setLogAppointmentId(e.target.value)}
              >
                {scheduledAppointments.map((a) => (
                  <option key={a.id} value={a.id}>
                    {formatEuropeanDate(a.dateKey)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ fontSize: "0.95rem", fontWeight: 600, marginTop: "0.6rem" }}>
            {logTargetAppointment ? formatEuropeanDate(logTargetAppointment.dateKey) : "No scheduled appointments"}
          </div>

          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              flexWrap: "wrap",
              marginTop: "0.7rem",
            }}
          >
            <button
              type="button"
              className="journal-button-secondary"
              onClick={() => {
                if (isTokenAppliedForAppt) return;
                setDecision("attended");
              }}
              aria-pressed={decision === "attended"}
              disabled={!logTargetAppointment || isTokenAppliedForAppt || isTargetMonthAtCap}
            >
              Attended
            </button>
            <button
              type="button"
              className="journal-button-secondary"
              onClick={() => {
                if (isTokenAppliedForAppt) return;
                setDecision("rescheduled");
              }}
              aria-pressed={decision === "rescheduled"}
              disabled={!logTargetAppointment || isTokenAppliedForAppt}
            >
              Rescheduled
            </button>
            <button
              type="button"
              className="journal-button-secondary"
              onClick={() => setDecision("skipped")}
              aria-pressed={decision === "skipped"}
              disabled={!logTargetAppointment}
            >
              Skipped
            </button>
            </div>
          </div>

        {decision === "attended" && (
          <>
            <div className="tracker-section" style={{ marginTop: "0.9rem" }}>
              <div className="tracker-label">How did you feel?</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                {DEFAULT_FEELINGS.map((f) => {
                  const selected = selectedFeelings.includes(f);
                  return (
                    <button
                      key={f}
                      type="button"
                      className={selected ? "journal-button-primary" : "journal-button-secondary"}
                      onClick={() => {
                        setSelectedFeelings((prev) =>
                          prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
                        );
                      }}
                      aria-pressed={selected}
                    >
                      {f}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="journal-field" style={{ marginTop: "0.9rem" }}>
              <label className="journal-label">Keyword</label>
              <input
                type="text"
                className="journal-input-text"
                placeholder="school, work, family…"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>

            <div className="journal-actions-row" style={{ marginTop: "0.7rem" }}>
              <button
                type="button"
                className="journal-button-primary"
                onClick={() => {
                  if (!logTargetAppointment) return;
                  if (isTokenAppliedForAppt) return;
                  if (isTargetMonthAtCap) return;
                  const feelings = selectedFeelings;
                  const kw = keyword.trim();

                  markAppointment(logTargetAppointment.id, {
                    status: "attended",
                    attendedAt: new Date().toISOString(),
                    feelings,
                    keyword: kw,
                    updatedAt: new Date().toISOString(),
                  });

                  pushHistory({
                    id: `therapy-h-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                    dateKey: logTargetAppointment.dateKey,
                    timeOfDay: "attended",
                    title: formatEuropeanDate(logTargetAppointment.dateKey),
                    text: [
                      feelings.length ? `Felt: ${feelings.join(", ")}` : "",
                      kw ? `Keyword: ${kw}` : "",
                    ]
                      .filter(Boolean)
                      .join("\n"),
                    appointmentId: logTargetAppointment.id,
                    createdAt: new Date().toISOString(),
                  });

                  setActiveTab(TAB_HISTORY);
                }}
                disabled={isTargetMonthAtCap}
              >
                Save
              </button>
            </div>
          </>
        )}

        {decision === "rescheduled" && (
          <>
            <div className="journal-field" style={{ marginTop: "0.9rem" }}>
              <label className="journal-label">Reschedule to</label>
              <input
                type="date"
                className="journal-input-text"
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
              />
            </div>

            <div className="journal-actions-row" style={{ marginTop: "0.7rem" }}>
              <button
                type="button"
                className="journal-button-primary"
                onClick={() => {
                  if (!logTargetAppointment) return;
                  if (isTokenAppliedForAppt) return;
                  const newDateKey = rescheduleDate;
                  if (!newDateKey) return;

                  const conflict = appointments.some(
                    (a) => a?.status === "scheduled" && a?.dateKey === newDateKey
                  );
                  if (conflict) return;

                  markAppointment(logTargetAppointment.id, {
                    dateKey: newDateKey,
                    updatedAt: new Date().toISOString(),
                    status: "scheduled",
                  });

                  const updated = upsertRescheduledHistoryEntry({
                    appointmentId: logTargetAppointment.id,
                    toDateKey: newDateKey,
                    rescheduledOnDateKey: tKey,
                  });

                  if (!updated) {
                    pushHistory({
                      id: `therapy-h-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                      dateKey: newDateKey,
                      timeOfDay: "rescheduled",
                      title: formatEuropeanDate(newDateKey),
                      text: `Rescheduled on: ${formatEuropeanDate(tKey)}.`,
                      appointmentId: logTargetAppointment.id,
                      rescheduledToDateKey: newDateKey,
                      rescheduledFromDateKey: tKey,
                      createdAt: new Date().toISOString(),
                    });
                  }

                  setActiveTab(TAB_HISTORY);
                }}
                disabled={!rescheduleDate || isTokenAppliedForAppt}
              >
                Confirm
              </button>
            </div>

            <div className="tracker-note" style={{ marginTop: "0.5rem" }}>
              This will bring the same appointment back on the new date.
            </div>
          </>
        )}

        {decision === "skipped" && (
          <>
            <div className="tracker-section" style={{ marginTop: "0.9rem" }}>
              <div className="tracker-label">Why?</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input
                    type="radio"
                    name="skip-reason"
                    value="didnt-feel-like-it"
                    checked={skipReason === "didnt-feel-like-it"}
                    onChange={(e) => setSkipReason(e.target.value)}
                  />
                  <span className="therapy-choice-text">Didn't feel like it</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input
                    type="radio"
                    name="skip-reason"
                    value="forgot"
                    checked={skipReason === "forgot"}
                    onChange={(e) => setSkipReason(e.target.value)}
                  />
                  <span className="therapy-choice-text">Forgot</span>
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input
                    type="radio"
                    name="skip-reason"
                    value="other"
                    checked={skipReason === "other"}
                    onChange={(e) => setSkipReason(e.target.value)}
                  />
                  <span className="therapy-choice-text">Other</span>
                </label>
              </div>
            </div>

            {skipReason === "other" && (
              <div className="journal-field" style={{ marginTop: "0.9rem" }}>
                <label className="journal-label">Reason</label>
                <input
                  type="text"
                  className="journal-input-text"
                  value={skipOtherText}
                  onChange={(e) => setSkipOtherText(e.target.value)}
                />
              </div>
            )}

            {TokenControl && <TokenControl />}

            <div className="journal-actions-row" style={{ marginTop: "0.7rem" }}>
              <button
                type="button"
                className="journal-button-primary"
                onClick={() => {
                  if (!logTargetAppointment) return;
                  const reasonLabel =
                    skipReason === "didnt-feel-like-it"
                      ? "Didn't feel like it"
                      : skipReason === "forgot"
                      ? "Forgot"
                      : skipReason === "other"
                      ? (skipOtherText.trim() || "Other")
                      : "";

                  if (!skipReason) return;
                  if (skipReason === "other" && !skipOtherText.trim()) return;

                  markAppointment(logTargetAppointment.id, {
                    status: "skipped",
                    skippedAt: new Date().toISOString(),
                    skipReason,
                    skipOtherText: skipOtherText.trim(),
                    updatedAt: new Date().toISOString(),
                  });

                  if (useTokensForSkip && categoryTokenBalance >= TOKEN_COST_SKIP_HALF_STAR) {
                    const already = (Array.isArray(tokenUses) ? tokenUses : []).some((u) =>
                      tokenUseMatchesAppt(u, logTargetAppointment)
                    );

                    if (!already) {
                      const targetMonthKey = logTargetAppointment.dateKey.slice(0, 7);
                      if (countFragmentsForMonth(targetMonthKey) >= MONTHLY_FRAGMENTS_CAP) {
                        // Month is already full; don't spend tokens for an extra half-star.
                        return;
                      }

                      const spent = spendTokens({
                        categoryId: category.id,
                        amount: TOKEN_COST_SKIP_HALF_STAR,
                        source: "therapy-skip",
                        meta: {
                          subcategoryId: subcategory.id,
                          appointmentId: logTargetAppointment.id,
                          dateKey: logTargetAppointment.dateKey,
                        },
                      });

                      if (spent?.ok) {
                        const nowIso = new Date().toISOString();
                        setTokenUses((prev) => [
                          {
                            id: `therapy-token-${logTargetAppointment.id}-${logTargetAppointment.dateKey}`,
                            appointmentId: logTargetAppointment.id,
                            dateKey: logTargetAppointment.dateKey,
                            tokensSpent: TOKEN_COST_SKIP_HALF_STAR,
                            lowEnergy: !!lowEnergy,
                            createdAt: nowIso,
                          },
                          ...(Array.isArray(prev) ? prev : []),
                        ]);
                      }
                    }
                  }

                  pushHistory({
                    id: `therapy-h-${Date.now()}-${Math.random().toString(16).slice(2)}`,
                    dateKey: logTargetAppointment.dateKey,
                    timeOfDay: "skipped",
                    title: formatEuropeanDate(logTargetAppointment.dateKey),
                    text: `Skipped. Reason: ${reasonLabel}.`,
                    appointmentId: logTargetAppointment.id,
                    createdAt: new Date().toISOString(),
                  });

                  setActiveTab(TAB_HISTORY);
                }}
                disabled={!skipReason || (skipReason === "other" && !skipOtherText.trim())}
              >
                Save
              </button>
            </div>
          </>
        )}
          </>
        )}
      </div>
    );
  };

  return (
    <SubcategoryShell
      category={category}
      subcategory={subcategory}
      onBack={onBack}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      monthlyFragments={monthlyFragments}
      yearlyFragments={yearlyFragments}
      monthlyFragmentsMax={monthlyFragmentsMax}
      yearlyFragmentsMax={yearlyFragmentsMax}
      fragmentsLogged={stats.totalFragments}
      entriesLogged={stats.totalEntries}
      avgChars={stats.avgChars}
      totalStarsApprox={stats.totalStarsApprox}
      availableTokens={categoryTokenBalance}
      minTokensToApply={TOKEN_COST_SKIP_HALF_STAR}
      tokenControlPlacement="manual"
      renderTokenControl={decision === "skipped" && !isTokenAppliedForAppt}
      tokenModalContent={tokenModalContent}
      onConfirmToken={applySkipTokenNow}
      tokensUsed={tokensUsed}
      lowEnergy={!!lowEnergy}
      onPatchHistoryEntries={setHistory}
      historyEntries={historyEntries}
      historyTheme="air"
      onRequestEditEntry={(entry) => {
        setEditingHistoryEntry(entry);
        setActiveTab(TAB_INPUT);
      }}
      onDeleteEntry={handleDeleteHistoryEntry}
      renderInput={renderInput}
      renderTracker={() => (
        <>
          <div className="tracker-card" style={{ marginBottom: "1rem" }}>
            <div className="tracker-label">Top Keywords</div>
            {topKeywords.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                {topKeywords.map((row, i) => (
                  <div
                    key={`${row.keyword}-${i}`}
                    style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}
                  >
                    <div style={{ fontSize: "0.85rem" }}>{row.keyword}</div>
                    <div style={{ fontSize: "0.75rem", color: "rgba(255, 255, 255, 0.65)" }}>
                      {row.count}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="tracker-sub">No keywords logged yet.</div>
            )}
          </div>

          <div className="tracker-section" style={{ marginBottom: "1rem" }}>
            <div className="tracker-label">Outcomes</div>

            <div className="tracker-bar-row">
              <span className="tracker-bar-label">Attended</span>
              <div className="tracker-bar-track">
                <div
                  className="tracker-bar-fill"
                  style={{ width: `${outcomePercents.attendedPct}%` }}
                />
              </div>
              <span className="tracker-bar-value">
                {outcomeCounts.attended} ({outcomePercents.attendedPct}%)
              </span>
            </div>

            <div className="tracker-bar-row">
              <span className="tracker-bar-label">Rescheduled</span>
              <div className="tracker-bar-track">
                <div
                  className="tracker-bar-fill"
                  style={{ width: `${outcomePercents.rescheduledPct}%` }}
                />
              </div>
              <span className="tracker-bar-value">
                {outcomeCounts.rescheduled} ({outcomePercents.rescheduledPct}%)
              </span>
            </div>

            <div className="tracker-bar-row">
              <span className="tracker-bar-label">Skipped</span>
              <div className="tracker-bar-track">
                <div
                  className="tracker-bar-fill"
                  style={{ width: `${outcomePercents.skippedPct}%` }}
                />
              </div>
              <span className="tracker-bar-value">
                {outcomeCounts.skipped} ({outcomePercents.skippedPct}%)
              </span>
            </div>
          </div>
        </>
      )}
    />
  );
}

function computeTherapyStats(appointments, history = [], tokenUses = []) {
  const attendedAppointments = Array.isArray(appointments)
    ? appointments.filter((a) => a?.status === "attended")
    : [];

  // Count Therapy history items as “entries logged”, excluding scheduling.
  const nonScheduledHistory = Array.isArray(history)
    ? history.filter((h) => String(h?.timeOfDay || "").toLowerCase() !== "scheduled")
    : [];
  const totalEntries = nonScheduledHistory.length;

  const tokenFragments = Array.isArray(tokenUses) ? tokenUses.length : 0;

  // Fragments earned = attended sessions + token credits (each = 1 half-star fragment)
  const totalFragments = attendedAppointments.length + tokenFragments;
  const totalStarsApprox = Math.round((totalFragments / 2) * 10) / 10;

  let totalChars = 0;
  if (nonScheduledHistory.length) {
    nonScheduledHistory.forEach((h) => {
      const text = typeof h?.text === "string" ? h.text : "";
      totalChars += text.trim().length;
    });
  }
  const avgChars = totalEntries ? Math.round(totalChars / totalEntries) : 0;

  // Unique days marked as low-energy (prefer explicit dateKey, fallback to createdAt day)
  const lowEnergyDays = new Set();
  if (Array.isArray(history)) {
    history.forEach((h) => {
      if (!h?.lowEnergy) return;
      const dk = typeof h?.dateKey === "string" ? h.dateKey : "";
      if (dk) {
        lowEnergyDays.add(dk);
        return;
      }
      const createdKey = typeof h?.createdAt === "string" ? h.createdAt.slice(0, 10) : "";
      if (createdKey) lowEnergyDays.add(createdKey);
    });
  }

  return {
    totalEntries,
    totalFragments,
    totalStarsApprox,
    avgChars,
    lowEnergyCount: lowEnergyDays.size,
  };
}

function resolveAppointmentForHistoryEntry(entry, appointmentsById, appointments) {
  if (!entry) return null;
  if (entry.appointmentId && appointmentsById?.get) {
    const direct = appointmentsById.get(entry.appointmentId);
    if (direct) return direct;
  }

  const kind = String(entry.timeOfDay || "").toLowerCase();
  const dateKey = entry.dateKey;
  if (!dateKey || !Array.isArray(appointments)) return null;

  // Try exact matches first
  const exact = appointments.find((a) => a?.dateKey === dateKey && String(a?.status || "").toLowerCase() === kind);
  if (exact) return exact;

  // For rescheduled logs, the appointment will usually still be scheduled at the new date.
  if (kind === "rescheduled") {
    if (entry.rescheduledToDateKey) {
      const scheduled = appointments.find((a) => a?.status === "scheduled" && a?.dateKey === entry.rescheduledToDateKey);
      if (scheduled) return scheduled;
    }
    const anyScheduled = appointments.find((a) => a?.status === "scheduled");
    return anyScheduled || null;
  }

  // Fallback: any appointment on that day
  return appointments.find((a) => a?.dateKey === dateKey) || null;
}

function extractFeelingsFromTherapyHistoryText(text) {
  const raw = typeof text === "string" ? text : "";
  if (!raw) return [];
  const match = raw.match(/\bfelt\s*:\s*([^\n.]*)/i);
  if (!match) return [];
  return String(match[1] || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function extractSkipReasonLabelFromTherapyHistoryText(text) {
  const raw = typeof text === "string" ? text : "";
  if (!raw) return "";
  const match = raw.match(/\breason\s*:\s*([^\n.]*)/i);
  return match ? String(match[1] || "").trim() : "";
}

function mapSkipReasonLabelToValue(label) {
  const l = String(label || "").trim().toLowerCase();
  if (!l) return "";
  if (l.includes("didn't") || l.includes("didnt")) return "didnt-feel-like-it";
  if (l.includes("forgot")) return "forgot";
  return "other";
}

function extractKeywordsFromTherapyHistoryText(text) {
  const raw = typeof text === "string" ? text : "";
  if (!raw) return [];

  // Supports "Keyword:" and "Keywords:" (case-insensitive)
  // Examples:
  // - "Attended. Felt: Calm. Keyword: school, work."
  // - "Attended. Keywords: school, work, family"
  const match = raw.match(/\bkeywords?\s*:\s*([^\n]*)/i);
  if (!match) return [];

  // Stop at sentence boundary if present.
  const afterColon = match[1] ?? "";
  const upToPeriod = afterColon.split(".")[0];
  return upToPeriod
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default TherapySubcategoryPage;

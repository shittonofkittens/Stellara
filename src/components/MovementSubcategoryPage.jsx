import React, { useEffect, useMemo, useState } from "react";
import SubcategoryShell, { TAB_HISTORY, TAB_INPUT, TAB_TRACKER } from "./SubcategoryShell";
import { useCategoryTokenBalance } from "./Tokens";
import { earnTokens, spendTokens } from "../utils/tokens";

function emitMovementDataChanged(categoryId, subcategoryId) {
  try {
    window.dispatchEvent(
      new CustomEvent("movement-data-changed", {
        detail: { categoryId, subcategoryId },
      })
    );
  } catch {
    // ignore
  }
}

function todayKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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

function safeParseArray(raw) {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function clampInt(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function normalizeStrengthRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return list
    .map((r) => ({
      exercise: typeof r?.exercise === "string" ? r.exercise : "",
      scheme: typeof r?.scheme === "string" ? r.scheme : "",
    }))
    .filter((r) => r.exercise.trim() || r.scheme.trim());
}

function listExerciseEventsForEntry(entry) {
  const type = String(entry?.movementType || "");
  if (type === "strength") return [{ label: "Strength", usedToken: !!entry?.usedToken }];
  if (type === "yoga") return [{ label: "Yoga", usedToken: !!entry?.usedToken }];
  if (type === "walking") return [{ label: "Walking", usedToken: !!entry?.usedToken }];
  return [{ label: "Movement", usedToken: !!entry?.usedToken }];
}

function buildMovementStarHistory({ entries, tokenUses }) {
  const all = [];

  (Array.isArray(entries) ? entries : []).forEach((e) => {
    const dk = typeof e?.dateKey === "string" ? e.dateKey : "";
    if (!dk) return;
    const createdAt = typeof e?.createdAt === "string" ? e.createdAt : "";
    const eventLabels = listExerciseEventsForEntry(e);
    eventLabels.forEach((ev, idx) => {
      all.push({
        dateKey: dk,
        createdAt,
        usedToken: !!ev.usedToken,
        sortKey: `${dk}__${createdAt || ""}__e${String(idx).padStart(2, "0")}`,
      });
    });
  });

  (Array.isArray(tokenUses) ? tokenUses : []).forEach((t) => {
    const dk = typeof t?.dateKey === "string" ? t.dateKey : "";
    if (!dk) return;
    const createdAt = typeof t?.createdAt === "string" ? t.createdAt : "";
    all.push({
      dateKey: dk,
      createdAt,
      usedToken: true,
      sortKey: `${dk}__${createdAt || ""}__t00`,
    });
  });

  all.sort((a, b) => String(a.sortKey).localeCompare(String(b.sortKey)));

  // Cap: 3 exercises per day (3/5 star per day)
  const countedByDay = new Map();
  const credited = [];

  for (const ev of all) {
    const dk = ev.dateKey;
    const used = countedByDay.get(dk) || 0;
    if (used >= 3) continue;
    countedByDay.set(dk, used + 1);
    credited.push(ev);
  }

  // Build fragments starHistory (5 fragments per star)
  const starHistory = [];
  let current = new Array(5).fill(undefined);

  credited.forEach((ev, index) => {
    const i = index % 5;
    current[i] = ev.usedToken ? "silver" : "gold";
    if ((index + 1) % 5 === 0) {
      starHistory.push({ fragments: [...current] });
      current = new Array(5).fill(undefined);
    }
  });

  if (current.some((v) => v !== undefined)) {
    starHistory.push({ fragments: current });
  }

  return {
    starHistory,
    fragmentsEarned: credited.length,
    creditedByDay: countedByDay,
  };
}

function computeStarsFromFragmentsHistory(starHistory) {
  const history = Array.isArray(starHistory) ? starHistory : [];
  let filled = 0;
  history.forEach((e) => {
    const frags = Array.isArray(e?.fragments) ? e.fragments.slice(0, 5) : [];
    filled += frags.filter((v) => v === "gold" || v === "silver").length;
  });
  return filled / 5;
}

function computeCappedFragmentsForMonthYear(entries, tokenUses, prefix) {
  // prefix: YYYY-MM or YYYY
  const all = [];

  (Array.isArray(entries) ? entries : []).forEach((e) => {
    const dk = typeof e?.dateKey === "string" ? e.dateKey : "";
    if (!dk || !dk.startsWith(prefix)) return;
    const createdAt = typeof e?.createdAt === "string" ? e.createdAt : "";
    const eventLabels = listExerciseEventsForEntry(e);
    eventLabels.forEach((ev, idx) => {
      all.push({
        dateKey: dk,
        createdAt,
        usedToken: !!ev.usedToken,
        sortKey: `${dk}__${createdAt || ""}__e${String(idx).padStart(2, "0")}`,
      });
    });
  });

  (Array.isArray(tokenUses) ? tokenUses : []).forEach((t) => {
    const dk = typeof t?.dateKey === "string" ? t.dateKey : "";
    if (!dk || !dk.startsWith(prefix)) return;
    const createdAt = typeof t?.createdAt === "string" ? t.createdAt : "";
    all.push({
      dateKey: dk,
      createdAt,
      usedToken: true,
      sortKey: `${dk}__${createdAt || ""}__t00`,
    });
  });

  all.sort((a, b) => String(a.sortKey).localeCompare(String(b.sortKey)));

  const countedByDay = new Map();
  let credited = 0;
  let tokenCredited = 0;

  for (const ev of all) {
    const used = countedByDay.get(ev.dateKey) || 0;
    if (used >= 3) continue;
    countedByDay.set(ev.dateKey, used + 1);
    credited += 1;
    if (ev.usedToken) tokenCredited += 1;
  }

  return { credited, tokenCredited };
}

export default function MovementSubcategoryPage({ category, subcategory, onBack, lowEnergy }) {
  const [activeTab, setActiveTab] = useState(TAB_INPUT);
  const [editingEntryId, setEditingEntryId] = useState(null);

  const ENTRY_KEY = `movementEntries:${category.id}:${subcategory.id}`;
  const TOKEN_KEY = `movementTokens:${category.id}:${subcategory.id}`;

  const categoryTokenBalance = useCategoryTokenBalance(category.id);
  const TOKEN_COST_MOVEMENT = 1;

  const [entries, setEntries] = useState(() => safeParseArray(localStorage.getItem(ENTRY_KEY)));
  const [tokenUses, setTokenUses] = useState(() => safeParseArray(localStorage.getItem(TOKEN_KEY)));

  const [movementType, setMovementType] = useState("yoga");
  const [intensity, setIntensity] = useState("easy");
  const [minutes, setMinutes] = useState("5");

  const [yogaLink, setYogaLink] = useState("");

  const [walkingLocation, setWalkingLocation] = useState("outside");
  const [walkingPhoto, setWalkingPhoto] = useState(null);

  const [strengthRows, setStrengthRows] = useState([
    { exercise: "", scheme: "" },
    { exercise: "", scheme: "" },
  ]);

  const [tokenTarget, setTokenTarget] = useState("yoga");

  useEffect(() => {
    localStorage.setItem(ENTRY_KEY, JSON.stringify(Array.isArray(entries) ? entries : []));
    emitMovementDataChanged(category.id, subcategory.id);
  }, [ENTRY_KEY, category.id, entries, subcategory.id]);

  useEffect(() => {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(Array.isArray(tokenUses) ? tokenUses : []));
    emitMovementDataChanged(category.id, subcategory.id);
  }, [TOKEN_KEY, category.id, tokenUses, subcategory.id]);

  const derived = useMemo(() => buildMovementStarHistory({ entries, tokenUses }), [entries, tokenUses]);
  const starHistory = derived.starHistory;
  const currentStars = computeStarsFromFragmentsHistory(starHistory);

  const today = todayKey();
  const todayCount = derived.creditedByDay.get(today) || 0;
  const remainingToday = Math.max(0, 3 - todayCount);

  const monthKey = useMemo(() => today.slice(0, 7), [today]);
  const yearKey = useMemo(() => today.slice(0, 4), [today]);

  const monthlyFragmentsMax = useMemo(() => {
    const [yyyy, mm] = String(monthKey).split("-");
    const y = Number(yyyy);
    const m = Number(mm);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return 0;
    const daysInMonth = new Date(y, m, 0).getDate();
    return daysInMonth * 3;
  }, [monthKey]);

  const yearlyFragmentsMax = useMemo(() => {
    const y = Number(yearKey);
    if (!Number.isFinite(y)) return 0;
    const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    return (isLeap ? 366 : 365) * 3;
  }, [yearKey]);

  const monthly = useMemo(
    () => computeCappedFragmentsForMonthYear(entries, tokenUses, monthKey),
    [entries, tokenUses, monthKey]
  );

  const yearly = useMemo(
    () => computeCappedFragmentsForMonthYear(entries, tokenUses, yearKey),
    [entries, tokenUses, yearKey]
  );

  const trackerStats = useMemo(() => {
    const monthEntries = (Array.isArray(entries) ? entries : []).filter(
      (e) => typeof e?.dateKey === "string" && e.dateKey.startsWith(monthKey)
    );

    const monthTokens = (Array.isArray(tokenUses) ? tokenUses : []).filter(
      (t) => typeof t?.dateKey === "string" && t.dateKey.startsWith(monthKey)
    );

    const types = {
      yoga: 0,
      walking: 0,
      strength: 0,
    };

    const intensityCounts = {
      easy: 0,
      medium: 0,
      heavy: 0,
    };

    // Workout length buckets (minutes): Short <= 10, Medium 11-30, Long >= 31
    let shortCount = 0;
    let mediumCount = 0;
    let longCount = 0;

    const bumpType = (raw) => {
      const t = String(raw || "").toLowerCase();
      if (t === "yoga") types.yoga += 1;
      else if (t === "walking") types.walking += 1;
      else if (t === "strength") types.strength += 1;
    };

    monthEntries.forEach((e) => {
      bumpType(e?.movementType);

      const inten = String(e?.intensity || "").toLowerCase();
      if (inten === "easy") intensityCounts.easy += 1;
      else if (inten === "medium") intensityCounts.medium += 1;
      else if (inten === "heavy") intensityCounts.heavy += 1;

      const mins = Number(e?.minutes);
      if (!Number.isFinite(mins) || mins <= 0) return;
      if (mins <= 10) shortCount += 1;
      else if (mins <= 30) mediumCount += 1;
      else longCount += 1;
    });

    // Note: tokens should NOT affect Movement Type tracking.

    const typeTotal = types.yoga + types.walking + types.strength;
    const yogaPct = typeTotal ? Math.round((types.yoga / typeTotal) * 100) : 0;
    const walkingPct = typeTotal ? Math.round((types.walking / typeTotal) * 100) : 0;
    const strengthPct = typeTotal ? Math.max(0, 100 - yogaPct - walkingPct) : 0;

    const intensityTotal = intensityCounts.easy + intensityCounts.medium + intensityCounts.heavy;
    const easyPct = intensityTotal ? Math.round((intensityCounts.easy / intensityTotal) * 100) : 0;
    const mediumPct = intensityTotal ? Math.round((intensityCounts.medium / intensityTotal) * 100) : 0;
    const heavyPct = intensityTotal ? Math.max(0, 100 - easyPct - mediumPct) : 0;

    return {
      type: {
        yoga: types.yoga,
        walking: types.walking,
        strength: types.strength,
        yogaPct,
        walkingPct,
        strengthPct,
      },
      intensity: {
        easy: intensityCounts.easy,
        medium: intensityCounts.medium,
        heavy: intensityCounts.heavy,
        easyPct,
        mediumPct,
        heavyPct,
      },
      length: {
        shortCount,
        mediumCount,
        longCount,
      },
    };
  }, [entries, monthKey, tokenUses]);

  const tokenModalContent = (
    <>
      <p className="token-confirm-copy">
        Are you sure? All you have to do is five minutes of light yoga, walking, or strength training.
      </p>
      <div className="journal-field" style={{ marginTop: "0.75rem" }}>
        <label className="journal-label">Apply token to</label>
        <select
          className="journal-input-text"
          value={tokenTarget}
          onChange={(e) => setTokenTarget(e.target.value)}
        >
          <option value="yoga">Yoga</option>
          <option value="walking">Walking</option>
          <option value="strength">Strength</option>
          {normalizeStrengthRows(strengthRows).map((r, idx) => (
            <option key={`${r.exercise}-${idx}`} value={`strength:${idx}`}>
              Strength: {r.exercise || `Exercise ${idx + 1}`}
            </option>
          ))}
        </select>
      </div>
    </>
  );

  const canLog = remainingToday > 0;

  const resetForm = () => {
    setMovementType("yoga");
    setIntensity("easy");
    setMinutes("5");
    setYogaLink("");
    setWalkingLocation("outside");
    setWalkingPhoto(null);
    setStrengthRows([
      { exercise: "", scheme: "" },
      { exercise: "", scheme: "" },
    ]);
    setTokenTarget("yoga");
  };

  const beginEdit = (historyEntry) => {
    const id = typeof historyEntry?.id === "string" ? historyEntry.id : "";
    if (!id) return;
    const existing = (Array.isArray(entries) ? entries : []).find((e) => e?.id === id);
    if (!existing) return;

    setEditingEntryId(id);

    const type = String(existing?.movementType || "yoga");
    setMovementType(type);
    setTokenTarget(type);

    setIntensity(String(existing?.intensity || "easy"));
    setMinutes(String(typeof existing?.minutes === "number" ? existing.minutes : ""));

    setYogaLink(typeof existing?.yogaLink === "string" ? existing.yogaLink : "");

    const loc = String(existing?.walkingLocation || "outside");
    setWalkingLocation(loc === "inside" ? "inside" : "outside");
    setWalkingPhoto(
      loc === "outside" && typeof existing?.walkingPhoto === "string" ? existing.walkingPhoto : null
    );

    const normalized = normalizeStrengthRows(existing?.strengthRows);
    const baseRows = normalized.length ? normalized : [{ exercise: "", scheme: "" }, { exercise: "", scheme: "" }];
    setStrengthRows(baseRows.length >= 2 ? baseRows : [...baseRows, { exercise: "", scheme: "" }]);

    setActiveTab(TAB_INPUT);
  };

  const handleLog = () => {
    const nowIso = new Date().toISOString();
    const isEditing = typeof editingEntryId === "string" && editingEntryId.length > 0;
    const existing = isEditing
      ? (Array.isArray(entries) ? entries : []).find((e) => e?.id === editingEntryId)
      : null;

    // Creating a new entry respects the daily cap; editing an existing entry does not add fragments.
    if (!canLog && !isEditing) return;

    const mins = clampInt(minutes, 0, 9999);

    const dk = typeof existing?.dateKey === "string" && existing.dateKey ? existing.dateKey : todayKey();
    const createdAt = typeof existing?.createdAt === "string" && existing.createdAt ? existing.createdAt : nowIso;

    const base = {
      id: isEditing ? editingEntryId : `mov-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      dateKey: dk,
      createdAt,
      updatedAt: isEditing ? nowIso : undefined,
      lowEnergy: isEditing ? !!existing?.lowEnergy : !!lowEnergy,
      movementType,
      intensity,
      minutes: mins,
    };

    const next = { ...base };

    if (movementType === "yoga") {
      next.yogaLink = yogaLink.trim();
    }

    if (movementType === "walking") {
      next.walkingLocation = walkingLocation;
      next.walkingPhoto = walkingLocation === "outside" ? walkingPhoto : null;
    }

    if (movementType === "strength") {
      next.strengthRows = normalizeStrengthRows(strengthRows);
    }

    if (isEditing) {
      setEntries((prev) =>
        (Array.isArray(prev) ? prev : []).map((e) => (e?.id === editingEntryId ? { ...e, ...next } : e))
      );
      setEditingEntryId(null);
      setActiveTab(TAB_HISTORY);
      return;
    }

    setEntries((prev) => [next, ...(Array.isArray(prev) ? prev : [])]);
    resetForm();
  };

  const handleDeleteHistoryEntry = (entry) => {
    if (!entry) return;
    if (entry.isToken) {
      const existing = (Array.isArray(tokenUses) ? tokenUses : []).find((t) => t?.id === entry.id);
      const refund = Math.max(
        0,
        Math.floor(Number(existing?.tokensSpent) || TOKEN_COST_MOVEMENT)
      );

      setTokenUses((prev) => (Array.isArray(prev) ? prev.filter((t) => t.id !== entry.id) : prev));

      if (refund > 0) {
        earnTokens({
          categoryId: category.id,
          amount: refund,
          source: "movement-token-refund",
          meta: {
            subcategoryId: subcategory.id,
            dateKey: entry?.dateKey,
            entryId: entry?.id,
          },
        });
      }
      return;
    }
    setEntries((prev) => (Array.isArray(prev) ? prev.filter((e) => e.id !== entry.id) : prev));
  };

  const historyEntries = useMemo(() => {
    const mappedEntries = (Array.isArray(entries) ? entries : []).map((e) => {
      const dk = typeof e?.dateKey === "string" ? e.dateKey : "";
      const title = formatEuropeanDate(dk);
      const type = String(e?.movementType || "movement");

      const intensityLabel = String(e?.intensity || "");
      const mins = typeof e?.minutes === "number" ? e.minutes : 0;

      let lines = [];
      if (intensityLabel) lines.push(`Intensity: ${intensityLabel}`);
      lines.push(`Length: ${mins} minutes`);

      if (type === "yoga" && e?.yogaLink) lines.push(`Routine: ${String(e.yogaLink).trim()}`);

      if (type === "walking") {
        const loc = String(e?.walkingLocation || "");
        if (loc) lines.push(`Location: ${loc}`);
      }

      if (type === "strength") {
        const rows = normalizeStrengthRows(e?.strengthRows);
        if (rows.length) {
          lines.push("");
          rows.forEach((r) => {
            lines.push(`${r.exercise || "Exercise"} — ${r.scheme || ""}`.trim());
          });
        }
      }

      const attachments = [];
      if (type === "walking" && e?.walkingLocation === "outside" && typeof e?.walkingPhoto === "string" && e.walkingPhoto) {
        attachments.push(e.walkingPhoto);
      }

      return {
        id: e.id,
        dateKey: dk,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
        lowEnergy: !!e.lowEnergy,
        timeOfDay: type,
        title,
        text: lines.join("\n"),
        attachments,
      };
    });

    const mappedTokens = (Array.isArray(tokenUses) ? tokenUses : []).map((t) => {
      const dk = typeof t?.dateKey === "string" ? t.dateKey : "";
      const title = formatEuropeanDate(dk);
      const type = String(t?.movementType || "movement");
      const appliedTo = typeof t?.appliedTo === "string" ? t.appliedTo : "";
      return {
        id: t.id,
        dateKey: dk,
        createdAt: t.createdAt,
        lowEnergy: !!t.lowEnergy,
        isToken: true,
        timeOfDay: type,
        title,
        text: appliedTo ? `Token applied to: ${appliedTo}` : "",
      };
    });

    return [...mappedEntries, ...mappedTokens].filter((e) => e?.dateKey);
  }, [entries, tokenUses]);

  const renderInput = ({ TokenControl }) => (
    <>
      <div className="tracker-section">
        <div className="tracker-label">Movement Type</div>
        <div className="journal-input-row" style={{ marginTop: "0.6rem" }}>
          {[
            { id: "yoga", label: "Yoga" },
            { id: "walking", label: "Walking" },
            { id: "strength", label: "Strength" },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="journal-button-secondary"
              aria-pressed={movementType === opt.id}
              onClick={() => {
                setMovementType(opt.id);
                setTokenTarget(opt.id);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="tracker-section" style={{ marginTop: "0.9rem" }}>
        <div className="tracker-label">Intensity</div>
        <div className="journal-input-row" style={{ marginTop: "0.6rem" }}>
          {[
            { id: "easy", label: "Easy" },
            { id: "medium", label: "Medium" },
            { id: "heavy", label: "Heavy" },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              className="journal-button-secondary"
              aria-pressed={intensity === opt.id}
              onClick={() => setIntensity(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="journal-field" style={{ marginTop: "0.9rem" }}>
        <label className="journal-label">Workout Length (minutes)</label>
        <input
          className="journal-input-text"
          inputMode="numeric"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          placeholder="0"
        />
      </div>

      {movementType === "yoga" && (
        <div className="journal-field" style={{ marginTop: "0.9rem" }}>
          <label className="journal-label">Yoga routine link</label>
          <input
            className="journal-input-text"
            value={yogaLink}
            onChange={(e) => setYogaLink(e.target.value)}
            placeholder="https://…"
          />
        </div>
      )}

      {movementType === "walking" && (
        <>
          <div className="tracker-section" style={{ marginTop: "0.9rem" }}>
            <div className="tracker-label">Walking</div>
            <div className="journal-input-row" style={{ marginTop: "0.6rem" }}>
              <button
                type="button"
                className="journal-button-secondary"
                aria-pressed={walkingLocation === "outside"}
                onClick={() => setWalkingLocation("outside")}
              >
                Outside
              </button>
              <button
                type="button"
                className="journal-button-secondary"
                aria-pressed={walkingLocation === "inside"}
                onClick={() => {
                  setWalkingLocation("inside");
                  setWalkingPhoto(null);
                }}
              >
                Inside
              </button>
            </div>
          </div>

          {walkingLocation === "outside" && (
            <div className="journal-field" style={{ marginTop: "0.9rem" }}>
              <label className="journal-label">Route screenshot (optional)</label>
              <input
                className="journal-input-text"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    const res = typeof reader.result === "string" ? reader.result : null;
                    setWalkingPhoto(res);
                  };
                  reader.readAsDataURL(file);
                }}
              />
              {walkingPhoto && (
                <div style={{ marginTop: "0.65rem" }}>
                  <img
                    src={walkingPhoto}
                    alt="Walking route"
                    style={{
                      width: "100%",
                      maxWidth: "420px",
                      borderRadius: "12px",
                      display: "block",
                      opacity: 0.95,
                    }}
                  />
                  <button
                    type="button"
                    className="journal-button-secondary"
                    style={{ marginTop: "0.6rem" }}
                    onClick={() => setWalkingPhoto(null)}
                  >
                    Remove photo
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {movementType === "strength" && (
        <>
          <div className="tracker-section" style={{ marginTop: "0.9rem" }}>
            <div className="tracker-label">Strength exercises</div>
            <div className="tracker-sub" style={{ marginTop: "0.25rem" }}>
              Exercise | Sets x Reps x Weight
            </div>

            <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.6rem" }}>
              {strengthRows.map((row, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                  <input
                    className="journal-input-text"
                    value={row.exercise}
                    onChange={(e) =>
                      setStrengthRows((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, exercise: e.target.value } : r))
                      )
                    }
                    placeholder="Squats"
                  />
                  <input
                    className="journal-input-text"
                    value={row.scheme}
                    onChange={(e) =>
                      setStrengthRows((prev) =>
                        prev.map((r, i) => (i === idx ? { ...r, scheme: e.target.value } : r))
                      )
                    }
                    placeholder="3x10x0"
                  />
                </div>
              ))}

              <button
                type="button"
                className="journal-button-secondary"
                onClick={() => setStrengthRows((prev) => [...prev, { exercise: "", scheme: "" }])}
              >
                +
              </button>
            </div>
          </div>
        </>
      )}

      {!canLog && (
        <div className="tracker-sub" style={{ marginTop: "0.9rem" }}>
          Today is already at the 3/5 star cap.
        </div>
      )}

      <div className="journal-actions-row" style={{ marginTop: "0.9rem" }}>
        <button
          type="button"
          className="journal-button-primary"
          onClick={handleLog}
          disabled={!canLog && !(typeof editingEntryId === "string" && editingEntryId.length > 0)}
        >
          {typeof editingEntryId === "string" && editingEntryId.length > 0 ? "Save Changes" : "Log Movement"}
        </button>
      </div>

      {TokenControl && <TokenControl />}
    </>
  );

  const onConfirmToken = () => {
    const dk = todayKey();

    // Don't spend tokens if today is already at cap.
    const dayCount = derived.creditedByDay.get(dk) || 0;
    if (dayCount >= 3) return;

    const res = spendTokens({
      categoryId: category.id,
      amount: TOKEN_COST_MOVEMENT,
      source: "movement-token",
      meta: { target: tokenTarget },
    });

    if (!res?.ok) return;

    const nowIso = new Date().toISOString();

    const appliedTo = (() => {
      if (tokenTarget === "yoga") return "Yoga";
      if (tokenTarget === "walking") return "Walking";
      if (tokenTarget === "strength") return "Strength";
      if (tokenTarget.startsWith("strength:")) {
        const idx = clampInt(tokenTarget.split(":")[1], 0, 999);
        const rows = normalizeStrengthRows(strengthRows);
        const ex = rows[idx]?.exercise || "Strength";
        return `Strength: ${ex}`;
      }
      return "Movement";
    })();

    setTokenUses((prev) => [
      {
        id: `movtok-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        dateKey: dk,
        createdAt: nowIso,
        lowEnergy: !!lowEnergy,
        movementType: tokenTarget.startsWith("strength") ? "strength" : tokenTarget,
        appliedTo,
        isToken: true,
        tokensSpent: TOKEN_COST_MOVEMENT,
      },
      ...(Array.isArray(prev) ? prev : []),
    ]);
  };

  const subcategoryWithComputedStars = useMemo(
    () => ({ ...subcategory, starHistory, currentStars }),
    [subcategory, starHistory, currentStars]
  );

  return (
    <SubcategoryShell
      category={category}
      subcategory={subcategoryWithComputedStars}
      onBack={onBack}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      renderInput={renderInput}
      historyEntries={historyEntries}
      historyTheme="earth"
      onRequestEditEntry={beginEdit}
      onDeleteEntry={handleDeleteHistoryEntry}
      lowEnergy={!!lowEnergy}
      onPatchHistoryEntries={setEntries}
      renderTokenControl={() => null}
      tokenControlPlacement="manual"
      availableTokens={categoryTokenBalance}
      minTokensToApply={TOKEN_COST_MOVEMENT}
      tokenModalContent={tokenModalContent}
      onConfirmToken={onConfirmToken}
      tokensUsed={monthly.tokenCredited}
      monthlyFragments={monthly.credited}
      yearlyFragments={yearly.credited}
      monthlyFragmentsMax={monthlyFragmentsMax}
      yearlyFragmentsMax={yearlyFragmentsMax}
      fragmentsLogged={derived.fragmentsEarned}
      entriesLogged={(Array.isArray(entries) ? entries.length : 0) + (Array.isArray(tokenUses) ? tokenUses.length : 0)}
      avgChars={0}
      totalStarsApprox={currentStars}
      renderTracker={() => (
        <div className="journal-tracker">
          <div className="tracker-section">
            <div className="tracker-label">Movement type</div>

            <div className="tracker-bar-row">
              <span className="tracker-bar-label">Yoga</span>
              <div className="tracker-bar-track">
                <div className="tracker-bar-fill" style={{ width: `${trackerStats.type.yogaPct}%` }} />
              </div>
              <span className="tracker-bar-value">
                {trackerStats.type.yoga} ({trackerStats.type.yogaPct}%)
              </span>
            </div>

            <div className="tracker-bar-row">
              <span className="tracker-bar-label">Walking</span>
              <div className="tracker-bar-track">
                <div className="tracker-bar-fill" style={{ width: `${trackerStats.type.walkingPct}%` }} />
              </div>
              <span className="tracker-bar-value">
                {trackerStats.type.walking} ({trackerStats.type.walkingPct}%)
              </span>
            </div>

            <div className="tracker-bar-row">
              <span className="tracker-bar-label">Strength</span>
              <div className="tracker-bar-track">
                <div className="tracker-bar-fill" style={{ width: `${trackerStats.type.strengthPct}%` }} />
              </div>
              <span className="tracker-bar-value">
                {trackerStats.type.strength} ({trackerStats.type.strengthPct}%)
              </span>
            </div>
          </div>

          <div className="tracker-section">
            <div className="tracker-label">Intensity</div>

            <div className="tracker-bar-row">
              <span className="tracker-bar-label">Easy</span>
              <div className="tracker-bar-track">
                <div className="tracker-bar-fill" style={{ width: `${trackerStats.intensity.easyPct}%` }} />
              </div>
              <span className="tracker-bar-value">
                {trackerStats.intensity.easy} ({trackerStats.intensity.easyPct}%)
              </span>
            </div>

            <div className="tracker-bar-row">
              <span className="tracker-bar-label">Medium</span>
              <div className="tracker-bar-track">
                <div className="tracker-bar-fill" style={{ width: `${trackerStats.intensity.mediumPct}%` }} />
              </div>
              <span className="tracker-bar-value">
                {trackerStats.intensity.medium} ({trackerStats.intensity.mediumPct}%)
              </span>
            </div>

            <div className="tracker-bar-row">
              <span className="tracker-bar-label">Heavy</span>
              <div className="tracker-bar-track">
                <div className="tracker-bar-fill" style={{ width: `${trackerStats.intensity.heavyPct}%` }} />
              </div>
              <span className="tracker-bar-value">
                {trackerStats.intensity.heavy} ({trackerStats.intensity.heavyPct}%)
              </span>
            </div>
          </div>

          <div className="tracker-section">
            <div className="tracker-label">Workout length</div>
            <div className="tracker-length-row">
              <div className="tracker-length-pill">
                <span className="tracker-pill-label">Short</span>
                <span className="tracker-pill-value">{trackerStats.length.shortCount}</span>
              </div>
              <div className="tracker-length-pill">
                <span className="tracker-pill-label">Medium</span>
                <span className="tracker-pill-value">{trackerStats.length.mediumCount}</span>
              </div>
              <div className="tracker-length-pill">
                <span className="tracker-pill-label">Long</span>
                <span className="tracker-pill-value">{trackerStats.length.longCount}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    />
  );
}

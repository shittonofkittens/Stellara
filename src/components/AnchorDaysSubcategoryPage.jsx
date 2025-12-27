import React, { useEffect, useMemo, useState } from "react";
import SubcategoryShell, { TAB_HISTORY, TAB_INPUT } from "./SubcategoryShell";

function safeParseArray(raw) {
  try {
    const v = JSON.parse(raw || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
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
  const dk = String(dateKey || "");
  const [yyyy, mm, dd] = dk.split("-");
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

  if (!yyyy || !mm || !dd) return dk;
  if (!Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) return dk;
  return `${dd} ${monthNames[monthIndex]} ${yyyy}`;
}

function emitSpiritDataChanged(categoryId, subcategoryId) {
  try {
    window.dispatchEvent(
      new CustomEvent("spirit-data-changed", {
        detail: { categoryId, subcategoryId },
      })
    );
  } catch {
    // ignore
  }
}

function dateFromKeyUtc(dateKey) {
  const [yyyy, mm, dd] = String(dateKey || "").split("-").map((x) => Number(x));
  if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return null;
  return new Date(Date.UTC(yyyy, mm - 1, dd));
}

function weekKeyMondayUtc(dateKey) {
  const d = dateFromKeyUtc(dateKey);
  if (!d) return "";
  const day = d.getUTCDay(); // 0..6 (Sun..Sat)
  const diff = (day + 6) % 7; // days since Monday
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - diff);
  return monday.toISOString().slice(0, 10); // YYYY-MM-DD
}

function buildWeeklyHalvesStarHistory(entries) {
  const list = Array.isArray(entries) ? entries : [];
  const sorted = list
    .filter((e) => typeof e?.dateKey === "string" && e.dateKey)
    .slice()
    .sort((a, b) => {
      const ak = String(a?.dateKey || "");
      const bk = String(b?.dateKey || "");
      if (ak !== bk) return ak.localeCompare(bk);
      return String(a?.createdAt || "").localeCompare(String(b?.createdAt || ""));
    });

  const creditedByWeek = new Map();
  const creditedWeekToDateKey = new Map();
  const halfColors = [];

  for (const e of sorted) {
    const dk = String(e?.dateKey || "");
    if (!dk) continue;
    const wk = weekKeyMondayUtc(dk);
    if (!wk) continue;
    if (creditedByWeek.has(wk)) continue;
    creditedByWeek.set(wk, 1);
    creditedWeekToDateKey.set(wk, dk);
    halfColors.push("gold");
  }

  const starHistory = [];
  let current = [];
  for (const c of halfColors) {
    current.push(c);
    if (current.length === 2) {
      starHistory.push({ halves: [...current] });
      current = [];
    }
  }
  if (current.length) starHistory.push({ halves: [...current] });

  return {
    starHistory,
    creditedByWeek,
    creditedWeekToDateKey,
    currentStars: halfColors.length / 2,
    halfCount: halfColors.length,
  };
}

function daysInMonthFromMonthKey(monthKey) {
  const [yyyy, mm] = String(monthKey || "").split("-");
  const y = Number(yyyy);
  const m = Number(mm);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return 0;
  return new Date(y, m, 0).getDate();
}

export default function AnchorDaysSubcategoryPage({ category, subcategory, onBack, lowEnergy }) {
  const [activeTab, setActiveTab] = useState(TAB_INPUT);

  const ENTRY_KEY = `spiritAnchorEntries:${category.id}:${subcategory.id}`;

  const [entries, setEntries] = useState(() => safeParseArray(localStorage.getItem(ENTRY_KEY)));

  const [dateKey, setDateKey] = useState(todayKey());
  const [anchorType, setAnchorType] = useState("");
  const [notes, setNotes] = useState("");
  const [editingEntryId, setEditingEntryId] = useState(null);

  useEffect(() => {
    localStorage.setItem(ENTRY_KEY, JSON.stringify(Array.isArray(entries) ? entries : []));
    emitSpiritDataChanged(category.id, subcategory.id);
  }, [ENTRY_KEY, category.id, entries, subcategory.id]);

  const derived = useMemo(() => buildWeeklyHalvesStarHistory(entries), [entries]);

  const thisWeekKey = useMemo(() => weekKeyMondayUtc(todayKey()), []);
  const completedThisWeek = (derived.creditedByWeek?.get?.(thisWeekKey) || 0) > 0;

  const monthKey = useMemo(() => String(todayKey()).slice(0, 7), []);
  const yearKey = useMemo(() => String(todayKey()).slice(0, 4), []);

  const creditedThisMonth = useMemo(() => {
    let sum = 0;
    for (const [, dk] of derived.creditedWeekToDateKey || []) {
      if (String(dk).startsWith(monthKey)) sum += 1;
    }
    return sum;
  }, [derived.creditedWeekToDateKey, monthKey]);

  const creditedThisYear = useMemo(() => {
    let sum = 0;
    for (const [, dk] of derived.creditedWeekToDateKey || []) {
      if (String(dk).startsWith(yearKey)) sum += 1;
    }
    return sum;
  }, [derived.creditedWeekToDateKey, yearKey]);

  const ANCHOR_OPTIONS = [
    { id: "reading", label: "Reading" },
    { id: "anime", label: "Watching Anime" },
    { id: "bath", label: "Bath" },
    { id: "music", label: "Music" },
    { id: "gaming", label: "Gaming" },
    { id: "art", label: "Art" },
    { id: "other", label: "Other" },
  ];

  const typeLabel = (id) => {
    const found = ANCHOR_OPTIONS.find((x) => x.id === id);
    return found ? found.label : "";
  };

  const historyEntries = useMemo(() => {
    const list = Array.isArray(entries) ? entries : [];
    return list
      .slice()
      .sort((a, b) => {
        const ak = String(a?.dateKey || "");
        const bk = String(b?.dateKey || "");
        if (ak !== bk) return ak.localeCompare(bk);
        return String(a?.createdAt || "").localeCompare(String(b?.createdAt || ""));
      })
      .map((e) => {
        const at = String(e?.anchorType || "").trim();
        return {
          id: String(e?.id || ""),
          dateKey: String(e?.dateKey || ""),
          createdAt: e.createdAt,
          updatedAt: e.updatedAt,
          lowEnergy: !!e.lowEnergy,
          title: formatEuropeanDate(e?.dateKey),
          timeOfDay: typeLabel(at) || "Anchor Day",
          text: String(e?.notes || "").trim(),
        };
      });
  }, [entries]);

  const resetForm = () => {
    setAnchorType("");
    setNotes("");
    setDateKey(todayKey());
  };

  const beginEdit = (entry) => {
    const id = String(entry?.id || "");
    if (!id) return;
    const existing = (Array.isArray(entries) ? entries : []).find((e) => String(e?.id || "") === id);
    if (!existing) return;
    setEditingEntryId(id);
    setDateKey(String(existing?.dateKey || todayKey()));
    setAnchorType(String(existing?.anchorType || ""));
    setNotes(String(existing?.notes || ""));
    setActiveTab(TAB_INPUT);
  };

  const handleDeleteHistoryEntry = (entry) => {
    const id = String(entry?.id || "");
    if (!id) return;
    setEntries((prev) => (Array.isArray(prev) ? prev : []).filter((e) => String(e?.id || "") !== id));
    if (editingEntryId === id) {
      setEditingEntryId(null);
      resetForm();
    }
  };

  const handleLog = () => {
    const dk = String(dateKey || "").trim() || todayKey();
    const at = String(anchorType || "").trim();
    const trimmedNotes = String(notes || "").trim();
    if (!dk) return;
    if (!at) return;

    const nowIso = new Date().toISOString();
    const isEditing = typeof editingEntryId === "string" && editingEntryId.length > 0;

    if (isEditing) {
      setEntries((prev) =>
        (Array.isArray(prev) ? prev : []).map((e) =>
          String(e?.id || "") === editingEntryId
            ? {
                ...e,
                dateKey: dk,
                anchorType: at,
                notes: trimmedNotes,
                updatedAt: nowIso,
              }
            : e
        )
      );
      setEditingEntryId(null);
      resetForm();
      setActiveTab(TAB_HISTORY);
      return;
    }

    setEntries((prev) => [
      {
        id: `spa-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        dateKey: dk,
        createdAt: nowIso,
        lowEnergy: !!lowEnergy,
        anchorType: at,
        notes: trimmedNotes,
      },
      ...(Array.isArray(prev) ? prev : []),
    ]);

    resetForm();
    setActiveTab(TAB_HISTORY);
  };

  const cancelEdit = () => {
    setEditingEntryId(null);
    resetForm();
  };

  const subcategoryWithComputedStars = useMemo(
    () => ({
      ...subcategory,
      starHistory: derived.starHistory,
      currentStars: derived.currentStars,
      completedToday: completedThisWeek,
      monthlyFragments: creditedThisMonth,
      monthlyFragmentsMax: 4,
    }),
    [subcategory, derived.starHistory, derived.currentStars, completedThisWeek, creditedThisMonth]
  );

  const trackerStats = useMemo(() => {
    const counts = {
      reading: 0,
      anime: 0,
      bath: 0,
      music: 0,
      gaming: 0,
      art: 0,
      other: 0,
    };

    const list = Array.isArray(entries) ? entries : [];
    let total = 0;
    for (const e of list) {
      const t = String(e?.anchorType || "").trim();
      if (!Object.prototype.hasOwnProperty.call(counts, t)) continue;
      counts[t] += 1;
      total += 1;
    }

    const pct = {};
    Object.keys(counts).forEach((k) => {
      pct[k] = total ? Math.round((counts[k] / total) * 100) : 0;
    });

    return { counts, pct, total };
  }, [entries]);

  const canSubmit = String(anchorType || "").trim().length > 0;

  return (
    <SubcategoryShell
      category={category}
      subcategory={subcategoryWithComputedStars}
      onBack={onBack}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      summaryLabel="Weeks"
      summaryValue={derived.halfCount}
      lowEnergy={!!lowEnergy}
      onPatchHistoryEntries={setEntries}
      renderTokenControl={() => null}
      tokenControlPlacement="manual"
      availableTokens={0}
      minTokensToApply={9999}
      tokenModalContent={null}
      onConfirmToken={() => null}
      tokensUsed={0}
      monthlyFragments={creditedThisMonth}
      yearlyFragments={creditedThisYear}
      monthlyFragmentsMax={4}
      yearlyFragmentsMax={48}
      fragmentsLogged={derived.halfCount}
      entriesLogged={historyEntries.length}
      avgChars={0}
      totalStarsApprox={derived.currentStars}
      historyEntries={historyEntries}
      onRequestEditEntry={beginEdit}
      onDeleteEntry={handleDeleteHistoryEntry}
      renderTracker={() => (
        <div className="journal-tracker">
          <div className="tracker-section">
            <div className="tracker-label">Tasks</div>

            {ANCHOR_OPTIONS.map((row) => (
              <div key={row.id} className="tracker-bar-row">
                <span className="tracker-bar-label">{row.label}</span>
                <div className="tracker-bar-track">
                  <div className="tracker-bar-fill" style={{ width: `${trackerStats.pct[row.id] || 0}%` }} />
                </div>
                <span className="tracker-bar-value">
                  {trackerStats.counts[row.id] || 0} ({trackerStats.pct[row.id] || 0}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      renderInput={() => (
        <div className="journal-input">
          <div className="journal-input-box">
            <div className="journal-input-row">
              <div className="journal-field">
                <label className="journal-label">Date</label>
                <input type="date" className="journal-input-text" value={dateKey} onChange={(e) => setDateKey(e.target.value)} />
              </div>
            </div>

            <div className="tracker-section" style={{ marginTop: "0.9rem" }}>
              <div className="tracker-label">Anchor Type</div>
              <div className="journal-input-row" style={{ marginTop: "0.6rem" }}>
                {ANCHOR_OPTIONS.map((opt) => {
                  const pressed = anchorType === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className="journal-button-secondary"
                      aria-pressed={pressed}
                      onClick={() => setAnchorType((prev) => (prev === opt.id ? "" : opt.id))}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="journal-field" style={{ marginTop: "0.9rem" }}>
              <label className="journal-label">Notes</label>
              <textarea
                className="journal-textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Rest, ritual, reflection…"
              />
            </div>

            <div className="journal-input-actions">
              {editingEntryId ? (
                <>
                  <button type="button" className="journal-button-secondary" onClick={cancelEdit}>
                    Cancel
                  </button>
                  <button type="button" className="journal-button-primary" onClick={handleLog} disabled={!canSubmit}>
                    Save
                  </button>
                </>
              ) : (
                <button type="button" className="journal-button-primary" onClick={handleLog} disabled={!canSubmit}>
                  Log
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    />
  );
}

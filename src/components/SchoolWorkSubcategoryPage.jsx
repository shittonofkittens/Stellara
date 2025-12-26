import React, { useEffect, useMemo, useState } from "react";
import SubcategoryShell, { GroupedHistoryTab, TAB_HISTORY, TAB_INPUT, TAB_TRACKER } from "./SubcategoryShell";
import { useCategoryTokenBalance } from "./Tokens";
import { earnTokens, spendTokens } from "../utils/tokens";

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

function dateKeyToDateLocal(dk) {
  const [yyyy, mm, dd] = String(dk || "").split("-");
  const y = Number(yyyy);
  const m = Number(mm);
  const d = Number(dd);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(y, m - 1, d);
}

function getAcademicTermIndex(dateKeyStr) {
  const bounds = getAcademicYearBounds(dateKeyStr);
  const start = dateKeyToDateLocal(bounds.startKey);
  const d = dateKeyToDateLocal(dateKeyStr);
  if (!start || !d) return 1;
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.max(0, Math.floor((d.getTime() - start.getTime()) / dayMs));
  if (diffDays >= 56 * 5) return 6;
  return Math.max(1, Math.min(6, Math.floor(diffDays / 56) + 1));
}

function clampTerm(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(6, Math.trunc(n)));
}

function emitWillDataChanged(categoryId, subcategoryId) {
  try {
    window.dispatchEvent(
      new CustomEvent("will-data-changed", {
        detail: { categoryId, subcategoryId },
      })
    );
  } catch {
    // ignore
  }
}

function clampInt(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function buildSchoolWorkHalfStarHistory({ entries, tokenUses, minutesRequired }) {
  const minsReq = clampInt(minutesRequired, 1, 1000);

  const minutesByDay = new Map();
  (Array.isArray(entries) ? entries : []).forEach((e) => {
    const dk = typeof e?.dateKey === "string" ? e.dateKey : "";
    if (!dk) return;
    const mins = typeof e?.minutesSpent === "number" && Number.isFinite(e.minutesSpent) ? e.minutesSpent : 0;
    const used = minutesByDay.get(dk) || 0;
    minutesByDay.set(dk, used + Math.max(0, Math.trunc(mins)));
  });

  const tokenByDay = new Map();
  (Array.isArray(tokenUses) ? tokenUses : []).forEach((t) => {
    const dk = typeof t?.dateKey === "string" ? t.dateKey : "";
    if (!dk) return;
    if (tokenByDay.has(dk)) return;
    tokenByDay.set(dk, true);
  });

  const daySet = new Set([...minutesByDay.keys(), ...tokenByDay.keys()]);
  const days = [...daySet].sort((a, b) => String(a).localeCompare(String(b)));

  const creditedByDay = new Map();
  const creditedDays = [];

  for (const dk of days) {
    const mins = minutesByDay.get(dk) || 0;
    const eligible = mins >= minsReq;
    const hasToken = tokenByDay.has(dk);
    if (!eligible && !hasToken) continue;

    const usedToken = !eligible && hasToken;
    creditedByDay.set(dk, 1);
    creditedDays.push({ dateKey: dk, usedToken });
  }

  const halfColors = creditedDays.map((d) => (d.usedToken ? "silver" : "gold"));

  const starHistory = [];
  let currentHalves = [];
  for (const c of halfColors) {
    currentHalves.push(c);
    if (currentHalves.length === 2) {
      starHistory.push({ halves: [...currentHalves] });
      currentHalves = [];
    }
  }
  if (currentHalves.length) starHistory.push({ halves: [...currentHalves] });

  return {
    starHistory,
    currentStars: halfColors.length / 2,
    creditedByDay,
    creditedDays,
    fragmentsEarned: creditedDays.length,
  };
}

function getAcademicYearBounds(todayKeyStr) {
  const [yyyy, mm] = String(todayKeyStr || "").split("-");
  const year = Number(yyyy);
  const month = Number(mm);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return { startKey: "0000-01-01", endKey: "9999-12-31" };
  }

  const startYear = month >= 8 ? year : year - 1;
  return {
    startKey: `${startYear}-08-01`,
    endKey: `${startYear + 1}-08-01`,
  };
}

export default function SchoolWorkSubcategoryPage({ category, subcategory, onBack, lowEnergy }) {
  const [activeTab, setActiveTab] = useState(TAB_INPUT);

  const ENTRY_KEY = `willSchoolEntries:${category.id}:${subcategory.id}`;
  const TOKEN_KEY = `willSchoolTokens:${category.id}:${subcategory.id}`;

  const TOKEN_COST_SCHOOL = 3;
  const MINUTES_REQUIRED = 60;

  const availableTokens = useCategoryTokenBalance(category.id);

  const [dateKey, setDateKey] = useState(todayKey());
  const [termNumber, setTermNumber] = useState(() => getAcademicTermIndex(todayKey()));
  const [className, setClassName] = useState("");
  const [minutesText, setMinutesText] = useState("");
  const [notes, setNotes] = useState("");

  const [editingEntryId, setEditingEntryId] = useState(null);

  const [entries, setEntries] = useState(() => safeParseArray(localStorage.getItem(ENTRY_KEY)));
  const [tokenUses, setTokenUses] = useState(() => safeParseArray(localStorage.getItem(TOKEN_KEY)));

  useEffect(() => {
    localStorage.setItem(ENTRY_KEY, JSON.stringify(Array.isArray(entries) ? entries : []));
    emitWillDataChanged(category.id, subcategory.id);
  }, [ENTRY_KEY, category.id, entries, subcategory.id]);

  useEffect(() => {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(Array.isArray(tokenUses) ? tokenUses : []));
    emitWillDataChanged(category.id, subcategory.id);
  }, [TOKEN_KEY, category.id, subcategory.id, tokenUses]);

  const today = useMemo(() => todayKey(), []);
  const monthKey = useMemo(() => today.slice(0, 7), [today]);

  const derived = useMemo(
    () => buildSchoolWorkHalfStarHistory({ entries, tokenUses, minutesRequired: MINUTES_REQUIRED }),
    [entries, tokenUses]
  );

  const creditedThisMonth = useMemo(() => {
    return derived.creditedDays.filter((d) => String(d?.dateKey || "").startsWith(monthKey)).length;
  }, [derived.creditedDays, monthKey]);

  const tokenCreditedThisMonth = useMemo(() => {
    return derived.creditedDays.filter((d) => d.usedToken && String(d?.dateKey || "").startsWith(monthKey)).length;
  }, [derived.creditedDays, monthKey]);

  const daysInMonth = useMemo(() => {
    const [yyyy, mm] = String(monthKey).split("-");
    const y = Number(yyyy);
    const m = Number(mm);
    if (!Number.isFinite(y) || !Number.isFinite(m)) return 0;
    return new Date(y, m, 0).getDate();
  }, [monthKey]);

  const academicYear = useMemo(() => getAcademicYearBounds(today), [today]);
  const creditedThisAcademicYear = useMemo(() => {
    return derived.creditedDays.filter((d) => {
      const dk = String(d?.dateKey || "");
      return dk >= academicYear.startKey && dk < academicYear.endKey;
    }).length;
  }, [academicYear.endKey, academicYear.startKey, derived.creditedDays]);

  const academicMinutes = useMemo(() => {
    const minutesByDay = new Map();
    (Array.isArray(entries) ? entries : []).forEach((e) => {
      const dk = typeof e?.dateKey === "string" ? e.dateKey : "";
      if (!dk) return;
      if (dk < academicYear.startKey || dk >= academicYear.endKey) return;
      const mins = typeof e?.minutesSpent === "number" && Number.isFinite(e.minutesSpent) ? e.minutesSpent : 0;
      const used = minutesByDay.get(dk) || 0;
      minutesByDay.set(dk, used + Math.max(0, Math.trunc(mins)));
    });

    const totals = [...minutesByDay.values()].filter((n) => n > 0);
    const totalMinutes = totals.reduce((sum, n) => sum + n, 0);
    const studyDays = totals.length;
    const avgPerDay = studyDays > 0 ? totalMinutes / studyDays : 0;
    return { totalMinutes, studyDays, avgPerDay };
  }, [academicYear.endKey, academicYear.startKey, entries]);

  const fragmentsLogged = derived.fragmentsEarned;
  const totalStarsApprox = derived.currentStars;

  const todayMinutes = useMemo(() => {
    return (Array.isArray(entries) ? entries : [])
      .filter((e) => typeof e?.dateKey === "string" && e.dateKey === today)
      .reduce((sum, e) => {
        const mins = typeof e?.minutesSpent === "number" && Number.isFinite(e.minutesSpent) ? e.minutesSpent : 0;
        return sum + Math.max(0, Math.trunc(mins));
      }, 0);
  }, [entries, today]);

  const tokenUsedToday = useMemo(() => {
    return (Array.isArray(tokenUses) ? tokenUses : []).some(
      (t) => typeof t?.dateKey === "string" && t.dateKey === today
    );
  }, [today, tokenUses]);

  const creditedToday = todayMinutes >= MINUTES_REQUIRED || tokenUsedToday;
  const remainingMinutesToday = Math.max(0, MINUTES_REQUIRED - todayMinutes);
  const canApplyToken = !creditedToday;

  const addEntry = () => {
    const dk = String(dateKey || "");
    if (!dk) return;

    const minsRaw = String(minutesText || "").trim();
    const mins = minsRaw ? Math.max(0, Math.floor(Number(minsRaw))) : null;

    const isEditing = typeof editingEntryId === "string" && editingEntryId.length > 0;

    setEntries((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      const nowIso = new Date().toISOString();

      if (isEditing) {
        return list.map((e) => {
          if (e?.id !== editingEntryId) return e;
          return {
            ...e,
            dateKey: dk,
            termNumber: clampTerm(termNumber),
            className: className.trim(),
            minutesSpent: Number.isFinite(mins) ? mins : null,
            text: notes.trim(),
            updatedAt: nowIso,
          };
        });
      }

      return [
        {
          id: `will-school-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          dateKey: dk,
          termNumber: clampTerm(termNumber),
          title: "School Work",
          className: className.trim(),
          minutesSpent: Number.isFinite(mins) ? mins : null,
          text: notes.trim(),
          createdAt: nowIso,
          updatedAt: nowIso,
          lowEnergy: !!lowEnergy,
        },
        ...list,
      ];
    });

    setClassName("");
    setMinutesText("");
    setNotes("");
    setEditingEntryId(null);
    setActiveTab(TAB_HISTORY);
  };

  const beginEdit = (entry) => {
    const id = typeof entry?.id === "string" ? entry.id : "";
    if (!id) return;

    setEditingEntryId(id);
    setDateKey(typeof entry?.dateKey === "string" ? entry.dateKey : todayKey());
    setTermNumber(
      typeof entry?.termNumber === "number" && Number.isFinite(entry.termNumber)
        ? clampTerm(entry.termNumber)
        : getAcademicTermIndex(typeof entry?.dateKey === "string" ? entry.dateKey : todayKey())
    );
    setClassName(typeof entry?.className === "string" ? entry.className : "");
    setMinutesText(
      typeof entry?.minutesSpent === "number" && Number.isFinite(entry.minutesSpent)
        ? String(Math.max(0, Math.floor(entry.minutesSpent)))
        : ""
    );
    setNotes(typeof entry?.text === "string" ? entry.text : "");
    setActiveTab(TAB_INPUT);
  };

  const cancelEdit = () => {
    setEditingEntryId(null);
    setDateKey(todayKey());
    setTermNumber(getAcademicTermIndex(todayKey()));
    setClassName("");
    setMinutesText("");
    setNotes("");
  };

  const deleteEntry = (entryId) => {
    setEntries((prev) => (Array.isArray(prev) ? prev.filter((e) => e?.id !== entryId) : []));
  };

  const onConfirmToken = () => {
    if (!canApplyToken) return;

    const res = spendTokens({
      categoryId: category.id,
      amount: TOKEN_COST_SCHOOL,
      source: "will-school-token",
      meta: { subcategoryId: subcategory.id },
    });

    if (!res?.ok) return;

    const nowIso = new Date().toISOString();
    const dk = today;

    setTokenUses((prev) => [
      {
        id: `willschooltok-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        dateKey: dk,
        createdAt: nowIso,
        lowEnergy: !!lowEnergy,
        isToken: true,
        tokensSpent: TOKEN_COST_SCHOOL,
      },
      ...(Array.isArray(prev) ? prev : []),
    ]);

    setActiveTab(TAB_HISTORY);
  };

  const handleDeleteHistoryEntry = (entry) => {
    if (!entry) return;
    if (entry.isToken) {
      const existing = (Array.isArray(tokenUses) ? tokenUses : []).find((t) => t?.id === entry.id);
      const refund = Math.max(0, Math.floor(Number(existing?.tokensSpent) || TOKEN_COST_SCHOOL));

      setTokenUses((prev) => (Array.isArray(prev) ? prev.filter((t) => t?.id !== entry.id) : prev));

      if (refund > 0) {
        earnTokens({
          categoryId: category.id,
          amount: refund,
          source: "will-school-token-refund",
          meta: {
            subcategoryId: subcategory.id,
            dateKey: entry?.dateKey,
            entryId: entry?.id,
          },
        });
      }
      return;
    }
    deleteEntry(entry.id);
  };

  const historyEntries = useMemo(() => {
    const mappedEntries = (Array.isArray(entries) ? entries : [])
      .filter((e) => typeof e?.dateKey === "string" && e.dateKey)
      .map((e) => {
        const dk = String(e.dateKey || "");
        const mins = typeof e?.minutesSpent === "number" && Number.isFinite(e.minutesSpent) ? Math.max(0, Math.floor(e.minutesSpent)) : null;
        const cls = typeof e?.className === "string" ? e.className.trim() : "";
        const noteText = typeof e?.text === "string" ? e.text.trim() : "";

        const lines = [];
        if (mins !== null) lines.push(`Minutes Studied: ${mins} min`);
        if (noteText) {
          if (lines.length) lines.push("");
          lines.push(noteText);
        }

        return {
          id: String(e?.id || ""),
          dateKey: dk,
          termNumber: typeof e?.termNumber === "number" && Number.isFinite(e.termNumber) ? clampTerm(e.termNumber) : undefined,
          createdAt: e.createdAt,
          updatedAt: e.updatedAt,
          lowEnergy: !!e.lowEnergy,
          timeOfDay: cls || "School Work",
          title: formatEuropeanDate(dk),
          text: lines.join("\n"),
        };
      });

    const mappedTokens = (Array.isArray(tokenUses) ? tokenUses : [])
      .filter((t) => typeof t?.dateKey === "string" && t.dateKey)
      .map((t) => {
        const dk = String(t.dateKey || "");
        return {
          id: String(t?.id || ""),
          dateKey: dk,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          lowEnergy: !!t.lowEnergy,
          isToken: true,
          timeOfDay: "school work",
          title: formatEuropeanDate(dk),
          text: "",
        };
      });

    return [...mappedEntries, ...mappedTokens];
  }, [entries, tokenUses]);

  const tokenModalContent = (
    <div>
      <p className="token-confirm-copy">
        Spend <strong>{TOKEN_COST_SCHOOL}</strong> tokens to cover today’s half-star.
      </p>
      <p className="token-confirm-copy" style={{ marginBottom: 0 }}>
        Today: <strong>{todayMinutes}</strong> / <strong>{MINUTES_REQUIRED}</strong> minutes logged.
      </p>
    </div>
  );

  const subcategoryWithComputedStars = useMemo(
    () => ({ ...subcategory, starHistory: derived.starHistory, currentStars: derived.currentStars }),
    [derived.currentStars, derived.starHistory, subcategory]
  );

  return (
    <SubcategoryShell
      category={category}
      subcategory={subcategoryWithComputedStars}
      onBack={onBack}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      summaryLabel="Half-stars"
      summaryValue={creditedThisMonth}
      lowEnergy={!!lowEnergy}
      onPatchHistoryEntries={setEntries}
      renderTokenControl={() => null}
      tokenControlPlacement="manual"
      availableTokens={availableTokens}
      minTokensToApply={canApplyToken ? TOKEN_COST_SCHOOL : 9999}
      tokenModalContent={tokenModalContent}
      onConfirmToken={onConfirmToken}
      tokensUsed={tokenCreditedThisMonth}
      monthlyFragments={creditedThisMonth}
      yearlyFragments={Math.min(240, creditedThisAcademicYear)}
      monthlyFragmentsMax={daysInMonth}
      yearlyFragmentsMax={240}
      fragmentsLogged={fragmentsLogged}
      entriesLogged={historyEntries.length}
      avgChars={0}
      totalStarsApprox={totalStarsApprox}
      historyEntries={historyEntries}
      onRequestEditEntry={beginEdit}
      onDeleteEntry={handleDeleteHistoryEntry}
      renderInput={({ TokenControl }) => (
        <div className="journal-input">
          <div className="journal-input-box">
            <div className="journal-input-row">
              <div className="journal-field">
                <label className="journal-label">Date</label>
                <input
                  type="date"
                  className="journal-input-text"
                  value={dateKey}
                  onChange={(e) => setDateKey(e.target.value)}
                />
              </div>

              <div className="journal-field">
                <label className="journal-label">Term</label>
                <select
                  className="journal-input-text"
                  value={termNumber}
                  onChange={(e) => setTermNumber(clampTerm(e.target.value))}
                >
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      Term {n}
                    </option>
                  ))}
                </select>
              </div>

              <div className="journal-field">
                <label className="journal-label">Class Name</label>
                <input
                  type="text"
                  className="journal-input-text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="e.g. Biology"
                />
              </div>

              <div className="journal-field">
                <label className="journal-label">Minutes Studied</label>
                <input
                  type="number"
                  className="journal-input-text"
                  value={minutesText}
                  onChange={(e) => setMinutesText(e.target.value)}
                  placeholder="e.g. 45"
                  min="0"
                  step="5"
                  inputMode="numeric"
                />
              </div>
            </div>

            <div className="journal-field" style={{ marginTop: "0.9rem" }}>
              <label className="journal-label">Notes (optional)</label>
              <textarea
                className="journal-textarea"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What did you work on today?"
              />
            </div>

            <div className="journal-actions-row" style={{ marginTop: "0.9rem" }}>
              {typeof editingEntryId === "string" && editingEntryId.length > 0 && (
                <button
                  type="button"
                  className="journal-button-secondary"
                  onClick={cancelEdit}
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                className="journal-button-primary"
                onClick={addEntry}
                disabled={!String(dateKey || "").trim()}
              >
                {typeof editingEntryId === "string" && editingEntryId.length > 0
                  ? "Save Changes"
                  : "Log Schoolwork"}
              </button>
            </div>

            <div className="tracker-sub" style={{ marginTop: "0.9rem" }}>
              Today: {todayMinutes} / {MINUTES_REQUIRED} minutes
              {creditedToday ? " (half-star credited)" : remainingMinutesToday ? ` (${remainingMinutesToday} min to go)` : ""}
            </div>

            <div style={{ marginTop: "0.6rem" }}>{TokenControl && <TokenControl />}</div>
          </div>
        </div>
      )}
      renderHistory={() => (
        <GroupedHistoryTab
          entries={historyEntries}
          onEditEntry={beginEdit}
          onDeleteEntry={handleDeleteHistoryEntry}
          getGroupKey={(entry) => {
            const dk = typeof entry?.dateKey === "string" ? entry.dateKey : "";
            if (!dk) return "";
            const explicit = typeof entry?.termNumber === "number" && Number.isFinite(entry.termNumber) ? clampTerm(entry.termNumber) : null;
            const idx = explicit || getAcademicTermIndex(dk);
            return `term-${idx}`;
          }}
          formatGroupLabel={(k) => {
            const m = String(k || "").match(/term-(\d+)/);
            const idx = m ? Number(m[1]) : 1;
            return `Term ${Number.isFinite(idx) ? idx : 1}`;
          }}
          sortGroupKeys={(a, b) => {
            const ai = Number(String(a || "").replace("term-", "")) || 0;
            const bi = Number(String(b || "").replace("term-", "")) || 0;
            return bi - ai;
          }}
        />
      )}
      renderTracker={() => (
        <div className="journal-tracker">
          <div className="tracker-card">
            <div className="tracker-label">Average Minutes Studied</div>
            <div className="tracker-value">
              {Math.round(academicMinutes.avgPerDay)}
              <span className="tracker-unit"> min/day</span>
            </div>
          </div>
        </div>
      )}
    />
  );
}

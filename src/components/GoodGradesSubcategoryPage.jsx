import React, { useEffect, useMemo, useState } from "react";
import SubcategoryShell, { GroupedHistoryTab, TAB_HISTORY, TAB_INPUT, TAB_TRACKER } from "./SubcategoryShell";

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

function computeAwardFromGpa(gpa) {
  const n = Number(gpa);
  if (!Number.isFinite(n)) return 0;
  if (n >= 4.0) return 10;
  if (n >= 3.5) return 5;
  if (n >= 3.0) return 1;
  return 0;
}

function pointsFromLetterGrade(raw) {
  const s = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");

  const map = {
    A: 4,
    "A-": 3.67,
    "B+": 3.33,
    B: 3,
    "B-": 2.67,
    "C+": 2.33,
    C: 2,
    "C-": 1.67,
    "D+": 1.33,
    D: 1,
    F: 0,
  };

  return Object.prototype.hasOwnProperty.call(map, s) ? map[s] : null;
}

function pointsFromPercentage(raw) {
  const cleaned = String(raw || "")
    .trim()
    .replace(/%/g, "");
  if (!cleaned) return null;

  const pct = Number(cleaned);
  if (!Number.isFinite(pct)) return null;

  const p = Math.max(0, Math.min(100, pct));

  if (p >= 93) return 4;
  if (p >= 90) return 3.67;
  if (p >= 87) return 3.33;
  if (p >= 83) return 3;
  if (p >= 80) return 2.67;
  if (p >= 77) return 2.33;
  if (p >= 73) return 2;
  if (p >= 70) return 1.67;
  if (p >= 67) return 1.33;
  if (p >= 60) return 1;
  return 0;
}

function pointsFromFinalGrade(raw) {
  const letterPts = pointsFromLetterGrade(raw);
  if (letterPts !== null) return letterPts;
  return pointsFromPercentage(raw);
}

function computeGpaFromClassRows(classRows) {
  const rows = normalizeClassRows(classRows);
  const points = rows
    .map((r) => pointsFromFinalGrade(r.finalGrade))
    .filter((n) => typeof n === "number" && Number.isFinite(n));

  if (!points.length) return null;
  return points.reduce((sum, n) => sum + n, 0) / points.length;
}

function normalizeClassRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  return list
    .map((r) => ({
      className: typeof r?.className === "string" ? r.className : "",
      finalGrade: typeof r?.finalGrade === "string" ? r.finalGrade : "",
    }))
    .filter((r) => r.className.trim() || r.finalGrade.trim());
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

function dateKeyToDateLocal(dk) {
  const [yyyy, mm, dd] = String(dk || "").split("-");
  const y = Number(yyyy);
  const m = Number(mm);
  const d = Number(dd);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return new Date(y, m - 1, d);
}

function dateToDateKeyLocal(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getEightWeekTermBoundsStartingJanuary(todayKeyStr) {
  const d = dateKeyToDateLocal(todayKeyStr);
  if (!d) return { startKey: "0000-01-01", endKey: "9999-12-31" };

  const year = d.getFullYear();
  const jan1 = new Date(year, 0, 1);

  const dayMs = 24 * 60 * 60 * 1000;
  const daysSinceJan1 = Math.max(0, Math.floor((d.getTime() - jan1.getTime()) / dayMs));
  const termIndex = Math.floor(daysSinceJan1 / 56);

  const startDate = new Date(jan1.getTime() + termIndex * 56 * dayMs);
  const endDate = new Date(startDate.getTime() + 56 * dayMs);

  return {
    startKey: dateToDateKeyLocal(startDate),
    endKey: dateToDateKeyLocal(endDate),
  };
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

export default function GoodGradesSubcategoryPage({ category, subcategory, onBack }) {
  const [activeTab, setActiveTab] = useState(TAB_INPUT);

  const ENTRY_KEY = `willGradesEntries:${category.id}:${subcategory.id}`;

  const [termEndDateKey, setTermEndDateKey] = useState(todayKey());
  const [termNumber, setTermNumber] = useState(() => getAcademicTermIndex(todayKey()));

  const [classRows, setClassRows] = useState([
    { className: "", finalGrade: "" },
    { className: "", finalGrade: "" },
  ]);

  const [entries, setEntries] = useState(() => safeParseArray(localStorage.getItem(ENTRY_KEY)));

  const [editingEntryId, setEditingEntryId] = useState(null);

  useEffect(() => {
    localStorage.setItem(ENTRY_KEY, JSON.stringify(Array.isArray(entries) ? entries : []));
    emitWillDataChanged(category.id, subcategory.id);
  }, [ENTRY_KEY, category.id, entries, subcategory.id]);

  const totalStarsAwarded = useMemo(() => {
    return entries.reduce((sum, e) => sum + computeAwardFromGpa(e?.gpa), 0);
  }, [entries]);

  const computedGpa = useMemo(() => computeGpaFromClassRows(classRows), [classRows]);
  const validGradeCount = useMemo(() => {
    return normalizeClassRows(classRows).filter((r) => {
      const pts = pointsFromFinalGrade(r.finalGrade);
      return typeof pts === "number" && Number.isFinite(pts);
    }).length;
  }, [classRows]);

  const resetForm = () => {
    setTermEndDateKey(todayKey());
    setTermNumber(getAcademicTermIndex(todayKey()));
    setClassRows([
      { className: "", finalGrade: "" },
      { className: "", finalGrade: "" },
    ]);
  };

  const beginEdit = (historyEntry) => {
    const id = typeof historyEntry?.id === "string" ? historyEntry.id : "";
    if (!id) return;
    const existing = (Array.isArray(entries) ? entries : []).find((e) => e?.id === id);
    if (!existing) return;

    setEditingEntryId(id);
    setTermEndDateKey(String(existing?.dateKey || todayKey()));
    setTermNumber(
      typeof existing?.termNumber === "number" && Number.isFinite(existing.termNumber)
        ? clampTerm(existing.termNumber)
        : getAcademicTermIndex(String(existing?.dateKey || todayKey()))
    );

    const rows = normalizeClassRows(existing?.classRows);
    const base = rows.length ? rows : [{ className: "", finalGrade: "" }, { className: "", finalGrade: "" }];
    setClassRows(base.length >= 2 ? base : [...base, { className: "", finalGrade: "" }]);

    setActiveTab(TAB_INPUT);
  };

  const cancelEdit = () => {
    setEditingEntryId(null);
    resetForm();
    setActiveTab(TAB_HISTORY);
  };

  const addEntry = () => {
    const dk = String(termEndDateKey || "");
    if (!dk) return;
    if (computedGpa === null) return;

    const gpa = computedGpa;
    const starsAwarded = computeAwardFromGpa(gpa);

    const nowIso = new Date().toISOString();
    const classes = normalizeClassRows(classRows);

    const isEditing = typeof editingEntryId === "string" && editingEntryId.length > 0;
    if (isEditing) {
      setEntries((prev) =>
        (Array.isArray(prev) ? prev : []).map((e) =>
          e?.id === editingEntryId
            ? {
                ...e,
                dateKey: dk,
                termNumber: clampTerm(termNumber),
                gpa,
                starsAwarded,
                classRows: classes,
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

    setEntries((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      return [
        {
          id: `will-grades-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          dateKey: dk,
          termNumber: clampTerm(termNumber),
          title: "Good Grades",
          gpa,
          starsAwarded,
          classRows: classes,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        ...list,
      ];
    });

    resetForm();
    setActiveTab(TAB_HISTORY);
  };

  const deleteEntry = (entryId) => {
    setEntries((prev) => (Array.isArray(prev) ? prev.filter((e) => e?.id !== entryId) : []));
  };

  const sortedEntries = useMemo(() => {
    const list = Array.isArray(entries) ? entries : [];
    return list
      .slice()
      .sort((a, b) => {
        const aKey = String(a?.dateKey || "");
        const bKey = String(b?.dateKey || "");
        if (aKey !== bKey) return bKey.localeCompare(aKey);
        const aT = String(a?.createdAt || "");
        const bT = String(b?.createdAt || "");
        if (aT !== bT) return bT.localeCompare(aT);
        return String(b?.id || "").localeCompare(String(a?.id || ""));
      });
  }, [entries]);

  const historyEntries = useMemo(() => {
    return (Array.isArray(sortedEntries) ? sortedEntries : [])
      .filter((e) => typeof e?.dateKey === "string" && e.dateKey)
      .map((e) => {
        const dk = String(e.dateKey || "");
        const gpa = Number(e?.gpa);
        const classes = normalizeClassRows(e?.classRows);

        const lines = [];
        if (Number.isFinite(gpa)) lines.push(`GPA: ${gpa.toFixed(2)}`);
        if (classes.length) {
          if (lines.length) lines.push("");
          lines.push("Classes:");
          classes.forEach((r) => {
            const c = String(r.className || "").trim() || "(Class)";
            const fg = String(r.finalGrade || "").trim();
            lines.push(`• ${c}${fg ? ` — ${fg}` : ""}`);
          });
        }

        return {
          id: String(e?.id || ""),
          dateKey: dk,
          termNumber: typeof e?.termNumber === "number" && Number.isFinite(e.termNumber) ? clampTerm(e.termNumber) : undefined,
          createdAt: e.createdAt,
          updatedAt: e.updatedAt,
          timeOfDay: "good grades",
          title: formatEuropeanDate(dk),
          text: lines.join("\n"),
        };
      });
  }, [sortedEntries]);

  const today = useMemo(() => todayKey(), []);
  const academicYear = useMemo(() => getAcademicYearBounds(today), [today]);
  const currentTerm = useMemo(() => getEightWeekTermBoundsStartingJanuary(today), [today]);

  const yearlyStars = useMemo(() => {
    const sum = (Array.isArray(entries) ? entries : []).reduce((acc, e) => {
      const dk = typeof e?.dateKey === "string" ? e.dateKey : "";
      if (!dk) return acc;
      if (dk < academicYear.startKey || dk >= academicYear.endKey) return acc;
      const gpa = Number(e?.gpa);
      const stars = Number.isFinite(Number(e?.starsAwarded)) ? Number(e.starsAwarded) : computeAwardFromGpa(gpa);
      return acc + (Number.isFinite(stars) ? stars : 0);
    }, 0);
    return Math.min(60, Math.max(0, Math.trunc(sum)));
  }, [academicYear.endKey, academicYear.startKey, entries]);

  const avgGpa = useMemo(() => {
    const list = (Array.isArray(entries) ? entries : []).filter((e) => {
      const dk = typeof e?.dateKey === "string" ? e.dateKey : "";
      if (!dk) return false;
      return dk >= academicYear.startKey && dk < academicYear.endKey;
    });

    const vals = list
      .map((e) => Number(e?.gpa))
      .filter((n) => Number.isFinite(n));

    if (!vals.length) return 0;
    return vals.reduce((sum, n) => sum + n, 0) / vals.length;
  }, [academicYear.endKey, academicYear.startKey, entries]);

  const latestEntry = sortedEntries[0] || null;
  const termStars = useMemo(() => {
    const sum = (Array.isArray(entries) ? entries : []).reduce((acc, e) => {
      const dk = typeof e?.dateKey === "string" ? e.dateKey : "";
      if (!dk) return acc;
      if (dk < currentTerm.startKey || dk >= currentTerm.endKey) return acc;
      const gpa = Number(e?.gpa);
      const stars = Number.isFinite(Number(e?.starsAwarded)) ? Number(e.starsAwarded) : computeAwardFromGpa(gpa);
      return acc + (Number.isFinite(stars) ? stars : 0);
    }, 0);
    return Math.min(10, Math.max(0, Math.trunc(sum)));
  }, [currentTerm.endKey, currentTerm.startKey, entries]);

  const latestGrades = useMemo(() => {
    if (!latestEntry) return [];
    return normalizeClassRows(latestEntry?.classRows);
  }, [latestEntry]);

  return (
    <SubcategoryShell
      category={category}
      subcategory={subcategory}
      onBack={onBack}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      summaryLabel="Stars"
      summaryValue={totalStarsAwarded}
      entriesLogged={sortedEntries.length}
      historyEntries={historyEntries}
      onRequestEditEntry={beginEdit}
      onDeleteEntry={(entry) => deleteEntry(entry?.id)}
      hideDefaultTracker={true}
      renderInput={() => (
        <div className="journal-input">
          <div className="journal-input-box">
            <div className="journal-input-row">
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
                <label className="journal-label">Term end date</label>
                <input
                  type="date"
                  className="journal-input-text"
                  value={termEndDateKey}
                  onChange={(e) => setTermEndDateKey(e.target.value)}
                />
              </div>
            </div>

            <div className="tracker-section" style={{ marginTop: "0.9rem" }}>
              <div className="tracker-label">Classwork</div>
              <div className="tracker-sub" style={{ marginTop: "0.25rem" }}>
                Class Name | Final Grade
              </div>

              <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.6rem" }}>
                {classRows.map((row, idx) => (
                  <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                    <input
                      className="journal-input-text"
                      value={row.className}
                      onChange={(e) =>
                        setClassRows((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, className: e.target.value } : r))
                        )
                      }
                      placeholder="Biology"
                    />
                    <input
                      className="journal-input-text"
                      value={row.finalGrade}
                      onChange={(e) =>
                        setClassRows((prev) =>
                          prev.map((r, i) => (i === idx ? { ...r, finalGrade: e.target.value } : r))
                        )
                      }
                      placeholder="A or 93%"
                    />
                  </div>
                ))}

                <button
                  type="button"
                  className="journal-button-secondary"
                  onClick={() => setClassRows((prev) => [...prev, { className: "", finalGrade: "" }])}
                >
                  +
                </button>
              </div>
            </div>

            <div className="journal-actions-row" style={{ marginTop: "0.9rem" }}>
              <button
                type="button"
                className="journal-button-primary"
                onClick={addEntry}
                disabled={!String(termEndDateKey || "").trim() || validGradeCount === 0 || computedGpa === null}
              >
                {typeof editingEntryId === "string" && editingEntryId.length > 0 ? "Save Changes" : "Log term result"}
              </button>
              {typeof editingEntryId === "string" && editingEntryId.length > 0 && (
                <button type="button" className="journal-button-secondary" onClick={cancelEdit}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      renderHistory={() => (
        <GroupedHistoryTab
          entries={historyEntries}
          onEditEntry={beginEdit}
          onDeleteEntry={(entry) => deleteEntry(entry?.id)}
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
          <div className="tracker-grid" style={{ marginBottom: "1rem" }}>
            <div className="tracker-card">
              <div className="tracker-label">Term Stars</div>
              <div className="tracker-value">
                {termStars} / 10
              </div>
            </div>

            <div className="tracker-card">
              <div className="tracker-label">Yearly Stars</div>
              <div className="tracker-value">
                {yearlyStars} / 60
              </div>
            </div>
          </div>

          <div className="tracker-card" style={{ marginBottom: "1rem" }}>
            <div className="tracker-label">Average GPA</div>
            <div className="tracker-value">{avgGpa ? avgGpa.toFixed(2) : "0.00"}</div>
          </div>

          <div className="tracker-section">
            <div className="tracker-label">Grade Tracker</div>
            {!latestGrades.length ? (
              <div className="tracker-sub" style={{ marginTop: "0.5rem" }}>
                No class grades logged yet.
              </div>
            ) : (
              <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.45rem" }}>
                {latestGrades.map((r, idx) => (
                  <div key={`gg-grade-${idx}`} style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
                    <span>{String(r.className || "").trim() || "(Class)"}</span>
                    <span>{String(r.finalGrade || "").trim() || ""}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    />
  );
}

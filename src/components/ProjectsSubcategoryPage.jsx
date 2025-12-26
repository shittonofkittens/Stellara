import React, { useEffect, useMemo, useState } from "react";
import SubcategoryShell, { TAB_HISTORY, TAB_INPUT, TAB_TRACKER } from "./SubcategoryShell";
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

function normalizeProjectLabel(label) {
  const raw = typeof label === "string" ? label.trim() : "";
  if (!raw) return "";
  return raw.replace(/\s+/g, " ");
}

function buildProjectsFragmentsHistory({ entries, tokenUses, minutesRequired }) {
  const minsReq = clampInt(minutesRequired, 1, 1000);

  const minutesByDay = new Map();
  (Array.isArray(entries) ? entries : []).forEach((e) => {
    const dk = typeof e?.dateKey === "string" ? e.dateKey : "";
    if (!dk) return;
    const mins = typeof e?.minutesWorked === "number" && Number.isFinite(e.minutesWorked) ? e.minutesWorked : 0;
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

  const fragmentColors = creditedDays.map((d) => (d.usedToken ? "silver" : "gold"));

  const starHistory = [];
  let currentFragments = [];
  for (const c of fragmentColors) {
    currentFragments.push(c);
    if (currentFragments.length === 5) {
      starHistory.push({ fragments: [...currentFragments] });
      currentFragments = [];
    }
  }
  if (currentFragments.length) starHistory.push({ fragments: [...currentFragments] });

  return {
    starHistory,
    currentStars: fragmentColors.length / 5,
    creditedByDay,
    creditedDays,
    fragmentsEarned: creditedDays.length,
  };
}

export default function ProjectsSubcategoryPage({ category, subcategory, onBack, lowEnergy }) {
  const [activeTab, setActiveTab] = useState(TAB_INPUT);

  const ENTRY_KEY = `willProjectsEntries:${category.id}:${subcategory.id}`;
  const TOKEN_KEY = `willProjectsTokens:${category.id}:${subcategory.id}`;
  const PROJECT_OPTIONS_KEY = `willProjectsProjectOptions:${category.id}:${subcategory.id}`;

  const TOKEN_COST_PROJECTS = 3;
  const MINUTES_REQUIRED = 30;

  const BASE_PROJECTS = [
    "Shadow and Song",
    "EmberLink",
    "THRESHOLD",
    "Lorebound",
    "Sanctuary",
  ];
  const OTHER_VALUE = "__other__";

  const availableTokens = useCategoryTokenBalance(category.id);

  const [dateKey, setDateKey] = useState(todayKey());
  const [selectedProject, setSelectedProject] = useState(BASE_PROJECTS[0]);
  const [otherProjectName, setOtherProjectName] = useState("");
  const [minutesText, setMinutesText] = useState("");
  const [notes, setNotes] = useState("");

  const [editingEntryId, setEditingEntryId] = useState(null);

  const [customProjects, setCustomProjects] = useState(() => {
    const raw = localStorage.getItem(PROJECT_OPTIONS_KEY);
    const parsed = safeParseArray(raw);
    return parsed
      .map((s) => normalizeProjectLabel(String(s || "")))
      .filter(Boolean);
  });

  const [entries, setEntries] = useState(() => safeParseArray(localStorage.getItem(ENTRY_KEY)));
  const [tokenUses, setTokenUses] = useState(() => safeParseArray(localStorage.getItem(TOKEN_KEY)));

  useEffect(() => {
    localStorage.setItem(PROJECT_OPTIONS_KEY, JSON.stringify(Array.isArray(customProjects) ? customProjects : []));
  }, [PROJECT_OPTIONS_KEY, customProjects]);

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

  const projectOptions = useMemo(() => {
    const dedup = new Map();
    const push = (label) => {
      const v = normalizeProjectLabel(label);
      if (!v) return;
      const key = v.toLowerCase();
      if (dedup.has(key)) return;
      dedup.set(key, v);
    };

    BASE_PROJECTS.forEach(push);
    (Array.isArray(customProjects) ? customProjects : []).forEach(push);
    return [...dedup.values()];
  }, [customProjects]);

  const derived = useMemo(
    () => buildProjectsFragmentsHistory({ entries, tokenUses, minutesRequired: MINUTES_REQUIRED }),
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
      const mins = typeof e?.minutesWorked === "number" && Number.isFinite(e.minutesWorked) ? e.minutesWorked : 0;
      const used = minutesByDay.get(dk) || 0;
      minutesByDay.set(dk, used + Math.max(0, Math.trunc(mins)));
    });

    const totals = [...minutesByDay.values()].filter((n) => n > 0);
    const totalMinutes = totals.reduce((sum, n) => sum + n, 0);
    const workDays = totals.length;
    const avgPerDay = workDays > 0 ? totalMinutes / workDays : 0;
    return { totalMinutes, workDays, avgPerDay };
  }, [academicYear.endKey, academicYear.startKey, entries]);

  const projectMinutesBreakdown = useMemo(() => {
    const totals = new Map();
    let totalMinutes = 0;

    (Array.isArray(entries) ? entries : []).forEach((e) => {
      const project = typeof e?.project === "string" ? e.project.trim() : "";
      if (!project) return;
      const mins = typeof e?.minutesWorked === "number" && Number.isFinite(e.minutesWorked) ? Math.max(0, Math.floor(e.minutesWorked)) : 0;
      if (mins <= 0) return;
      totalMinutes += mins;
      totals.set(project, (totals.get(project) || 0) + mins);
    });

    const rows = [...totals.entries()]
      .map(([project, minutes]) => {
        const pct = totalMinutes > 0 ? Math.round((minutes / totalMinutes) * 100) : 0;
        return { project, minutes, pct };
      })
      .sort((a, b) => {
        if (b.minutes !== a.minutes) return b.minutes - a.minutes;
        return a.project.localeCompare(b.project);
      });

    return { totalMinutes, rows };
  }, [entries]);

  const fragmentsLogged = derived.fragmentsEarned;
  const totalStarsApprox = derived.currentStars;

  const todayMinutes = useMemo(() => {
    return (Array.isArray(entries) ? entries : [])
      .filter((e) => typeof e?.dateKey === "string" && e.dateKey === today)
      .reduce((sum, e) => {
        const mins = typeof e?.minutesWorked === "number" && Number.isFinite(e.minutesWorked) ? e.minutesWorked : 0;
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

  const ensureCustomProjectOption = (label) => {
    const normalized = normalizeProjectLabel(label);
    if (!normalized) return "";
    const lower = normalized.toLowerCase();
    const existsInBase = BASE_PROJECTS.some((p) => p.toLowerCase() === lower);
    const existsInCustom = (Array.isArray(customProjects) ? customProjects : []).some((p) => String(p).toLowerCase() === lower);
    if (!existsInBase && !existsInCustom) {
      setCustomProjects((prev) => {
        const list = Array.isArray(prev) ? prev : [];
        return [...list, normalized].sort((a, b) => a.localeCompare(b));
      });
    }
    return normalized;
  };

  const addEntry = () => {
    const dk = String(dateKey || "");
    if (!dk) return;

    const minsRaw = String(minutesText || "").trim();
    const mins = minsRaw ? Math.max(0, Math.floor(Number(minsRaw))) : null;

    const isEditing = typeof editingEntryId === "string" && editingEntryId.length > 0;

    const chosenProject = selectedProject === OTHER_VALUE
      ? ensureCustomProjectOption(otherProjectName)
      : normalizeProjectLabel(selectedProject);

    if (selectedProject === OTHER_VALUE && !chosenProject) return;

    setEntries((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      const nowIso = new Date().toISOString();

      if (isEditing) {
        return list.map((e) => {
          if (e?.id !== editingEntryId) return e;
          return {
            ...e,
            dateKey: dk,
            project: chosenProject,
            minutesWorked: Number.isFinite(mins) ? mins : null,
            text: notes.trim(),
            updatedAt: nowIso,
          };
        });
      }

      return [
        {
          id: `will-projects-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          dateKey: dk,
          title: "Projects",
          project: chosenProject,
          minutesWorked: Number.isFinite(mins) ? mins : null,
          text: notes.trim(),
          createdAt: nowIso,
          updatedAt: nowIso,
          lowEnergy: !!lowEnergy,
        },
        ...list,
      ];
    });

    setMinutesText("");
    setNotes("");
    setEditingEntryId(null);
    setOtherProjectName("");
    setSelectedProject(projectOptions[0] || BASE_PROJECTS[0]);
    setActiveTab(TAB_HISTORY);
  };

  const beginEdit = (entry) => {
    const id = typeof entry?.id === "string" ? entry.id : "";
    if (!id) return;

    const p = normalizeProjectLabel(typeof entry?.project === "string" ? entry.project : "");
    if (p) ensureCustomProjectOption(p);

    setEditingEntryId(id);
    setDateKey(typeof entry?.dateKey === "string" ? entry.dateKey : todayKey());
    setSelectedProject(p || (projectOptions[0] || BASE_PROJECTS[0]));
    setOtherProjectName("");
    setMinutesText(
      typeof entry?.minutesWorked === "number" && Number.isFinite(entry.minutesWorked)
        ? String(Math.max(0, Math.floor(entry.minutesWorked)))
        : ""
    );
    setNotes(typeof entry?.text === "string" ? entry.text : "");
    setActiveTab(TAB_INPUT);
  };

  const cancelEdit = () => {
    setEditingEntryId(null);
    setDateKey(todayKey());
    setSelectedProject(projectOptions[0] || BASE_PROJECTS[0]);
    setOtherProjectName("");
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
      amount: TOKEN_COST_PROJECTS,
      source: "will-projects-token",
      meta: { subcategoryId: subcategory.id },
    });

    if (!res?.ok) return;

    const nowIso = new Date().toISOString();
    const dk = today;

    setTokenUses((prev) => [
      {
        id: `willprojectstok-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        dateKey: dk,
        createdAt: nowIso,
        lowEnergy: !!lowEnergy,
        isToken: true,
        tokensSpent: TOKEN_COST_PROJECTS,
      },
      ...(Array.isArray(prev) ? prev : []),
    ]);

    setActiveTab(TAB_HISTORY);
  };

  const handleDeleteHistoryEntry = (entry) => {
    if (!entry) return;
    if (entry.isToken) {
      const existing = (Array.isArray(tokenUses) ? tokenUses : []).find((t) => t?.id === entry.id);
      const refund = Math.max(0, Math.floor(Number(existing?.tokensSpent) || TOKEN_COST_PROJECTS));

      setTokenUses((prev) => (Array.isArray(prev) ? prev.filter((t) => t?.id !== entry.id) : prev));

      if (refund > 0) {
        earnTokens({
          categoryId: category.id,
          amount: refund,
          source: "will-projects-token-refund",
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
        const mins = typeof e?.minutesWorked === "number" && Number.isFinite(e.minutesWorked) ? Math.max(0, Math.floor(e.minutesWorked)) : null;
        const project = typeof e?.project === "string" ? e.project.trim() : "";
        const noteText = typeof e?.text === "string" ? e.text.trim() : "";

        const lines = [];
        if (mins !== null) lines.push(`Minutes Worked: ${mins} min`);
        if (noteText) {
          if (lines.length) lines.push("");
          lines.push(noteText);
        }

        return {
          id: String(e?.id || ""),
          dateKey: dk,
          createdAt: e.createdAt,
          updatedAt: e.updatedAt,
          lowEnergy: !!e.lowEnergy,
          timeOfDay: project || "Projects",
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
          timeOfDay: "projects",
          title: formatEuropeanDate(dk),
          text: "",
        };
      });

    return [...mappedEntries, ...mappedTokens];
  }, [entries, tokenUses]);

  const tokenModalContent = (
    <div>
      <p className="token-confirm-copy">
        Spend <strong>{TOKEN_COST_PROJECTS}</strong> tokens to cover today’s +1/5.
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
      summaryLabel="Fragments"
      summaryValue={creditedThisMonth}
      lowEnergy={!!lowEnergy}
      onPatchHistoryEntries={setEntries}
      renderTokenControl={() => null}
      tokenControlPlacement="manual"
      availableTokens={availableTokens}
      minTokensToApply={canApplyToken ? TOKEN_COST_PROJECTS : 9999}
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
                <label className="journal-label">Project</label>
                <select
                  className="journal-input-text"
                  value={selectedProject}
                  onChange={(e) => {
                    const next = e.target.value;
                    setSelectedProject(next);
                    if (next !== OTHER_VALUE) setOtherProjectName("");
                  }}
                >
                  {projectOptions.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                  <option value={OTHER_VALUE}>Other</option>
                </select>
              </div>

              <div className="journal-field">
                <label className="journal-label">Minutes Worked</label>
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

            {selectedProject === OTHER_VALUE && (
              <div className="journal-field" style={{ marginTop: "0.9rem" }}>
                <label className="journal-label">Project Name</label>
                <input
                  type="text"
                  className="journal-input-text"
                  value={otherProjectName}
                  onChange={(e) => setOtherProjectName(e.target.value)}
                  placeholder="e.g. My New Project"
                />
              </div>
            )}

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
                disabled={!String(dateKey || "").trim() || (selectedProject === OTHER_VALUE && !normalizeProjectLabel(otherProjectName))}
              >
                {typeof editingEntryId === "string" && editingEntryId.length > 0
                  ? "Save Changes"
                  : "Log Project Work"}
              </button>
            </div>

            <div className="tracker-sub" style={{ marginTop: "0.9rem" }}>
              Today: {todayMinutes} / {MINUTES_REQUIRED} minutes
              {creditedToday ? " (+1/5 credited)" : remainingMinutesToday ? ` (${remainingMinutesToday} min to go)` : ""}
            </div>

            <div style={{ marginTop: "0.6rem" }}>{TokenControl && <TokenControl />}</div>
          </div>
        </div>
      )}
      renderTracker={() => (
        <div className="journal-tracker">
          <div className="tracker-card">
            <div className="tracker-label">Average Minutes Worked</div>
            <div className="tracker-value">
              {Math.round(academicMinutes.avgPerDay)}
              <span className="tracker-unit"> min/day</span>
            </div>
          </div>

          <div className="tracker-section" style={{ marginTop: "1rem" }}>
            <div className="tracker-label">Projects</div>

            {!projectMinutesBreakdown.rows.length ? (
              <div className="tracker-sub" style={{ marginTop: "0.5rem" }}>
                No project minutes logged yet.
              </div>
            ) : (
              projectMinutesBreakdown.rows.map((row) => (
                <div key={row.project} className="tracker-bar-row">
                  <span className="tracker-bar-label">{row.project}</span>
                  <div className="tracker-bar-track">
                    <div className="tracker-bar-fill" style={{ width: `${row.pct}%` }} />
                  </div>
                  <span className="tracker-bar-value">
                    {row.minutes} ({row.pct}%)
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    />
  );
}

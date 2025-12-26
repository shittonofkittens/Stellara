import React, { useEffect, useMemo, useState } from "react";
import SubcategoryShell, { TAB_HISTORY, TAB_INPUT } from "./SubcategoryShell";
import { earnTokens, spendTokens } from "../utils/tokens";
import { useCategoryTokenBalance } from "./Tokens";
import {
  HYGIENE_TASKS,
  HYGIENE_TASK_IDS,
  buildHygieneStarHistory,
  computeStarsFromFragmentsHistory,
} from "../utils/hygiene";

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

function daysInMonth(year, monthIndex0) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

function isLeapYear(y) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

function emitHygieneDataChanged(categoryId, subcategoryId) {
  window.dispatchEvent(
    new CustomEvent("hygiene-data-changed", {
      detail: { categoryId, subcategoryId },
    })
  );
}

function normalizeSelectedTasks(taskIds) {
  const ids = Array.isArray(taskIds) ? taskIds : [];
  const set = new Set();
  const out = [];
  for (const id of ids) {
    const s = String(id || "");
    if (!s) continue;
    if (!HYGIENE_TASK_IDS.includes(s)) continue;
    if (set.has(s)) continue;
    set.add(s);
    out.push(s);
  }
  return out;
}

function taskLabel(taskId) {
  const t = HYGIENE_TASKS.find((x) => x.id === taskId);
  return t ? t.label : String(taskId || "");
}

function idKey(v) {
  const s = String(v ?? "").trim();
  return s ? s : "";
}

export default function HygieneSubcategoryPage({ category, subcategory, onBack, lowEnergy }) {
  const [activeTab, setActiveTab] = useState(TAB_INPUT);

  const ENTRY_KEY = `hygieneEntries:${category.id}:${subcategory.id}`;
  const TOKEN_KEY = `hygieneTokens:${category.id}:${subcategory.id}`;

  const TASKS_PER_FRAGMENT = 2;
  const TOKEN_COST_HYGIENE = 1;

  const availableTokens = useCategoryTokenBalance(category.id);

  const [entries, setEntries] = useState(() => safeParseArray(localStorage.getItem(ENTRY_KEY)));
  const [tokenUses, setTokenUses] = useState(() => safeParseArray(localStorage.getItem(TOKEN_KEY)));

  const [selectedTasks, setSelectedTasks] = useState([]);
  const [notes, setNotes] = useState("");

  const [editingEntryId, setEditingEntryId] = useState(null);

  useEffect(() => {
    localStorage.setItem(ENTRY_KEY, JSON.stringify(Array.isArray(entries) ? entries : []));
    emitHygieneDataChanged(category.id, subcategory.id);
  }, [ENTRY_KEY, category.id, entries, subcategory.id]);

  useEffect(() => {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(Array.isArray(tokenUses) ? tokenUses : []));
    emitHygieneDataChanged(category.id, subcategory.id);
  }, [TOKEN_KEY, category.id, subcategory.id, tokenUses]);

  const derived = useMemo(
    () => buildHygieneStarHistory({ entries, tokenUses, tasksPerDay: TASKS_PER_FRAGMENT }),
    [entries, tokenUses]
  );

  const starHistory = derived.starHistory;
  const currentStars = useMemo(() => computeStarsFromFragmentsHistory(starHistory), [starHistory]);

  const today = todayKey();
  const creditedToday = derived.creditedByDay?.has(today) || false;

  const monthKey = useMemo(() => today.slice(0, 7), [today]);
  const yearKey = useMemo(() => today.slice(0, 4), [today]);

  const monthlyFragmentsMax = useMemo(() => {
    const [yyyy, mm] = String(monthKey).split("-");
    const y = Number(yyyy);
    const m = Number(mm);
    if (!Number.isFinite(y) || !Number.isFinite(m)) return 0;
    return daysInMonth(y, m - 1);
  }, [monthKey]);

  const yearlyFragmentsMax = useMemo(() => {
    const y = Number(yearKey);
    if (!Number.isFinite(y)) return 0;
    return isLeapYear(y) ? 366 : 365;
  }, [yearKey]);

  const monthly = useMemo(() => {
    let credited = 0;
    let tokenCredited = 0;
    for (const [dk, info] of derived.creditedByDay || []) {
      if (!String(dk).startsWith(monthKey)) continue;
      credited += 1;
      if (info?.usedToken) tokenCredited += 1;
    }
    return { credited, tokenCredited };
  }, [derived.creditedByDay, monthKey]);

  const yearly = useMemo(() => {
    let credited = 0;
    let tokenCredited = 0;
    for (const [dk, info] of derived.creditedByDay || []) {
      if (!String(dk).startsWith(yearKey)) continue;
      credited += 1;
      if (info?.usedToken) tokenCredited += 1;
    }
    return { credited, tokenCredited };
  }, [derived.creditedByDay, yearKey]);

  const tokenAlreadyToday = useMemo(
    () => (Array.isArray(tokenUses) ? tokenUses : []).some((t) => t?.dateKey === today),
    [today, tokenUses]
  );

  const canApplyToken = !creditedToday && !tokenAlreadyToday;

  const tokenModalContent = (
    <p className="token-confirm-copy">
      Spend {TOKEN_COST_HYGIENE} token to add a 1/5 silver star for today.
    </p>
  );

  const resetForm = () => {
    setSelectedTasks([]);
    setNotes("");
  };

  const beginEdit = (entry) => {
    const id = idKey(entry?.id);
    if (!id) return;
    const existing = (Array.isArray(entries) ? entries : []).find((e) => idKey(e?.id) === id);
    if (!existing) return;
    setEditingEntryId(id);
    setSelectedTasks(normalizeSelectedTasks(existing?.tasks));
    setNotes(String(existing?.notes || ""));
    setActiveTab(TAB_INPUT);
  };

  const handleLog = () => {
    const tasks = normalizeSelectedTasks(selectedTasks);
    const trimmedNotes = String(notes || "").trim();
    if (tasks.length === 0 && !trimmedNotes) return;

    const nowIso = new Date().toISOString();
    const dk = todayKey();

    const isEditing = typeof editingEntryId === "string" && editingEntryId.length > 0;
    if (isEditing) {
      setEntries((prev) =>
        (Array.isArray(prev) ? prev : []).map((e) =>
          idKey(e?.id) === editingEntryId
            ? {
                ...e,
                updatedAt: nowIso,
                tasks,
                notes: trimmedNotes,
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
        id: `hyg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        dateKey: dk,
        createdAt: nowIso,
        lowEnergy: !!lowEnergy,
        tasks,
        notes: trimmedNotes,
      },
      ...(Array.isArray(prev) ? prev : []),
    ]);

    resetForm();
  };

  const onConfirmToken = () => {
    if (!canApplyToken) return;

    const res = spendTokens({
      categoryId: category.id,
      amount: TOKEN_COST_HYGIENE,
      source: "hygiene-token",
      meta: { subcategoryId: subcategory.id },
    });

    if (!res?.ok) return;

    const nowIso = new Date().toISOString();
    const dk = todayKey();

    setTokenUses((prev) => [
      {
        id: `hygtok-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        dateKey: dk,
        createdAt: nowIso,
        lowEnergy: !!lowEnergy,
        isToken: true,
        tokensSpent: TOKEN_COST_HYGIENE,
      },
      ...(Array.isArray(prev) ? prev : []),
    ]);
  };

  const handleDeleteHistoryEntry = (entry) => {
    if (!entry) return;

    const entryId = idKey(entry?.id);
    if (!entryId) return;

    if (entry.isToken) {
      const existing = (Array.isArray(tokenUses) ? tokenUses : []).find((t) => idKey(t?.id) === entryId);
      const refund = Math.max(0, Math.floor(Number(existing?.tokensSpent) || TOKEN_COST_HYGIENE));

      setTokenUses((prev) => (Array.isArray(prev) ? prev.filter((t) => idKey(t?.id) !== entryId) : prev));

      if (refund > 0) {
        earnTokens({
          categoryId: category.id,
          amount: refund,
          source: "hygiene-token-refund",
          meta: { subcategoryId: subcategory.id, dateKey: entry?.dateKey, entryId },
        });
      }
      return;
    }

    setEntries((prev) => (Array.isArray(prev) ? prev.filter((e) => idKey(e?.id) !== entryId) : prev));
  };

  const historyEntries = useMemo(() => {
    const mappedEntries = (Array.isArray(entries) ? entries : []).map((e) => {
      const dk = typeof e?.dateKey === "string" ? e.dateKey : "";
      const title = formatEuropeanDate(dk);

      const tasks = Array.isArray(e?.tasks) ? e.tasks : [];
      const taskLines = tasks.map((t) => `• ${taskLabel(t)}`);

      const lines = [];
      if (taskLines.length) {
        lines.push("Tasks:");
        lines.push(taskLines.join("\n"));
      }
      if (e?.notes) {
        lines.push("");
        lines.push(`Notes: ${String(e.notes).trim()}`);
      }

      return {
        id: idKey(e?.id),
        dateKey: dk,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
        lowEnergy: !!e.lowEnergy,
        timeOfDay: "hygiene",
        title,
        text: lines.join("\n"),
      };
    });

    const mappedTokens = (Array.isArray(tokenUses) ? tokenUses : []).map((t) => {
      const dk = typeof t?.dateKey === "string" ? t.dateKey : "";
      const title = formatEuropeanDate(dk);
      return {
        id: idKey(t?.id),
        dateKey: dk,
        createdAt: t.createdAt,
        lowEnergy: !!t.lowEnergy,
        isToken: true,
        timeOfDay: "hygiene",
        title,
      };
    });

    return [...mappedEntries, ...mappedTokens].filter((e) => e?.dateKey);
  }, [entries, tokenUses]);

  const trackerStats = useMemo(() => {
    const list = Array.isArray(entries) ? entries : [];

    const counts = HYGIENE_TASK_IDS.reduce((acc, id) => {
      acc[id] = 0;
      return acc;
    }, {});

    let total = 0;

    for (const e of list) {
      const tasks = normalizeSelectedTasks(e?.tasks);
      for (const t of tasks) {
        counts[t] += 1;
        total += 1;
      }
    }

    const pct = HYGIENE_TASK_IDS.reduce((acc, id) => {
      acc[id] = total > 0 ? Math.round((counts[id] / total) * 100) : 0;
      return acc;
    }, {});

    return { counts, pct, total };
  }, [entries]);

  const renderInput = ({ TokenControl } = {}) => (
    <>
      <div className="tracker-section">
        <div className="tracker-label">Self care tasks</div>
        <div className="journal-input-row" style={{ marginTop: "0.6rem" }}>
          {HYGIENE_TASKS.map((opt) => {
            const pressed = selectedTasks.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                className="journal-button-secondary"
                aria-pressed={pressed}
                onClick={() => {
                  setSelectedTasks((prev) => {
                    const arr = Array.isArray(prev) ? prev : [];
                    if (arr.includes(opt.id)) return arr.filter((x) => x !== opt.id);
                    return [...arr, opt.id];
                  });
                }}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
        <div className="tracker-sub" style={{ marginTop: "0.6rem" }}>
          Earn 1/5 of a star for each day you do {TASKS_PER_FRAGMENT} tasks.
        </div>
      </div>

      <div className="journal-field" style={{ marginTop: "0.9rem" }}>
        <label className="journal-label">Notes (optional)</label>
        <textarea
          className="journal-textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes"
        />
      </div>

      <div className="journal-actions-row" style={{ marginTop: "0.9rem" }}>
        <button type="button" className="journal-button-primary" onClick={handleLog}>
          {typeof editingEntryId === "string" && editingEntryId.length > 0 ? "Save Changes" : "Log Hygiene"}
        </button>
        {typeof editingEntryId === "string" && editingEntryId.length > 0 && (
          <button
            type="button"
            className="journal-button-secondary"
            onClick={() => {
              setEditingEntryId(null);
              resetForm();
              setActiveTab(TAB_HISTORY);
            }}
          >
            Cancel
          </button>
        )}
      </div>

      <div style={{ marginTop: "0.6rem" }}>{TokenControl && <TokenControl />}</div>

      {creditedToday && (
        <div className="tracker-sub" style={{ marginTop: "0.9rem" }}>
          You can keep logging tasks; stars are capped at 1/5 per day.
        </div>
      )}
    </>
  );

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
      renderTokenControl={() => null}
      tokenControlPlacement="manual"
      availableTokens={availableTokens}
      minTokensToApply={canApplyToken ? TOKEN_COST_HYGIENE : 9999}
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
            <div className="tracker-label">Tasks</div>

            {HYGIENE_TASKS.map((row) => (
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
    />
  );
}

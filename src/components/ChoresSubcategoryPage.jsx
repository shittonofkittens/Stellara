import React, { useEffect, useMemo, useState } from "react";
import SubcategoryShell, { TAB_HISTORY, TAB_INPUT } from "./SubcategoryShell";
import { earnTokens, spendTokens } from "../utils/tokens";
import { useCategoryTokenBalance } from "./Tokens";

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

function idKey(v) {
  const s = String(v ?? "").trim();
  return s ? s : "";
}

function normalizeSelectedTasks(tasks) {
  const list = Array.isArray(tasks) ? tasks : [];
  const set = new Set();
  const out = [];
  for (const t of list) {
    const s = String(t ?? "").trim();
    if (!s) continue;
    if (set.has(s)) continue;
    set.add(s);
    out.push(s);
  }
  return out;
}

const CHORE_OPTIONS = [
  { id: "wash-dry-clothes", label: "Wash and Dry Clothes" },
  { id: "fold-put-away-clothes", label: "Fold and Put Away Clothes" },
  { id: "wash-dry-bedding", label: "Wash and Dry Bedding" },
  { id: "make-bed", label: "Make Bed" },
  { id: "tidy-bedroom", label: "Tidy Bedroom" },
  { id: "tidy-living-room", label: "Tidy Living Room" },
  { id: "dishes", label: "Dishes" },
  { id: "scoop-cat-litter", label: "Scoop Cat Litter" },
  { id: "bathe-maya", label: "Bathe Maya" },
  { id: "sweep-vacuum", label: "Sweep/Vacuum" },
  { id: "check-mail", label: "Check Mail" },
  { id: "cooking", label: "Cooking" },
  { id: "other", label: "Other" },
];

const CHORE_IDS = CHORE_OPTIONS.map((x) => x.id);

function choreLabel(id) {
  const found = CHORE_OPTIONS.find((x) => x.id === id);
  return found ? found.label : String(id || "");
}

function buildChoresStarHistory({ entries, tokenUses }) {
  const list = Array.isArray(entries) ? entries : [];
  const tokens = Array.isArray(tokenUses) ? tokenUses : [];

  const choresByDay = new Map();
  list.forEach((e) => {
    const dk = typeof e?.dateKey === "string" ? e.dateKey : "";
    if (!dk) return;
    const tasks = normalizeSelectedTasks(e?.tasks);
    const used = choresByDay.get(dk) || 0;
    choresByDay.set(dk, used + tasks.length);
  });

  const tokenSpendByDay = new Map();
  tokens.forEach((t) => {
    const dk = String(t?.dateKey || "").trim();
    if (!dk) return;
    const spent = Math.max(0, Math.floor(Number(t?.tokensSpent) || 0));
    if (!spent) return;
    tokenSpendByDay.set(dk, (tokenSpendByDay.get(dk) || 0) + spent);
  });

  const days = [...new Set([...choresByDay.keys(), ...tokenSpendByDay.keys()])].sort((a, b) =>
    String(a).localeCompare(String(b))
  );

  // Chores earn up to 2 gold fragments/day; tokens can fill remaining fragments (silver) up to the same daily cap.
  const creditedByDay = new Map();
  const creditedEvents = [];

  for (const dk of days) {
    const chores = choresByDay.get(dk) || 0;
    const choresCredited = Math.max(0, Math.min(2, Math.trunc(chores)));
    const tokensSpent = tokenSpendByDay.get(dk) || 0;
    const tokenCredited = Math.max(0, Math.min(2 - choresCredited, Math.trunc(tokensSpent)));

    const credited = choresCredited + tokenCredited;
    if (credited <= 0) continue;

    creditedByDay.set(dk, {
      credited,
      choresCredited,
      tokenCredited,
      tokensSpent,
      usedToken: tokenCredited > 0,
    });

    for (let i = 0; i < choresCredited; i += 1) creditedEvents.push({ usedToken: false });
    for (let i = 0; i < tokenCredited; i += 1) creditedEvents.push({ usedToken: true });
  }

  const starHistory = [];
  let current = [];
  for (const ev of creditedEvents) {
    current.push(ev.usedToken ? "silver" : "gold");
    if (current.length === 5) {
      starHistory.push({ fragments: [...current] });
      current = [];
    }
  }
  if (current.length) starHistory.push({ fragments: [...current] });

  return {
    starHistory,
    creditedByDay,
    currentStars: creditedEvents.length / 5,
    fragmentCount: creditedEvents.length,
  };
}

function daysInMonthFromMonthKey(monthKey) {
  const [yyyy, mm] = String(monthKey || "").split("-");
  const y = Number(yyyy);
  const m = Number(mm);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return 0;
  return new Date(y, m, 0).getDate();
}

export default function ChoresSubcategoryPage({ category, subcategory, onBack, lowEnergy }) {
  const [activeTab, setActiveTab] = useState(TAB_INPUT);

  const ENTRY_KEY = `spiritChoresEntries:${category.id}:${subcategory.id}`;
  const TOKEN_KEY = `spiritChoresTokens:${category.id}:${subcategory.id}`;

  const availableTokens = useCategoryTokenBalance(category.id);

  const [entries, setEntries] = useState(() => safeParseArray(localStorage.getItem(ENTRY_KEY)));
  const [tokenUses, setTokenUses] = useState(() => safeParseArray(localStorage.getItem(TOKEN_KEY)));

  const [dateKey, setDateKey] = useState(todayKey());
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [notes, setNotes] = useState("");
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [tokenSpendCount, setTokenSpendCount] = useState(1);

  useEffect(() => {
    localStorage.setItem(ENTRY_KEY, JSON.stringify(Array.isArray(entries) ? entries : []));
    emitSpiritDataChanged(category.id, subcategory.id);
  }, [ENTRY_KEY, category.id, entries, subcategory.id]);

  useEffect(() => {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(Array.isArray(tokenUses) ? tokenUses : []));
    emitSpiritDataChanged(category.id, subcategory.id);
  }, [TOKEN_KEY, category.id, subcategory.id, tokenUses]);

  const derived = useMemo(() => buildChoresStarHistory({ entries, tokenUses }), [entries, tokenUses]);

  const monthKey = useMemo(() => String(todayKey()).slice(0, 7), []);
  const yearKey = useMemo(() => String(todayKey()).slice(0, 4), []);

  const creditedThisMonth = useMemo(() => {
    let credited = 0;
    let tokenCredited = 0;
    for (const [dk, info] of derived.creditedByDay || []) {
      if (!String(dk).startsWith(monthKey)) continue;
      credited += Number(info?.credited) || 0;
      tokenCredited += Math.max(0, Math.floor(Number(info?.tokenCredited) || 0));
    }
    return { credited, tokenCredited };
  }, [derived.creditedByDay, monthKey]);

  const creditedThisYear = useMemo(() => {
    let credited = 0;
    let tokenCredited = 0;
    for (const [dk, info] of derived.creditedByDay || []) {
      if (!String(dk).startsWith(yearKey)) continue;
      credited += Number(info?.credited) || 0;
      tokenCredited += Math.max(0, Math.floor(Number(info?.tokenCredited) || 0));
    }
    return { credited, tokenCredited };
  }, [derived.creditedByDay, yearKey]);

  const today = todayKey();
  const todayInfo = derived.creditedByDay?.get?.(today);
  const choresCreditedToday = Math.max(0, Math.floor(Number(todayInfo?.choresCredited) || 0));
  const creditedToday = Math.max(0, Math.floor(Number(todayInfo?.credited) || 0));
  const completedToday = creditedToday >= 2;

  const tokenAlreadyToday = useMemo(
    () => (Array.isArray(tokenUses) ? tokenUses : []).some((t) => String(t?.dateKey || "") === today),
    [today, tokenUses]
  );

  const remainingFragmentsToday = Math.max(0, 2 - choresCreditedToday);
  const canApplyToken = remainingFragmentsToday > 0 && !tokenAlreadyToday;

  useEffect(() => {
    const avail = Math.max(0, Math.floor(Number(availableTokens) || 0));
    const maxToday = Math.max(1, Math.min(2, remainingFragmentsToday || 1, avail >= 2 ? 2 : 1));
    setTokenSpendCount((prev) => {
      const p = Math.max(1, Math.floor(Number(prev) || 1));
      return Math.min(p, maxToday);
    });
  }, [availableTokens, remainingFragmentsToday]);

  const maxTokensToday = Math.max(0, Math.min(2, remainingFragmentsToday));
  const tokensAvail = Math.max(0, Math.floor(Number(availableTokens) || 0));

  const tokenModalContent = (
    <div>
      <div className="journal-field" style={{ marginTop: "0.6rem" }}>
        <label className="journal-label">Tokens to spend</label>
        <select
          className="journal-input-text"
          value={tokenSpendCount}
          onChange={(e) => setTokenSpendCount(Number(e.target.value))}
          disabled={!canApplyToken}
        >
          {maxTokensToday >= 1 && <option value={1}>1 token</option>}
          {maxTokensToday >= 2 && tokensAvail >= 2 && <option value={2}>2 tokens</option>}
        </select>
      </div>

      <p className="token-confirm-copy" style={{ marginTop: "0.6rem" }}>
        Spend {tokenSpendCount} token{tokenSpendCount === 1 ? "" : "s"} to add {tokenSpendCount}/5 silver toward today’s 2/5 cap.
      </p>
    </div>
  );

  const historyEntries = useMemo(() => {
    const mappedEntries = (Array.isArray(entries) ? entries : []).map((e) => {
      const dk = typeof e?.dateKey === "string" ? e.dateKey : "";
      const title = formatEuropeanDate(dk);

      const tasks = normalizeSelectedTasks(e?.tasks);
      const taskLines = tasks.map((t) => `• ${choreLabel(t)}`);

      const lines = [];
      if (taskLines.length) {
        lines.push("Chores:");
        lines.push(taskLines.join("\n"));
      }
      if (String(e?.notes || "").trim()) {
        if (lines.length) lines.push("");
        lines.push(`Notes: ${String(e.notes).trim()}`);
      }

      return {
        id: idKey(e?.id),
        dateKey: dk,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
        lowEnergy: !!e.lowEnergy,
        title,
        timeOfDay: "", // no pill/tag in history header
        text: lines.join("\n"),
      };
    });

    const mappedTokens = (Array.isArray(tokenUses) ? tokenUses : []).map((t) => {
      const dk = typeof t?.dateKey === "string" ? t.dateKey : "";
      const title = formatEuropeanDate(dk);
      const spent = Math.max(0, Math.floor(Number(t?.tokensSpent) || 0));
      return {
        id: idKey(t?.id),
        dateKey: dk,
        createdAt: t.createdAt,
        lowEnergy: !!t.lowEnergy,
        isToken: true,
        title,
        timeOfDay: "", // no pill/tag in history header
        text: spent ? `Used ${spent} token${spent === 1 ? "" : "s"}.` : "",
      };
    });

    return [...mappedEntries, ...mappedTokens].filter((e) => e?.dateKey);
  }, [entries, tokenUses]);

  const resetForm = () => {
    setSelectedTasks([]);
    setNotes("");
    setDateKey(todayKey());
  };

  const beginEdit = (entry) => {
    const id = idKey(entry?.id);
    if (!id) return;
    const existing = (Array.isArray(entries) ? entries : []).find((e) => idKey(e?.id) === id);
    if (!existing) return;
    setEditingEntryId(id);
    setDateKey(String(existing?.dateKey || todayKey()));
    setSelectedTasks(normalizeSelectedTasks(existing?.tasks));
    setNotes(String(existing?.notes || ""));
    setActiveTab(TAB_INPUT);
  };

  const handleDeleteHistoryEntry = (entry) => {
    if (!entry) return;

    const entryId = idKey(entry?.id);
    if (!entryId) return;

    if (entry.isToken) {
      const existing = (Array.isArray(tokenUses) ? tokenUses : []).find((t) => idKey(t?.id) === entryId);
      const refund = Math.max(0, Math.floor(Number(existing?.tokensSpent) || 1));

      setTokenUses((prev) => (Array.isArray(prev) ? prev.filter((t) => idKey(t?.id) !== entryId) : prev));

      if (refund > 0) {
        earnTokens({
          categoryId: category.id,
          amount: refund,
          source: "spirit-chores-token-refund",
          meta: { subcategoryId: subcategory.id, dateKey: entry?.dateKey, entryId },
        });
      }
      return;
    }

    setEntries((prev) => (Array.isArray(prev) ? prev.filter((e) => idKey(e?.id) !== entryId) : prev));
    if (editingEntryId === entryId) {
      setEditingEntryId(null);
      resetForm();
    }
  };

  const onConfirmToken = () => {
    if (!canApplyToken) return;

    const spendCount = Math.max(1, Math.floor(Number(tokenSpendCount) || 1));
    const maxAllowed = Math.max(1, Math.min(2, remainingFragmentsToday || 1));
    const finalSpend = Math.min(spendCount, maxAllowed);

    const res = spendTokens({
      categoryId: category.id,
      amount: finalSpend,
      source: "spirit-chores-token",
      meta: { subcategoryId: subcategory.id },
    });

    if (!res?.ok) return;

    const nowIso = new Date().toISOString();
    const dk = todayKey();

    setTokenUses((prev) => [
      {
        id: `spctok-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        dateKey: dk,
        createdAt: nowIso,
        lowEnergy: !!lowEnergy,
        isToken: true,
        tokensSpent: finalSpend,
      },
      ...(Array.isArray(prev) ? prev : []),
    ]);
  };

  const handleLog = () => {
    const dk = String(dateKey || "").trim() || todayKey();
    const tasks = normalizeSelectedTasks(selectedTasks);
    const trimmedNotes = String(notes || "").trim();
    if (!dk) return;
    if (!tasks.length && !trimmedNotes) return;

    const nowIso = new Date().toISOString();
    const isEditing = typeof editingEntryId === "string" && editingEntryId.length > 0;

    if (isEditing) {
      setEntries((prev) =>
        (Array.isArray(prev) ? prev : []).map((e) =>
          idKey(e?.id) === editingEntryId
            ? {
                ...e,
                dateKey: dk,
                tasks,
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
        id: `spc-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        dateKey: dk,
        createdAt: nowIso,
        lowEnergy: !!lowEnergy,
        tasks,
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
      completedToday,
      monthlyFragments: creditedThisMonth.credited,
      monthlyFragmentsMax: daysInMonthFromMonthKey(monthKey) * 2,
    }),
    [subcategory, derived.starHistory, derived.currentStars, completedToday, creditedThisMonth.credited, monthKey]
  );

  const trackerStats = useMemo(() => {
    const list = Array.isArray(entries) ? entries : [];

    const counts = CHORE_IDS.reduce((acc, id) => {
      acc[id] = 0;
      return acc;
    }, {});

    let total = 0;
    for (const e of list) {
      const tasks = normalizeSelectedTasks(e?.tasks);
      for (const t of tasks) {
        if (!Object.prototype.hasOwnProperty.call(counts, t)) {
          // unknown task IDs are ignored
          continue;
        }
        counts[t] += 1;
        total += 1;
      }
    }

    const pct = CHORE_IDS.reduce((acc, id) => {
      acc[id] = total > 0 ? Math.round((counts[id] / total) * 100) : 0;
      return acc;
    }, {});

    return { counts, pct, total };
  }, [entries]);

  return (
    <SubcategoryShell
      category={category}
      subcategory={subcategoryWithComputedStars}
      onBack={onBack}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      summaryLabel="Fragments"
      summaryValue={creditedThisMonth.credited}
      lowEnergy={!!lowEnergy}
      onPatchHistoryEntries={setEntries}
      renderTokenControl={() => null}
      tokenControlPlacement="manual"
      availableTokens={availableTokens}
      minTokensToApply={canApplyToken ? tokenSpendCount : 9999}
      tokenModalContent={tokenModalContent}
      onConfirmToken={onConfirmToken}
      tokensUsed={creditedThisMonth.tokenCredited}
      monthlyFragments={creditedThisMonth.credited}
      yearlyFragments={creditedThisYear.credited}
      monthlyFragmentsMax={daysInMonthFromMonthKey(monthKey) * 2}
      yearlyFragmentsMax={730}
      fragmentsLogged={derived.fragmentCount}
      entriesLogged={(Array.isArray(entries) ? entries.length : 0) + (Array.isArray(tokenUses) ? tokenUses.length : 0)}
      avgChars={0}
      totalStarsApprox={derived.currentStars}
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
            </div>

            <div className="tracker-section" style={{ marginTop: "0.9rem" }}>
              <div className="tracker-label">Chores</div>
              <div className="journal-input-row" style={{ marginTop: "0.6rem" }}>
                {CHORE_OPTIONS.map((opt) => {
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
                Earn 1/5 of a star per chore, capped at 2/5 per day.
              </div>
            </div>

            <div className="journal-field" style={{ marginTop: "0.9rem" }}>
              <label className="journal-label">Notes (optional)</label>
              <textarea
                className="journal-textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder='If you chose "Other", list what you did here.'
              />
            </div>

            <div className="journal-actions-row" style={{ marginTop: "0.9rem" }}>
              {typeof editingEntryId === "string" && editingEntryId.length > 0 && (
                <button type="button" className="journal-button-secondary" onClick={cancelEdit}>
                  Cancel
                </button>
              )}
              <button type="button" className="journal-button-primary" onClick={handleLog}>
                {typeof editingEntryId === "string" && editingEntryId.length > 0 ? "Save Changes" : "Log Chores"}
              </button>
            </div>

            <div style={{ marginTop: "0.6rem" }}>{TokenControl && <TokenControl />}</div>

            {completedToday && (
              <div className="tracker-sub" style={{ marginTop: "0.9rem" }}>
                You can keep logging; stars are capped at 2/5 per day.
              </div>
            )}
          </div>
        </div>
      )}
      renderTracker={() => (
        <div className="journal-tracker">
          <div className="tracker-section">
            <div className="tracker-label">Tasks</div>

            {CHORE_OPTIONS.map((row) => (
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

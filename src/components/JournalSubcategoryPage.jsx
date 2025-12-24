// src/components/JournalSubcategoryPage.jsx
import React, { useState, useEffect } from "react";
import SubcategoryShell, {
  TAB_INPUT,
  TAB_HISTORY,
  TAB_TRACKER,
} from "./SubcategoryShell";
import { useCategoryTokenBalance, ensureCategoryTokensSeeded } from "./Tokens";
import { earnTokens, spendTokens } from "../utils/tokens";

function emitJournalDataChanged(categoryId, subcategoryId) {
  try {
    window.dispatchEvent(
      new CustomEvent("journal-data-changed", {
        detail: { categoryId, subcategoryId },
      })
    );
  } catch {
    // ignore
  }
}

// simple helper
function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatEuropeanDate(dateKey) {
  const [yyyy, mm, dd] = dateKey.split("-");
  const monthIndex = parseInt(mm, 10) - 1;

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return `${dd} ${monthNames[monthIndex]} ${yyyy}`;
}

function formatMonthYearFromKey(monthKey) {
  const [yyyy, mm] = monthKey.split("-");
  const monthIndex = parseInt(mm, 10) - 1;

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  return `${monthNames[monthIndex]} ${yyyy}`;
}

function JournalSubcategoryPage({ category, subcategory, onBack, lowEnergy }) {
  const [activeTab, setActiveTab] = useState(TAB_INPUT);
  const [editingEntry, setEditingEntry] = useState(null);
  const STORAGE_KEY = `journalEntries:${category.id}:${subcategory.id}`;
  const TOKEN_STORAGE_KEY = `journalTokens:${category.id}:${subcategory.id}`;
  const [tokenTimeOfDay, setTokenTimeOfDay] = useState("morning");

  // Category-wide token balance (stubbed/seeded for now).
  const availableTokens = useCategoryTokenBalance(category?.id);

  useEffect(() => {
    ensureCategoryTokensSeeded(category?.id);
  }, [category?.id]);

  const tokenModalContent = (
    <>
      <p className="token-confirm-copy">
        Are you sure? All you have to do is write one word.
        Even <em>“Ugh.”</em>
      </p>

      <div className="token-modal-field">
        <label className="journal-label">Time of Day</label>
        <select
          className="journal-select"
          value={tokenTimeOfDay}
          onChange={(e) => setTokenTimeOfDay(e.target.value)}
        >
          <option value="morning">Morning</option>
          <option value="afternoon">Afternoon</option>
          <option value="evening">Evening</option>
        </select>
      </div>
    </>
  );

  // local journal entries
  const [entries, setEntries] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [tokenUses, setTokenUses] = useState(() => {
    try {
      const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // input fields
  const [title, setTitle] = useState("");
  const [timeOfDay, setTimeOfDay] = useState(() => {
    const hour = new Date().getHours();
    if (hour < 10) return "morning";
    if (hour < 17) return "afternoon";
    return "evening";
  });
  const [text, setText] = useState("");

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayKey = `${yyyy}-${mm}-${dd}`;
  // how many entries have been logged this calendar month
  const monthKey = `${yyyy}-${mm}`;
  const yearKey = `${yyyy}`;

  // Max possible fragments
  const daysInThisMonth = new Date(yyyy, today.getMonth() + 1, 0).getDate();
  const monthlyMaxFragments = daysInThisMonth * 3;
  const yearlyMaxFragments = 365 * 3;

  // Each day has up to 3 fragment slots: Morning, Afternoon, Evening.
  // We count each (dateKey + timeOfDay) at most once, from entries or tokens.
  const uniqueSlotsThisMonth = new Set();

  entries.forEach((entry) => {
    if (!entry.dateKey || !entry.dateKey.startsWith(monthKey)) return;
    const slotKey = `${entry.dateKey}-${entry.timeOfDay || ""}`;
    uniqueSlotsThisMonth.add(slotKey);
  });

  tokenUses.forEach((token) => {
    if (!token.dateKey || !token.dateKey.startsWith(monthKey)) return;
    const slotKey = `${token.dateKey}-${token.timeOfDay || ""}`;
    uniqueSlotsThisMonth.add(slotKey);
  });

  const entriesThisMonth = uniqueSlotsThisMonth.size;

  // Topbar star: show the last (current) star for this month, with empty fragments.
  // If all stars are full (exact multiple of 5 fragments), show an empty star.
  const timeOrder = { morning: 1, afternoon: 2, evening: 3 };
  const monthlySlotMap = new Map();

  entries.forEach((e) => {
    if (!e?.dateKey || !e?.timeOfDay) return;
    if (!e.dateKey.startsWith(monthKey)) return;
    const key = `${e.dateKey}__${e.timeOfDay}`;
    monthlySlotMap.set(key, {
      dateKey: e.dateKey,
      timeOfDay: e.timeOfDay,
      fillType: "gold",
    });
  });

  tokenUses.forEach((t) => {
    if (!t?.dateKey || !t?.timeOfDay) return;
    if (!t.dateKey.startsWith(monthKey)) return;
    const key = `${t.dateKey}__${t.timeOfDay}`;
    if (!monthlySlotMap.has(key)) {
      monthlySlotMap.set(key, {
        dateKey: t.dateKey,
        timeOfDay: t.timeOfDay,
        fillType: "silver",
      });
    }
  });

  const earnedSlotsThisMonth = Array.from(monthlySlotMap.values()).sort((a, b) => {
    if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
    return (timeOrder[a.timeOfDay] || 0) - (timeOrder[b.timeOfDay] || 0);
  });

  const monthlyRemainder = earnedSlotsThisMonth.length % 5;
  const topbarStarFragments = new Array(5).fill(undefined);
  if (monthlyRemainder !== 0) {
    const start = earnedSlotsThisMonth.length - monthlyRemainder;
    for (let i = 0; i < monthlyRemainder; i++) {
      topbarStarFragments[i] = earnedSlotsThisMonth[start + i].fillType;
    }
  }

  // Yearly fragments: unique (dateKey + timeOfDay) in the current calendar year
  const uniqueSlotsThisYear = new Set();

  entries.forEach((entry) => {
    if (!entry.dateKey || !entry.dateKey.startsWith(`${yearKey}-`)) return;
    const slotKey = `${entry.dateKey}-${entry.timeOfDay || ""}`;
    uniqueSlotsThisYear.add(slotKey);
  });

  tokenUses.forEach((token) => {
    if (!token.dateKey || !token.dateKey.startsWith(`${yearKey}-`)) return;
    const slotKey = `${token.dateKey}-${token.timeOfDay || ""}`;
    uniqueSlotsThisYear.add(slotKey);
  });

  const entriesThisYear = uniqueSlotsThisYear.size;

  // how many journal entries were logged *today* in this subcategory
  const todayFragments = entries.filter(
    (entry) => entry.dateKey === todayKey
  ).length;

  const stats = computeJournalStats(entries, tokenUses);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // optional: silently fail or log later
    }

    emitJournalDataChanged(category.id, subcategory.id);
  }, [entries, STORAGE_KEY]);

  useEffect(() => {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokenUses));
    } catch {
      // optional: silently fail or log later
    }

    emitJournalDataChanged(category.id, subcategory.id);
  }, [tokenUses, TOKEN_STORAGE_KEY]);

  const handleSaveEntry = (entryData) => {
    // EDIT MODE
    if (editingEntry) {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === editingEntry.id ? { ...e, ...entryData } : e
        )
      );
      setEditingEntry(null);
      setActiveTab(TAB_HISTORY);
      return;
    }

    // CREATE MODE
    const entry = {
      ...entryData,
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      categoryId: category.id,
      subcategoryId: subcategory.id,
      createdAt: new Date().toISOString(),
    };

    setEntries((prev) => [entry, ...prev]);
    setText("");
    setTitle("");
  };

  const tokenHistoryEntries = tokenUses.map((t) => {
    const isLowEnergy = t?.lowEnergy === true || t?.type === "low-energy";
    return {
    id: t.id,
    dateKey: t.dateKey,
    timeOfDay: t.timeOfDay,
    title: formatEuropeanDate(t.dateKey),
    text: isLowEnergy ? "Low-energy token applied." : "Token applied.",
    isToken: true,
    lowEnergy: isLowEnergy,
    createdAt: t.createdAt,
    };
  });

  const historyEntriesCombined = [...tokenHistoryEntries, ...entries].sort(
    (a, b) => {
      // Newest day first
      if (a.dateKey !== b.dateKey) return b.dateKey.localeCompare(a.dateKey);

      // Within a day, always Morning → Afternoon → Evening
      const aKey = String(a?.timeOfDay || "").toLowerCase();
      const bKey = String(b?.timeOfDay || "").toLowerCase();
      const aT = timeOrder[aKey] ?? 99;
      const bT = timeOrder[bKey] ?? 99;
      if (aT !== bT) return aT - bT;

      // Stable fallback (oldest first within same time-of-day)
      const aTime = Date.parse(a?.createdAt || "");
      const bTime = Date.parse(b?.createdAt || "");
      if (Number.isFinite(aTime) && Number.isFinite(bTime)) return aTime - bTime;
      if (Number.isFinite(aTime)) return -1;
      if (Number.isFinite(bTime)) return 1;
      return String(a?.id || "").localeCompare(String(b?.id || ""));
    }
  );
  const tokensUsed = tokenUses.length;

  const handleApplyToken = ({ timeOfDay, lowEnergy: lowEnergyCtx } = {}) => {
    if (!timeOfDay) return;

    // Require available category tokens.
    const spend = spendTokens({
      categoryId: category?.id,
      amount: 1,
      source: "journal-token",
      meta: { subcategoryId: subcategory?.id, dateKey: todayKey, timeOfDay },
    });
    if (!spend.ok) return;

    // Prevent duplicate token uses for the same day+session.
    const exists = tokenUses.some(
      (t) => t.dateKey === todayKey && t.timeOfDay === timeOfDay
    );
    if (exists) return;

    const token = {
      id: `token-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      dateKey: todayKey,
      timeOfDay,
      type: lowEnergyCtx ? "low-energy" : "standard",
      lowEnergy: !!lowEnergyCtx,
      createdAt: new Date().toISOString(),
    };

    setTokenUses((prev) => [token, ...prev]);
  };

  const handleDeleteEntry = (entry) => {
    if (entry.isToken) {
      // Best-effort refund of the category token when a token-use is deleted.
      earnTokens({
        categoryId: category?.id,
        amount: 1,
        source: "journal-token-refund",
        meta: { subcategoryId: subcategory?.id, dateKey: entry?.dateKey, timeOfDay: entry?.timeOfDay },
      });
      setTokenUses((prev) => prev.filter((t) => t.id !== entry.id));
    } else {
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    }
  };

  return (
    <SubcategoryShell
      category={category}
      subcategory={subcategory}
      onBack={onBack}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      summaryLabel="Monthly Fragments"
      summaryValue={`${entriesThisMonth} / ${monthlyMaxFragments}`}
      summaryStarFragments={topbarStarFragments}
      monthlyFragments={entriesThisMonth}
      yearlyFragments={entriesThisYear}
      monthlyFragmentsMax={monthlyMaxFragments}
      yearlyFragmentsMax={yearlyMaxFragments}
      historyEntries={historyEntriesCombined}
      historyTheme="air"
      tokenModalContent={tokenModalContent}
      onConfirmToken={(ctx) => handleApplyToken({ timeOfDay: tokenTimeOfDay, lowEnergy: ctx?.lowEnergy })}
      tokensUsed={tokensUsed}
      lowEnergy={!!lowEnergy}
      onPatchHistoryEntries={setEntries}
      availableTokens={availableTokens}
      fragmentsLogged={stats.totalFragments}
      entriesLogged={stats.totalEntries}
      avgChars={stats.avgChars}
      totalStarsApprox={stats.totalStarsApprox}
      onRequestEditEntry={(entry) => {
        setEditingEntry(entry);
        setActiveTab(TAB_INPUT);
      }}
      onDeleteEntry={handleDeleteEntry}

      renderInput={() => (
        <JournalInputTab
          title={title}
          setTitle={setTitle}
          timeOfDay={timeOfDay}
          setTimeOfDay={setTimeOfDay}
          text={text}
          setText={setText}
          onSave={handleSaveEntry}
          todayKey={todayKey}
          mode={editingEntry ? "edit" : "create"}
          initialEntry={editingEntry}
        />
      )}

      renderTokenControl={() => (
        <select
          className="token-select"
          value={timeOfDay}
          onChange={(e) => setTimeOfDay(e.target.value)}
          disabled={(availableTokens || 0) <= 0}
        >
          <option value="morning">Morning</option>
          <option value="afternoon">Afternoon</option>
          <option value="evening">Evening</option>
        </select>
      )}

      renderTracker={() => (
        <JournalTrackerTab
          entries={entries}
          stats={stats}
          category={category}
          subcategory={subcategory}
          tokensUsed={tokenUses}
        />
      )}
    />
  );
}

// --- the three journal-specific tab components ---

function JournalInputTab({
  title,
  setTitle,
  timeOfDay,
  setTimeOfDay,
  text,
  setText,
  onSave,
  todayKey,
  mode = "create",
  initialEntry = null,
}) {
  const placeholderTitle = `${formatEuropeanDate(todayKey)}`;

  const [attachments, setAttachments] = React.useState(
    initialEntry?.attachments || []
  );

  React.useEffect(() => {
    if (mode === "edit" && initialEntry) {
      setTitle(initialEntry.title || "");
      setTimeOfDay(initialEntry.timeOfDay || "morning");
      setText(initialEntry.text || "");
      setAttachments(initialEntry.attachments || []);
    }
  }, [mode, initialEntry, setTitle, setTimeOfDay, setText]);

  function handleAddImage(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setAttachments((prev) => [...prev, reader.result]);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="journal-input-fields">
      <div className="journal-input-row">
        <div className="journal-field">
          <label className="journal-label">Title</label>
          <input
            type="text"
            className="journal-input-text"
            placeholder={placeholderTitle}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="journal-field">
          <label className="journal-label">Time of Day</label>
          <select
            className="journal-select"
            value={timeOfDay}
            onChange={(e) => setTimeOfDay(e.target.value)}
          >
            <option value="morning">Morning</option>
            <option value="afternoon">Afternoon</option>
            <option value="evening">Evening</option>
          </select>
        </div>
      </div>

      <div className="journal-field" style={{ marginTop: "0.9rem" }}>
        <label className="journal-label">Entry</label>
        <textarea
          className="journal-textarea"
          rows={8}
          placeholder="Write anything true enough to be worth a fragment…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="journal-char-counter">
          {text.trim().length} characters
        </div>
      </div>

      {attachments.length > 0 && (
        <div className="journal-image-preview">
          {attachments.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`attachment-${i}`}
              className="journal-image-thumb"
            />
          ))}
        </div>
      )}

      <div className="journal-actions-row">
        <label className="journal-button-secondary">
          + Add Image
          <input
            type="file"
            accept="image/*"
            onChange={handleAddImage}
            style={{ display: "none" }}
          />
        </label>

        <button
          type="button"
          className="journal-button-primary"
          onClick={() => {
            const trimmed = text.trim();
            if (!trimmed) return;

            const entry = {
              ...(initialEntry || {}),
              title: title.trim() || placeholderTitle,
              timeOfDay,
              text: trimmed,
              dateKey: initialEntry?.dateKey || todayKey,
              updatedAt: new Date().toISOString(),
              attachments,
            };

            onSave(entry);
          }}
          disabled={!text.trim()}
        >
          {mode === "edit" ? "Save Changes" : "Save Entry"}
        </button>
      </div>
    </div>
  );
}

function JournalTrackerTab({ entries, stats, subcategory, tokensUsed }) {
  const {
    totalEntries,
    totalFragments,
    totalStarsApprox,
    avgChars,
    morningCount,
    afternoonCount,
    eveningCount,
    morningPct,
    afternoonPct,
    eveningPct,
    shortCount,
    mediumCount,
    longCount,
    lowEnergyCount
  } = stats;

  // For reference: max possible for this subcategory (3 fragments/day all year)
  const maxFragmentsYear = 365 * 3;
  const maxStarsYear = maxFragmentsYear / 5;

  return (
    <div className="journal-tracker">
      <div className="tracker-section">
        <div className="tracker-label">Time-of-day pattern</div>

        <div className="tracker-bar-row">
          <span className="tracker-bar-label">Morning</span>
          <div className="tracker-bar-track">
            <div
              className="tracker-bar-fill"
              style={{ width: `${morningPct}%` }}
            />
          </div>
          <span className="tracker-bar-value">
            {morningCount} ({morningPct}%)
          </span>
        </div>

        <div className="tracker-bar-row">
          <span className="tracker-bar-label">Afternoon</span>
          <div className="tracker-bar-track">
            <div
              className="tracker-bar-fill"
              style={{ width: `${afternoonPct}%` }}
            />
          </div>
          <span className="tracker-bar-value">
            {afternoonCount} ({afternoonPct}%)
          </span>
        </div>

        <div className="tracker-bar-row">
          <span className="tracker-bar-label">Evening</span>
          <div className="tracker-bar-track">
            <div
              className="tracker-bar-fill"
              style={{ width: `${eveningPct}%` }}
            />
          </div>
          <span className="tracker-bar-value">
            {eveningCount} ({eveningPct}%)
          </span>
        </div>
      </div>

      {/* Length distribution */}
      <div className="tracker-section">
        <div className="tracker-label">Entry length</div>
        <div className="tracker-length-row">
          <div className="tracker-length-pill">
            <span className="tracker-pill-label">Short</span>
            <span className="tracker-pill-value">{shortCount}</span>
          </div>
          <div className="tracker-length-pill">
            <span className="tracker-pill-label">Medium</span>
            <span className="tracker-pill-value">{mediumCount}</span>
          </div>
          <div className="tracker-length-pill">
            <span className="tracker-pill-label">Long</span>
            <span className="tracker-pill-value">{longCount}</span>
          </div>
        </div>
      </div>

      <div className="tracker-note">
        Later we’ll wire these numbers into your yearly totals and constellation
        unlocks. For now, this shows how your fragments cluster across the day.
      </div>
    </div>
  );
}

// --- stats helper ---

function computeJournalStats(entries, tokens = []) {
  // Entries (raw count) — this is what you want for “Entries logged”
  const totalEntries = entries.length;

  // Fragments (earned) — 1 per unique (dateKey + timeOfDay)
  const fragmentKeys = new Set();
  let morningFragments = 0;
  let afternoonFragments = 0;
  let eveningFragments = 0;

  // Avg length should stay per-entry (what you already show)
  let totalChars = 0;

  // “Days you marked as low-energy” should be unique days
  const lowEnergyDays = new Set();

  // Entry length buckets (keep per-entry)
  let shortCount = 0;
  let mediumCount = 0;
  let longCount = 0;

  entries.forEach((entry) => {
    const len = entry.text.trim().length;
    totalChars += len;

    if (len < 50) shortCount++;
    else if (len < 200) mediumCount++;
    else longCount++;

    if (entry.lowEnergy && entry.dateKey) {
      lowEnergyDays.add(entry.dateKey);
    }

    // Count fragments only once per day+timeOfDay
    if (entry.dateKey && entry.timeOfDay) {
      const key = `${entry.dateKey}__${entry.timeOfDay}`;
      if (!fragmentKeys.has(key)) {
        fragmentKeys.add(key);

        if (entry.timeOfDay === "morning") morningFragments++;
        if (entry.timeOfDay === "afternoon") afternoonFragments++;
        if (entry.timeOfDay === "evening") eveningFragments++;
      }
    }
  });

  tokens.forEach((token) => {
    // Tokens don't have text, so no length or lowEnergy from here
    // But they do count as fragments
    if (token.dateKey && token.timeOfDay) {
      const key = `${token.dateKey}__${token.timeOfDay}`;
      if (!fragmentKeys.has(key)) {
        fragmentKeys.add(key);

        if (token.timeOfDay === "morning") morningFragments++;
        if (token.timeOfDay === "afternoon") afternoonFragments++;
        if (token.timeOfDay === "evening") eveningFragments++;
      }
    }
  });

  const totalFragments = fragmentKeys.size;
  const totalStarsApprox = totalFragments / 5; // 5 fragments = 1 star

  const avgChars = totalEntries ? Math.round(totalChars / totalEntries) : 0;

  const timeTotal = morningFragments + afternoonFragments + eveningFragments || 1;
  const morningPct = Math.round((morningFragments / timeTotal) * 100);
  const afternoonPct = Math.round((afternoonFragments / timeTotal) * 100);
  const eveningPct = Math.round((eveningFragments / timeTotal) * 100);

  return {
    totalEntries,
    totalFragments,
    totalStarsApprox,
    avgChars,

    // time-of-day pattern should reflect fragments earned
    morningCount: morningFragments,
    afternoonCount: afternoonFragments,
    eveningCount: eveningFragments,
    morningPct,
    afternoonPct,
    eveningPct,

    // entry-length stays per-entry
    shortCount,
    mediumCount,
    longCount,

    // low-energy is per-day
    lowEnergyCount: lowEnergyDays.size,
  };
}


export default JournalSubcategoryPage;

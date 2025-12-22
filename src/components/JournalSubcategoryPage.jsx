// src/components/JournalSubcategoryPage.jsx
import React, { useState, useEffect } from "react";
import SubcategoryShell, {
  TAB_INPUT,
  TAB_HISTORY,
  TAB_TRACKER,
} from "./SubcategoryShell";

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
  const [tokenTimeOfDay, setTokenTimeOfDay] = useState("morning");

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

  // Each day has up to 3 fragment slots: Morning, Afternoon, Evening.
  // We count each (dateKey + timeOfDay) at most once.
  const uniqueSlotsThisMonth = new Set();

  entries.forEach((entry) => {
    if (!entry.dateKey || !entry.dateKey.startsWith(monthKey)) return;

    const slotKey = `${entry.dateKey}-${entry.timeOfDay || ""}`;
    uniqueSlotsThisMonth.add(slotKey);
  });

  const entriesThisMonth = uniqueSlotsThisMonth.size;

  const monthlyGoal = subcategory.monthMaxStars;

  // how many journal entries were logged *today* in this subcategory
  const todayFragments = entries.filter(
    (entry) => entry.dateKey === todayKey
  ).length;

  const stats = computeJournalStats(entries);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // optional: silently fail or log later
    }
  }, [entries, STORAGE_KEY]);

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
      lowEnergy: !!lowEnergy,
    };

    setEntries((prev) => [entry, ...prev]);
    setText("");
    setTitle("");
  };

    return (
    <SubcategoryShell
      category={category}
      subcategory={subcategory}
      onBack={onBack}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      summaryLabel="Monthly Fragments"
      summaryValue={`${entriesThisMonth} / ${monthlyGoal}`}
      historyEntries={entries}
      historyTheme="air"
      tokenModalContent={tokenModalContent}
      onRequestEditEntry={(entry) => {
        setEditingEntry(entry);
        setActiveTab(TAB_INPUT);
      }}

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

      <div className="journal-field">
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

function JournalTrackerTab({ entries, stats, subcategory }) {
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
      {/* Top summary row */}
      <div className="tracker-grid">
        <div className="tracker-card">
          <div className="tracker-label">Fragments logged</div>
          <div className="tracker-value">
            {totalFragments}
            <span className="tracker-unit"> fragments</span>
          </div>
          <div className="tracker-sub">
            ≈ {totalStarsApprox.toFixed(1)} stars
          </div>
        </div>

        <div className="tracker-card">
          <div className="tracker-label">Entries logged</div>
          <div className="tracker-value">
            {totalEntries}
            <span className="tracker-unit"> entries</span>
          </div>
          <div className="tracker-sub">
            Avg length: {avgChars} chars
          </div>
        </div>
      </div>

      <div className="tracker-card">
        <div className="tracker-label">Low-energy entries</div>
        <div className="tracker-value">
          {lowEnergyCount}
          <span className="tracker-unit"> entries</span>
        </div>
        <div className="tracker-sub">
          Days you marked as low-energy.
        </div>
      </div>
     
      {/* Time-of-day pattern */}
      <div className="tracker-section">
        <div className="tracker-section-title">Time-of-day pattern</div>

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
        <div className="tracker-section-title">Entry length</div>
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

function computeJournalStats(entries) {
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

// src/App.jsx
import React, { useMemo, useState, useEffect } from "react";
import "./App.css";
import "./styles/journal.css";
import CategoryCard from "./components/CategoryCard";
import Sidebar from "./components/Sidebar";
import SubcategoryPage from "./components/SubcategoryShell";
import JournalSubcategoryPage from "./components/JournalSubcategoryPage";
import TherapySubcategoryPage from "./components/TherapySubcategoryPage";
import MeditationReadingSubcategoryPage from "./components/MeditationReadingSubcategoryPage";
import Constellation from "./components/Constellation";
import "./styles/variables.css";
import "./styles/base.css";
import "./styles/layout.css";
import "./styles/subcategory.css";
import "./styles/journal.css";

// --- Temporary demo data ---
// Later we'll load this from your real JSON (stars + tokens per domain).
const getInitialDashboardData = () => ({
  mind: {
    id: "mind",
    label: "Mind",
    element: "Air",
    color: "#f5f5f8", // soft cloud-white
    totalStars: 27.4,
    tokens: 3,
    soul: "Orrie",
    subcategories: [
      {
        id: "journal",
        label: "Journal",
        currentStars: 14,
        monthMaxStars: 93,
        fragmentsPerDay: 0.6, // up to 3/5
        completedToday: false,
        starHistory: [], // will be computed dynamically
      },
      {
        id: "therapy",
        label: "Therapy",
        currentStars: 6,            // 6 fragments = 3 half-stars = 3 sessions
        monthMaxStars: 6,
        fragmentsPerDay: 0.5,       // 0.5 star per session
        completedToday: true,
        starHistory: [
          {
            // first star: full, both halves earned without tokens
            halves: ["gold", "gold"],
          },
          {
            // second star: full, token used on the second half
            halves: ["gold", "silver"],
          },
          {
            // current star: only first half earned so far (one session)
            halves: ["gold"],       // second half missing → partial star
          },
        ],
      },
      {
        id: "meditation",
        label: "Meditation / Reading",
        currentStars: 7.4,
        monthMaxStars: 24,
        fragmentsPerDay: 0.5,
        completedToday: false,
        starHistory: [
          { fraction: 0.5, usedToken: false },
          { fraction: 0.0, usedToken: false },
          { fraction: 0.0, usedToken: false },
          { fraction: 0.5, usedToken: false },
        ],
      },
    ],
  },
  body: {
    id: "body",
    label: "Body",
    element: "Earth",
    color: "#9fcf70", // softer earth green
    totalStars: 31.2,
    tokens: 4,
    soul: "Thal",
    subcategories: [
      {
        id: "movement",
        label: "Movement",
        currentStars: 18.2,
        monthMaxStars: 93,
        fragmentsPerDay: 0.6,
        completedToday: true,
        starHistory: [
          { fraction: 0.6, usedToken: false },
          { fraction: 0.4, usedToken: false },
          { fraction: 0.2, usedToken: false },
          { fraction: 0.6, usedToken: true },
          { fraction: 0.0, usedToken: false },
        ],
      },
      {
        id: "nourish",
        label: "Nourish",
        currentStars: 7.2,
        monthMaxStars: 31,
        fragmentsPerDay: 0.2,
        completedToday: false,
        starHistory: [
          { fraction: 0.2, usedToken: false },
          { fraction: 0.2, usedToken: true },
          { fraction: 0.0, usedToken: false },
        ],
      },
      {
        id: "hygiene",
        label: "Hygiene",
        currentStars: 5.8,
        monthMaxStars: 31,
        fragmentsPerDay: 0.2,
        completedToday: true,
        starHistory: [
          { fraction: 0.2, usedToken: false },
          { fraction: 0.0, usedToken: false },
          { fraction: 0.2, usedToken: false },
          { fraction: 0.2, usedToken: true },
        ],
      },
    ],
  },
  will: {
    id: "will",
    label: "Will",
    element: "Fire",
    color: "#ff9566", // softer ember
    totalStars: 43.1,
    tokens: 5,
    soul: "Cael",
    subcategories: [
      {
        id: "school",
        label: "School Work",
        currentStars: 16.5,
        monthMaxStars: 40,
        fragmentsPerDay: 0.5,
        completedToday: false,
        starHistory: [
          { fraction: 0.5, usedToken: false },
          { fraction: 0.5, usedToken: false },
          { fraction: 0.0, usedToken: false },
        ],
      },
      {
        id: "grades",
        label: "Good Grades",
        currentStars: 10,
        monthMaxStars: 10,
        fragmentsPerDay: 10,
        completedToday: false,
        starHistory: [{ fraction: 1, usedToken: false }],
      },
      {
        id: "extended",
        label: "Extended Learning",
        currentStars: 6.6,
        monthMaxStars: 48,
        fragmentsPerDay: 0.4,
        completedToday: true,
        starHistory: [
          { fraction: 0.4, usedToken: false },
          { fraction: 0.4, usedToken: true },
          { fraction: 0.4, usedToken: false },
        ],
      },
      {
        id: "projects",
        label: "Projects",
        currentStars: 6.6,
        monthMaxStars: 31,
        fragmentsPerDay: 0.2,
        completedToday: true,
        starHistory: [
          { fraction: 0.2, usedToken: false },
          { fraction: 0.2, usedToken: false },
          { fraction: 0.2, usedToken: true },
          { fraction: 0.0, usedToken: false },
        ],
      },
    ],
  },
  spirit: {
    id: "spirit",
    label: "Spirit",
    element: "Water",
    color: "#9ac3f1", // softer water blue
    totalStars: 28.7,
    tokens: 2,
    soul: "Ky",
    subcategories: [
      {
        id: "mirror",
        label: "Mirror Work",
        currentStars: 8.2,
        monthMaxStars: 31,
        fragmentsPerDay: 0.2,
        completedToday: false,
        starHistory: [
          { fraction: 0.2, usedToken: false },
          { fraction: 0.0, usedToken: false },
          { fraction: 0.2, usedToken: false },
          { fraction: 0.2, usedToken: true },
        ],
      },
      {
        id: "chores",
        label: "Chores",
        currentStars: 12.4,
        monthMaxStars: 62,
        fragmentsPerDay: 0.4,
        completedToday: true,
        starHistory: [
          { fraction: 0.2, usedToken: false },
          { fraction: 0.4, usedToken: false },
          { fraction: 0.0, usedToken: false },
          { fraction: 0.4, usedToken: true },
        ],
      },
      {
        id: "soulcare",
        label: "Soul Care",
        currentStars: 8.1,
        monthMaxStars: 31,
        fragmentsPerDay: 0.2,
        completedToday: false,
        starHistory: [
          { fraction: 0.2, usedToken: false },
          { fraction: 0.0, usedToken: false },
          { fraction: 0.0, usedToken: false },
        ],
      },
    ],
  },
});

// Function to compute starHistory for journal subcategory
function computeJournalStarHistory(categoryId, subcategoryId) {
  const STORAGE_KEY = `journalEntries:${categoryId}:${subcategoryId}`;
  const TOKEN_STORAGE_KEY = `journalTokens:${categoryId}:${subcategoryId}`;

  const entries = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const tokens = JSON.parse(localStorage.getItem(TOKEN_STORAGE_KEY) || '[]');

  const timeOrder = { morning: 1, afternoon: 2, evening: 3 };

  // Earn at most one fragment per (dateKey + timeOfDay)
  // Prefer gold if any entry exists for that slot; otherwise silver if any token exists.
  const slotMap = new Map();

  entries.forEach((e) => {
    if (!e?.dateKey || !e?.timeOfDay) return;
    const key = `${e.dateKey}__${e.timeOfDay}`;
    slotMap.set(key, {
      dateKey: e.dateKey,
      timeOfDay: e.timeOfDay,
      fillType: 'gold',
    });
  });

  tokens.forEach((t) => {
    if (!t?.dateKey || !t?.timeOfDay) return;
    const key = `${t.dateKey}__${t.timeOfDay}`;
    // Only set silver if there isn't already a gold entry for this slot
    if (!slotMap.has(key)) {
      slotMap.set(key, {
        dateKey: t.dateKey,
        timeOfDay: t.timeOfDay,
        fillType: 'silver',
      });
    }
  });

  const earnedSlots = Array.from(slotMap.values()).sort((a, b) => {
    if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
    return (timeOrder[a.timeOfDay] || 0) - (timeOrder[b.timeOfDay] || 0);
  });

  const patterns = [
    // Segment order must match StarStrip's SEGMENT_INDICES order.
    // Each new entry/token fills the next segment, repeating every 5 events.
    [0, 1, 2, 3],
    [0, 3, 4, 5],
    [0, 5, 6, 7],
    [0, 7, 8, 9],
    [0, 9, 10, 1],
  ];

  const starHistory = [];
  // 5 wedges per star; we fill sequentially by earned slot events
  let currentStarFragments = new Array(5).fill(undefined);

  earnedSlots.forEach((slot, index) => {
    const segmentIndex = index % 5;
    currentStarFragments[segmentIndex] = slot.fillType;

    // Every 5 events, push the star and reset
    if ((index + 1) % 5 === 0) {
      starHistory.push({ fragments: [...currentStarFragments] });
      currentStarFragments = new Array(5).fill(undefined);
    }
  });

  // Push any remaining partial star
  if (currentStarFragments.some(f => f !== undefined)) {
    starHistory.push({ fragments: currentStarFragments });
  }

  return {
    starHistory,
    fragmentsEarned: earnedSlots.length,
  };
}

function computeStarsFromStarHistory(starHistory) {
  const history = Array.isArray(starHistory) ? starHistory : [];
  let total = 0;

  history.forEach((entry) => {
    if (entry && Array.isArray(entry.fragments)) {
      const frags = entry.fragments.slice(0, 5);
      const filled = frags.filter((v) => v === "gold" || v === "silver").length;
      total += Math.max(0, Math.min(1, filled / 5));
      return;
    }

    if (entry && Array.isArray(entry.halves)) {
      const halves = entry.halves.slice(0, 2);
      const filled = halves.filter((v) => v === "gold" || v === "silver").length;
      total += Math.max(0, Math.min(1, filled / 2));
      return;
    }

    if (typeof entry === "number") {
      total += Math.max(0, Math.min(1, entry));
      return;
    }

    if (entry && typeof entry === "object" && typeof entry.fraction === "number") {
      total += Math.max(0, Math.min(1, entry.fraction));
    }
  });

  return total;
}

function computeJournalCompletedToday(categoryId, subcategoryId) {
  const STORAGE_KEY = `journalEntries:${categoryId}:${subcategoryId}`;
  const entriesRaw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  const entries = Array.isArray(entriesRaw) ? entriesRaw : [];

  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const todayKey = `${yyyy}-${mm}-${dd}`;

  const required = new Set(["morning", "afternoon", "evening"]);
  const seen = new Set();

  entries.forEach((e) => {
    if (!e || typeof e !== "object") return;
    if (e.dateKey !== todayKey) return;
    const t = String(e.timeOfDay || "").toLowerCase();
    if (required.has(t)) seen.add(t);
  });

  return seen.size === required.size;
}

// Therapy: each attended appointment earns 1/2 star.
function computeTherapyStarHistory(categoryId, subcategoryId) {
  const APPT_KEY = `therapyAppointments:${categoryId}:${subcategoryId}`;
  const appointments = JSON.parse(localStorage.getItem(APPT_KEY) || "[]");

  const TOK_KEY = `therapyTokens:${categoryId}:${subcategoryId}`;
  const tokenUsesRaw = JSON.parse(localStorage.getItem(TOK_KEY) || "[]");
  const tokenUses = Array.isArray(tokenUsesRaw) ? tokenUsesRaw : [];

  const attended = appointments
    .filter(
      (a) =>
        a &&
        a.status === "attended" &&
        typeof a?.dateKey === "string"
    )
    .sort((a, b) => {
      const aT = a.attendedAt || a.dateKey || "";
      const bT = b.attendedAt || b.dateKey || "";
      return String(aT).localeCompare(String(bT));
    });

  const events = [];
  attended.forEach((a) => {
    const t = a.attendedAt || a.dateKey || "";
    if (!t) return;
    events.push({ t, color: "gold" });
  });

  tokenUses.forEach((u) => {
    const t = u?.createdAt || u?.dateKey || "";
    if (!t) return;
    events.push({ t, color: "silver" });
  });

  events.sort((a, b) => String(a.t).localeCompare(String(b.t)));

  // 1 event = 1 half-star fragment (gold = attended, silver = token)
  const halvesEarned = Math.max(0, events.length);
  const starHistory = [];

  let currentHalves = [];
  for (let i = 0; i < halvesEarned; i++) {
    currentHalves.push(events[i].color);

    if (currentHalves.length === 2) {
      starHistory.push({ halves: [...currentHalves] });
      currentHalves = [];
    }
  }

  if (currentHalves.length) {
    starHistory.push({ halves: [...currentHalves] });
  }

  return {
    starHistory,
    currentStars: halvesEarned / 2,
  };
}

function computeMeditationReadingStarHistory(categoryId, subcategoryId) {
  const STORAGE_KEY = `meditationReadingEntries:${categoryId}:${subcategoryId}`;
  const entriesRaw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  const entries = Array.isArray(entriesRaw) ? entriesRaw : [];

  const sortedEntries = entries
    .slice()
    .sort((a, b) => String(a?.createdAt || "").localeCompare(String(b?.createdAt || "")));

  const halfColors = [];
  let totalHalves = 0;

  for (const e of sortedEntries) {
    const awarded = typeof e?.starsAwarded === "number" ? e.starsAwarded : 0;
    const halves = Number.isFinite(awarded) ? Math.round(awarded * 2) : 0;
    if (halves <= 0) continue;

    for (let i = 0; i < halves; i += 1) {
      halfColors.push(e?.usedToken ? "silver" : "gold");
      totalHalves += 1;
    }
  }

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
    currentStars: totalHalves / 2,
  };
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // null = show dashboard
  // otherwise: { categoryId, subcategoryId }
  const [activeSubcategory, setActiveSubcategory] = useState(null);

  // null = not viewing constellations
  const [activeConstellationsCategoryId, setActiveConstellationsCategoryId] = useState(null);
  
  // 🔹 global low-energy flag for *today*
  const [lowEnergy, setLowEnergy] = useState(false);

  const [dashboardData, setDashboardData] = useState(() => {
    const initial = getInitialDashboardData();
    // Compute journal starHistory
    const journal = initial.mind.subcategories.find((s) => s.id === "journal");
    if (journal) {
      const { starHistory, fragmentsEarned } = computeJournalStarHistory("mind", "journal");
      journal.starHistory = starHistory;
      journal.currentStars = computeStarsFromStarHistory(starHistory);
      journal.currentFragments = fragmentsEarned;
      journal.completedToday = computeJournalCompletedToday("mind", "journal");
    }

    const therapy = initial.mind.subcategories.find((s) => s.id === "therapy");
    if (therapy) {
      const { starHistory, currentStars } = computeTherapyStarHistory("mind", "therapy");
      therapy.starHistory = starHistory;
      therapy.currentStars = currentStars;
      therapy.monthMaxStars = 1;
    }

    const meditation = initial.mind.subcategories.find((s) => s.id === "meditation");
    if (meditation) {
      const { starHistory, currentStars } = computeMeditationReadingStarHistory("mind", "meditation");
      meditation.starHistory = starHistory;
      meditation.currentStars = currentStars;
      meditation.monthMaxStars = 2;
    }
    return initial;
  });

  // Update journal starHistory when component mounts or when returning to dashboard
  useEffect(() => {
    if (!activeSubcategory) {
      setDashboardData(prev => {
        const updated = { ...prev };
        const journal = updated.mind.subcategories.find((s) => s.id === "journal");
        if (journal) {
          const { starHistory, fragmentsEarned } = computeJournalStarHistory("mind", "journal");
          journal.starHistory = starHistory;
          journal.currentStars = computeStarsFromStarHistory(starHistory);
          journal.currentFragments = fragmentsEarned;
          journal.completedToday = computeJournalCompletedToday("mind", "journal");
        }

        const therapy = updated.mind.subcategories.find((s) => s.id === "therapy");
        if (therapy) {
          const { starHistory, currentStars } = computeTherapyStarHistory("mind", "therapy");
          therapy.starHistory = starHistory;
          therapy.currentStars = currentStars;
          therapy.monthMaxStars = 1;
        }

        const meditation = updated.mind.subcategories.find((s) => s.id === "meditation");
        if (meditation) {
          const { starHistory, currentStars } = computeMeditationReadingStarHistory("mind", "meditation");
          meditation.starHistory = starHistory;
          meditation.currentStars = currentStars;
          meditation.monthMaxStars = 2;
        }
        return updated;
      });
    }
  }, [activeSubcategory]);

  // Live-refresh journal stars whenever entries/tokens change
  useEffect(() => {
    const handler = (ev) => {
      const detail = ev?.detail;
      if (!detail || detail.categoryId !== 'mind' || detail.subcategoryId !== 'journal') return;

      setDashboardData((prev) => {
        const updated = { ...prev };
        const { starHistory: nextStarHistory, fragmentsEarned } = computeJournalStarHistory('mind', 'journal');
        updated.mind.subcategories[0].starHistory = nextStarHistory;
        updated.mind.subcategories[0].currentStars = computeStarsFromStarHistory(nextStarHistory);
        updated.mind.subcategories[0].currentFragments = fragmentsEarned;
        updated.mind.subcategories[0].completedToday = computeJournalCompletedToday('mind', 'journal');
        return updated;
      });
    };

    window.addEventListener('journal-data-changed', handler);
    return () => window.removeEventListener('journal-data-changed', handler);
  }, []);

  useEffect(() => {
    const handler = (ev) => {
      const detail = ev?.detail;
      if (!detail || detail.categoryId !== "mind" || detail.subcategoryId !== "meditation") return;

      setDashboardData((prev) => {
        const updated = { ...prev };
        const meditation = updated.mind.subcategories.find((s) => s.id === "meditation");
        if (!meditation) return prev;
        const { starHistory, currentStars } = computeMeditationReadingStarHistory("mind", "meditation");
        meditation.starHistory = starHistory;
        meditation.currentStars = currentStars;
        meditation.monthMaxStars = 2;
        return updated;
      });
    };

    window.addEventListener("meditation-reading-data-changed", handler);
    return () => window.removeEventListener("meditation-reading-data-changed", handler);
  }, []);

  // Live-refresh therapy stars whenever appointments change
  useEffect(() => {
    const handler = (ev) => {
      const detail = ev?.detail;
      if (!detail || detail.categoryId !== "mind" || detail.subcategoryId !== "therapy") return;

      setDashboardData((prev) => {
        const updated = { ...prev };
        const therapy = updated.mind.subcategories.find((s) => s.id === "therapy");
        if (!therapy) return prev;

        const { starHistory, currentStars } = computeTherapyStarHistory("mind", "therapy");
        therapy.starHistory = starHistory;
        therapy.currentStars = currentStars;
        return updated;
      });
    };

    window.addEventListener("therapy-data-changed", handler);
    return () => window.removeEventListener("therapy-data-changed", handler);
  }, []);

  const handleOpenSubcategory = (categoryId, subcategoryId) => {
    setActiveSubcategory({ categoryId, subcategoryId });
  };

  const handleBackToDashboard = () => {
    setActiveSubcategory(null);
    setActiveConstellationsCategoryId(null);
  };

  const mindConstellations = useMemo(
    () => [
      { name: "Lyra", starCount: 6, slug: "lyra" },
      { name: "Aquarius", starCount: 14, slug: "aquarius" },
      { name: "Cepheus", starCount: 5, slug: "cepheus" },
      { name: "Libra", starCount: 6, slug: "libra" },
      { name: "Cygnus", starCount: 9, slug: "cygnus" },
      { name: "Canes Venatici", starCount: 2, slug: "canes-venatici" },
      { name: "Triangulum", starCount: 3, slug: "triangulum" },
      { name: "Serpens", starCount: 7, slug: "serpens" },
      { name: "Vulpecula", starCount: 5, slug: "vulpecula" },
      { name: "Delphinus", starCount: 5, slug: "delphinus" },
      { name: "Pegasus", starCount: 13, slug: "pegasus" },
      { name: "Lacerta", starCount: 9, slug: "lacerta" },
    ],
    []
  );

  const bodyConstellations = useMemo(
    () => [
      { name: "Taurus", starCount: 11, slug: "taurus" },
      { name: "Capricornus", starCount: 9, slug: "capricornus" },
      { name: "Virgo", starCount: 14, slug: "virgo" },
      { name: "Auriga", starCount: 5, slug: "auriga" },
      { name: "Hercules", starCount: 19, slug: "hercules" },
      { name: "Puppis", starCount: 9, slug: "puppis" },
      { name: "Centaurus", starCount: 15, slug: "centaurus" },
      { name: "Corvus", starCount: 5, slug: "corvus" },
      { name: "Lupus", starCount: 9, slug: "lupus" },
      { name: "Pisces", starCount: 16, slug: "pisces" },
      { name: "Chamaeleon", starCount: 4, slug: "chamaeleon" },
      { name: "Camelopardalis", starCount: 4, slug: "camelopardalis" },
    ],
    []
  );

  const constellationsByCategory = useMemo(
    () => ({
      mind: mindConstellations,
      body: bodyConstellations,
      will: [],
      spirit: [],
    }),
    [mindConstellations, bodyConstellations]
  );

  const handleSidebarNavigate = (target) => {
    const t = String(target || "");
    if (t.startsWith("constellations/")) {
      const categoryId = t.split("/")[1] || "";
      if (categoryId) {
        setActiveSubcategory(null);
        setActiveConstellationsCategoryId(categoryId);
      }
      return;
    }
  };

  // Constellations view
  if (activeConstellationsCategoryId) {
    const category = dashboardData[activeConstellationsCategoryId];
    const list = constellationsByCategory[activeConstellationsCategoryId] || [];
    return (
      <div className="app-shell">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={handleSidebarNavigate} />
        <Constellation
          category={category}
          constellations={list}
          onBack={handleBackToDashboard}
        />
      </div>
    );
  }

  // If a subcategory is active, render its page instead of the dashboard
  if (activeSubcategory) {
    const { categoryId, subcategoryId } = activeSubcategory;
    const category = dashboardData[categoryId];
    const subcategory = category.subcategories.find(
      (s) => s.id === subcategoryId
    );

    if (!category || !subcategory) {
      // Fallback in case of bad IDs
      return (
        <div className="app-shell">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={handleSidebarNavigate} />
          <header className="app-header">
            <button
              className="sidebar-toggle"
              type="button"
              onClick={() => setSidebarOpen(true)}
            >
              ☰
            </button>
            <div className="title-block">
              <h1 className="app-title">New Year Sky</h1>
              <p className="app-subtitle">
                Stars, constellations, and rest woven into one map.
              </p>
            </div>
          </header>
          <main className="app-main">
            <p className="error-text">
              Could not load this tracker.{" "}
              <button
                type="button"
                className="link-button"
                onClick={handleBackToDashboard}
              >
                Return to dashboard
              </button>
            </p>
          </main>
        </div>
      );
    }

    // Mind → Journal uses the dedicated journal page (with lowEnergy tracking)
    if (categoryId === "mind" && subcategoryId === "journal") {
      return (
        <div className="app-shell">
          <Sidebar
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            onNavigate={handleSidebarNavigate}
          />
          <JournalSubcategoryPage
            category={category}
            subcategory={subcategory}
            onBack={handleBackToDashboard}
            lowEnergy={lowEnergy}
          />
        </div>
      );
    }

    // Mind → Therapy uses its own page
    if (categoryId === "mind" && subcategoryId === "therapy") {
      return (
        <div className="app-shell">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={handleSidebarNavigate} />
          <TherapySubcategoryPage
            category={category}
            subcategory={subcategory}
            onBack={handleBackToDashboard}
            lowEnergy={lowEnergy}
          />
        </div>
      );
    }

    if (categoryId === "mind" && subcategoryId === "meditation") {
      return (
        <div className="app-shell">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={handleSidebarNavigate} />
          <MeditationReadingSubcategoryPage
            category={category}
            subcategory={subcategory}
            onBack={handleBackToDashboard}
            lowEnergy={lowEnergy}
          />
        </div>
      );
    }

    // All other subcategories use the generic shell for now
    return (
      <div className="app-shell">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={handleSidebarNavigate} />
        <SubcategoryPage
          category={category}
          subcategory={subcategory}
          onBack={handleBackToDashboard}
        />
      </div>
    );
  }

    // Dashboard view
    return (
      <div className="app-shell">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={handleSidebarNavigate} />

              <header className="app-header">
                <button
                  className="sidebar-toggle"
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                >
                  ☰
                </button>

                <div className="title-block">
                  <h1 className="app-title">Stellara</h1>
                </div>

                {/* 🔹 Low-energy toggle lives in the header on the right */}
                <button
                  type="button"
                  className={`low-energy-toggle ${lowEnergy ? "is-on" : ""}`}
                  onClick={() => setLowEnergy((prev) => !prev)}
                >
                  <span className="low-energy-dot" />
                  <span className="low-energy-label">
                    {lowEnergy ? "Low-energy day" : "Normal energy"}
                  </span>
                </button>
              </header>

        <main className="app-main">
          {Object.values(dashboardData).map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              onOpenSubcategory={handleOpenSubcategory}
            />
          ))}
        </main>
      </div>
    );
}

export default App;
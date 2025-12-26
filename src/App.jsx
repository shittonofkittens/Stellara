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
import MovementSubcategoryPage from "./components/MovementSubcategoryPage";
import NourishSubcategoryPage from "./components/NourishSubcategoryPage";
import HygieneSubcategoryPage from "./components/HygieneSubcategoryPage";
import SchoolWorkSubcategoryPage from "./components/SchoolWorkSubcategoryPage";
import GoodGradesSubcategoryPage from "./components/GoodGradesSubcategoryPage";
import ExtendedLearningSubcategoryPage from "./components/ExtendedLearningSubcategoryPage";
import ProjectsSubcategoryPage from "./components/ProjectsSubcategoryPage";
import MirrorWorkSubcategoryPage from "./components/MirrorWorkSubcategoryPage";
import ChoresSubcategoryPage from "./components/ChoresSubcategoryPage";
import SoulCareSubcategoryPage from "./components/SoulCareSubcategoryPage";
import AnchorDaysSubcategoryPage from "./components/AnchorDaysSubcategoryPage";
import Constellation from "./components/Constellation";
import nourishIngredients from "../data/nourish-ingredients.json";
import { buildNourishStarHistory } from "./utils/nourish";
import { buildHygieneStarHistory } from "./utils/hygiene";
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
      {
        id: "anchor",
        label: "Anchor Days",
        currentStars: 0,
        monthMaxStars: 4,
        fragmentsPerDay: 0.5,
        completedToday: false,
        starHistory: [],
      },
    ],
  },
});

function getTodayKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getMonthKey() {
  return getTodayKey().slice(0, 7);
}

function daysInMonthFromMonthKey(monthKey) {
  const [yyyy, mm] = String(monthKey || "").split("-");
  const y = Number(yyyy);
  const m = Number(mm);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return 0;
  return new Date(y, m, 0).getDate();
}

function sumMapValuesByPrefix(map, prefix) {
  let sum = 0;
  for (const [k, v] of map || []) {
    if (!String(k).startsWith(prefix)) continue;
    const n = Number(v);
    if (Number.isFinite(n)) sum += n;
  }
  return sum;
}

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

function computeJournalMonthlyFragments(categoryId, subcategoryId, monthKey) {
  const STORAGE_KEY = `journalEntries:${categoryId}:${subcategoryId}`;
  const TOKEN_STORAGE_KEY = `journalTokens:${categoryId}:${subcategoryId}`;

  const entries = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  const tokens = JSON.parse(localStorage.getItem(TOKEN_STORAGE_KEY) || "[]");

  const slotMap = new Map();

  (Array.isArray(entries) ? entries : []).forEach((e) => {
    if (!e?.dateKey || !e?.timeOfDay) return;
    if (!String(e.dateKey).startsWith(monthKey)) return;
    const key = `${e.dateKey}__${e.timeOfDay}`;
    slotMap.set(key, true);
  });

  (Array.isArray(tokens) ? tokens : []).forEach((t) => {
    if (!t?.dateKey || !t?.timeOfDay) return;
    if (!String(t.dateKey).startsWith(monthKey)) return;
    const key = `${t.dateKey}__${t.timeOfDay}`;
    slotMap.set(key, true);
  });

  return slotMap.size;
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
  const TOKEN_STORAGE_KEY = `journalTokens:${categoryId}:${subcategoryId}`;
  const entriesRaw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  const entries = Array.isArray(entriesRaw) ? entriesRaw : [];

  const tokensRaw = JSON.parse(localStorage.getItem(TOKEN_STORAGE_KEY) || "[]");
  const tokens = Array.isArray(tokensRaw) ? tokensRaw : [];

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

  tokens.forEach((t) => {
    if (!t || typeof t !== "object") return;
    if (t.dateKey !== todayKey) return;
    const tod = String(t.timeOfDay || "").toLowerCase();
    if (required.has(tod)) seen.add(tod);
  });

  return seen.size === required.size;
}

function computeTherapyMonthlyFragments(categoryId, subcategoryId, monthKey) {
  const APPT_KEY = `therapyAppointments:${categoryId}:${subcategoryId}`;
  const TOK_KEY = `therapyTokens:${categoryId}:${subcategoryId}`;
  const appointmentsRaw = JSON.parse(localStorage.getItem(APPT_KEY) || "[]");
  const appointments = Array.isArray(appointmentsRaw) ? appointmentsRaw : [];
  const tokenUsesRaw = JSON.parse(localStorage.getItem(TOK_KEY) || "[]");
  const tokenUses = Array.isArray(tokenUsesRaw) ? tokenUsesRaw : [];

  const attended = appointments.filter(
    (a) => a?.status === "attended" && typeof a?.dateKey === "string" && a.dateKey.startsWith(monthKey)
  ).length;
  const tokens = tokenUses.filter((u) => typeof u?.dateKey === "string" && u.dateKey.startsWith(monthKey)).length;
  return attended + tokens;
}

function computeMeditationMonthlyFragments(categoryId, subcategoryId, monthKey) {
  const STORAGE_KEY = `meditationReadingEntries:${categoryId}:${subcategoryId}`;
  const entriesRaw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  const entries = Array.isArray(entriesRaw) ? entriesRaw : [];

  const monthEntries = entries.filter((e) => typeof e?.dateKey === "string" && e.dateKey.startsWith(monthKey));
  const hasReading = monthEntries.some((e) => e?.kind === "reading");
  if (hasReading) return 4;
  const meditationCount = monthEntries.filter((e) => e?.kind === "meditation").length;
  return Math.max(0, Math.min(4, meditationCount));
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

function computeMovementStarHistory(categoryId, subcategoryId) {
  const ENTRY_KEY = `movementEntries:${categoryId}:${subcategoryId}`;
  const TOKEN_KEY = `movementTokens:${categoryId}:${subcategoryId}`;

  const entriesRaw = JSON.parse(localStorage.getItem(ENTRY_KEY) || "[]");
  const entries = Array.isArray(entriesRaw) ? entriesRaw : [];

  const tokensRaw = JSON.parse(localStorage.getItem(TOKEN_KEY) || "[]");
  const tokenUses = Array.isArray(tokensRaw) ? tokensRaw : [];

  const normalizeStrengthRows = (rows) => {
    const list = Array.isArray(rows) ? rows : [];
    return list
      .map((r) => ({
        exercise: typeof r?.exercise === "string" ? r.exercise : "",
        scheme: typeof r?.scheme === "string" ? r.scheme : "",
      }))
      .filter((r) => r.exercise.trim() || r.scheme.trim());
  };

  const listExerciseEventsForEntry = (entry) => {
    const type = String(entry?.movementType || "");
    if (type === "strength") return [{ usedToken: false }];
    if (type === "yoga") return [{ usedToken: false }];
    if (type === "walking") return [{ usedToken: false }];
    return [{ usedToken: false }];
  };

  const all = [];

  entries.forEach((e) => {
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

  tokenUses.forEach((t) => {
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
    const used = countedByDay.get(ev.dateKey) || 0;
    if (used >= 3) continue;
    countedByDay.set(ev.dateKey, used + 1);
    credited.push(ev);
  }

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
    currentStars: computeStarsFromStarHistory(starHistory),
    creditedByDay: countedByDay,
  };
}

function computeMovementCompletedToday(categoryId, subcategoryId) {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const todayKey = `${yyyy}-${mm}-${dd}`;

  const { creditedByDay } = computeMovementStarHistory(categoryId, subcategoryId);
  return (creditedByDay.get(todayKey) || 0) >= 3;
}

function computeNourishStarHistory(categoryId, subcategoryId) {
  const ENTRY_KEY = `nourishEntries:${categoryId}:${subcategoryId}`;
  const WATER_KEY = `nourishWater:${categoryId}:${subcategoryId}`;
  const TOKEN_KEY = `nourishTokens:${categoryId}:${subcategoryId}`;

  const mealsRaw = JSON.parse(localStorage.getItem(ENTRY_KEY) || "[]");
  const mealEntries = Array.isArray(mealsRaw) ? mealsRaw : [];

  const waterRaw = JSON.parse(localStorage.getItem(WATER_KEY) || "[]");
  const waterEvents = Array.isArray(waterRaw) ? waterRaw : [];

  const tokensRaw = JSON.parse(localStorage.getItem(TOKEN_KEY) || "[]");
  const tokenUses = Array.isArray(tokensRaw) ? tokensRaw : [];

  const proteinKeywords = Array.isArray(nourishIngredients?.protein) ? nourishIngredients.protein : [];
  const fiberKeywords = Array.isArray(nourishIngredients?.fiber) ? nourishIngredients.fiber : [];

  const derived = buildNourishStarHistory({
    mealEntries,
    waterEvents,
    tokenUses,
    proteinKeywords,
    fiberKeywords,
    waterGoalOz: 50,
  });

  return {
    starHistory: derived.starHistory,
    creditedByDay: derived.creditedByDay,
  };
}

function computeNourishCompletedToday(categoryId, subcategoryId) {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const todayKey = `${yyyy}-${mm}-${dd}`;

  const { creditedByDay } = computeNourishStarHistory(categoryId, subcategoryId);
  return creditedByDay?.has(todayKey) || false;
}

function computeHygieneStarHistory(categoryId, subcategoryId) {
  const ENTRY_KEY = `hygieneEntries:${categoryId}:${subcategoryId}`;
  const TOKEN_KEY = `hygieneTokens:${categoryId}:${subcategoryId}`;

  const entriesRaw = JSON.parse(localStorage.getItem(ENTRY_KEY) || "[]");
  const entries = Array.isArray(entriesRaw) ? entriesRaw : [];

  const tokensRaw = JSON.parse(localStorage.getItem(TOKEN_KEY) || "[]");
  const tokenUses = Array.isArray(tokensRaw) ? tokensRaw : [];

  const derived = buildHygieneStarHistory({ entries, tokenUses, tasksPerDay: 2 });
  return {
    starHistory: derived.starHistory,
    creditedByDay: derived.creditedByDay,
  };
}

function computeHygieneCompletedToday(categoryId, subcategoryId) {
  const todayKey = getTodayKey();
  const { creditedByDay } = computeHygieneStarHistory(categoryId, subcategoryId);
  return creditedByDay?.has(todayKey) || false;
}

function computeWillSchoolStarHistory(categoryId, subcategoryId) {
  const ENTRY_KEY = `willSchoolEntries:${categoryId}:${subcategoryId}`;
  const TOKEN_KEY = `willSchoolTokens:${categoryId}:${subcategoryId}`;
  const entriesRaw = JSON.parse(localStorage.getItem(ENTRY_KEY) || "[]");
  const entries = Array.isArray(entriesRaw) ? entriesRaw : [];

  const tokensRaw = JSON.parse(localStorage.getItem(TOKEN_KEY) || "[]");
  const tokenUses = Array.isArray(tokensRaw) ? tokensRaw : [];

  const MINUTES_REQUIRED = 60;

  const minutesByDay = new Map();
  entries.forEach((e) => {
    const dk = typeof e?.dateKey === "string" ? e.dateKey : "";
    if (!dk) return;
    const mins = typeof e?.minutesSpent === "number" && Number.isFinite(e.minutesSpent) ? e.minutesSpent : 0;
    const used = minutesByDay.get(dk) || 0;
    minutesByDay.set(dk, used + Math.max(0, Math.trunc(mins)));
  });

  const tokenDays = new Set();
  tokenUses.forEach((t) => {
    const dk = typeof t?.dateKey === "string" ? t.dateKey : "";
    if (dk) tokenDays.add(dk);
  });

  const daySet = new Set([...minutesByDay.keys(), ...tokenDays]);
  const days = [...daySet].sort((a, b) => String(a).localeCompare(String(b)));

  // Cap: 1 half-star per day (credited only when minutes >= 60, or token used).
  const creditedByDay = new Map();
  const halfColors = [];

  for (const dk of days) {
    const mins = minutesByDay.get(dk) || 0;
    const eligible = mins >= MINUTES_REQUIRED;
    const hasToken = tokenDays.has(dk);
    if (!eligible && !hasToken) continue;
    creditedByDay.set(dk, 1);
    halfColors.push(eligible ? "gold" : "silver");
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
    currentStars: halfColors.length / 2,
    creditedByDay,
  };
}

function computeWillExtendedLearningStarHistory(categoryId, subcategoryId) {
  const ENTRY_KEY = `willExtendedEntries:${categoryId}:${subcategoryId}`;
  const TOKEN_KEY = `willExtendedTokens:${categoryId}:${subcategoryId}`;

  const entriesRaw = JSON.parse(localStorage.getItem(ENTRY_KEY) || "[]");
  const entries = Array.isArray(entriesRaw) ? entriesRaw : [];

  const tokensRaw = JSON.parse(localStorage.getItem(TOKEN_KEY) || "[]");
  const tokenUses = Array.isArray(tokensRaw) ? tokensRaw : [];

  const MINUTES_REQUIRED = 30;
  const FRAGMENTS_PER_DAY = 2;

  const minutesByDay = new Map();
  entries.forEach((e) => {
    const dk = typeof e?.dateKey === "string" ? e.dateKey : "";
    if (!dk) return;
    const mins = typeof e?.minutesSpent === "number" && Number.isFinite(e.minutesSpent) ? e.minutesSpent : 0;
    const used = minutesByDay.get(dk) || 0;
    minutesByDay.set(dk, used + Math.max(0, Math.trunc(mins)));
  });

  const tokenDays = new Set();
  tokenUses.forEach((t) => {
    const dk = typeof t?.dateKey === "string" ? t.dateKey : "";
    if (dk) tokenDays.add(dk);
  });

  const daySet = new Set([...minutesByDay.keys(), ...tokenDays]);
  const days = [...daySet].sort((a, b) => String(a).localeCompare(String(b)));

  const creditedByDay = new Map();
  const creditedFragments = [];

  for (const dk of days) {
    const mins = minutesByDay.get(dk) || 0;
    const eligible = mins >= MINUTES_REQUIRED;
    const hasToken = tokenDays.has(dk);
    if (!eligible && !hasToken) continue;

    creditedByDay.set(dk, FRAGMENTS_PER_DAY);
    const color = eligible ? "gold" : "silver";
    for (let i = 0; i < FRAGMENTS_PER_DAY; i += 1) creditedFragments.push(color);
  }

  const starHistory = [];
  let current = new Array(5).fill(undefined);
  creditedFragments.forEach((c, index) => {
    const i = index % 5;
    current[i] = c;
    if ((index + 1) % 5 === 0) {
      starHistory.push({ fragments: [...current] });
      current = new Array(5).fill(undefined);
    }
  });
  if (current.some((v) => v !== undefined)) starHistory.push({ fragments: current });

  return {
    starHistory,
    currentStars: computeStarsFromStarHistory(starHistory),
    creditedByDay,
  };
}

function computeWillProjectsStarHistory(categoryId, subcategoryId) {
  const entryKey = `willProjectsEntries:${categoryId}:${subcategoryId}`;
  const tokenKey = `willProjectsTokens:${categoryId}:${subcategoryId}`;

  const safeParseArrayLocal = (raw) => {
    try {
      const v = JSON.parse(raw || "[]");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  };

  const MINUTES_REQUIRED = 30;
  const minsReq = Math.max(1, Math.min(1000, Math.trunc(MINUTES_REQUIRED)));

  const entries = safeParseArrayLocal(localStorage.getItem(entryKey));
  const tokenUses = safeParseArrayLocal(localStorage.getItem(tokenKey));

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
  const fragmentColors = [];

  for (const dk of days) {
    const mins = minutesByDay.get(dk) || 0;
    const eligible = mins >= minsReq;
    const hasToken = tokenByDay.has(dk);
    if (!eligible && !hasToken) continue;

    const usedToken = !eligible && hasToken;
    creditedByDay.set(dk, 1);
    fragmentColors.push(usedToken ? "silver" : "gold");
  }

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

  const currentStars = fragmentColors.length / 5;
  return { starHistory, currentStars, creditedByDay };
}

function computeWillDailyFragmentsStarHistory({ entryKey, fragmentsPerDay }) {
  const entriesRaw = JSON.parse(localStorage.getItem(entryKey) || "[]");
  const entries = Array.isArray(entriesRaw) ? entriesRaw : [];

  const sorted = entries
    .filter((e) => typeof e?.dateKey === "string" && e.dateKey)
    .slice()
    .sort((a, b) => {
      const aKey = String(a?.dateKey || "");
      const bKey = String(b?.dateKey || "");
      if (aKey !== bKey) return aKey.localeCompare(bKey);
      return String(a?.createdAt || "").localeCompare(String(b?.createdAt || ""));
    });

  // Cap: one award per day.
  const creditedByDay = new Map();
  const credited = [];

  for (const e of sorted) {
    const dk = String(e?.dateKey || "");
    if (!dk) continue;
    if (creditedByDay.has(dk)) continue;
    creditedByDay.set(dk, fragmentsPerDay);
    for (let i = 0; i < fragmentsPerDay; i += 1) {
      credited.push({ usedToken: !!e?.usedToken });
    }
  }

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
  if (current.some((v) => v !== undefined)) starHistory.push({ fragments: current });

  return {
    starHistory,
    currentStars: computeStarsFromStarHistory(starHistory),
    creditedByDay,
  };
}

function computeWillGradesStarHistory(categoryId, subcategoryId) {
  const ENTRY_KEY = `willGradesEntries:${categoryId}:${subcategoryId}`;
  const entriesRaw = JSON.parse(localStorage.getItem(ENTRY_KEY) || "[]");
  const entries = Array.isArray(entriesRaw) ? entriesRaw : [];

  const sorted = entries
    .filter((e) => typeof e?.dateKey === "string" && e.dateKey)
    .slice()
    .sort((a, b) => {
      const aKey = String(a?.dateKey || "");
      const bKey = String(b?.dateKey || "");
      if (aKey !== bKey) return aKey.localeCompare(bKey);
      return String(a?.createdAt || "").localeCompare(String(b?.createdAt || ""));
    });

  const fullStar = { fragments: ["gold", "gold", "gold", "gold", "gold"] };
  const starHistory = [];

  sorted.forEach((e) => {
    const awarded = Math.max(0, Math.floor(Number(e?.starsAwarded) || 0));
    for (let i = 0; i < awarded; i += 1) starHistory.push(fullStar);
  });

  return {
    starHistory,
    currentStars: starHistory.length,
  };
}

function computeSpiritDailyFragmentsStarHistory({ entryKey, tokenKey, fragmentsPerDay }) {
  const entriesRaw = JSON.parse(localStorage.getItem(entryKey) || "[]");
  const entries = Array.isArray(entriesRaw) ? entriesRaw : [];

  const tokensRaw = tokenKey ? JSON.parse(localStorage.getItem(tokenKey) || "[]") : [];
  const tokens = Array.isArray(tokensRaw) ? tokensRaw : [];

  const sortedEntries = entries
    .filter((e) => typeof e?.dateKey === "string" && e.dateKey)
    .slice()
    .sort((a, b) => {
      const aKey = String(a?.dateKey || "");
      const bKey = String(b?.dateKey || "");
      if (aKey !== bKey) return aKey.localeCompare(bKey);
      return String(a?.createdAt || "").localeCompare(String(b?.createdAt || ""));
    });

  const sortedTokens = tokens
    .filter((t) => typeof t?.dateKey === "string" && t.dateKey)
    .slice()
    .sort((a, b) => {
      const aKey = String(a?.dateKey || "");
      const bKey = String(b?.dateKey || "");
      if (aKey !== bKey) return aKey.localeCompare(bKey);
      return String(a?.createdAt || "").localeCompare(String(b?.createdAt || ""));
    });

  // Prefer gold if any entry exists for the day; otherwise allow a silver token.
  const dayInfo = new Map();
  for (const e of sortedEntries) {
    const dk = String(e?.dateKey || "");
    if (!dk) continue;
    if (dayInfo.has(dk)) continue;
    dayInfo.set(dk, { usedToken: false });
  }
  for (const t of sortedTokens) {
    const dk = String(t?.dateKey || "");
    if (!dk) continue;
    if (dayInfo.has(dk)) continue;
    dayInfo.set(dk, { usedToken: true });
  }

  const days = [...dayInfo.keys()].sort((a, b) => String(a).localeCompare(String(b)));
  const creditedByDay = new Map();
  const credited = [];

  for (const dk of days) {
    const info = dayInfo.get(dk);
    creditedByDay.set(dk, fragmentsPerDay);
    for (let i = 0; i < fragmentsPerDay; i += 1) credited.push({ usedToken: !!info?.usedToken });
  }

  const starHistory = [];
  let current = [];
  for (const ev of credited) {
    current.push(ev.usedToken ? "silver" : "gold");
    if (current.length === 5) {
      starHistory.push({ fragments: [...current] });
      current = [];
    }
  }
  if (current.length) starHistory.push({ fragments: [...current] });

  return {
    starHistory,
    currentStars: credited.length / 5,
    creditedByDay,
  };
}

function computeSpiritChoresStarHistory(categoryId, subcategoryId) {
  const ENTRY_KEY = `spiritChoresEntries:${categoryId}:${subcategoryId}`;
  const TOKEN_KEY = `spiritChoresTokens:${categoryId}:${subcategoryId}`;
  const entriesRaw = JSON.parse(localStorage.getItem(ENTRY_KEY) || "[]");
  const entries = Array.isArray(entriesRaw) ? entriesRaw : [];

  const tokensRaw = JSON.parse(localStorage.getItem(TOKEN_KEY) || "[]");
  const tokens = Array.isArray(tokensRaw) ? tokensRaw : [];

  const choresByDay = new Map();
  entries.forEach((e) => {
    const dk = typeof e?.dateKey === "string" ? e.dateKey : "";
    if (!dk) return;

    const tasks = Array.isArray(e?.tasks) ? e.tasks : [];
    const count = tasks
      .map((t) => String(t ?? "").trim())
      .filter((t) => t).length;

    const used = choresByDay.get(dk) || 0;
    choresByDay.set(dk, used + count);
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

  const creditedByDay = new Map();
  const creditedEvents = [];

  for (const dk of days) {
    const chores = choresByDay.get(dk) || 0;
    const choresCredited = Math.max(0, Math.min(2, Math.trunc(chores)));
    const tokensSpent = tokenSpendByDay.get(dk) || 0;
    const tokenCredited = Math.max(0, Math.min(2 - choresCredited, Math.trunc(tokensSpent)));

    const credited = choresCredited + tokenCredited;
    if (credited <= 0) continue;

    creditedByDay.set(dk, credited);
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
    currentStars: creditedEvents.length / 5,
    creditedByDay,
  };
}

function computeSpiritAnchorStarHistory(categoryId, subcategoryId) {
  const ENTRY_KEY = `spiritAnchorEntries:${categoryId}:${subcategoryId}`;
  const entriesRaw = JSON.parse(localStorage.getItem(ENTRY_KEY) || "[]");
  const entries = Array.isArray(entriesRaw) ? entriesRaw : [];

  const dateFromKeyUtc = (dateKey) => {
    const [yyyy, mm, dd] = String(dateKey || "").split("-").map((x) => Number(x));
    if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return null;
    return new Date(Date.UTC(yyyy, mm - 1, dd));
  };

  const weekKeyMondayUtc = (dateKey) => {
    const d = dateFromKeyUtc(dateKey);
    if (!d) return "";
    const day = d.getUTCDay();
    const diff = (day + 6) % 7;
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - diff);
    return monday.toISOString().slice(0, 10);
  };

  const sorted = entries
    .filter((e) => typeof e?.dateKey === "string" && e.dateKey)
    .slice()
    .sort((a, b) => {
      const aKey = String(a?.dateKey || "");
      const bKey = String(b?.dateKey || "");
      if (aKey !== bKey) return aKey.localeCompare(bKey);
      return String(a?.createdAt || "").localeCompare(String(b?.createdAt || ""));
    });

  const creditedByWeek = new Map();
  const halfColors = [];

  for (const e of sorted) {
    const dk = String(e?.dateKey || "");
    if (!dk) continue;
    const wk = weekKeyMondayUtc(dk);
    if (!wk) continue;
    if (creditedByWeek.has(wk)) continue;
    creditedByWeek.set(wk, 1);
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
    currentStars: halfColors.length / 2,
    creditedByWeek,
  };
}

function computeWillCompletedTodayFromCreditedMap(creditedByDay) {
  const today = getTodayKey();
  return (creditedByDay?.get?.(today) || 0) > 0;
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
    const monthKey = getMonthKey();
    const dim = daysInMonthFromMonthKey(monthKey);
    // Compute journal starHistory
    const journal = initial.mind.subcategories.find((s) => s.id === "journal");
    if (journal) {
      const { starHistory, fragmentsEarned } = computeJournalStarHistory("mind", "journal");
      journal.starHistory = starHistory;
      journal.currentStars = computeStarsFromStarHistory(starHistory);
      journal.currentFragments = fragmentsEarned;
      journal.completedToday = computeJournalCompletedToday("mind", "journal");
      journal.monthlyFragments = computeJournalMonthlyFragments("mind", "journal", monthKey);
      journal.monthlyFragmentsMax = dim * 3;
    }

    const therapy = initial.mind.subcategories.find((s) => s.id === "therapy");
    if (therapy) {
      const { starHistory, currentStars } = computeTherapyStarHistory("mind", "therapy");
      therapy.starHistory = starHistory;
      therapy.currentStars = currentStars;
      therapy.monthMaxStars = 1;
      therapy.monthlyFragments = computeTherapyMonthlyFragments("mind", "therapy", monthKey);
      therapy.monthlyFragmentsMax = 2;
    }

    const meditation = initial.mind.subcategories.find((s) => s.id === "meditation");
    if (meditation) {
      const { starHistory, currentStars } = computeMeditationReadingStarHistory("mind", "meditation");
      meditation.starHistory = starHistory;
      meditation.currentStars = currentStars;
      meditation.monthMaxStars = 2;
      meditation.monthlyFragments = computeMeditationMonthlyFragments("mind", "meditation", monthKey);
      meditation.monthlyFragmentsMax = 4;
    }

    const movement = initial.body.subcategories.find((s) => s.id === "movement");
    if (movement) {
      const { starHistory, currentStars, creditedByDay } = computeMovementStarHistory("body", "movement");
      movement.starHistory = starHistory;
      movement.currentStars = currentStars;
      movement.completedToday = computeMovementCompletedToday("body", "movement");
      movement.monthlyFragments = sumMapValuesByPrefix(creditedByDay, monthKey);
      movement.monthlyFragmentsMax = dim * 3;
    }

    const nourish = initial.body.subcategories.find((s) => s.id === "nourish");
    if (nourish) {
      const { starHistory, creditedByDay } = computeNourishStarHistory("body", "nourish");
      nourish.starHistory = starHistory;
      nourish.currentStars = computeStarsFromStarHistory(starHistory);
      nourish.completedToday = computeNourishCompletedToday("body", "nourish");
      nourish.monthlyFragments = Array.from(creditedByDay || []).filter(([dk]) => String(dk).startsWith(monthKey))
        .length;
      nourish.monthlyFragmentsMax = dim;
    }

    const hygiene = initial.body.subcategories.find((s) => s.id === "hygiene");
    if (hygiene) {
      const { starHistory, creditedByDay } = computeHygieneStarHistory("body", "hygiene");
      hygiene.starHistory = starHistory;
      hygiene.currentStars = computeStarsFromStarHistory(starHistory);
      hygiene.completedToday = computeHygieneCompletedToday("body", "hygiene");
      hygiene.monthlyFragments = Array.from(creditedByDay || []).filter(([dk]) => String(dk).startsWith(monthKey))
        .length;
      hygiene.monthlyFragmentsMax = dim;
    }

    const school = initial.will.subcategories.find((s) => s.id === "school");
    if (school) {
      const { starHistory, currentStars, creditedByDay } = computeWillSchoolStarHistory("will", "school");
      school.starHistory = starHistory;
      school.currentStars = currentStars;
      school.completedToday = computeWillCompletedTodayFromCreditedMap(creditedByDay);
      school.monthlyFragments = sumMapValuesByPrefix(creditedByDay, monthKey);
      school.monthlyFragmentsMax = dim;
    }

    const extended = initial.will.subcategories.find((s) => s.id === "extended");
    if (extended) {
      const { starHistory, currentStars, creditedByDay } = computeWillExtendedLearningStarHistory("will", "extended");
      extended.starHistory = starHistory;
      extended.currentStars = currentStars;
      extended.completedToday = computeWillCompletedTodayFromCreditedMap(creditedByDay);
      extended.monthlyFragments = sumMapValuesByPrefix(creditedByDay, monthKey);
      extended.monthlyFragmentsMax = dim * 2;
    }

    const projects = initial.will.subcategories.find((s) => s.id === "projects");
    if (projects) {
      const { starHistory, currentStars, creditedByDay } = computeWillProjectsStarHistory("will", "projects");
      projects.starHistory = starHistory;
      projects.currentStars = currentStars;
      projects.completedToday = computeWillCompletedTodayFromCreditedMap(creditedByDay);
      projects.monthlyFragments = sumMapValuesByPrefix(creditedByDay, monthKey);
      projects.monthlyFragmentsMax = dim;
    }

    const grades = initial.will.subcategories.find((s) => s.id === "grades");
    if (grades) {
      const { starHistory, currentStars } = computeWillGradesStarHistory("will", "grades");
      grades.starHistory = starHistory;
      grades.currentStars = currentStars;
    }

    const mirror = initial.spirit.subcategories.find((s) => s.id === "mirror");
    if (mirror) {
      const { starHistory, currentStars, creditedByDay } = computeSpiritDailyFragmentsStarHistory({
        entryKey: `spiritMirrorEntries:spirit:mirror`,
        tokenKey: `spiritMirrorTokens:spirit:mirror`,
        fragmentsPerDay: 1,
      });
      mirror.starHistory = starHistory;
      mirror.currentStars = currentStars;
      mirror.completedToday = (creditedByDay?.get?.(getTodayKey()) || 0) > 0;
      mirror.monthlyFragments = sumMapValuesByPrefix(creditedByDay, monthKey);
      mirror.monthlyFragmentsMax = dim;
    }

    const chores = initial.spirit.subcategories.find((s) => s.id === "chores");
    if (chores) {
      const { starHistory, currentStars, creditedByDay } = computeSpiritChoresStarHistory("spirit", "chores");
      chores.starHistory = starHistory;
      chores.currentStars = currentStars;
      chores.completedToday = (creditedByDay?.get?.(getTodayKey()) || 0) > 0;
      chores.monthlyFragments = sumMapValuesByPrefix(creditedByDay, monthKey);
      chores.monthlyFragmentsMax = dim * 2;
    }

    const soulcare = initial.spirit.subcategories.find((s) => s.id === "soulcare");
    if (soulcare) {
      const { starHistory, currentStars, creditedByDay } = computeSpiritDailyFragmentsStarHistory({
        entryKey: `spiritSoulCareEntries:spirit:soulcare`,
        tokenKey: `spiritSoulCareTokens:spirit:soulcare`,
        fragmentsPerDay: 1,
      });
      soulcare.starHistory = starHistory;
      soulcare.currentStars = currentStars;
      soulcare.completedToday = (creditedByDay?.get?.(getTodayKey()) || 0) > 0;
      soulcare.monthlyFragments = sumMapValuesByPrefix(creditedByDay, monthKey);
      soulcare.monthlyFragmentsMax = dim;
    }

    const anchor = initial.spirit.subcategories.find((s) => s.id === "anchor");
    if (anchor) {
      const { starHistory, currentStars, creditedByWeek } = computeSpiritAnchorStarHistory("spirit", "anchor");
      anchor.starHistory = starHistory;
      anchor.currentStars = currentStars;

      const dateFromKeyUtc = (dateKey) => {
        const [yyyy, mm, dd] = String(dateKey || "").split("-").map((x) => Number(x));
        if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return null;
        return new Date(Date.UTC(yyyy, mm - 1, dd));
      };
      const weekKeyMondayUtc = (dateKey) => {
        const d = dateFromKeyUtc(dateKey);
        if (!d) return "";
        const day = d.getUTCDay();
        const diff = (day + 6) % 7;
        const monday = new Date(d);
        monday.setUTCDate(d.getUTCDate() - diff);
        return monday.toISOString().slice(0, 10);
      };

      const thisWeekKey = weekKeyMondayUtc(getTodayKey());
      anchor.completedToday = (creditedByWeek?.get?.(thisWeekKey) || 0) > 0;
    }
    return initial;
  });

  // Update journal starHistory when component mounts or when returning to dashboard
  useEffect(() => {
    if (!activeSubcategory) {
      setDashboardData(prev => {
        const updated = { ...prev };
        const monthKey = getMonthKey();
        const dim = daysInMonthFromMonthKey(monthKey);
        const journal = updated.mind.subcategories.find((s) => s.id === "journal");
        if (journal) {
          const { starHistory, fragmentsEarned } = computeJournalStarHistory("mind", "journal");
          journal.starHistory = starHistory;
          journal.currentStars = computeStarsFromStarHistory(starHistory);
          journal.currentFragments = fragmentsEarned;
          journal.completedToday = computeJournalCompletedToday("mind", "journal");
          journal.monthlyFragments = computeJournalMonthlyFragments("mind", "journal", monthKey);
          journal.monthlyFragmentsMax = dim * 3;
        }

        const therapy = updated.mind.subcategories.find((s) => s.id === "therapy");
        if (therapy) {
          const { starHistory, currentStars } = computeTherapyStarHistory("mind", "therapy");
          therapy.starHistory = starHistory;
          therapy.currentStars = currentStars;
          therapy.monthMaxStars = 1;
          therapy.monthlyFragments = computeTherapyMonthlyFragments("mind", "therapy", monthKey);
          therapy.monthlyFragmentsMax = 2;
        }

        const meditation = updated.mind.subcategories.find((s) => s.id === "meditation");
        if (meditation) {
          const { starHistory, currentStars } = computeMeditationReadingStarHistory("mind", "meditation");
          meditation.starHistory = starHistory;
          meditation.currentStars = currentStars;
          meditation.monthMaxStars = 2;
          meditation.monthlyFragments = computeMeditationMonthlyFragments("mind", "meditation", monthKey);
          meditation.monthlyFragmentsMax = 4;
        }

        const movement = updated.body.subcategories.find((s) => s.id === "movement");
        if (movement) {
          const { starHistory, currentStars, creditedByDay } = computeMovementStarHistory("body", "movement");
          movement.starHistory = starHistory;
          movement.currentStars = currentStars;
          movement.completedToday = computeMovementCompletedToday("body", "movement");
          movement.monthlyFragments = sumMapValuesByPrefix(creditedByDay, monthKey);
          movement.monthlyFragmentsMax = dim * 3;
        }

        const nourish = updated.body.subcategories.find((s) => s.id === "nourish");
        if (nourish) {
          const { starHistory, creditedByDay } = computeNourishStarHistory("body", "nourish");
          nourish.starHistory = starHistory;
          nourish.currentStars = computeStarsFromStarHistory(starHistory);
          nourish.completedToday = computeNourishCompletedToday("body", "nourish");
          nourish.monthlyFragments = Array.from(creditedByDay || []).filter(([dk]) => String(dk).startsWith(monthKey))
            .length;
          nourish.monthlyFragmentsMax = dim;
        }

        const hygiene = updated.body.subcategories.find((s) => s.id === "hygiene");
        if (hygiene) {
          const { starHistory, creditedByDay } = computeHygieneStarHistory("body", "hygiene");
          hygiene.starHistory = starHistory;
          hygiene.currentStars = computeStarsFromStarHistory(starHistory);
          hygiene.completedToday = computeHygieneCompletedToday("body", "hygiene");
          hygiene.monthlyFragments = Array.from(creditedByDay || []).filter(([dk]) => String(dk).startsWith(monthKey))
            .length;
          hygiene.monthlyFragmentsMax = dim;
        }

        const school = updated.will.subcategories.find((s) => s.id === "school");
        if (school) {
          const { starHistory, currentStars, creditedByDay } = computeWillSchoolStarHistory("will", "school");
          school.starHistory = starHistory;
          school.currentStars = currentStars;
          school.completedToday = computeWillCompletedTodayFromCreditedMap(creditedByDay);
          school.monthlyFragments = sumMapValuesByPrefix(creditedByDay, monthKey);
          school.monthlyFragmentsMax = dim;
        }

        const extended = updated.will.subcategories.find((s) => s.id === "extended");
        if (extended) {
          const { starHistory, currentStars, creditedByDay } = computeWillExtendedLearningStarHistory("will", "extended");
          extended.starHistory = starHistory;
          extended.currentStars = currentStars;
          extended.completedToday = computeWillCompletedTodayFromCreditedMap(creditedByDay);
          extended.monthlyFragments = sumMapValuesByPrefix(creditedByDay, monthKey);
          extended.monthlyFragmentsMax = dim * 2;
        }

        const projects = updated.will.subcategories.find((s) => s.id === "projects");
        if (projects) {
          const { starHistory, currentStars, creditedByDay } = computeWillProjectsStarHistory("will", "projects");
          projects.starHistory = starHistory;
          projects.currentStars = currentStars;
          projects.completedToday = computeWillCompletedTodayFromCreditedMap(creditedByDay);
          projects.monthlyFragments = sumMapValuesByPrefix(creditedByDay, monthKey);
          projects.monthlyFragmentsMax = dim;
        }

        const grades = updated.will.subcategories.find((s) => s.id === "grades");
        if (grades) {
          const { starHistory, currentStars } = computeWillGradesStarHistory("will", "grades");
          grades.starHistory = starHistory;
          grades.currentStars = currentStars;
        }

        const mirror = updated.spirit.subcategories.find((s) => s.id === "mirror");
        if (mirror) {
          const { starHistory, currentStars, creditedByDay } = computeSpiritDailyFragmentsStarHistory({
            entryKey: `spiritMirrorEntries:spirit:mirror`,
            tokenKey: `spiritMirrorTokens:spirit:mirror`,
            fragmentsPerDay: 1,
          });
          mirror.starHistory = starHistory;
          mirror.currentStars = currentStars;
          mirror.completedToday = (creditedByDay?.get?.(getTodayKey()) || 0) > 0;
          mirror.monthlyFragments = sumMapValuesByPrefix(creditedByDay, monthKey);
          mirror.monthlyFragmentsMax = dim;
        }

        const chores = updated.spirit.subcategories.find((s) => s.id === "chores");
        if (chores) {
          const { starHistory, currentStars, creditedByDay } = computeSpiritChoresStarHistory("spirit", "chores");
          chores.starHistory = starHistory;
          chores.currentStars = currentStars;
          chores.completedToday = (creditedByDay?.get?.(getTodayKey()) || 0) > 0;
          chores.monthlyFragments = sumMapValuesByPrefix(creditedByDay, monthKey);
          chores.monthlyFragmentsMax = dim * 2;
        }

        const soulcare = updated.spirit.subcategories.find((s) => s.id === "soulcare");
        if (soulcare) {
          const { starHistory, currentStars, creditedByDay } = computeSpiritDailyFragmentsStarHistory({
            entryKey: `spiritSoulCareEntries:spirit:soulcare`,
            tokenKey: `spiritSoulCareTokens:spirit:soulcare`,
            fragmentsPerDay: 1,
          });
          soulcare.starHistory = starHistory;
          soulcare.currentStars = currentStars;
          soulcare.completedToday = (creditedByDay?.get?.(getTodayKey()) || 0) > 0;
          soulcare.monthlyFragments = sumMapValuesByPrefix(creditedByDay, monthKey);
          soulcare.monthlyFragmentsMax = dim;
        }

        const anchor = updated.spirit.subcategories.find((s) => s.id === "anchor");
        if (anchor) {
          const { starHistory, currentStars, creditedByWeek } = computeSpiritAnchorStarHistory("spirit", "anchor");
          anchor.starHistory = starHistory;
          anchor.currentStars = currentStars;

          const dateFromKeyUtc = (dateKey) => {
            const [yyyy, mm, dd] = String(dateKey || "").split("-").map((x) => Number(x));
            if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return null;
            return new Date(Date.UTC(yyyy, mm - 1, dd));
          };
          const weekKeyMondayUtc = (dateKey) => {
            const d = dateFromKeyUtc(dateKey);
            if (!d) return "";
            const day = d.getUTCDay();
            const diff = (day + 6) % 7;
            const monday = new Date(d);
            monday.setUTCDate(d.getUTCDate() - diff);
            return monday.toISOString().slice(0, 10);
          };

          const thisWeekKey = weekKeyMondayUtc(getTodayKey());
          anchor.completedToday = (creditedByWeek?.get?.(thisWeekKey) || 0) > 0;
        }
        return updated;
      });
    }
  }, [activeSubcategory]);

  // Live-refresh spirit stars whenever spirit entries change
  useEffect(() => {
    const handler = (ev) => {
      const detail = ev?.detail;
      if (!detail || detail.categoryId !== "spirit") return;

      setDashboardData((prev) => {
        const updated = { ...prev };
        const monthKey = getMonthKey();
        const dim = daysInMonthFromMonthKey(monthKey);

        const mirror = updated.spirit.subcategories.find((s) => s.id === "mirror");
        if (mirror) {
          const { starHistory, currentStars, creditedByDay } = computeSpiritDailyFragmentsStarHistory({
            entryKey: `spiritMirrorEntries:spirit:mirror`,
            tokenKey: `spiritMirrorTokens:spirit:mirror`,
            fragmentsPerDay: 1,
          });
          mirror.starHistory = starHistory;
          mirror.currentStars = currentStars;
          mirror.completedToday = (creditedByDay?.get?.(getTodayKey()) || 0) > 0;
          mirror.monthlyFragments = sumMapValuesByPrefix(creditedByDay, monthKey);
          mirror.monthlyFragmentsMax = dim;
        }

        const chores = updated.spirit.subcategories.find((s) => s.id === "chores");
        if (chores) {
          const { starHistory, currentStars, creditedByDay } = computeSpiritChoresStarHistory("spirit", "chores");
          chores.starHistory = starHistory;
          chores.currentStars = currentStars;
          chores.completedToday = (creditedByDay?.get?.(getTodayKey()) || 0) > 0;
          chores.monthlyFragments = sumMapValuesByPrefix(creditedByDay, monthKey);
          chores.monthlyFragmentsMax = dim * 2;
        }

        const soulcare = updated.spirit.subcategories.find((s) => s.id === "soulcare");
        if (soulcare) {
          const { starHistory, currentStars, creditedByDay } = computeSpiritDailyFragmentsStarHistory({
            entryKey: `spiritSoulCareEntries:spirit:soulcare`,
            tokenKey: `spiritSoulCareTokens:spirit:soulcare`,
            fragmentsPerDay: 1,
          });
          soulcare.starHistory = starHistory;
          soulcare.currentStars = currentStars;
          soulcare.completedToday = (creditedByDay?.get?.(getTodayKey()) || 0) > 0;
          soulcare.monthlyFragments = sumMapValuesByPrefix(creditedByDay, monthKey);
          soulcare.monthlyFragmentsMax = dim;
        }

        const anchor = updated.spirit.subcategories.find((s) => s.id === "anchor");
        if (anchor) {
          const { starHistory, currentStars, creditedByWeek } = computeSpiritAnchorStarHistory("spirit", "anchor");
          anchor.starHistory = starHistory;
          anchor.currentStars = currentStars;

          const dateFromKeyUtc = (dateKey) => {
            const [yyyy, mm, dd] = String(dateKey || "").split("-").map((x) => Number(x));
            if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return null;
            return new Date(Date.UTC(yyyy, mm - 1, dd));
          };
          const weekKeyMondayUtc = (dateKey) => {
            const d = dateFromKeyUtc(dateKey);
            if (!d) return "";
            const day = d.getUTCDay();
            const diff = (day + 6) % 7;
            const monday = new Date(d);
            monday.setUTCDate(d.getUTCDate() - diff);
            return monday.toISOString().slice(0, 10);
          };

          const thisWeekKey = weekKeyMondayUtc(getTodayKey());
          anchor.completedToday = (creditedByWeek?.get?.(thisWeekKey) || 0) > 0;
        }

        return updated;
      });
    };

    window.addEventListener("spirit-data-changed", handler);
    return () => window.removeEventListener("spirit-data-changed", handler);
  }, []);

  // Live-refresh will stars whenever will entries change
  useEffect(() => {
    const handler = (ev) => {
      const detail = ev?.detail;
      if (!detail || detail.categoryId !== "will") return;

      setDashboardData((prev) => {
        const updated = { ...prev };
        const monthKey = getMonthKey();
        const dim = daysInMonthFromMonthKey(monthKey);

        const school = updated.will.subcategories.find((s) => s.id === "school");
        if (school) {
          const { starHistory, currentStars, creditedByDay } = computeWillSchoolStarHistory("will", "school");
          school.starHistory = starHistory;
          school.currentStars = currentStars;
          school.completedToday = computeWillCompletedTodayFromCreditedMap(creditedByDay);
          school.monthlyFragments = sumMapValuesByPrefix(creditedByDay, monthKey);
          school.monthlyFragmentsMax = dim;
        }

        const extended = updated.will.subcategories.find((s) => s.id === "extended");
        if (extended) {
          const { starHistory, currentStars, creditedByDay } = computeWillExtendedLearningStarHistory("will", "extended");
          extended.starHistory = starHistory;
          extended.currentStars = currentStars;
          extended.completedToday = computeWillCompletedTodayFromCreditedMap(creditedByDay);
          extended.monthlyFragments = sumMapValuesByPrefix(creditedByDay, monthKey);
          extended.monthlyFragmentsMax = dim * 2;
        }

        const projects = updated.will.subcategories.find((s) => s.id === "projects");
        if (projects) {
          const { starHistory, currentStars, creditedByDay } = computeWillProjectsStarHistory("will", "projects");
          projects.starHistory = starHistory;
          projects.currentStars = currentStars;
          projects.completedToday = computeWillCompletedTodayFromCreditedMap(creditedByDay);
          projects.monthlyFragments = sumMapValuesByPrefix(creditedByDay, monthKey);
          projects.monthlyFragmentsMax = dim;
        }

        const grades = updated.will.subcategories.find((s) => s.id === "grades");
        if (grades) {
          const { starHistory, currentStars } = computeWillGradesStarHistory("will", "grades");
          grades.starHistory = starHistory;
          grades.currentStars = currentStars;
        }

        return updated;
      });
    };

    window.addEventListener("will-data-changed", handler);
    return () => window.removeEventListener("will-data-changed", handler);
  }, []);

  // Live-refresh journal stars whenever entries/tokens change
  useEffect(() => {
    const handler = (ev) => {
      const detail = ev?.detail;
      if (!detail || detail.categoryId !== 'mind' || detail.subcategoryId !== 'journal') return;

      setDashboardData((prev) => {
        const updated = { ...prev };
        const monthKey = getMonthKey();
        const dim = daysInMonthFromMonthKey(monthKey);
        const { starHistory: nextStarHistory, fragmentsEarned } = computeJournalStarHistory('mind', 'journal');
        updated.mind.subcategories[0].starHistory = nextStarHistory;
        updated.mind.subcategories[0].currentStars = computeStarsFromStarHistory(nextStarHistory);
        updated.mind.subcategories[0].currentFragments = fragmentsEarned;
        updated.mind.subcategories[0].completedToday = computeJournalCompletedToday('mind', 'journal');
        updated.mind.subcategories[0].monthlyFragments = computeJournalMonthlyFragments('mind', 'journal', monthKey);
        updated.mind.subcategories[0].monthlyFragmentsMax = dim * 3;
        return updated;
      });
    };

    window.addEventListener('journal-data-changed', handler);
    return () => window.removeEventListener('journal-data-changed', handler);
  }, []);

  useEffect(() => {
    const handler = (ev) => {
      const detail = ev?.detail;
      if (!detail || detail.categoryId !== "body" || detail.subcategoryId !== "nourish") return;

      setDashboardData((prev) => {
        const updated = { ...prev };
        const monthKey = getMonthKey();
        const dim = daysInMonthFromMonthKey(monthKey);
        const nourish = updated.body.subcategories.find((s) => s.id === "nourish");
        if (!nourish) return prev;
        const { starHistory, creditedByDay } = computeNourishStarHistory("body", "nourish");
        nourish.starHistory = starHistory;
        nourish.currentStars = computeStarsFromStarHistory(starHistory);
        nourish.completedToday = computeNourishCompletedToday("body", "nourish");
        nourish.monthlyFragments = Array.from(creditedByDay || []).filter(([dk]) => String(dk).startsWith(monthKey))
          .length;
        nourish.monthlyFragmentsMax = dim;
        return updated;
      });
    };

    window.addEventListener("nourish-data-changed", handler);
    return () => window.removeEventListener("nourish-data-changed", handler);
  }, []);

  useEffect(() => {
    const handler = (ev) => {
      const detail = ev?.detail;
      if (!detail || detail.categoryId !== "body" || detail.subcategoryId !== "movement") return;

      setDashboardData((prev) => {
        const updated = { ...prev };
        const monthKey = getMonthKey();
        const dim = daysInMonthFromMonthKey(monthKey);
        const movement = updated.body.subcategories.find((s) => s.id === "movement");
        if (!movement) return prev;
        const { starHistory, currentStars, creditedByDay } = computeMovementStarHistory("body", "movement");
        movement.starHistory = starHistory;
        movement.currentStars = currentStars;
        movement.completedToday = computeMovementCompletedToday("body", "movement");
        movement.monthlyFragments = sumMapValuesByPrefix(creditedByDay, monthKey);
        movement.monthlyFragmentsMax = dim * 3;
        return updated;
      });
    };

    window.addEventListener("movement-data-changed", handler);
    return () => window.removeEventListener("movement-data-changed", handler);
  }, []);

  useEffect(() => {
    const handler = (ev) => {
      const detail = ev?.detail;
      if (!detail || detail.categoryId !== "body" || detail.subcategoryId !== "hygiene") return;

      setDashboardData((prev) => {
        const updated = { ...prev };
        const monthKey = getMonthKey();
        const dim = daysInMonthFromMonthKey(monthKey);
        const hygiene = updated.body.subcategories.find((s) => s.id === "hygiene");
        if (!hygiene) return prev;
        const { starHistory, creditedByDay } = computeHygieneStarHistory("body", "hygiene");
        hygiene.starHistory = starHistory;
        hygiene.currentStars = computeStarsFromStarHistory(starHistory);
        hygiene.completedToday = computeHygieneCompletedToday("body", "hygiene");
        hygiene.monthlyFragments = Array.from(creditedByDay || []).filter(([dk]) => String(dk).startsWith(monthKey))
          .length;
        hygiene.monthlyFragmentsMax = dim;
        return updated;
      });
    };

    window.addEventListener("hygiene-data-changed", handler);
    return () => window.removeEventListener("hygiene-data-changed", handler);
  }, []);

  useEffect(() => {
    const handler = (ev) => {
      const detail = ev?.detail;
      if (!detail || detail.categoryId !== "mind" || detail.subcategoryId !== "meditation") return;

      setDashboardData((prev) => {
        const updated = { ...prev };
        const monthKey = getMonthKey();
        const meditation = updated.mind.subcategories.find((s) => s.id === "meditation");
        if (!meditation) return prev;
        const { starHistory, currentStars } = computeMeditationReadingStarHistory("mind", "meditation");
        meditation.starHistory = starHistory;
        meditation.currentStars = currentStars;
        meditation.monthMaxStars = 2;
        meditation.monthlyFragments = computeMeditationMonthlyFragments("mind", "meditation", monthKey);
        meditation.monthlyFragmentsMax = 4;
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
        const monthKey = getMonthKey();
        const therapy = updated.mind.subcategories.find((s) => s.id === "therapy");
        if (!therapy) return prev;

        const { starHistory, currentStars } = computeTherapyStarHistory("mind", "therapy");
        therapy.starHistory = starHistory;
        therapy.currentStars = currentStars;
        therapy.monthlyFragments = computeTherapyMonthlyFragments("mind", "therapy", monthKey);
        therapy.monthlyFragmentsMax = 2;
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

  const handleOpenConstellations = (categoryId) => {
    const id = String(categoryId || "");
    if (!id) return;
    setActiveSubcategory(null);
    setActiveConstellationsCategoryId(id);
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

  const willConstellations = useMemo(
    () => [
      { name: "Orion", starCount: 19, slug: "orion" },
      { name: "Leo", starCount: 15, slug: "leo" },
      { name: "Sagittarius", starCount: 19, slug: "sagittarius" },
      { name: "Phoenix", starCount: 11, slug: "phoenix" },
      { name: "Perseus", starCount: 16, slug: "perseus" },
      { name: "Aries", starCount: 4, slug: "aries" },
      { name: "Draco", starCount: 13, slug: "draco" },
      { name: "Scorpius", starCount: 13, slug: "scorpius" },
      { name: "Crux", starCount: 4, slug: "crux" },
      { name: "Indus", starCount: 5, slug: "indus" },
      { name: "Horologium", starCount: 7, slug: "horologium" },
      { name: "Fornax", starCount: 4, slug: "fornax" },
    ],
    []
  );

  const spiritConstellations = useMemo(
    () => [
      { name: "Andromeda", starCount: 16, slug: "andromeda" },
      { name: "Hydra", starCount: 17, slug: "hydra" },
      { name: "Cetus", starCount: 14, slug: "cetus" },
      { name: "Cassiopeia", starCount: 5, slug: "cassiopeia" },
      { name: "Monoceros", starCount: 7, slug: "monoceros" },
      { name: "Columba", starCount: 7, slug: "columba" },
      { name: "Grus", starCount: 10, slug: "grus" },
      { name: "Dorado", starCount: 6, slug: "dorado" },
      { name: "Sculptor", starCount: 5, slug: "sculptor" },
      { name: "Volans", starCount: 6, slug: "volans" },
      { name: "Tucana", starCount: 6, slug: "tucana" },
      { name: "Carina", starCount: 9, slug: "carina" },
    ],
    []
  );

  const constellationsByCategory = useMemo(
    () => ({
      mind: mindConstellations,
      body: bodyConstellations,
      will: willConstellations,
      spirit: spiritConstellations,
    }),
    [mindConstellations, bodyConstellations, willConstellations, spiritConstellations]
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

    if (categoryId === "body" && subcategoryId === "movement") {
      return (
        <div className="app-shell">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={handleSidebarNavigate} />
          <MovementSubcategoryPage
            category={category}
            subcategory={subcategory}
            onBack={handleBackToDashboard}
            lowEnergy={lowEnergy}
          />
        </div>
      );
    }

    if (categoryId === "body" && subcategoryId === "nourish") {
      return (
        <div className="app-shell">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={handleSidebarNavigate} />
          <NourishSubcategoryPage
            category={category}
            subcategory={subcategory}
            onBack={handleBackToDashboard}
            lowEnergy={lowEnergy}
          />
        </div>
      );
    }

    if (categoryId === "body" && subcategoryId === "hygiene") {
      return (
        <div className="app-shell">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={handleSidebarNavigate} />
          <HygieneSubcategoryPage
            category={category}
            subcategory={subcategory}
            onBack={handleBackToDashboard}
            lowEnergy={lowEnergy}
          />
        </div>
      );
    }

    if (categoryId === "will" && subcategoryId === "school") {
      return (
        <div className="app-shell">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={handleSidebarNavigate} />
          <SchoolWorkSubcategoryPage
            category={category}
            subcategory={subcategory}
            onBack={handleBackToDashboard}
            lowEnergy={lowEnergy}
          />
        </div>
      );
    }

    if (categoryId === "will" && subcategoryId === "grades") {
      return (
        <div className="app-shell">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={handleSidebarNavigate} />
          <GoodGradesSubcategoryPage
            category={category}
            subcategory={subcategory}
            onBack={handleBackToDashboard}
            lowEnergy={lowEnergy}
          />
        </div>
      );
    }

    if (categoryId === "will" && subcategoryId === "extended") {
      return (
        <div className="app-shell">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={handleSidebarNavigate} />
          <ExtendedLearningSubcategoryPage
            category={category}
            subcategory={subcategory}
            onBack={handleBackToDashboard}
            lowEnergy={lowEnergy}
          />
        </div>
      );
    }

    if (categoryId === "will" && subcategoryId === "projects") {
      return (
        <div className="app-shell">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={handleSidebarNavigate} />
          <ProjectsSubcategoryPage
            category={category}
            subcategory={subcategory}
            onBack={handleBackToDashboard}
            lowEnergy={lowEnergy}
          />
        </div>
      );
    }

    if (categoryId === "spirit" && subcategoryId === "mirror") {
      return (
        <div className="app-shell">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={handleSidebarNavigate} />
          <MirrorWorkSubcategoryPage
            category={category}
            subcategory={subcategory}
            onBack={handleBackToDashboard}
            lowEnergy={lowEnergy}
          />
        </div>
      );
    }

    if (categoryId === "spirit" && subcategoryId === "chores") {
      return (
        <div className="app-shell">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={handleSidebarNavigate} />
          <ChoresSubcategoryPage
            category={category}
            subcategory={subcategory}
            onBack={handleBackToDashboard}
            lowEnergy={lowEnergy}
          />
        </div>
      );
    }

    if (categoryId === "spirit" && subcategoryId === "soulcare") {
      return (
        <div className="app-shell">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={handleSidebarNavigate} />
          <SoulCareSubcategoryPage
            category={category}
            subcategory={subcategory}
            onBack={handleBackToDashboard}
            lowEnergy={lowEnergy}
          />
        </div>
      );
    }

    if (categoryId === "spirit" && subcategoryId === "anchor") {
      return (
        <div className="app-shell">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={handleSidebarNavigate} />
          <AnchorDaysSubcategoryPage
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
              onOpenConstellations={handleOpenConstellations}
            />
          ))}
        </main>
      </div>
    );
}

export default App;
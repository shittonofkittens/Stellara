// src/components/MeditationReadingSubcategoryPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import SubcategoryShell, { TAB_HISTORY, TAB_INPUT, TAB_TRACKER } from "./SubcategoryShell";
import { ensureCategoryTokensSeeded, useCategoryTokenBalance } from "./Tokens";
import { earnTokens, spendTokens } from "../utils/tokens";

const TOKEN_COST_MEDITATION_HALF_STAR = 3;
const MEDITATION_STARS_AWARDED = 0.5;

function emitMeditationReadingDataChanged(categoryId, subcategoryId) {
  try {
    window.dispatchEvent(
      new CustomEvent("meditation-reading-data-changed", {
        detail: { categoryId, subcategoryId },
      })
    );
  } catch {
    // ignore
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
  const [yyyy, mm, dd] = dateKey.split("-");
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

  return `${dd} ${monthNames[monthIndex]} ${yyyy}`;
}

function safeParseArray(raw) {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function computeMonthlyTotals(entries, monthKey) {
  let totalHalves = 0;
  let meditationHalves = 0;

  (Array.isArray(entries) ? entries : [])
    .filter((e) => typeof e?.dateKey === "string" && e.dateKey.startsWith(monthKey))
    .forEach((e) => {
      const awarded = typeof e?.starsAwarded === "number" ? e.starsAwarded : 0;
      const halves = Number.isFinite(awarded) ? Math.round(awarded * 2) : 0;
      if (halves <= 0) return;
      totalHalves += halves;
      if (e?.kind === "meditation") meditationHalves += halves;
    });

  // Caps: total <= 2 stars (4 halves), meditation <= 2 stars (4 halves)
  meditationHalves = Math.max(0, Math.min(4, meditationHalves));
  totalHalves = Math.max(0, Math.min(4, totalHalves));

  return {
    totalHalves,
    meditationHalves,
    totalStars: totalHalves / 2,
    meditationStars: meditationHalves / 2,
  };
}

function computeMeditationYearlyStars(entries, yearKey) {
  const byMonthHalves = new Map();

  (Array.isArray(entries) ? entries : [])
    .filter((e) => e?.kind === "meditation" && typeof e?.dateKey === "string" && e.dateKey.startsWith(yearKey))
    .forEach((e) => {
      const month = e.dateKey.slice(0, 7);
      const awarded = typeof e?.starsAwarded === "number" ? e.starsAwarded : 0;
      const halves = Number.isFinite(awarded) ? Math.round(awarded * 2) : 0;
      if (halves <= 0) return;
      byMonthHalves.set(month, (byMonthHalves.get(month) || 0) + halves);
    });

  let totalHalves = 0;
  for (const v of byMonthHalves.values()) {
    totalHalves += Math.max(0, Math.min(4, Math.floor(v))); // cap 2 stars/month
  }
  return Math.max(0, totalHalves / 2);
}

function buildHalfStarHistoryFromHalves(totalHalves) {
  const halves = Math.max(0, Math.min(20, Math.floor(totalHalves)));
  const starHistory = [];
  let current = [];
  for (let i = 0; i < halves; i += 1) {
    current.push("gold");
    if (current.length === 2) {
      starHistory.push({ halves: [...current] });
      current = [];
    }
  }
  if (current.length) starHistory.push({ halves: [...current] });
  return starHistory;
}

function buildHalfStarHistoryFromEntries(entries, monthKey) {
  const list = Array.isArray(entries) ? entries : [];
  const monthEntries = list
    .filter((e) => typeof e?.dateKey === "string" && e.dateKey.startsWith(monthKey))
    .slice()
    .sort((a, b) => String(a?.createdAt || "").localeCompare(String(b?.createdAt || "")));

  const halfColors = [];
  let totalHalves = 0;
  let meditationHalves = 0;

  for (const e of monthEntries) {
    const awarded = typeof e?.starsAwarded === "number" ? e.starsAwarded : 0;
    const halves = Number.isFinite(awarded) ? Math.round(awarded * 2) : 0;
    if (halves <= 0) continue;

    for (let i = 0; i < halves; i += 1) {
      if (totalHalves >= 4) break;
      if (e?.kind === "meditation" && meditationHalves >= 4) break;

      halfColors.push(e?.usedToken ? "silver" : "gold");
      totalHalves += 1;
      if (e?.kind === "meditation") meditationHalves += 1;
    }

    if (totalHalves >= 20) break;
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
  return starHistory;
}

export default function MeditationReadingSubcategoryPage({ category, subcategory, onBack, lowEnergy }) {
  const [activeTab, setActiveTab] = useState(TAB_INPUT);

  const STORAGE_KEY = `meditationReadingEntries:${category.id}:${subcategory.id}`;

  const dateKey = useMemo(() => todayKey(), []);
  const monthKey = useMemo(() => dateKey.slice(0, 7), [dateKey]);

  const [entries, setEntries] = useState(() => safeParseArray(localStorage.getItem(STORAGE_KEY)));

  const availableTokens = useCategoryTokenBalance(category?.id);

  useEffect(() => {
    ensureCategoryTokensSeeded(category?.id);
  }, [category?.id]);

  useEffect(() => {
    // Back-compat: earlier versions awarded 1 star per meditation; normalize to 1/2.
    // If any 1/4-star entries exist (from a brief experiment), normalize them up to 1/2.
    setEntries((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      let changed = false;
      const next = list.map((e) => {
        if (e?.kind !== "meditation") return e;
        if (e?.starsAwarded === 1 || e?.starsAwarded === 0.25) {
          changed = true;
          return { ...e, starsAwarded: MEDITATION_STARS_AWARDED };
        }
        return e;
      });
      return changed ? next : prev;
    });
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const focusStorageKey = useMemo(
    () => `meditationReadingFocus:${category.id}:${subcategory.id}:${monthKey}`,
    [category.id, monthKey, subcategory.id]
  );

  const [focus, setFocus] = useState(() => {
    try {
      const stored = localStorage.getItem(focusStorageKey);
      return stored === "meditation" || stored === "reading" ? stored : "reading";
    } catch {
      return "reading";
    }
  });

  // Reading form
  const [bookTitle, setBookTitle] = useState("");
  const [bookAuthor, setBookAuthor] = useState("");
  const [whatLearned, setWhatLearned] = useState("");

  // Meditation form
  const [minutes, setMinutes] = useState("");
  const [feltBetter, setFeltBetter] = useState(null); // true | false | null

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // ignore
    }

    emitMeditationReadingDataChanged(category.id, subcategory.id);
  }, [STORAGE_KEY, category.id, entries, subcategory.id]);

  useEffect(() => {
    try {
      localStorage.setItem(focusStorageKey, focus);
    } catch {
      // ignore
    }
  }, [focus, focusStorageKey]);

  const monthlyTotals = useMemo(() => computeMonthlyTotals(entries, monthKey), [entries, monthKey]);
  const monthlyStars = monthlyTotals.totalStars;
  const monthlyMeditationStars = monthlyTotals.meditationStars;

  const monthlyFragments = useMemo(() => {
    const list = Array.isArray(entries) ? entries : [];
    const monthEntries = list.filter((e) => typeof e?.dateKey === "string" && e.dateKey.startsWith(monthKey));
    const hasReading = monthEntries.some((e) => e?.kind === "reading");
    if (hasReading) return 4;
    const meditationCount = monthEntries.filter((e) => e?.kind === "meditation").length;
    return Math.max(0, Math.min(4, meditationCount));
  }, [entries, monthKey]);

  const meditationYearlyStars = useMemo(() => {
    const yearKey = dateKey.slice(0, 4);
    return computeMeditationYearlyStars(entries, yearKey);
  }, [dateKey, entries]);

  const canCompleteReading = useMemo(() => {
    const titleOk = bookTitle.trim().length > 0;
    const authorOk = bookAuthor.trim().length > 0;
    const learnedOk = whatLearned.trim().length > 0;
    const fitsCap = monthlyStars + 2 <= 2;
    return titleOk && authorOk && learnedOk && fitsCap;
  }, [bookAuthor, bookTitle, monthlyStars, whatLearned]);

  const canCompleteMeditation = useMemo(() => {
    const mins = Number(minutes);
    const minsOk = Number.isFinite(mins) && mins > 0;
    const feltOk = feltBetter === true || feltBetter === false;
    const fitsTotalCap = monthlyStars + MEDITATION_STARS_AWARDED <= 2;
    const fitsMeditationCap = monthlyMeditationStars + MEDITATION_STARS_AWARDED <= 2;
    return minsOk && feltOk && fitsTotalCap && fitsMeditationCap;
  }, [feltBetter, minutes, monthlyMeditationStars, monthlyStars]);

  const completeReading = () => {
    if (!canCompleteReading) return;

    const nowIso = new Date().toISOString();
    const id = `mr-reading-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setEntries((prev) => [
      {
        id,
        dateKey,
        kind: "reading",
        starsAwarded: 2,
        title: bookTitle.trim(),
        author: bookAuthor.trim(),
        learned: whatLearned.trim(),
        lowEnergy: !!lowEnergy,
        createdAt: nowIso,
      },
      ...(Array.isArray(prev) ? prev : []),
    ]);

    setBookTitle("");
    setBookAuthor("");
    setWhatLearned("");
    setActiveTab(TAB_HISTORY);
  };

  const completeMeditation = () => {
    if (!canCompleteMeditation) return;

    const mins = Math.floor(Number(minutes));
    const nowIso = new Date().toISOString();
    const id = `mr-meditation-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setEntries((prev) => [
      {
        id,
        dateKey,
        kind: "meditation",
        starsAwarded: MEDITATION_STARS_AWARDED,
        minutes: mins,
        feltBetter: Boolean(feltBetter),
        lowEnergy: !!lowEnergy,
        createdAt: nowIso,
      },
      ...(Array.isArray(prev) ? prev : []),
    ]);

    setMinutes("");
    setFeltBetter(null);
    setActiveTab(TAB_HISTORY);
  };

  const historyEntries = useMemo(() => {
    const mapped = (Array.isArray(entries) ? entries : []).map((e) => {
      const dk = typeof e?.dateKey === "string" ? e.dateKey : "";
      const kind = e?.kind === "meditation" ? "meditation" : "reading";

      const isToken = e?.usedToken === true;

      const readingTitle = String(e?.title || "").trim();
      const readingAuthor = String(e?.author || "").trim();
      const readingLearned = String(e?.learned || "").trim();

      const text =
        kind === "reading"
          ? `Title: ${readingTitle}\nAuthor: ${readingAuthor}\nWhat I Learned: ${readingLearned}`
          : isToken
          ? `Used ${Math.max(0, Math.floor(Number(e?.tokensSpent) || TOKEN_COST_MEDITATION_HALF_STAR))} tokens for a 1/2 silver star.`
          : `Minutes: ${typeof e?.minutes === "number" ? e.minutes : ""}\nFelt Better: ${e?.feltBetter === true ? "Yes" : e?.feltBetter === false ? "No" : ""}`;

      return {
        id: typeof e?.id === "string" ? e.id : `mr-${kind}-${dk}`,
        dateKey: dk,
        title: dk ? formatEuropeanDate(dk) : "",
        timeOfDay: kind,
        text,
        createdAt: typeof e?.createdAt === "string" ? e.createdAt : new Date().toISOString(),
        lowEnergy: e?.lowEnergy === true,
        isToken,
      };
    });

    // DefaultHistoryTab expects chronological ordering (oldest -> newest within month groups).
    return mapped.sort((a, b) => {
      if (a.dateKey !== b.dateKey) return a.dateKey.localeCompare(b.dateKey);
      return String(a.createdAt).localeCompare(String(b.createdAt));
    });
  }, [entries]);

  const handleDeleteHistoryEntry = (entry) => {
    if (!entry?.id) return;

    const match = (Array.isArray(entries) ? entries : []).find((e) => e?.id === entry.id);
    const refund = Math.max(0, Math.floor(Number(match?.tokensSpent) || 0));
    if (match?.usedToken && refund > 0) {
      earnTokens({
        categoryId: category.id,
        amount: refund,
        source: "meditation-token-refund",
        meta: {
          subcategoryId: subcategory.id,
          dateKey: match?.dateKey,
          entryId: match?.id,
        },
      });
    }

    setEntries((prev) => (Array.isArray(prev) ? prev.filter((e) => e?.id !== entry.id) : prev));
  };

  const yearlyStars = useMemo(() => {
    const yearKey = dateKey.slice(0, 4);
    const sum = (Array.isArray(entries) ? entries : [])
      .filter((e) => typeof e?.dateKey === "string" && e.dateKey.startsWith(yearKey))
      .reduce((acc, e) => acc + (typeof e?.starsAwarded === "number" ? e.starsAwarded : 0), 0);
    return Math.max(0, sum);
  }, [dateKey, entries]);

  const avgChars = useMemo(() => {
    const reading = (Array.isArray(entries) ? entries : []).filter((e) => e?.kind === "reading");
    if (!reading.length) return 0;
    const total = reading.reduce((acc, e) => acc + String(e?.learned || "").length, 0);
    return Math.round(total / reading.length);
  }, [entries]);

  const trackerStats = useMemo(() => {
    const list = Array.isArray(entries) ? entries : [];
    const monthEntries = list.filter((e) => typeof e?.dateKey === "string" && e.dateKey.startsWith(monthKey));

    const monthReading = monthEntries.filter((e) => e?.kind === "reading");
    const monthMeditation = monthEntries.filter((e) => e?.kind === "meditation");

    const totalChoices = monthReading.length + monthMeditation.length;
    const readingPct = totalChoices ? Math.round((monthReading.length / totalChoices) * 100) : 0;
    const meditationPct = totalChoices ? 100 - readingPct : 0;

    const meditationMoodEligible = monthMeditation.filter((e) => e?.usedToken !== true);
    const meditationYes = meditationMoodEligible.filter((e) => e?.feltBetter === true).length;
    const meditationNo = meditationMoodEligible.filter((e) => e?.feltBetter === false).length;
    const meditationMoodTotal = meditationYes + meditationNo;
    const meditationYesPct = meditationMoodTotal
      ? Math.round((meditationYes / meditationMoodTotal) * 100)
      : 0;
    const meditationNoPct = meditationMoodTotal ? 100 - meditationYesPct : 0;

    const meditationMinutes = monthMeditation
      .filter((e) => e?.usedToken !== true)
      .map((e) => Number(e?.minutes))
      .filter((n) => Number.isFinite(n) && n > 0);
    const avgMeditationMinutes = meditationMinutes.length
      ? Math.round(meditationMinutes.reduce((a, b) => a + b, 0) / meditationMinutes.length)
      : 0;

    const titlesAllTime = [];
    const seen = new Set();
    list
      .filter((e) => e?.kind === "reading")
      .forEach((e) => {
        const t = String(e?.title || "").trim();
        if (!t) return;
        const key = t.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        titlesAllTime.push(t);
      });

    return {
      readingPct,
      meditationPct,
      meditationYesPct,
      meditationNoPct,
      avgMeditationMinutes,
      titlesAllTime,
      monthReadingCount: monthReading.length,
      monthMeditationCount: monthMeditation.length,
      monthMeditationMoodCount: meditationMoodTotal,
      monthMeditationYesCount: meditationYes,
      monthMeditationNoCount: meditationNo,
    };
  }, [entries, monthKey]);

  const canUseTokenForMeditation = useMemo(() => {
    const fitsTotalCap = monthlyStars + MEDITATION_STARS_AWARDED <= 2;
    const fitsMeditationCap = monthlyMeditationStars + MEDITATION_STARS_AWARDED <= 2;
    return fitsTotalCap && fitsMeditationCap;
  }, [monthlyMeditationStars, monthlyStars]);

  const confirmMeditationTokenUse = ({ lowEnergy: ctxLowEnergy } = {}) => {
    if (focus !== "meditation") return;
    if (!canUseTokenForMeditation) return;

    const spent = spendTokens({
      categoryId: category.id,
      amount: TOKEN_COST_MEDITATION_HALF_STAR,
      source: "meditation-token",
      meta: {
        subcategoryId: subcategory.id,
        dateKey,
        monthKey,
      },
    });

    if (!spent?.ok) return;

    const nowIso = new Date().toISOString();
    const id = `mr-meditation-token-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setEntries((prev) => [
      {
        id,
        dateKey,
        kind: "meditation",
        starsAwarded: MEDITATION_STARS_AWARDED,
        minutes: 0,
        feltBetter: null,
        usedToken: true,
        tokensSpent: TOKEN_COST_MEDITATION_HALF_STAR,
        lowEnergy: Boolean(ctxLowEnergy),
        createdAt: nowIso,
      },
      ...(Array.isArray(prev) ? prev : []),
    ]);

    setMinutes("");
    setFeltBetter(null);
    setActiveTab(TAB_HISTORY);
  };

  const tokenUseCount = useMemo(() => {
    return (Array.isArray(entries) ? entries : []).filter((e) => e?.usedToken).length;
  }, [entries]);

  const renderInput = ({ TokenControl } = {}) => {
    return (
      <div className="journal-input-fields">
        <div className="journal-field">
          <label className="journal-label">This Month’s Focus</label>

          <div className="journal-input-row">
            <button
              type="button"
              className="journal-button-secondary journal-focus-toggle"
              onClick={() => setFocus("meditation")}
              aria-pressed={focus === "meditation"}
            >
              Meditation
            </button>
            <button
              type="button"
              className="journal-button-secondary journal-focus-toggle"
              onClick={() => setFocus("reading")}
              aria-pressed={focus === "reading"}
            >
              Reading
            </button>
          </div>
        </div>

        {focus === "reading" ? (
          <>
            <div className="journal-field" style={{ marginTop: "0.9rem" }}>
              <label className="journal-label">Title</label>
              <input
                className="journal-input-text"
                type="text"
                value={bookTitle}
                onChange={(e) => setBookTitle(e.target.value)}
                placeholder="Book title"
              />
            </div>

            <div className="journal-field" style={{ marginTop: "0.9rem" }}>
              <label className="journal-label">Author</label>
              <input
                className="journal-input-text"
                type="text"
                value={bookAuthor}
                onChange={(e) => setBookAuthor(e.target.value)}
                placeholder="Author"
              />
            </div>

            <div className="journal-field" style={{ marginTop: "0.9rem" }}>
              <label className="journal-label">What I Learned</label>
              <textarea
                className="journal-textarea"
                value={whatLearned}
                onChange={(e) => setWhatLearned(e.target.value)}
                placeholder="Write what you learned..."
                rows={6}
              />
            </div>

            <div className="journal-actions-row" style={{ marginTop: "0.7rem" }}>
              <button
                type="button"
                className="journal-button-primary"
                onClick={completeReading}
                disabled={!canCompleteReading}
              >
                Complete
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="journal-field" style={{ marginTop: "0.9rem" }}>
              <label className="journal-label">Minutes Meditated</label>
              <input
                className="journal-input-text"
                type="number"
                inputMode="numeric"
                min={1}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="0"
              />
            </div>

            <div className="journal-field" style={{ marginTop: "0.9rem" }}>
              <label className="journal-label">Did it make you feel better?</label>
              <div className="journal-input-row">
                <button
                  type="button"
                  className="journal-button-secondary"
                  onClick={() => setFeltBetter(true)}
                  aria-pressed={feltBetter === true}
                >
                  Yes
                </button>
                <button
                  type="button"
                  className="journal-button-secondary"
                  onClick={() => setFeltBetter(false)}
                  aria-pressed={feltBetter === false}
                >
                  No
                </button>
              </div>
            </div>

            <div className="journal-actions-row" style={{ marginTop: "0.7rem" }}>
              <button
                type="button"
                className="journal-button-primary"
                onClick={completeMeditation}
                disabled={!canCompleteMeditation}
              >
                Complete
              </button>
            </div>

            {/* Token alternative (under Complete) */}
            {TokenControl && <TokenControl />}
          </>
        )}
      </div>
    );
  };

  // Provide a month-only starHistory override for the top bar.
  const monthStarHistory = useMemo(() => buildHalfStarHistoryFromEntries(entries, monthKey), [entries, monthKey]);
  const subcategoryWithMonthStars = useMemo(
    () => ({ ...subcategory, starHistory: monthStarHistory, currentStars: monthlyStars, monthMaxStars: 2 }),
    [monthStarHistory, monthlyStars, subcategory]
  );

  return (
    <SubcategoryShell
      category={category}
      subcategory={subcategoryWithMonthStars}
      onBack={onBack}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      renderInput={renderInput}
      historyEntries={historyEntries}
      historyTheme="air"
      onDeleteEntry={handleDeleteHistoryEntry}
      lowEnergy={!!lowEnergy}
      onPatchHistoryEntries={setEntries}
      renderTokenControl={() => null}
      tokenControlPlacement="manual"
      availableTokens={availableTokens}
      minTokensToApply={canUseTokenForMeditation ? TOKEN_COST_MEDITATION_HALF_STAR : Math.max(0, Math.floor(Number(availableTokens) || 0)) + 1}
      tokenModalContent={
        <p className="token-confirm-copy">
          Are you sure? All it takes is 5 minutes of meditation.
        </p>
      }
      onConfirmToken={confirmMeditationTokenUse}
      monthlyFragments={monthlyFragments}
      yearlyFragments={meditationYearlyStars}
      monthlyFragmentsMax={4}
      yearlyFragmentsMax={24}
      fragmentsLogged={monthlyStars}
      entriesLogged={Array.isArray(entries) ? entries.length : 0}
      avgChars={avgChars}
      totalStarsApprox={monthlyStars}
      tokensUsed={tokenUseCount}
      renderTracker={() => (
        <>
          <div className="tracker-section" style={{ marginBottom: "1rem" }}>
            <div className="tracker-label">Reading vs Meditation</div>

            <div className="tracker-bar-row">
              <span className="tracker-bar-label">Reading</span>
              <div className="tracker-bar-track">
                <div className="tracker-bar-fill" style={{ width: `${trackerStats.readingPct}%` }} />
              </div>
              <span className="tracker-bar-value">
                {trackerStats.monthReadingCount} ({trackerStats.readingPct}%)
              </span>
            </div>

            <div className="tracker-bar-row">
              <span className="tracker-bar-label">Meditation</span>
              <div className="tracker-bar-track">
                <div className="tracker-bar-fill" style={{ width: `${trackerStats.meditationPct}%` }} />
              </div>
              <span className="tracker-bar-value">
                {trackerStats.monthMeditationCount} ({trackerStats.meditationPct}%)
              </span>
            </div>
          </div>

          <div className="tracker-section" style={{ marginBottom: "1rem" }}>
            <div className="tracker-label">Meditation Felt Better</div>

            <div className="tracker-bar-row">
              <span className="tracker-bar-label">Yes</span>
              <div className="tracker-bar-track">
                <div className="tracker-bar-fill" style={{ width: `${trackerStats.meditationYesPct}%` }} />
              </div>
              <span className="tracker-bar-value">
                {trackerStats.monthMeditationYesCount} ({trackerStats.meditationYesPct}%)
              </span>
            </div>

            <div className="tracker-bar-row">
              <span className="tracker-bar-label">No</span>
              <div className="tracker-bar-track">
                <div className="tracker-bar-fill" style={{ width: `${trackerStats.meditationNoPct}%` }} />
              </div>
              <span className="tracker-bar-value">
                {trackerStats.monthMeditationNoCount} ({trackerStats.meditationNoPct}%)
              </span>
            </div>
          </div>

          <div className="tracker-card" style={{ marginBottom: "1rem" }}>
            <div className="tracker-label">Avg Minutes Meditated</div>
            <div className="tracker-value">
              {trackerStats.avgMeditationMinutes}
              <span className="tracker-unit"> min</span>
            </div>
          </div>

          <div className="tracker-card" style={{ marginBottom: "1rem" }}>
            <div className="tracker-label">Books Read</div>
            <div
              className="tracker-sub"
              style={{ whiteSpace: "pre-line", marginTop: "0.35rem" }}
            >
              {trackerStats.titlesAllTime.length ? trackerStats.titlesAllTime.join("\n") : "None yet"}
            </div>
          </div>
        </>
      )}
    />
  );
}

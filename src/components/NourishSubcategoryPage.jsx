import React, { useEffect, useMemo, useState } from "react";
import SubcategoryShell, { TAB_INPUT } from "./SubcategoryShell";
import ingredientCatalog from "../../data/nourish-ingredients.json";
import { earnTokens, spendTokens } from "../utils/tokens";
import { useCategoryTokenBalance } from "./Tokens";
import {
  buildNourishStarHistory,
  computeStarsFromFragmentsHistory,
  splitIngredients,
  buildKeywordList,
  findKeywordMatches,
  computeWaterByDay,
} from "../utils/nourish";

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

function emitNourishDataChanged(categoryId, subcategoryId) {
  window.dispatchEvent(
    new CustomEvent("nourish-data-changed", {
      detail: { categoryId, subcategoryId },
    })
  );
}

export default function NourishSubcategoryPage({ category, subcategory, onBack, lowEnergy }) {
  const [activeTab, setActiveTab] = useState(TAB_INPUT);

  const [editing, setEditing] = useState(null); // { kind: "meal"|"water", id: string }
  const [editingWaterOunces, setEditingWaterOunces] = useState("");

  const ENTRY_KEY = `nourishEntries:${category.id}:${subcategory.id}`;
  const WATER_KEY = `nourishWater:${category.id}:${subcategory.id}`;
  const TOKEN_KEY = `nourishTokens:${category.id}:${subcategory.id}`;

  const WATER_GOAL_OZ = 50;
  const TOKEN_COST_NOURISH = 1;

  const availableTokens = useCategoryTokenBalance(category.id);

  const [mealType, setMealType] = useState("breakfast");
  const [recipeTitle, setRecipeTitle] = useState("");
  const [ingredientsText, setIngredientsText] = useState("");

  const [mealEntries, setMealEntries] = useState(() => safeParseArray(localStorage.getItem(ENTRY_KEY)));
  const [waterEvents, setWaterEvents] = useState(() => safeParseArray(localStorage.getItem(WATER_KEY)));
  const [tokenUses, setTokenUses] = useState(() => safeParseArray(localStorage.getItem(TOKEN_KEY)));

  useEffect(() => {
    localStorage.setItem(ENTRY_KEY, JSON.stringify(Array.isArray(mealEntries) ? mealEntries : []));
    emitNourishDataChanged(category.id, subcategory.id);
  }, [ENTRY_KEY, category.id, mealEntries, subcategory.id]);

  useEffect(() => {
    localStorage.setItem(WATER_KEY, JSON.stringify(Array.isArray(waterEvents) ? waterEvents : []));
    emitNourishDataChanged(category.id, subcategory.id);
  }, [WATER_KEY, category.id, subcategory.id, waterEvents]);

  useEffect(() => {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(Array.isArray(tokenUses) ? tokenUses : []));
    emitNourishDataChanged(category.id, subcategory.id);
  }, [TOKEN_KEY, category.id, subcategory.id, tokenUses]);

  const proteinKeywords = useMemo(
    () => (Array.isArray(ingredientCatalog?.protein) ? ingredientCatalog.protein : []),
    []
  );
  const fiberKeywords = useMemo(
    () => (Array.isArray(ingredientCatalog?.fiber) ? ingredientCatalog.fiber : []),
    []
  );

  const derived = useMemo(
    () =>
      buildNourishStarHistory({
        mealEntries,
        waterEvents,
        tokenUses,
        proteinKeywords,
        fiberKeywords,
        waterGoalOz: WATER_GOAL_OZ,
      }),
    [fiberKeywords, mealEntries, proteinKeywords, tokenUses, waterEvents]
  );

  const starHistory = derived.starHistory;
  const currentStars = useMemo(() => computeStarsFromFragmentsHistory(starHistory), [starHistory]);

  const today = todayKey();
  const todayStatus = derived.statusByDay?.get(today);

  const creditedToday = (derived.creditedByDay?.get(today) ? 1 : 0) > 0;

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

  const todaysWaterOz = useMemo(() => {
    const map = computeWaterByDay(waterEvents);
    return map.get(today) || 0;
  }, [today, waterEvents]);

  const trackerStats = useMemo(() => {
    const meals = Array.isArray(mealEntries) ? mealEntries : [];
    const water = Array.isArray(waterEvents) ? waterEvents : [];

    const mealTypes = ["breakfast", "lunch", "dinner", "snack", "dessert"];
    const mealCounts = mealTypes.reduce((acc, t) => {
      acc[t] = 0;
      return acc;
    }, {});

    for (const m of meals) {
      const t = String(m?.mealType || "");
      if (mealCounts[t] !== undefined) mealCounts[t] += 1;
    }

    const totalMeals = mealTypes.reduce((sum, t) => sum + (mealCounts[t] || 0), 0);
    const mealPct = mealTypes.reduce((acc, t) => {
      acc[t] = totalMeals > 0 ? Math.round(((mealCounts[t] || 0) / totalMeals) * 100) : 0;
      return acc;
    }, {});

    const waterByDay = computeWaterByDay(water);
    let waterDays = 0;
    let waterTotal = 0;
    for (const [, oz] of waterByDay) {
      waterDays += 1;
      waterTotal += Number(oz) || 0;
    }
    const avgWater = waterDays > 0 ? Math.round(waterTotal / waterDays) : 0;

    const proteinList = buildKeywordList(proteinKeywords);
    const fiberList = buildKeywordList(fiberKeywords);

    const tallyTop = (keywordList) => {
      const counts = new Map();

      for (const m of meals) {
        const ings = splitIngredients(m?.ingredientsText);
        for (const ing of ings) {
          for (const kw of keywordList) {
            // keywordList is sorted longest-first
            if (` ${ing} `.includes(` ${kw} `)) {
              counts.set(kw, (counts.get(kw) || 0) + 1);
              break;
            }
          }
        }
      }

      const sorted = [...counts.entries()]
        .sort((a, b) => {
          if (b[1] !== a[1]) return b[1] - a[1];
          return String(a[0]).localeCompare(String(b[0]));
        })
        .slice(0, 5)
        .map(([keyword, count]) => ({ keyword, count }));

      const max = sorted.reduce((m, x) => Math.max(m, x.count), 0);
      return { list: sorted, max };
    };

    const topProtein = tallyTop(proteinList);
    const topFiber = tallyTop(fiberList);

    return {
      totalMeals,
      mealCounts,
      mealPct,
      avgWater,
      waterDays,
      topProtein,
      topFiber,
    };
  }, [fiberKeywords, mealEntries, proteinKeywords, waterEvents]);

  const tokenAlreadyToday = useMemo(
    () => (Array.isArray(tokenUses) ? tokenUses : []).some((t) => t?.dateKey === today),
    [today, tokenUses]
  );

  const canApplyToken = !creditedToday && !tokenAlreadyToday;

  const tokenModalContent = (
    <p className="token-confirm-copy">
      Spend {TOKEN_COST_NOURISH} token to add a 1/5 silver star for today.
    </p>
  );

  const resetMealForm = () => {
    setRecipeTitle("");
    setIngredientsText("");
  };

  const clearEditing = () => {
    setEditing(null);
    setEditingWaterOunces("");
  };

  const beginEdit = (entry) => {
    if (!entry || typeof entry?.id !== "string") return;

    if (entry.kind === "water") {
      const existing = (Array.isArray(waterEvents) ? waterEvents : []).find((w) => w?.id === entry.id);
      if (!existing) return;
      setEditing({ kind: "water", id: entry.id });
      setEditingWaterOunces(String(Number(existing?.ounces) || 0));
      setActiveTab(TAB_INPUT);
      return;
    }

    const existing = (Array.isArray(mealEntries) ? mealEntries : []).find((m) => m?.id === entry.id);
    if (!existing) return;
    setEditing({ kind: "meal", id: entry.id });
    setMealType(String(existing?.mealType || "breakfast"));
    setRecipeTitle(String(existing?.recipeTitle || ""));
    setIngredientsText(String(existing?.ingredientsText || ""));
    setActiveTab(TAB_INPUT);
  };

  const handleLogMeal = () => {
    const dk = todayKey();
    const title = recipeTitle.trim();
    const ingredients = ingredientsText.trim();
    if (!title && !ingredients) return;

    const nowIso = new Date().toISOString();

    const isEditingMeal = editing && editing.kind === "meal" && typeof editing.id === "string" && editing.id.length > 0;
    if (isEditingMeal) {
      setMealEntries((prev) =>
        (Array.isArray(prev) ? prev : []).map((m) =>
          m?.id === editing.id
            ? {
                ...m,
                updatedAt: nowIso,
                lowEnergy: typeof m?.lowEnergy === "boolean" ? m.lowEnergy : !!lowEnergy,
                mealType,
                recipeTitle: title,
                ingredientsText: ingredients,
              }
            : m
        )
      );
      clearEditing();
      resetMealForm();
      setActiveTab(TAB_HISTORY);
      return;
    }

    setMealEntries((prev) => [
      {
        id: `nourish-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        dateKey: dk,
        createdAt: nowIso,
        lowEnergy: !!lowEnergy,
        mealType,
        recipeTitle: title,
        ingredientsText: ingredients,
      },
      ...(Array.isArray(prev) ? prev : []),
    ]);

    resetMealForm();
  };

  const handleSaveWaterEdit = () => {
    const isEditingWater = editing && editing.kind === "water" && typeof editing.id === "string" && editing.id.length > 0;
    if (!isEditingWater) return;
    const oz = Math.max(0, Math.floor(Number(editingWaterOunces) || 0));
    if (oz <= 0) return;

    const nowIso = new Date().toISOString();

    setWaterEvents((prev) =>
      (Array.isArray(prev) ? prev : []).map((w) =>
        w?.id === editing.id
          ? {
              ...w,
              updatedAt: nowIso,
              lowEnergy: typeof w?.lowEnergy === "boolean" ? w.lowEnergy : !!lowEnergy,
              ounces: oz,
            }
          : w
      )
    );

    clearEditing();
    setActiveTab(TAB_HISTORY);
  };

  const addWater = (oz) => {
    const dk = todayKey();
    const n = Number(oz);
    if (!Number.isFinite(n) || n <= 0) return;

    const nowIso = new Date().toISOString();

    setWaterEvents((prev) => [
      {
        id: `water-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        dateKey: dk,
        createdAt: nowIso,
        lowEnergy: !!lowEnergy,
        ounces: n,
      },
      ...(Array.isArray(prev) ? prev : []),
    ]);
  };

  const onConfirmToken = () => {
    if (!canApplyToken) return;

    const res = spendTokens({
      categoryId: category.id,
      amount: TOKEN_COST_NOURISH,
      source: "nourish-token",
      meta: { subcategoryId: subcategory.id },
    });

    if (!res?.ok) return;

    const dk = todayKey();
    const nowIso = new Date().toISOString();

    setTokenUses((prev) => [
      {
        id: `nourtok-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        dateKey: dk,
        createdAt: nowIso,
        lowEnergy: !!lowEnergy,
        mealType: "nourish",
        isToken: true,
        tokensSpent: TOKEN_COST_NOURISH,
      },
      ...(Array.isArray(prev) ? prev : []),
    ]);
  };

  const handleDeleteHistoryEntry = (entry) => {
    if (!entry) return;

    if (entry.isToken) {
      const existing = (Array.isArray(tokenUses) ? tokenUses : []).find((t) => t?.id === entry.id);
      const refund = Math.max(0, Math.floor(Number(existing?.tokensSpent) || TOKEN_COST_NOURISH));

      setTokenUses((prev) => (Array.isArray(prev) ? prev.filter((t) => t?.id !== entry.id) : prev));

      if (refund > 0) {
        earnTokens({
          categoryId: category.id,
          amount: refund,
          source: "nourish-token-refund",
          meta: { subcategoryId: subcategory.id, dateKey: entry?.dateKey, entryId: entry?.id },
        });
      }
      return;
    }

    if (entry.kind === "water") {
      setWaterEvents((prev) => (Array.isArray(prev) ? prev.filter((w) => w?.id !== entry.id) : prev));
      return;
    }

    setMealEntries((prev) => (Array.isArray(prev) ? prev.filter((m) => m?.id !== entry.id) : prev));
  };

  const historyEntries = useMemo(() => {
    const meals = (Array.isArray(mealEntries) ? mealEntries : []).map((m) => {
      const dk = typeof m?.dateKey === "string" ? m.dateKey : "";
      const title = formatEuropeanDate(dk);
      const type = String(m?.mealType || "meal");

      const lines = [];
      if (m?.recipeTitle) lines.push(`Recipe: ${String(m.recipeTitle).trim()}`);
      if (m?.ingredientsText) lines.push(`Ingredients:\n${String(m.ingredientsText).trim()}`);

      return {
        id: m.id,
        dateKey: dk,
        createdAt: m.createdAt,
        lowEnergy: !!m.lowEnergy,
        timeOfDay: type,
        title,
        text: lines.join("\n\n"),
      };
    });

    const water = (Array.isArray(waterEvents) ? waterEvents : []).map((w) => {
      const dk = typeof w?.dateKey === "string" ? w.dateKey : "";
      const title = formatEuropeanDate(dk);
      const oz = Number(w?.ounces) || 0;
      return {
        id: w.id,
        kind: "water",
        dateKey: dk,
        createdAt: w.createdAt,
        lowEnergy: !!w.lowEnergy,
        timeOfDay: "water",
        title,
        text: `Water: +${oz} oz`,
      };
    });

    const tokens = (Array.isArray(tokenUses) ? tokenUses : []).map((t) => {
      const dk = typeof t?.dateKey === "string" ? t.dateKey : "";
      const title = formatEuropeanDate(dk);
      return {
        id: t.id,
        dateKey: dk,
        createdAt: t.createdAt,
        lowEnergy: !!t.lowEnergy,
        isToken: true,
        timeOfDay: "nourish",
        title,
      };
    });

    return [...meals, ...water, ...tokens].filter((e) => e?.dateKey);
  }, [mealEntries, tokenUses, waterEvents]);

  const renderInput = ({ TokenControl } = {}) => {
    const proteinList = buildKeywordList(proteinKeywords);
    const fiberList = buildKeywordList(fiberKeywords);

    const previewIngredients = splitIngredients(ingredientsText);
    const proteinMatches = findKeywordMatches(previewIngredients, proteinList);
    const fiberMatches = findKeywordMatches(previewIngredients, fiberList);

    return (
      <>
        {editing?.kind === "water" && (
          <div className="tracker-section" style={{ marginBottom: "1rem" }}>
            <div className="tracker-label">Edit water entry</div>
            <div className="journal-input-row" style={{ marginTop: "0.6rem" }}>
              <div className="journal-field" style={{ flex: 1, minWidth: 180 }}>
                <label className="journal-label">Ounces</label>
                <input
                  className="journal-input-text"
                  inputMode="numeric"
                  value={editingWaterOunces}
                  onChange={(e) => setEditingWaterOunces(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="journal-actions-row" style={{ marginTop: "0.9rem" }}>
              <button type="button" className="journal-button-primary" onClick={handleSaveWaterEdit}>
                Save Changes
              </button>
              <button
                type="button"
                className="journal-button-secondary"
                onClick={() => {
                  clearEditing();
                  setActiveTab(TAB_HISTORY);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="tracker-section">
          <div className="tracker-label">Meal</div>
          <div className="journal-input-row" style={{ marginTop: "0.6rem" }}>
            {[
              { id: "breakfast", label: "Breakfast" },
              { id: "lunch", label: "Lunch" },
              { id: "dinner", label: "Dinner" },
              { id: "snack", label: "Snack" },
              { id: "dessert", label: "Dessert" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                className="journal-button-secondary"
                aria-pressed={mealType === opt.id}
                onClick={() => setMealType(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="journal-field" style={{ marginTop: "0.9rem" }}>
          <label className="journal-label">Recipe title</label>
          <input
            className="journal-input-text"
            value={recipeTitle}
            onChange={(e) => setRecipeTitle(e.target.value)}
            placeholder="Recipe name"
          />
        </div>

        <div className="journal-field" style={{ marginTop: "0.9rem" }}>
          <label className="journal-label">Ingredients</label>
          <textarea
            className="journal-textarea"
            value={ingredientsText}
            onChange={(e) => setIngredientsText(e.target.value)}
            placeholder="One per line (or comma-separated)"
          />
          <div className="tracker-sub" style={{ marginTop: "0.5rem" }}>
            This entry matches {proteinMatches.size} protein and {fiberMatches.size} fiber keywords.
          </div>
        </div>

        <div className="journal-actions-row" style={{ marginTop: "0.9rem" }}>
          <button type="button" className="journal-button-primary" onClick={handleLogMeal}>
            {editing?.kind === "meal" ? "Save Changes" : "Log Meal"}
          </button>
          {editing?.kind === "meal" && (
            <button
              type="button"
              className="journal-button-secondary"
              onClick={() => {
                clearEditing();
                resetMealForm();
                setActiveTab(TAB_HISTORY);
              }}
            >
              Cancel
            </button>
          )}
        </div>

        <div style={{ marginTop: "0.6rem" }}>{TokenControl && <TokenControl />}</div>

        <div className="tracker-section" style={{ marginTop: "1rem" }}>
          <div className="tracker-label">Water</div>
          <div className="tracker-sub" style={{ marginTop: "0.25rem" }}>
            Today: {todaysWaterOz} / {WATER_GOAL_OZ} oz
          </div>
          <div className="journal-input-row" style={{ marginTop: "0.6rem" }}>
            {[8, 12, 24].map((oz) => (
              <button
                key={oz}
                type="button"
                className="journal-button-secondary"
                onClick={() => addWater(oz)}
              >
                +{oz} oz
              </button>
            ))}
          </div>
        </div>

        <div className="tracker-section" style={{ marginTop: "1rem" }}>
          <div className="tracker-label">Today’s fragment rule</div>
          <div className="tracker-sub" style={{ marginTop: "0.25rem" }}>
            Needs: at least 1 protein + 2 fiber ingredients (across meals) and {WATER_GOAL_OZ} oz water.
          </div>
          <div className="tracker-sub" style={{ marginTop: "0.5rem" }}>
            Status: {todayStatus?.hasProtein ? "✓" : "✕"} protein, {todayStatus?.hasFiber ? "✓" : "✕"} fiber,
            {todayStatus?.hitWater ? "✓" : "✕"} water — {creditedToday ? "1/5 earned" : "not earned yet"}.
          </div>
          {creditedToday && (
            <div className="tracker-sub" style={{ marginTop: "0.4rem" }}>
              You can still log meals; stars are capped at 1/5 per day.
            </div>
          )}
        </div>
      </>
    );
  };

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
      minTokensToApply={canApplyToken ? TOKEN_COST_NOURISH : 9999}
      tokenModalContent={tokenModalContent}
      onConfirmToken={onConfirmToken}
      tokensUsed={monthly.tokenCredited}
      monthlyFragments={monthly.credited}
      yearlyFragments={yearly.credited}
      monthlyFragmentsMax={monthlyFragmentsMax}
      yearlyFragmentsMax={yearlyFragmentsMax}
      fragmentsLogged={derived.fragmentsEarned}
      entriesLogged={(Array.isArray(mealEntries) ? mealEntries.length : 0) + (Array.isArray(waterEvents) ? waterEvents.length : 0) + (Array.isArray(tokenUses) ? tokenUses.length : 0)}
      avgChars={0}
      totalStarsApprox={currentStars}
      renderTracker={() => (
        <div className="journal-tracker">
          <div className="tracker-card" style={{ marginBottom: "1rem" }}>
            <div className="tracker-label">Average water intake per day</div>
            <div className="tracker-value">{trackerStats.avgWater} oz</div>
            <div className="tracker-sub">Based on {trackerStats.waterDays} day(s) logged</div>
          </div>

          <div className="tracker-section">
            <div className="tracker-label">Meal</div>

            {[
              { id: "breakfast", label: "Breakfast" },
              { id: "lunch", label: "Lunch" },
              { id: "dinner", label: "Dinner" },
              { id: "snack", label: "Snack" },
              { id: "dessert", label: "Dessert" },
            ].map((row) => (
              <div key={row.id} className="tracker-bar-row">
                <span className="tracker-bar-label">{row.label}</span>
                <div className="tracker-bar-track">
                  <div className="tracker-bar-fill" style={{ width: `${trackerStats.mealPct[row.id] || 0}%` }} />
                </div>
                <span className="tracker-bar-value">
                  {trackerStats.mealCounts[row.id] || 0} ({trackerStats.mealPct[row.id] || 0}%)
                </span>
              </div>
            ))}
          </div>

          <div className="tracker-section" style={{ marginTop: "1rem" }}>
            <div className="tracker-label">Top 5 protein ingredients</div>
            {trackerStats.topProtein.list.length === 0 ? (
              <div className="tracker-sub" style={{ marginTop: "0.4rem" }}>No matches yet.</div>
            ) : (
              trackerStats.topProtein.list.map((x) => (
                <div key={x.keyword} className="tracker-bar-row">
                  <span className="tracker-bar-label">{x.keyword}</span>
                  <div className="tracker-bar-track">
                    <div
                      className="tracker-bar-fill"
                      style={{ width: `${trackerStats.topProtein.max ? Math.round((x.count / trackerStats.topProtein.max) * 100) : 0}%` }}
                    />
                  </div>
                  <span className="tracker-bar-value">{x.count}</span>
                </div>
              ))
            )}
          </div>

          <div className="tracker-section" style={{ marginTop: "1rem" }}>
            <div className="tracker-label">Top 5 fiber ingredients</div>
            {trackerStats.topFiber.list.length === 0 ? (
              <div className="tracker-sub" style={{ marginTop: "0.4rem" }}>No matches yet.</div>
            ) : (
              trackerStats.topFiber.list.map((x) => (
                <div key={x.keyword} className="tracker-bar-row">
                  <span className="tracker-bar-label">{x.keyword}</span>
                  <div className="tracker-bar-track">
                    <div
                      className="tracker-bar-fill"
                      style={{ width: `${trackerStats.topFiber.max ? Math.round((x.count / trackerStats.topFiber.max) * 100) : 0}%` }}
                    />
                  </div>
                  <span className="tracker-bar-value">{x.count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    />
  );
}

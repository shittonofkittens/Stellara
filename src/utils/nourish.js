// src/utils/nourish.js

function normalizeText(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeKeyword(input) {
  return normalizeText(input);
}

export function splitIngredients(text) {
  const raw = String(text || "");
  return raw
    .split(/\n|,|;|\u2022|\u00b7/g)
    .map((s) => normalizeText(s))
    .filter(Boolean);
}

export function buildKeywordList(list) {
  const arr = Array.isArray(list) ? list : [];
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    const k = normalizeKeyword(item);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  // Prefer longer phrases first to reduce accidental short matches.
  out.sort((a, b) => b.length - a.length);
  return out;
}

function ingredientHasKeyword(ingredientNorm, keywordNorm) {
  if (!ingredientNorm || !keywordNorm) return false;
  const hay = ` ${ingredientNorm} `;
  const needle = ` ${keywordNorm} `;
  return hay.includes(needle);
}

export function findKeywordMatches(ingredientsNorm, keywordListNorm) {
  const ingredients = Array.isArray(ingredientsNorm) ? ingredientsNorm : [];
  const keywords = Array.isArray(keywordListNorm) ? keywordListNorm : [];
  const matches = new Set();

  for (const ing of ingredients) {
    if (!ing) continue;
    for (const kw of keywords) {
      if (!kw) continue;
      if (ingredientHasKeyword(ing, kw)) {
        matches.add(kw);
      }
    }
  }

  return matches;
}

export function computeWaterByDay(waterEvents) {
  const list = Array.isArray(waterEvents) ? waterEvents : [];
  const map = new Map();

  for (const e of list) {
    const dk = typeof e?.dateKey === "string" ? e.dateKey : "";
    if (!dk) continue;
    const oz = Number(e?.ounces);
    if (!Number.isFinite(oz) || oz <= 0) continue;
    map.set(dk, (map.get(dk) || 0) + oz);
  }

  return map;
}

export function computeNourishStatusByDay({ mealEntries, waterEvents, proteinKeywords, fiberKeywords, waterGoalOz = 50 }) {
  const meals = Array.isArray(mealEntries) ? mealEntries : [];
  const water = Array.isArray(waterEvents) ? waterEvents : [];

  const proteinList = buildKeywordList(proteinKeywords);
  const fiberList = buildKeywordList(fiberKeywords);

  const mealsByDay = new Map();
  for (const m of meals) {
    const dk = typeof m?.dateKey === "string" ? m.dateKey : "";
    if (!dk) continue;
    const arr = mealsByDay.get(dk) || [];
    arr.push(m);
    mealsByDay.set(dk, arr);
  }

  const waterByDay = computeWaterByDay(water);
  const allDays = new Set([...mealsByDay.keys(), ...waterByDay.keys()]);

  const statusByDay = new Map();

  for (const dk of allDays) {
    const dayMeals = mealsByDay.get(dk) || [];
    const allIngredients = [];

    for (const m of dayMeals) {
      allIngredients.push(...splitIngredients(m?.ingredientsText));
    }

    const proteinMatches = findKeywordMatches(allIngredients, proteinList);
    const fiberMatches = findKeywordMatches(allIngredients, fiberList);
    const waterOz = waterByDay.get(dk) || 0;

    const hasProtein = proteinMatches.size >= 1;
    const hasFiber = fiberMatches.size >= 2;
    const hitWater = waterOz >= waterGoalOz;

    statusByDay.set(dk, {
      dateKey: dk,
      proteinMatches,
      fiberMatches,
      waterOz,
      hasProtein,
      hasFiber,
      hitWater,
      qualifies: hasProtein && hasFiber && hitWater,
    });
  }

  return statusByDay;
}

export function buildNourishStarHistory({ mealEntries, waterEvents, tokenUses, proteinKeywords, fiberKeywords, waterGoalOz = 50 }) {
  const tokens = Array.isArray(tokenUses) ? tokenUses : [];

  const statusByDay = computeNourishStatusByDay({
    mealEntries,
    waterEvents,
    proteinKeywords,
    fiberKeywords,
    waterGoalOz,
  });

  // Pick at most 1 credited fragment per day.
  // If the day qualifies naturally, prefer gold and ignore tokens for star credit.
  // Otherwise, if any token exists for that day, credit silver.
  const creditEvents = [];
  const creditedByDay = new Map();

  const tokenByDay = new Map();
  for (const t of tokens) {
    const dk = typeof t?.dateKey === "string" ? t.dateKey : "";
    if (!dk) continue;
    const prev = tokenByDay.get(dk);
    const createdAt = typeof t?.createdAt === "string" ? t.createdAt : "";
    if (!prev || String(createdAt).localeCompare(String(prev.createdAt || "")) < 0) {
      tokenByDay.set(dk, { createdAt, token: t });
    }
  }

  const allDays = new Set([...statusByDay.keys(), ...tokenByDay.keys()]);
  const sortedDays = [...allDays].sort((a, b) => String(a).localeCompare(String(b)));

  for (const dk of sortedDays) {
    const st = statusByDay.get(dk);
    if (st?.qualifies) {
      creditEvents.push({
        dateKey: dk,
        createdAt: `${dk}T23:59:59.999Z`,
        usedToken: false,
      });
      creditedByDay.set(dk, { usedToken: false });
      continue;
    }

    const tok = tokenByDay.get(dk);
    if (tok) {
      creditEvents.push({
        dateKey: dk,
        createdAt: tok.createdAt || `${dk}T00:00:00.000Z`,
        usedToken: true,
      });
      creditedByDay.set(dk, { usedToken: true });
    }
  }

  creditEvents.sort((a, b) => {
    const ak = `${a.dateKey}__${a.createdAt || ""}`;
    const bk = `${b.dateKey}__${b.createdAt || ""}`;
    return String(ak).localeCompare(String(bk));
  });

  const starHistory = [];
  let current = new Array(5).fill(undefined);

  creditEvents.forEach((ev, index) => {
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

  const fragmentsEarned = creditEvents.length;
  const tokenCredited = creditEvents.filter((e) => e.usedToken).length;

  return {
    starHistory,
    fragmentsEarned,
    tokenCredited,
    creditedByDay,
    statusByDay,
  };
}

export function computeStarsFromFragmentsHistory(starHistory) {
  const history = Array.isArray(starHistory) ? starHistory : [];
  let filled = 0;
  for (const s of history) {
    const frags = Array.isArray(s?.fragments) ? s.fragments : [];
    filled += frags.filter((v) => v === "gold" || v === "silver").length;
  }
  return filled / 5;
}

// src/utils/hygiene.js

export const HYGIENE_TASKS = [
  { id: "shower_body", label: "Shower (Just Body)" },
  { id: "shower_hair_body", label: "Shower (Hair and Body)" },
  { id: "brush_floss", label: "Brush/Floss Teeth" },
  { id: "brush_hair", label: "Brush Hair" },
  { id: "clean_clothes", label: "Wear Clean Clothes" },
  { id: "moisturize", label: "Moisturize" },
  { id: "nails", label: "Nails" },
  { id: "deodorant", label: "Deodorant" },
  { id: "clean_ears", label: "Clean Ears" },
  { id: "skin_care", label: "Skin Care" },
];

export const HYGIENE_TASK_IDS = HYGIENE_TASKS.map((t) => t.id);

function uniq(arr) {
  const out = [];
  const seen = new Set();
  for (const v of Array.isArray(arr) ? arr : []) {
    const s = String(v || "");
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export function computeHygieneStatusByDay({ entries, tasksPerDay = 2 }) {
  const list = Array.isArray(entries) ? entries : [];
  const byDay = new Map();

  for (const e of list) {
    const dk = typeof e?.dateKey === "string" ? e.dateKey : "";
    if (!dk) continue;
    const tasks = uniq(e?.tasks);

    const set = byDay.get(dk) || new Set();
    for (const t of tasks) set.add(t);
    byDay.set(dk, set);
  }

  const statusByDay = new Map();
  for (const [dk, set] of byDay) {
    const uniqueTasks = set.size;
    statusByDay.set(dk, {
      dateKey: dk,
      uniqueTasks,
      qualifies: uniqueTasks >= tasksPerDay,
      tasks: new Set(set),
    });
  }

  return statusByDay;
}

export function buildHygieneStarHistory({ entries, tokenUses, tasksPerDay = 2 }) {
  const statusByDay = computeHygieneStatusByDay({ entries, tasksPerDay });

  const tokens = Array.isArray(tokenUses) ? tokenUses : [];
  const tokenByDay = new Map();
  for (const t of tokens) {
    const dk = typeof t?.dateKey === "string" ? t.dateKey : "";
    if (!dk) continue;
    const createdAt = typeof t?.createdAt === "string" ? t.createdAt : "";
    const prev = tokenByDay.get(dk);
    if (!prev || String(createdAt).localeCompare(String(prev.createdAt || "")) < 0) {
      tokenByDay.set(dk, { createdAt, token: t });
    }
  }

  // At most 1 fragment/day: prefer gold if the day qualifies.
  const creditEvents = [];
  const creditedByDay = new Map();

  const allDays = new Set([...statusByDay.keys(), ...tokenByDay.keys()]);
  const sortedDays = [...allDays].sort((a, b) => String(a).localeCompare(String(b)));

  for (const dk of sortedDays) {
    const st = statusByDay.get(dk);
    if (st?.qualifies) {
      creditEvents.push({ dateKey: dk, createdAt: `${dk}T23:59:59.999Z`, usedToken: false });
      creditedByDay.set(dk, { usedToken: false });
      continue;
    }

    const tok = tokenByDay.get(dk);
    if (tok) {
      creditEvents.push({ dateKey: dk, createdAt: tok.createdAt || `${dk}T00:00:00.000Z`, usedToken: true });
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

  return {
    starHistory,
    creditedByDay,
    statusByDay,
    fragmentsEarned: creditEvents.length,
    tokenCredited: creditEvents.filter((e) => e.usedToken).length,
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

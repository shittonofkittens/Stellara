// src/components/Constellation.jsx
import React, { useEffect, useId, useMemo, useState } from "react";
import { earnTokens, getTokenBalance, spendTokens } from "../utils/tokens";
import ConstellationPage from "./ConstellationPage";

const COMPLETION_KEY_PREFIX = "constellationCompletion:";

function completionKey(categoryId) {
  return `${COMPLETION_KEY_PREFIX}${categoryId}`;
}

function safeParseJson(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function readCompletionMap(categoryId) {
  const raw = localStorage.getItem(completionKey(categoryId));
  const obj = safeParseJson(raw || "{}", {});
  return obj && typeof obj === "object" ? obj : {};
}

function writeCompletionMap(categoryId, map) {
  localStorage.setItem(completionKey(categoryId), JSON.stringify(map || {}));
  try {
    window.dispatchEvent(
      new CustomEvent("constellations-changed", {
        detail: { categoryId },
      })
    );
  } catch {
    // ignore
  }
}

function normalizeSlug(slug) {
  return String(slug || "")
    .trim()
    .toLowerCase();
}

function clampInt(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function getCompletionCount(entry) {
  if (!entry) return 0;
  if (typeof entry === "number") return clampInt(entry, 0, 3);
  if (typeof entry !== "object") return 1;

  if (typeof entry.completions === "number") return clampInt(entry.completions, 0, 3);
  if (typeof entry.tier === "number") return clampInt(entry.tier, 0, 3);
  // Back-compat: old records were objects without a count; treat as first completion.
  return 1;
}

function getTierNameFromCount(count) {
  if (count === 1) return "silver";
  if (count === 2) return "gold";
  if (count === 3) return "iridium";
  return "";
}

function getTierColorFromCount(count) {
  if (count === 1) return "#dfe3f2";
  if (count === 2) return "#ffd86a";
  if (count === 3) return "#747bff";
  return "rgba(255, 255, 255, 0.68)";
}

function getStarsSpent(entry, starCount) {
  if (entry && typeof entry === "object" && typeof entry.starsSpent === "number") {
    return Math.max(0, Math.floor(entry.starsSpent));
  }
  return Math.max(0, getCompletionCount(entry)) * Math.max(0, Math.floor(Number(starCount) || 0));
}

function tierTokenAward(starCount, tierCount) {
  const n = Math.max(0, Math.floor(Number(starCount) || 0));
  const base = Math.floor(n / 2);
  if (tierCount === 1) return base;
  if (tierCount === 2) return base + 1;
  if (tierCount === 3) return base + 2;
  return 0;
}

function computeViewFromCoords(coords) {
  const stars = Array.isArray(coords?.stars) ? coords.stars : [];
  if (stars.length === 0) {
    return {
      viewBox: "0 0 1 1",
      strokeWidth: 0.003,
      starRadius: 0.01,
    };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of stars) {
    const x = typeof p?.x === "number" ? p.x : NaN;
    const y = typeof p?.y === "number" ? p.y : NaN;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return {
      viewBox: "0 0 1 1",
      strokeWidth: 0.003,
      starRadius: 0.01,
    };
  }

  const w = Math.max(0.0001, maxX - minX);
  const h = Math.max(0.0001, maxY - minY);
  const pad = Math.max(w, h) * 0.25;

  const x0 = minX - pad;
  const y0 = minY - pad;
  const vw = w + pad * 2;
  const vh = h + pad * 2;

  const strokeWidth = Math.max(0.0015, Math.min(0.01, vw * 0.003));
  const starRadius = Math.max(0.006, Math.min(0.03, vw * 0.012));

  return {
    viewBox: `${x0} ${y0} ${vw} ${vh}`,
    strokeWidth,
    starRadius,
  };
}

function ConstellationSvg({ coords, view, color, glowEnabled = false }) {
  if (!coords?.stars?.length) return null;

  const lines = Array.isArray(coords.lines) ? coords.lines : [];
  const stars = Array.isArray(coords.stars) ? coords.stars : [];
  const uid = useId();
  const safeUid = String(uid).replace(/[^a-zA-Z0-9_-]/g, "");
  const glowId = `constellation-glow-${safeUid || "0"}`;
  const glowStrokeWidth = Math.min(0.05, Math.max(view.strokeWidth * 3.25, 0.004));
  const glowStarRadius = Math.min(0.08, Math.max(view.starRadius * 1.85, 0.012));
  const glowBlur = Math.min(0.08, Math.max(Math.max(glowStrokeWidth, glowStarRadius) * 1.25, 0.012));

  const [vbX, vbY, vbW, vbH] = String(view?.viewBox || "0 0 1 1")
    .trim()
    .split(/\s+/)
    .map((n) => Number(n));
  const vbOk = [vbX, vbY, vbW, vbH].every((n) => Number.isFinite(n));
  const pad = vbOk ? Math.max(vbW, vbH) * 0.55 : 0;

  return (
    <svg viewBox={view.viewBox} preserveAspectRatio="xMidYMid meet" className="constellation-svg">
      {glowEnabled && (
        <defs>
          <filter
            id={glowId}
            filterUnits="userSpaceOnUse"
            primitiveUnits="userSpaceOnUse"
            x={vbOk ? vbX - pad : undefined}
            y={vbOk ? vbY - pad : undefined}
            width={vbOk ? vbW + pad * 2 : undefined}
            height={vbOk ? vbH + pad * 2 : undefined}
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation={glowBlur} result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1.8 0"
              result="boost"
            />
            <feMerge>
              <feMergeNode in="boost" />
            </feMerge>
          </filter>
        </defs>
      )}

      {/* Glow underlay pass (only after stars applied) */}
      {glowEnabled &&
        lines.map(([a, b], idx) => {
          const s = stars[a];
          const e = stars[b];
          if (!s || !e) return null;
          return (
            <line
              key={`glow-${idx}`}
              x1={s.x}
              y1={s.y}
              x2={e.x}
              y2={e.y}
              stroke={color}
              strokeWidth={glowStrokeWidth}
              opacity={0.55}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={`url(#${glowId})`}
            />
          );
        })}

      {glowEnabled &&
        stars.map((p, idx) => (
          <circle
            key={`glow-star-${idx}`}
            cx={p.x}
            cy={p.y}
            r={glowStarRadius}
            fill={color}
            opacity={0.6}
            filter={`url(#${glowId})`}
          />
        ))}

      {lines.map(([a, b], idx) => {
        const s = stars[a];
        const e = stars[b];
        if (!s || !e) return null;
        return (
          <line
            key={idx}
            x1={s.x}
            y1={s.y}
            x2={e.x}
            y2={e.y}
            stroke={color}
            strokeWidth={view.strokeWidth}
            opacity={0.9}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}

      {stars.map((p, idx) => (
        <circle
          key={idx}
          cx={p.x}
          cy={p.y}
          r={view.starRadius}
          fill={color}
          opacity={0.95}
        />
      ))}
    </svg>
  );
}

function ConstellationCardPreview({ slug, dataModules, color, glowEnabled = false }) {
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const s = normalizeSlug(slug);
    if (!s) {
      setCoords(null);
      return;
    }

    const key = `../../data/constellations/${s}_coords.json`;
    const loader = dataModules?.[key];
    if (!loader) {
      setCoords(null);
      return;
    }

    loader()
      .then((mod) => {
        if (cancelled) return;
        setCoords(mod?.default || null);
      })
      .catch(() => {
        if (cancelled) return;
        setCoords(null);
      });

    return () => {
      cancelled = true;
    };
  }, [dataModules, slug]);

  const view = useMemo(() => computeViewFromCoords(coords), [coords]);

  return (
    <div className="constellation-card-preview">
      <ConstellationSvg coords={coords} view={view} color={color} glowEnabled={glowEnabled} />
    </div>
  );
}

function starFractionFromEntry(entry) {
  if (entry && Array.isArray(entry.fragments)) {
    const frags = entry.fragments.slice(0, 5);
    const filled = frags.filter((v) => v === "gold" || v === "silver").length;
    return Math.max(0, Math.min(1, filled / 5));
  }

  if (entry && Array.isArray(entry.halves)) {
    const halves = entry.halves.slice(0, 2);
    const filled = halves.filter((v) => v === "gold" || v === "silver").length;
    return Math.max(0, Math.min(1, filled / 2));
  }

  if (typeof entry === "number") {
    return Math.max(0, Math.min(1, entry));
  }

  if (entry && typeof entry === "object" && typeof entry.fraction === "number") {
    return Math.max(0, Math.min(1, entry.fraction));
  }

  return 0;
}

function isFullStarEntry(entry) {
  if (entry && Array.isArray(entry.fragments)) {
    const frags = entry.fragments.slice(0, 5);
    const filled = frags.filter((v) => v === "gold" || v === "silver").length;
    return filled >= 5;
  }

  if (entry && Array.isArray(entry.halves)) {
    const halves = entry.halves.slice(0, 2);
    const filled = halves.filter((v) => v === "gold" || v === "silver").length;
    return filled >= 2;
  }

  if (typeof entry === "number") {
    return entry >= 0.999;
  }

  if (entry && typeof entry === "object" && typeof entry.fraction === "number") {
    return entry.fraction >= 0.999;
  }

  return false;
}

function tokenUsedForFullStarEntry(entry) {
  if (!isFullStarEntry(entry)) return false;

  if (entry && Array.isArray(entry.fragments)) {
    return entry.fragments.slice(0, 5).some((v) => v === "silver");
  }

  if (entry && Array.isArray(entry.halves)) {
    return entry.halves.slice(0, 2).some((v) => v === "silver");
  }

  if (entry && typeof entry === "object" && typeof entry.fraction === "number") {
    return Boolean(entry.usedToken);
  }

  return false;
}

function buildEarnedStarPool(category) {
  const subs = Array.isArray(category?.subcategories) ? category.subcategories : [];
  const pool = [];

  subs.forEach((s) => {
    const history = Array.isArray(s?.starHistory) ? s.starHistory : [];
    history.forEach((e) => {
      if (!isFullStarEntry(e)) return;
      pool.push({ tokenUsed: tokenUsedForFullStarEntry(e) });
    });
  });

  return pool;
}

function totalFullStarsFromCategory(category) {
  const subs = Array.isArray(category?.subcategories) ? category.subcategories : [];
  let sum = 0;

  subs.forEach((s) => {
    const history = Array.isArray(s?.starHistory) ? s.starHistory : [];
    history.forEach((e) => {
      if (isFullStarEntry(e)) sum += 1;
    });
  });

  return Math.max(0, Math.floor(sum));
}

export default function Constellation({ category, constellations, onBack }) {
  const categoryId = category?.id || "";
  const list = Array.isArray(constellations) ? constellations : [];

  const [selectedSlug, setSelectedSlug] = useState(list[0]?.slug || "");
  const [activeDetailSlug, setActiveDetailSlug] = useState(null);
  const [completionMap, setCompletionMap] = useState(() => (categoryId ? readCompletionMap(categoryId) : {}));
  const [tokenBalance, setTokenBalance] = useState(() => (categoryId ? getTokenBalance(categoryId) : 0));

  useEffect(() => {
    if (!categoryId) return;
    setCompletionMap(readCompletionMap(categoryId));
    setTokenBalance(getTokenBalance(categoryId));

    const handler = (ev) => {
      if (ev?.detail?.categoryId && ev.detail.categoryId !== categoryId) return;
      setTokenBalance(getTokenBalance(categoryId));
    };

    const constellationsHandler = (ev) => {
      if (ev?.detail?.categoryId && ev.detail.categoryId !== categoryId) return;
      setCompletionMap(readCompletionMap(categoryId));
    };

    window.addEventListener("tokens-changed", handler);
    window.addEventListener("constellations-changed", constellationsHandler);
    return () => {
      window.removeEventListener("tokens-changed", handler);
      window.removeEventListener("constellations-changed", constellationsHandler);
    };
  }, [categoryId]);

  useEffect(() => {
    if (!selectedSlug && list[0]?.slug) setSelectedSlug(list[0].slug);
  }, [list, selectedSlug]);

  useEffect(() => {
    if (!activeDetailSlug) return;
    const exists = list.some((c) => normalizeSlug(c.slug) === normalizeSlug(activeDetailSlug));
    if (!exists) setActiveDetailSlug(null);
  }, [activeDetailSlug, list]);

  const dataModules = useMemo(() => {
    // Vite will bundle these JSON files.
    return import.meta.glob("../../data/constellations/*_coords.json");
  }, []);

  const scrollToSlug = (slug) => {
    const s = normalizeSlug(slug);
    if (!s) return;
    const el = document.getElementById(`constellation-card-${s}`);
    if (!el) return;
    try {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      el.scrollIntoView();
    }
  };

  const availableStars = useMemo(() => totalFullStarsFromCategory(category), [category]);

  const earnedStarPool = useMemo(() => buildEarnedStarPool(category), [category]);

  const spentStars = useMemo(() => {
    if (!list.length) return 0;
    return list.reduce((sum, c) => {
      const slug = normalizeSlug(c?.slug);
      if (!slug) return sum;
      return sum + getStarsSpent(completionMap?.[slug], c?.starCount);
    }, 0);
  }, [completionMap, list]);

  const starsAvailableToSpend = useMemo(() => Math.max(0, (availableStars || 0) - spentStars), [availableStars, spentStars]);

  const activeConstellation = useMemo(() => {
    if (!activeDetailSlug) return null;
    const s = normalizeSlug(activeDetailSlug);
    return list.find((c) => normalizeSlug(c.slug) === s) || null;
  }, [activeDetailSlug, list]);

  const activeCompletionCount = useMemo(() => {
    if (!activeConstellation?.slug) return 0;
    return getCompletionCount(completionMap?.[normalizeSlug(activeConstellation.slug)]);
  }, [activeConstellation?.slug, completionMap]);

  const activeTokensUsed = useMemo(() => {
    const slug = normalizeSlug(activeConstellation?.slug);
    const rec = slug ? completionMap?.[slug] : null;
    if (rec && typeof rec === "object" && typeof rec.tokensUsed === "number") return Math.max(0, Math.floor(rec.tokensUsed));
    return 0;
  }, [activeConstellation?.slug, completionMap]);

  if (activeConstellation) {
    return (
      <ConstellationPage
        category={category}
        constellation={activeConstellation}
        completionCount={activeCompletionCount}
        tokensUsed={activeTokensUsed}
        availableStars={starsAvailableToSpend}
        tokenBalance={tokenBalance}
        onBack={() => setActiveDetailSlug(null)}
        onApply={() => {
          if (!categoryId) return;

          const slug = normalizeSlug(activeConstellation.slug);
          if (!slug) return;

          const starCost = Math.max(0, Math.floor(Number(activeConstellation.starCount) || 0));
          if (starCost <= 0) return;

          const current = readCompletionMap(categoryId);
          const prevRec = current?.[slug];
          const prevCount = getCompletionCount(prevRec);
          if (prevCount >= 3) return;

          // Recompute available stars at click time.
          const spentNow = list.reduce((sum, c) => {
            const s = normalizeSlug(c?.slug);
            if (!s) return sum;
            return sum + getStarsSpent(current?.[s], c?.starCount);
          }, 0);

          const earnedNow = totalFullStarsFromCategory(category);
          const availableNow = Math.max(0, earnedNow - spentNow);
          if (availableNow < starCost) return;

          // Attribute how many of the stars being spent were token-made.
          // We treat the category's earned stars as a FIFO pool.
          const pool = buildEarnedStarPool(category);
          const startIndex = Math.max(0, Math.min(pool.length, spentNow));
          const endIndex = Math.max(startIndex, Math.min(pool.length, startIndex + starCost));
          let tokenUsedFromPool = 0;
          for (let i = startIndex; i < endIndex; i += 1) {
            if (pool[i]?.tokenUsed) tokenUsedFromPool += 1;
          }

          const nextCount = prevCount + 1;
          const tierName = getTierNameFromCount(nextCount);
          const tokensEarned = tierTokenAward(starCost, nextCount);

          const prevStarsSpent = getStarsSpent(prevRec, activeConstellation.starCount);
          const prevTokensUsed =
            prevRec && typeof prevRec === "object" && typeof prevRec.tokensUsed === "number"
              ? Math.max(0, Math.floor(prevRec.tokensUsed))
              : 0;

          const prevSpendEvents =
            prevRec && typeof prevRec === "object" && Array.isArray(prevRec.spendEvents)
              ? prevRec.spendEvents
              : [];

          const next = {
            ...current,
            [slug]: {
              ...(prevRec && typeof prevRec === "object" ? prevRec : {}),
              completions: nextCount,
              lastTier: tierName,
              lastCompletedAt: new Date().toISOString(),
              starsSpent: prevStarsSpent + starCost,
              tokensUsed: prevTokensUsed + tokenUsedFromPool,
              spendEvents: [
                ...prevSpendEvents,
                {
                  at: new Date().toISOString(),
                  stars: starCost,
                  tokenUsedStars: tokenUsedFromPool,
                  tier: nextCount,
                },
              ],
              lastTokensEarned: tokensEarned,
              starCount: starCost,
              name: activeConstellation.name,
            },
          };

          writeCompletionMap(categoryId, next);
          setCompletionMap(next);

          if (tokensEarned > 0) {
            earnTokens({
              categoryId,
              amount: tokensEarned,
              source: "constellation-apply",
              meta: { slug, name: activeConstellation.name, starCount: starCost, tier: tierName },
            });
            setTokenBalance(getTokenBalance(categoryId));
          }
        }}
        onUndo={() => {
          if (!categoryId) return;

          const slug = normalizeSlug(activeConstellation.slug);
          if (!slug) return;

          const current = readCompletionMap(categoryId);
          const prevRec = current?.[slug];
          const prevCount = getCompletionCount(prevRec);
          if (prevCount <= 0) return;

          const starCost =
            prevRec && typeof prevRec === "object" && typeof prevRec.starCount === "number"
              ? Math.max(0, Math.floor(prevRec.starCount))
              : Math.max(0, Math.floor(Number(activeConstellation.starCount) || 0));
          if (starCost <= 0) return;

          const revoke = tierTokenAward(starCost, prevCount);
          if (revoke > 0) {
            const res = spendTokens({
              categoryId,
              amount: revoke,
              source: "constellation-undo",
              meta: { slug, name: activeConstellation.name, starCount: starCost, tier: getTierNameFromCount(prevCount) },
            });
            if (!res?.ok) return;
          }

          const nextCount = prevCount - 1;
          const prevStarsSpent = getStarsSpent(prevRec, starCost);
          const nextStarsSpent = Math.max(0, prevStarsSpent - starCost);

          const prevTokensUsed =
            prevRec && typeof prevRec === "object" && typeof prevRec.tokensUsed === "number"
              ? Math.max(0, Math.floor(prevRec.tokensUsed))
              : 0;

          const prevSpendEvents =
            prevRec && typeof prevRec === "object" && Array.isArray(prevRec.spendEvents)
              ? prevRec.spendEvents
              : [];

          const lastEvent = prevSpendEvents.length ? prevSpendEvents[prevSpendEvents.length - 1] : null;
          const tokenUsedToRefund =
            lastEvent && typeof lastEvent === "object" && typeof lastEvent.tokenUsedStars === "number"
              ? Math.max(0, Math.floor(lastEvent.tokenUsedStars))
              : 0;
          const nextTokensUsed = Math.max(0, prevTokensUsed - tokenUsedToRefund);

          const nextSpendEvents = prevSpendEvents.length ? prevSpendEvents.slice(0, -1) : prevSpendEvents;

          const next = { ...current };

          if (nextCount <= 0) {
            delete next[slug];
          } else {
            next[slug] = {
              ...(prevRec && typeof prevRec === "object" ? prevRec : {}),
              completions: nextCount,
              lastTier: getTierNameFromCount(nextCount),
              lastCompletedAt: new Date().toISOString(),
              starsSpent: nextStarsSpent,
              tokensUsed: nextTokensUsed,
              spendEvents: nextSpendEvents,
              lastTokensEarned: tierTokenAward(starCost, nextCount),
              starCount: starCost,
              name: activeConstellation.name,
            };
          }

          writeCompletionMap(categoryId, next);
          setCompletionMap(next);
          setTokenBalance(getTokenBalance(categoryId));
        }}
      />
    );
  }

  return (
    <main className="subcategory-page">
      <div className="subcategory-topbar">
        <header className="subcategory-page-header">
          <div
            className="subcategory-header-top"
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.9rem" }}>
              <button type="button" className="back-button" onClick={onBack} aria-label="Back">
                ←
              </button>
              <div className="subcategory-page-titles">
                <div className="subcategory-page-breadcrumb">CONSTELLATIONS · {String(category?.label || "").toUpperCase()}</div>
                <div className="subcategory-page-date">Tokens: {tokenBalance}</div>
              </div>
            </div>
          </div>
        </header>

        {list.length > 0 && (
          <div className="constellations-shortcutbar">
            <div className="constellations-shortcut-label">Jump to</div>
            <select
              className="journal-input-text"
              value={selectedSlug}
              onChange={(e) => {
                const next = e.target.value;
                setSelectedSlug(next);
                scrollToSlug(next);
              }}
            >
              {list.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>

            <div className="constellations-stars-available">
              {starsAvailableToSpend} stars
            </div>
          </div>
        )}
      </div>

      <section className="subcategory-content">
        <div className="subcategory-input-container">
          <div className="tracker-section">
            <div className="tracker-label">All Constellations</div>
          </div>

          {list.length > 0 && (
            <div className="tracker-section" style={{ marginTop: "0.9rem" }}>
              <div className="constellations-grid">
                {list.map((c) => {
                  const slug = normalizeSlug(c.slug);
                  const count = getCompletionCount(completionMap[slug]);
                  const color = getTierColorFromCount(count);
                  const isSelected = slug && slug === normalizeSlug(selectedSlug);
                  return (
                    <button
                      key={c.slug}
                      id={`constellation-card-${slug}`}
                      type="button"
                      className={`constellation-card${isSelected ? " is-selected" : ""}`}
                      onClick={() => {
                        setSelectedSlug(c.slug);
                        setActiveDetailSlug(c.slug);
                      }}
                    >
                      <ConstellationCardPreview slug={c.slug} dataModules={dataModules} color={color} glowEnabled={count > 0} />
                      <div className="constellation-card-meta">
                        <div className="constellation-card-name">{c.name}</div>
                        <div className="constellation-card-count">{c.starCount} stars</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {list.length === 0 && (
            <div className="tracker-section">
              <div className="tracker-sub">No constellations configured yet.</div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

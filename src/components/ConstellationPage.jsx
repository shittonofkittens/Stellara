import React, { useEffect, useId, useMemo, useState } from "react";

function normalizeSlug(slug) {
  return String(slug || "")
    .trim()
    .toLowerCase();
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

function tierNameFromCount(count) {
  if (count === 1) return "Silver";
  if (count === 2) return "Gold";
  if (count === 3) return "Iridium";
  return "No stars applied";
}

function tierColorFromCount(count) {
  if (count === 1) return "#dfe3f2";
  if (count === 2) return "#ffd86a";
  if (count === 3) return "#747bff";
  return "rgba(255, 255, 255, 0.68)";
}

function tierTokenAward(starCount, tierCount) {
  const n = Math.max(0, Math.floor(Number(starCount) || 0));
  const base = Math.floor(n / 2);
  if (tierCount === 1) return base;
  if (tierCount === 2) return base + 1;
  if (tierCount === 3) return base + 2;
  return 0;
}

export default function ConstellationPage({
  category,
  constellation,
  completionCount,
  tokensUsed,
  availableStars,
  tokenBalance,
  onApply,
  onUndo,
  onBack,
}) {
  const dataModules = useMemo(() => import.meta.glob("../../data/constellations/*_coords.json"), []);
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const slug = normalizeSlug(constellation?.slug);
    if (!slug) {
      setCoords(null);
      return;
    }

    const key = `../../data/constellations/${slug}_coords.json`;
    const loader = dataModules[key];
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
  }, [dataModules, constellation?.slug]);

  const view = useMemo(() => computeViewFromCoords(coords), [coords]);

  const tierColor = useMemo(() => tierColorFromCount(completionCount), [completionCount]);
  const tierName = useMemo(() => tierNameFromCount(completionCount), [completionCount]);

  const starsNeeded = Math.max(0, Math.floor(Number(constellation?.starCount) || 0));
  const maxed = completionCount >= 3;
  const canApply = !maxed && availableStars >= starsNeeded && starsNeeded > 0;

  const usedAnyTokenStars = Math.max(0, Math.floor(Number(tokensUsed) || 0)) > 0;

  const canUndo = completionCount > 0;
  const tokensToRevoke = tierTokenAward(starsNeeded, completionCount);
  const canUndoWithTokens = (Number(tokenBalance) || 0) >= tokensToRevoke;

  const silverTokens = tierTokenAward(starsNeeded, 1);
  const goldTokens = tierTokenAward(starsNeeded, 2);
  const iridiumTokens = tierTokenAward(starsNeeded, 3);

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
                <div className="subcategory-page-breadcrumb">
                  CONSTELLATIONS · {String(category?.label || "").toUpperCase()} · {String(constellation?.name || "").toUpperCase()}
                </div>
                <div className="subcategory-page-date">
                  Tokens: {tokenBalance} · Stars available: {availableStars}
                </div>
              </div>
            </div>
          </div>
        </header>
      </div>

      <section className="subcategory-content">
        <div className="subcategory-input-container">
          <div className="tracker-section">
            <div className="tracker-label">Constellation</div>
            <div className="constellation-stage" style={{ borderColor: tierColor }}>
              <ConstellationSvg coords={coords} view={view} color={tierColor} glowEnabled={completionCount > 0} />
            </div>
            {!coords && (
              <div className="tracker-sub" style={{ marginTop: "0.6rem" }}>
                No coordinate data found for this constellation yet.
              </div>
            )}
          </div>

          <div className="tracker-section" style={{ marginTop: "0.9rem" }}>
            <div className="tracker-label">Tier</div>
            <div className="tracker-sub" style={{ marginTop: "0.25rem" }}>
              Current tier: {tierName}
            </div>
            <div className="tracker-sub" style={{ marginTop: "0.25rem" }}>
              Tokens used in applied stars: {usedAnyTokenStars ? "Yes" : "No"}
            </div>

            <div className="journal-actions-row" style={{ marginTop: "0.75rem" }}>
              <button
                type="button"
                className="journal-button-primary"
                disabled={!canApply}
                onClick={onApply}
              >
                {maxed ? "Max tier reached" : `Apply ${starsNeeded} stars`}
              </button>

              <button
                type="button"
                className="journal-button-secondary"
                disabled={!canUndo || !canUndoWithTokens}
                onClick={onUndo}
              >
                Undo application
              </button>
            </div>

            {!canUndoWithTokens && canUndo && (
              <div className="tracker-sub" style={{ marginTop: "0.5rem" }}>
                Not enough tokens to undo this tier.
              </div>
            )}
          </div>

          <div className="tracker-section" style={{ marginTop: "0.9rem" }}>
            <div className="tracker-label">Tiered Tokens Earned</div>
            <div className="tracker-sub" style={{ marginTop: "0.35rem" }}>
              Silver: + {silverTokens} Tokens
            </div>
            <div className="tracker-sub" style={{ marginTop: "0.35rem" }}>
              Gold: + {goldTokens} Tokens
            </div>
            <div className="tracker-sub" style={{ marginTop: "0.35rem" }}>
              Iridium: + {iridiumTokens} Tokens
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

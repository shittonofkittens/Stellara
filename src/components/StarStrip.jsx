// src/components/StarStrip.jsx
import React from "react";
import rawStarPoints from "../../data/star-points.json";

// Normalize points from JSON: supports [{x,y}] or [[x,y]]
function normalizePoint(p) {
  if (Array.isArray(p)) {
    const [x, y] = p;
    return { x, y };
  }
  if (p && typeof p === "object") {
    if ("x" in p && "y" in p) return { x: p.x, y: p.y };
    return { x: p[0], y: p[1] };
  }
  return { x: 0, y: 0 };
}

const starPoints = rawStarPoints.map(normalizePoint);

// Bounding box so viewBox fits your coordinates
const xs = starPoints.map((p) => p.x);
const ys = starPoints.map((p) => p.y);
const minX = Math.min(...xs);
const maxX = Math.max(...xs);
const minY = Math.min(...ys);
const maxY = Math.max(...ys);
const width = maxX - minX || 100;
const height = maxY - minY || 100;

// 1/5 segments
const SEGMENT_INDICES = [
  [0, 1, 2, 3],
  [0, 3, 4, 5],
  [0, 5, 6, 7],
  [0, 7, 8, 9],
  [0, 9, 10, 1],
];

// 1/2-star halves
const HALF_INDICES = [
  [0, 2, 3, 4, 5, 6, 7],       // half A
  [0, 7, 8, 9, 10, 1, 2],      // half B
];

const GOLD_COLOR = "#ffd86a";
const SILVER_COLOR = "#dfe3f2";

function buildPolygonPoints(indices) {
  return indices
    .map((i) => {
      const p = starPoints[i];
      return `${p.x},${p.y}`;
    })
    .join(" ");
}

// Entry shapes:
// 1) { fragments: ["gold" | "silver", ...] }  // 1/5 fragments, max 5
// 2) { halves: ["gold" | "silver", ...] }     // 1/2 halves, max 2
// 3) number                                  // fraction 0–1
// 4) { fraction, usedToken }
function normalizeEntry(entry) {
  if (entry && Array.isArray(entry.fragments)) {
    return {
      mode: "fragments",
      fragments: entry.fragments,
    };
  }

  if (entry && Array.isArray(entry.halves)) {
    return {
      mode: "halves",
      halves: entry.halves,
    };
  }

  if (typeof entry === "number") {
    return {
      mode: "fraction",
      fraction: entry,
      usedToken: false,
    };
  }

  if (entry && typeof entry === "object" && typeof entry.fraction === "number") {
    return {
      mode: "fraction",
      fraction: entry.fraction,
      usedToken: Boolean(entry.usedToken),
    };
  }

  return {
    mode: "fraction",
    fraction: 0,
    usedToken: false,
  };
}

function StarStrip({ starHistory = [], accentColor }) {
  if (!starHistory || starHistory.length === 0) {
    return (
      <div className="star-strip empty-strip">
        <span className="empty-strip-text">
          No stars recorded yet this month.
        </span>
      </div>
    );
  }

  return (
    <div className="star-strip">
      {starHistory.map((raw, index) => {
        const norm = normalizeEntry(raw);

        return (
          <div key={index} className="star-strip-item">
            <svg
              viewBox={`${minX} ${minY} ${width} ${height}`}
              className="star-icon"
              aria-hidden="true"
            >
              <defs>
                <filter
                  id="glow-gold"
                  x="-50%"
                  y="-50%"
                  width="200%"
                  height="200%"
                >
                  <feGaussianBlur
                    in="SourceGraphic"
                    stdDeviation="1.4"
                    result="blur"
                  />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter
                  id="glow-silver"
                  x="-50%"
                  y="-50%"
                  width="200%"
                  height="200%"
                >
                  <feGaussianBlur
                    in="SourceGraphic"
                    stdDeviation="1.4"
                    result="blur"
                  />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* FILL LOGIC */}
              {norm.mode === "fragments" &&
                SEGMENT_INDICES.map((indices, segIndex) => {
                  const frag = norm.fragments[segIndex];

                  let fill;
                  let filter;

                  if (frag === "gold") {
                    fill = GOLD_COLOR;
                    filter = "url(#glow-gold)";
                  } else if (frag === "silver") {
                    fill = SILVER_COLOR;
                    filter = "url(#glow-silver)";
                  } else {
                    // not earned yet → grey fragment
                    fill = "rgba(255, 255, 255, 0.15)";
                    filter = undefined;
                  }

                  return (
                    <polygon
                      key={segIndex}
                      points={buildPolygonPoints(indices)}
                      fill={fill}
                      filter={filter}
                    />
                  );
                })}

              {norm.mode === "halves" &&
                HALF_INDICES.map((indices, halfIndex) => {
                  const half = norm.halves[halfIndex];

                  if (!half) {
                    // no half earned yet → leave base grey visible
                    return null;
                  }

                  const isGold = half === "gold";
                  const fill = isGold ? GOLD_COLOR : SILVER_COLOR;
                  const filter = isGold ? "url(#glow-gold)" : "url(#glow-silver)";

                  return (
                    <polygon
                        key={halfIndex}
                        points={buildPolygonPoints(indices)}
                        fill={fill}
                        filter={filter}
                    />
                  );
                })}

              {norm.mode === "fraction" &&
                SEGMENT_INDICES.map((indices, segIndex) => {
                  const segmentsFilled = Math.max(
                    0,
                    Math.min(5, Math.floor(norm.fraction / 0.2 + 0.0001))
                  );
                    const filled = segIndex < segmentsFilled;

                    if (!filled) {
                      // empty segment: grey base star covers it
                      return null;
                    }

                    const color = norm.usedToken ? SILVER_COLOR : GOLD_COLOR;
                    const filter = norm.usedToken
                      ? "url(#glow-silver)"
                      : "url(#glow-gold)";

                    return (
                      <polygon
                        key={segIndex}
                        points={buildPolygonPoints(indices)}
                        fill={color}
                        filter={filter}
                      />
                    );
                })}
            </svg>
          </div>
        );
      })}
    </div>
  );
}

export default StarStrip;

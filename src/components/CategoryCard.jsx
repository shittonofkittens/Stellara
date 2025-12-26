// src/components/CategoryCard.jsx
import React, { useMemo, useState } from "react";
import SubcategoryCard from "./SubcategoryCard";
import { useCategoryTokenBalance } from "./Tokens";

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

function sumStarsFromSubcategories(subcategories) {
  const subs = Array.isArray(subcategories) ? subcategories : [];
  let sum = 0;
  subs.forEach((s) => {
    const history = Array.isArray(s?.starHistory) ? s.starHistory : [];
    history.forEach((e) => {
      sum += starFractionFromEntry(e);
    });
  });
  return sum;
}

function sumFullStarsFromSubcategories(subcategories) {
  const subs = Array.isArray(subcategories) ? subcategories : [];
  let sum = 0;
  subs.forEach((s) => {
    const history = Array.isArray(s?.starHistory) ? s.starHistory : [];
    history.forEach((e) => {
      if (isFullStarEntry(e)) sum += 1;
    });
  });
  return sum;
}

function CategoryCard({ category, onOpenSubcategory, onOpenConstellations }) {
  const [open, setOpen] = useState(false);

  const {
    id,
    label,
    element,
    color,
    soul,
    subcategories,
  } = category;

  const tokenBalance = useCategoryTokenBalance(id);

  const totalFullStars = useMemo(() => {
    return Math.max(0, Math.floor(sumFullStarsFromSubcategories(subcategories)));
  }, [subcategories]);

  const handleHeaderClick = () => {
    setOpen((prev) => !prev);
  };

  const handleOpenConstellations = (e) => {
    e?.stopPropagation?.();
    e?.preventDefault?.();
    onOpenConstellations?.(id);
  };

  return (
    <section className={`category-card category-${id}`}>
      <button
        type="button"
        className="category-header"
        onClick={handleHeaderClick}
      >
        <div className="category-title-block">
          <div
            className="category-element-pill"
            style={{ backgroundColor: color }}
          >
            <span className="category-label">{label}</span>
            <span className="category-element">{element}</span>
          </div>

          <div className="category-meta">
            <button
              type="button"
              className="meta-item meta-item-button"
              onClick={handleOpenConstellations}
              aria-label={`Open ${label} constellations`}
            >
              <span className="meta-label">Stars</span>
              <span className="meta-value">{totalFullStars}</span>
            </button>
            <div className="meta-item">
              <span className="meta-label">Tokens</span>
              <span className="meta-value">{tokenBalance}</span>
            </div>
          </div>
        </div>

        <div className="category-right">
          {soul && <span className="category-soul">★ {soul}</span>}
          <span className={`chevron ${open ? "chevron-open" : ""}`}>▾</span>
        </div>
      </button>

      {open && (
        <div className="subcategory-list">
          {subcategories.map((sub) => (
            <SubcategoryCard
              key={sub.id}
              categoryId={id}
              subcategory={sub}
              accentColor={color}
              onOpenSubcategory={onOpenSubcategory}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default CategoryCard;

// src/components/CategoryCard.jsx
import React, { useState } from "react";
import SubcategoryCard from "./SubcategoryCard";

function CategoryCard({ category, onOpenSubcategory }) {
  const [open, setOpen] = useState(false);

  const {
    id,
    label,
    element,
    color,
    totalStars,
    tokens,
    soul,
    subcategories,
  } = category;

  const handleHeaderClick = () => {
    setOpen((prev) => !prev);
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
            <div className="meta-item">
              <span className="meta-label">Stars</span>
              <span className="meta-value">{totalStars.toFixed(1)}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Tokens</span>
              <span className="meta-value">{tokens}</span>
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

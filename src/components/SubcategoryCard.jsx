// src/components/SubcategoryCard.jsx
import React from "react";
import StarStrip from "./StarStrip";

function formatFragmentsPerDay(value) {
  if (!value || value <= 0) return "0 fragments per day";

  const fifths = Math.round(value / 0.2); // 0.2 = 1 fragment
  const label =
    fifths === 1 ? "1 fragment per day" : `${fifths} fragments per day`;

  return label;
}

function SubcategoryCard({
  categoryId,
  subcategory,
  accentColor,
  onOpenSubcategory,
}) {
  const {
    id,
    label,
    currentStars,
    monthMaxStars,
    fragmentsPerDay,
    completedToday,
    starHistory,
  } = subcategory;

  const handleOpenTracker = () => {
    if (typeof onOpenSubcategory === "function") {
      onOpenSubcategory(categoryId, id);
    }
  };

  return (
    <article
      className="subcategory-card"
      onClick={handleOpenTracker}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") handleOpenTracker();
      }}
    >
      <header className="subcategory-header">
        <div className="subcategory-title-block">
          <h3 className="subcategory-label">{label}</h3>
          <p className="subcategory-stars">
            {currentStars}/{monthMaxStars} stars
          </p>
          <p className="subcategory-fragments">
            {formatFragmentsPerDay(fragmentsPerDay)}
          </p>
        </div>

        <div className="subcategory-status">
          <div
            className={`today-bubble ${
              completedToday ? "today-bubble-complete" : ""
            }`}
            style={
              completedToday ? { backgroundColor: accentColor } : undefined
            }
          />
          <span className="today-label">Today</span>
        </div>
      </header>

      <div className="subcategory-strip-wrapper">
        <StarStrip accentColor={accentColor} starHistory={starHistory} />
      </div>
    </article>
  );
}

export default SubcategoryCard;

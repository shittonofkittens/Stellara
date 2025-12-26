// src/components/SubcategoryCard.jsx
import React from "react";
import StarStrip from "./StarStrip";

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
    completedToday,
    starHistory,
  } = subcategory;

  const monthlyFragments =
    typeof subcategory?.monthlyFragments === "number" ? subcategory.monthlyFragments : null;

  const monthlyFragmentsMax =
    typeof subcategory?.monthlyFragmentsMax === "number" ? subcategory.monthlyFragmentsMax : null;

  const currentFragments =
    typeof subcategory?.currentFragments === "number" ? subcategory.currentFragments : 0;

  const isJournal = id === "journal";

  const showCompleteBubble = id !== "therapy" && id !== "meditation" && completedToday;

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
      {showCompleteBubble && (
        <div
          className="today-bubble today-bubble-complete subcategory-complete-bubble"
          style={{ backgroundColor: accentColor }}
          aria-label="Completed today"
        />
      )}
      <header className="subcategory-header">
        <div className="subcategory-title-block">
          <h3 className="subcategory-label">{label}</h3>
          <p className="subcategory-stars">
            {typeof monthlyFragments === "number" && Number.isFinite(monthlyFragments)
              ? typeof monthlyFragmentsMax === "number" && Number.isFinite(monthlyFragmentsMax)
                ? `${monthlyFragments} / ${monthlyFragmentsMax} fragments`
                : `${monthlyFragments} fragments`
              : isJournal
              ? `${currentFragments} fragments`
              : `${currentStars} stars`}
          </p>
        </div>
      </header>

      <div className="subcategory-strip-wrapper">
        <StarStrip accentColor={accentColor} starHistory={starHistory} />
      </div>
    </article>
  );
}

export default SubcategoryCard;

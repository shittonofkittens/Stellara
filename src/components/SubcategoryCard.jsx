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

  const currentFragments =
    typeof subcategory?.currentFragments === "number" ? subcategory.currentFragments : 0;

  const isJournal = id === "journal";

  const showToday = id !== "therapy" && id !== "meditation" && !isJournal;
  const showJournalCompleteBubble = isJournal && completedToday;

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
      {showJournalCompleteBubble && (
        <div
          className="today-bubble today-bubble-complete journal-complete-bubble"
          style={{ backgroundColor: accentColor }}
          aria-label="Journal completed today"
        />
      )}
      <header className="subcategory-header">
        <div className="subcategory-title-block">
          <h3 className="subcategory-label">{label}</h3>
          <p className="subcategory-stars">
            {isJournal
              ? `${currentFragments} fragments`
              : `${currentStars} stars`}
          </p>
        </div>

        {showToday && (
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
        )}
      </header>

      <div className="subcategory-strip-wrapper">
        <StarStrip accentColor={accentColor} starHistory={starHistory} />
      </div>
    </article>
  );
}

export default SubcategoryCard;

// src/components/SubcategoryPage.jsx
import React from "react";
import SubcategoryShell, {
  TAB_INPUT,
  TAB_HISTORY,
  TAB_TRACKER,
} from "./SubcategoryShell";
import JournalSubcategoryPage from "./JournalSubcategoryPage";

/**
 * Decides which subcategory implementation to render.
 * Journal uses its own page; others currently just show
 * a simple "coming soon" content inside the shared shell.
 */
function SubcategoryPage({ category, subcategory, onBack }) {
  // Mind → Journal uses the dedicated journal page
  if (category.id === "mind" && subcategory.id === "journal") {
    return (
      <JournalSubcategoryPage
        category={category}
        subcategory={subcategory}
        onBack={onBack}
      />
    );
  }

  // Default: generic shell with placeholder content.
  // Later, Therapy, Movement, etc. will each get their own component
  // similar to JournalSubcategoryPage.
  const [activeTab, setActiveTab] = React.useState(TAB_INPUT);

  return (
    <SubcategoryShell
      category={category}
      subcategory={subcategory}
      onBack={onBack}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      renderInput={() => (
        <div className="journal-input">
          <div className="journal-history-empty">
            Custom input for this subcategory is coming soon.
          </div>
        </div>
      )}
      renderHistory={() => (
        <div className="journal-history-empty">
          History view for this subcategory is coming soon.
        </div>
      )}
      renderTracker={() => (
        <div className="journal-tracker">
          <div className="tracker-card">
            <div className="tracker-label">Tracker</div>
            <div className="tracker-value">
              Analytics for this subcategory will live here.
            </div>
          </div>
        </div>
      )}
    />
  );
}

export default SubcategoryPage;

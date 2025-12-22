// src/components/SubcategoryShell.jsx
import React, { useRef, useState } from "react";

export const TAB_INPUT = "input";
export const TAB_HISTORY = "history";
export const TAB_TRACKER = "tracker";

function SubcategoryShell({
  category,
  subcategory,
  onBack,
  activeTab,
  onTabChange,
  renderInput,
  renderHistory,
  renderTracker,
  summaryLabel,
  summaryValue,
  historyEntries,
  historyTheme,
  onRequestEditEntry, 
  renderTokenControl,
  tokenModalContent,
}) {
  const today = new Date();

  const formattedDate = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(today);

  const [showTokenModal, setShowTokenModal] = useState(false);
  const [availableTokens] = useState(3); // stub for now

  const handleConfirmToken = () => {
    // PHASE 1 STUB
    console.log("Token confirmed (stub)");
    setShowTokenModal(false);
  };

  const themeClass =
    category.id === "mind"
      ? "subcategory-page-air"
      : category.id === "body"
      ? "subcategory-page-earth"
      : category.id === "will"
      ? "subcategory-page-fire"
      : category.id === "spirit"
      ? "subcategory-page-water"
      : "";

  return (
    <main className={`subcategory-page ${themeClass}`}>
      {/* Top bar: header + tabs (sticky via CSS) */}
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
            {/* left cluster: back + title + date */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.9rem" }}>
              <button
                type="button"
                className="back-button"
                onClick={onBack}
                aria-label="Back"
              >
                ←
              </button>

              <div className="subcategory-page-titles">
                <div className="subcategory-page-breadcrumb">
                  {category.label.toUpperCase()} · {subcategory.label.toUpperCase()}
                </div>
                <div className="subcategory-page-date">{formattedDate}</div>
              </div>
            </div>

            {/* right cluster: summary */}
            <div className="summary-block">
              <div className="summary-label">{summaryLabel || "This month"}</div>
              <div className="summary-value">
                {summaryValue !== undefined && summaryValue !== null
                  ? summaryValue
                  : `${subcategory.currentStars.toFixed(1)} / ${subcategory.monthMaxStars}`}
              </div>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="subcategory-tabs">
          <button
            type="button"
            className={`subcategory-tab ${activeTab === TAB_INPUT ? "is-active" : ""}`}
            onClick={() => onTabChange(TAB_INPUT)}
          >
            Input
          </button>
          <button
            type="button"
            className={`subcategory-tab ${activeTab === TAB_HISTORY ? "is-active" : ""}`}
            onClick={() => onTabChange(TAB_HISTORY)}
          >
            History
          </button>
          <button
            type="button"
            className={`subcategory-tab ${activeTab === TAB_TRACKER ? "is-active" : ""}`}
            onClick={() => onTabChange(TAB_TRACKER)}
          >
            Tracker
          </button>
        </div>
      </div>

      {/* Tab content */}
      <section className="subcategory-content">
        {activeTab === TAB_INPUT && (
          <div className="subcategory-input-container">
            {renderInput && renderInput()}

            {renderTokenControl && (
              <div className="use-token-container">
                <div className="use-token-label">USE TOKEN</div>
                <div className="use-token-count">
                    {availableTokens} tokens available
                </div>

                <div className="use-token-controls">
                  <button
                    className="token-select"
                    onClick={() => setShowTokenModal(true)}
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === TAB_HISTORY && (
          <div className="subcategory-history-container">
            {renderHistory ? (
              renderHistory()
            ) : (
              <DefaultHistoryTab
                entries={historyEntries}
                theme={historyTheme}
                onEditEntry={onRequestEditEntry}
              />
            )}
          </div>
        )}

        {activeTab === TAB_TRACKER && (
          <div className="subcategory-tracker-container">
            {renderTracker ? (
              renderTracker()
            ) : (
              <div className="journal-history-empty">
                No tracker view is configured for this subcategory yet.
              </div>
            )}
          </div>
        )}
      </section>

      {showTokenModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>Apply Token</h3>

            {tokenModalContent}

            <div className="modal-actions">
              <button
                className="token-select"
                onClick={() => setShowTokenModal(false)}
              >
                Cancel
              </button>

              <button
                className="token-select"
                onClick={handleConfirmToken}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// Helpers
function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function formatMonthYearFromKey(monthKey) {
  const [yyyy, mm] = monthKey.split("-");
  const monthIndex = parseInt(mm, 10) - 1;

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  return `${monthNames[monthIndex]} ${yyyy}`;
}

// Default History tab (right-click + long-press edit)
function DefaultHistoryTab({ entries = [], theme, onEditEntry }) {
  if (!entries.length) {
    return <div className="journal-history-empty">No entries logged yet for this subcategory.</div>;
  }

  // Group entries by "YYYY-MM"
  const groupsByMonth = entries.reduce((acc, entry) => {
    if (!entry.dateKey) return acc;
    const monthKey = entry.dateKey.slice(0, 7);
    if (!acc[monthKey]) acc[monthKey] = [];
    acc[monthKey].push(entry);
    return acc;
  }, {});

  const monthKeys = Object.keys(groupsByMonth).sort((a, b) => b.localeCompare(a));
  const [expandedMonth, setExpandedMonth] = useState(monthKeys[0] || null);

  const themeClass = theme ? `history-theme-${theme}` : "";

  return (
    <div className="journal-history-list">
      {monthKeys.map((monthKey) => {
        const monthEntries = groupsByMonth[monthKey];
        const isOpen = expandedMonth === monthKey;

        return (
          <section key={monthKey} className="journal-month-group">
            <button
              type="button"
              className={`journal-month-toggle ${isOpen ? "is-open" : ""}`}
              onClick={() => setExpandedMonth(isOpen ? null : monthKey)}
            >
              <span className="journal-month-label">{formatMonthYearFromKey(monthKey)}</span>
              <span className="journal-month-count">
                {monthEntries.length} {monthEntries.length === 1 ? "entry" : "entries"}
              </span>
            </button>

            {isOpen && (
              <div className="journal-month-entries">
                {monthEntries.map((entry) => (
                  <HistoryItem
                    key={entry.id}
                    entry={entry}
                    themeClass={themeClass}
                    onEditEntry={onEditEntry}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function HistoryItem({ entry, themeClass, onEditEntry }) {
  const pressTimerRef = useRef(null);

  const startLongPress = () => {
    if (!onEditEntry) return;
    clearLongPress();
    pressTimerRef.current = setTimeout(() => {
      onEditEntry(entry);
    }, 600);
  };

  const clearLongPress = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  return (
    <article
      className={`journal-history-item ${themeClass} ${entry.lowEnergy ? "low-energy-entry" : ""}`}
      onContextMenu={(e) => {
        e.preventDefault();
        onEditEntry?.(entry);
      }}
      onTouchStart={startLongPress}
      onTouchEnd={clearLongPress}
      onTouchMove={clearLongPress}
      onTouchCancel={clearLongPress}
    >
      <div className="journal-history-header">
        <div className="journal-history-title">{entry.title}</div>
        <div className="journal-history-meta">
          <span className="journal-history-tag">{capitalize(entry.timeOfDay)}</span>
        </div>
      </div>
      <p className="journal-history-text">{entry.text}</p>

      {entry.attachments?.length > 0 && (
        <div className="journal-history-images">
          {entry.attachments.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`attachment-${i}`}
              className="journal-history-image"
            />
          ))}
        </div>
      )}
    </article>
  );
}

export default SubcategoryShell;

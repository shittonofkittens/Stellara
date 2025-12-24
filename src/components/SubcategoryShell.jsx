// src/components/SubcategoryShell.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import StarStrip from "./StarStrip";

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
  summaryStarFragments,
  historyEntries,
  historyTheme,
  onRequestEditEntry, 
  onDeleteEntry,
  renderTokenControl,
  tokenModalContent,
  onConfirmToken,
  tokensUsed = 0,
  lowEnergyTokensUsed,
  lowEnergy = false,
  onPatchHistoryEntries,
  availableTokens,
  minTokensToApply = 1,
  tokenControlPlacement = "auto", // "auto" | "manual"
  monthlyFragments,
  yearlyFragments,
  monthlyFragmentsMax,
  yearlyFragmentsMax,
  fragmentsLogged,
  entriesLogged,
  lowEnergyEntries,
  avgChars,
  totalStarsApprox,
}) {
  const today = new Date();

  const formattedDate = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(today);

  const [showTokenModal, setShowTokenModal] = useState(false);
  const tokensAvailable =
    typeof availableTokens === "number" && Number.isFinite(availableTokens)
      ? Math.max(0, Math.floor(availableTokens))
      : 3;

  const requiredTokens =
    typeof minTokensToApply === "number" && Number.isFinite(minTokensToApply)
      ? Math.max(0, Math.floor(minTokensToApply))
      : 0;

  const tokenActionDisabled = tokensAvailable < requiredTokens;

  const handleConfirmToken = () => {
    if (tokenActionDisabled) return;
    onConfirmToken?.({ lowEnergy: !!lowEnergy });
    setShowTokenModal(false);
  };

  const computedLowEnergy = useMemo(() => {
    const entries = Array.isArray(historyEntries) ? historyEntries : [];
    const lowEnergyDays = new Set();
    let lowEnergyTokenCount = 0;

    entries.forEach((e) => {
      if (!e?.lowEnergy) return;
      if (e.isToken) {
        lowEnergyTokenCount += 1;
        return;
      }

      const dk = typeof e?.dateKey === "string" ? e.dateKey : "";
      if (dk) {
        lowEnergyDays.add(dk);
        return;
      }
      const createdKey = typeof e?.createdAt === "string" ? e.createdAt.slice(0, 10) : "";
      if (createdKey) lowEnergyDays.add(createdKey);
    });

    return {
      lowEnergyDayCount: lowEnergyDays.size,
      lowEnergyTokenCount,
    };
  }, [historyEntries]);

  const resolvedLowEnergyEntries =
    typeof lowEnergyEntries === "number" && Number.isFinite(lowEnergyEntries)
      ? lowEnergyEntries
      : computedLowEnergy.lowEnergyDayCount;

  const resolvedLowEnergyTokensUsed =
    typeof lowEnergyTokensUsed === "number" && Number.isFinite(lowEnergyTokensUsed)
      ? lowEnergyTokensUsed
      : computedLowEnergy.lowEnergyTokenCount;

  useEffect(() => {
    if (!lowEnergy) return;
    if (typeof onPatchHistoryEntries !== "function") return;

    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const todayKey = `${yyyy}-${mm}-${dd}`;

    onPatchHistoryEntries((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      let changed = false;
      const next = list.map((e) => {
        if (!e || typeof e !== "object") return e;
        if (typeof e.lowEnergy === "boolean") return e;
        const dk = typeof e.dateKey === "string" ? e.dateKey : "";
        const createdKey = typeof e.createdAt === "string" ? e.createdAt.slice(0, 10) : "";
        const key = dk || createdKey;
        if (key !== todayKey) return e;
        changed = true;
        return { ...e, lowEnergy: true };
      });
      return changed ? next : prev;
    });
  }, [lowEnergy, onPatchHistoryEntries]);

  const TokenControl = () => {
    if (!renderTokenControl) return null;
    return (
      <div className="use-token-container">
        <div className="use-token-label">USE TOKEN</div>
        <div className="use-token-count">{tokensAvailable} tokens available</div>

        <div className="use-token-controls">
          <button
            className="token-select"
            onClick={() => setShowTokenModal(true)}
            disabled={tokenActionDisabled}
          >
            Apply
          </button>
        </div>
      </div>
    );
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

  const computeTopbarStarHistory = () => {
    // Explicit override (Journal topbar)
    if (Array.isArray(summaryStarFragments)) {
      const fragments = [...summaryStarFragments];
      while (fragments.length < 5) fragments.push(undefined);
      return [{ fragments: fragments.slice(0, 5) }];
    }

    const history = subcategory?.starHistory;
    if (!Array.isArray(history) || history.length === 0) {
      // Show an empty star instead of the StarStrip "empty" message.
      return [{ fragments: new Array(5).fill(undefined) }];
    }

    const last = history[history.length - 1];

    if (last && Array.isArray(last.fragments)) {
      const fragments = [...last.fragments];
      while (fragments.length < 5) fragments.push(undefined);
      const slice = fragments.slice(0, 5);
      const isFull = slice.length === 5 && slice.every((v) => v === "gold" || v === "silver");
      return [{ fragments: isFull ? new Array(5).fill(undefined) : slice }];
    }

    if (last && Array.isArray(last.halves)) {
      const halves = last.halves.slice(0, 2);
      const isFull = halves.length === 2 && halves.every((v) => v === "gold" || v === "silver");
      return [{ halves: isFull ? [] : halves }];
    }

    // Fraction mode: number or { fraction, usedToken }
    const fraction =
      typeof last === "number"
        ? last
        : last && typeof last === "object" && typeof last.fraction === "number"
        ? last.fraction
        : 0;
    const usedToken = Boolean(last && typeof last === "object" && last.usedToken);
    const isFull = fraction >= 0.999;
    return [{ fraction: isFull ? 0 : fraction, usedToken }];
  };

  const topbarStarHistory = computeTopbarStarHistory();
  const showStarSummary = Array.isArray(topbarStarHistory) && topbarStarHistory.length > 0;

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
            <div
              className={`summary-block ${showStarSummary ? "is-star-summary" : ""}`}
            >
              {showStarSummary ? (
                <StarStrip starHistory={topbarStarHistory} />
              ) : (
                <>
                  <div className="summary-label">{summaryLabel || "Total"}</div>
                  <div className="summary-value">
                    {summaryValue !== undefined && summaryValue !== null
                      ? summaryValue
                      : `${subcategory.currentStars.toFixed(1)}`}
                  </div>
                </>
              )}
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
            {renderInput && renderInput({ TokenControl })}

            {tokenControlPlacement === "auto" && <TokenControl />}
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
                onDeleteEntry={onDeleteEntry}
              />
            )}
          </div>
        )}

        {activeTab === TAB_TRACKER && (
          <div className="subcategory-tracker-container">
            {/* Base tracker cards */}
            <div className="tracker-grid" style={{ marginBottom: '1rem' }}>
              <div className="tracker-card">
                <div className="tracker-label">Monthly Fragments</div>
                <div className="tracker-value">
                  {(monthlyFragments ?? 0)} / {(monthlyFragmentsMax ?? 0)}
                </div>
              </div>

              <div className="tracker-card">
                <div className="tracker-label">Yearly Fragments</div>
                <div className="tracker-value">
                  {(yearlyFragments ?? 0)} / {(yearlyFragmentsMax ?? 0)}
                </div>
              </div>

              <div className="tracker-card">
                <div className="tracker-label">Fragments logged</div>
                <div className="tracker-value">
                  {fragmentsLogged ?? 0}
                  <span className="tracker-unit"> fragments</span>
                </div>
                <div className="tracker-sub">
                  ≈ {totalStarsApprox ?? 0} stars
                </div>
              </div>

              <div className="tracker-card">
                <div className="tracker-label">Entries logged</div>
                <div className="tracker-value">
                  {entriesLogged ?? 0}
                  <span className="tracker-unit"> entries</span>
                </div>
                <div className="tracker-sub">
                  Avg length: {avgChars ?? 0} chars
                </div>
              </div>
            </div>

            <div className="tracker-card" style={{ marginBottom: '1rem' }}>
              <div className="tracker-label">Low-energy entries</div>
              <div className="tracker-value">
                {resolvedLowEnergyEntries ?? 0}
                <span className="tracker-unit"> entries</span>
              </div>
            </div>

            <div className="tracker-grid" style={{ marginBottom: '1rem' }}>
              <div className="tracker-card">
                <div className="tracker-label">Tokens Used</div>
                <div className="tracker-value">
                  {tokensUsed ?? 0}
                </div>
              </div>

              <div className="tracker-card">
                <div className="tracker-label">Low-Energy Tokens</div>
                <div className="tracker-value">
                  {resolvedLowEnergyTokensUsed ?? 0}
                </div>
              </div>
            </div>

            {renderTracker && renderTracker()}
          </div>
        )}
      </section>

      {showTokenModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>APPLY TOKEN</h3>

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
                disabled={tokenActionDisabled}
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
function DefaultHistoryTab({ entries = [], theme, onEditEntry, onDeleteEntry }) {
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

  // Chronological: oldest month first, newest month last.
  const monthKeys = Object.keys(groupsByMonth).sort((a, b) => a.localeCompare(b));
  // Preserve prior UX of opening the most recent month by default.
  const [expandedMonth, setExpandedMonth] = useState(monthKeys[monthKeys.length - 1] || null);

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
                {[...monthEntries]
                  .sort((a, b) => {
                    const aKey = typeof a?.dateKey === "string" ? a.dateKey : "";
                    const bKey = typeof b?.dateKey === "string" ? b.dateKey : "";
                    if (aKey !== bKey) return aKey.localeCompare(bKey);
                    const aTime = typeof a?.createdAt === "string" ? a.createdAt : typeof a?.updatedAt === "string" ? a.updatedAt : "";
                    const bTime = typeof b?.createdAt === "string" ? b.createdAt : typeof b?.updatedAt === "string" ? b.updatedAt : "";
                    if (aTime !== bTime) return aTime.localeCompare(bTime);
                    return String(a?.id || "").localeCompare(String(b?.id || ""));
                  })
                  .map((entry) => (
                  <HistoryItem
                    key={entry.id}
                    entry={entry}
                    themeClass={themeClass}
                    onEditEntry={onEditEntry}
                    onDeleteEntry={onDeleteEntry}
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

function HistoryItem({ entry, themeClass, onEditEntry, onDeleteEntry }) {
  const pressTimerRef = useRef(null);

  const startLongPress = () => {
    if (!onEditEntry && !onDeleteEntry) return;
    clearLongPress();
    pressTimerRef.current = setTimeout(() => {
      if (entry.isToken) {
        onDeleteEntry?.(entry);
      } else {
        onEditEntry?.(entry);
      }
    }, 600);
  };

  const clearLongPress = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const isToken = entry.isToken;
  const sessionLabel = isToken ? `${capitalize(entry.timeOfDay)} Token` : capitalize(entry.timeOfDay);
  const bodyText = typeof entry?.text === "string" ? entry.text.trim() : "";

  return (
    <article
      className={`journal-history-item ${themeClass} ${entry.lowEnergy ? "low-energy-entry" : ""} ${isToken ? "token-entry" : ""}`}
      onContextMenu={(e) => {
        e.preventDefault();
        if (entry.isToken) {
          onDeleteEntry?.(entry);
        } else {
          onEditEntry?.(entry);
        }
      }}
      onTouchStart={startLongPress}
      onTouchEnd={clearLongPress}
      onTouchMove={clearLongPress}
      onTouchCancel={clearLongPress}
    >
      <div className="journal-history-header">
        <div className="journal-history-title">{entry.title}</div>
        <div className="journal-history-meta">
          <span className="journal-history-tag">{sessionLabel}</span>
          {onDeleteEntry && (
            <button
              type="button"
              className="journal-history-tag journal-history-delete"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteEntry?.(entry);
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                clearLongPress();
              }}
              aria-label={isToken ? "Delete token entry" : "Delete entry"}
            >
              ×
            </button>
          )}
        </div>
      </div>
      {!isToken && bodyText && (
        <p className="journal-history-text" style={{ whiteSpace: "pre-line" }}>
          {bodyText}
        </p>
      )}

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

import React, { useEffect, useMemo, useState } from "react";
import SubcategoryShell, { TAB_HISTORY, TAB_INPUT } from "./SubcategoryShell";
import { earnTokens, spendTokens } from "../utils/tokens";
import { useCategoryTokenBalance } from "./Tokens";

function safeParseArray(raw) {
  try {
    const v = JSON.parse(raw || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function idKey(v) {
  const s = String(v ?? "").trim();
  return s ? s : "";
}

function todayKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function dateFromKeyUtc(dateKey) {
  const [yyyy, mm, dd] = String(dateKey || "").split("-").map((x) => Number(x));
  if (!Number.isFinite(yyyy) || !Number.isFinite(mm) || !Number.isFinite(dd)) return null;
  return new Date(Date.UTC(yyyy, mm - 1, dd));
}

function formatEuropeanDate(dateKey) {
  if (!dateKey) return "";
  const dk = String(dateKey || "");
  const [yyyy, mm, dd] = dk.split("-");
  const monthIndex = parseInt(mm, 10) - 1;

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  if (!yyyy || !mm || !dd) return dk;
  if (!Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) return dk;
  return `${dd} ${monthNames[monthIndex]} ${yyyy}`;
}

function emitSpiritDataChanged(categoryId, subcategoryId) {
  try {
    window.dispatchEvent(
      new CustomEvent("spirit-data-changed", {
        detail: { categoryId, subcategoryId },
      })
    );
  } catch {
    // ignore
  }
}

const MIRROR_AFFIRMATIONS = {
  1: {
    dayLabel: "🌙 Monday — the Day of Stillness",
    text: "I am allowed to begin again. I honor the quiet that lives within me, and I trust it to guide me home.",
  },
  2: {
    dayLabel: "🔥 Tuesday — the Day of Courage",
    text: "My fire does not burn me; it forges me. I choose boldness, even when my voice trembles.",
  },
  3: {
    dayLabel: "🌿 Wednesday — the Day of Growth",
    text: "I am not behind. I am blooming on a timeline written only for me. My becoming is sacred.",
  },
  4: {
    dayLabel: "🌊 Thursday — the Day of Flow",
    text: "I release what does not belong to me. I do not chase worth—it is already mine.",
  },
  5: {
    dayLabel: "🌟 Friday — the Day of Radiance",
    text: "I am allowed to take up space. I am not too much, and I never have been.",
  },
  6: {
    dayLabel: "🕯 Saturday — the Day of Self-Tending",
    text: "I speak to myself with the voice I needed as a child. I am my own sanctuary.",
  },
  0: {
    dayLabel: "🌌 Sunday — the Day of Soul",
    text: "I am made of light and shadow, stardust and sorrow. All of me is worthy. All of me is loved.",
  },
};

function getAffirmationForDateKey(dateKey) {
  const dk = String(dateKey || "").trim();
  const d = dateFromKeyUtc(dk);
  const day = d ? d.getUTCDay() : new Date().getDay();
  return MIRROR_AFFIRMATIONS[day] || MIRROR_AFFIRMATIONS[1];
}

function daysInMonthFromMonthKey(monthKey) {
  const [yyyy, mm] = String(monthKey || "").split("-");
  const y = Number(yyyy);
  const m = Number(mm);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return 0;
  return new Date(y, m, 0).getDate();
}

function buildMirrorStarHistory({ entries, tokenUses }) {
  const list = Array.isArray(entries) ? entries : [];
  const tokens = Array.isArray(tokenUses) ? tokenUses : [];

  const sortedEntries = list
    .filter((e) => typeof e?.dateKey === "string" && e.dateKey)
    .slice()
    .sort((a, b) => {
      const ak = String(a?.dateKey || "");
      const bk = String(b?.dateKey || "");
      if (ak !== bk) return ak.localeCompare(bk);
      return String(a?.createdAt || "").localeCompare(String(b?.createdAt || ""));
    });

  const sortedTokens = tokens
    .filter((t) => typeof t?.dateKey === "string" && t.dateKey)
    .slice()
    .sort((a, b) => {
      const ak = String(a?.dateKey || "");
      const bk = String(b?.dateKey || "");
      if (ak !== bk) return ak.localeCompare(bk);
      return String(a?.createdAt || "").localeCompare(String(b?.createdAt || ""));
    });

  // Prefer gold if an entry exists for that day; otherwise allow a silver token.
  const dayInfo = new Map();
  for (const e of sortedEntries) {
    const dk = String(e?.dateKey || "");
    if (!dk) continue;
    if (dayInfo.has(dk)) continue;
    dayInfo.set(dk, { usedToken: false });
  }
  for (const t of sortedTokens) {
    const dk = String(t?.dateKey || "");
    if (!dk) continue;
    if (dayInfo.has(dk)) continue;
    dayInfo.set(dk, { usedToken: true });
  }

  const days = [...dayInfo.keys()].sort((a, b) => String(a).localeCompare(String(b)));
  const creditedByDay = new Map();
  const fragmentColors = [];

  for (const dk of days) {
    const info = dayInfo.get(dk);
    creditedByDay.set(dk, info);
    fragmentColors.push(info?.usedToken ? "silver" : "gold");
  }

  const starHistory = [];
  let current = [];
  for (const c of fragmentColors) {
    current.push(c);
    if (current.length === 5) {
      starHistory.push({ fragments: [...current] });
      current = [];
    }
  }
  if (current.length) starHistory.push({ fragments: [...current] });

  return {
    starHistory,
    creditedByDay,
    currentStars: fragmentColors.length / 5,
    fragmentsEarned: fragmentColors.length,
  };
}

export default function MirrorWorkSubcategoryPage({ category, subcategory, onBack, lowEnergy }) {
  const [activeTab, setActiveTab] = useState(TAB_INPUT);

  const ENTRY_KEY = `spiritMirrorEntries:${category.id}:${subcategory.id}`;
  const TOKEN_KEY = `spiritMirrorTokens:${category.id}:${subcategory.id}`;

  const TOKEN_COST_MIRROR = 1;
  const availableTokens = useCategoryTokenBalance(category.id);

  const [entries, setEntries] = useState(() => safeParseArray(localStorage.getItem(ENTRY_KEY)));
  const [tokenUses, setTokenUses] = useState(() => safeParseArray(localStorage.getItem(TOKEN_KEY)));

  const [dateKey, setDateKey] = useState(todayKey());
  const [saidMode, setSaidMode] = useState("silently");
  const [beliefMode, setBeliefMode] = useState("unsure");
  const [notes, setNotes] = useState("");
  const [editingEntryId, setEditingEntryId] = useState(null);

  useEffect(() => {
    localStorage.setItem(ENTRY_KEY, JSON.stringify(Array.isArray(entries) ? entries : []));
    emitSpiritDataChanged(category.id, subcategory.id);
  }, [ENTRY_KEY, category.id, entries, subcategory.id]);

  useEffect(() => {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(Array.isArray(tokenUses) ? tokenUses : []));
    emitSpiritDataChanged(category.id, subcategory.id);
  }, [TOKEN_KEY, category.id, subcategory.id, tokenUses]);

  const derived = useMemo(() => buildMirrorStarHistory({ entries, tokenUses }), [entries, tokenUses]);

  const today = todayKey();
  const monthKey = useMemo(() => today.slice(0, 7), [today]);
  const yearKey = useMemo(() => today.slice(0, 4), [today]);

  const monthly = useMemo(() => {
    let credited = 0;
    let tokenCredited = 0;
    for (const [dk, info] of derived.creditedByDay || []) {
      if (!String(dk).startsWith(monthKey)) continue;
      credited += 1;
      if (info?.usedToken) tokenCredited += 1;
    }
    return { credited, tokenCredited };
  }, [derived.creditedByDay, monthKey]);

  const yearly = useMemo(() => {
    let credited = 0;
    let tokenCredited = 0;
    for (const [dk, info] of derived.creditedByDay || []) {
      if (!String(dk).startsWith(yearKey)) continue;
      credited += 1;
      if (info?.usedToken) tokenCredited += 1;
    }
    return { credited, tokenCredited };
  }, [derived.creditedByDay, yearKey]);

  const completedToday = derived.creditedByDay?.has?.(today) || false;
  const tokenAlreadyToday = useMemo(
    () => (Array.isArray(tokenUses) ? tokenUses : []).some((t) => String(t?.dateKey || "") === today),
    [today, tokenUses]
  );
  const canApplyToken = !completedToday && !tokenAlreadyToday;

  const tokenModalContent = (
    <p className="token-confirm-copy">Spend {TOKEN_COST_MIRROR} token to add a 1/5 silver star for today.</p>
  );

  const resetForm = () => {
    setDateKey(todayKey());
    setSaidMode("silently");
    setBeliefMode("unsure");
    setNotes("");
  };

  const beginEdit = (entry) => {
    const id = idKey(entry?.id);
    if (!id) return;
    const existing = (Array.isArray(entries) ? entries : []).find((e) => idKey(e?.id) === id);
    if (!existing) return;
    setEditingEntryId(id);
    setDateKey(String(existing?.dateKey || todayKey()));
    setSaidMode(String(existing?.saidMode || "silently"));
    setBeliefMode(String(existing?.beliefMode || "unsure"));
    setNotes(String(existing?.notes || ""));
    setActiveTab(TAB_INPUT);
  };

  const cancelEdit = () => {
    setEditingEntryId(null);
    resetForm();
  };

  const handleLog = () => {
    const dk = String(dateKey || "").trim() || todayKey();
    const trimmedNotes = String(notes || "").trim();

    const nowIso = new Date().toISOString();
    const isEditing = typeof editingEntryId === "string" && editingEntryId.length > 0;

    if (isEditing) {
      setEntries((prev) =>
        (Array.isArray(prev) ? prev : []).map((e) =>
          idKey(e?.id) === editingEntryId
            ? {
                ...e,
                dateKey: dk,
                saidMode: String(saidMode || "silently"),
                beliefMode: String(beliefMode || "unsure"),
                notes: trimmedNotes,
                updatedAt: nowIso,
              }
            : e
        )
      );
      setEditingEntryId(null);
      resetForm();
      setActiveTab(TAB_HISTORY);
      return;
    }

    setEntries((prev) => [
      {
        id: `spm-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        dateKey: dk,
        createdAt: nowIso,
        lowEnergy: !!lowEnergy,
        saidMode: String(saidMode || "silently"),
        beliefMode: String(beliefMode || "unsure"),
        notes: trimmedNotes,
      },
      ...(Array.isArray(prev) ? prev : []),
    ]);

    resetForm();
    setActiveTab(TAB_HISTORY);
  };

  const onConfirmToken = () => {
    if (!canApplyToken) return;

    const res = spendTokens({
      categoryId: category.id,
      amount: TOKEN_COST_MIRROR,
      source: "spirit-mirror-token",
      meta: { subcategoryId: subcategory.id },
    });

    if (!res?.ok) return;

    const nowIso = new Date().toISOString();
    const dk = todayKey();

    setTokenUses((prev) => [
      {
        id: `spmrtok-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        dateKey: dk,
        createdAt: nowIso,
        lowEnergy: !!lowEnergy,
        isToken: true,
        tokensSpent: TOKEN_COST_MIRROR,
      },
      ...(Array.isArray(prev) ? prev : []),
    ]);
  };

  const handleDeleteHistoryEntry = (entry) => {
    if (!entry) return;
    const entryId = idKey(entry?.id);
    if (!entryId) return;

    if (entry.isToken) {
      const existing = (Array.isArray(tokenUses) ? tokenUses : []).find((t) => idKey(t?.id) === entryId);
      const refund = Math.max(0, Math.floor(Number(existing?.tokensSpent) || TOKEN_COST_MIRROR));

      setTokenUses((prev) => (Array.isArray(prev) ? prev.filter((t) => idKey(t?.id) !== entryId) : prev));

      if (refund > 0) {
        earnTokens({
          categoryId: category.id,
          amount: refund,
          source: "spirit-mirror-token-refund",
          meta: { subcategoryId: subcategory.id, dateKey: entry?.dateKey, entryId },
        });
      }
      return;
    }

    setEntries((prev) => (Array.isArray(prev) ? prev.filter((e) => idKey(e?.id) !== entryId) : prev));
    if (editingEntryId === entryId) {
      setEditingEntryId(null);
      resetForm();
    }
  };

  const historyEntries = useMemo(() => {
    const mappedEntries = (Array.isArray(entries) ? entries : []).map((e) => {
      const dk = typeof e?.dateKey === "string" ? e.dateKey : "";
      const title = formatEuropeanDate(dk);
      const aff = getAffirmationForDateKey(dk);

      const belief = String(e?.beliefMode || "").toLowerCase();
      const pill = belief === "believed" ? "Believed" : "Still Unsure";

      const said = String(e?.saidMode || "").toLowerCase();
      const saidLabel = said === "outloud" ? "Outloud" : "Silently";

      const lines = [];
      if (aff?.dayLabel) lines.push(aff.dayLabel);
      if (aff?.text) lines.push(`“${String(aff.text).trim()}”`);
      lines.push("");
      lines.push(`Said: ${saidLabel}`);
      if (String(e?.notes || "").trim()) {
        lines.push("");
        lines.push(`Notes: ${String(e.notes).trim()}`);
      }

      return {
        id: idKey(e?.id),
        dateKey: dk,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
        lowEnergy: !!e.lowEnergy,
        title,
        timeOfDay: pill,
        text: lines.join("\n"),
      };
    });

    const mappedTokens = (Array.isArray(tokenUses) ? tokenUses : []).map((t) => {
      const dk = typeof t?.dateKey === "string" ? t.dateKey : "";
      const title = formatEuropeanDate(dk);
      return {
        id: idKey(t?.id),
        dateKey: dk,
        createdAt: t.createdAt,
        lowEnergy: !!t.lowEnergy,
        isToken: true,
        title,
        timeOfDay: "Mirror Work",
      };
    });

    return [...mappedEntries, ...mappedTokens].filter((e) => e?.dateKey);
  }, [entries, tokenUses]);

  const trackerStats = useMemo(() => {
    const list = Array.isArray(entries) ? entries : [];

    let outloudCount = 0;
    let silentlyCount = 0;
    let believedCount = 0;
    let unsureCount = 0;

    for (const e of list) {
      const said = String(e?.saidMode || "").toLowerCase();
      const belief = String(e?.beliefMode || "").toLowerCase();
      if (said === "outloud") outloudCount += 1;
      else if (said === "silently") silentlyCount += 1;

      if (belief === "believed") believedCount += 1;
      else if (belief === "unsure") unsureCount += 1;
    }

    const spokenTotal = outloudCount + silentlyCount;
    const beliefTotal = believedCount + unsureCount;

    const outloudPct = spokenTotal > 0 ? Math.round((outloudCount / spokenTotal) * 100) : 0;
    const silentlyPct = spokenTotal > 0 ? Math.round((silentlyCount / spokenTotal) * 100) : 0;
    const believedPct = beliefTotal > 0 ? Math.round((believedCount / beliefTotal) * 100) : 0;
    const unsurePct = beliefTotal > 0 ? Math.round((unsureCount / beliefTotal) * 100) : 0;

    const believedAffirmations = new Map();
    for (const e of list) {
      if (String(e?.beliefMode || "").toLowerCase() !== "believed") continue;
      const dk = String(e?.dateKey || "");
      const aff = getAffirmationForDateKey(dk);
      if (!aff?.dayLabel) continue;
      believedAffirmations.set(aff.dayLabel, aff);
    }

    return {
      outloudCount,
      silentlyCount,
      outloudPct,
      silentlyPct,
      believedCount,
      unsureCount,
      believedPct,
      unsurePct,
      believedAffirmations: [...believedAffirmations.values()],
    };
  }, [entries]);

  const subcategoryWithComputedStars = useMemo(
    () => ({
      ...subcategory,
      starHistory: derived.starHistory,
      currentStars: derived.currentStars,
      completedToday,
      monthlyFragments: monthly.credited,
      monthlyFragmentsMax: daysInMonthFromMonthKey(monthKey),
    }),
    [subcategory, derived.starHistory, derived.currentStars, completedToday, monthly.credited, monthKey]
  );

  return (
    <SubcategoryShell
      category={category}
      subcategory={subcategoryWithComputedStars}
      onBack={onBack}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      summaryLabel="Fragments"
      summaryValue={monthly.credited}
      lowEnergy={!!lowEnergy}
      onPatchHistoryEntries={setEntries}
      historyEntries={historyEntries}
      historyTheme="water"
      onRequestEditEntry={beginEdit}
      onDeleteEntry={handleDeleteHistoryEntry}
      renderTokenControl={() => null}
      tokenControlPlacement="manual"
      availableTokens={availableTokens}
      minTokensToApply={canApplyToken ? TOKEN_COST_MIRROR : 9999}
      tokenModalContent={tokenModalContent}
      onConfirmToken={onConfirmToken}
      tokensUsed={monthly.tokenCredited}
      monthlyFragments={monthly.credited}
      yearlyFragments={yearly.credited}
      monthlyFragmentsMax={daysInMonthFromMonthKey(monthKey)}
      yearlyFragmentsMax={365}
      fragmentsLogged={derived.fragmentsEarned}
      entriesLogged={(Array.isArray(entries) ? entries.length : 0) + (Array.isArray(tokenUses) ? tokenUses.length : 0)}
      avgChars={0}
      totalStarsApprox={derived.currentStars}
      renderInput={({ TokenControl }) => {
        const aff = getAffirmationForDateKey(dateKey);
        return (
          <div className="journal-input">
            <div className="journal-input-box">
              <div className="tracker-section">
                <div className="tracker-label">Affirmation</div>
                <div className="tracker-sub" style={{ marginTop: "0.6rem", whiteSpace: "pre-line" }}>
                  <div style={{ fontWeight: 600 }}>{aff.dayLabel}</div>
                  <div style={{ marginTop: "0.45rem" }}>“{aff.text}”</div>
                </div>
              </div>

              <div className="journal-field" style={{ marginTop: "0.9rem" }}>
                <label className="journal-label">Date</label>
                <input
                  type="date"
                  className="journal-input-text"
                  value={dateKey}
                  onChange={(e) => setDateKey(e.target.value)}
                />
              </div>

              <div className="tracker-section" style={{ marginTop: "0.9rem" }}>
                <div className="tracker-label">Said</div>
                <div className="journal-input-row" style={{ marginTop: "0.6rem" }}>
                  <button
                    type="button"
                    className="journal-button-secondary"
                    aria-pressed={saidMode === "outloud"}
                    onClick={() => setSaidMode("outloud")}
                  >
                    Outloud
                  </button>
                  <button
                    type="button"
                    className="journal-button-secondary"
                    aria-pressed={saidMode === "silently"}
                    onClick={() => setSaidMode("silently")}
                  >
                    Silently
                  </button>
                </div>
              </div>

              <div className="tracker-section" style={{ marginTop: "0.9rem" }}>
                <div className="tracker-label">Belief</div>
                <div className="journal-input-row" style={{ marginTop: "0.6rem" }}>
                  <button
                    type="button"
                    className="journal-button-secondary"
                    aria-pressed={beliefMode === "believed"}
                    onClick={() => setBeliefMode("believed")}
                  >
                    Believed
                  </button>
                  <button
                    type="button"
                    className="journal-button-secondary"
                    aria-pressed={beliefMode === "unsure"}
                    onClick={() => setBeliefMode("unsure")}
                  >
                    Still Unsure
                  </button>
                </div>
              </div>

              <div className="journal-field" style={{ marginTop: "0.9rem" }}>
                <label className="journal-label">Notes (optional)</label>
                <textarea
                  className="journal-textarea"
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any extra thoughts?"
                />
              </div>

              <div className="journal-actions-row" style={{ marginTop: "0.9rem" }}>
                {typeof editingEntryId === "string" && editingEntryId.length > 0 && (
                  <button type="button" className="journal-button-secondary" onClick={cancelEdit}>
                    Cancel
                  </button>
                )}
                <button type="button" className="journal-button-primary" onClick={handleLog}>
                  {typeof editingEntryId === "string" && editingEntryId.length > 0 ? "Save Changes" : "Log Mirror Work"}
                </button>
              </div>

              <div style={{ marginTop: "0.6rem" }}>{TokenControl && <TokenControl />}</div>

              {completedToday && (
                <div className="tracker-sub" style={{ marginTop: "0.9rem" }}>
                  You can keep logging; stars are capped at 1/5 per day.
                </div>
              )}
            </div>
          </div>
        );
      }}
      renderTracker={() => (
        <div className="journal-tracker">
          <div className="tracker-section">
            <div className="tracker-label">Spoken pattern</div>

            <div className="tracker-bar-row">
              <span className="tracker-bar-label">Outloud</span>
              <div className="tracker-bar-track">
                <div className="tracker-bar-fill" style={{ width: `${trackerStats.outloudPct}%` }} />
              </div>
              <span className="tracker-bar-value">
                {trackerStats.outloudCount} ({trackerStats.outloudPct}%)
              </span>
            </div>

            <div className="tracker-bar-row">
              <span className="tracker-bar-label">Silently</span>
              <div className="tracker-bar-track">
                <div className="tracker-bar-fill" style={{ width: `${trackerStats.silentlyPct}%` }} />
              </div>
              <span className="tracker-bar-value">
                {trackerStats.silentlyCount} ({trackerStats.silentlyPct}%)
              </span>
            </div>
          </div>

          <div className="tracker-section" style={{ marginTop: "1rem" }}>
            <div className="tracker-label">Belief pattern</div>

            <div className="tracker-bar-row">
              <span className="tracker-bar-label">Believed</span>
              <div className="tracker-bar-track">
                <div className="tracker-bar-fill" style={{ width: `${trackerStats.believedPct}%` }} />
              </div>
              <span className="tracker-bar-value">
                {trackerStats.believedCount} ({trackerStats.believedPct}%)
              </span>
            </div>

            <div className="tracker-bar-row">
              <span className="tracker-bar-label">Still Unsure</span>
              <div className="tracker-bar-track">
                <div className="tracker-bar-fill" style={{ width: `${trackerStats.unsurePct}%` }} />
              </div>
              <span className="tracker-bar-value">
                {trackerStats.unsureCount} ({trackerStats.unsurePct}%)
              </span>
            </div>
          </div>

          <div className="tracker-section" style={{ marginTop: "1rem" }}>
            <div className="tracker-label">Affirmations believed</div>
            {!trackerStats.believedAffirmations.length ? (
              <div className="tracker-sub" style={{ marginTop: "0.5rem" }}>
                None marked as believed yet.
              </div>
            ) : (
              <div className="tracker-sub" style={{ marginTop: "0.5rem", whiteSpace: "pre-line" }}>
                {trackerStats.believedAffirmations
                  .slice()
                  .sort((a, b) => String(a?.dayLabel || "").localeCompare(String(b?.dayLabel || "")))
                  .map((a) => `${a.dayLabel}\n“${String(a.text || "").trim()}”`)
                  .join("\n\n")}
              </div>
            )}
          </div>
        </div>
      )}
    />
  );
}

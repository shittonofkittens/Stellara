import React, { useEffect, useMemo, useState } from "react";
import SubcategoryShell, { TAB_HISTORY, TAB_INPUT } from "./SubcategoryShell";
import { earnTokens, spendTokens } from "../utils/tokens";
import { useCategoryTokenBalance } from "./Tokens";
import { TAROT_DECK_BASE_URL, TAROT_DECK_FILENAMES } from "../data/tarotDeckManifest";

const TAROT_SPREADS = [
  { id: "one", label: "1 Card", count: 1 },
  { id: "three", label: "3 Cards", count: 3 },
  { id: "five", label: "5 Cards", count: 5 },
  { id: "celtic-cross", label: "Celtic Cross (10 Cards)", count: 10 },
  { id: "shadow-work", label: "Shadow Work (6 Cards)", count: 6 },
  { id: "elemental", label: "Elemental (5 Cards)", count: 5 },
];

const tarotSpreadById = (id) => TAROT_SPREADS.find((s) => s.id === id) || null;

const tarotCardNameFromFilename = (filename) => {
  const base = String(filename || "").replace(/\.[^/.]+$/, "");
  const parts = base.split("_");
  if (parts.length < 3) return base;

  const arcana = parts[0];
  if (arcana !== "minor") return base;

  const suitRaw = parts[1];
  const rankRaw = parts.slice(2).join("_");

  const suitMap = {
    cups: "Cups",
    pentacles: "Pentacles",
    swords: "Swords",
    wands: "Wands",
  };

  const rankMap = {
    "01": "Ace",
    "02": "Two",
    "03": "Three",
    "04": "Four",
    "05": "Five",
    "06": "Six",
    "07": "Seven",
    "08": "Eight",
    "09": "Nine",
    "10": "Ten",
    page: "Page",
    knight: "Knight",
    queen: "Queen",
    king: "King",
  };

  const suit = suitMap[suitRaw] || suitRaw;
  const rank = rankMap[rankRaw] || rankRaw;
  return `${rank} of ${suit}`;
};

const shuffleCopy = (arr) => {
  const copy = Array.isArray(arr) ? [...arr] : [];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

function safeParseArray(raw) {
  try {
    const v = JSON.parse(raw || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function todayKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
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

function buildSoulWorkStarHistory({ entries, tokenUses }) {
  const list = Array.isArray(entries) ? entries : [];
  const tokens = Array.isArray(tokenUses) ? tokenUses : [];

  const dayInfo = new Map();

  for (const e of list) {
    const dk = String(e?.dateKey || "");
    if (!dk) continue;
    if (dayInfo.has(dk)) continue;
    dayInfo.set(dk, { usedToken: false });
  }

  for (const t of tokens) {
    const dk = String(t?.dateKey || "");
    if (!dk) continue;
    if (dayInfo.has(dk)) continue;
    dayInfo.set(dk, { usedToken: true });
  }

  const days = [...dayInfo.keys()].sort((a, b) => String(a).localeCompare(String(b)));
  const creditedByDay = new Map();
  const credited = [];

  for (const dk of days) {
    const info = dayInfo.get(dk);
    creditedByDay.set(dk, 1);
    credited.push({ usedToken: !!info?.usedToken });
  }

  const starHistory = [];
  let current = [];
  for (const ev of credited) {
    current.push(ev.usedToken ? "silver" : "gold");
    if (current.length === 5) {
      starHistory.push({ fragments: [...current] });
      current = [];
    }
  }
  if (current.length) starHistory.push({ fragments: [...current] });

  return {
    starHistory,
    creditedByDay,
    currentStars: credited.length / 5,
    fragmentCount: credited.length,
  };
}

function daysInMonthFromMonthKey(monthKey) {
  const [yyyy, mm] = String(monthKey || "").split("-");
  const y = Number(yyyy);
  const m = Number(mm);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return 0;
  return new Date(y, m, 0).getDate();
}

export default function SoulCareSubcategoryPage({ category, subcategory, onBack, lowEnergy }) {
  const [activeTab, setActiveTab] = useState(TAB_INPUT);

  const ENTRY_KEY = `spiritSoulCareEntries:${category.id}:${subcategory.id}`;
  const TOKEN_KEY = `spiritSoulCareTokens:${category.id}:${subcategory.id}`;

  const TOKEN_COST_SOUL = 1;
  const availableTokens = useCategoryTokenBalance(category.id);

  const [entries, setEntries] = useState(() => safeParseArray(localStorage.getItem(ENTRY_KEY)));
  const [tokenUses, setTokenUses] = useState(() => safeParseArray(localStorage.getItem(TOKEN_KEY)));

  const [dateKey, setDateKey] = useState(todayKey());
  const [workType, setWorkType] = useState("");
  const [notes, setNotes] = useState("");
  const [tarotSpreadId, setTarotSpreadId] = useState("one");
  const [tarotDraw, setTarotDraw] = useState([]);
  const [editingEntryId, setEditingEntryId] = useState(null);

  useEffect(() => {
    if (workType !== "tarot") {
      setTarotDraw([]);
      setTarotSpreadId("one");
    }
  }, [workType]);

  useEffect(() => {
    localStorage.setItem(ENTRY_KEY, JSON.stringify(Array.isArray(entries) ? entries : []));
    emitSpiritDataChanged(category.id, subcategory.id);
  }, [ENTRY_KEY, category.id, entries, subcategory.id]);

  useEffect(() => {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(Array.isArray(tokenUses) ? tokenUses : []));
    emitSpiritDataChanged(category.id, subcategory.id);
  }, [TOKEN_KEY, category.id, subcategory.id, tokenUses]);

  const derived = useMemo(() => buildSoulWorkStarHistory({ entries, tokenUses }), [entries, tokenUses]);

  const monthKey = useMemo(() => String(todayKey()).slice(0, 7), []);
  const yearKey = useMemo(() => String(todayKey()).slice(0, 4), []);

  const creditedThisMonth = useMemo(() => {
    let sum = 0;
    for (const [dk, v] of derived.creditedByDay || []) {
      if (String(dk).startsWith(monthKey)) sum += Number(v) || 0;
    }
    return sum;
  }, [derived.creditedByDay, monthKey]);

  const creditedThisYear = useMemo(() => {
    let sum = 0;
    for (const [dk, v] of derived.creditedByDay || []) {
      if (String(dk).startsWith(yearKey)) sum += Number(v) || 0;
    }
    return sum;
  }, [derived.creditedByDay, yearKey]);

  const today = todayKey();
  const completedToday = (derived.creditedByDay?.get?.(today) || 0) > 0;

  const tokenAlreadyToday = useMemo(
    () => (Array.isArray(tokenUses) ? tokenUses : []).some((t) => String(t?.dateKey || "") === today),
    [today, tokenUses]
  );

  const canApplyToken = !completedToday && !tokenAlreadyToday;

  const SOUL_WORK_OPTIONS = [
    { id: "tea", label: "Tea Ritual" },
    { id: "dream", label: "Dream Journal" },
    { id: "tarot", label: "Tarot Pull" },
    { id: "grief", label: "Grief Ritual" },
  ];

  const typeLabel = (id) => {
    const found = SOUL_WORK_OPTIONS.find((x) => x.id === id);
    return found ? found.label : "";
  };

  const tokenModalContent = (
    <p className="token-confirm-copy">Spend {TOKEN_COST_SOUL} token to add a 1/5 silver star for today.</p>
  );

  const historyEntries = useMemo(() => {
    const mappedEntries = (Array.isArray(entries) ? entries : []).map((e) => {
      const dk = String(e?.dateKey || "");
      const wt = String(e?.workType || "").trim();
      const baseNotes = String(e?.notes || "").trim();

      let attachments = undefined;

      let extra = "";
      if (wt === "tarot") {
        const spread = tarotSpreadById(String(e?.tarotSpreadId || ""));
        const cards = Array.isArray(e?.tarotCards) ? e.tarotCards : [];
        if (cards.length) {
          attachments = cards
            .map((c, idx) => {
              const filename = String(c?.filename || "");
              if (!filename) return null;
              return {
                src: `${TAROT_DECK_BASE_URL}${filename}`,
                alt: `${idx + 1}. ${tarotCardNameFromFilename(filename)}`,
                reversed: !!c?.reversed,
              };
            })
            .filter(Boolean);

          const spreadLabel = spread?.label ? `Spread: ${spread.label}` : "Spread: Tarot";
          const lines = cards
            .map((c, idx) => {
              const name = tarotCardNameFromFilename(String(c?.filename || ""));
              const suffix = c?.reversed ? " (Reversed)" : "";
              return `${idx + 1}. ${name}${suffix}`;
            })
            .join("\n");
          extra = `${baseNotes ? "\n\n" : ""}${spreadLabel}\n${lines}`;
        }
      }

      return {
        id: String(e?.id || ""),
        dateKey: dk,
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
        lowEnergy: !!e.lowEnergy,
        title: formatEuropeanDate(dk),
        timeOfDay: typeLabel(String(e?.workType || "")) || "Soul Care",
        text: `${baseNotes}${extra}`.trim(),
        attachments,
      };
    });

    const mappedTokens = (Array.isArray(tokenUses) ? tokenUses : []).map((t) => {
      const dk = String(t?.dateKey || "");
      return {
        id: String(t?.id || ""),
        dateKey: dk,
        createdAt: t.createdAt,
        lowEnergy: !!t.lowEnergy,
        isToken: true,
        title: formatEuropeanDate(dk),
        timeOfDay: "",
      };
    });

    return [...mappedEntries, ...mappedTokens]
      .filter((e) => e?.dateKey)
      .sort((a, b) => {
        const ak = String(a?.dateKey || "");
        const bk = String(b?.dateKey || "");
        if (ak !== bk) return ak.localeCompare(bk);
        return String(a?.createdAt || "").localeCompare(String(b?.createdAt || ""));
      });
  }, [entries, tokenUses]);

  const resetForm = () => {
    setWorkType("");
    setNotes("");
    setTarotSpreadId("one");
    setTarotDraw([]);
    setDateKey(todayKey());
  };

  const beginEdit = (entry) => {
    const id = String(entry?.id || "");
    if (!id) return;
    const existing = (Array.isArray(entries) ? entries : []).find((e) => String(e?.id || "") === id);
    if (!existing) return;
    setEditingEntryId(id);
    setDateKey(String(existing?.dateKey || todayKey()));
    setWorkType(String(existing?.workType || ""));
    setNotes(String(existing?.notes || ""));
    setTarotSpreadId(String(existing?.tarotSpreadId || "one"));
    setTarotDraw(Array.isArray(existing?.tarotCards) ? existing.tarotCards : []);
    setActiveTab(TAB_INPUT);
  };

  const handleDeleteHistoryEntry = (entry) => {
    const id = String(entry?.id || "");
    if (!id) return;

    if (entry?.isToken) {
      const existing = (Array.isArray(tokenUses) ? tokenUses : []).find((t) => String(t?.id || "") === id);
      const refund = Math.max(0, Math.floor(Number(existing?.tokensSpent) || TOKEN_COST_SOUL));

      setTokenUses((prev) => (Array.isArray(prev) ? prev.filter((t) => String(t?.id || "") !== id) : prev));

      if (refund > 0) {
        earnTokens({
          categoryId: category.id,
          amount: refund,
          source: "spirit-soulwork-token-refund",
          meta: { subcategoryId: subcategory.id, dateKey: entry?.dateKey, entryId: id },
        });
      }
      return;
    }

    setEntries((prev) => (Array.isArray(prev) ? prev : []).filter((e) => String(e?.id || "") !== id));
    if (editingEntryId === id) {
      setEditingEntryId(null);
      resetForm();
    }
  };

  const onConfirmToken = () => {
    if (!canApplyToken) return;

    const res = spendTokens({
      categoryId: category.id,
      amount: TOKEN_COST_SOUL,
      source: "spirit-soulwork-token",
      meta: { subcategoryId: subcategory.id },
    });

    if (!res?.ok) return;

    const nowIso = new Date().toISOString();
    const dk = todayKey();

    setTokenUses((prev) => [
      {
        id: `spswtok-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        dateKey: dk,
        createdAt: nowIso,
        lowEnergy: !!lowEnergy,
        isToken: true,
        tokensSpent: TOKEN_COST_SOUL,
      },
      ...(Array.isArray(prev) ? prev : []),
    ]);
  };

  const handleLog = () => {
    const dk = String(dateKey || "").trim() || todayKey();
    const wt = String(workType || "").trim();
    const trimmedNotes = String(notes || "").trim();
    if (!dk) return;
    if (!wt) return;

    if (wt === "tarot") {
      const spread = tarotSpreadById(String(tarotSpreadId || ""));
      if (!spread) return;
      if (!Array.isArray(tarotDraw) || tarotDraw.length !== spread.count) return;
    }

    const nowIso = new Date().toISOString();
    const isEditing = typeof editingEntryId === "string" && editingEntryId.length > 0;

    if (isEditing) {
      setEntries((prev) =>
        (Array.isArray(prev) ? prev : []).map((e) =>
          String(e?.id || "") === editingEntryId
            ? (() => {
                const next = {
                  ...e,
                  dateKey: dk,
                  workType: wt,
                  notes: trimmedNotes,
                  updatedAt: nowIso,
                };

                if (wt === "tarot") {
                  next.tarotSpreadId = String(tarotSpreadId || "one");
                  next.tarotCards = Array.isArray(tarotDraw) ? tarotDraw : [];
                } else {
                  delete next.tarotSpreadId;
                  delete next.tarotCards;
                }

                return next;
              })()
            : e
        )
      );
      setEditingEntryId(null);
      resetForm();
      setActiveTab(TAB_HISTORY);
      return;
    }

    setEntries((prev) => [
      (() => {
        const entry = {
        id: `sps-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        dateKey: dk,
        createdAt: nowIso,
        lowEnergy: !!lowEnergy,
        workType: wt,
        notes: trimmedNotes,
        };

        if (wt === "tarot") {
          entry.tarotSpreadId = String(tarotSpreadId || "one");
          entry.tarotCards = Array.isArray(tarotDraw) ? tarotDraw : [];
        }

        return entry;
      })(),
      ...(Array.isArray(prev) ? prev : []),
    ]);

    resetForm();
    setActiveTab(TAB_HISTORY);
  };

  const cancelEdit = () => {
    setEditingEntryId(null);
    resetForm();
  };

  const subcategoryWithComputedStars = useMemo(
    () => ({
      ...subcategory,
      starHistory: derived.starHistory,
      currentStars: derived.currentStars,
      completedToday,
      monthlyFragments: creditedThisMonth,
      monthlyFragmentsMax: daysInMonthFromMonthKey(monthKey),
    }),
    [subcategory, derived.starHistory, derived.currentStars, completedToday, creditedThisMonth, monthKey]
  );

  const trackerStats = useMemo(() => {
    const counts = {
      tea: 0,
      dream: 0,
      tarot: 0,
      grief: 0,
    };

    const list = Array.isArray(entries) ? entries : [];
    let total = 0;
    for (const e of list) {
      const wt = String(e?.workType || "").trim();
      if (!Object.prototype.hasOwnProperty.call(counts, wt)) continue;
      counts[wt] += 1;
      total += 1;
    }

    const pct = {
      tea: total ? Math.round((counts.tea / total) * 100) : 0,
      dream: total ? Math.round((counts.dream / total) * 100) : 0,
      tarot: total ? Math.round((counts.tarot / total) * 100) : 0,
      grief: total ? Math.round((counts.grief / total) * 100) : 0,
    };

    return { counts, pct, total };
  }, [entries]);

  const tarotCopyText = useMemo(() => {
    if (String(workType || "") !== "tarot") return "";
    const spread = tarotSpreadById(String(tarotSpreadId || ""));
    const cards = Array.isArray(tarotDraw) ? tarotDraw : [];
    if (!spread || !cards.length) return "";

    const lines = [];
    lines.push(`Tarot Pull — ${spread.label}`);
    lines.push(`Date: ${formatEuropeanDate(dateKey) || String(dateKey || "")}`);
    lines.push("");
    cards.forEach((c, idx) => {
      const name = tarotCardNameFromFilename(String(c?.filename || ""));
      const suffix = c?.reversed ? " (Reversed)" : "";
      lines.push(`${idx + 1}. ${name}${suffix}`);
    });

    const trimmed = String(notes || "").trim();
    if (trimmed) {
      lines.push("");
      lines.push(`Notes: ${trimmed}`);
    }

    return lines.join("\n");
  }, [dateKey, notes, tarotDraw, tarotSpreadId, workType]);

  const drawTarot = () => {
    const spread = tarotSpreadById(String(tarotSpreadId || ""));
    if (!spread) return;

    const deck = Array.isArray(TAROT_DECK_FILENAMES) ? TAROT_DECK_FILENAMES : [];
    if (!deck.length) return;

    const picked = shuffleCopy(deck).slice(0, Math.min(spread.count, deck.length));
    setTarotDraw(
      picked.map((filename) => ({
        filename,
        reversed: Math.random() < 0.5,
      }))
    );
  };

  const canSubmit =
    String(workType || "").trim().length > 0 &&
    (String(workType || "") !== "tarot" ||
      (() => {
        const spread = tarotSpreadById(String(tarotSpreadId || ""));
        return !!spread && Array.isArray(tarotDraw) && tarotDraw.length === spread.count;
      })());

  return (
    <SubcategoryShell
      category={category}
      subcategory={subcategoryWithComputedStars}
      onBack={onBack}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      summaryLabel="Fragments"
      summaryValue={creditedThisMonth}
      lowEnergy={!!lowEnergy}
      onPatchHistoryEntries={setEntries}
      renderTokenControl={() => null}
      tokenControlPlacement="manual"
      availableTokens={availableTokens}
      minTokensToApply={canApplyToken ? TOKEN_COST_SOUL : 9999}
      tokenModalContent={tokenModalContent}
      onConfirmToken={onConfirmToken}
      tokensUsed={(Array.isArray(tokenUses) ? tokenUses : []).length}
      monthlyFragments={creditedThisMonth}
      yearlyFragments={creditedThisYear}
      monthlyFragmentsMax={daysInMonthFromMonthKey(monthKey)}
      yearlyFragmentsMax={365}
      fragmentsLogged={derived.fragmentCount}
      entriesLogged={(Array.isArray(entries) ? entries.length : 0) + (Array.isArray(tokenUses) ? tokenUses.length : 0)}
      avgChars={0}
      totalStarsApprox={derived.currentStars}
      historyEntries={historyEntries}
      onRequestEditEntry={beginEdit}
      onDeleteEntry={handleDeleteHistoryEntry}
      renderInput={({ TokenControl }) => (
        <div className="journal-input">
          <div className="journal-input-box">
            <div className="journal-input-row">
              <div className="journal-field">
                <label className="journal-label">Date</label>
                <input type="date" className="journal-input-text" value={dateKey} onChange={(e) => setDateKey(e.target.value)} />
              </div>
            </div>

            <div className="tracker-section" style={{ marginTop: "0.9rem" }}>
              <div className="tracker-label">Soul Care</div>
              <div className="journal-input-row" style={{ marginTop: "0.6rem" }}>
                {SOUL_WORK_OPTIONS.map((opt) => {
                  const pressed = workType === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      className="journal-button-secondary"
                      aria-pressed={pressed}
                      onClick={() => setWorkType((prev) => (prev === opt.id ? "" : opt.id))}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {workType === "tarot" && (
              <div className="journal-input-row" style={{ marginTop: "0.9rem", flexDirection: "column" }}>
                <div className="journal-field">
                  <label className="journal-label">Tarot Spread</label>
                  <select
                    className="journal-input-text"
                    value={tarotSpreadId}
                    onChange={(e) => {
                      setTarotSpreadId(String(e.target.value || "one"));
                      setTarotDraw([]);
                    }}
                  >
                    {TAROT_SPREADS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="journal-actions-row" style={{ marginTop: "0.6rem" }}>
                  <button type="button" className="journal-button-secondary" onClick={drawTarot}>
                    {tarotDraw.length ? "Re-draw Cards" : "Draw Cards"}
                  </button>
                </div>

                {Array.isArray(tarotDraw) && tarotDraw.length > 0 && (
                  <div style={{ marginTop: "0.8rem" }}>
                    <div className="tracker-section">
                      <div className="tracker-label">Draw</div>
                      <div className="journal-input-row" style={{ marginTop: "0.6rem", flexWrap: "wrap" }}>
                        {tarotDraw.map((c, idx) => {
                          const name = tarotCardNameFromFilename(String(c?.filename || ""));
                          const src = `${TAROT_DECK_BASE_URL}${String(c?.filename || "")}`;
                          const reversed = !!c?.reversed;
                          return (
                            <div
                              key={`${String(c?.filename || "")}-${idx}`}
                              style={{ width: "110px", marginRight: "0.6rem", marginBottom: "0.8rem" }}
                            >
                              <img
                                src={src}
                                alt={name}
                                style={{
                                  width: "100%",
                                  borderRadius: "10px",
                                  transform: reversed ? "rotate(180deg)" : "none",
                                }}
                              />
                              <div style={{ marginTop: "0.35rem", fontSize: "0.9rem" }}>{idx + 1}. {name}</div>
                              {reversed && <div style={{ fontSize: "0.85rem", opacity: 0.8 }}>(Reversed)</div>}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="journal-field" style={{ marginTop: "0.8rem" }}>
                      <label className="journal-label">Copy list</label>
                      <textarea className="journal-textarea" readOnly value={tarotCopyText} />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="journal-field" style={{ marginTop: "0.9rem" }}>
              <label className="journal-label">Notes</label>
              <textarea
                className="journal-textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (optional)"
              />
            </div>

            <div className="journal-actions-row" style={{ marginTop: "0.9rem" }}>
              {editingEntryId ? (
                <>
                  <button type="button" className="journal-button-secondary" onClick={cancelEdit}>
                    Cancel
                  </button>
                  <button type="button" className="journal-button-primary" onClick={handleLog} disabled={!canSubmit}>
                    Save Changes
                  </button>
                </>
              ) : (
                <button type="button" className="journal-button-primary" onClick={handleLog} disabled={!canSubmit}>
                  Log Soul Care
                </button>
              )}
            </div>

            <div style={{ marginTop: "0.6rem" }}>{TokenControl && <TokenControl />}</div>
          </div>
        </div>
      )}
      renderTracker={() => (
        <div className="journal-tracker">
          <div className="tracker-section">
            <div className="tracker-label">Tasks</div>

            {SOUL_WORK_OPTIONS.map((row) => (
              <div key={row.id} className="tracker-bar-row">
                <span className="tracker-bar-label">{row.label}</span>
                <div className="tracker-bar-track">
                  <div className="tracker-bar-fill" style={{ width: `${trackerStats.pct[row.id] || 0}%` }} />
                </div>
                <span className="tracker-bar-value">
                  {trackerStats.counts[row.id] || 0} ({trackerStats.pct[row.id] || 0}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    />
  );
}

// src/utils/tokens.js

const TOKENS_KEY_PREFIX = "categoryTokensLedger:";

function safeParseJson(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export function getTokenLedgerStorageKey(categoryId) {
  return `${TOKENS_KEY_PREFIX}${categoryId}`;
}

export function readTokenLedger(categoryId) {
  if (!categoryId) return [];
  const key = getTokenLedgerStorageKey(categoryId);
  const raw = localStorage.getItem(key);
  const arr = safeParseJson(raw || "[]", []);
  return Array.isArray(arr) ? arr : [];
}

export function writeTokenLedger(categoryId, ledger) {
  if (!categoryId) return;
  const key = getTokenLedgerStorageKey(categoryId);
  localStorage.setItem(key, JSON.stringify(Array.isArray(ledger) ? ledger : []));

  try {
    window.dispatchEvent(
      new CustomEvent("tokens-changed", {
        detail: { categoryId },
      })
    );
  } catch {
    // ignore
  }
}

export function getTokenBalance(categoryId) {
  const ledger = readTokenLedger(categoryId);
  return ledger.reduce((sum, ev) => sum + (Number(ev?.amount) || 0), 0);
}

export function earnTokens({ categoryId, amount, source, meta }) {
  const amt = Math.max(0, Math.floor(Number(amount) || 0));
  if (!categoryId || !amt) return null;

  const nowIso = new Date().toISOString();
  const entry = {
    id: `tok-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: "earn",
    amount: amt,
    source: source || "unknown",
    meta: meta || {},
    createdAt: nowIso,
  };

  const ledger = readTokenLedger(categoryId);
  writeTokenLedger(categoryId, [entry, ...ledger]);
  return entry;
}

export function spendTokens({ categoryId, amount, source, meta }) {
  const amt = Math.max(0, Math.floor(Number(amount) || 0));
  if (!categoryId || !amt) return { ok: false, reason: "invalid" };

  const balance = getTokenBalance(categoryId);
  if (balance < amt) return { ok: false, reason: "insufficient" };

  const nowIso = new Date().toISOString();
  const entry = {
    id: `tok-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    type: "spend",
    amount: -amt,
    source: source || "unknown",
    meta: meta || {},
    createdAt: nowIso,
  };

  const ledger = readTokenLedger(categoryId);
  writeTokenLedger(categoryId, [entry, ...ledger]);
  return { ok: true, entry };
}

// src/components/Tokens.jsx
import { useEffect, useMemo, useState } from "react";
import { earnTokens, getTokenBalance, readTokenLedger } from "../utils/tokens";

const SEEDED_KEY_PREFIX = "categoryTokensSeeded:";

// Stub balances for testing (edit these whenever you want).
// These seed the per-category token ledger ONCE (only if the ledger is empty).
export const DEFAULT_CATEGORY_TOKENS = {
  mind: 10,
  body: 10,
  will: 10,
  spirit: 10,
};

function seededKey(categoryId) {
  return `${SEEDED_KEY_PREFIX}${categoryId}`;
}

function getStubTokensForCategory(categoryId) {
  const id = String(categoryId || "");
  const n = DEFAULT_CATEGORY_TOKENS[id];
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

export function ensureCategoryTokensSeeded(categoryId) {
  const id = String(categoryId || "");
  if (!id) return;

  // Only seed if ledger is empty.
  const ledger = readTokenLedger(id);
  if (ledger.length > 0) return;

  // Avoid re-seeding if the user intentionally cleared the ledger.
  const alreadySeeded = localStorage.getItem(seededKey(id)) === "1";
  if (alreadySeeded) return;

  const stub = getStubTokensForCategory(id);
  if (stub > 0) {
    earnTokens({
      categoryId: id,
      amount: stub,
      source: "seed-stub",
      meta: { reason: "default testing balance" },
    });
  }

  localStorage.setItem(seededKey(id), "1");
}

export function useCategoryTokenBalance(categoryId) {
  const id = useMemo(() => String(categoryId || ""), [categoryId]);
  const [balance, setBalance] = useState(() => (id ? getTokenBalance(id) : 0));

  useEffect(() => {
    if (!id) return;
    ensureCategoryTokensSeeded(id);
    setBalance(getTokenBalance(id));

    const handler = (ev) => {
      const cid = ev?.detail?.categoryId;
      if (cid && cid !== id) return;
      setBalance(getTokenBalance(id));
    };

    window.addEventListener("tokens-changed", handler);
    return () => window.removeEventListener("tokens-changed", handler);
  }, [id]);

  return balance;
}

// src/components/Tokens.jsx
import { useEffect, useMemo, useState } from "react";
import { earnTokens, getTokenBalance, readTokenLedger, writeTokenLedger } from "../utils/tokens";

const SEEDED_KEY_PREFIX = "categoryTokensSeeded:";

// Legacy stub balances (previously used to seed tokens for testing).
// Keeping this exported for compatibility, but default is now 0 for all categories.
export const DEFAULT_CATEGORY_TOKENS = {
  mind: 0,
  body: 0,
  will: 0,
  spirit: 0,
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

  const ledger = readTokenLedger(id);

  // Core categories: never seed default tokens; also remove any legacy seed-stub tokens when safe.
  if (id === "mind" || id === "body" || id === "will" || id === "spirit") {
    if (!ledger.length) {
      localStorage.removeItem(seededKey(id));
      return;
    }

    const filtered = ledger.filter((ev) => String(ev?.source || "") !== "seed-stub");
    if (filtered.length === ledger.length) return;

    const nextBalance = filtered.reduce((sum, ev) => sum + (Number(ev?.amount) || 0), 0);
    if (nextBalance >= 0) {
      writeTokenLedger(id, filtered);
      localStorage.removeItem(seededKey(id));
    }
    return;
  }

  // Other categories: seed once (only if ledger is empty).
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

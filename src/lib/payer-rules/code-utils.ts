import type { CodeKind } from "./types";

/**
 * HCPCS J-code pattern: a letter followed by exactly four digits.
 * Examples: J0517 (Dupixent), J0135 (Adalimumab), J1438 (Etanercept).
 *
 * This covers the full HCPCS Level II pattern (A–V prefix), but in practice
 * dermatology drug rules almost always use the J-series. Matching on any
 * leading letter keeps us future-proof for non-J drug codes (e.g. Q-codes
 * for biosimilars).
 */
const HCPCS_PATTERN = /^[A-Z]\d{4}$/i;

/**
 * Classify a billing code as "drug" (HCPCS J-code / NDC) or "procedure" (CPT).
 *
 * Heuristic:
 * - If the code matches `[A-Z]\d{4}` → drug (HCPCS Level II)
 * - Everything else → procedure (CPT codes are 5-digit numeric, sometimes
 *   with modifiers, but we only get the base code here)
 *
 * The caller can override by passing a `kind` hint, which short-circuits
 * the classification. This is useful when the caller already knows the
 * code kind (e.g. from a form where the user chose "Drug" vs "Procedure").
 */
export function classifyCode(code: string, hint?: CodeKind): CodeKind {
  if (hint) return hint;
  return HCPCS_PATTERN.test(code) ? "drug" : "procedure";
}

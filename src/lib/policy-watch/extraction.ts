import {
  extractionResponseSchema,
  extractedDrugRuleSchema,
  extractedProcedureRuleSchema,
  type ExtractedDrugRule,
  type ExtractedProcedureRule,
} from "@/lib/claude/schemas";
import type { StagedRuleKind } from "@/lib/types";
import { logger } from "@/lib/logger";

/**
 * A single staged rule ready to be inserted into policy_watch_staged_rules.
 */
export interface StagedRuleCandidate {
  rule_kind: StagedRuleKind;
  extracted_data: Record<string, unknown>;
  source_excerpt: string;
  extraction_confidence: string;
}

/**
 * Result of parsing Claude's raw extraction response.
 */
export interface ExtractionParseResult {
  success: boolean;
  payer_name: string | null;
  document_date: string | null;
  rules: StagedRuleCandidate[];
  /** Rules that failed individual validation — logged, not staged. */
  skipped: { index: number; kind: string; error: string }[];
  /** Top-level parse error, if any. */
  error?: string;
}

/**
 * Parse Claude's raw text response into validated staged rule candidates.
 *
 * This is a pure function with no side effects — it doesn't touch the DB
 * or call any APIs. Validation uses the Zod extraction schemas.
 *
 * Tolerant parsing: if the top-level JSON is valid but individual rules fail
 * validation, those rules are skipped with errors. The remaining valid rules
 * are still returned.
 */
export function parseExtractionResponse(raw: string): ExtractionParseResult {
  // Step 1: Parse raw text as JSON
  let parsed: unknown;
  try {
    // Strip markdown code fences if Claude wraps the response
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim();
    parsed = JSON.parse(cleaned);
  } catch (e) {
    const msg = e instanceof SyntaxError ? e.message : "Unknown JSON parse error";
    return {
      success: false,
      payer_name: null,
      document_date: null,
      rules: [],
      skipped: [],
      error: `Invalid JSON from Claude: ${msg}`,
    };
  }

  // Step 2: Validate top-level structure
  const topResult = extractionResponseSchema.safeParse(parsed);
  if (!topResult.success) {
    const issues = topResult.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    return {
      success: false,
      payer_name: null,
      document_date: null,
      rules: [],
      skipped: [],
      error: `Extraction response schema validation failed: ${issues}`,
    };
  }

  const data = topResult.data;
  const rules: StagedRuleCandidate[] = [];
  const skipped: { index: number; kind: string; error: string }[] = [];

  // Step 3: Validate individual drug rules (data.drug_rules is unknown[])
  for (let i = 0; i < data.drug_rules.length; i++) {
    const rawRule = data.drug_rules[i];
    const result = extractedDrugRuleSchema.safeParse(rawRule);
    if (result.success) {
      const rule: ExtractedDrugRule = result.data;
      rules.push({
        rule_kind: "drug",
        extracted_data: stripExtractionMeta(rule),
        source_excerpt: rule.source_document_excerpt,
        extraction_confidence: rule.extraction_confidence,
      });
    } else {
      const issues = result.error.issues.map((iss) => iss.message).join("; ");
      skipped.push({ index: i, kind: "drug", error: issues });
      logger.warn("Skipped invalid drug rule from extraction", {
        index: i,
        error: issues,
      });
    }
  }

  // Step 4: Validate individual procedure rules (data.procedure_rules is unknown[])
  for (let i = 0; i < data.procedure_rules.length; i++) {
    const rawRule = data.procedure_rules[i];
    const result = extractedProcedureRuleSchema.safeParse(rawRule);
    if (result.success) {
      const rule: ExtractedProcedureRule = result.data;
      rules.push({
        rule_kind: "procedure",
        extracted_data: stripExtractionMeta(rule),
        source_excerpt: rule.source_document_excerpt,
        extraction_confidence: rule.extraction_confidence,
      });
    } else {
      const issues = result.error.issues.map((iss) => iss.message).join("; ");
      skipped.push({ index: i, kind: "procedure", error: issues });
      logger.warn("Skipped invalid procedure rule from extraction", {
        index: i,
        error: issues,
      });
    }
  }

  return {
    success: true,
    payer_name: data.payer_name,
    document_date: data.document_date ?? null,
    rules,
    skipped,
  };
}

/**
 * Remove extraction_confidence and source_document_excerpt from the rule data
 * before storing in extracted_data. These are stored in dedicated columns on
 * policy_watch_staged_rules instead.
 */
function stripExtractionMeta(
  rule: ExtractedDrugRule | ExtractedProcedureRule
): Record<string, unknown> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { extraction_confidence, source_document_excerpt, ...rest } = rule;
  return rest as Record<string, unknown>;
}

/**
 * FHIR Coverage → MappedCoverage mapper.
 *
 * Coverage (insurance) data is extracted from the FHIR Coverage resource
 * and merged into the patient record. We don't store Coverage as a
 * separate table — insurance_payer, plan_id, and plan_type are columns
 * on the patients table.
 *
 * Key fields:
 * - payor[0].display → insurance_payer (e.g., "UnitedHealthcare")
 * - subscriberId → plan_id
 * - class[type=plan].value → plan_type (e.g., "Commercial", "Medicare Advantage")
 *
 * No PHI in coverage data we store — payer name and plan type are
 * not individually identifiable.
 */

import type {
  FHIRCoverage,
  FHIRCoverageClass,
  MappedCoverage,
} from "../types";
import { FHIR_SYSTEMS } from "../types";

/**
 * Map a FHIR Coverage resource to our internal coverage model.
 *
 * @param coverage - Raw FHIR Coverage from ModMed
 * @returns MappedCoverage with insurance fields extracted
 */
export function mapCoverage(coverage: FHIRCoverage): MappedCoverage {
  return {
    modmed_patient_id: extractBeneficiaryId(coverage),
    insurance_payer: extractPayerName(coverage),
    plan_id: coverage.subscriberId ?? null,
    plan_type: extractPlanType(coverage),
  };
}

/**
 * Extract the patient ID from the beneficiary reference.
 * "Patient/123" → "123"
 */
export function extractBeneficiaryId(coverage: FHIRCoverage): string {
  const ref = coverage.beneficiary?.reference;
  if (!ref) return "";
  return ref.startsWith("Patient/") ? ref.replace("Patient/", "") : ref;
}

/**
 * Extract payer name from Coverage.payor[].
 *
 * ModMed may provide the payer as:
 * - payor[0].display (inline display name)
 * - payor[0].reference (reference to an Organization resource)
 *
 * We prefer display since it's immediately usable for payer rule matching.
 */
export function extractPayerName(coverage: FHIRCoverage): string | null {
  if (!coverage.payor || coverage.payor.length === 0) return null;

  const primaryPayor = coverage.payor[0]!;

  // Prefer display name
  if (primaryPayor.display) return normalizePayerName(primaryPayor.display);

  // Fall back to reference (won't be as useful but better than nothing)
  if (primaryPayor.reference) return primaryPayor.reference;

  return null;
}

/**
 * Extract plan type from Coverage.class[].
 *
 * FHIR Coverage uses the `class` array with type coding to indicate
 * plan type, group, etc. We look for a class entry with type "plan".
 *
 * If no plan class exists, we try the Coverage.type field.
 */
export function extractPlanType(coverage: FHIRCoverage): string | null {
  // Try class entries first
  if (coverage.class) {
    const planClass = findCoverageClass(
      coverage.class,
      FHIR_SYSTEMS.COVERAGE_CLASS_PLAN
    );
    if (planClass) return planClass.value;

    // Some payers use "group" instead of "plan"
    const groupClass = findCoverageClass(
      coverage.class,
      FHIR_SYSTEMS.COVERAGE_CLASS_GROUP
    );
    if (groupClass?.name) return groupClass.name;
  }

  // Fallback: Coverage.type
  if (coverage.type) {
    return (
      coverage.type.text ??
      coverage.type.coding?.[0]?.display ??
      coverage.type.coding?.[0]?.code ??
      null
    );
  }

  return null;
}

/**
 * Pick the best coverage record for a patient when multiple exist.
 *
 * Priority:
 * 1. Active coverage (status = "active")
 * 2. Primary coverage (order = 1)
 * 3. Most recently updated (by meta.lastUpdated)
 * 4. First one
 */
export function pickPrimaryCoverage(
  coverages: FHIRCoverage[]
): FHIRCoverage | null {
  if (coverages.length === 0) return null;
  if (coverages.length === 1) return coverages[0]!;

  // Filter to active coverages
  const active = coverages.filter((c) => c.status === "active");
  const pool = active.length > 0 ? active : coverages;

  // Prefer primary (order=1)
  const primary = pool.find((c) => c.order === 1);
  if (primary) return primary;

  // Sort by lastUpdated descending
  const sorted = [...pool].sort((a, b) => {
    const aTime = a.meta?.lastUpdated ?? "";
    const bTime = b.meta?.lastUpdated ?? "";
    return bTime.localeCompare(aTime);
  });

  return sorted[0] ?? null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findCoverageClass(
  classes: FHIRCoverageClass[],
  typeCode: string
): FHIRCoverageClass | undefined {
  return classes.find((c) => {
    if (!c.type?.coding) return false;
    return c.type.coding.some((coding) => coding.code === typeCode);
  });
}

/**
 * Normalize payer name for consistent matching against payer rules.
 *
 * - Trims whitespace
 * - Collapses multiple spaces
 * - Maps common abbreviations to canonical names
 */
export function normalizePayerName(name: string): string {
  const normalized = name.trim().replace(/\s+/g, " ");

  // Common payer name normalization
  const PAYER_ALIASES: Record<string, string> = {
    "United Healthcare": "UnitedHealthcare",
    "United Health Care": "UnitedHealthcare",
    UHC: "UnitedHealthcare",
    "Blue Cross Blue Shield": "BCBS",
    "Blue Cross/Blue Shield": "BCBS",
    "Anthem BCBS": "BCBS",
    "Anthem Blue Cross": "BCBS",
  };

  for (const [alias, canonical] of Object.entries(PAYER_ALIASES)) {
    if (normalized.toLowerCase() === alias.toLowerCase()) {
      return canonical;
    }
  }

  return normalized;
}

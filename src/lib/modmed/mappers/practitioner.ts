/**
 * FHIR Practitioner → MappedPractitioner mapper.
 *
 * Practitioners are providers (doctors) at the practice. We store
 * their display name, NPI, and specialty for provider dropdown
 * display and appointment attribution.
 *
 * Practitioner names are NOT PHI (they're public via NPI registry).
 * No encryption needed.
 */

import type {
  FHIRPractitioner,
  FHIRHumanName,
  FHIRIdentifier,
  MappedPractitioner,
} from "../types";
import { FHIR_SYSTEMS } from "../types";

/**
 * Map a FHIR Practitioner resource to our internal model.
 */
export function mapPractitioner(
  practitioner: FHIRPractitioner
): MappedPractitioner {
  return {
    modmed_practitioner_id: practitioner.id,
    display_name: formatPractitionerName(practitioner.name),
    npi: extractNPI(practitioner.identifier),
    specialty: extractSpecialty(practitioner),
    active: practitioner.active ?? true,
  };
}

/**
 * Format practitioner name for display.
 * Includes prefix (Dr., etc.) when available.
 *
 * Priority: official name > first name entry > "Unknown Provider"
 */
export function formatPractitionerName(
  names: FHIRHumanName[] | undefined
): string {
  if (!names || names.length === 0) return "Unknown Provider";

  const name =
    names.find((n) => n.use === "official") ?? names[0];

  if (name.text) return name.text;

  const parts: string[] = [];

  if (name.prefix?.length) {
    parts.push(name.prefix.join(" "));
  }

  const given = name.given?.join(" ");
  const family = name.family;

  if (given) parts.push(given);
  if (family) parts.push(family);

  if (name.suffix?.length) {
    parts.push(name.suffix.join(", "));
  }

  return parts.length > 0 ? parts.join(" ") : "Unknown Provider";
}

/**
 * Extract NPI (National Provider Identifier) from identifiers.
 */
export function extractNPI(
  identifiers: FHIRIdentifier[] | undefined
): string | null {
  if (!identifiers) return null;

  const npi = identifiers.find((id) => id.system === FHIR_SYSTEMS.NPI);
  return npi?.value ?? null;
}

/**
 * Extract primary specialty from practitioner qualifications.
 */
export function extractSpecialty(
  practitioner: FHIRPractitioner
): string | null {
  if (!practitioner.qualification?.length) return null;

  const firstQual = practitioner.qualification[0];
  return (
    firstQual.code?.text ??
    firstQual.code?.coding?.[0]?.display ??
    firstQual.code?.coding?.[0]?.code ??
    null
  );
}

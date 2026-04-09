/**
 * FHIR Patient → MappedPatient mapper.
 *
 * HIPAA: Patient names are PHI. This mapper encrypts them via encryptPHI()
 * before returning the mapped record. Never log the plaintext name.
 *
 * Coverage data is merged in separately via mapCoverage() because FHIR
 * treats Coverage as a separate resource from Patient.
 */

import { encryptPHI } from "@/lib/crypto/phi";
import type { FHIRPatient, FHIRHumanName, MappedPatient } from "../types";

/**
 * Map a FHIR Patient resource to our internal patient model.
 *
 * @param patient - Raw FHIR Patient from ModMed
 * @param practiceId - The practice this patient belongs to
 * @returns MappedPatient ready for DB upsert (name already encrypted)
 */
export function mapPatient(
  patient: FHIRPatient,
  practiceId: string
): MappedPatient {
  const displayName = formatPatientName(patient.name);

  return {
    practice_id: practiceId,
    modmed_patient_id: patient.id,
    name_encrypted: encryptPHI(displayName),
    // Insurance fields populated separately via coverage mapper
    insurance_payer: null,
    plan_id: null,
    plan_type: null,
  };
}

/**
 * Format a FHIR HumanName array into a display string.
 *
 * Priority:
 * 1. name[use=official] — preferred
 * 2. name[use=usual] — fallback
 * 3. name[0] — any available name
 *
 * Format: "Family, Given1 Given2" or "Unknown Patient" if no name.
 */
export function formatPatientName(
  names: FHIRHumanName[] | undefined
): string {
  if (!names || names.length === 0) return "Unknown Patient";

  // Pick best name entry
  const name =
    names.find((n) => n.use === "official") ??
    names.find((n) => n.use === "usual") ??
    names[0];

  // If there's a pre-formatted text field, use it
  if (name.text) return name.text;

  const family = name.family ?? "";
  const given = name.given?.join(" ") ?? "";

  if (family && given) return `${family}, ${given}`;
  if (family) return family;
  if (given) return given;

  return "Unknown Patient";
}

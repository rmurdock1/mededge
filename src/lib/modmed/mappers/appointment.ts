/**
 * FHIR Appointment → MappedAppointment mapper.
 *
 * Extracts CPT codes, ICD-10 codes, patient reference, provider reference,
 * and appointment date from a FHIR Appointment resource.
 *
 * CPT/ICD-10 code extraction:
 * - CPT codes: from serviceType[].coding[] with system matching CPT
 * - ICD-10 codes: from reasonCode[].coding[] with system matching ICD-10-CM
 * - Also checks extensions (ModMed may use proprietary extensions)
 *
 * No PHI is present in appointment data that we store (we store codes
 * and references, not narrative text). The patient reference is a
 * ModMed ID, not a name.
 */

import type {
  FHIRAppointment,
  FHIRCodeableConcept,
  FHIRCoding,
  MappedAppointment,
} from "../types";

// Known CPT/HCPCS systems — ModMed may use any of these
const CPT_SYSTEMS = new Set([
  "http://www.ama-assn.org/go/cpt",
  "https://www.ama-assn.org/go/cpt",
  "urn:oid:2.16.840.1.113883.6.12", // CPT OID
]);

// Known ICD-10-CM systems
const ICD10_SYSTEMS = new Set([
  "http://hl7.org/fhir/sid/icd-10-cm",
  "http://hl7.org/fhir/sid/icd-10",
  "urn:oid:2.16.840.1.113883.6.90", // ICD-10-CM OID
]);

/**
 * Map a FHIR Appointment resource to our internal appointment model.
 *
 * @param appointment - Raw FHIR Appointment from ModMed
 * @param practiceId - The practice this appointment belongs to
 * @returns MappedAppointment ready for DB upsert
 */
export function mapAppointment(
  appointment: FHIRAppointment,
  practiceId: string
): MappedAppointment {
  return {
    practice_id: practiceId,
    modmed_appointment_id: appointment.id,
    modmed_patient_id: extractPatientId(appointment),
    provider_id: extractProviderId(appointment),
    appointment_date: extractDate(appointment),
    cpt_codes: extractCPTCodes(appointment),
    icd10_codes: extractICD10Codes(appointment),
  };
}

/**
 * Extract the patient reference from appointment participants.
 * Returns the ModMed patient ID (e.g., "123" from "Patient/123").
 */
export function extractPatientId(appointment: FHIRAppointment): string {
  if (!appointment.participant) return "";

  for (const p of appointment.participant) {
    const ref = p.actor?.reference;
    if (ref?.startsWith("Patient/")) {
      return ref.replace("Patient/", "");
    }
  }

  return "";
}

/**
 * Extract the practitioner reference from appointment participants.
 * Returns the ModMed practitioner ID or null.
 */
export function extractProviderId(
  appointment: FHIRAppointment
): string | null {
  if (!appointment.participant) return null;

  for (const p of appointment.participant) {
    const ref = p.actor?.reference;
    if (ref?.startsWith("Practitioner/")) {
      return ref.replace("Practitioner/", "");
    }
  }

  return null;
}

/**
 * Extract appointment date as YYYY-MM-DD string.
 * Falls back to today if no start time (shouldn't happen).
 */
export function extractDate(appointment: FHIRAppointment): string {
  if (appointment.start) {
    // ISO datetime → date only
    return appointment.start.substring(0, 10);
  }

  return new Date().toISOString().substring(0, 10);
}

/**
 * Extract CPT codes from serviceType codings and extensions.
 * Returns deduplicated array of CPT code strings.
 */
export function extractCPTCodes(appointment: FHIRAppointment): string[] {
  const codes = new Set<string>();

  // From serviceType
  if (appointment.serviceType) {
    for (const concept of appointment.serviceType) {
      extractCodesFromConcept(concept, CPT_SYSTEMS, codes);
    }
  }

  // From extensions (ModMed proprietary)
  if (appointment.extension) {
    for (const ext of appointment.extension) {
      if (ext.valueCoding && isCPTCoding(ext.valueCoding)) {
        if (ext.valueCoding.code) codes.add(ext.valueCoding.code);
      }
      if (ext.valueCodeableConcept) {
        extractCodesFromConcept(ext.valueCodeableConcept, CPT_SYSTEMS, codes);
      }
    }
  }

  return Array.from(codes);
}

/**
 * Extract ICD-10 codes from reasonCode codings and extensions.
 * Returns deduplicated array of ICD-10 code strings.
 */
export function extractICD10Codes(appointment: FHIRAppointment): string[] {
  const codes = new Set<string>();

  // From reasonCode
  if (appointment.reasonCode) {
    for (const concept of appointment.reasonCode) {
      extractCodesFromConcept(concept, ICD10_SYSTEMS, codes);
    }
  }

  // From extensions
  if (appointment.extension) {
    for (const ext of appointment.extension) {
      if (ext.valueCoding && isICD10Coding(ext.valueCoding)) {
        if (ext.valueCoding.code) codes.add(ext.valueCoding.code);
      }
      if (ext.valueCodeableConcept) {
        extractCodesFromConcept(
          ext.valueCodeableConcept,
          ICD10_SYSTEMS,
          codes
        );
      }
    }
  }

  return Array.from(codes);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractCodesFromConcept(
  concept: FHIRCodeableConcept,
  validSystems: Set<string>,
  target: Set<string>
): void {
  if (!concept.coding) return;

  for (const coding of concept.coding) {
    if (coding.code && (!coding.system || validSystems.has(coding.system))) {
      target.add(coding.code);
    }
  }
}

function isCPTCoding(coding: FHIRCoding): boolean {
  return coding.system != null && CPT_SYSTEMS.has(coding.system);
}

function isICD10Coding(coding: FHIRCoding): boolean {
  return coding.system != null && ICD10_SYSTEMS.has(coding.system);
}

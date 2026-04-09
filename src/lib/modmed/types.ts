/**
 * ModMed FHIR types and internal mapped types.
 *
 * FHIR types represent the subset of R4 resources returned by ModMed's
 * Proprietary FHIR API. We only model the fields we actually use.
 *
 * Mapped types represent what our data mappers produce — ready for
 * upsert into our Supabase tables.
 */

// ---------------------------------------------------------------------------
// FHIR Primitives
// ---------------------------------------------------------------------------

export interface FHIRReference {
  reference?: string; // e.g. "Patient/123"
  display?: string;
}

export interface FHIRCoding {
  system?: string;
  code?: string;
  display?: string;
}

export interface FHIRCodeableConcept {
  coding?: FHIRCoding[];
  text?: string;
}

export interface FHIRHumanName {
  use?: "official" | "usual" | "temp" | "nickname" | "anonymous" | "old" | "maiden";
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
  text?: string;
}

export interface FHIRAddress {
  use?: "home" | "work" | "temp" | "old" | "billing";
  line?: string[];
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface FHIRContactPoint {
  system?: "phone" | "fax" | "email" | "pager" | "url" | "sms" | "other";
  value?: string;
  use?: "home" | "work" | "temp" | "old" | "mobile";
}

export interface FHIRIdentifier {
  system?: string;
  value?: string;
  type?: FHIRCodeableConcept;
}

export interface FHIRPeriod {
  start?: string;
  end?: string;
}

export interface FHIRExtension {
  url: string;
  valueString?: string;
  valueCode?: string;
  valueCoding?: FHIRCoding;
  valueCodeableConcept?: FHIRCodeableConcept;
  valueReference?: FHIRReference;
  valueInteger?: number;
  valueBoolean?: boolean;
}

// ---------------------------------------------------------------------------
// FHIR Bundle (pagination wrapper)
// ---------------------------------------------------------------------------

export interface FHIRBundle<T extends FHIRResource = FHIRResource> {
  resourceType: "Bundle";
  type: "searchset" | "batch" | "transaction";
  total?: number;
  link?: FHIRBundleLink[];
  entry?: FHIRBundleEntry<T>[];
}

export interface FHIRBundleLink {
  relation: "self" | "next" | "previous" | "first" | "last";
  url: string;
}

export interface FHIRBundleEntry<T extends FHIRResource = FHIRResource> {
  fullUrl?: string;
  resource?: T;
}

// ---------------------------------------------------------------------------
// FHIR Resources
// ---------------------------------------------------------------------------

export interface FHIRResource {
  resourceType: string;
  id?: string;
  meta?: {
    lastUpdated?: string;
    versionId?: string;
  };
  extension?: FHIRExtension[];
}

export interface FHIRPatient extends FHIRResource {
  resourceType: "Patient";
  id: string;
  name?: FHIRHumanName[];
  birthDate?: string;
  gender?: string;
  address?: FHIRAddress[];
  telecom?: FHIRContactPoint[];
  identifier?: FHIRIdentifier[];
}

export interface FHIRAppointment extends FHIRResource {
  resourceType: "Appointment";
  id: string;
  status?: "proposed" | "pending" | "booked" | "arrived" | "fulfilled" | "cancelled" | "noshow" | "entered-in-error";
  start?: string; // ISO datetime
  end?: string;
  participant?: FHIRAppointmentParticipant[];
  serviceType?: FHIRCodeableConcept[];
  reasonCode?: FHIRCodeableConcept[];
  description?: string;
}

export interface FHIRAppointmentParticipant {
  actor?: FHIRReference;
  status?: "accepted" | "declined" | "tentative" | "needs-action";
  type?: FHIRCodeableConcept[];
}

export interface FHIRCoverage extends FHIRResource {
  resourceType: "Coverage";
  id: string;
  status?: "active" | "cancelled" | "draft" | "entered-in-error";
  beneficiary?: FHIRReference;
  payor?: FHIRReference[];
  subscriberId?: string;
  class?: FHIRCoverageClass[];
  type?: FHIRCodeableConcept;
  period?: FHIRPeriod;
  relationship?: FHIRCodeableConcept;
  order?: number;
}

export interface FHIRCoverageClass {
  type: FHIRCodeableConcept;
  value: string;
  name?: string;
}

export interface FHIRPractitioner extends FHIRResource {
  resourceType: "Practitioner";
  id: string;
  name?: FHIRHumanName[];
  identifier?: FHIRIdentifier[];
  qualification?: FHIRPractitionerQualification[];
  telecom?: FHIRContactPoint[];
  active?: boolean;
}

export interface FHIRPractitionerQualification {
  code: FHIRCodeableConcept;
  period?: FHIRPeriod;
  issuer?: FHIRReference;
}

// ---------------------------------------------------------------------------
// FHIR Code Systems (used in coding lookups)
// ---------------------------------------------------------------------------

export const FHIR_SYSTEMS = {
  CPT: "http://www.ama-assn.org/go/cpt",
  HCPCS: "https://www.cms.gov/Medicare/Coding/HCPCSReleaseCodeSets",
  ICD10: "http://hl7.org/fhir/sid/icd-10-cm",
  NPI: "http://hl7.org/fhir/sid/us-npi",
  COVERAGE_CLASS_PLAN: "plan",
  COVERAGE_CLASS_GROUP: "group",
} as const;

// ---------------------------------------------------------------------------
// Mapped Types (output of our data mappers, ready for DB upsert)
// ---------------------------------------------------------------------------

/**
 * Mapped patient data ready for upsert to the `patients` table.
 * `name_encrypted` is already encrypted via encryptPHI().
 */
export interface MappedPatient {
  practice_id: string;
  modmed_patient_id: string;
  name_encrypted: string; // encrypted via encryptPHI()
  insurance_payer: string | null;
  plan_id: string | null;
  plan_type: string | null;
}

/**
 * Mapped appointment data ready for upsert to the `appointments` table.
 * `patient_id` must be resolved from modmed_patient_id before insert.
 */
export interface MappedAppointment {
  practice_id: string;
  modmed_appointment_id: string;
  modmed_patient_id: string; // resolved to patient_id at upsert time
  provider_id: string | null;
  appointment_date: string; // YYYY-MM-DD
  cpt_codes: string[];
  icd10_codes: string[];
}

/**
 * Mapped coverage (insurance) data. Merged into the patient record
 * rather than stored separately.
 */
export interface MappedCoverage {
  modmed_patient_id: string; // links back to the patient
  insurance_payer: string | null;
  plan_id: string | null;
  plan_type: string | null;
}

/**
 * Mapped practitioner data. Stored for provider display names
 * and NPI references, not in a separate table yet — provider_id
 * on appointments references these.
 */
export interface MappedPractitioner {
  modmed_practitioner_id: string;
  display_name: string;
  npi: string | null;
  specialty: string | null;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Client config
// ---------------------------------------------------------------------------

export interface ModMedClientConfig {
  /** Practice-specific firm URL prefix, e.g. "orthopmsandbox499" */
  firmUrlPrefix: string;
  /** OAuth2 username */
  username: string;
  /** OAuth2 password */
  password: string;
  /** ModMed API key (x-api-key header) */
  apiKey: string;
  /** Base URL for auth endpoints, e.g. "https://stage.ema-api.com/ema-dev" */
  authBaseUrl: string;
}

export interface ModMedTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number; // seconds
}

// ---------------------------------------------------------------------------
// Circuit Breaker
// ---------------------------------------------------------------------------

export interface CircuitBreakerState {
  status: "closed" | "open" | "half_open";
  failure_count: number;
  last_failure_at: string | null;
  last_failure_error: string | null;
  opened_at: string | null;
}

export const DEFAULT_CIRCUIT_BREAKER_STATE: CircuitBreakerState = {
  status: "closed",
  failure_count: 0,
  last_failure_at: null,
  last_failure_error: null,
  opened_at: null,
};

// ---------------------------------------------------------------------------
// Sync types (used in PR 2, defined here for type completeness)
// ---------------------------------------------------------------------------

export type SyncType = "full" | "incremental";
export type SyncStatus = "running" | "completed" | "failed" | "partial";
export type SyncTrigger = "cron" | "manual" | "initial_setup";

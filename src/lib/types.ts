// Core application types
// These mirror the database schema and are used throughout the app.

export type UserRole =
  | "practice_admin"
  | "staff"
  | "billing_manager"
  | "super_admin";

export type SubmissionMethod = "portal" | "fax" | "phone" | "electronic";

export type PAStatus =
  | "not_needed"
  | "needed"
  | "in_progress"
  | "submitted"
  | "approved"
  | "denied"
  | "appeal_submitted"
  | "appeal_approved";

export type PriorAuthStatus =
  | "draft"
  | "ready"
  | "submitted"
  | "pending"
  | "approved"
  | "denied"
  | "appeal_draft"
  | "appeal_submitted"
  | "appeal_approved"
  | "appeal_denied"
  | "expired";

export type PAOutcomeType = "approved" | "denied";
export type AppealOutcomeType = "approved" | "denied";

// ---- Entities ----

export interface Practice {
  id: string;
  name: string;
  is_internal: boolean;
  modmed_url_prefix: string | null;
  modmed_credentials: Record<string, unknown> | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  practice_id: string;
  role: UserRole;
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * @deprecated Reads from the payer_rules compatibility view (Sprint 3 shim).
 * Use PayerRuleDrug or PayerRuleProcedure for new code. Will be removed in
 * Sprint 6 when checkPARequired is rewritten against the typed tables.
 */
export interface PayerRule {
  id: string;
  payer_name: string;
  plan_type: string;
  cpt_code: string;
  icd10_code: string | null;
  pa_required: boolean;
  documentation_requirements: DocumentationItem[];
  submission_method: SubmissionMethod;
  typical_turnaround_days: number | null;
  step_therapy_required: boolean;
  step_therapy_details: string | null;
  last_verified_date: string;
  source_url: string;
  confidence_score: number;
  created_at: string;
  updated_at: string;
}

// ---- v2 rule schema (Sprint 3) ----

export type BcbsLicensee =
  | "anthem"
  | "highmark"
  | "bcbsil"
  | "bcbsmi"
  | "bcbsma"
  | "bcbsnc"
  | "bcbsfl"
  | "bcbstx"
  | "horizon_bcbsnj"
  | "carefirst"
  | "independence"
  | "regence"
  | "premera"
  | "wellmark"
  | "other";

export type AuditAction =
  | "insert"
  | "update"
  | "delete"
  | "soft_delete"
  | "restore";

export type AuditSource =
  | "manual"
  | "bootstrap"
  | "seed"
  | "policy_watch"
  | "api";

export interface StepTherapyDetails {
  required_drugs?: string[];
  duration_days?: number;
  exceptions?: string[];
  legacy_text?: string; // populated by Sprint 3 migration only
}

export interface AppealsPathway {
  levels: Array<{
    name: string;
    deadline_days: number;
    submission_method: SubmissionMethod;
    forms?: string[];
  }>;
}

export interface LabRequirements {
  tb_test?: boolean;
  hepatitis_panel?: boolean;
  cbc?: boolean;
  liver_function?: boolean;
  other?: string[];
}

export interface PayerRuleDrug {
  id: string;
  payer_name: string;
  plan_type: string;
  bcbs_licensee: BcbsLicensee | null;
  hcpcs_code: string | null;
  ndc_code: string | null;
  drug_name: string;
  icd10_codes: string[];
  pa_required: boolean;
  documentation_requirements: DocumentationItem[];
  step_therapy_required: boolean;
  step_therapy_details: StepTherapyDetails | null;
  appeals_pathway: AppealsPathway | null;
  lab_requirements: LabRequirements | null;
  submission_method: SubmissionMethod | null;
  typical_turnaround_days: number | null;
  source_url: string;
  source_document_excerpt: string | null;
  last_verified_date: string;
  last_verified_by: string | null;
  confidence_score: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface SiteOfServiceRestrictions {
  allowed: Array<"office" | "asc" | "hopd" | "inpatient">;
  notes?: string;
}

export interface ModifierRequirements {
  required: string[];
  conditional?: Array<{ modifier: string; when: string }>;
}

export interface UnitsOrFrequencyLimits {
  max_per_period?: { count: number; period_days: number };
  max_lesions?: number;
  notes?: string;
}

export interface PayerRuleProcedure {
  id: string;
  payer_name: string;
  plan_type: string;
  bcbs_licensee: BcbsLicensee | null;
  cpt_code: string;
  procedure_name: string;
  icd10_codes: string[];
  pa_required: boolean;
  documentation_requirements: DocumentationItem[];
  site_of_service_restrictions: SiteOfServiceRestrictions | null;
  modifier_requirements: ModifierRequirements | null;
  units_or_frequency_limits: UnitsOrFrequencyLimits | null;
  appeals_pathway: AppealsPathway | null;
  submission_method: SubmissionMethod | null;
  typical_turnaround_days: number | null;
  source_url: string;
  source_document_excerpt: string | null;
  last_verified_date: string;
  last_verified_by: string | null;
  confidence_score: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface RuleAuditLogEntry {
  id: string;
  drug_rule_id: string | null;
  procedure_rule_id: string | null;
  action: AuditAction;
  source: AuditSource;
  actor_user_id: string | null;
  change_reason: string | null;
  row_before: Record<string, unknown> | null;
  row_after: Record<string, unknown> | null;
  changed_fields: string[] | null;
  created_at: string;
}

export interface DocumentationItem {
  item: string;
  required: boolean;
  description?: string;
  completed?: boolean;
}

export interface Patient {
  id: string;
  practice_id: string;
  modmed_patient_id: string | null;
  name_encrypted: string;
  insurance_payer: string | null;
  plan_id: string | null;
  plan_type: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  practice_id: string;
  patient_id: string;
  modmed_appointment_id: string | null;
  provider_id: string | null;
  appointment_date: string;
  cpt_codes: string[];
  icd10_codes: string[];
  pa_status: PAStatus;
  created_at: string;
  updated_at: string;
}

export interface PriorAuth {
  id: string;
  practice_id: string;
  appointment_id: string | null;
  patient_id: string;
  payer_name: string;
  procedure_or_medication: string;
  status: PriorAuthStatus;
  documentation_checklist: DocumentationItem[];
  submitted_date: string | null;
  decision_date: string | null;
  expiration_date: string | null;
  denial_reason: string | null;
  appeal_letter: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PAOutcome {
  id: string;
  practice_id: string;
  payer_name: string;
  plan_type: string;
  cpt_code: string;
  documentation_included: Record<string, unknown>[];
  outcome: PAOutcomeType;
  denial_reason_category: string | null;
  appeal_outcome: AppealOutcomeType | null;
  turnaround_days: number | null;
  created_at: string;
}

export interface PAActivityLog {
  id: string;
  prior_auth_id: string;
  action: string;
  details: string | null;
  user_id: string | null;
  created_at: string;
}

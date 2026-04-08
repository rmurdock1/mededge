// Core application types
// These mirror the database schema and are used throughout the app.

export type UserRole = "practice_admin" | "staff" | "billing_manager";

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

# Architecture and Data Model

## Core Data Model

```
practices
  - id (uuid, PK)
  - name (text)
  - modmed_url_prefix (text, encrypted)
  - modmed_credentials (jsonb, encrypted)
  - address, city, state, zip
  - settings (jsonb)
  - created_at, updated_at

payer_rules
  - id (uuid, PK)
  - payer_name (text, indexed)
  - plan_type (text)
  - cpt_code (text, indexed)
  - icd10_code (text, nullable)
  - pa_required (boolean)
  - documentation_requirements (jsonb array)
  - submission_method (enum: portal, fax, phone, electronic)
  - typical_turnaround_days (integer)
  - step_therapy_required (boolean)
  - step_therapy_details (text)
  - last_verified_date (date)
  - source_url (text)
  - confidence_score (float, 0-1)

patients (synced from ModMed)
  - id (uuid, PK)
  - practice_id (uuid, FK)
  - modmed_patient_id (text)
  - name_encrypted (text)
  - insurance_payer (text)
  - plan_id (text)
  - plan_type (text)
  - last_synced_at (timestamp)

appointments (synced from ModMed)
  - id (uuid, PK)
  - practice_id (uuid, FK)
  - patient_id (uuid, FK)
  - modmed_appointment_id (text)
  - provider_id (text)
  - appointment_date (date)
  - cpt_codes (text array)
  - icd10_codes (text array)
  - pa_status (enum: not_needed, needed, in_progress, submitted, approved, denied, appeal_submitted, appeal_approved)

prior_auths
  - id (uuid, PK)
  - practice_id (uuid, FK)
  - appointment_id (uuid, FK, nullable)
  - patient_id (uuid, FK)
  - payer_name (text)
  - procedure_or_medication (text)
  - status (enum: draft, ready, submitted, pending, approved, denied, appeal_draft, appeal_submitted, appeal_approved, appeal_denied, expired)
  - documentation_checklist (jsonb)
  - submitted_date (timestamp, nullable)
  - decision_date (timestamp, nullable)
  - expiration_date (date, nullable)
  - denial_reason (text, nullable)
  - appeal_letter (text, nullable)
  - notes (text)
  - created_by (uuid, FK to auth.users)
  - created_at, updated_at

pa_outcomes (for payer intelligence network)
  - id (uuid, PK)
  - practice_id (uuid, FK)
  - payer_name (text)
  - plan_type (text)
  - cpt_code (text)
  - documentation_included (jsonb, what was submitted)
  - outcome (enum: approved, denied)
  - denial_reason_category (text, nullable)
  - appeal_outcome (enum: null, approved, denied)
  - turnaround_days (integer)
  - created_at (timestamp)
  Note: This table stores anonymized outcomes only. No patient identifiers.

pa_activity_log
  - id (uuid, PK)
  - prior_auth_id (uuid, FK)
  - action (text)
  - details (text)
  - user_id (uuid, FK)
  - created_at (timestamp)
```

## Row-Level Security

Every table with practice_id MUST have RLS policies ensuring:
- Users can only read/write rows belonging to their practice
- The practice_id is set automatically from the authenticated user's JWT claims
- No cross-practice data leakage is possible

Pattern:
```sql
ALTER TABLE [table] ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access own practice data"
  ON [table] FOR ALL
  USING (practice_id = auth.jwt() -> 'app_metadata' ->> 'practice_id');
```

## API Route Structure

```
app/api/
  auth/           # Login, signup, practice onboarding
  practices/      # Practice settings and configuration
  appointments/   # Appointment sync and PA status
  prior-auths/    # PA CRUD, status updates, checklist management
  payer-rules/    # Payer rule lookups and admin
  appeals/        # Appeal generation and tracking
  radar/          # Revenue opportunity radar data
  modmed/         # ModMed OAuth and sync endpoints
  webhooks/       # Incoming webhooks from ModMed (if available)
```

## Key Architectural Decisions

1. We connect to Practice Management systems, NOT EHR. For ModMed, this means MMPM, not EMA. Scheduling, claims, and insurance data live in the PM.
2. All PHI is encrypted at rest in Supabase. We never cache PHI in local storage, session storage, or cookies.
3. The payer rules engine is a database lookup, not an AI call. AI is used for document assembly and appeal letter generation, not for determining PA requirements.
4. pa_outcomes stores anonymized data only. This table powers the Payer Intelligence Network and must never contain patient identifiers.

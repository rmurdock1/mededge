-- Enum types for MedEdge
-- These are used across multiple tables

CREATE TYPE submission_method AS ENUM (
  'portal',
  'fax',
  'phone',
  'electronic'
);

CREATE TYPE pa_status AS ENUM (
  'not_needed',
  'needed',
  'in_progress',
  'submitted',
  'approved',
  'denied',
  'appeal_submitted',
  'appeal_approved'
);

CREATE TYPE prior_auth_status AS ENUM (
  'draft',
  'ready',
  'submitted',
  'pending',
  'approved',
  'denied',
  'appeal_draft',
  'appeal_submitted',
  'appeal_approved',
  'appeal_denied',
  'expired'
);

CREATE TYPE pa_outcome_type AS ENUM (
  'approved',
  'denied'
);

CREATE TYPE appeal_outcome_type AS ENUM (
  'approved',
  'denied'
);

CREATE TYPE user_role AS ENUM (
  'practice_admin',
  'staff',
  'billing_manager'
);

-- Schema refactor: Sprint 3
-- Part 1 of 6: enum additions and practices.is_internal
--
-- Adds:
--   * super_admin role for MedEdge Operations users
--   * is_internal flag on practices to mark MedEdge-owned tenants
--   * bcbs_licensee enum (placeholder for Sprint 5+ rule cleanup; not
--     populated in this sprint)
--   * audit_action / audit_source enums for the new rule_audit_log

-- ---------------------------------------------------------------------------
-- 1. Extend user_role with super_admin
-- ---------------------------------------------------------------------------
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block in older
-- Postgres, but Supabase runs migrations one statement at a time so this is
-- safe. IF NOT EXISTS makes the migration idempotent.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'super_admin';

-- ---------------------------------------------------------------------------
-- 2. is_internal flag on practices
-- ---------------------------------------------------------------------------
-- Marks MedEdge-owned tenants (e.g. "MedEdge Operations") so we can exclude
-- them from customer-facing reports and filter them in admin views.
ALTER TABLE practices
  ADD COLUMN IF NOT EXISTS is_internal boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_practices_is_internal
  ON practices (is_internal)
  WHERE is_internal = true;

-- ---------------------------------------------------------------------------
-- 3. New enums for rule schema v2
-- ---------------------------------------------------------------------------

-- BCBS is a federation of ~33 independent licensees with their own coverage
-- policies. We add the enum now so the new rule tables can reference it,
-- but no rules use it yet — Sprint 5 will populate BCBS rules per licensee.
DO $$ BEGIN
  CREATE TYPE bcbs_licensee AS ENUM (
    'anthem',
    'highmark',
    'bcbsil',
    'bcbsmi',
    'bcbsma',
    'bcbsnc',
    'bcbsfl',
    'bcbstx',
    'horizon_bcbsnj',
    'carefirst',
    'independence',
    'regence',
    'premera',
    'wellmark',
    'other'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Audit log action types
DO $$ BEGIN
  CREATE TYPE audit_action AS ENUM (
    'insert',
    'update',
    'delete',
    'soft_delete',
    'restore'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Where the audit-logged change came from. Lets us distinguish manual admin
-- edits from automated Policy Watch updates and bulk imports.
DO $$ BEGIN
  CREATE TYPE audit_source AS ENUM (
    'manual',         -- super_admin via admin dashboard
    'bootstrap',      -- one-time setup scripts
    'seed',           -- bulk seed from JSON files
    'policy_watch',   -- future automated policy scraper
    'api'             -- programmatic API caller
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

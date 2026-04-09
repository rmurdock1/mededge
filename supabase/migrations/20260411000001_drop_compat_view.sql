-- Sprint 6: Drop the payer_rules compatibility view
--
-- The view was a shim to let the old checkPARequired() function and seed
-- script keep working while the schema was split into typed tables
-- (payer_rules_drug, payer_rules_procedure) in Sprint 3.
--
-- Sprint 6 rewrites checkPARequired() to query the typed tables directly,
-- so the view, its INSTEAD OF triggers, and the block-write function are
-- no longer needed.
--
-- Objects dropped:
--   1. INSTEAD OF triggers:  payer_rules_view_no_insert
--                            payer_rules_view_no_update
--                            payer_rules_view_no_delete
--   2. View:                 payer_rules
--   3. Function:             payer_rules_view_block_write()
--
-- The frozen legacy table (payer_rules_legacy_v1) is intentionally kept.
-- It preserves the original seed data for audit trail and rollback.

-- 1. Drop triggers (must happen before the view they're attached to)
DROP TRIGGER IF EXISTS payer_rules_view_no_insert ON payer_rules;
DROP TRIGGER IF EXISTS payer_rules_view_no_update ON payer_rules;
DROP TRIGGER IF EXISTS payer_rules_view_no_delete ON payer_rules;

-- 2. Drop the compatibility view
DROP VIEW IF EXISTS payer_rules;

-- 3. Drop the block-write trigger function
DROP FUNCTION IF EXISTS payer_rules_view_block_write();

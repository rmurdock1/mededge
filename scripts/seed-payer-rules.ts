/**
 * @deprecated This script is non-functional. The v1 payer_rules table was
 * replaced by payer_rules_drug and payer_rules_procedure in Sprint 3, and
 * the compatibility view was dropped in Sprint 6.
 *
 * To seed rules:
 * - Use SQL migrations (supabase/migrations/) for bulk changes
 * - Use the admin dashboard CRUD RPCs for individual rule edits
 * - JSON files in data/payer-rules/ serve as reference data, not import source
 *
 * This file is kept as a stub to prevent `npm run db:seed` from failing
 * silently. It prints a deprecation notice and exits.
 */

console.warn(
  "\n⚠️  seed-payer-rules.ts is deprecated.\n" +
    "   The payer_rules compatibility view was dropped in Sprint 6.\n" +
    "   Use SQL migrations or admin dashboard RPCs to manage rules.\n" +
    "   See docs/agent/rule-schema.md for details.\n"
);

process.exit(0);

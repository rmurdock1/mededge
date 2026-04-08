# Payer Rule Schema (v2)

Sprint 3 split the original `payer_rules` table into two typed tables and added an immutable audit log. This doc is the source of truth for what each table is for, why the split exists, and what the compatibility shim is hiding.

## TL;DR

| Old | New |
|---|---|
| `payer_rules` (table) | `payer_rules` (read-only view) + `payer_rules_drug` + `payer_rules_procedure` |
| Single `cpt_code` field for both J-codes and CPTs | Drugs use `hcpcs_code` / `ndc_code`; procedures use `cpt_code` |
| Single `icd10_code` (one diagnosis per rule) | `icd10_codes text[]` (multi-diagnosis per rule) |
| `step_therapy_details text` | `step_therapy_details jsonb` (structured) |
| No audit log | `rule_audit_log` (immutable, super_admin only) |
| Anyone with practice_admin role could write | Only `super_admin` can write |

## Why split drugs from procedures

The verification report on the 25 seed rules found that ~80% were wrong, and the root cause was structural: the single `payer_rules` table conflated two genuinely different things.

- **Drug rules** (Dupixent, Humira, Enbrel...) hinge on step therapy histories, lab requirements (TB, hep panels), and NDC-level precision. Documentation patterns are biologic-specific.
- **Procedure rules** (Mohs, phototherapy, patch testing) hinge on site-of-service restrictions, modifiers, and frequency limits. Step therapy is rarely relevant.

Trying to express both with one schema meant every drug rule had empty procedure fields and vice versa, and the docs requirements bag became a dumping ground. The split makes each table tight, queryable, and auditable.

It also unblocks the future Policy Watch feature: a scraper looking at a payer's "Specialty Drug Policy" PDF can write directly into `payer_rules_drug` without having to invent placeholder CPT codes.

## Schema details

### `payer_rules_drug`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `payer_name`, `plan_type` | text | Indexed for lookup |
| `bcbs_licensee` | enum nullable | Set only when `payer_name = 'BCBS'`. 15-value enum covers the major licensees. Sprint 5 will populate. |
| `hcpcs_code` | text nullable | J-code (e.g. `J7500`) |
| `ndc_code` | text nullable | 11-digit NDC |
| `drug_name` | text NOT NULL | Always populated |
| `icd10_codes` | text[] | Empty array = applies to any diagnosis |
| `pa_required` | boolean | |
| `documentation_requirements` | jsonb | Same shape as v1 |
| `step_therapy_required` | boolean | |
| `step_therapy_details` | jsonb nullable | Structured: `required_drugs[]`, `duration_days`, `exceptions[]` |
| `appeals_pathway` | jsonb nullable | Structured: `levels[]` with deadlines, methods, forms |
| `lab_requirements` | jsonb nullable | Structured: `tb_test`, `hepatitis_panel`, `cbc`, `liver_function`, `other[]` |
| `submission_method`, `typical_turnaround_days` | nullable | Compat-shim columns; populated as rules are entered |
| `source_url` | text NOT NULL | Required by the rules engine spec |
| `source_document_excerpt` | text nullable | The exact policy snippet — for audit and Policy Watch |
| `last_verified_date`, `last_verified_by` | | |
| `confidence_score` | real 0-1 | <0.8 triggers UI warning |
| `created_at`, `updated_at` | | |
| `deleted_at`, `deleted_by` | nullable | Soft delete |

CHECK constraint: `hcpcs_code IS NOT NULL OR ndc_code IS NOT NULL` — every drug rule must identify the drug somehow.

### `payer_rules_procedure`

Same provenance/lifecycle columns as the drug table. Procedure-specific fields:

| Column | Notes |
|---|---|
| `cpt_code` text NOT NULL | |
| `procedure_name` text NOT NULL | |
| `site_of_service_restrictions` jsonb | Structured: `allowed: ('office'\|'asc'\|'hopd'\|'inpatient')[]` |
| `modifier_requirements` jsonb | Required modifiers and conditional rules |
| `units_or_frequency_limits` jsonb | e.g. "max 1 per 12 months", "max 4 lesions" |
| `appeals_pathway` jsonb | Same shape as drug rules |

### `rule_audit_log`

Immutable insert-only log. Every change to either rule table fires a trigger that writes one row here.

| Column | Notes |
|---|---|
| `drug_rule_id` xor `procedure_rule_id` | Exactly one is set |
| `action` enum | `insert` / `update` / `delete` / `soft_delete` / `restore` |
| `source` enum | `manual` / `bootstrap` / `seed` / `policy_watch` / `api` |
| `actor_user_id` | auth.users.id at the time of change |
| `change_reason` | Free text justification |
| `row_before`, `row_after` | Full jsonb snapshots — historical reconstruction is possible |
| `changed_fields` | text[] — cheap diff for the admin UI |

Immutability is enforced by triggers that block UPDATE and DELETE on this table. Service role can't bypass them. The only legitimate write path is via the audit triggers on the rule tables.

## How audit context flows

The audit trigger on each rule table (`rule_audit_capture`) reads three session GUCs:

```
app.current_user_id  -- auth.uid() of the actor
app.change_reason    -- free text
app.audit_source     -- enum value
```

The app sets these via `set_config(setting, value, true)` (transaction-scoped). Because PostgREST runs every request in a fresh connection, the only safe pattern is: **set GUCs and perform the mutation in the same SQL function**, called via `supabase.rpc()`.

### Example: bootstrap script

```sql
CREATE FUNCTION bootstrap_super_admin(p_user_id uuid, p_reason text)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_user_id', p_user_id::text, true);
  PERFORM set_config('app.change_reason', p_reason, true);
  PERFORM set_config('app.audit_source', 'bootstrap', true);
  -- ... mutation here ...
END;
$$;
```

The Sprint 4 admin dashboard will follow the same pattern with `admin_upsert_drug_rule(p_payload, p_actor_user_id, p_change_reason, ...)` etc. The TypeScript helper `src/lib/audit-context.ts` exports the canonical `AuditContext` type and `toRpcAuditParams()` so callers stay consistent.

## Compatibility view: `payer_rules`

The original `payer_rules` table was renamed to `payer_rules_legacy_v1` (data preserved, frozen). A view named `payer_rules` was created to take its place, so the existing `checkPARequired()` function and its tests keep working until Sprint 6 rewrites them against the typed tables.

### Documented lossiness

This view is **not** a long-term API. It has known limitations:

1. **ICD-10 array → multiple rows**: v2 uses `icd10_codes text[]` but the view exposes a single `icd10_code` column by `unnest()`-ing the array. A v2 rule with three ICD-10 codes appears as three rows in the view. Empty arrays appear as one row with `icd10_code = NULL`.

2. **`step_therapy_details` becomes opaque**: v2 stores structured jsonb. The view stringifies it via `->> 'legacy_text'` (which the migration sets) or `#>> '{}'` fallback. New structured fields like `required_drugs` are not visible to readers of the view.

3. **Procedure rules expose stub step-therapy fields**: To match the v1 column shape, procedure rules show `step_therapy_required = false` and `step_therapy_details = NULL` regardless of their actual contents. Procedures don't really have step therapy in v2, so this is correct in spirit but not introspectable.

4. **Writes are blocked**: INSTEAD OF triggers reject any INSERT/UPDATE/DELETE against `payer_rules` with a clear error directing the writer to use the typed tables. Bulk seed scripts and the admin dashboard must target `payer_rules_drug` or `payer_rules_procedure` directly.

These limitations are tracked in `docs/PROGRESS.md` under Known Issues with severity **Medium — sprint-bounded**, resolution **Sprint 6**.

## RLS model

| Table | SELECT | INSERT/UPDATE/DELETE |
|---|---|---|
| `payer_rules_drug` | any authenticated user (excludes soft-deleted); super_admin sees soft-deleted too | super_admin only |
| `payer_rules_procedure` | same | same |
| `rule_audit_log` | super_admin only | none — triggers handle inserts, updates/deletes blocked at the trigger layer |
| `payer_rules` (view) | granted to `authenticated` role; no anon access | blocked by INSTEAD OF triggers |

## What's NOT in this sprint

- **Fixing the 25 broken seed rules** → Sprint 5. The migration moved them as-is into the new tables with `confidence_score = 0.5` so they show as unverified.
- **Rewriting `checkPARequired`** → Sprint 6. The function still reads the compat view today.
- **Admin dashboard** → Sprint 4 (next branch).
- **Policy Watch** → Sprint 7-8. The `audit_source = 'policy_watch'` enum value and `source_document_excerpt` columns exist now so Policy Watch can land without another migration.

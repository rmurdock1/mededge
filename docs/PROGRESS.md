# MedEdge Build Progress

This file is maintained by Claude Code as a living document. It tracks what was built, what broke, what decisions were made, and what's next. Updated after every significant session.

## Current Sprint

**Sprint 3: Rule Schema Refactor** (in PR review)
- [x] Split `payer_rules` → `payer_rules_drug` + `payer_rules_procedure`
- [x] Add `rule_audit_log` (immutable, super_admin only) + capture triggers
- [x] Add `super_admin` role and `is_internal` practice flag
- [x] Create MedEdge Operations internal practice
- [x] `bootstrap_super_admin` RPC + `grant-super-admin.ts` script
- [x] Compatibility view `payer_rules` so existing `checkPARequired` keeps working
- [x] TypeScript types for v2 schema + audit context helper
- [x] Tests (35 passing)
- [x] `docs/agent/rule-schema.md`

**Sprint 1: Foundation** (Target: Weeks 1-2) — merged in PR #1
- [x] Next.js project setup with App Router
- [ ] Supabase project creation and HIPAA BAA signing
- [x] Database schema: practices, patients, appointments, prior_auths, payer_rules, pa_outcomes, pa_activity_log, user_profiles
- [x] Row-Level Security policies on all tables
- [x] Authentication flow (Supabase Auth)
- [x] Role-based access: practice_admin, staff, billing_manager
- [x] Base layout and navigation components
- [x] Environment variable setup (.env.example)
- [x] CI/CD: GitHub Actions for lint + test on PR

## Overall Status

| Milestone | Status | Target | Notes |
|-----------|--------|--------|-------|
| Project setup | **Done** | Week 1 | Next.js 16, Tailwind 4, TS strict |
| Database + auth | **Done** | Week 2 | 11 migrations, RLS on all tables, login/signup/dashboard |
| PA detection engine | Not started | Week 3-4 | |
| Documentation checklist | Not started | Week 5-6 | |
| ModMed sandbox integration | Not started | Week 5-8 | Waiting on sandbox access |
| PA tracking dashboard | Not started | Week 7-8 | |
| Revenue Radar prototype | Not started | Week 2-3 | Sales tool, can build in parallel |
| Pilot with Toby | Not started | Week 9-12 | |
| Auto-Appeal Engine v1 | Not started | Month 4-5 | After core PA is stable |
| Billing (Stripe) | Not started | Month 6 | Before first paying customer |

---

## Session Log

## Session 2026-04-08

### Goal
Sprint 3 schema refactor: split `payer_rules` into typed drug and procedure tables, add an immutable rule audit log, introduce `super_admin` role and MedEdge Operations internal practice, and ship a compatibility view so the existing `checkPARequired` lookup keeps working until Sprint 6 rewrites it.

### Completed
- 7 new migrations under `supabase/migrations/20260408*`:
  - Part 1: `super_admin` enum value, `is_internal` on practices, new `bcbs_licensee` / `audit_action` / `audit_source` enums
  - Part 2: `payer_rules_drug` and `payer_rules_procedure` tables with full v2 schema, soft-delete columns, indexes, updated_at triggers
  - Part 3: `rule_audit_log` with immutability triggers, shared `rule_audit_capture()` trigger function reading session GUCs, attached to both rule tables
  - Part 4: rename old `payer_rules` to `payer_rules_legacy_v1` (preserved, frozen), best-effort migration of 25 rules into the new tables (J-codes → drug, everything else → procedure) with `confidence_score = 0.5` so they re-trigger the verification warning
  - Part 5: `payer_rules` compatibility VIEW unioning the two new tables with documented lossiness, INSTEAD OF triggers blocking writes
  - Part 6: RLS policies for new tables (auth read, super_admin write), `rule_audit_log` super-admin-only read, MedEdge Operations practice insert (idempotent)
  - Part 7: `bootstrap_super_admin` SECURITY DEFINER RPC, granted to service_role only
- TypeScript types: `PayerRuleDrug`, `PayerRuleProcedure`, `RuleAuditLogEntry`, `BcbsLicensee`, `AuditAction`, `AuditSource`, `StepTherapyDetails`, `AppealsPathway`, `LabRequirements`, `SiteOfServiceRestrictions`, `ModifierRequirements`, `UnitsOrFrequencyLimits`. Old `PayerRule` marked `@deprecated`.
- `src/lib/audit-context.ts`: `AuditContext` type + factory functions (`manualAuditContext`, `seedAuditContext`, `policyWatchAuditContext`) and `toRpcAuditParams()` serializer
- `scripts/grant-super-admin.ts`: idempotent bootstrap script that resolves an email to an auth.users.id and calls `bootstrap_super_admin`
- `docs/agent/rule-schema.md`: full v2 schema documentation including the lossiness contract on the compat view
- 12 new tests across `types.test.ts` and new `audit-context.test.ts`

### Decisions Made
- **Option A compat shim** over a hard cutover. Rationale: rewriting `checkPARequired` against the typed tables is its own sprint and shouldn't be tangled with the schema move. The view + INSTEAD OF triggers contain the lossiness explicitly so no future code accidentally treats the view as a real table.
- **Audit context via session GUCs read by Postgres triggers** rather than application-level audit writes. Rationale: triggers fire on every mutation regardless of code path, so direct SQL edits, RPCs, and bulk imports are all covered. Triggers can't be bypassed by forgetful callers.
- **`rule_audit_log` stays scoped to rules**, not unified with `pa_activity_log`. Different audience (super_admins vs practice staff), different retention, different RLS.
- **No hybrid drug/procedure rules**. A bundled drug-administered-in-office service must be entered as two separate rules. Documented in the table comment and the agent doc.
- **Drug rules use `hcpcs_code OR ndc_code` (CHECK constraint)** rather than a discriminator column. NDC is more precise but most policies cite J-codes; both must work.
- **Confidence 0.5 on migrated rules** rather than preserving original confidence. The migration heuristic could be wrong in either direction; forcing re-verification in Sprint 5 is safer than trusting the rename.

### Tests Added
- `src/lib/types.test.ts`: PayerRuleDrug, PayerRuleProcedure, RuleAuditLogEntry, AuditAction, AuditSource, BcbsLicensee shape tests
- `src/lib/audit-context.test.ts`: factory functions and the RPC serializer

### Files Modified
- `src/lib/types.ts` (extended)
- `src/lib/types.test.ts` (extended)
- `docs/PROGRESS.md` (this file)

### Files Added
- `supabase/migrations/20260408000001_schema_refactor_enums_and_practices.sql`
- `supabase/migrations/20260408000002_schema_refactor_new_rule_tables.sql`
- `supabase/migrations/20260408000003_schema_refactor_audit_log.sql`
- `supabase/migrations/20260408000004_schema_refactor_migrate_data.sql`
- `supabase/migrations/20260408000005_schema_refactor_compat_view.sql`
- `supabase/migrations/20260408000006_schema_refactor_rls_and_seed.sql`
- `supabase/migrations/20260408000007_schema_refactor_audit_helpers.sql`
- `src/lib/audit-context.ts`
- `src/lib/audit-context.test.ts`
- `scripts/grant-super-admin.ts`
- `docs/agent/rule-schema.md`

### Open Questions (need human input)
- [ ] Apply the 7 new migrations to hosted Supabase (paste the combined SQL file in the SQL editor) — defer until after PR review
- [ ] After migration is applied, run `npx tsx scripts/grant-super-admin.ts <your-email>` to claim super_admin

### Next Session Priority
1. After PR #2 merges: cut `feat/admin-dashboard` for Sprint 4
2. Sprint 4 brings the `/admin/*` route group, super_admin middleware, JSON-editor-based rule CRUD
3. Sprint 5: fix the 25 broken seed rules (separate PR per payer)
4. Sprint 6: rewrite `checkPARequired` against typed tables, drop the compat view

### Sprint 5 forward-looking notes (from PR #2 review)
The `payer_rules_drug` CHECK constraint requires `hcpcs_code` or `ndc_code`
to be non-null. The current seed rules use `J7500` as the placeholder HCPCS
for Dupixent but that's wrong — Sprint 5's Dupixent rewrite needs the real
codes:

- **Dupixent (dupilumab)**: `J0517`
- **Humira (adalimumab)**: `J0139`
- **Enbrel (etanercept)**: `J1438`

Sprint 5 PRs should fix drug_name placeholders and HCPCS codes in the same
commit that rewrites the documentation requirements.

---

## Session 2026-04-06

### Goal
Scaffold project and build Sprint 1 foundation: schema, auth, RLS, dashboard layout, CI/CD.

### Completed
- Next.js 16 project scaffolded with App Router, TypeScript strict, Tailwind 4
- Installed deps: Supabase SSR, Anthropic SDK, Zod, Vitest, RTL
- Created 11 Supabase migrations: enums, 8 tables, RLS policies, signup trigger
- Tables: practices, payer_rules, patients, appointments, prior_auths, pa_outcomes, pa_activity_log, user_profiles
- RLS on every table — users can only access their own practice's data
- Auth flow: login page, signup page (creates practice + user profile via DB trigger), auth callback route
- Dashboard layout with role-aware side navigation
- Dashboard page with PA summary stats
- Structured JSON logger (no console.log)
- Supabase client/server/middleware helpers
- CI/CD: GitHub Actions workflow (lint + typecheck + test + build on PR)
- Core TypeScript types matching full data model
- 7 passing tests (types + logger)

### Decisions Made
- Decision: Use `user_profiles` table + SQL helper functions for RLS instead of JWT claims
- Rationale: More flexible than JWT metadata, doesn't require token refresh when roles change
- Decision: Auto-create practice on signup via DB trigger
- Rationale: Simplifies onboarding — first user becomes practice_admin automatically
- Decision: pa_outcomes readable by all authenticated users (cross-practice)
- Rationale: Powers the Payer Intelligence Network with anonymized data

### Tests Added
- `src/lib/types.test.ts`: validates type shape correctness for UserRole, PAStatus, PriorAuthStatus, DocumentationItem
- `src/lib/logger.test.ts`: validates structured JSON output to stdout/stderr

### Files Modified
- All new files (initial project build)

### Open Questions (need human input)
- [ ] Supabase project URL and anon key — need .env.local configured to run migrations
- [ ] HIPAA BAA — needs to be signed on Supabase Pro plan before real PHI

### Next Session Priority
1. Run migrations against Supabase (once .env.local is configured)
2. Payer rules engine: lookup function + seed data for top 5 payers
3. PA detection logic: scan appointments and flag PA requirements
4. Revenue Radar prototype (sales tool)

---

## Architecture Decision Records

Significant technical decisions get documented here with context so future developers (or future Claude sessions) understand WHY something was built a certain way.

### ADR-001: [Template]
- **Date**: YYYY-MM-DD
- **Decision**: What we decided
- **Context**: Why we needed to decide
- **Options considered**: What alternatives existed
- **Rationale**: Why we chose this option
- **Consequences**: What this means for the codebase

---

## Known Issues

| Issue | Severity | Status | Notes |
|-------|----------|--------|-------|
| `payer_rules` view has lossy ICD-10 and step_therapy_details mapping | Medium — sprint-bounded | Accepted, resolved in Sprint 6 when checkPARequired is rewritten | The compat shim unnest()s `icd10_codes text[]` into multiple rows and stringifies structured `step_therapy_details` jsonb. Documented in `docs/agent/rule-schema.md` and the view's SQL comment. New code MUST read the typed tables directly. |
| 25 seed rules need correction (~80% wrong per verification report) | High — flagged | Deferred to Sprint 5 | Migrated as-is into the new tables with `confidence_score = 0.5` so the UI flags every one as unverified. Sprint 5 will correct them per payer. |
| Migrated rules have placeholder `drug_name`/`procedure_name` like `UNKNOWN (J7500)` | Low | Deferred to Sprint 5 | The legacy table never had a name field. Sprint 5 cleanup fills these in alongside the rule corrections. |

---

## Human Expert Recommendations

Track when we've identified a need for human expertise and whether it's been addressed.

| Area | Why | Status | Expert type needed |
|------|-----|--------|-------------------|
| HIPAA compliance review | Before going live with real patient data | Not started | Healthcare compliance consultant |
| BAA template | Legal document for covered entity agreement | Not started | Healthcare attorney |
| Terms of service | Legal protection for SaaS product | Not started | SaaS attorney |
| ModMed API edge cases | Undocumented behavior in sandbox | Not started | ModMed integration specialist |
| Payer rules verification | Cross-check AI-extracted rules | Not started | Medical billing specialist |
| Appeal letter review | Validate AI-generated letters | Not started | Medical billing specialist |
| Security audit | Pre-production penetration test | Not started | Security consultant |

---

## Repo Health

- **Last lint check**: 2026-04-08 (clean)
- **Last build**: 2026-04-08 (clean, Next.js 16.2.2 Turbopack)
- **Test coverage**: 35 tests passing across 5 files
- **Open branches**: `feat/schema-refactor` (PR #2)
- **Merged PRs**: #1 (Sprint 1+2 foundation)
- **Supabase migrations**: 18 files (11 from Sprint 1+2, 7 from Sprint 3 — Sprint 3 batch not yet applied to remote)

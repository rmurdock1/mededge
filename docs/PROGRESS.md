# MedEdge Build Progress

This file is maintained by Claude Code as a living document. It tracks what was built, what broke, what decisions were made, and what's next. Updated after every significant session.

## Current Sprint

**Sprint 1: Foundation** (Target: Weeks 1-2)
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
| (none yet) | | | |

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

- **Last lint check**: 2026-04-06 (clean)
- **Last build**: 2026-04-06 (clean, Next.js 16.2.2 Turbopack)
- **Test coverage**: 7 tests passing (2 test files)
- **Open branches**: main only
- **Dependencies last updated**: 2026-04-06
- **Supabase migrations**: 11 files ready (not yet applied to remote)

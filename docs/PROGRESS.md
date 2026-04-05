# PracticeFlow Build Progress

This file is maintained by Claude Code as a living document. It tracks what was built, what broke, what decisions were made, and what's next. Updated after every significant session.

## Current Sprint

**Sprint 1: Foundation** (Target: Weeks 1-2)
- [ ] Next.js project setup with App Router
- [ ] Supabase project creation and HIPAA BAA signing
- [ ] Database schema: practices, patients, appointments, prior_auths, payer_rules, pa_outcomes
- [ ] Row-Level Security policies on all tables
- [ ] Authentication flow (Supabase Auth)
- [ ] Role-based access: practice_admin, staff, billing_manager
- [ ] Base layout and navigation components
- [ ] Environment variable setup (.env.example)
- [ ] CI/CD: GitHub Actions for lint + test on PR

## Overall Status

| Milestone | Status | Target | Notes |
|-----------|--------|--------|-------|
| Project setup | Not started | Week 1 | |
| Database + auth | Not started | Week 2 | |
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

### Template for each session:

```
## Session YYYY-MM-DD

### Goal
What we set out to do

### Completed
- Item with brief description

### Decisions Made
- Decision: [description]
- Rationale: [why]
- Alternatives considered: [what else we looked at]

### Failures and Mitigations
- Issue: [what went wrong]
- Root cause: [why]
- Fix: [what we did]
- Prevention: [how to avoid next time]

### Tests Added
- [test file]: [what it covers]

### Files Modified
- [file path]: [what changed]

### Open Questions (need human input)
- [ ] Question for RPM
- [ ] Question for Toby
- [ ] Need human expert for [topic]

### Next Session Priority
1. First priority
2. Second priority
3. Third priority
```

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

- **Last lint check**: (not yet run)
- **Test coverage**: (not yet measured)
- **Open branches**: (none)
- **Dependencies last updated**: (not yet)
- **Supabase migrations**: (none yet)

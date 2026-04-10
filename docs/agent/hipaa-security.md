# HIPAA and Security Requirements

## Why This Matters

MedEdge processes Protected Health Information (PHI). HIPAA violations carry fines of $100-$50,000 per violation, up to $1.5M per year per violation category. Beyond fines, a breach destroys trust with medical practices and kills the business. Security is not a feature. It is a prerequisite.

## What Counts as PHI

Any individually identifiable health information, including:
- Patient names, addresses, dates of birth, phone numbers, email
- Social Security numbers, medical record numbers, insurance member IDs
- Diagnosis codes (ICD-10) when linked to a patient identity
- Procedure codes (CPT) when linked to a patient identity
- Insurance plan and payer information when linked to a patient
- Appointment dates and provider names when linked to a patient
- Any clinical notes, lab results, or treatment history

## PHI Handling Rules (Non-Negotiable)

### Storage
- ALL PHI stored in Supabase with encryption at rest (Supabase Pro handles this)
- Row-Level Security on every table containing PHI. No exceptions.
- PHI fields marked with `_encrypted` suffix in column naming for clarity
- Never store PHI in local storage, session storage, cookies, or URL parameters

### Transmission
- All API calls over HTTPS only. Never HTTP.
- TLS 1.2 minimum for all connections
- PHI never appears in URL query parameters (use POST body instead)
- PHI never appears in error messages, stack traces, or log output

### Logging
- Log: user actions, API call status codes, resource types, timestamps, error categories
- Never log: patient names, DOBs, insurance IDs, diagnosis codes, or any PHI
- Use structured logging with explicit PHI-free log schemas
- If in doubt about whether something is PHI, treat it as PHI

### AI/Claude API
- Never send patient names, DOBs, SSNs, or insurance member IDs to the Claude API
- Use anonymized identifiers in prompts: "Patient A", internal reference IDs
- Send diagnosis codes and procedure codes only (these are not individually identifiable without a patient link)
- The appeal letter template has placeholder fields filled AFTER the AI generates the draft
- Anthropic's API does not train on customer data, but minimize PHI exposure regardless

### Code
- Never hardcode credentials, API keys, or tokens
- Never commit PHI to git (even test data should use synthetic records)
- Environment variables for all secrets (.env files git-ignored)
- Code reviews must check for PHI leakage in logs, error messages, and UI

## Business Associate Agreement (BAA)

Before any PHI flows through MedEdge, we need signed BAAs with:

1. **Supabase**: Sign their HIPAA BAA (available on Pro plan). Must be done before creating any tables with PHI.
2. **Vercel**: Check their HIPAA compliance status. If Vercel doesn't offer a BAA, consider alternatives like AWS Amplify or self-hosted Next.js on a HIPAA-eligible hosting provider.
3. **Anthropic**: Confirm their API data handling policies. As of 2025, Anthropic does not train on API inputs, but verify current policy. Consider whether a BAA is needed given we minimize PHI in prompts.
4. **Our customers**: We provide a BAA template for each practice to sign before onboarding.

## SOC 2 Compliance

### What it is
SOC 2 Type II certification demonstrates that your security controls have been operating effectively over a period of time (usually 6-12 months). Many enterprise health systems and PE-backed practices require it.

### When to pursue
- Not needed for MVP or initial pilot
- Start preparation at $100K ARR or when enterprise prospects require it
- Budget: $6,000-20,000 for audit, plus tooling costs

### What to build now to make SOC 2 easier later
- Access control: role-based access, audit logs of who accessed what
- Encryption: at rest and in transit (already required for HIPAA)
- Monitoring: error tracking, uptime monitoring, security alerts
- Change management: git-based deployments, code reviews, conventional commits
- Incident response: documented plan for what to do if a breach occurs

## Security Architecture

```
[User Browser] --HTTPS--> [Vercel Edge] --HTTPS--> [Supabase (PHI encrypted at rest)]
                                |
                                +--> [Claude API (anonymized prompts, no PHI)]
                                |
                                +--> [ModMed API (OAuth2, per-practice credentials)]
```

### Authentication flow
1. User logs in via Supabase Auth (email/password or SSO)
2. JWT includes: user_id, practice_id, role
3. Every Supabase query filtered by RLS using practice_id from JWT
4. No cross-practice data access is possible at the database level

### Access control
- `practice_admin`: full access to practice settings, user management, all PA data
- `billing_manager`: full access to PA data, payer rules, appeals, revenue radar
- `staff`: read/write PA records, run checklists, view dashboard. No settings or user management.

## Pre-Launch Security Checklist

Before going live with real patient data:
- [ ] BAA signed with Supabase
- [ ] BAA signed with hosting provider (or confirmed not needed)
- [ ] BAA template created for customer practices
- [ ] RLS policies on all tables tested with cross-practice access attempts
- [ ] PHI audit: grep codebase for any console.log, console.error, or error messages that could leak PHI
- [ ] HTTPS enforced on all endpoints (no HTTP fallback)
- [ ] Environment variables for all secrets, .env files in .gitignore
- [ ] Security headers set: HSTS, X-Content-Type-Options, X-Frame-Options
- [ ] Rate limiting on API endpoints
- [ ] HIPAA breach insurance purchased ($1,000-3,000/year)
- [ ] Incident response plan documented

## When to Bring in a Human Expert

- **Before pilot**: Hire a HIPAA compliance consultant for a one-time review ($2,000-5,000)
- **Before production**: Have a security professional review the architecture and RLS policies
- **Before SOC 2**: Engage a SOC 2 readiness assessor to identify gaps ($3,000-5,000)
- **After any incident**: Consult a healthcare attorney immediately, even for minor breaches
- **BAA drafting**: Have a healthcare attorney review the BAA template before sending to practices

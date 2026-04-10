# Demo Accounts

Demo accounts for the "Plaza Park Dermatology" practice. Created by `npm run db:seed:demo`.

**WARNING**: These accounts use hardcoded passwords. Never use them in a production environment or with real patient data. Change passwords before any real deployment.

## Practice

| Field | Value |
|-------|-------|
| Name | Plaza Park Dermatology |
| Address | 245 Plaza Park Avenue, Freeport, NY 11520 |
| Specialty | Dermatology |
| ModMed prefix | dermpmsandbox1 |

## User Accounts

| Email | Password | Role | Name | Purpose |
|-------|----------|------|------|---------|
| admin@plazapark.demo | demo-password-change-me | practice_admin | Dr. Patricia Reyes | Practice owner/admin. Can manage settings, users, and ModMed connection. |
| amber@plazapark.demo | demo-password-change-me | billing_manager | Amber Chen | Primary PA workflow user. This is the persona for the walkthrough — the billing manager who processes 30-50 PAs daily. |
| staff@plazapark.demo | demo-password-change-me | staff | Marcus Johnson | Staff member. Same PA visibility as billing_manager but no settings access. |

## Seeded Data

| Entity | Count | Notes |
|--------|-------|-------|
| Patients | 25 | Synthetic names, encrypted via PHI module. Insurance distributed across 5 payers. |
| Appointments | 40 | Spread across next 60 days. CPT codes from existing payer rules. |
| Prior Auths | 25 | 6 draft, 5 ready, 4 submitted, 4 approved, 3 denied, 2 appeal_draft, 1 appeal_approved |
| Activity Log | ~75 entries | Status changes with actor attribution for each PA |
| Sync Logs | 2 | 1 full sync (initial setup), 1 incremental (cron) |
| Policy Watch | 1 document, 5 staged rules | Mix of drug/procedure rules at varying confidence. Rule #1 is a material change to existing UHC Dupixent step therapy. |

## Running the Seed Script

```bash
# Requires these env vars (in .env.local):
# NEXT_PUBLIC_SUPABASE_URL
# SUPABASE_SERVICE_ROLE_KEY
# PHI_ENCRYPTION_KEY

npm run db:seed:demo
```

The script is idempotent — safe to run multiple times. It cleans up existing demo data for the Plaza Park practice before re-inserting.

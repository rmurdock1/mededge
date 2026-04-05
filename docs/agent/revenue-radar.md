# Revenue Opportunity Radar

## What It Is

A data-driven feature that shows practices how much revenue they could unlock by accepting payers they currently avoid. It answers the question: "If PA wasn't a barrier, how much money are you leaving on the table?"

## Why It Matters

Toby (our design partner) said she won't accept UHC patients because PA is too burdensome. She's not alone. Many small practices restrict their payer mix to avoid PA-heavy insurers. Revenue Radar quantifies what that avoidance costs them, then PracticeFlow makes the PA manageable so they can expand.

This feature also doubles as a pre-product sales tool. We can show a prospect their revenue gap before they even sign up.

## Data Sources (all free, public, updated annually)

### CMS Marketplace Public Use Files
- URL: https://www.cms.gov/marketplace/resources/data/public-use-files
- What: Insurer enrollment by county, plan-level selections, demographics
- ZIP code level PUF: enrollment counts by ZIP code
- Issuer level PUF: enrollment by county, broken down by issuer (UHC, Aetna, BCBS, etc.)
- Format: CSV, updated annually after open enrollment

### Census Bureau SAHIE (Small Area Health Insurance Estimates)
- URL: https://www.census.gov/programs-surveys/sahie.html
- What: Insurance coverage estimates for EVERY US county
- Breakdowns: age, sex, income, coverage type (private, Medicare, Medicaid, uninsured)
- Only source for single-year county-level insurance estimates
- Format: CSV/API

### CMS Medicare Enrollment Dashboard
- URL: https://data.cms.gov/tools/medicare-enrollment-dashboard
- What: Medicare beneficiary counts by county and state

### CMS Provider Enrollment Data
- URL: https://data.cms.gov/provider-characteristics/medicare-provider-supplier-enrollment
- What: All Medicare-enrolled providers by specialty, including practice address ZIP code
- Use: Count how many dermatologists (or any specialty) are in a given area

### American Community Survey (Census)
- URL: https://data.census.gov
- What: Population demographics by ZIP/county including age, income, insurance status
- 5-year estimates available at tract and ZIP code level

## How It Works (the math)

Given a practice at ZIP code 11520 (Freeport, NY):

1. Look up county (Nassau County, NY)
2. Pull insurance enrollment data for Nassau County:
   - Estimated UHC marketplace enrollees: ~18,000
   - Estimated Aetna enrollees: ~12,000
   - Medicare beneficiaries: ~45,000
   - Medicaid enrollees: ~28,000
3. Pull dermatology provider count for the area:
   - 42 dermatologists in Nassau County accept UHC
   - Practice does NOT accept UHC
4. Estimate patient opportunity:
   - 18,000 UHC members / 42 accepting dermatologists = ~428 patients per dermatologist
   - If practice captures even 2% of unserved UHC demand = ~8.5 new patients/month
   - At average derm visit revenue of $180 = ~$1,530/month in new revenue
   - Plus biologic prescriptions, procedures, follow-ups = much higher actual value
5. Display: "Estimated revenue opportunity from adding UHC: $1,500-3,000/month"

Note: These are estimates based on public data. The pitch is not "we guarantee this revenue" but "here's the opportunity you're currently missing." The directional signal is what matters, not precision to the dollar.

## Build Plan

### Phase 1: Sales Tool (build BEFORE the product, week 1-2)
- Download CMS ZIP-code and county-level PUFs
- Download SAHIE county estimates
- Download CMS provider enrollment data
- Write Python script to join and normalize into a single lookup table
- Build a simple Next.js page (or even a spreadsheet) that takes a ZIP code and shows:
  - Insurance population breakdown for the area
  - Number of providers in that specialty who accept each payer
  - Estimated revenue opportunity per payer the practice doesn't accept
- Use this in sales conversations with dad's network
- Format: "Here's a free practice revenue report for [Practice Name]"

### Phase 2: Product Feature (month 6+)
- Integrate into the PracticeFlow dashboard
- Cross-reference with the practice's actual payer list from their PM system
- Auto-calculate which payers represent the biggest untapped opportunity
- Show alongside PA data: "You could add UHC and PracticeFlow will handle the PA"
- Update data annually when CMS releases new PUFs

### Phase 3: Growth Engine (month 12+)
- Combine with Payer Intelligence Network data
- Show not just the opportunity but the PA success rate: "Practices on our network get 91% PA approval with UHC for Dupixent"
- Generate a downloadable "Payer Expansion Playbook" per practice
- Use aggregated data for marketing: publish annual reports on payer mix opportunities

## Technical Notes

- All data is public and free. No licensing issues.
- Data is county-level or ZIP-level, not individual-level. No HIPAA concerns.
- CMS PUFs are large CSV files (some 100MB+). Process and load into Supabase, don't query raw files.
- Update annually. Set a calendar reminder for CMS open enrollment data release (typically March-April).
- The provider enrollment data tells us who ACCEPTS a payer. Cross-referencing with the practice's own list tells us who they DON'T accept. The delta is the opportunity.

## Files

Data processing scripts go in: `scripts/data/`
Processed data goes in: `data/cms/`
Feature code goes in: `src/lib/radar/` and `src/app/api/radar/`

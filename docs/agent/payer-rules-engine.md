# Payer Rules Engine

## What It Is

The payer rules engine is the core lookup system that answers: "Does this patient's insurance require prior authorization for this procedure?" It is a database lookup, NOT an AI call. Speed and accuracy matter here. When a new appointment is detected, this engine runs instantly.

## How It Works

1. An appointment is detected (via ModMed sync) with: patient insurance (payer + plan type) and procedure codes (CPT)
2. The engine queries the `payer_rules` table: given this payer, this plan type, and this CPT code, is PA required?
3. If PA is required, it returns: what documentation is needed, submission method, typical turnaround time, and any step therapy requirements
4. A `prior_auth` record is created with a documentation checklist

## Data Model

```
payer_rules
  - payer_name: "UnitedHealthcare", "Aetna", "BCBS", etc.
  - plan_type: "Commercial", "Medicare Advantage", "Medicaid", "Exchange"
  - cpt_code: "96372" (injection), "J7500" (biologic), etc.
  - icd10_code: nullable, some PA rules are diagnosis-specific
  - pa_required: boolean
  - documentation_requirements: JSON array of required docs
  - submission_method: "portal" | "fax" | "phone" | "electronic"
  - typical_turnaround_days: integer
  - step_therapy_required: boolean
  - step_therapy_details: text description of required prior treatments
  - last_verified_date: when this rule was last confirmed accurate
  - source_url: link to payer coverage policy
  - confidence_score: 0.0 to 1.0 (how confident we are in this rule)
```

## Data Population Strategy

### Phase 1: Manual curation (months 1-3)
Start with Toby's top 5 payers and top 10 procedures. Ask Toby: "What are your most common PA scenarios?"

Expected starting set:
- Payers: UHC, Aetna, BCBS, Cigna, Medicare (top 5 for derm)
- Procedures: Dupixent (J7500), Humira (J0135), Enbrel (J1438), phototherapy (96910-96913), Mohs surgery (17311-17315), patch testing (95044), biologics generally
- This gives ~50-100 initial rules

Sources for manual curation:
- Payer websites (medical policy bulletins, coverage criteria PDFs)
- CoverMyMeds PA requirements database (if accessible)
- Toby's billing team knowledge
- AIM Specialty Health guidelines (manages PA for many payers)

### Phase 2: AI-assisted expansion (months 4-6)
- Use Claude to extract PA requirements from payer coverage policy PDFs
- Human reviews and validates every AI-extracted rule before it enters the database
- Confidence score for AI-extracted rules starts at 0.7, increases to 0.9+ after human verification
- Target: 500+ rules covering top 20 payers and top 50 derm procedures

### Phase 3: Network-informed updates (months 6+)
- PA outcomes from the Payer Intelligence Network feed back into rule accuracy
- If a rule says "PA not required" but practices are consistently finding PA IS required, flag for review
- If a payer changes their coverage policy, outcome patterns will shift before we manually update the rule
- Goal: self-correcting rules database that stays current through real-world usage data

## Lookup Logic

```typescript
async function checkPARequired(
  payerName: string,
  planType: string,
  cptCodes: string[],
  icd10Codes?: string[]
): Promise<PARequirement[]> {
  // Query payer_rules for each CPT code
  // Match on: payer_name, plan_type, cpt_code
  // If icd10_code is specified in the rule, also match on diagnosis
  // Return all matching rules with documentation requirements
  // If no rule found, return { pa_required: "unknown", confidence: 0 }
}
```

### Handling "unknown"
When no rule exists for a payer/procedure combination:
- Display to staff: "PA requirement unknown for [payer] + [procedure]. Check payer portal or call."
- Log the lookup miss so we know which rules to add next
- Over time, reduce unknowns by expanding the rules database

## Documentation Checklist Format

Each payer rule includes a `documentation_requirements` JSON array:

```json
[
  {
    "item": "Clinical notes documenting diagnosis",
    "required": true,
    "description": "Recent office visit note with ICD-10 diagnosis"
  },
  {
    "item": "BSA (body surface area) assessment",
    "required": true,
    "description": "Documented percentage of body affected"
  },
  {
    "item": "Prior treatment history",
    "required": true,
    "description": "List of treatments tried and failed (step therapy)"
  },
  {
    "item": "Lab results",
    "required": false,
    "description": "TB test results if starting biologic"
  }
]
```

This checklist is presented to staff in the UI. They check off items as they gather documentation. Incomplete checklists show warnings before submission.

## Code Structure

```
src/lib/payer-rules/
  lookup.ts          # Core PA requirement lookup function
  types.ts           # PARequirement, DocumentationItem types
  checklist.ts       # Checklist generation and completion tracking
  seed.ts            # Initial data seeding script

data/payer-rules/
  uhc-commercial.json
  aetna-commercial.json
  bcbs-commercial.json
  cigna-commercial.json
  medicare.json
```

## Critical Rules

- The payer rules engine is deterministic. Given the same inputs, it must return the same output. No randomness, no AI inference.
- Every rule must have a `source_url` linking to the payer's published coverage policy. No unsourced rules.
- Every rule must have a `last_verified_date`. Rules older than 12 months get flagged for re-verification.
- Confidence score below 0.8 should display a warning: "This rule has not been fully verified."
- When in doubt, default to "PA may be required, check with payer." False negatives (saying PA is not required when it is) are worse than false positives.

## When to Bring in a Human Expert

- Have Toby's billing manager (or a medical billing specialist) validate the first 50 rules
- For payers with complex PA policies (UHC is notoriously complicated), consult someone who works with that payer daily
- When expanding to new specialties, bring in a billing specialist from that specialty

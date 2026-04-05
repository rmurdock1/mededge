# Auto-Appeal Engine

## What It Is

When a prior authorization is denied, PracticeFlow auto-generates a tailored appeal letter using AI, attaches the relevant clinical documentation, and prepares it for staff to review and submit. Over time, it learns which appeal strategies work best per payer.

## Why It Matters

- 80%+ of PA denials are overturned on appeal (Health Affairs, 2026)
- Fewer than 12% of denials are ever appealed (CEPR, 2025)
- 55% of physicians say they lack resources to file appeals (AMA, 2024)
- Each successful appeal recovers $200-2,000+ depending on the service

The gap between "appeals work" and "nobody has time to appeal" is the exact problem AI solves. This feature is literally a money printer for practices.

## How It Works

### Step 1: Denial detection
- PA status changes to "denied" in the tracking system
- Staff can also manually flag a denial
- System captures: denial reason code, denial explanation text, payer name, procedure/medication, patient reference

### Step 2: Denial analysis
- Match denial reason to known categories:
  - Missing documentation (most common, easiest to overturn)
  - Medical necessity not established
  - Step therapy not completed
  - Service not covered under plan
  - Coding error (wrong CPT or ICD-10)
  - Timely filing issue
- Cross-reference with Payer Intelligence Network data: "How often does this payer deny this procedure for this reason? What documentation pattern gets approvals?"

### Step 3: Appeal letter generation
- Claude API generates a letter that includes:
  - Patient reference (no PHI in the prompt if possible, use anonymized IDs)
  - The specific denial reason quoted back
  - Clinical justification addressing the denial reason directly
  - Citations to payer's own coverage policy
  - AMA position statements on medical necessity where applicable
  - List of attached supporting documentation
- The letter follows payer-specific formatting requirements

### Step 4: Human review
- Staff sees the draft appeal letter in PracticeFlow
- Staff can edit, approve, or reject
- Once approved, system marks the appeal as ready to submit
- Staff submits through the payer's required channel (initially manual, later automated)

### Step 5: Outcome tracking
- Staff marks appeal as: approved, denied, or pending
- If approved: calculate revenue recovered and display in dashboard
- If denied: flag for secondary appeal or escalation to human expert
- All outcomes feed back into the Payer Intelligence Network

## AI Prompt Engineering

### IMPORTANT: PHI handling in prompts
- Never send patient names, DOB, SSN, or insurance member IDs to the Claude API
- Use anonymized identifiers: "Patient A" or internal reference numbers
- Send: diagnosis codes, procedure codes, denial reason, treatment history summary
- The letter template has placeholder fields that get filled AFTER generation

### Prompt structure (simplified)
```
You are a medical billing specialist drafting a prior authorization appeal letter.

Context:
- Payer: [payer name]
- Procedure: [CPT code and description]
- Diagnosis: [ICD-10 code and description]
- Denial reason: [exact denial text from payer]
- Patient treatment history: [anonymized summary]
- Payer coverage policy excerpt: [relevant section]

Generate a formal appeal letter that:
1. References the specific denial reason
2. Provides clinical justification for medical necessity
3. Addresses any step therapy requirements with documented prior treatments
4. Cites the payer's own coverage criteria showing the patient qualifies
5. Requests expedited review if clinically appropriate

Tone: Professional, factual, firm but not adversarial.
Length: 1-2 pages.
Format: Standard business letter format.
```

### Specialization by denial type
Create separate prompt templates for each denial category:
- Missing documentation: focus on attaching what was missing
- Medical necessity: focus on clinical evidence and severity
- Step therapy: focus on documenting prior treatment failures
- Not covered: focus on coverage policy interpretation and exceptions

## Build Phases

### Phase 1 (MVP, month 5-6)
- Manual denial entry (staff marks PA as denied, enters reason)
- AI generates appeal letter draft
- Staff reviews, edits, approves
- Track appeal outcome manually
- Display revenue recovered in dashboard

### Phase 2 (month 9-12)
- Template library: pre-built appeal templates per denial type per payer
- Auto-detect denial reasons from structured denial data
- Appeal success rate tracking per payer per denial type
- Suggest strongest appeal strategy based on historical data

### Phase 3 (month 12+)
- Auto-submit appeals electronically where payer portals allow
- Secondary appeal generation for first-appeal denials
- Predictive: flag PAs likely to be denied before submission, suggest preemptive documentation
- Aggregate appeal success data across network for Payer Intelligence

## Metrics to Track

- Appeals generated per month
- Appeals approved vs denied
- Revenue recovered per month (the hero metric)
- Average time from denial to appeal submission
- First-pass appeal success rate by payer
- Documentation patterns correlated with appeal success

## Files

Appeal prompt templates: `src/lib/claude/prompts/appeals/`
Appeal generation logic: `src/lib/appeals/`
Appeal UI components: `src/components/appeals/`
API routes: `src/app/api/appeals/`

## When to Bring in a Human Expert

- Have a medical billing specialist review the first 10-20 generated appeal letters for accuracy and tone
- Consult a healthcare attorney on whether auto-generated appeal letters create any liability
- Get feedback from Toby's billing manager (Amber) on whether the letters match what she would write manually

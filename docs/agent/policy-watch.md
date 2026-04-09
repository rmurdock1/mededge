# Policy Watch

## What It Is

Policy Watch lets super_admins feed payer coverage policy documents into MedEdge. Claude AI extracts structured PA rules from the document, stages them for human review, and upon approval writes them to the production rule tables (`payer_rules_drug`, `payer_rules_procedure`).

## Why It Matters

The payer-rules-engine doc lays out a three-phase data population strategy. Phase 2 (months 4-6) says: "Use Claude to extract PA requirements from payer coverage policy PDFs. Human reviews and validates every AI-extracted rule before it enters the database." Policy Watch is that implementation.

## How It Works

### Flow

```
1. Admin pastes policy text + URL + optional payer/plan hints
2. System creates a policy_watch_documents row (status: pending_extraction)
3. System calls Claude with the extraction prompt
4. Claude returns structured JSON with drug_rules[] and procedure_rules[]
5. Response is validated with Zod — valid rules staged, invalid skipped
6. Staged rules appear in the review queue (status: pending_review)
7. Admin reviews each rule: approve, reject, or edit & approve
8. Approved rules are written to production via admin RPCs (audit_source = 'policy_watch')
9. When all rules reviewed, document status → completed
```

### Key Design Decisions

- **Paste-first, PDF fetch later.** Coverage policies are public documents. Adding PDF parsing adds complexity for marginal MVP value.
- **Two-pass Zod validation.** Top-level schema uses `z.unknown()` arrays so one bad rule doesn't fail the entire extraction. Individual rules validated with strict schemas.
- **confidence_score = 0.7 for all AI-extracted rules.** Matches the seed rules baseline. Admin can bump after verification.
- **extraction_confidence (high/medium/low)** is Claude's self-assessment, stored separately from the production confidence_score.
- **JSON editor for review.** Complex JSONB fields make a structured form impractical. The JSON textarea with format button matches the existing admin form pattern.

## Database Schema

### `policy_watch_documents`

Tracks ingested documents and extraction state.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `source_url` | text | URL of the policy document |
| `source_text` | text | Full text content sent to Claude |
| `payer_name_hint` | text nullable | Admin's hint for the payer name |
| `plan_type_hint` | text nullable | Admin's hint for the plan type |
| `status` | enum | pending_extraction → extracting → extracted → completed |
| `extraction_error` | text nullable | Error message if extraction failed |
| `claude_model` | text nullable | e.g. claude-sonnet-4-20250514 |
| `claude_input_tokens` | int nullable | For cost tracking |
| `claude_output_tokens` | int nullable | |
| `raw_extraction_json` | jsonb nullable | Full Claude response for debugging |
| `uploaded_by` | uuid FK | auth.users reference |

### `policy_watch_staged_rules`

Review queue of extracted rules.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `document_id` | uuid FK | References policy_watch_documents |
| `rule_kind` | enum | 'drug' or 'procedure' |
| `extracted_data` | jsonb | The rule data (matches form schemas minus system fields) |
| `source_excerpt` | text nullable | Exact policy text Claude cited |
| `extraction_confidence` | text | 'high', 'medium', or 'low' |
| `status` | enum | pending_review → approved or rejected |
| `reviewed_by` | uuid FK nullable | Who reviewed |
| `review_notes` | text nullable | Why approved/rejected |
| `production_drug_rule_id` | uuid FK nullable | Set when approved (drug rules) |
| `production_procedure_rule_id` | uuid FK nullable | Set when approved (procedure rules) |

### RLS

Both tables: super_admin read/write only.

## Code Structure

```
src/lib/claude/
  client.ts                    # Anthropic SDK singleton
  schemas.ts                   # Zod schemas for extraction response
  schemas.test.ts
  prompts/
    extract-rules.ts           # The extraction prompt template
    extract-rules.test.ts

src/lib/policy-watch/
  extraction.ts                # parseExtractionResponse() — pure validation
  extraction.test.ts
  actions.ts                   # Server actions: ingest, extract, review, retry

src/components/admin/policy-watch/
  document-status-badge.tsx
  extraction-confidence-badge.tsx
  staged-rule-actions.tsx
  staged-rule-review-form.tsx

src/app/(admin)/admin/policy-watch/
  page.tsx                     # Document list
  ingest/page.tsx              # Ingestion form
  [documentId]/page.tsx        # Document detail + review queue
  [documentId]/review/[stagedRuleId]/page.tsx  # Individual rule edit + approve
```

## Claude Prompt Design

The prompt uses a system message establishing the analyst role, plus a user message containing:
- The document text in `<document>` tags
- The source URL
- Optional admin hints in `<admin_hints>` tags
- Strict JSON schema for the expected output
- 13 extraction guidelines covering code types, plan types, BCBS handling, etc.

Model: `claude-sonnet-4-20250514`, temperature: 0, max_tokens: 8192.

## Audit Trail

When an approved staged rule is written to production:
- `audit_source` = `'policy_watch'` (not `'manual'`)
- `change_reason` = `"Policy Watch extraction from <url>, approved by admin"`
- `source_document_excerpt` = the excerpt Claude cited
- `confidence_score` = 0.7

This is fully traceable in the audit log browser.

## Future Enhancements (Sprint 8+)

- PDF URL fetch — download and extract text from payer policy PDFs
- Bulk approve/reject — for high-confidence rule batches
- Duplicate detection — check if an extracted rule already exists in production
- Scheduled re-extraction — when a policy URL is known to update quarterly
- Policy Watch dashboard stats on the admin overview page

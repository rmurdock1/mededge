# PracticeFlow

Prior authorization automation for specialty medical practices, starting with dermatology. Connects to practice management systems (not EHR), flags PA requirements, assembles documentation with AI, tracks authorizations, and auto-generates appeal letters for denials. North star: acquisition exit within 3-5 years.

## Tech Stack

- **Frontend**: Next.js 14+ (App Router) on Vercel
- **Database**: Supabase (PostgreSQL) with Row-Level Security. Pro plan required for HIPAA BAA.
- **Auth**: Supabase Auth with role-based access (practice_admin, staff, billing_manager)
- **AI**: Anthropic Claude API (claude-sonnet-4-20250514) for document assembly and appeal generation
- **PM Integration**: ModMed Proprietary FHIR API (OAuth2, practice-specific credentials)
- **Styling**: Tailwind CSS. No component libraries.

## Commands

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest
npm run db:migrate   # Run Supabase migrations
npm run db:seed      # Seed payer rules data
```

## Project Structure

```
src/
  app/              # Next.js App Router pages
  components/       # React components (organized by feature)
  lib/              # Shared utilities, API clients, types
    supabase/       # Supabase client, auth helpers, RLS policies
    modmed/         # ModMed API client and data mapping
    claude/         # Anthropic API prompts and document assembly
    payer-rules/    # Payer rules engine and lookup logic
  hooks/            # Custom React hooks
docs/
  agent/            # Instructions for Claude Code agents (read before acting)
  payer-research/   # Payer PA requirement research files
  decisions/        # Architecture Decision Records
data/
  payer-rules/      # Structured JSON payer rule files
  cms/              # CMS/Census public data for Revenue Radar
```

## Agent Documentation (read before relevant tasks)

IMPORTANT: Before starting any task, check if a relevant doc exists below. Read it first.

- Architecture and data model: @docs/agent/architecture.md
- Payer rules engine: @docs/agent/payer-rules-engine.md
- ModMed API integration: @docs/agent/modmed-integration.md
- HIPAA and security requirements: @docs/agent/hipaa-security.md
- Testing strategy: @docs/agent/testing.md
- Revenue Opportunity Radar: @docs/agent/revenue-radar.md
- Auto-appeal engine: @docs/agent/auto-appeal.md
- Policy Watch (AI rule extraction): @docs/agent/policy-watch.md
- Rule schema (v2): @docs/agent/rule-schema.md

## Code Conventions

- TypeScript strict mode. No `any` types except in third-party type shims.
- Use `async/await`, never `.then()` chains.
- All database queries through Supabase client with RLS. Never bypass RLS.
- All API routes validate input with Zod schemas.
- Components: functional only, named exports, co-located test files.
- File naming: `kebab-case.ts` for files, `PascalCase` for components.
- No `console.log` in production code. Use structured logger from `lib/logger.ts`.
- Commits: conventional commits format (feat:, fix:, docs:, refactor:, test:).
- Never commit secrets, API keys, or PHI. Check `.env.example` for required vars.

## Critical Rules

YOU MUST follow these without exception:

1. **HIPAA**: Never log, store in plain text, or expose PHI (patient names, DOB, insurance IDs, diagnosis codes) outside encrypted Supabase tables with RLS. Never include PHI in error messages, console output, or git commits.
2. **No destructive operations without confirmation**: Never drop tables, delete migration files, or remove data seeds without explicit approval.
3. **Test before commit**: Every new function or component must have a corresponding test. Run `npm run test` and `npm run lint` before any commit.
4. **Branch discipline**: Never commit directly to `main`. Create feature branches: `feat/pa-detection`, `fix/checklist-render`, etc.
5. **When uncertain, ask**: If a task is ambiguous, involves security, touches the ModMed integration, or could affect patient data, stop and ask for clarification rather than guessing.

## Memory and Progress Tracking

Maintain `docs/PROGRESS.md` as a living document. Update it after every significant session:

```markdown
## Session [date]
### Completed
- What was built or fixed

### Decisions Made
- Why we chose X over Y

### Failures and Mitigations
- What went wrong and how it was resolved

### Open Questions
- Items needing human input

### Next Steps
- Prioritized list of what to build next
```

## When to Suggest Human Experts

Flag these situations and recommend bringing in a specialist:

- **HIPAA compliance review**: Before going live with real patient data
- **ModMed API edge cases**: If sandbox behavior is unclear or undocumented
- **Legal**: Terms of service, BAA template, privacy policy drafting
- **Security audit**: Before production launch, recommend a penetration test
- **Payer rules verification**: Cross-check AI-extracted rules with a billing specialist
- **UI/UX**: If a workflow feels clunky after 2 iterations, suggest a UX review

## Compaction Rules

When compacting, always preserve:
- The full list of modified files in the current session
- Any failing test names and error messages
- The current sprint goal and what remains
- Any open questions awaiting human input

# Testing Strategy

## Philosophy

Every new function, component, and API route gets a test. We're building healthcare software where a bug could mean a missed PA deadline, a lost appeal, or a HIPAA violation. Tests are not optional. They are the safety net that lets us ship fast without breaking things.

## Test Stack

- **Unit tests**: Vitest (fast, ESM-native, works with Next.js)
- **Component tests**: React Testing Library via Vitest
- **API route tests**: Vitest with mock Supabase client
- **E2E tests**: Playwright (add after MVP, before production launch)
- **Type checking**: TypeScript strict mode (catches a class of bugs before tests even run)

## Test File Convention

Co-locate tests with source files:

```
src/lib/payer-rules/
  lookup.ts
  lookup.test.ts
src/components/pa-tracker/
  checklist-card.tsx
  checklist-card.test.tsx
src/app/api/prior-auths/
  route.ts
  route.test.ts
```

## What to Test

### Always test
- Payer rules lookup logic (core business logic, must be deterministic)
- RLS policy enforcement (cross-practice access must fail)
- API input validation (Zod schemas reject bad input)
- Authentication guards (unauthenticated requests get 401)
- Role-based access (staff can't access admin endpoints)
- ModMed data mapping (FHIR resources map correctly to our models)
- Appeal letter generation (Claude API returns usable output, handles errors)
- Checklist completion logic (incomplete checklists prevent submission)
- Revenue Radar calculations (math is correct given sample data)

### Test with care
- UI rendering (test behavior, not implementation details)
- Form submissions (test the flow, not individual input changes)
- Dashboard data display (test data transformation, mock the fetch)

### Don't test
- Third-party library internals (Supabase client, Next.js router)
- Static UI elements that don't contain logic
- CSS styling

## Test Data

### Synthetic patient data
Create a set of realistic but fake patient records for testing. Never use real patient data, even in development.

```typescript
// test/fixtures/patients.ts
export const testPatients = [
  {
    id: "test-patient-001",
    name_encrypted: "encrypt(Jane Doe)",
    insurance_payer: "UnitedHealthcare",
    plan_type: "Commercial",
    plan_id: "UHC-PPO-5000"
  },
  {
    id: "test-patient-002",
    name_encrypted: "encrypt(John Smith)",
    insurance_payer: "Aetna",
    plan_type: "Medicare Advantage",
    plan_id: "AETNA-MA-HMO"
  }
];
```

### Synthetic payer rules
```typescript
// test/fixtures/payer-rules.ts
export const testPayerRules = [
  {
    payer_name: "UnitedHealthcare",
    plan_type: "Commercial",
    cpt_code: "J7500",
    pa_required: true,
    documentation_requirements: [
      { item: "BSA assessment", required: true },
      { item: "Prior treatment history", required: true }
    ]
  }
];
```

## Testing Patterns

### Unit test pattern (payer rules)
```typescript
import { describe, it, expect } from 'vitest';
import { checkPARequired } from './lookup';

describe('checkPARequired', () => {
  it('returns PA required for UHC + Dupixent', async () => {
    const result = await checkPARequired('UnitedHealthcare', 'Commercial', ['J7500']);
    expect(result[0].pa_required).toBe(true);
    expect(result[0].documentation_requirements.length).toBeGreaterThan(0);
  });

  it('returns unknown when no rule exists', async () => {
    const result = await checkPARequired('UnknownPayer', 'Commercial', ['99999']);
    expect(result[0].pa_required).toBe('unknown');
    expect(result[0].confidence).toBe(0);
  });

  it('matches diagnosis-specific rules when ICD-10 provided', async () => {
    const result = await checkPARequired('Aetna', 'Commercial', ['J7500'], ['L20.9']);
    expect(result[0].pa_required).toBe(true);
  });
});
```

### RLS test pattern (security critical)
```typescript
describe('Row-Level Security', () => {
  it('prevents cross-practice data access', async () => {
    // Authenticate as user from Practice A
    const clientA = createTestClient({ practice_id: 'practice-a' });
    
    // Try to read data from Practice B
    const { data, error } = await clientA
      .from('prior_auths')
      .select('*')
      .eq('practice_id', 'practice-b');
    
    // Should return empty, not an error (RLS silently filters)
    expect(data).toHaveLength(0);
  });
});
```

### API route test pattern
```typescript
describe('POST /api/prior-auths', () => {
  it('rejects unauthenticated requests', async () => {
    const response = await POST('/api/prior-auths', { body: validPAData });
    expect(response.status).toBe(401);
  });

  it('validates input with Zod schema', async () => {
    const response = await POST('/api/prior-auths', {
      body: { invalid: 'data' },
      auth: testUser
    });
    expect(response.status).toBe(400);
  });

  it('creates a PA record for valid input', async () => {
    const response = await POST('/api/prior-auths', {
      body: validPAData,
      auth: testUser
    });
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('draft');
  });
});
```

## CI/CD Integration

### GitHub Actions workflow
```yaml
name: Test
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run lint
      - run: npm run test
      - run: npx tsc --noEmit
```

Every pull request must pass lint, tests, and type checking before merge. No exceptions.

## Coverage Goals

- Sprint 1-2: 60% coverage (focus on core business logic)
- Sprint 3-4: 70% coverage (add API route and integration tests)
- Pre-production: 80% coverage (add security and edge case tests)
- No target above 80%. Chasing 100% coverage wastes time on low-value tests.

## Pre-Production Test Additions

Before going live with real patient data, add:
- [ ] E2E test: full PA workflow from appointment detection to approval tracking
- [ ] Security test: attempt SQL injection via API inputs
- [ ] Load test: simulate 10 concurrent practices syncing data
- [ ] HIPAA audit test: grep all log output for PHI patterns (names, DOBs, SSNs)
- [ ] Token expiration test: verify ModMed OAuth refresh works correctly
- [ ] Cross-practice isolation test: comprehensive RLS verification

## When to Bring in a Human Expert

- If test coverage drops below 60% and the team can't identify what to test, bring in a senior developer for a half-day test audit
- Before production launch, have a security professional run a penetration test
- If flaky tests become a pattern (tests that sometimes pass, sometimes fail), investigate root causes before adding more tests

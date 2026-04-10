# ModMed API Integration

## Overview

MedEdge connects to ModMed's Proprietary FHIR API (not the Certified FHIR API). The Proprietary API provides access to Patient, Appointment, Insurance, and other PM-side resources. We connect to MMPM (Practice Management), not EMA (EHR).

## Getting Access

1. Apply for sandbox at: https://portal.api.modmed.com
2. Sandbox takes up to 2 weeks to provision
3. You receive: Username, Password, API Key via encrypted email
4. Generic sandbox uses firm prefix: `dermpmsandbox1`
5. Production key granted only after: proof of concept demo against sandbox AND technical discussion with ModMed team

## Authentication

ModMed uses OAuth2 Password Grant flow.

### Endpoints
- Sandbox: `https://stage.ema-api.com/ema-dev/firm/{firm_url_prefix}/ema/ws/oauth2/grant`
- Practice sandbox: `https://stage.ema-api.com/ema-training/firm/{firm_url_prefix}/ema/ws/oauth2/grant`
- Production: `https://mmapi.ema-api.com/ema-prod/firm/{firm_url_prefix}/ema/ws/oauth2/grant`

### Token request
```bash
curl --location '{auth_endpoint}' \
  --header 'x-api-key: {your_api_key}' \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'grant_type=password' \
  --data-urlencode 'username={username}' \
  --data-urlencode 'password={password}'
```

Returns: `access_token` and `refresh_token` (both JWTs).

### Using the token
Include in all API calls:
- Header: `Authorization: Bearer {access_token}`
- Header: `x-api-key: {api_key}`

### Token refresh
Access tokens expire. Use the refresh token to get a new access token without re-authenticating.

## FHIR Resources We Need

### Patient
- Endpoint: `{base}/ema/fhir/v2/Patient`
- Data: demographics, insurance information
- Use: identify patient insurance and plan for PA requirement lookup

### Appointment
- Endpoint: `{base}/ema/fhir/v2/Appointment`
- Data: scheduled appointments with provider, date, CPT codes
- Use: scan upcoming appointments and flag PA requirements

### Coverage (Insurance)
- Endpoint: `{base}/ema/fhir/v2/Coverage`
- Data: patient insurance plan details
- Use: determine which payer and plan type for PA rule matching

### Practitioner
- Endpoint: `{base}/ema/fhir/v2/Practitioner`
- Data: provider details
- Use: multi-provider practice support

### ValueSet
- Endpoint: `{base}/ema/fhir/v2/ValueSet`
- Data: practice-specific configurations (appointment types, etc.)
- Use: map practice-specific codes to standard procedure types

## Data Sync Strategy

### Initial sync
When a practice onboards, do a full sync of:
- All active patients (with insurance info)
- All appointments in the next 30 days
- All practitioners

### Ongoing sync
- Poll appointments endpoint every 15-30 minutes for new/changed appointments
- When a new appointment appears, check patient insurance against payer rules
- If PA is required, create a prior_auth record and alert staff

### Sync considerations
- ModMed may rate-limit API calls. Start conservative (1 call/second), adjust based on sandbox testing.
- Each practice has a unique `firm_url_prefix`. Store this encrypted per practice.
- Cache patient insurance data locally (encrypted in Supabase). Don't re-fetch for every PA check.
- Handle pagination: FHIR search results may be paginated with `Bundle.link` entries.

## Multi-Practice Architecture

Each practice has its own:
- `firm_url_prefix` (practice identifier in ModMed)
- OAuth credentials (username, password, API key)
- All stored encrypted in the `practices` table

The same MedEdge application instance can serve multiple practices, authenticating to each practice's ModMed instance separately.

## Path to Production

1. Build complete integration against generic sandbox
2. Test with Toby's practice-specific sandbox (request from ModMed)
3. Demo to ModMed team showing: data reads, PA workflow, security measures
4. Technical review: which FHIR resources you use, call frequency, data handling
5. Receive production key
6. Go live with Toby, then onboard additional practices

## Code Structure

```
src/lib/modmed/
  client.ts          # OAuth2 client, token management, request wrapper
  sync.ts            # Data sync orchestration (full and incremental)
  mappers/
    patient.ts       # Map FHIR Patient to our patient model
    appointment.ts   # Map FHIR Appointment to our appointment model
    coverage.ts      # Map FHIR Coverage to our insurance model
  types.ts           # FHIR resource type definitions
```

## Critical Rules

- NEVER hardcode credentials. Always read from environment variables.
- NEVER log full FHIR responses (they contain PHI). Log only: resource type, count, status codes.
- NEVER store raw FHIR data. Map to our internal models and encrypt PHI fields.
- Store OAuth tokens in memory or encrypted at rest. Never in plain text, local storage, or cookies.
- Handle token expiration gracefully. If a 401 is returned, refresh the token and retry once.

## When to Bring in a Human Expert

- If the sandbox returns unexpected FHIR resource structures not matching documentation
- If ModMed requires specific data handling agreements beyond the standard BAA
- If production key provisioning takes longer than expected (reach out to ModMed partner support)
- For any custom FHIR extensions that aren't documented on the portal

# PHI Encryption

## What It Is

Application-level field encryption for Protected Health Information using AES-256-GCM.
Every PHI field (patient names, DOBs, insurance member IDs linked to a patient) is encrypted
before storage and decrypted after retrieval.

## Why Field-Level (Not Just At-Rest)

1. **Compromised service role key**: Supabase at-rest encryption doesn't help if the service role key leaks. Field-level encryption means a DB dump is useless without the separate encryption key.
2. **Acquisition portability**: If we exit, the encryption module is portable to any backend.
3. **Auditor compliance**: HIPAA/SOC 2 auditors flag the absence of field-level PHI encryption.

## How It Works

```typescript
import { encryptPHI, decryptPHI } from "@/lib/crypto/phi";

// Encrypt before storage
const encrypted = encryptPHI("Jane Doe");  // → base64 string

// Decrypt after retrieval
const plain = decryptPHI(encrypted);        // → "Jane Doe"
```

### Storage Format

`base64( IV[12 bytes] + AuthTag[16 bytes] + Ciphertext[variable] )`

- Algorithm: AES-256-GCM (authenticated encryption — tampering is detectable)
- IV: 12 bytes, randomly generated per encryption (NIST recommended for GCM)
- Auth Tag: 16 bytes (128 bits)
- Same plaintext produces different ciphertext each time (random IV)

### Key Management

- **Env var**: `PHI_ENCRYPTION_KEY` — 64 hex characters (32 bytes)
- **Generate**: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- **MUST be separate** from Supabase keys
- **Sprint 9 compromise**: Env var is acceptable for development and sandbox. Production MUST source from AWS Secrets Manager or Vercel encrypted env vars before Toby goes live.

## Which Fields Are Encrypted

| Table | Column | Contains |
|-------|--------|----------|
| `patients` | `name_encrypted` | Patient full name |

Future fields as we add them: DOB, insurance member ID, SSN, phone, email, address.

## Rules

1. **Never log decrypted PHI.** If you need to log, log the encrypted value or a hash.
2. **Never send decrypted PHI to Claude API.** Use anonymized identifiers.
3. **Encrypt at the mapper layer**, not at the DB layer. Mappers are the boundary.
4. **Column naming convention**: `*_encrypted` suffix for any field containing encrypted PHI.
5. **Test with synthetic data.** The test key is hardcoded in tests. Never use the production key in tests.

## Code

```
src/lib/crypto/
  phi.ts          # encryptPHI(), decryptPHI(), _resetKeyCache()
  phi.test.ts     # 12 tests covering encrypt/decrypt, tamper detection, key validation
```

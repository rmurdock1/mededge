/**
 * Integration test global setup.
 *
 * Creates a test super_admin user via Supabase Admin API, bootstraps
 * super_admin role, and provides authenticated + service-role clients
 * to all test files via module-level exports.
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in
 * .env.local (or environment). Falls back to dotenv-style file read.
 */
import { beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// ---- Load env from .env.local if not already present ----
function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

loadEnvFile();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Integration tests require NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
}

const TEST_EMAIL = "integration-test@mededge-test.local";
const TEST_PASSWORD = "IntTest!Secure2026#";

// Exported for test files to import
export let serviceClient: ReturnType<typeof createClient>;
export let authenticatedClient: ReturnType<typeof createClient>;
export let testUserId: string;

beforeAll(async () => {
  // Service-role client (bypasses RLS, can read audit log)
  serviceClient = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Idempotent: check if test user already exists
  const { data: existingUsers } = await serviceClient.auth.admin.listUsers();
  const existing = existingUsers?.users?.find(
    (u) => u.email === TEST_EMAIL
  );

  if (existing) {
    testUserId = existing.id;
  } else {
    const { data: newUser, error: createErr } =
      await serviceClient.auth.admin.createUser({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        email_confirm: true,
      });
    if (createErr) throw new Error(`Failed to create test user: ${createErr.message}`);
    testUserId = newUser.user.id;
  }

  // Ensure super_admin role via bootstrap RPC (idempotent — service_role can call it)
  const { error: bootstrapErr } = await serviceClient.rpc(
    "bootstrap_super_admin",
    { p_user_id: testUserId, p_reason: "Integration test setup" }
  );
  if (bootstrapErr) {
    throw new Error(`Failed to bootstrap super_admin: ${bootstrapErr.message}`);
  }

  // Sign in as the test user to get an authenticated session
  const anonClient = createClient(SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: signInData, error: signInErr } =
    await anonClient.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
  if (signInErr) throw new Error(`Failed to sign in test user: ${signInErr.message}`);

  // Create an authenticated client using the access token
  authenticatedClient = createClient(SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || SERVICE_ROLE_KEY!, {
    global: {
      headers: {
        Authorization: `Bearer ${signInData.session.access_token}`,
      },
    },
    auth: { autoRefreshToken: false, persistSession: false },
  });
});

afterAll(async () => {
  if (!serviceClient) return;

  // Note: Test-created rules (payer_name='TestPayer', source_url contains
  // 'test.example.com') cannot be hard-deleted because rule_audit_log has
  // immutability triggers and FK references. The audit log is append-only by
  // design. Test artifacts are harmless and identifiable by their TestPayer
  // payer_name. In CI, use a Supabase branch DB that gets discarded after
  // the test run.
});

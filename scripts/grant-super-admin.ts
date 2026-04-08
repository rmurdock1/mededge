import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

/**
 * Promotes an existing auth.users row to super_admin in the MedEdge
 * Operations practice. Idempotent — re-running with the same email is safe.
 *
 * Usage:
 *   npx tsx scripts/grant-super-admin.ts <email> [reason]
 *
 * Example:
 *   npx tsx scripts/grant-super-admin.ts founder@mededge.io "Initial bootstrap"
 *
 * Prerequisites:
 *   1. Schema refactor migrations applied (creates MedEdge Operations practice
 *      and the bootstrap_super_admin RPC)
 *   2. The user has already signed up via the app or been created in the
 *      Supabase admin UI (this script does not create auth users)
 *   3. SUPABASE_SERVICE_ROLE_KEY is set in .env.local
 *
 * The script calls the bootstrap_super_admin RPC which sets audit context
 * inside the same transaction as the user_profiles upsert.
 */

function loadEnv() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return;
  }
  const envPath = path.resolve(__dirname, "../.env.local");
  if (!fs.existsSync(envPath)) return;
  const envFile = fs.readFileSync(envPath, "utf8");
  envFile.split("\n").forEach((line) => {
    const match = line.match(/^([^#=]+)=(.+)$/);
    if (match) {
      process.env[match[1]!.trim()] = match[2]!.trim();
    }
  });
}

async function main() {
  const email = process.argv[2];
  const reason = process.argv[3] ?? "Initial super_admin bootstrap";

  if (!email) {
    console.error("Usage: npx tsx scripts/grant-super-admin.ts <email> [reason]");
    process.exit(1);
  }

  loadEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Step 1: look up the auth user by email via the admin API
  console.log(`Looking up user ${email}...`);
  const { data: usersList, error: listError } = await supabase.auth.admin.listUsers();

  if (listError) {
    console.error("Failed to list users:", listError.message);
    process.exit(1);
  }

  const user = usersList.users.find((u) => u.email === email);
  if (!user) {
    console.error(
      `No auth user found for ${email}. Sign up via the app first, then re-run this script.`
    );
    process.exit(1);
  }

  console.log(`Found user ${user.id}. Promoting to super_admin...`);

  // Step 2: call the bootstrap RPC. Idempotent.
  const { error: rpcError } = await supabase.rpc("bootstrap_super_admin", {
    p_user_id: user.id,
    p_reason: reason,
  });

  if (rpcError) {
    console.error("bootstrap_super_admin failed:", rpcError.message);
    process.exit(1);
  }

  // Step 3: verify the result
  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id, role, practice_id, practices(name, is_internal)")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("Verification query failed:", profileError.message);
    process.exit(1);
  }

  console.log("\nDone. Profile state:");
  console.log(JSON.stringify(profile, null, 2));

  if (profile.role !== "super_admin") {
    console.error(
      `\nWARNING: profile role is ${profile.role}, expected super_admin. Something is wrong.`
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("grant-super-admin failed:", err);
  process.exit(1);
});

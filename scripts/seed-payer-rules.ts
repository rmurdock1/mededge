// TODO: Sprint 6 — rewrite to use typed tables (payer_rules_drug, payer_rules_procedure)
// or remove entirely. The payer_rules compatibility VIEW blocks writes, so this script
// is currently non-functional. The JSON files in data/payer-rules/ have been updated to
// v2 format (Sprint 5) but this script still reads v1 shape.
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

/**
 * Seeds the payer_rules table from JSON files in data/payer-rules/.
 * Run with: npx tsx scripts/seed-payer-rules.ts
 *
 * Uses the service role key to bypass RLS for seeding.
 */
async function seed() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    // Try loading from .env.local
    const envPath = path.resolve(__dirname, "../.env.local");
    if (fs.existsSync(envPath)) {
      const envFile = fs.readFileSync(envPath, "utf8");
      envFile.split("\n").forEach((line) => {
        const match = line.match(/^([^#=]+)=(.+)$/);
        if (match) {
          process.env[match[1]!.trim()] = match[2]!.trim();
        }
      });
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key);

  const dataDir = path.resolve(__dirname, "../data/payer-rules");
  const files = fs.readdirSync(dataDir).filter((f) => f.endsWith(".json"));

  let totalInserted = 0;
  let totalSkipped = 0;

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    const rules = JSON.parse(fs.readFileSync(filePath, "utf8"));

    console.log(`Processing ${file} (${rules.length} rules)...`);

    for (const rule of rules) {
      // Check if rule already exists (same payer + plan + cpt + icd10)
      const { data: existing } = await supabase
        .from("payer_rules")
        .select("id")
        .eq("payer_name", rule.payer_name)
        .eq("plan_type", rule.plan_type)
        .eq("cpt_code", rule.cpt_code)
        .eq("icd10_code", rule.icd10_code ?? "")
        .maybeSingle();

      if (existing) {
        totalSkipped++;
        continue;
      }

      const { error } = await supabase.from("payer_rules").insert(rule);

      if (error) {
        console.error(`  Error inserting rule: ${error.message}`, {
          payer: rule.payer_name,
          cpt: rule.cpt_code,
        });
      } else {
        totalInserted++;
      }
    }
  }

  console.log(`\nDone. Inserted: ${totalInserted}, Skipped (already exist): ${totalSkipped}`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

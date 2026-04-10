/**
 * Demo seed script — creates the "Plaza Park Dermatology Demo" practice
 * with realistic synthetic data for product walkthroughs.
 *
 * ⚠️  WARNING: Demo accounts use hardcoded passwords (demo-password-change-me).
 *    These are for development/demo purposes ONLY. Never use in production.
 *    See docs/demo-accounts.md for details.
 *
 * Usage:
 *   npx tsx scripts/seed-demo.ts
 *   npm run db:seed:demo
 *
 * Idempotent: safe to run multiple times. Keys on email addresses for users
 * and deterministic UUIDs for synthetic data. Cleans up existing demo data
 * before re-inserting.
 *
 * Destructive-safe: never touches MedEdge Operations (internal practice),
 * existing payer rules, or the rule audit log.
 */

import { createClient } from "@supabase/supabase-js";
import * as crypto from "crypto";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PHI_KEY_HEX = process.env.PHI_ENCRYPTION_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment."
  );
  process.exit(1);
}

if (!PHI_KEY_HEX || PHI_KEY_HEX.length !== 64) {
  console.error(
    "Missing or invalid PHI_ENCRYPTION_KEY (must be 64 hex characters)."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// PHI encryption (inline — matches src/lib/crypto/phi.ts)
// ---------------------------------------------------------------------------

const PHI_KEY = Buffer.from(PHI_KEY_HEX, "hex");

function encryptPHI(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", PHI_KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

// ---------------------------------------------------------------------------
// Deterministic UUID generation (namespace + name → reproducible UUID v5)
// ---------------------------------------------------------------------------

const DEMO_NAMESPACE = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

function deterministicUUID(name: string): string {
  const hash = crypto
    .createHash("sha256")
    .update(`${DEMO_NAMESPACE}:${name}`)
    .digest("hex");
  // Format as UUID v4 shape (not a real v4, but valid UUID format)
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    "4" + hash.slice(13, 16),
    "8" + hash.slice(17, 20),
    hash.slice(20, 32),
  ].join("-");
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRACTICE_ID = deterministicUUID("plaza-park-dermatology");
const DEMO_PASSWORD = "demo-password-change-me";

const DEMO_USERS = [
  {
    email: "admin@plazapark.demo",
    full_name: "Dr. Patricia Reyes",
    role: "practice_admin" as const,
  },
  {
    email: "amber@plazapark.demo",
    full_name: "Amber Chen",
    role: "billing_manager" as const,
  },
  {
    email: "staff@plazapark.demo",
    full_name: "Marcus Johnson",
    role: "staff" as const,
  },
];

const PATIENT_NAMES = [
  "Elena Rodriguez", "James Chen", "Priya Patel", "Michael O'Brien",
  "Sarah Kim", "David Washington", "Maria Gonzalez", "Robert Taylor",
  "Jennifer Lee", "Thomas Anderson", "Angela Martinez", "Christopher Brown",
  "Lisa Nakamura", "Daniel Garcia", "Rachel Thompson", "Kevin Williams",
  "Stephanie Flores", "Andrew Murphy", "Michelle Cooper", "Jonathan Davis",
  "Laura Sanchez", "Brian Mitchell", "Diana Foster", "Steven Park",
  "Nicole Hayes",
];

const PAYER_DISTRIBUTION = [
  { payer: "UnitedHealthcare", plan_type: "Commercial", plan_id: "UHC-PPO-5000" },
  { payer: "Aetna", plan_type: "Commercial", plan_id: "AETNA-HMO-3000" },
  { payer: "BCBS", plan_type: "Commercial", plan_id: "BCBS-PPO-4000" },
  { payer: "Cigna", plan_type: "Commercial", plan_id: "CIGNA-EPO-2500" },
  { payer: "Medicare", plan_type: "Medicare", plan_id: "MEDICARE-FFS" },
];

// CPT/HCPCS codes from the existing rule set
const PROCEDURE_CODES = [
  { code: "J0517", name: "Dupixent (dupilumab)", kind: "drug" },
  { code: "J0135", name: "Humira (adalimumab)", kind: "drug" },
  { code: "J1438", name: "Enbrel (etanercept)", kind: "drug" },
  { code: "17311", name: "Mohs surgery, first stage", kind: "procedure" },
  { code: "96910", name: "Phototherapy (UVB)", kind: "procedure" },
  { code: "95044", name: "Patch testing", kind: "procedure" },
];

const ICD10_CODES = [
  "L20.9", // Atopic dermatitis
  "L40.0", // Psoriasis vulgaris
  "L50.0", // Allergic urticaria
  "C44.319", // Basal cell carcinoma, unspecified
  "L57.0", // Actinic keratosis
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0]!;
}

function pastDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

// ---------------------------------------------------------------------------
// Seed functions
// ---------------------------------------------------------------------------

async function seedPractice() {
  console.log("  Creating practice...");

  // Check if practice already exists
  const { data: existing } = await supabase
    .from("practices")
    .select("id")
    .eq("id", PRACTICE_ID)
    .single();

  if (existing) {
    console.log("  Practice already exists, updating...");
    await supabase
      .from("practices")
      .update({
        name: "Plaza Park Dermatology",
        is_internal: false,
        specialty: "dermatology",
        address: "245 Plaza Park Avenue",
        city: "Freeport",
        state: "NY",
        zip: "11520",
        modmed_url_prefix: "dermpmsandbox1",
        modmed_credentials: encryptPHI(
          JSON.stringify({
            username: process.env.MODMED_USERNAME ?? "sandbox_user",
            password: process.env.MODMED_PASSWORD ?? "sandbox_pass",
            apiKey: process.env.MODMED_API_KEY ?? "sandbox_key",
          })
        ),
      })
      .eq("id", PRACTICE_ID);
  } else {
    const { error } = await supabase.from("practices").insert({
      id: PRACTICE_ID,
      name: "Plaza Park Dermatology",
      is_internal: false,
      specialty: "dermatology",
      address: "245 Plaza Park Avenue",
      city: "Freeport",
      state: "NY",
      zip: "11520",
      modmed_url_prefix: "dermpmsandbox1",
      modmed_credentials: encryptPHI(
        JSON.stringify({
          username: process.env.MODMED_USERNAME ?? "sandbox_user",
          password: process.env.MODMED_PASSWORD ?? "sandbox_pass",
          apiKey: process.env.MODMED_API_KEY ?? "sandbox_key",
        })
      ),
      settings: {},
    });
    if (error) throw new Error(`Failed to create practice: ${error.message}`);
  }
}

async function seedUsers() {
  console.log("  Creating users...");

  for (const user of DEMO_USERS) {
    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((u) => u.email === user.email);

    let userId: string;

    if (existing) {
      userId = existing.id;
      console.log(`    ${user.email} already exists (${userId})`);
    } else {
      const { data, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: user.full_name,
          practice_name: "Plaza Park Dermatology",
        },
      });
      if (error) throw new Error(`Failed to create user ${user.email}: ${error.message}`);
      userId = data.user.id;
      console.log(`    Created ${user.email} (${userId})`);
    }

    // Upsert user profile
    await supabase.from("user_profiles").upsert(
      {
        id: userId,
        practice_id: PRACTICE_ID,
        role: user.role,
        full_name: user.full_name,
      },
      { onConflict: "id" }
    );
  }
}

async function seedPatients(): Promise<string[]> {
  console.log("  Creating patients...");

  // Clean existing demo patients
  await supabase.from("patients").delete().eq("practice_id", PRACTICE_ID);

  const patientIds: string[] = [];

  for (let i = 0; i < PATIENT_NAMES.length; i++) {
    const name = PATIENT_NAMES[i]!;
    const payer = PAYER_DISTRIBUTION[i % PAYER_DISTRIBUTION.length]!;
    const patientId = deterministicUUID(`patient-${i}`);
    patientIds.push(patientId);

    await supabase.from("patients").insert({
      id: patientId,
      practice_id: PRACTICE_ID,
      modmed_patient_id: `MODMED-${1000 + i}`,
      name_encrypted: encryptPHI(name),
      insurance_payer: payer.payer,
      plan_id: payer.plan_id,
      plan_type: payer.plan_type,
      last_synced_at: new Date().toISOString(),
    });
  }

  console.log(`    Created ${patientIds.length} patients`);
  return patientIds;
}

async function seedAppointments(patientIds: string[]): Promise<string[]> {
  console.log("  Creating appointments...");

  // Clean existing
  await supabase.from("appointments").delete().eq("practice_id", PRACTICE_ID);

  const appointmentIds: string[] = [];

  for (let i = 0; i < 40; i++) {
    const apptId = deterministicUUID(`appointment-${i}`);
    appointmentIds.push(apptId);

    const patientId = patientIds[i % patientIds.length]!;
    const proc = PROCEDURE_CODES[i % PROCEDURE_CODES.length]!;
    const daysOut = 1 + Math.floor((i / 40) * 60); // Spread across next 60 days

    await supabase.from("appointments").insert({
      id: apptId,
      practice_id: PRACTICE_ID,
      patient_id: patientId,
      modmed_appointment_id: `APPT-${2000 + i}`,
      provider_id: "provider-reyes-001",
      appointment_date: futureDate(daysOut),
      cpt_codes: [proc.code],
      icd10_codes: [pick(ICD10_CODES)],
      pa_status: i < 25 ? "needed" : "not_needed",
    });
  }

  console.log(`    Created ${appointmentIds.length} appointments`);
  return appointmentIds;
}

async function seedPriorAuths(
  patientIds: string[],
  appointmentIds: string[]
) {
  console.log("  Creating prior authorizations...");

  // Clean existing
  await supabase.from("pa_activity_log").delete().match({
    // Delete logs for PAs belonging to this practice
    // We need to delete these first due to FK constraints
  });

  // Delete existing PAs for this practice
  const { data: existingPAs } = await supabase
    .from("prior_auths")
    .select("id")
    .eq("practice_id", PRACTICE_ID);

  if (existingPAs && existingPAs.length > 0) {
    const paIds = existingPAs.map((pa) => pa.id);
    await supabase.from("pa_activity_log").delete().in("prior_auth_id", paIds);
    await supabase.from("prior_auths").delete().eq("practice_id", PRACTICE_ID);
  }

  // Get the billing manager's user ID for created_by
  const { data: amberProfile } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("practice_id", PRACTICE_ID)
    .eq("role", "billing_manager")
    .single();

  const createdBy = amberProfile?.id ?? null;

  // Distribution: 6 draft, 5 ready, 4 submitted, 4 approved, 3 denied, 2 appeal_draft, 1 appeal_approved
  const statusDistribution: Array<{
    status: string;
    count: number;
  }> = [
    { status: "draft", count: 6 },
    { status: "ready", count: 5 },
    { status: "submitted", count: 4 },
    { status: "approved", count: 4 },
    { status: "denied", count: 3 },
    { status: "appeal_draft", count: 2 },
    { status: "appeal_approved", count: 1 },
  ];

  let paIndex = 0;
  const allPAIds: string[] = [];

  for (const { status, count } of statusDistribution) {
    for (let j = 0; j < count; j++) {
      const paId = deterministicUUID(`pa-${paIndex}`);
      allPAIds.push(paId);

      const patientIdx = paIndex % patientIds.length;
      const patientId = patientIds[patientIdx]!;
      const apptId = appointmentIds[paIndex % appointmentIds.length]!;
      const proc = PROCEDURE_CODES[paIndex % PROCEDURE_CODES.length]!;
      const payer = PAYER_DISTRIBUTION[patientIdx % PAYER_DISTRIBUTION.length]!;

      // Build documentation checklist with varying completion
      const checklist = [
        { item: "Clinical notes documenting diagnosis", required: true, description: "Recent office visit note with ICD-10 diagnosis", completed: status !== "draft" },
        { item: "BSA assessment", required: true, description: "Documented percentage of body affected", completed: status !== "draft" && j % 2 === 0 },
        { item: "Prior treatment history", required: true, description: "List of treatments tried and failed", completed: ["ready", "submitted", "approved", "denied", "appeal_draft", "appeal_approved"].includes(status) },
        { item: "Lab results", required: proc.kind === "drug", description: "TB test or relevant labs", completed: ["submitted", "approved", "denied", "appeal_draft", "appeal_approved"].includes(status) },
        { item: "Photographs of affected areas", required: false, description: "Clinical photos showing severity", completed: j % 3 === 0 },
      ];

      const submittedDate =
        ["submitted", "approved", "denied", "appeal_draft", "appeal_approved"].includes(status)
          ? pastDate(10 + j * 3)
          : null;

      const decisionDate =
        ["approved", "denied", "appeal_draft", "appeal_approved"].includes(status)
          ? pastDate(3 + j * 2)
          : null;

      const denialReason =
        status === "denied" || status === "appeal_draft"
          ? pick([
              "Medical necessity not established",
              "Step therapy requirements not met",
              "Missing documentation: BSA assessment required",
            ])
          : status === "appeal_approved"
            ? "Step therapy requirements not met"
            : null;

      await supabase.from("prior_auths").insert({
        id: paId,
        practice_id: PRACTICE_ID,
        appointment_id: apptId,
        patient_id: patientId,
        payer_name: payer.payer,
        procedure_or_medication: `${proc.code} - ${proc.name}`,
        status,
        documentation_checklist: checklist,
        submitted_date: submittedDate,
        decision_date: decisionDate,
        expiration_date:
          status === "approved"
            ? futureDate(90 + j * 30)
            : null,
        denial_reason: denialReason,
        appeal_letter:
          status === "appeal_approved"
            ? "Dear UnitedHealthcare Medical Review Team,\n\nI am writing to formally appeal the denial of prior authorization for Dupixent (dupilumab) for our patient. The denial cited insufficient step therapy documentation. We respectfully disagree with this determination and provide the following evidence...\n\n[Full appeal letter would be generated by AI in Sprint 13]"
            : null,
        notes:
          status === "draft"
            ? "Auto-detected by MedEdge sync. Documentation collection in progress."
            : null,
        created_by: createdBy,
      });

      paIndex++;
    }
  }

  console.log(`    Created ${allPAIds.length} prior authorizations`);

  // Seed activity log entries
  console.log("  Creating activity log entries...");
  let logCount = 0;

  for (let i = 0; i < allPAIds.length; i++) {
    const paId = allPAIds[i]!;
    const statusConfig = statusDistribution.find((s) => {
      const startIdx = statusDistribution
        .slice(0, statusDistribution.indexOf(s))
        .reduce((sum, x) => sum + x.count, 0);
      return i >= startIdx && i < startIdx + s.count;
    })!;

    const actorName =
      i % 3 === 0
        ? "Amber Chen"
        : i % 3 === 1
          ? "Marcus Johnson"
          : "Dr. Patricia Reyes";

    // Always log creation
    await supabase.from("pa_activity_log").insert({
      prior_auth_id: paId,
      action: "PA requirement detected",
      details: `MedEdge detected PA requirement during appointment sync`,
      user_id: createdBy,
      created_at: pastDate(20 + i),
    });
    logCount++;

    // Add status-specific log entries
    if (["ready", "submitted", "approved", "denied", "appeal_draft", "appeal_approved"].includes(statusConfig.status)) {
      await supabase.from("pa_activity_log").insert({
        prior_auth_id: paId,
        action: "Documentation collected",
        details: `${actorName} marked clinical notes as collected`,
        user_id: createdBy,
        created_at: pastDate(15 + i),
      });
      logCount++;
    }

    if (["submitted", "approved", "denied", "appeal_draft", "appeal_approved"].includes(statusConfig.status)) {
      await supabase.from("pa_activity_log").insert({
        prior_auth_id: paId,
        action: "Submitted for authorization",
        details: `${actorName} submitted PA to ${PAYER_DISTRIBUTION[i % PAYER_DISTRIBUTION.length]!.payer}`,
        user_id: createdBy,
        created_at: pastDate(10 + i),
      });
      logCount++;
    }

    if (["approved"].includes(statusConfig.status)) {
      await supabase.from("pa_activity_log").insert({
        prior_auth_id: paId,
        action: "PA approved",
        details: `Authorization approved. Valid for 90 days.`,
        user_id: createdBy,
        created_at: pastDate(3 + i),
      });
      logCount++;
    }

    if (["denied", "appeal_draft", "appeal_approved"].includes(statusConfig.status)) {
      await supabase.from("pa_activity_log").insert({
        prior_auth_id: paId,
        action: "PA denied",
        details: `Authorization denied. Reason: ${pick(["Medical necessity not established", "Step therapy not met"])}`,
        user_id: createdBy,
        created_at: pastDate(5 + i),
      });
      logCount++;
    }

    if (statusConfig.status === "appeal_approved") {
      await supabase.from("pa_activity_log").insert({
        prior_auth_id: paId,
        action: "Appeal approved",
        details: `Appeal approved after review of additional documentation. Revenue recovered.`,
        user_id: createdBy,
        created_at: pastDate(1),
      });
      logCount++;
    }
  }

  console.log(`    Created ${logCount} activity log entries`);
}

async function seedPolicyWatch() {
  console.log("  Creating Policy Watch demo data...");

  // Get admin user ID
  const { data: adminProfile } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("practice_id", PRACTICE_ID)
    .eq("role", "practice_admin")
    .single();

  // Check if we already have a demo user — use the super_admin from MedEdge Ops if no practice admin
  let uploadedBy = adminProfile?.id;
  if (!uploadedBy) {
    const { data: superAdmin } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("role", "super_admin")
      .single();
    uploadedBy = superAdmin?.id;
  }

  if (!uploadedBy) {
    console.log("    Skipping Policy Watch seed — no admin user found");
    return;
  }

  const docId = deterministicUUID("policy-watch-doc-1");

  // Clean existing demo Policy Watch data
  await supabase
    .from("policy_watch_staged_rules")
    .delete()
    .eq("document_id", docId);
  await supabase
    .from("policy_watch_documents")
    .delete()
    .eq("id", docId);

  // Create the document
  await supabase.from("policy_watch_documents").insert({
    id: docId,
    source_url:
      "https://www.uhcprovider.com/content/dam/provider/docs/public/prior-auth/drugs-702-biologics-atopic-dermatitis-2026-update.pdf",
    source_text:
      "UNITEDCARE MEDICAL POLICY UPDATE — Effective July 1, 2026\n\n" +
      "BIOLOGIC THERAPY FOR ATOPIC DERMATITIS\n\n" +
      "This policy update modifies prior authorization requirements for dupilumab (Dupixent) " +
      "and introduces coverage criteria for two new biologics.\n\n" +
      "SECTION 1: DUPILUMAB (DUPIXENT) — MODIFIED CRITERIA\n" +
      "Step therapy requirement CHANGED: Patients must now trial TWO topical therapies " +
      "(previously one) for a minimum of 60 days each before dupilumab authorization. " +
      "Systemic immunosuppressant trial is no longer required for patients with BSA > 20%.\n\n" +
      "SECTION 2: TRALOKINUMAB (ADBRY) — NEW COVERAGE\n" +
      "Prior authorization REQUIRED for tralokinumab. Documentation requirements: " +
      "diagnosis of moderate-to-severe atopic dermatitis, BSA assessment, trial of one topical therapy.\n\n" +
      "SECTION 3: PHOTOTHERAPY (CPT 96910-96913) — UPDATED FREQUENCY LIMITS\n" +
      "Maximum sessions increased from 24 to 36 per calendar year for patients with documented BSA > 10%.\n\n" +
      "SECTION 4: PATCH TESTING (CPT 95044) — NO CHANGE\n" +
      "Prior authorization remains required. No changes to documentation or coverage criteria.\n\n" +
      "SECTION 5: LEBRIKIZUMAB (NEW BIOLOGIC)\n" +
      "Effective July 1, 2026, lebrikizumab is covered under specialty pharmacy benefit. " +
      "PA required. Step therapy: trial of dupilumab required before lebrikizumab approval.",
    payer_name_hint: "UnitedHealthcare",
    plan_type_hint: "Commercial",
    status: "extracted",
    claude_model: "claude-sonnet-4-20250514",
    claude_input_tokens: 2847,
    claude_output_tokens: 1523,
    raw_extraction_json: { note: "Demo extraction — not from a real Claude call" },
    uploaded_by: uploadedBy,
  });

  // Staged rules — 5 rules at varying confidence levels
  const stagedRules = [
    {
      id: deterministicUUID("staged-rule-1"),
      rule_kind: "drug" as const,
      extracted_data: {
        payer_name: "UnitedHealthcare",
        plan_type: "Commercial",
        hcpcs_code: "J0517",
        drug_name: "Dupixent (dupilumab)",
        pa_required: true,
        step_therapy_required: true,
        step_therapy_details: {
          required_drugs: ["topical corticosteroid", "topical calcineurin inhibitor"],
          duration_days: 60,
          exceptions: ["BSA > 20% — systemic immunosuppressant trial NOT required (policy change)"],
        },
        documentation_requirements: [
          { item: "Clinical notes documenting diagnosis", required: true, description: "Recent office visit note with ICD-10 diagnosis" },
          { item: "BSA assessment", required: true, description: "Documented percentage of body affected" },
          { item: "Prior treatment history showing TWO topical therapies", required: true, description: "Documentation of two topical trials, 60 days each (updated from one trial)" },
          { item: "Lab results - TB test", required: true, description: "TB screening required before biologic initiation" },
        ],
        source_url: "https://www.uhcprovider.com/content/dam/provider/docs/public/prior-auth/drugs-702-biologics-atopic-dermatitis-2026-update.pdf",
        confidence_score: 0.7,
      },
      source_excerpt:
        "Step therapy requirement CHANGED: Patients must now trial TWO topical therapies (previously one) for a minimum of 60 days each before dupilumab authorization. Systemic immunosuppressant trial is no longer required for patients with BSA > 20%.",
      extraction_confidence: "high",
      status: "pending_review" as const,
    },
    {
      id: deterministicUUID("staged-rule-2"),
      rule_kind: "drug" as const,
      extracted_data: {
        payer_name: "UnitedHealthcare",
        plan_type: "Commercial",
        hcpcs_code: null,
        drug_name: "Adbry (tralokinumab)",
        pa_required: true,
        step_therapy_required: true,
        step_therapy_details: {
          required_drugs: ["topical therapy"],
          duration_days: 30,
          exceptions: [],
        },
        documentation_requirements: [
          { item: "Diagnosis of moderate-to-severe atopic dermatitis", required: true, description: "ICD-10 L20.x" },
          { item: "BSA assessment", required: true, description: "Body surface area percentage" },
          { item: "Trial of one topical therapy", required: true, description: "Documentation of topical trial" },
        ],
        source_url: "https://www.uhcprovider.com/content/dam/provider/docs/public/prior-auth/drugs-702-biologics-atopic-dermatitis-2026-update.pdf",
        confidence_score: 0.7,
      },
      source_excerpt:
        "Prior authorization REQUIRED for tralokinumab. Documentation requirements: diagnosis of moderate-to-severe atopic dermatitis, BSA assessment, trial of one topical therapy.",
      extraction_confidence: "high",
      status: "pending_review" as const,
    },
    {
      id: deterministicUUID("staged-rule-3"),
      rule_kind: "procedure" as const,
      extracted_data: {
        payer_name: "UnitedHealthcare",
        plan_type: "Commercial",
        cpt_code: "96910",
        procedure_name: "Phototherapy (UVB)",
        pa_required: true,
        documentation_requirements: [
          { item: "Diagnosis documentation", required: true, description: "ICD-10 code with clinical notes" },
          { item: "BSA assessment showing > 10%", required: true, description: "Required for increased frequency" },
        ],
        units_or_frequency_limits: {
          max_per_period: { count: 36, period_days: 365 },
          notes: "Increased from 24 to 36 sessions per calendar year for BSA > 10%",
        },
        source_url: "https://www.uhcprovider.com/content/dam/provider/docs/public/prior-auth/drugs-702-biologics-atopic-dermatitis-2026-update.pdf",
        confidence_score: 0.7,
      },
      source_excerpt:
        "Maximum sessions increased from 24 to 36 per calendar year for patients with documented BSA > 10%.",
      extraction_confidence: "medium",
      status: "pending_review" as const,
    },
    {
      id: deterministicUUID("staged-rule-4"),
      rule_kind: "procedure" as const,
      extracted_data: {
        payer_name: "UnitedHealthcare",
        plan_type: "Commercial",
        cpt_code: "95044",
        procedure_name: "Patch testing",
        pa_required: true,
        documentation_requirements: [
          { item: "Clinical notes documenting suspected contact dermatitis", required: true, description: "History and presentation" },
          { item: "List of suspected allergens", required: true, description: "Targeted allergen panel justification" },
        ],
        source_url: "https://www.uhcprovider.com/content/dam/provider/docs/public/prior-auth/drugs-702-biologics-atopic-dermatitis-2026-update.pdf",
        confidence_score: 0.7,
      },
      source_excerpt:
        "Prior authorization remains required. No changes to documentation or coverage criteria.",
      extraction_confidence: "high",
      status: "pending_review" as const,
    },
    {
      id: deterministicUUID("staged-rule-5"),
      rule_kind: "drug" as const,
      extracted_data: {
        payer_name: "UnitedHealthcare",
        plan_type: "Commercial",
        hcpcs_code: null,
        drug_name: "Lebrikizumab",
        pa_required: true,
        step_therapy_required: true,
        step_therapy_details: {
          required_drugs: ["dupilumab"],
          duration_days: 90,
          exceptions: ["Documented contraindication or adverse reaction to dupilumab"],
        },
        documentation_requirements: [
          { item: "Diagnosis of atopic dermatitis", required: true, description: "ICD-10 L20.x" },
          { item: "Prior dupilumab trial documentation", required: true, description: "Evidence of trial and failure or contraindication" },
          { item: "BSA assessment", required: true, description: "Body surface area percentage" },
        ],
        source_url: "https://www.uhcprovider.com/content/dam/provider/docs/public/prior-auth/drugs-702-biologics-atopic-dermatitis-2026-update.pdf",
        confidence_score: 0.7,
      },
      source_excerpt:
        "Effective July 1, 2026, lebrikizumab is covered under specialty pharmacy benefit. PA required. Step therapy: trial of dupilumab required before lebrikizumab approval.",
      extraction_confidence: "low",
      status: "pending_review" as const,
    },
  ];

  for (const rule of stagedRules) {
    await supabase.from("policy_watch_staged_rules").insert({
      id: rule.id,
      document_id: docId,
      rule_kind: rule.rule_kind,
      extracted_data: rule.extracted_data,
      source_excerpt: rule.source_excerpt,
      extraction_confidence: rule.extraction_confidence,
      status: rule.status,
    });
  }

  console.log(`    Created 1 document with ${stagedRules.length} staged rules`);
  console.log(
    "    Staged rule #1 is a material change to existing UHC Dupixent step therapy"
  );
}

async function seedSyncState() {
  console.log("  Creating sync state...");

  // Seed practice_sync_state
  await supabase.from("practice_sync_state").upsert(
    {
      practice_id: PRACTICE_ID,
      breaker_status: "closed",
      breaker_failure_count: 0,
      last_successful_sync_at: new Date().toISOString(),
    },
    { onConflict: "practice_id" }
  );

  // Seed a few sync log entries
  const syncLogs = [
    {
      practice_id: PRACTICE_ID,
      sync_type: "full" as const,
      status: "completed" as const,
      started_at: pastDate(2),
      completed_at: pastDate(2),
      records_fetched: { patients: 25, appointments: 40, coverage: 25, practitioners: 3 },
      records_created: 93,
      records_updated: 0,
      triggered_by: "initial_setup" as const,
      breaker_state: "closed",
    },
    {
      practice_id: PRACTICE_ID,
      sync_type: "incremental" as const,
      status: "completed" as const,
      started_at: pastDate(1),
      completed_at: pastDate(1),
      records_fetched: { appointments: 3, coverage: 2 },
      records_created: 2,
      records_updated: 3,
      triggered_by: "cron" as const,
      breaker_state: "closed",
    },
  ];

  for (const log of syncLogs) {
    await supabase.from("modmed_sync_log").insert(log);
  }

  console.log("    Created sync state and 2 sync log entries");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("🌱 Seeding Plaza Park Dermatology demo environment...\n");

  try {
    await seedPractice();
    await seedUsers();
    const patientIds = await seedPatients();
    const appointmentIds = await seedAppointments(patientIds);
    await seedPriorAuths(patientIds, appointmentIds);
    await seedSyncState();
    await seedPolicyWatch();

    console.log("\n✅ Demo seed complete!");
    console.log("\n📋 Demo accounts:");
    console.log("   admin@plazapark.demo  — practice_admin (Dr. Patricia Reyes)");
    console.log("   amber@plazapark.demo  — billing_manager (Amber Chen)");
    console.log("   staff@plazapark.demo  — staff (Marcus Johnson)");
    console.log(`   Password: ${DEMO_PASSWORD}`);
    console.log("\n   See docs/demo-accounts.md for full details.");
  } catch (err) {
    console.error("\n❌ Seed failed:", err);
    process.exit(1);
  }
}

main();

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { upsertDrugRule } from "@/lib/admin/actions";
import type { ActionResult } from "@/lib/admin/actions";
import type { PayerRuleDrug } from "@/lib/types";
import { JsonTextarea } from "./json-textarea";
import {
  documentationRequirementsSchema,
  stepTherapyDetailsSchema,
  appealsPathwaySchema,
  labRequirementsSchema,
  BCBS_LICENSEES,
  SUBMISSION_METHODS,
  PLAN_TYPES,
} from "@/lib/admin/schemas";

interface DrugRuleFormProps {
  rule?: PayerRuleDrug;
}

export function DrugRuleForm({ rule }: DrugRuleFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);

  // JSONB state managed separately for the textarea components
  const [docRequirements, setDocRequirements] = useState<unknown>(
    rule?.documentation_requirements ?? []
  );
  const [stepTherapy, setStepTherapy] = useState<unknown>(
    rule?.step_therapy_details ?? null
  );
  const [appeals, setAppeals] = useState<unknown>(
    rule?.appeals_pathway ?? null
  );
  const [labReqs, setLabReqs] = useState<unknown>(
    rule?.lab_requirements ?? null
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});

    const fd = new FormData(e.currentTarget);

    const formData = {
      ...(rule?.id ? { id: rule.id } : {}),
      payer_name: fd.get("payer_name") as string,
      plan_type: fd.get("plan_type") as string,
      bcbs_licensee: (fd.get("bcbs_licensee") as string) || null,
      hcpcs_code: (fd.get("hcpcs_code") as string) || null,
      ndc_code: (fd.get("ndc_code") as string) || null,
      drug_name: fd.get("drug_name") as string,
      icd10_codes: (fd.get("icd10_codes") as string)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      pa_required: fd.get("pa_required") === "true",
      documentation_requirements: docRequirements as [],
      step_therapy_required: fd.get("step_therapy_required") === "true",
      step_therapy_details: stepTherapy,
      appeals_pathway: appeals,
      lab_requirements: labReqs,
      submission_method: (fd.get("submission_method") as string) || null,
      typical_turnaround_days: fd.get("typical_turnaround_days")
        ? Number(fd.get("typical_turnaround_days"))
        : null,
      source_url: fd.get("source_url") as string,
      source_document_excerpt:
        (fd.get("source_document_excerpt") as string) || null,
      last_verified_date: fd.get("last_verified_date") as string,
      confidence_score: Number(fd.get("confidence_score")),
      change_reason: fd.get("change_reason") as string,
    };

    // Server action validates with Zod; cast is safe
    const result: ActionResult = await upsertDrugRule(
      formData as Parameters<typeof upsertDrugRule>[0]
    );

    setSaving(false);
    if (result.success) {
      router.push("/admin/rules/drug");
      router.refresh();
    } else {
      setError(result.error ?? "Unknown error");
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
    }
  }

  const isEdit = !!rule;

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl space-y-8">
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
          {Object.keys(fieldErrors).length > 0 && (
            <ul className="mt-2 list-inside list-disc">
              {Object.entries(fieldErrors).map(([field, msgs]) =>
                msgs.map((msg, i) => (
                  <li key={`${field}-${i}`}>
                    <strong>{field}</strong>: {msg}
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}

      {/* Payer Identification */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Payer Identification
        </legend>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Payer Name" name="payer_name" defaultValue={rule?.payer_name} required />
          <SelectField
            label="Plan Type"
            name="plan_type"
            defaultValue={rule?.plan_type}
            options={PLAN_TYPES}
            required
          />
        </div>
        <SelectField
          label="BCBS Licensee"
          name="bcbs_licensee"
          defaultValue={rule?.bcbs_licensee ?? ""}
          options={BCBS_LICENSEES}
          placeholder="N/A (only set for BCBS)"
        />
      </fieldset>

      {/* Drug Identification */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Drug Identification
        </legend>
        <Field label="Drug Name" name="drug_name" defaultValue={rule?.drug_name} required />
        <div className="grid grid-cols-2 gap-4">
          <Field label="HCPCS Code" name="hcpcs_code" defaultValue={rule?.hcpcs_code ?? ""} placeholder="e.g. J0517" />
          <Field label="NDC Code" name="ndc_code" defaultValue={rule?.ndc_code ?? ""} placeholder="11-digit NDC" />
        </div>
        <Field
          label="ICD-10 Codes"
          name="icd10_codes"
          defaultValue={rule?.icd10_codes?.join(", ") ?? ""}
          placeholder="Comma-separated, e.g. L20.9, L40.0"
        />
      </fieldset>

      {/* Rule */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Rule
        </legend>
        <div className="grid grid-cols-2 gap-4">
          <BooleanField label="PA Required" name="pa_required" defaultValue={rule?.pa_required ?? true} />
          <BooleanField label="Step Therapy Required" name="step_therapy_required" defaultValue={rule?.step_therapy_required ?? false} />
        </div>
      </fieldset>

      {/* JSONB Fields */}
      <fieldset className="space-y-6">
        <legend className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Structured Data (JSON)
        </legend>
        <JsonTextarea
          name="documentation_requirements"
          label="Documentation Requirements"
          schema={documentationRequirementsSchema}
          defaultValue={rule?.documentation_requirements}
          onChange={setDocRequirements}
        />
        <JsonTextarea
          name="step_therapy_details"
          label="Step Therapy Details"
          schema={stepTherapyDetailsSchema}
          defaultValue={rule?.step_therapy_details}
          onChange={setStepTherapy}
        />
        <JsonTextarea
          name="appeals_pathway"
          label="Appeals Pathway"
          schema={appealsPathwaySchema}
          defaultValue={rule?.appeals_pathway}
          onChange={setAppeals}
        />
        <JsonTextarea
          name="lab_requirements"
          label="Lab Requirements"
          schema={labRequirementsSchema}
          defaultValue={rule?.lab_requirements}
          onChange={setLabReqs}
        />
      </fieldset>

      {/* Submission */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Submission
        </legend>
        <div className="grid grid-cols-2 gap-4">
          <SelectField
            label="Submission Method"
            name="submission_method"
            defaultValue={rule?.submission_method ?? ""}
            options={SUBMISSION_METHODS}
            placeholder="Not specified"
          />
          <Field
            label="Typical Turnaround Days"
            name="typical_turnaround_days"
            type="number"
            defaultValue={rule?.typical_turnaround_days?.toString() ?? ""}
          />
        </div>
      </fieldset>

      {/* Provenance */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Provenance
        </legend>
        <Field label="Source URL" name="source_url" type="url" defaultValue={rule?.source_url} required />
        <div className="grid grid-cols-2 gap-4">
          <Field
            label="Last Verified Date"
            name="last_verified_date"
            type="date"
            defaultValue={rule?.last_verified_date ?? new Date().toISOString().split("T")[0]}
            required
          />
          <Field
            label="Confidence Score (0-1)"
            name="confidence_score"
            type="number"
            step="0.01"
            defaultValue={rule?.confidence_score?.toString() ?? "0.7"}
            required
          />
        </div>
        <TextareaField
          label="Source Document Excerpt"
          name="source_document_excerpt"
          defaultValue={rule?.source_document_excerpt ?? ""}
          rows={4}
        />
      </fieldset>

      {/* Change Reason */}
      <fieldset className="space-y-4">
        <legend className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Audit
        </legend>
        <TextareaField
          label="Change Reason"
          name="change_reason"
          placeholder="Explain why this rule is being added or changed..."
          required
          rows={3}
        />
      </fieldset>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-zinc-800 px-6 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-200 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {saving ? "Saving..." : isEdit ? "Update Rule" : "Create Rule"}
        </button>
        <Link
          href="/admin/rules/drug"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

// ---- Helper field components ----

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  placeholder,
  required,
  step,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  step?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        step={step}
        className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
      />
    </div>
  );
}

function TextareaField({
  label,
  name,
  defaultValue,
  placeholder,
  required,
  rows = 3,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  rows?: number;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <textarea
        id={name}
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        rows={rows}
        className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
      />
    </div>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: readonly string[];
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

function BooleanField({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue ? "true" : "false"}
        className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
      >
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    </div>
  );
}

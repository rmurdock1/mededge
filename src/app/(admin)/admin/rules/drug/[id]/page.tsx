import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DrugRuleForm } from "@/components/admin/drug-rule-form";
import type { PayerRuleDrug } from "@/lib/types";

export default async function EditDrugRulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Super admins can see soft-deleted rules for editing/restoring
  const { data: rule } = await supabase
    .from("payer_rules_drug")
    .select("*")
    .eq("id", id)
    .single();

  if (!rule) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Edit Drug Rule
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {(rule as PayerRuleDrug).drug_name} — {(rule as PayerRuleDrug).payer_name} /{" "}
          {(rule as PayerRuleDrug).plan_type}
        </p>
      </div>
      <DrugRuleForm rule={rule as PayerRuleDrug} />
    </div>
  );
}

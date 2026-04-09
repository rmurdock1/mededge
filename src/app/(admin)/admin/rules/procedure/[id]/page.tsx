import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProcedureRuleForm } from "@/components/admin/procedure-rule-form";
import type { PayerRuleProcedure } from "@/lib/types";

export default async function EditProcedureRulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: rule } = await supabase
    .from("payer_rules_procedure")
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
          Edit Procedure Rule
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {(rule as PayerRuleProcedure).procedure_name} — {(rule as PayerRuleProcedure).payer_name} /{" "}
          {(rule as PayerRuleProcedure).plan_type}
        </p>
      </div>
      <ProcedureRuleForm rule={rule as PayerRuleProcedure} />
    </div>
  );
}

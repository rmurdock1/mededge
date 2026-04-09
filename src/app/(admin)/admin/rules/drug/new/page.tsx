import { DrugRuleForm } from "@/components/admin/drug-rule-form";

export default function NewDrugRulePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          New Drug Rule
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Create a new PA rule for a drug (biologic, injectable, etc.)
        </p>
      </div>
      <DrugRuleForm />
    </div>
  );
}

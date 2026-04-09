import { ProcedureRuleForm } from "@/components/admin/procedure-rule-form";

export default function NewProcedureRulePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          New Procedure Rule
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Create a new PA rule for a procedure (Mohs, phototherapy, patch testing, etc.)
        </p>
      </div>
      <ProcedureRuleForm />
    </div>
  );
}

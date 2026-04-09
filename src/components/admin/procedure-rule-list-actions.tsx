"use client";

import { useRouter } from "next/navigation";
import {
  softDeleteProcedureRule,
  restoreProcedureRule,
} from "@/lib/admin/actions";
import { RuleActionsMenu } from "./rule-actions-menu";

interface ProcedureRuleListActionsProps {
  ruleId: string;
  isDeleted: boolean;
}

export function ProcedureRuleListActions({
  ruleId,
  isDeleted,
}: ProcedureRuleListActionsProps) {
  const router = useRouter();

  async function handleSoftDelete(id: string, reason: string) {
    const result = await softDeleteProcedureRule(id, reason);
    if (result.success) {
      router.refresh();
    }
  }

  async function handleRestore(id: string, reason: string) {
    const result = await restoreProcedureRule(id, reason);
    if (result.success) {
      router.refresh();
    }
  }

  return (
    <RuleActionsMenu
      ruleId={ruleId}
      ruleType="procedure"
      isDeleted={isDeleted}
      editHref={`/admin/rules/procedure/${ruleId}`}
      onSoftDelete={handleSoftDelete}
      onRestore={handleRestore}
    />
  );
}

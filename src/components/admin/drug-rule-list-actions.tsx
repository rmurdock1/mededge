"use client";

import { useRouter } from "next/navigation";
import { softDeleteDrugRule, restoreDrugRule } from "@/lib/admin/actions";
import { RuleActionsMenu } from "./rule-actions-menu";

interface DrugRuleListActionsProps {
  ruleId: string;
  isDeleted: boolean;
}

export function DrugRuleListActions({
  ruleId,
  isDeleted,
}: DrugRuleListActionsProps) {
  const router = useRouter();

  async function handleSoftDelete(id: string, reason: string) {
    const result = await softDeleteDrugRule(id, reason);
    if (result.success) {
      router.refresh();
    }
  }

  async function handleRestore(id: string, reason: string) {
    const result = await restoreDrugRule(id, reason);
    if (result.success) {
      router.refresh();
    }
  }

  return (
    <RuleActionsMenu
      ruleId={ruleId}
      ruleType="drug"
      isDeleted={isDeleted}
      editHref={`/admin/rules/drug/${ruleId}`}
      onSoftDelete={handleSoftDelete}
      onRestore={handleRestore}
    />
  );
}

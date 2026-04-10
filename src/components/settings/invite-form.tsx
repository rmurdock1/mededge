"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inviteTeamMember } from "@/lib/auth/invite-actions";
import { UserPlus } from "lucide-react";

export function InviteForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"staff" | "billing_manager">("staff");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setMessage(null);
    startTransition(async () => {
      const result = await inviteTeamMember({ email: email.trim(), role });
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: `Invitation sent to ${email}` });
        setEmail("");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Email
          </label>
          <Input
            type="email"
            placeholder="colleague@practice.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="w-40">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Role
          </label>
          <select
            value={role}
            onChange={(e) =>
              setRole(e.target.value as "staff" | "billing_manager")
            }
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="staff">Staff</option>
            <option value="billing_manager">Billing Manager</option>
          </select>
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={isPending}
          className="bg-brand-600 hover:bg-brand-700"
        >
          <UserPlus className="mr-1.5 h-3.5 w-3.5" />
          {isPending ? "Sending..." : "Invite"}
        </Button>
      </div>

      {message && (
        <p
          className={`text-xs font-medium ${
            message.type === "error"
              ? "text-destructive"
              : "text-success-600"
          }`}
        >
          {message.text}
        </p>
      )}
    </form>
  );
}

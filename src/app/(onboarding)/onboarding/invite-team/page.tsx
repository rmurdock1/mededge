"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRODUCT_NAME } from "@/lib/branding";
import { inviteTeamMember } from "@/lib/auth/invite-actions";

interface Invitation {
  email: string;
  role: "staff" | "billing_manager";
  status: "pending" | "sent" | "error";
  error?: string;
}

export default function InviteTeamPage() {
  const router = useRouter();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"staff" | "billing_manager">("staff");
  const [sending, setSending] = useState(false);

  async function handleAddInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setSending(true);
    const newInvite: Invitation = {
      email,
      role,
      status: "pending",
    };
    setInvitations((prev) => [...prev, newInvite]);

    const result = await inviteTeamMember({ email, role });

    setInvitations((prev) =>
      prev.map((inv) =>
        inv.email === email
          ? {
              ...inv,
              status: result.error ? "error" : "sent",
              error: result.error,
            }
          : inv
      )
    );

    setEmail("");
    setSending(false);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Invite your team
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Add billing managers and staff members so they can start working prior
          authorizations. You can always invite more people later from settings.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Send an invitation</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddInvite} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="team@practice.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={role}
                  onValueChange={(v) =>
                    setRole(v as "staff" | "billing_manager")
                  }
                >
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="billing_manager">
                      Billing Manager
                    </SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              type="submit"
              disabled={sending || !email}
              variant="outline"
              className="w-full sm:w-auto"
            >
              {sending ? "Sending..." : "Send invitation"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {invitations.length > 0 && (
        <Card>
          <CardContent className="divide-y p-0">
            {invitations.map((inv, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium">{inv.email}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {inv.role.replace("_", " ")}
                  </p>
                </div>
                <div>
                  {inv.status === "sent" && (
                    <span className="text-xs font-medium text-success-600">
                      Invitation sent
                    </span>
                  )}
                  {inv.status === "pending" && (
                    <span className="text-xs text-muted-foreground">
                      Sending...
                    </span>
                  )}
                  {inv.status === "error" && (
                    <span className="text-xs text-destructive">
                      {inv.error ?? "Failed to send"}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        <Button
          onClick={() => router.push("/dashboard")}
          size="lg"
          className="flex-1 bg-brand-600 hover:bg-brand-700"
        >
          {invitations.length > 0
            ? "Continue to dashboard"
            : "Skip — I'll invite people later"}
        </Button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Invited users will receive an email with a link to set their password
        and join your practice on {PRODUCT_NAME}.
      </p>
    </div>
  );
}

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { InviteForm } from "@/components/settings/invite-form";
import {
  Building2,
  Users,
  Plug,
  CheckCircle2,
  XCircle,
  MapPin,
} from "lucide-react";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch user profile + practice
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("practice_id, role")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  // Only practice_admin and super_admin can see settings
  if (profile.role !== "practice_admin" && profile.role !== "super_admin") {
    redirect("/dashboard");
  }

  // Fetch practice details
  const { data: practice } = await supabase
    .from("practices")
    .select("*")
    .eq("id", profile.practice_id)
    .single();

  // Fetch team members
  const { data: team } = await supabase
    .from("user_profiles")
    .select("id, full_name, role, created_at")
    .eq("practice_id", profile.practice_id)
    .order("created_at");

  // Check ModMed connection status
  const isConnected = !!(
    practice?.modmed_url_prefix && practice?.modmed_credentials
  );

  // Fetch last sync
  const { data: lastSync } = await supabase
    .from("practice_sync_state")
    .select("last_sync_at, sync_status")
    .eq("practice_id", profile.practice_id)
    .single();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your practice, team, and integrations.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Practice info */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Practice Information</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Name" value={practice?.name ?? "Unknown"} />
            {practice?.address && (
              <InfoRow
                label="Address"
                value={[
                  practice.address,
                  practice.city,
                  practice.state,
                  practice.zip,
                ]
                  .filter(Boolean)
                  .join(", ")}
                icon={MapPin}
              />
            )}
            <InfoRow
              label="Practice ID"
              value={profile.practice_id.substring(0, 8) + "..."}
              mono
            />
          </CardContent>
        </Card>

        {/* ModMed connection */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Plug className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">ModMed Connection</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              {isConnected ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-success-600" />
                  <span className="text-sm font-medium text-success-700">
                    Connected
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    Not connected
                  </span>
                </>
              )}
            </div>

            {isConnected && (
              <>
                <InfoRow
                  label="Firm prefix"
                  value={practice?.modmed_url_prefix ?? ""}
                  mono
                />
                {lastSync && (
                  <InfoRow
                    label="Last sync"
                    value={
                      lastSync.last_sync_at
                        ? new Date(lastSync.last_sync_at).toLocaleString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit",
                            }
                          )
                        : "Never"
                    }
                  />
                )}
                {lastSync?.sync_status && (
                  <InfoRow label="Status" value={lastSync.sync_status} />
                )}
              </>
            )}

            {!isConnected && (
              <p className="text-xs text-muted-foreground">
                Connect your ModMed practice management system to start syncing
                appointments and detecting PA requirements automatically.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Team management */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">Team Members</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current team */}
          <div className="divide-y rounded-md border">
            {(team ?? []).map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {member.full_name ?? "Unnamed"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Joined{" "}
                    {new Date(member.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className="capitalize"
                >
                  {member.role.replace("_", " ")}
                </Badge>
              </div>
            ))}
          </div>

          <Separator />

          {/* Invite form */}
          <div>
            <p className="mb-2 text-sm font-medium">Invite a team member</p>
            <InviteForm />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoRow({
  label,
  value,
  icon: Icon,
  mono,
}: {
  label: string;
  value: string;
  icon?: React.ElementType;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1.5">
        {Icon && <Icon className="h-3 w-3 text-muted-foreground" />}
        <p className={`text-sm font-medium ${mono ? "font-mono text-xs" : ""}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

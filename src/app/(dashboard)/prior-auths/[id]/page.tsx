import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { decryptPHI } from "@/lib/crypto/phi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PAChecklist } from "@/components/prior-auths/pa-checklist";
import { PAActionBar, PANotes } from "@/components/prior-auths/pa-actions";
import { PAStatusBadge } from "@/components/prior-auths/pa-filters";
import { AppealEditor } from "@/components/prior-auths/appeal-editor";
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Building2,
  Stethoscope,
  AlertTriangle,
} from "lucide-react";
import type { DocumentationItem } from "@/lib/types";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PriorAuthDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch PA with patient data
  const { data: pa } = await supabase
    .from("prior_auths")
    .select(
      `
      *,
      patients!inner(name_encrypted, insurance_payer, plan_type)
    `
    )
    .eq("id", id)
    .single();

  if (!pa) notFound();

  // Decrypt patient name
  let patientName = "Unknown Patient";
  try {
    const patientsData = pa.patients as unknown as {
      name_encrypted: string;
      insurance_payer: string | null;
      plan_type: string | null;
    } | null;
    if (patientsData?.name_encrypted) {
      patientName = decryptPHI(patientsData.name_encrypted);
    }
  } catch {
    patientName = "Patient";
  }

  const patients = pa.patients as unknown as {
    insurance_payer: string | null;
    plan_type: string | null;
  } | null;

  // Fetch activity log
  const { data: activity } = await supabase
    .from("pa_activity_log")
    .select("id, action, details, created_at")
    .eq("prior_auth_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  const checklist = (pa.documentation_checklist ?? []) as DocumentationItem[];
  const isTerminal = ["approved", "appeal_approved", "expired"].includes(
    pa.status
  );

  return (
    <div className="space-y-5">
      {/* Back link + header */}
      <div>
        <Link
          href="/prior-auths"
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to all PAs
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {patientName}
              </h1>
              <PAStatusBadge status={pa.status} />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {pa.procedure_or_medication} &middot; {pa.payer_name}
            </p>
          </div>

          <PAActionBar
            paId={pa.id}
            status={pa.status}
            notes={pa.notes}
          />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Main content — 2 columns */}
        <div className="space-y-5 lg:col-span-2">
          {/* Denial reason banner */}
          {pa.denial_reason &&
            ["denied", "appeal_draft", "appeal_submitted", "appeal_approved", "appeal_denied"].includes(pa.status) && (
              <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    <div>
                      <p className="text-sm font-medium text-destructive">
                        Denial Reason
                      </p>
                      <p className="mt-1 text-sm text-foreground">
                        {pa.denial_reason}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

          {/* Documentation checklist */}
          <Card>
            <CardContent className="p-5">
              {checklist.length > 0 ? (
                <PAChecklist
                  paId={pa.id}
                  items={checklist}
                  readonly={isTerminal}
                />
              ) : (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  No documentation requirements for this PA.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Appeal editor — shown for denied, appeal_draft, appeal_submitted, appeal_approved, appeal_denied */}
          {(pa.status === "denied" ||
            pa.status === "appeal_draft" ||
            pa.status === "appeal_submitted" ||
            pa.status === "appeal_approved" ||
            pa.status === "appeal_denied" ||
            pa.appeal_letter) && (
            <AppealEditor
              paId={pa.id}
              status={pa.status}
              denialReason={pa.denial_reason}
              existingLetter={pa.appeal_letter}
            />
          )}

          {/* Notes */}
          <Card>
            <CardContent className="p-5">
              <PANotes paId={pa.id} notes={pa.notes} />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar — 1 column */}
        <div className="space-y-5">
          {/* Key details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <DetailRow
                icon={User}
                label="Patient"
                value={patientName}
              />
              <DetailRow
                icon={Stethoscope}
                label="Procedure"
                value={pa.procedure_or_medication}
              />
              <DetailRow
                icon={Building2}
                label="Payer"
                value={pa.payer_name}
              />
              {patients?.plan_type && (
                <DetailRow
                  icon={Building2}
                  label="Plan Type"
                  value={patients.plan_type}
                />
              )}
              <Separator />
              <DetailRow
                icon={Calendar}
                label="Created"
                value={formatDate(pa.created_at)}
              />
              {pa.submitted_date && (
                <DetailRow
                  icon={Calendar}
                  label="Submitted"
                  value={formatDate(pa.submitted_date)}
                />
              )}
              {pa.decision_date && (
                <DetailRow
                  icon={Calendar}
                  label="Decision"
                  value={formatDate(pa.decision_date)}
                />
              )}
              {pa.expiration_date && (
                <DetailRow
                  icon={Clock}
                  label="Expires"
                  value={formatDate(pa.expiration_date)}
                />
              )}
            </CardContent>
          </Card>

          {/* Activity timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Activity</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {activity && activity.length > 0 ? (
                <div className="divide-y">
                  {activity.map((entry) => (
                    <div key={entry.id} className="px-5 py-3">
                      <p className="text-sm font-medium">{entry.action}</p>
                      {entry.details && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {entry.details}
                        </p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground/60">
                        {formatRelativeTime(entry.created_at)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No activity yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

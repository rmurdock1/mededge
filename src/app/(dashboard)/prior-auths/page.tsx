import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { decryptPHI } from "@/lib/crypto/phi";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PAFilters, PAStatusBadge } from "@/components/prior-auths/pa-filters";
import { FileCheck, ArrowRight } from "lucide-react";
import { PRODUCT_NAME } from "@/lib/branding";

// Map filter group keys to actual DB status values
const STATUS_FILTER_MAP: Record<string, string[]> = {
  attention: ["draft", "ready"],
  submitted: ["submitted", "pending"],
  approved: ["approved"],
  denied: ["denied"],
  appeals: [
    "appeal_draft",
    "appeal_submitted",
    "appeal_approved",
    "appeal_denied",
  ],
};

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PriorAuthsPage({ searchParams }: Props) {
  const params = await searchParams;
  const statusFilter = (params.status as string) || "";
  const payerFilter = (params.payer as string) || "";
  const searchQuery = (params.q as string) || "";

  const supabase = await createClient();

  // Build query
  let query = supabase
    .from("prior_auths")
    .select(
      `
      id,
      status,
      payer_name,
      procedure_or_medication,
      created_at,
      submitted_date,
      decision_date,
      expiration_date,
      patient_id,
      patients!inner(name_encrypted)
    `
    )
    .order("created_at", { ascending: false });

  // Apply status filter
  if (statusFilter && STATUS_FILTER_MAP[statusFilter]) {
    query = query.in("status", STATUS_FILTER_MAP[statusFilter]);
  }

  // Apply payer filter
  if (payerFilter) {
    query = query.eq("payer_name", payerFilter);
  }

  const { data: priorAuths } = await query;

  // Get distinct payers for filter dropdown
  const { data: payerRows } = await supabase
    .from("prior_auths")
    .select("payer_name")
    .order("payer_name");

  const payers = [
    ...new Set((payerRows ?? []).map((r) => r.payer_name).filter(Boolean)),
  ];

  // Decrypt names and apply search filter
  const rows = (priorAuths ?? [])
    .map((pa) => {
      let patientName = "Unknown Patient";
      try {
        const patients = pa.patients as unknown as { name_encrypted: string } | null;
        if (patients?.name_encrypted) {
          patientName = decryptPHI(patients.name_encrypted);
        }
      } catch {
        patientName = "Patient";
      }
      return { ...pa, patientName };
    })
    .filter((pa) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        pa.patientName.toLowerCase().includes(q) ||
        pa.procedure_or_medication?.toLowerCase().includes(q) ||
        pa.payer_name?.toLowerCase().includes(q)
      );
    });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Prior Authorizations
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {rows.length} authorization{rows.length !== 1 ? "s" : ""}
          {statusFilter ? ` matching filter` : ""}
        </p>
      </div>

      {/* Filters */}
      <PAFilters payers={payers} />

      {/* Table */}
      {rows.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Patient</TableHead>
                  <TableHead>Procedure / Medication</TableHead>
                  <TableHead>Payer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="pr-5">Decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((pa) => (
                  <TableRow key={pa.id} className="group">
                    <TableCell className="pl-5">
                      <Link
                        href={`/prior-auths/${pa.id}`}
                        className="font-medium text-foreground group-hover:text-brand-600"
                      >
                        {pa.patientName}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {pa.procedure_or_medication}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {pa.payer_name}
                    </TableCell>
                    <TableCell>
                      <PAStatusBadge status={pa.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(pa.created_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {pa.submitted_date
                        ? formatDate(pa.submitted_date)
                        : "\u2014"}
                    </TableCell>
                    <TableCell className="pr-5 text-muted-foreground">
                      {pa.decision_date
                        ? formatDate(pa.decision_date)
                        : "\u2014"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50">
              <FileCheck className="h-6 w-6 text-brand-600" />
            </div>
            {statusFilter || payerFilter || searchQuery ? (
              <>
                <p className="text-lg font-medium">No matching PAs</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  Try adjusting your filters or search query.
                </p>
                <Link href="/prior-auths" className="mt-6 inline-block">
                  <Button variant="outline" size="sm">
                    Clear filters
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <p className="text-lg font-medium">
                  No prior authorizations yet
                </p>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  Prior authorizations appear here automatically when{" "}
                  {PRODUCT_NAME} detects an upcoming appointment that requires
                  authorization.
                </p>
                <Link href="/settings" className="mt-6 inline-block">
                  <Button className="bg-brand-600 hover:bg-brand-700">
                    Go to Settings
                    <ArrowRight className="ml-2 h-3.5 w-3.5" />
                  </Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      )}
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

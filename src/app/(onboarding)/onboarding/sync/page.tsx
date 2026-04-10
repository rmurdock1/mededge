"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PRODUCT_NAME } from "@/lib/branding";
import { runOnboardingSync, type OnboardingSyncResult } from "@/lib/modmed/onboarding-actions-sync";

type SyncStage = "idle" | "syncing" | "complete" | "error";

export default function SyncPage() {
  const router = useRouter();
  const [stage, setStage] = useState<SyncStage>("idle");
  const [result, setResult] = useState<OnboardingSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleStartSync() {
    setStage("syncing");
    setError(null);

    const syncResult = await runOnboardingSync();

    if (syncResult.error) {
      setError(syncResult.error);
      setStage("error");
      return;
    }

    setResult(syncResult);
    setStage("complete");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {stage === "syncing" && "Syncing your data..."}
          {stage === "complete" && "Sync complete!"}
          {stage === "error" && "Sync encountered an issue"}
          {stage === "idle" && "Ready to sync"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {stage === "syncing" &&
            `${PRODUCT_NAME} is pulling your appointments, patients, and insurance data from ModMed.`}
          {stage === "complete" &&
            `Your practice data has been imported. ${PRODUCT_NAME} has already scanned for PA requirements.`}
          {stage === "error" &&
            "Don\u2019t worry \u2014 you can retry or skip this step and sync later from settings."}
          {stage === "idle" &&
            `${PRODUCT_NAME} will pull your patient and appointment data from ModMed, then scan for PA requirements.`}
        </p>
      </div>

      {stage === "idle" && (
        <Button
          onClick={handleStartSync}
          size="lg"
          className="w-full bg-brand-600 hover:bg-brand-700"
        >
          Start initial sync
        </Button>
      )}

      {stage === "syncing" && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <SyncStep label="Connecting to ModMed" status="complete" />
            <SyncStep label="Fetching practitioners" status="active" />
            <SyncStep label="Fetching patients and insurance" status="pending" />
            <SyncStep label="Fetching upcoming appointments" status="pending" />
            <SyncStep label="Scanning for PA requirements" status="pending" />
          </CardContent>
        </Card>
      )}

      {stage === "complete" && result && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <SyncStep label="Connected to ModMed" status="complete" />
            <SyncStep
              label={`${result.patientsCount ?? 0} patients imported`}
              status="complete"
            />
            <SyncStep
              label={`${result.appointmentsCount ?? 0} upcoming appointments found`}
              status="complete"
            />
            <SyncStep
              label={`${result.pasDetected ?? 0} prior authorizations needed`}
              status="complete"
            />
          </CardContent>
        </Card>
      )}

      {stage === "error" && (
        <Card>
          <CardContent className="p-6">
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
              <p className="font-medium">Sync failed</p>
              <p className="mt-1">
                {error ??
                  "An unexpected error occurred. Please try again or contact support."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3">
        {stage === "complete" && (
          <Button
            onClick={() => router.push("/onboarding/invite-team")}
            className="flex-1 bg-brand-600 hover:bg-brand-700"
            size="lg"
          >
            Continue to invite your team
          </Button>
        )}
        {stage === "error" && (
          <>
            <Button
              onClick={handleStartSync}
              variant="outline"
              className="flex-1"
              size="lg"
            >
              Retry sync
            </Button>
            <Button
              onClick={() => router.push("/onboarding/invite-team")}
              variant="ghost"
              className="flex-1"
              size="lg"
            >
              Skip for now
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function SyncStep({
  label,
  status,
}: {
  label: string;
  status: "pending" | "active" | "complete";
}) {
  return (
    <div className="flex items-center gap-3">
      {status === "complete" && (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-100 text-success-700">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}
      {status === "active" && (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
        </div>
      )}
      {status === "pending" && (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center">
          <div className="h-2 w-2 rounded-full bg-muted-foreground/30" />
        </div>
      )}
      <span
        className={`text-sm ${
          status === "pending"
            ? "text-muted-foreground"
            : status === "active"
              ? "font-medium"
              : "text-foreground"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  generateAppealLetter,
  saveAppealLetter,
  recordAppealOutcome,
} from "@/lib/prior-auths/appeal-actions";
import { updatePAStatus } from "@/lib/prior-auths/actions";
import {
  Sparkles,
  RefreshCw,
  Send,
  Save,
  CheckCircle2,
  XCircle,
  Pencil,
} from "lucide-react";

interface AppealEditorProps {
  paId: string;
  status: string;
  denialReason: string | null;
  existingLetter: string | null;
}

export function AppealEditor({
  paId,
  status,
  denialReason,
  existingLetter,
}: AppealEditorProps) {
  const [letter, setLetter] = useState(existingLetter ?? "");
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showOutcome, setShowOutcome] = useState(false);
  const router = useRouter();

  const isDenied = status === "denied";
  const isAppealDraft = status === "appeal_draft";
  const isAppealSubmitted = status === "appeal_submitted";
  const hasLetter = letter.length > 0;

  function handleGenerate() {
    setError(null);
    startTransition(async () => {
      const result = await generateAppealLetter(paId);
      if (result.error) {
        setError(result.error);
      } else if (result.letter) {
        setLetter(result.letter);
        setIsEditing(false);
      }
      router.refresh();
    });
  }

  function handleSave() {
    startTransition(async () => {
      const result = await saveAppealLetter(paId, letter);
      if (result.error) {
        setError(result.error);
      } else {
        setIsEditing(false);
      }
      router.refresh();
    });
  }

  function handleSubmitAppeal() {
    startTransition(async () => {
      const result = await updatePAStatus(paId, "appeal_submitted");
      if (result.error) {
        setError(result.error);
      }
      router.refresh();
    });
  }

  function handleOutcome(outcome: "appeal_approved" | "appeal_denied") {
    startTransition(async () => {
      const result = await recordAppealOutcome(paId, outcome);
      if (result.error) {
        setError(result.error);
      }
      setShowOutcome(false);
      router.refresh();
    });
  }

  // Denied PA without a letter — show generate CTA
  if (isDenied && !hasLetter) {
    return (
      <Card className="border-brand-200 bg-brand-50/30">
        <CardContent className="py-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-100">
            <Sparkles className="h-6 w-6 text-brand-600" />
          </div>
          <p className="text-lg font-medium">Generate an Appeal Letter</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            {denialReason
              ? `Denial reason: "${denialReason}". MedEdge will draft a tailored appeal letter using AI.`
              : "Add a denial reason first, then generate an appeal letter."}
          </p>

          {error && (
            <p className="mt-3 text-sm font-medium text-destructive">
              {error}
            </p>
          )}

          <Button
            onClick={handleGenerate}
            disabled={isPending || !denialReason}
            className="mt-6 bg-brand-600 hover:bg-brand-700"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {isPending ? "Generating..." : "Generate Appeal with AI"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Has a letter — show review/edit UI
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Appeal Letter</CardTitle>
          <div className="flex items-center gap-2">
            {(isDenied || isAppealDraft) && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={isPending}
                  title="Regenerate with AI"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`}
                  />
                </Button>
                {!isEditing ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    Edit
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSave}
                    disabled={isPending}
                  >
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    {isPending ? "Saving..." : "Save"}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p className="text-sm font-medium text-destructive">{error}</p>
        )}

        {isEditing ? (
          <Textarea
            value={letter}
            onChange={(e) => setLetter(e.target.value)}
            className="min-h-[400px] font-mono text-sm"
          />
        ) : (
          <div className="rounded-md bg-accent/50 p-4">
            <pre className="whitespace-pre-wrap text-sm leading-relaxed">
              {letter}
            </pre>
          </div>
        )}

        {/* Action buttons based on status */}
        <div className="flex items-center gap-2 border-t pt-4">
          {isAppealDraft && (
            <Button
              onClick={handleSubmitAppeal}
              disabled={isPending}
              className="bg-brand-600 hover:bg-brand-700"
              size="sm"
            >
              <Send className="mr-1.5 h-3.5 w-3.5" />
              {isPending ? "Submitting..." : "Mark as Submitted"}
            </Button>
          )}

          {isAppealSubmitted && !showOutcome && (
            <Button
              onClick={() => setShowOutcome(true)}
              variant="outline"
              size="sm"
            >
              Record Outcome
            </Button>
          )}

          {isAppealSubmitted && showOutcome && (
            <>
              <Button
                onClick={() => handleOutcome("appeal_approved")}
                disabled={isPending}
                variant="outline"
                size="sm"
              >
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-success-600" />
                {isPending ? "..." : "Approved"}
              </Button>
              <Button
                onClick={() => handleOutcome("appeal_denied")}
                disabled={isPending}
                variant="outline"
                size="sm"
              >
                <XCircle className="mr-1.5 h-3.5 w-3.5 text-destructive" />
                {isPending ? "..." : "Denied"}
              </Button>
              <Button
                onClick={() => setShowOutcome(false)}
                variant="ghost"
                size="sm"
              >
                Cancel
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

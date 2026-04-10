"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updatePAStatus, addPANote } from "@/lib/prior-auths/actions";
import {
  Send,
  FileText,
  CheckCircle2,
  XCircle,
  MessageSquarePlus,
} from "lucide-react";

interface PAActionsProps {
  paId: string;
  status: string;
  notes: string | null;
}

/** Returns the contextual primary action for a given PA status. */
function getPrimaryAction(status: string) {
  switch (status) {
    case "draft":
      return {
        label: "Mark as Ready",
        targetStatus: "ready",
        icon: CheckCircle2,
        className: "bg-brand-600 hover:bg-brand-700",
      };
    case "ready":
      return {
        label: "Submit to Payer",
        targetStatus: "submitted",
        icon: Send,
        className: "bg-brand-600 hover:bg-brand-700",
      };
    case "submitted":
    case "pending":
      return null; // Awaiting external decision
    case "denied":
      return {
        label: "Start Appeal",
        targetStatus: "appeal_draft",
        icon: FileText,
        className: "bg-destructive hover:bg-destructive/90",
      };
    case "appeal_draft":
      return {
        label: "Submit Appeal",
        targetStatus: "appeal_submitted",
        icon: Send,
        className: "bg-brand-600 hover:bg-brand-700",
      };
    default:
      return null;
  }
}

export function PAActionBar({ paId, status }: PAActionsProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const action = getPrimaryAction(status);

  function handleAction() {
    if (!action) return;
    startTransition(async () => {
      const result = await updatePAStatus(paId, action.targetStatus);
      if (!result.error) {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {action && (
        <Button
          onClick={handleAction}
          disabled={isPending}
          className={action.className}
          size="sm"
        >
          <action.icon className="mr-1.5 h-3.5 w-3.5" />
          {isPending ? "Updating..." : action.label}
        </Button>
      )}

      {/* Secondary actions for submitted PAs */}
      {(status === "submitted" || status === "pending") && (
        <>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await updatePAStatus(paId, "approved");
                router.refresh();
              })
            }
          >
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 text-success-600" />
            Approved
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await updatePAStatus(paId, "denied");
                router.refresh();
              })
            }
          >
            <XCircle className="mr-1.5 h-3.5 w-3.5 text-destructive" />
            Denied
          </Button>
        </>
      )}
    </div>
  );
}

export function PANotes({ paId, notes }: { paId: string; notes: string | null }) {
  const [isAdding, setIsAdding] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!noteText.trim()) return;
    startTransition(async () => {
      const result = await addPANote(paId, noteText.trim());
      if (!result.error) {
        setNoteText("");
        setIsAdding(false);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Notes</p>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            <MessageSquarePlus className="h-3 w-3" />
            Add note
          </button>
        )}
      </div>

      {isAdding && (
        <div className="space-y-2">
          <Textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add a note..."
            className="min-h-[80px]"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isPending || !noteText.trim()}
              className="bg-brand-600 hover:bg-brand-700"
            >
              {isPending ? "Saving..." : "Save"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setIsAdding(false);
                setNoteText("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {notes ? (
        <pre className="whitespace-pre-wrap rounded-md bg-accent/50 p-3 text-xs text-muted-foreground">
          {notes}
        </pre>
      ) : (
        !isAdding && (
          <p className="text-xs text-muted-foreground">No notes yet.</p>
        )
      )}
    </div>
  );
}

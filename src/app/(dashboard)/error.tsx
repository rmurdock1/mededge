"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to error reporting service in production
    // Never log PHI — only error type and digest
    if (process.env.NODE_ENV === "production") {
      // structured logger would go here
    }
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="max-w-md">
        <CardContent className="py-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            An unexpected error occurred. Your data is safe. Try refreshing, or
            contact support if the problem persists.
          </p>
          {error.digest && (
            <p className="mt-3 font-mono text-xs text-muted-foreground/60">
              Error ID: {error.digest}
            </p>
          )}
          <Button onClick={reset} className="mt-6" variant="outline" size="sm">
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

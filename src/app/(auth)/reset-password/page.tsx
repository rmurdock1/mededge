"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkSession() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setHasSession(!!session);
      setChecking(false);
    }
    checkSession();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (checking) {
    return (
      <AuthLayout heading="Verifying reset link...">
        <div className="space-y-3">
          <div className="h-10 animate-pulse rounded-md bg-muted" />
          <div className="h-10 animate-pulse rounded-md bg-muted" />
          <div className="h-10 animate-pulse rounded-md bg-muted" />
        </div>
      </AuthLayout>
    );
  }

  if (!hasSession) {
    return (
      <AuthLayout
        heading="Invalid or expired link"
        subheading="This password reset link is no longer valid. Please request a new one."
      >
        <Link href="/forgot-password">
          <Button className="w-full bg-brand-600 hover:bg-brand-700">
            Request a new reset link
          </Button>
        </Link>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link
            href="/login"
            className="font-medium text-brand-600 hover:text-brand-700"
          >
            Back to sign in
          </Link>
        </p>
      </AuthLayout>
    );
  }

  if (success) {
    return (
      <AuthLayout
        heading="Password updated"
        subheading="Your password has been reset successfully."
      >
        <div className="rounded-lg border border-success-200 bg-success-50 p-4 text-sm text-success-800">
          <p className="font-medium">You&apos;re all set!</p>
          <p className="mt-1 text-success-600">
            Your password has been changed. You can now sign in with your new
            password.
          </p>
        </div>
        <Link href="/login" className="mt-4 block">
          <Button className="w-full bg-brand-600 hover:bg-brand-700">
            Sign in with new password
          </Button>
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      heading="Set a new password"
      subheading="Enter your new password below."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            placeholder="••••••••"
            autoComplete="new-password"
          />
          <p className="text-xs text-muted-foreground">
            Minimum 8 characters
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
          <Input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            placeholder="••••••••"
            autoComplete="new-password"
          />
        </div>

        <Button type="submit" disabled={loading} className="w-full bg-brand-600 hover:bg-brand-700">
          {loading ? "Updating password..." : "Update password"}
        </Button>
      </form>
    </AuthLayout>
  );
}

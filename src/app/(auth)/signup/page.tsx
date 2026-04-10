"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRODUCT_NAME } from "@/lib/branding";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [practiceName, setPracticeName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          practice_name: practiceName,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <AuthLayout
        heading="Check your email"
        subheading={`We sent a confirmation link to ${email}. Click it to activate your ${PRODUCT_NAME} account.`}
      >
        <div className="rounded-lg border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800">
          <p className="font-medium">Almost there!</p>
          <p className="mt-1 text-brand-600">
            Check your inbox and click the confirmation link to get started. The
            link expires in 24 hours.
          </p>
        </div>
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

  return (
    <AuthLayout
      heading="Create your practice account"
      subheading={`Get started with ${PRODUCT_NAME} in under two minutes. No credit card required.`}
    >
      <form onSubmit={handleSignup} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="practiceName">Practice name</Label>
          <Input
            id="practiceName"
            type="text"
            value={practiceName}
            onChange={(e) => setPracticeName(e.target.value)}
            required
            placeholder="Freeport Dermatology"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fullName">Your name</Label>
          <Input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            placeholder="Dr. Jane Smith"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@practice.com"
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
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

        <Button type="submit" disabled={loading} className="w-full bg-brand-600 hover:bg-brand-700">
          {loading ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-brand-600 hover:text-brand-700"
        >
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}

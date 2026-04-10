"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PRODUCT_NAME } from "@/lib/branding";
import { connectModMed } from "@/lib/modmed/onboarding-actions";

export default function ConnectPMSPage() {
  const router = useRouter();
  const [firmPrefix, setFirmPrefix] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await connectModMed({
      firmPrefix,
      username,
      password,
      apiKey,
    });

    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    router.push("/onboarding/sync");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Connect ModMed
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your ModMed API credentials. {PRODUCT_NAME} connects to your
          practice management system (MMPM) to read appointments, patient
          insurance, and procedure codes. We never modify your data.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">ModMed API credentials</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="firmPrefix">Firm URL prefix</Label>
              <Input
                id="firmPrefix"
                type="text"
                value={firmPrefix}
                onChange={(e) => setFirmPrefix(e.target.value)}
                required
                placeholder="dermpmsandbox1"
              />
              <p className="text-xs text-muted-foreground">
                This is the prefix used in your ModMed API URL. Your ModMed
                administrator can provide this.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">API username</Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="api_user@practice.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">API password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">API key</Label>
              <Input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                required
                placeholder="••••••••••••••••"
              />
              <p className="text-xs text-muted-foreground">
                Provided by ModMed via encrypted email when your API access is
                approved.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading} className="flex-1 bg-brand-600 hover:bg-brand-700">
                {loading ? "Connecting..." : "Connect and continue"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Credentials are encrypted at rest and never stored in plain text. {PRODUCT_NAME}{" "}
        uses read-only API access — we never write to your practice management
        system.
      </p>
    </div>
  );
}

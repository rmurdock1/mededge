import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PRODUCT_NAME } from "@/lib/branding";

export default async function OnboardingWelcomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const firstName = user?.user_metadata?.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome, {firstName}!
        </h1>
        <p className="mt-2 text-muted-foreground">
          Let&apos;s get your practice set up on {PRODUCT_NAME}. This takes
          about 2 minutes.
        </p>
      </div>

      <div className="space-y-4">
        <Card>
          <CardContent className="flex items-start gap-4 p-5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
              1
            </div>
            <div>
              <p className="font-medium">Connect your practice management system</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Link your ModMed account so {PRODUCT_NAME} can scan upcoming
                appointments and detect PA requirements automatically.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start gap-4 p-5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
              2
            </div>
            <div>
              <p className="font-medium">Run your first sync</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {PRODUCT_NAME} will pull your patient and appointment data, then
                flag any upcoming appointments that need prior authorization.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-start gap-4 p-5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
              3
            </div>
            <div>
              <p className="font-medium">Invite your team</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add billing managers and staff so they can start working prior
                authorizations from the dashboard.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Link href="/onboarding/connect-pms">
        <Button size="lg" className="w-full bg-brand-600 hover:bg-brand-700">
          Connect your practice management system
        </Button>
      </Link>
    </div>
  );
}

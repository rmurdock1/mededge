import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PRODUCT_NAME } from "@/lib/branding";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Minimal top bar */}
      <header className="border-b px-6 py-4">
        <p className="text-sm font-semibold tracking-tight text-brand-600">
          {PRODUCT_NAME}
        </p>
      </header>

      {/* Content */}
      <main className="flex flex-1 items-start justify-center px-6 py-12">
        <div className="w-full max-w-lg">{children}</div>
      </main>
    </div>
  );
}

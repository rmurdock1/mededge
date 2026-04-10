import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SideNav } from "@/components/layout/side-nav";

export default async function DashboardLayout({
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

  // Fetch user profile for role and practice info
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*, practices(name)")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex min-h-screen">
      <SideNav
        userName={profile?.full_name ?? user.email ?? "User"}
        practiceName={profile?.practices?.name ?? "Practice"}
        userRole={profile?.role ?? "staff"}
      />
      <main className="flex-1 overflow-y-auto bg-accent/30 p-6">
        {children}
      </main>
    </div>
  );
}

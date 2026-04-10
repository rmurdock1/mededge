"use server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

interface InviteInput {
  email: string;
  role: "staff" | "billing_manager";
}

export async function inviteTeamMember(
  input: InviteInput
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in." };
  }

  // Verify the user is a practice_admin
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("practice_id, role")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.role !== "practice_admin" && profile.role !== "super_admin")) {
    return { error: "Only practice administrators can invite team members." };
  }

  // Use service role client to invite via Supabase Auth admin API
  const serviceClient = createServiceClient();
  const { error: inviteError } = await serviceClient.auth.admin.inviteUserByEmail(
    input.email,
    {
      data: {
        role: input.role,
        practice_id: profile.practice_id,
        invited_by: user.id,
      },
    }
  );

  if (inviteError) {
    if (inviteError.message.includes("already registered")) {
      return { error: "This email is already registered." };
    }
    return { error: "Failed to send invitation. Please try again." };
  }

  return {};
}

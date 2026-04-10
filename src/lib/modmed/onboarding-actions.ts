"use server";

import { createClient } from "@/lib/supabase/server";
import { encryptPHI } from "@/lib/crypto/phi";

interface ConnectModMedInput {
  firmPrefix: string;
  username: string;
  password: string;
  apiKey: string;
}

export async function connectModMed(
  input: ConnectModMedInput
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be logged in to connect ModMed." };
  }

  // Get user's practice
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("practice_id, role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { error: "User profile not found. Please contact support." };
  }

  if (profile.role !== "practice_admin" && profile.role !== "super_admin") {
    return {
      error: "Only practice administrators can connect a practice management system.",
    };
  }

  // Encrypt credentials before storing
  const encryptedCredentials = encryptPHI(
    JSON.stringify({
      username: input.username,
      password: input.password,
      apiKey: input.apiKey,
    })
  );

  const { error: updateError } = await supabase
    .from("practices")
    .update({
      modmed_url_prefix: input.firmPrefix,
      modmed_credentials: encryptedCredentials,
    })
    .eq("id", profile.practice_id);

  if (updateError) {
    return {
      error:
        "Failed to save credentials. Please try again or contact support.",
    };
  }

  return {};
}

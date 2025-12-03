"use server";

import { getSupabaseServerApp } from "@/server/db/supabase";
import { getUserIdAndOrgId } from "@/server/auth/getUser";
import { revalidatePath } from "next/cache";

export async function updateProfileAction(formData: FormData) {
  const fullName = formData.get("fullName") as string;

  if (!fullName || fullName.trim().length === 0) {
    return { error: "Name is required" };
  }

  const supabase = await getSupabaseServerApp();
  const { userId } = await getUserIdAndOrgId();

  if (!userId) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName.trim() })
    .eq("id", userId);

  if (error) {
    console.error("Error updating profile:", error);
    return { error: "Failed to update profile" };
  }

  revalidatePath("/account");
  return { success: true };
}

export async function changePasswordAction(formData: FormData) {
  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!newPassword || newPassword.length < 8) {
    return { error: "New password must be at least 8 characters" };
  }

  if (newPassword !== confirmPassword) {
    return { error: "Passwords do not match" };
  }

  const supabase = await getSupabaseServerApp();

  // Verify current password by attempting to sign in
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return { error: "Not authenticated" };
  }

  // Try to sign in with current password to verify it
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (signInError) {
    return { error: "Current password is incorrect" };
  }

  // Update the password
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    console.error("Error changing password:", error);
    return { error: "Failed to change password" };
  }

  return { success: true };
}

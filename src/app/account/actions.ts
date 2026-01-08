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

export async function updateCompanyProfileAction(formData: FormData) {
  const orgId = formData.get("orgId") as string;
  const name = formData.get("name") as string;
  const countryCode = formData.get("countryCode") as string;
  const logoUrl = formData.get("logoUrl") as string;
  const email = formData.get("email") as string;
  const phone = formData.get("phone") as string;
  const website = formData.get("website") as string;
  const address = formData.get("address") as string;
  
  // Business details
  const vatNumber = formData.get("vatNumber") as string;
  const companyRegNumber = formData.get("companyRegNumber") as string;
  const bankName = formData.get("bankName") as string;
  const bankIban = formData.get("bankIban") as string;
  const bankBic = formData.get("bankBic") as string;
  const defaultPaymentTerms = formData.get("defaultPaymentTerms") as string;
  const invoicePrefix = formData.get("invoicePrefix") as string;
  const invoiceFooterText = formData.get("invoiceFooterText") as string;
  
  // Location for weather integration
  const latitudeStr = formData.get("latitude") as string;
  const longitudeStr = formData.get("longitude") as string;
  const latitude = latitudeStr ? parseFloat(latitudeStr) : null;
  const longitude = longitudeStr ? parseFloat(longitudeStr) : null;

  if (!orgId) {
    return { error: "Organization ID is required" };
  }

  if (!name || name.trim().length === 0) {
    return { error: "Company name is required" };
  }

  const supabase = await getSupabaseServerApp();
  const { userId, orgId: userOrgId } = await getUserIdAndOrgId();

  if (!userId) {
    return { error: "Not authenticated" };
  }

  // Verify user belongs to this org and has admin/owner role
  if (userOrgId !== orgId) {
    return { error: "You do not have permission to edit this organization" };
  }

  const { data: membership } = await supabase
    .from("org_memberships")
    .select("role")
    .eq("org_id", orgId)
    .eq("user_id", userId)
    .single();

  if (!membership || (membership.role !== "admin" && membership.role !== "owner")) {
    return { error: "You must be an admin or owner to edit company settings" };
  }

  // Update organization
  const { error } = await supabase
    .from("organizations")
    .update({
      name: name.trim(),
      country_code: countryCode || "IE",
      logo_url: logoUrl || null,
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      website: website?.trim() || null,
      address: address?.trim() || null,
      // Business details
      vat_number: vatNumber?.trim() || null,
      company_reg_number: companyRegNumber?.trim() || null,
      bank_name: bankName?.trim() || null,
      bank_iban: bankIban?.trim() || null,
      bank_bic: bankBic?.trim() || null,
      default_payment_terms: defaultPaymentTerms ? parseInt(defaultPaymentTerms, 10) : 30,
      invoice_prefix: invoicePrefix?.trim() || "INV",
      invoice_footer_text: invoiceFooterText?.trim() || null,
      // Location for weather integration
      latitude: latitude && !isNaN(latitude) ? latitude : null,
      longitude: longitude && !isNaN(longitude) ? longitude : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orgId);

  if (error) {
    console.error("Error updating company profile:", error);
    return { error: "Failed to update company profile" };
  }

  revalidatePath("/account");
  revalidatePath("/"); // Revalidate home page too since company name may be displayed there
  return { success: true };
}

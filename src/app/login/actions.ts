"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logInfo, logError } from "@/lib/log";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

// Login action intentionally does not check auth - unauthenticated users need to call this
// to authenticate. Auth checks happen on protected pages/actions after login succeeds.
export async function login(formData: FormData) {
  const rawEmail = formData.get("email");
  const rawPassword = formData.get("password");

  // Validate input before sending to Supabase
  const validation = loginSchema.safeParse({
    email: rawEmail,
    password: rawPassword,
  });

  if (!validation.success) {
    const firstError = validation.error.errors[0]?.message ?? "Invalid input";
    return { error: firstError };
  }

  const { email, password } = validation.data;
  const supabase = await createClient();

  logInfo("Login attempt", { email });
  const { error, data } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    logError("Login failed", { error: error.message, email });
    return { error: error.message };
  }

  logInfo("Login successful", { email, hasSession: !!data.session });
  redirect("/");
}


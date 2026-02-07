"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

// Worker login action intentionally does not check auth - unauthenticated workers need to call this
// to authenticate. Auth checks happen on protected worker pages/actions after login succeeds.
export async function workerLogin(formData: FormData) {
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

  const { error, data } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Generic error message to avoid leaking info
    return { error: "Invalid email or password" };
  }

  if (!data.session) {
    return { error: "Login failed. Please try again." };
  }

  // Redirect to worker app home
  redirect("/worker");
}

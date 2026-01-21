"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

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

  console.log("Login action started for", email);
  const { error, data } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("Login failed:", error.message);
    return { error: error.message };
  }

  console.log("Login successful, session created?", !!data.session);
  redirect("/");
}


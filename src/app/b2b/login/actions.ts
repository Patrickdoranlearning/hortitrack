'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export async function loginCustomer(formData: FormData) {
  const supabase = await createClient();

  const rawEmail = formData.get('email');
  const rawPassword = formData.get('password');

  // Validate input before sending to Supabase
  const validation = loginSchema.safeParse({
    email: rawEmail,
    password: rawPassword,
  });

  if (!validation.success) {
    const firstError = validation.error.errors[0]?.message ?? 'Invalid input';
    return { error: firstError };
  }

  const { email, password } = validation.data;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.user) {
    return { error: 'Login failed' };
  }

  // Verify user has customer portal access
  const { data: profile } = await supabase
    .from('profiles')
    .select('portal_role, customer_id')
    .eq('id', data.user.id)
    .single();

  if (!profile) {
    await supabase.auth.signOut();
    return { error: 'Access denied. No profile found.' };
  }

  // Allow both customer portal users and internal staff (for impersonation)
  if (profile.portal_role !== 'customer' && profile.portal_role !== 'internal') {
    await supabase.auth.signOut();
    return { error: 'Access denied. This login is for customers only.' };
  }

  // If customer user, must have customer_id
  if (profile.portal_role === 'customer' && !profile.customer_id) {
    await supabase.auth.signOut();
    return { error: 'Access denied. Customer account not linked.' };
  }

  // If internal staff, redirect to impersonation page
  if (profile.portal_role === 'internal') {
    redirect('/b2b/impersonate');
  }

  // Customer user - redirect to dashboard
  redirect('/b2b/dashboard');
}

export async function logoutCustomer() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/b2b/login');
}

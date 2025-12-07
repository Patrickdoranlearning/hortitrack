'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function loginCustomer(formData: FormData) {
  const supabase = await createClient();

  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  if (!email || !password) {
    return { error: 'Email and password are required' };
  }

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

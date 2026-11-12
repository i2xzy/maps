'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { createClient } from '@supabase/server';

const emailSchema = z.email();

export async function signInWithOtp(email: string) {
  const parsed = emailSchema.parse(email);
  const h = await headers();
  const proto = h.get('x-forwarded-proto') ?? 'http';
  const host = h.get('host') ?? '';
  const origin = `${proto}://${host}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) throw new Error(error.message);
}

export async function signOut() {
  const supabase = await createClient();
  // Don't redirect to the sign-in page on failure: signOut can leave the session
  // stored, so a "signed out" redirect would hide that /admin is still reachable.
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
  redirect('/sign-in');
}

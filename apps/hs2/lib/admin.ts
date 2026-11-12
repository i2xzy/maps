// The admin gate. Server-only: createClient reads cookies, so importing this
// from a Client Component throws. (The `server-only` package isn't resolvable in
// this workspace, so that cookie dependency is the guard.) RLS enforces the same
// role in the database; this is the app-code mirror that routes the UI.

import { redirect } from 'next/navigation';
import { createClient, type Client, type User } from '@supabase/server';

export async function requireAdmin(): Promise<{ supabase: Client; user: User }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== 'admin') redirect('/sign-in');
  return { supabase, user };
}

export async function getAdminUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.app_metadata?.role !== 'admin') return null;
  return user;
}

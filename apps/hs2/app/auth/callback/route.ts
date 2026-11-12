import { NextResponse, type NextRequest } from 'next/server';

import { createClient } from '@supabase/server';

// Magic-link lands here with a one-time code. Exchange it for a session cookie,
// then send the admin into the wizard; any failure falls back to sign-in.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/admin`);
  }

  return NextResponse.redirect(`${origin}/sign-in`);
}

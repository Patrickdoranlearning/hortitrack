import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createSupabaseServerWithCookies, type CookieBridge } from '@/server/db/supabaseServerApp';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = cookies();
    const cookieBridge: CookieBridge = {
      get: (name) => cookieStore.get(name)?.value,
      set: (name, value, options) => cookieStore.set(name, value, options),
      remove: (name, options) => cookieStore.set(name, "", { ...options, maxAge: 0 }),
    };
    const supabase = createSupabaseServerWithCookies(cookieBridge);
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}

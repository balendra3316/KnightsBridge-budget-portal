import { createClient } from '@/lib/supabase/server'
import { NextResponse, type NextRequest } from 'next/server'

// Google (and any other OAuth provider) redirects the browser back here with a
// short-lived `code`. We exchange it for a real Supabase session (cookies set by
// @supabase/ssr), then gate: the user is only allowed in if they already have a
// profile row — i.e. they were pre-seeded. Unknown Google accounts get signed
// out and bounced back to /login. (Belt-and-suspenders: Supabase itself should
// also have "Allow new users to sign up" turned OFF — see migration 011.)
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const oauthError = searchParams.get('error_description') ?? searchParams.get('error')

  if (oauthError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(oauthError)}`
    )
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const supabase = await createClient()

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
  if (exchangeError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(exchangeError.message)}`
    )
  }

  // Confirm this account is one of ours. A user can always read their own
  // profile row (RLS: id = auth.uid()); no row means they aren't pre-seeded.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user?.id ?? '')
    .maybeSingle()

  if (!profile) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=not_authorized`)
  }

  return NextResponse.redirect(`${origin}/`)
}

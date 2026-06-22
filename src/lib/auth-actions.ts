'use server'

import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

// Sign in with Supabase Auth. On success, @supabase/ssr writes the session
// (access + refresh token) into cookies; the proxy keeps it refreshed so the
// user stays logged in long-term without re-entering credentials.
export async function login(
  email: string,
  password: string
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }

  redirect('/')
}

// Start the Google OAuth flow. We don't take a password — Google proves the
// person owns the email, then the /auth/callback route checks that email is one
// of our pre-seeded users (see ensureProfile there). Supabase auto-links the
// Google identity to the existing seeded auth user (same confirmed email), so
// their role in public.profiles is preserved.
export async function loginWithGoogle(): Promise<{ error?: string }> {
  const supabase = await createClient()

  // Build an absolute callback URL from the incoming request's origin so this
  // works in dev and prod without hard-coding the host.
  const hdrs = await headers()
  const origin =
    hdrs.get('origin') ??
    (hdrs.get('host') ? `https://${hdrs.get('host')}` : '')

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${origin}/auth/callback` },
  })
  if (error) return { error: error.message }

  // signInWithOAuth returns the Google consent URL; send the browser there.
  if (data?.url) redirect(data.url)
  return { error: 'Could not start Google sign-in.' }
}

export async function logout(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

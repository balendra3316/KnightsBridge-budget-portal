'use server'

import { createClient } from '@/lib/supabase/server'
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

export async function logout(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

import { createClient } from '@/lib/supabase/server'

export type Role = 'creator' | 'approver' | 'admin'

export type SessionUser = {
  id: string
  email: string
  name: string
  role: Role
}

// Returns the signed-in user with their role, or null if not authenticated.
// Uses getUser() (not getSession()) so the JWT is verified against the Auth
// server rather than trusted from the cookie.
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .single()

  return {
    id: user.id,
    email: user.email ?? '',
    name: profile?.name ?? user.email?.split('@')[0] ?? 'User',
    // New users default to 'creator' until promoted in SQL.
    role: (profile?.role as Role) ?? 'creator',
  }
}

// Role helpers — single source of truth for "who may do what".
export const canApprove = (role: Role) => role === 'approver' || role === 'admin'
export const canCreate = (role: Role) => role === 'creator' || role === 'admin'
// Both creator and approver push approved invoices to QuickBooks.
export const canSendToQuickbooks = (role: Role) =>
  role === 'creator' || role === 'approver' || role === 'admin'
// Managing clients (add now; edit/delete later) is admin-only.
export const canManageClients = (role: Role) => role === 'admin'

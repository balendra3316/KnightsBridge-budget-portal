'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getSessionUser, canManageClients } from '@/lib/auth'

// Shape the Add Client form sends. Only `name` is required; everything else is
// optional metadata that shows up in the Budget Entry grid + filters.
export type NewClientInput = {
  name: string
  project_name?: string
  parent_group?: string
  region?: string
  team?: string
  commission_rate?: number   // stored as a percent (15, 12.5, 10, 0)
  billing_pattern?: string    // 'A' | 'B' | 'C'
}

// Admin-only: create a new client. Edit/delete will follow later — for now this
// is the single mutation. Guarded twice: the role check here (Layer A) and the
// `clients` RLS policy at the DB (Layer B, authenticated-only). See AUTH.md.
export async function addClient(
  input: NewClientInput
): Promise<{ error?: string }> {
  const user = await getSessionUser()
  if (!user) return { error: 'Not signed in' }
  if (!canManageClients(user.role)) return { error: 'Only admins can add clients' }

  const name = input.name?.trim()
  if (!name) return { error: 'Client name is required' }

  const supabase = await createClient()

  // Append to the end of the list, like addService does for client_services.
  const { data: maxSort } = await supabase
    .from('clients')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextSort = (maxSort?.sort_order ?? 0) + 1

  // Provide the id explicitly so this works whether or not the column has a
  // gen_random_uuid() default (the table was created outside migrations).
  const { error } = await supabase.from('clients').insert({
    id: crypto.randomUUID(),
    name,
    project_name: input.project_name?.trim() || null,
    parent_group: input.parent_group?.trim() || null,
    region: input.region?.trim() || null,
    team: input.team?.trim() || null,
    commission_rate: Number(input.commission_rate) || 0,
    billing_pattern: input.billing_pattern?.trim() || null,
    sort_order: nextSort,
  })

  if (error) return { error: error.message }

  // The Budget Entry grid and this page both read the clients list.
  revalidatePath('/')
  revalidatePath('/clients')
  return {}
}

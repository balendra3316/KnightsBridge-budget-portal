'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getSessionUser, canApprove } from '@/lib/auth'

export async function approveInvoice(invoiceId: string): Promise<{ error?: string }> {
  const user = await getSessionUser()
  if (!user) return { error: 'Not signed in' }
  if (!canApprove(user.role)) return { error: 'Only approvers can approve invoices' }

  const supabase = await createClient()

  const { error } = await supabase
    .from('invoices')
    .update({ status: 'approved' })
    .eq('id', invoiceId)

  if (error) return { error: error.message }

  revalidatePath('/admin')
  revalidatePath('/invoices')
  revalidatePath('/')
  return {}
}

export async function rejectInvoice(
  invoiceId: string,
  note: string
): Promise<{ error?: string }> {
  const user = await getSessionUser()
  if (!user) return { error: 'Not signed in' }
  if (!canApprove(user.role)) return { error: 'Only approvers can reject invoices' }

  const supabase = await createClient()

  const { error } = await supabase
    .from('invoices')
    .update({ status: 'rejected', approver_note: note || 'Rejected by approver' })
    .eq('id', invoiceId)

  if (error) return { error: error.message }

  revalidatePath('/admin')
  revalidatePath('/invoices')
  revalidatePath('/')
  return {}
}

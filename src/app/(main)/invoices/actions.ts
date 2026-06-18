'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getSessionUser, canApprove, canCreate, canSendToQuickbooks } from '@/lib/auth'

// NOTE: invoices are created from the Budget Entry grid (see budget/actions.ts
// `createDraftFromBudget`), which applies the card/commission rules. The old
// standalone "New Invoice" form was removed, so there's no manual createInvoice
// here anymore — only status changes and the QuickBooks push live below.

export async function updateInvoiceStatus(
  id: string,
  status: 'draft' | 'review' | 'approved' | 'rejected'
): Promise<{ error?: string }> {
  const user = await getSessionUser()
  if (!user) return { error: 'Not signed in' }

  // Approving or rejecting is approver-only. Everything else (submit for review,
  // reset to draft) is a creator action.
  if (status === 'approved' || status === 'rejected') {
    if (!canApprove(user.role)) return { error: 'Only approvers can approve or reject' }
  } else if (!canCreate(user.role)) {
    return { error: 'Only creators can submit invoices' }
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('invoices')
    .update({ status })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/invoices')
  return {}
}

// Pushes an approved invoice to QuickBooks, then marks it as 'sent'.
// Only valid for invoices that have already been approved.
export async function createQuickbooksInvoice(
  id: string
): Promise<{ error?: string }> {
  const user = await getSessionUser()
  if (!user) return { error: 'Not signed in' }
  if (!canSendToQuickbooks(user.role)) {
    return { error: 'Not allowed to send to QuickBooks' }
  }

  const supabase = await createClient()

  // Guard: only approved invoices may be sent to QuickBooks.
  const { data: invoice, error: fetchError } = await supabase
    .from('invoices')
    .select('status')
    .eq('id', id)
    .single()

  if (fetchError) return { error: fetchError.message }
  if (invoice?.status !== 'approved') {
    return { error: 'Only approved invoices can be sent to QuickBooks.' }
  }

  // TODO: Real QuickBooks API call goes here (create invoice via QBO SDK).
  // For now this is a static/mock step — on success we flip the status to 'sent'.

  const { error } = await supabase
    .from('invoices')
    .update({ status: 'sent' })
    .eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/invoices')
  return {}
}

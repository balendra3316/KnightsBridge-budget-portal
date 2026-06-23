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

  // Guard: only approved invoices may be sent to QuickBooks. Pull the full row so
  // we can hand the invoice data to n8n.
  const { data: invoice, error: fetchError } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError) return { error: fetchError.message }
  if (invoice?.status !== 'approved') {
    return { error: 'Only approved invoices can be sent to QuickBooks.' }
  }

  // Flip the status to 'sent' on click, then notify n8n. n8n re-reads the row,
  // creates the invoice in QuickBooks, and writes back qbo_invoice_id.
  const { error } = await supabase
    .from('invoices')
    .update({ status: 'sent' })
    .eq('id', id)

  if (error) return { error: error.message }

  // ---------------------------------------------------------------------------
  // n8n webhook DISABLED per manager request. Clicking "Send to QuickBooks" now
  // only flips the status to 'sent' (done above) and does NOT notify n8n.
  // To re-enable the QuickBooks push, simply uncomment the block below.
  // ---------------------------------------------------------------------------
  /*
  // Fire the n8n webhook with the invoice data. This whole block is best-effort:
  // anything that goes wrong (no URL, network down, n8n offline, slow/hanging
  // request, non-2xx response) is swallowed and logged — it must NEVER throw or
  // surface an error to the user. The status is already 'sent', and n8n will
  // create the QuickBooks invoice and write back qbo_invoice_id when it runs.
  const webhookUrl = process.env.N8N_QBO_WEBHOOK_URL
  if (webhookUrl) {
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': process.env.N8N_WEBHOOK_SECRET ?? '',
        },
        body: JSON.stringify({ invoice_id: id, invoice }),
        // Don't let a hanging n8n freeze the click — bail after 8s.
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) {
        console.error(`n8n webhook returned ${res.status} for invoice ${id}`)
      }
    } catch (e) {
      // Network error, timeout/abort, bad URL — log and move on, never crash.
      console.error('n8n webhook call failed:', e)
    }
  }
  */

  revalidatePath('/invoices')
  return {}
}

'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type CreateInvoiceInput = {
  client_name: string
  billing_month: string
  pm_name: string
  commission_rate: number
  billing_pattern: string
  fee_amount: number
  ad_spend_amount: number
  commission_amount: number
  invoice_total: number
  memo: string
}

export async function createInvoice(data: CreateInvoiceInput): Promise<{ error?: string }> {
  const supabase = await createClient()

  // Generate next KB invoice number
  const { count } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })

  const invoiceNumber = `KB${String(61000 + (count ?? 0) + 1)}`

  const { error } = await supabase.from('invoices').insert({
    ...data,
    invoice_number: invoiceNumber,
    status: 'draft',
  })

  if (error) return { error: error.message }

  revalidatePath('/invoices')
  return {}
}

export async function updateInvoiceStatus(
  id: string,
  status: 'draft' | 'review' | 'approved' | 'rejected'
): Promise<{ error?: string }> {
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

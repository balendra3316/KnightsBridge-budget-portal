'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveBudgetEntries(
  clientId: string,
  billingMonth: string,
  entries: { service_id: string; amount: number }[]
): Promise<{ error?: string }> {
  const supabase = await createClient()

  for (const entry of entries) {
    const { error } = await supabase
      .from('budget_entries')
      .upsert(
        {
          client_id: clientId,
          service_id: entry.service_id,
          billing_month: billingMonth,
          amount: entry.amount,
        },
        { onConflict: 'service_id,billing_month' }
      )
    if (error) return { error: error.message }
  }

  revalidatePath('/')
  return {}
}

export async function createDraftFromBudget(
  clientId: string,
  billingMonth: string
): Promise<{ error?: string }> {
  const supabase = await createClient()

  // Fetch client info
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single()
  if (clientErr || !client) return { error: clientErr?.message ?? 'Client not found' }

  // Fetch budget entries for this month
  const { data: entries } = await supabase
    .from('budget_entries')
    .select('amount, service_id, client_services(service_type, credit_card)')
    .eq('client_id', clientId)
    .eq('billing_month', billingMonth)

  if (!entries || entries.length === 0) return { error: 'No budget entries for this month' }

  let feeAmount = 0
  let adSpendAmount = 0

  for (const e of entries) {
    const svc = e.client_services as unknown as { service_type: string; credit_card: string } | null
    if (svc?.service_type === 'ad') {
      adSpendAmount += Number(e.amount) || 0
    } else {
      feeAmount += Number(e.amount) || 0
    }
  }

  const commissionRate = Number(client.commission_rate) || 0
  const commissionAmount = adSpendAmount * (commissionRate / 100)
  const invoiceTotal = feeAmount + adSpendAmount + commissionAmount

  // Generate invoice number
  const { count } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
  const invoiceNumber = `KB${String(61500 + (count ?? 0) + 1)}`

  const { error } = await supabase.from('invoices').insert({
    invoice_number: invoiceNumber,
    client_id: clientId,
    client_name: client.project_name
      ? `${client.name} / ${client.project_name}`
      : client.name,
    billing_month: billingMonth,
    pm_name: client.team,
    commission_rate: commissionRate,
    billing_pattern: client.billing_pattern,
    fee_amount: feeAmount,
    ad_spend_amount: adSpendAmount,
    commission_amount: commissionAmount,
    invoice_total: invoiceTotal,
    status: 'draft',
  })

  if (error) return { error: error.message }

  revalidatePath('/')
  revalidatePath('/invoices')
  return {}
}

export async function sendForReview(
  clientId: string,
  billingMonth: string
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, status')
    .eq('client_id', clientId)
    .eq('billing_month', billingMonth)
    .eq('status', 'draft')
    .single()

  if (!invoice) return { error: 'No draft invoice found for this month' }

  const { error } = await supabase
    .from('invoices')
    .update({ status: 'review' })
    .eq('id', invoice.id)

  if (error) return { error: error.message }

  revalidatePath('/')
  revalidatePath('/invoices')
  return {}
}

'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { computeInvoice, type Pattern } from '@/lib/commission'

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
  billingMonth: string,
  pattern: Pattern,
  rate: number
): Promise<{ error?: string }> {
  const supabase = await createClient()

  // Fetch client info
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .select('*')
    .eq('id', clientId)
    .single()
  if (clientErr || !client) return { error: clientErr?.message ?? 'Client not found' }

  // Fetch budget entries for this month, with the service metadata the engine needs.
  const { data: entries } = await supabase
    .from('budget_entries')
    .select('amount, service_id, client_services(service_type, credit_card, parent_service_id)')
    .eq('client_id', clientId)
    .eq('billing_month', billingMonth)

  if (!entries || entries.length === 0) return { error: 'No budget entries for this month' }

  // Apply the commission rules in code (sub-lines are skipped inside computeInvoice).
  const lines = entries.map(e => {
    const svc = e.client_services as unknown as
      { service_type: string; credit_card: string; parent_service_id: string | null } | null
    return {
      service_type: svc?.service_type ?? 'fee',
      credit_card: svc?.credit_card ?? 'na',
      parent_service_id: svc?.parent_service_id ?? null,
      amount: Number(e.amount) || 0,
    }
  })

  const calc = computeInvoice(lines, pattern, rate)

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
    commission_rate: rate * 100,
    billing_pattern: pattern,
    fee_amount: calc.feeLines,
    ad_spend_amount: calc.clientCardAd + calc.kbCardAd,
    commission_amount: calc.commission,
    invoice_total: calc.invoiceTotal,
    monthly_total: calc.monthlyTotal,
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

  // A draft invoice goes out for the first time; a rejected one is being resubmitted.
  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, status')
    .eq('client_id', clientId)
    .eq('billing_month', billingMonth)
    .in('status', ['draft', 'rejected'])
    .single()

  if (!invoice) return { error: 'No draft or rejected invoice found for this month' }

  const { error } = await supabase
    .from('invoices')
    .update({ status: 'review' })
    .eq('id', invoice.id)

  if (error) return { error: error.message }

  revalidatePath('/')
  revalidatePath('/invoices')
  return {}
}

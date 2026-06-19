'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { computeInvoice, billingLabel, buildLineItems } from '@/lib/commission'
import { getSessionUser, canCreate } from '@/lib/auth'

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
  rate: number
): Promise<{ error?: string }> {
  const user = await getSessionUser()
  if (!user) return { error: 'Not signed in' }
  if (!canCreate(user.role)) return { error: 'Only creators can create invoices' }

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
    .select('amount, service_id, client_services(service_name, service_type, credit_card, parent_service_id)')
    .eq('client_id', clientId)
    .eq('billing_month', billingMonth)

  if (!entries || entries.length === 0) return { error: 'No budget entries for this month' }

  // Apply the commission rules in code (sub-lines are skipped inside computeInvoice).
  const lines = entries.map(e => {
    const svc = e.client_services as unknown as
      { service_name: string; service_type: string; credit_card: string; parent_service_id: string | null } | null
    return {
      id: e.service_id,
      service_name: svc?.service_name ?? 'Service',
      service_type: svc?.service_type ?? 'fee',
      credit_card: svc?.credit_card ?? '',
      parent_service_id: svc?.parent_service_id ?? null,
      amount: Number(e.amount) || 0,
    }
  })

  const calc = computeInvoice(lines, rate)
  // Freeze the printable rows now (client-card spend excluded; kb-card spend shown
  // in full; commission on both collected into the single Commission row).
  const lineItems = buildLineItems(lines, rate)

  // Persist the chosen rate so the client's stored commission_rate stays in sync
  // with what the creator picked in the dropdown (otherwise the grid would revert
  // to the old DB value on the next load, and future drafts would use it).
  if ((Number(client.commission_rate) || 0) !== rate * 100) {
    await supabase.from('clients').update({ commission_rate: rate * 100 }).eq('id', clientId)
  }

  // The computed fields, shared by both the insert (new month) and update (re-saving an
  // existing draft) paths.
  const fields = {
    client_name: client.project_name
      ? `${client.name} / ${client.project_name}`
      : client.name,
    pm_name: client.team,
    commission_rate: rate * 100,
    billing_pattern: billingLabel(calc.clientCardAd, calc.kbCardAd),
    fee_amount: calc.feeLines,
    ad_spend_amount: calc.clientCardAd + calc.kbCardAd,
    commission_amount: calc.commission,
    invoice_total: calc.invoiceTotal,
    monthly_total: calc.monthlyTotal,
    line_items: lineItems,
  }

  // If a draft/rejected invoice already exists for this month, recompute it IN PLACE so
  // edits (added/removed services, changed amounts or rate) flow into its totals and
  // line_items. A submitted (review/approved/sent) invoice is frozen and cannot change.
  const { data: existing } = await supabase
    .from('invoices')
    .select('id, status')
    .eq('client_id', clientId)
    .eq('billing_month', billingMonth)
    .maybeSingle()

  if (existing) {
    if (existing.status !== 'draft' && existing.status !== 'rejected') {
      return { error: 'This month is already submitted and can no longer be edited' }
    }
    const { error } = await supabase.from('invoices').update(fields).eq('id', existing.id)
    if (error) return { error: error.message }
  } else {
    // Generate invoice number for a brand-new draft.
    const { count } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
    const invoiceNumber = `KB${String(61500 + (count ?? 0) + 1)}`

    const { error } = await supabase.from('invoices').insert({
      invoice_number: invoiceNumber,
      client_id: clientId,
      billing_month: billingMonth,
      status: 'draft',
      ...fields,
    })
    if (error) return { error: error.message }
  }

  revalidatePath('/')
  revalidatePath('/invoices')
  return {}
}

export async function addService(
  clientId: string,
  serviceName: string,
  creditCard: string
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: maxSort } = await supabase
    .from('client_services')
    .select('sort_order')
    .eq('client_id', clientId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  const nextSort = (maxSort?.sort_order ?? 0) + 1

  // The card decides whether this is ad spend. service_type is kept only for the
  // row's colour dot / legacy reads — the invoice math is purely card-driven now.
  const serviceType = creditCard ? 'ad' : 'fee'

  const { error } = await supabase.from('client_services').insert({
    client_id: clientId,
    service_name: serviceName,
    service_type: serviceType,
    credit_card: creditCard,
    parent_service_id: null,
    sort_order: nextSort,
  })

  if (error) return { error: error.message }
  revalidatePath('/')
  return {}
}

export async function addSubService(
  clientId: string,
  parentServiceId: string,
  serviceName: string
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: maxSort } = await supabase
    .from('client_services')
    .select('sort_order')
    .eq('client_id', clientId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  const nextSort = (maxSort?.sort_order ?? 0) + 1

  const { error } = await supabase.from('client_services').insert({
    client_id: clientId,
    service_name: serviceName,
    service_type: 'fee',
    credit_card: '',
    parent_service_id: parentServiceId,
    sort_order: nextSort,
  })

  if (error) return { error: error.message }
  revalidatePath('/')
  return {}
}

export async function deleteService(
  serviceId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()

  // Edit-window enforcement is per selected month and handled in the UI (you can only
  // delete while a draft / unsubmitted month is active). Finalized invoices are stored
  // as immutable snapshots, so removing a service never changes an existing invoice.

  // Collect this service plus any sub-services it owns.
  const { data: children } = await supabase
    .from('client_services')
    .select('id')
    .eq('parent_service_id', serviceId)

  const ids = [serviceId, ...(children ?? []).map(c => c.id)]

  // Delete in order (no ON DELETE CASCADE assumption): entries first, then the rows.
  const { error: entriesErr } = await supabase
    .from('budget_entries')
    .delete()
    .in('service_id', ids)
  if (entriesErr) return { error: entriesErr.message }

  const { error: svcErr } = await supabase
    .from('client_services')
    .delete()
    .in('id', ids)
  if (svcErr) return { error: svcErr.message }

  revalidatePath('/')
  return {}
}

export async function sendForReview(
  clientId: string,
  billingMonth: string
): Promise<{ error?: string }> {
  const user = await getSessionUser()
  if (!user) return { error: 'Not signed in' }
  if (!canCreate(user.role)) return { error: 'Only creators can submit invoices' }

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

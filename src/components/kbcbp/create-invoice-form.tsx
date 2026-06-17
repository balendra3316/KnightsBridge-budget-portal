'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createInvoice } from '@/app/invoices/actions'

const inputCls = "w-full px-3 py-2 rounded-[7px] border border-kb-border bg-kb-surface text-[13px] text-kb-fg font-sans outline-none transition-colors duration-150"
const labelCls = "block text-[11px] font-semibold text-kb-fg-2 uppercase tracking-wider mb-1"
const sectionCls = "text-[11px] font-semibold text-kb-fg-3 uppercase tracking-wider py-3 pb-2 border-b border-kb-border mb-4"

const BILLING_MONTHS = [
  'JAN 2026','FEB 2026','MAR 2026','APR 2026','MAY 2026','JUN 2026',
  'JUL 2026','AUG 2026','SEP 2026','OCT 2026','NOV 2026','DEC 2026',
]

const BILLING_PATTERNS = [
  { value: 'standard',           label: 'Standard — monthly invoice' },
  { value: 'split-invoices',     label: 'Split invoices — mgmt fees + ad budgets separate' },
  { value: 'pre-bill-quarterly', label: 'Pre-bill quarterly' },
]

export default function CreateInvoiceForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    client_name: '',
    billing_month: 'APR 2026',
    pm_name: '',
    commission_rate: 0,
    billing_pattern: 'standard',
    fee_amount: 0,
    ad_spend_amount: 0,
    memo: '',
  })

  const commissionAmount = (form.ad_spend_amount * form.commission_rate) / 100
  const invoiceTotal = form.fee_amount + commissionAmount

  const set = (field: string, value: string | number) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.client_name.trim()) { setError('Client name is required'); return }
    if (!form.billing_month.trim()) { setError('Billing month is required'); return }

    setError(null)
    startTransition(async () => {
      const result = await createInvoice({
        ...form,
        commission_amount: commissionAmount,
        invoice_total: invoiceTotal,
      })
      if (result.error) {
        setError(result.error)
      } else {
        router.push('/invoices')
        router.refresh()
      }
    })
  }

  const fmt = (n: number) =>
    '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  return (
    <form onSubmit={handleSubmit}>
      {/* Client info */}
      <div className={sectionCls}>Client Details</div>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className={labelCls}>Client Name *</label>
          <input
            className={inputCls} required
            value={form.client_name}
            onChange={e => set('client_name', e.target.value)}
            placeholder="e.g. One Wall Street"
          />
        </div>
        <div>
          <label className={labelCls}>Billing Month *</label>
          <select
            className={inputCls}
            value={form.billing_month}
            onChange={e => set('billing_month', e.target.value)}
          >
            {BILLING_MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>PM / Account Manager</label>
          <input
            className={inputCls}
            value={form.pm_name}
            onChange={e => set('pm_name', e.target.value)}
            placeholder="e.g. Jordan"
          />
        </div>
        <div>
          <label className={labelCls}>Billing Pattern</label>
          <select
            className={inputCls}
            value={form.billing_pattern}
            onChange={e => set('billing_pattern', e.target.value)}
          >
            {BILLING_PATTERNS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {/* Amounts */}
      <div className={sectionCls}>Budget & Commission</div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div>
          <label className={labelCls}>Management Fee ($)</label>
          <input
            className={inputCls} type="number" min={0} step={0.01}
            value={form.fee_amount || ''}
            onChange={e => set('fee_amount', parseFloat(e.target.value) || 0)}
            placeholder="0"
          />
        </div>
        <div>
          <label className={labelCls}>Ad Spend ($)</label>
          <input
            className={inputCls} type="number" min={0} step={0.01}
            value={form.ad_spend_amount || ''}
            onChange={e => set('ad_spend_amount', parseFloat(e.target.value) || 0)}
            placeholder="0"
          />
        </div>
        <div>
          <label className={labelCls}>Commission Rate (%)</label>
          <input
            className={inputCls} type="number" min={0} max={100} step={0.5}
            value={form.commission_rate || ''}
            onChange={e => set('commission_rate', parseFloat(e.target.value) || 0)}
            placeholder="0"
          />
        </div>
      </div>

      {/* Calculated summary */}
      <div className="flex gap-6 px-5 py-3.5 mb-6 bg-kb-surface-alt rounded-lg border border-kb-border text-[13px] items-center">
        <div>
          <span className="block text-[11px] text-kb-fg-3 mb-0.5">Mgmt Fee</span>
          <span className="font-mono font-semibold">{fmt(form.fee_amount)}</span>
        </div>
        <span className="text-kb-border-strong text-lg">+</span>
        <div>
          <span className="block text-[11px] text-kb-fg-3 mb-0.5">
            Commission ({form.commission_rate}% of ad spend)
          </span>
          <span className="font-mono font-semibold text-kb-green">
            {fmt(commissionAmount)}
          </span>
        </div>
        <span className="text-kb-border-strong text-lg">=</span>
        <div>
          <span className="block text-[11px] text-kb-fg-3 mb-0.5">Invoice Total</span>
          <span className="font-mono font-bold text-base text-kb-accent-text">
            {fmt(invoiceTotal)}
          </span>
        </div>
      </div>

      {/* Memo */}
      <div className={sectionCls}>Notes</div>
      <div className="mb-7">
        <label className={labelCls}>Memo / Notes</label>
        <textarea
          className={`${inputCls} min-h-[72px] resize-y`}
          value={form.memo}
          onChange={e => set('memo', e.target.value)}
          placeholder="Any special billing notes for this invoice…"
        />
      </div>

      {error && (
        <div className="px-3.5 py-2.5 rounded-md mb-4 bg-kb-red-light text-kb-red text-[13px]">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2.5 justify-end">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={isPending}
          className="px-4.5 py-2 rounded-[7px] border border-kb-border bg-kb-surface text-kb-fg-2 text-[13px] font-medium cursor-pointer font-sans"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className={`px-5 py-2 rounded-[7px] border-none text-white text-[13px] font-semibold font-sans transition-colors duration-150 ${isPending ? 'bg-kb-fg-3 cursor-not-allowed' : 'bg-kb-accent cursor-pointer'}`}
        >
          {isPending ? 'Creating…' : 'Create Draft Invoice'}
        </button>
      </div>
    </form>
  )
}

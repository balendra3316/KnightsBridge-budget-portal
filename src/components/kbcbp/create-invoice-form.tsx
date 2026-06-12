'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createInvoice } from '@/app/invoices/actions'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 7,
  border: '1px solid #E8E6E1', background: '#FFFFFF',
  fontSize: 13, color: '#1A1A18', fontFamily: 'inherit',
  outline: 'none', transition: 'border-color 0.15s',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 600,
  color: '#6B6A65', textTransform: 'uppercase', letterSpacing: '0.4px',
  marginBottom: 5,
}

const sectionHeader: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, color: '#9C9A92',
  textTransform: 'uppercase', letterSpacing: '0.4px',
  padding: '12px 0 8px', borderBottom: '1px solid #E8E6E1',
  marginBottom: 16,
}

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
      <div style={sectionHeader}>Client Details</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div>
          <label style={labelStyle}>Client Name *</label>
          <input
            style={inputStyle} required
            value={form.client_name}
            onChange={e => set('client_name', e.target.value)}
            placeholder="e.g. One Wall Street"
          />
        </div>
        <div>
          <label style={labelStyle}>Billing Month *</label>
          <select
            style={inputStyle}
            value={form.billing_month}
            onChange={e => set('billing_month', e.target.value)}
          >
            {BILLING_MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle}>PM / Account Manager</label>
          <input
            style={inputStyle}
            value={form.pm_name}
            onChange={e => set('pm_name', e.target.value)}
            placeholder="e.g. Jordan"
          />
        </div>
        <div>
          <label style={labelStyle}>Billing Pattern</label>
          <select
            style={inputStyle}
            value={form.billing_pattern}
            onChange={e => set('billing_pattern', e.target.value)}
          >
            {BILLING_PATTERNS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>

      {/* Amounts */}
      <div style={sectionHeader}>Budget & Commission</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div>
          <label style={labelStyle}>Management Fee ($)</label>
          <input
            style={inputStyle} type="number" min={0} step={0.01}
            value={form.fee_amount || ''}
            onChange={e => set('fee_amount', parseFloat(e.target.value) || 0)}
            placeholder="0"
          />
        </div>
        <div>
          <label style={labelStyle}>Ad Spend ($)</label>
          <input
            style={inputStyle} type="number" min={0} step={0.01}
            value={form.ad_spend_amount || ''}
            onChange={e => set('ad_spend_amount', parseFloat(e.target.value) || 0)}
            placeholder="0"
          />
        </div>
        <div>
          <label style={labelStyle}>Commission Rate (%)</label>
          <input
            style={inputStyle} type="number" min={0} max={100} step={0.5}
            value={form.commission_rate || ''}
            onChange={e => set('commission_rate', parseFloat(e.target.value) || 0)}
            placeholder="0"
          />
        </div>
      </div>

      {/* Calculated summary */}
      <div style={{
        display: 'flex', gap: 24, padding: '14px 20px', marginBottom: 24,
        background: '#F5F4F1', borderRadius: 8, border: '1px solid #E8E6E1',
        fontSize: 13, alignItems: 'center',
      }}>
        <div>
          <span style={{ fontSize: 11, color: '#9C9A92', display: 'block', marginBottom: 2 }}>Mgmt Fee</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{fmt(form.fee_amount)}</span>
        </div>
        <span style={{ color: '#D3D1C7', fontSize: 18 }}>+</span>
        <div>
          <span style={{ fontSize: 11, color: '#9C9A92', display: 'block', marginBottom: 2 }}>
            Commission ({form.commission_rate}% of ad spend)
          </span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontWeight: 600, color: '#0F6E56' }}>
            {fmt(commissionAmount)}
          </span>
        </div>
        <span style={{ color: '#D3D1C7', fontSize: 18 }}>=</span>
        <div>
          <span style={{ fontSize: 11, color: '#9C9A92', display: 'block', marginBottom: 2 }}>Invoice Total</span>
          <span style={{
            fontFamily: "'DM Mono', monospace", fontWeight: 700,
            fontSize: 16, color: '#3C3489',
          }}>
            {fmt(invoiceTotal)}
          </span>
        </div>
      </div>

      {/* Memo */}
      <div style={sectionHeader}>Notes</div>
      <div style={{ marginBottom: 28 }}>
        <label style={labelStyle}>Memo / Notes</label>
        <textarea
          style={{ ...inputStyle, minHeight: 72, resize: 'vertical' }}
          value={form.memo}
          onChange={e => set('memo', e.target.value)}
          placeholder="Any special billing notes for this invoice…"
        />
      </div>

      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: 6, marginBottom: 16,
          background: '#FCEBEB', color: '#A32D2D', fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={isPending}
          style={{
            padding: '8px 18px', borderRadius: 7,
            border: '1px solid #E8E6E1', background: '#FFFFFF',
            color: '#6B6A65', fontSize: 13, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          style={{
            padding: '8px 20px', borderRadius: 7, border: 'none',
            background: isPending ? '#9C9A92' : '#534AB7',
            color: 'white', fontSize: 13, fontWeight: 600,
            cursor: isPending ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', transition: 'background 0.15s',
          }}
        >
          {isPending ? 'Creating…' : 'Create Draft Invoice'}
        </button>
      </div>
    </form>
  )
}

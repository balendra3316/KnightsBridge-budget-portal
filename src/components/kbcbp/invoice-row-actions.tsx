'use client'

import { useState, useTransition } from 'react'
import { updateInvoiceStatus, createQuickbooksInvoice } from '@/app/invoices/actions'

type Props = { id: string; status: string }

const btnBase: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 5, border: 'none',
  fontSize: 11, fontWeight: 600, cursor: 'pointer',
  fontFamily: 'inherit', transition: 'all 0.15s',
}

export default function InvoiceRowActions({ id, status }: Props) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const change = (newStatus: 'draft' | 'review' | 'approved' | 'rejected') => {
    setError(null)
    startTransition(async () => {
      const result = await updateInvoiceStatus(id, newStatus)
      if (result.error) setError(result.error)
    })
  }

  const sendToQuickbooks = () => {
    setError(null)
    startTransition(async () => {
      const result = await createQuickbooksInvoice(id)
      if (result.error) setError(result.error)
    })
  }

  if (isPending) {
    return <span style={{ fontSize: 11, color: '#9C9A92' }}>Updating…</span>
  }

  if (error) {
    return <span style={{ fontSize: 11, color: '#A32D2D' }}>{error}</span>
  }

  if (status === 'draft') {
    return (
      <button
        onClick={() => change('review')}
        style={{ ...btnBase, background: '#EEEDFE', color: '#3C3489' }}
      >
        Send for Review
      </button>
    )
  }

  if (status === 'review') {
    return (
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => change('approved')}
          style={{ ...btnBase, background: '#E1F5EE', color: '#0F6E56' }}
        >
          Approve
        </button>
        <button
          onClick={() => change('rejected')}
          style={{ ...btnBase, background: '#FCEBEB', color: '#A32D2D' }}
        >
          Reject
        </button>
      </div>
    )
  }

  if (status === 'approved') {
    return (
      <button
        onClick={sendToQuickbooks}
        style={{ ...btnBase, background: '#534AB7', color: '#FFFFFF' }}
      >
        Create Invoice in QuickBooks
      </button>
    )
  }

  if (status === 'sent') {
    return (
      <span style={{ fontSize: 11, color: '#185FA5', fontWeight: 500 }}>
        ✓ Sent to QuickBooks
      </span>
    )
  }

  if (status === 'rejected') {
    return (
      <button
        onClick={() => change('draft')}
        style={{ ...btnBase, background: '#F5F4F1', color: '#6B6A65' }}
      >
        Reset to Draft
      </button>
    )
  }

  return null
}

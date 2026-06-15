'use client'

import { useState, useTransition, useRef } from 'react'
import { saveBudgetEntries, createDraftFromBudget, sendForReview } from '@/app/budget/actions'
import {
  computeInvoice, defaultPattern, PATTERN_OPTIONS, RATE_OPTIONS, type Pattern,
} from '@/lib/commission'

type Service = {
  id: string
  service_name: string
  service_type: string
  credit_card: string
  parent_service_id: string | null
  sort_order: number
}

type BudgetEntry = {
  service_id: string
  billing_month: string
  amount: number
}

type InvoiceInfo = {
  id: string
  invoice_number: string
  status: string
  billing_month: string
} | null

type Client = {
  id: string
  name: string
  project_name: string | null
  parent_group: string | null
  region: string | null
  tags: string[] | null
  team: string | null
  commission_rate: number
  billing_pattern: string
  notes: string[] | null
}

type Props = {
  client: Client
  services: Service[]
  entries: BudgetEntry[]
  months: string[]
  currentMonth: string
  invoice: InvoiceInfo
}

const CC_LABELS: Record<string, { label: string; bg: string; color: string } | null> = {
  kb:     { label: 'KB CARD', bg: '#FCEBEB', color: '#A32D2D' },
  client: { label: 'CLIENT',  bg: '#E6F1FB', color: '#185FA5' },
  na:     null,
}

const SVC_COLORS: Record<string, string> = {
  fee: '#854F0B',
  ad:  '#993C1D',
  seo: '#0F6E56',
}

const selectStyle: React.CSSProperties = {
  padding: '4px 8px', borderRadius: 6, border: '1px solid #D3D1C7',
  background: '#FFFFFF', fontSize: 11, fontWeight: 600, color: '#3C3489',
  fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
}

const REGION_TAGS: Record<string, { bg: string; color: string }> = {
  'New York':     { bg: '#E6F1FB', color: '#185FA5' },
  'New Jersey':   { bg: '#EEEDFE', color: '#534AB7' },
  'California':   { bg: '#FAECE7', color: '#993C1D' },
}

function fmt(n: number) {
  if (n === 0) return '$0'
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function BudgetGrid({ client, services, entries, months, currentMonth, invoice }: Props) {
  const [isPending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)
  const amountsRef = useRef<Record<string, number>>({})

  // Initialize amounts from entries for the current month
  const getAmount = (serviceId: string, month: string): number => {
    const entry = entries.find(e => e.service_id === serviceId && e.billing_month === month)
    return entry ? Number(entry.amount) : 0
  }

  // Track live edits for current month
  const getCurrentAmount = (serviceId: string): number => {
    if (amountsRef.current[serviceId] !== undefined) return amountsRef.current[serviceId]
    return getAmount(serviceId, currentMonth)
  }

  const [, forceRender] = useState(0)

  const updateAmount = (serviceId: string, value: number) => {
    amountsRef.current[serviceId] = value
    forceRender(n => n + 1)
  }

  // Pattern + rate are picked from the dropdowns; pre-filled from the client's config.
  const [pattern, setPattern] = useState<Pattern>(
    defaultPattern(services, (Number(client.commission_rate) || 0) / 100)
  )
  const [rate, setRate] = useState<number>((Number(client.commission_rate) || 0) / 100)

  // Monthly total excludes sub-lines (parent_service_id != null), matching the sheet.
  const computeMonthTotal = (month: string) =>
    services
      .filter(svc => !svc.parent_service_id)
      .reduce((sum, svc) => sum + getAmount(svc.id, month), 0)

  // Run the commission engine over the current month's lines.
  const currentLines = services.map(svc => ({
    service_type: svc.service_type,
    credit_card: svc.credit_card,
    parent_service_id: svc.parent_service_id,
    amount: getCurrentAmount(svc.id),
  }))
  const calc = computeInvoice(currentLines, pattern, rate)
  const currentTotal = calc.monthlyTotal

  const handleSaveAndDraft = () => {
    setMsg(null)
    startTransition(async () => {
      const ents = services.map(svc => ({
        service_id: svc.id,
        amount: getCurrentAmount(svc.id),
      }))
      const saveResult = await saveBudgetEntries(client.id, currentMonth, ents)
      if (saveResult.error) { setMsg(saveResult.error); return }

      const draftResult = await createDraftFromBudget(client.id, currentMonth, pattern, rate)
      if (draftResult.error) { setMsg(draftResult.error); return }
      setMsg('Draft invoice created')
    })
  }

  const handleSendReview = () => {
    setMsg(null)
    startTransition(async () => {
      const result = await sendForReview(client.id, currentMonth)
      if (result.error) { setMsg(result.error); return }
      setMsg('Sent for review')
    })
  }

  const regionTag = client.region ? REGION_TAGS[client.region] : null
  const invoiceStatus = invoice?.status

  // Budget cells are editable until the invoice is committed. Once it's out for
  // review / approved / sent, the numbers are locked. A rejected invoice reopens
  // for editing so it can be fixed and resubmitted.
  const editable = !invoice || invoiceStatus === 'draft' || invoiceStatus === 'rejected'

  const handleResubmit = () => {
    setMsg(null)
    startTransition(async () => {
      const ents = services.map(svc => ({
        service_id: svc.id,
        amount: getCurrentAmount(svc.id),
      }))
      const saveResult = await saveBudgetEntries(client.id, currentMonth, ents)
      if (saveResult.error) { setMsg(saveResult.error); return }

      const result = await sendForReview(client.id, currentMonth)
      if (result.error) { setMsg(result.error); return }
      setMsg('Resent for approval')
    })
  }

  return (
    <div style={{
      background: '#FFFFFF', borderRadius: 12, border: '1px solid #E8E6E1',
      marginBottom: 16, overflow: 'hidden',
    }}>
      {/* Client header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 20px',
        borderBottom: '1px solid #E8E6E1', background: '#F5F4F1', flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.3px' }}>
          {client.name}
        </div>
        {client.project_name && (
          <div style={{ fontSize: 13, fontWeight: 500, color: '#6B6A65' }}>
            <span style={{ color: '#9C9A92' }}>/ </span>{client.project_name}
          </div>
        )}
        {regionTag && (
          <span style={{
            padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600,
            letterSpacing: '0.3px', textTransform: 'uppercase' as const,
            background: regionTag.bg, color: regionTag.color,
          }}>{client.region}</span>
        )}
        {client.tags?.map(tag => (
          <span key={tag} style={{
            padding: '3px 8px', borderRadius: 5, fontSize: 10, fontWeight: 600,
            letterSpacing: '0.3px', textTransform: 'uppercase' as const,
            background: '#FAECE7', color: '#993C1D',
          }}>{tag}</span>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 12, color: '#9C9A92' }}>
          Team: <strong style={{ color: '#6B6A65', fontWeight: 500 }}>{client.team}</strong>
        </div>
      </div>

      {/* Notes */}
      {client.notes && client.notes.length > 0 && (
        <div style={{
          padding: '8px 20px', borderBottom: '1px solid #E8E6E1',
          display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
        }}>
          {client.notes.map((note, i) => (
            <span key={i} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500,
              background: '#F5F4F1', color: '#6B6A65', border: '1px solid #E8E6E1',
            }}>{note}</span>
          ))}
        </div>
      )}

      {/* Budget grid table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{
                padding: '8px 12px', textAlign: 'left', fontWeight: 500, fontSize: 11,
                textTransform: 'uppercase' as const, letterSpacing: '0.4px', color: '#9C9A92',
                borderBottom: '1px solid #E8E6E1', minWidth: 240,
              }}>Service</th>
              <th style={{
                padding: '8px 12px', textAlign: 'center', fontWeight: 500, fontSize: 11,
                textTransform: 'uppercase' as const, letterSpacing: '0.4px', color: '#9C9A92',
                borderBottom: '1px solid #E8E6E1', minWidth: 70,
              }}>CC</th>
              {months.map(m => {
                const isCurrent = m === currentMonth
                return (
                  <th key={m} style={{
                    padding: '8px 12px', textAlign: 'right', fontWeight: isCurrent ? 600 : 500,
                    fontSize: 11, textTransform: 'uppercase' as const, letterSpacing: '0.4px',
                    color: isCurrent ? '#854F0B' : '#9C9A92',
                    borderBottom: '1px solid #E8E6E1', whiteSpace: 'nowrap',
                    background: isCurrent ? '#FFFBEB' : '#FFFFFF',
                  }}>
                    {m}
                    <span style={{
                      display: 'block', fontSize: 9, fontWeight: 500,
                      letterSpacing: '0.2px', textTransform: 'none' as const, marginTop: 2,
                      color: isCurrent ? '#B07D0A' : '#9C9A92',
                    }}>
                      {isCurrent ? (editable ? 'Budget entry' : 'Locked') : 'Submitted'}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {services.map(svc => {
              const isSubLine = !!svc.parent_service_id
              return (
              <tr key={svc.id}>
                {/* Service name */}
                <td style={{
                  padding: '6px 12px', borderBottom: '1px solid #E8E6E1',
                  fontSize: 13, color: isSubLine ? '#9C9A92' : '#1A1A18',
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    paddingLeft: isSubLine ? 20 : 0,
                  }}>
                    {isSubLine ? (
                      <span style={{ color: '#C4C2B8', flexShrink: 0 }}>&#8627;</span>
                    ) : (
                      <span style={{
                        width: 6, height: 6, borderRadius: 2, flexShrink: 0,
                        background: SVC_COLORS[svc.service_type] ?? '#9C9A92',
                      }} />
                    )}
                    {svc.service_name}
                    {isSubLine && (
                      <span style={{
                        fontSize: 9, fontWeight: 600, letterSpacing: '0.3px',
                        textTransform: 'uppercase' as const, color: '#B4B2A9',
                        border: '1px solid #E8E6E1', borderRadius: 3, padding: '1px 4px',
                      }}>not counted</span>
                    )}
                  </div>
                </td>
                {/* Credit card */}
                <td style={{
                  padding: '6px 12px', textAlign: 'center', borderBottom: '1px solid #E8E6E1',
                  fontSize: 13,
                }}>
                  {CC_LABELS[svc.credit_card] ? (
                    <span style={{
                      display: 'inline-block', padding: '2px 6px', borderRadius: 4,
                      fontSize: 10, fontWeight: 600, letterSpacing: '0.3px',
                      background: CC_LABELS[svc.credit_card]!.bg,
                      color: CC_LABELS[svc.credit_card]!.color,
                    }}>{CC_LABELS[svc.credit_card]!.label}</span>
                  ) : (
                    <span style={{ color: '#9C9A92', fontSize: 11 }}>&mdash;</span>
                  )}
                </td>
                {/* Month columns */}
                {months.map(m => {
                  const isCurrent = m === currentMonth
                  if (isCurrent) {
                    const cellAmt = getCurrentAmount(svc.id)
                    return (
                      <td key={m} style={{
                        padding: '6px 12px', textAlign: 'right', borderBottom: '1px solid #E8E6E1',
                        background: '#FFFBEB',
                      }}>
                        {editable ? (
                          <EditableCell
                            defaultValue={cellAmt}
                            onChange={val => updateAmount(svc.id, val)}
                          />
                        ) : (
                          <span style={{
                            fontFamily: "'DM Mono', monospace", fontSize: 12,
                            color: '#6B6A65', fontWeight: 500,
                          }}>
                            {cellAmt > 0 ? fmt(cellAmt) : <span style={{ color: '#9C9A92' }}>&mdash;</span>}
                          </span>
                        )}
                      </td>
                    )
                  }
                  const amt = getAmount(svc.id, m)
                  return (
                    <td key={m} style={{
                      padding: '6px 12px', textAlign: 'right', borderBottom: '1px solid #E8E6E1',
                      fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#6B6A65',
                      whiteSpace: 'nowrap',
                    }}>
                      {amt > 0 ? fmt(amt) : <span style={{ color: '#9C9A92' }}>&mdash;</span>}
                    </td>
                  )
                })}
              </tr>
              )
            })}
            {/* Total row */}
            <tr>
              <td style={{
                padding: '8px 12px', fontWeight: 600, fontSize: 13, color: '#1A1A18',
                borderTop: '2px solid #D3D1C7',
              }}>Monthly total</td>
              <td style={{ borderTop: '2px solid #D3D1C7' }} />
              {months.map(m => {
                const isCurrent = m === currentMonth
                const total = isCurrent ? currentTotal : computeMonthTotal(m)
                return (
                  <td key={m} style={{
                    padding: '8px 12px', textAlign: 'right', fontWeight: 600,
                    fontFamily: "'DM Mono', monospace", fontSize: 12,
                    color: isCurrent ? '#3C3489' : '#1A1A18',
                    borderTop: '2px solid #D3D1C7',
                    background: isCurrent ? '#FFFBEB' : undefined,
                  }}>
                    {total > 0 ? fmt(total) : '—'}
                  </td>
                )
              })}
            </tr>
            {/* Invoice status row */}
            <tr>
              <td style={{
                padding: '4px 12px 8px', fontWeight: 500, color: '#9C9A92',
                textTransform: 'uppercase' as const, letterSpacing: '0.3px', fontSize: 10,
              }}>Invoice</td>
              <td />
              {months.map(m => {
                const isCurrent = m === currentMonth
                if (!isCurrent) return <td key={m} />
                return (
                  <td key={m} style={{
                    padding: '4px 12px 8px', textAlign: 'right',
                    background: '#FFFBEB', fontSize: 11,
                  }}>
                    {invoice ? (
                      <InvoiceStatusBadge status={invoice.status} num={invoice.invoice_number} />
                    ) : (
                      <span style={{ color: '#9C9A92' }}>No invoice</span>
                    )}
                  </td>
                )
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Summary strip with action buttons */}
      <div style={{
        display: 'flex', gap: 16, padding: '10px 20px',
        background: '#F5F4F1', borderTop: '1px solid #E8E6E1',
        fontSize: 12, color: '#6B6A65', alignItems: 'center', flexWrap: 'wrap',
      }}>
        {/* Rule selectors — pick the pattern & rate during budget entry */}
        {!invoice ? (
          <>
            <select
              value={pattern}
              onChange={e => setPattern(e.target.value as Pattern)}
              style={selectStyle}
            >
              {PATTERN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select
              value={rate}
              onChange={e => setRate(parseFloat(e.target.value))}
              style={selectStyle}
            >
              {RATE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </>
        ) : (
          <span style={{
            padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600,
            background: '#EEEDFE', color: '#3C3489',
          }}>
            {PATTERN_OPTIONS.find(o => o.value === pattern)?.label} · {rate * 100}%
          </span>
        )}

        <span style={{ width: 1, height: 16, background: '#E8E6E1' }} />

        <div>
          <span style={{ color: '#9C9A92' }}>Fee </span>
          <span style={{ fontWeight: 600, fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#1A1A18' }}>
            {fmt(calc.feeLines)}
          </span>
        </div>
        <div>
          <span style={{ color: '#9C9A92' }}>Ad spend </span>
          <span style={{ fontWeight: 600, fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#1A1A18' }}>
            {fmt(calc.clientCardAd + calc.kbCardAd)}
          </span>
        </div>
        {pattern === 'A' && rate > 0 && (
          <div>
            <span style={{ color: '#9C9A92' }}>Commission ({rate * 100}%) </span>
            <span style={{ fontWeight: 600, fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#0F6E56' }}>
              {fmt(calc.commission)}
            </span>
          </div>
        )}
        {pattern === 'B' && rate > 0 && (
          <div>
            <span style={{ color: '#9C9A92' }}>Net spend </span>
            <span style={{ fontWeight: 600, fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#854F0B' }}>
              {fmt(calc.netSpend)}
            </span>
          </div>
        )}
        <div>
          <span style={{ color: '#9C9A92' }}>Monthly total </span>
          <span style={{ fontWeight: 600, fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#6B6A65' }}>
            {fmt(calc.monthlyTotal)}
          </span>
        </div>
        <div>
          <span style={{ color: '#9C9A92' }}>Invoice total </span>
          <span style={{ fontWeight: 700, fontFamily: "'DM Mono', monospace", fontSize: 13, color: '#3C3489' }}>
            {fmt(calc.invoiceTotal)}
          </span>
        </div>

        <div style={{ flex: 1 }} />

        {msg && (
          <span style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 4,
            background: msg.includes('error') || msg.includes('No') ? '#FCEBEB' : '#E1F5EE',
            color: msg.includes('error') || msg.includes('No') ? '#A32D2D' : '#0F6E56',
            fontWeight: 500,
          }}>{msg}</span>
        )}

        {isPending ? (
          <span style={{ fontSize: 11, color: '#9C9A92' }}>Saving…</span>
        ) : !invoice ? (
          <button onClick={handleSaveAndDraft} style={{
            padding: '6px 14px', borderRadius: 6, border: 'none',
            background: '#534AB7', color: 'white', fontSize: 12,
            fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
          }}>
            Create Draft
          </button>
        ) : invoiceStatus === 'draft' ? (
          <button onClick={handleSendReview} style={{
            padding: '6px 14px', borderRadius: 6, border: 'none',
            background: '#EEEDFE', color: '#3C3489', fontSize: 12,
            fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
          }}>
            Send for Approval
          </button>
        ) : invoiceStatus === 'review' ? (
          <span style={{
            padding: '3px 10px', borderRadius: 4, fontSize: 11,
            background: '#FAEEDA', color: '#854F0B', fontWeight: 600,
          }}>Under Review</span>
        ) : invoiceStatus === 'approved' ? (
          <span style={{
            padding: '3px 10px', borderRadius: 4, fontSize: 11,
            background: '#E1F5EE', color: '#0F6E56', fontWeight: 600,
          }}>Approved</span>
        ) : invoiceStatus === 'sent' ? (
          <span style={{
            padding: '3px 10px', borderRadius: 4, fontSize: 11,
            background: '#E6F1FB', color: '#185FA5', fontWeight: 600,
          }}>Sent to QuickBooks</span>
        ) : invoiceStatus === 'rejected' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              padding: '3px 10px', borderRadius: 4, fontSize: 11,
              background: '#FCEBEB', color: '#A32D2D', fontWeight: 600,
            }}>Rejected</span>
            <button onClick={handleResubmit} style={{
              padding: '6px 14px', borderRadius: 6, border: 'none',
              background: '#EEEDFE', color: '#3C3489', fontSize: 12,
              fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
            }}>
              Resend for Approval
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/* ---------- Sub-components ---------- */

function EditableCell({ defaultValue, onChange }: { defaultValue: number; onChange: (v: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [raw, setRaw] = useState(String(defaultValue))

  const commit = () => {
    setEditing(false)
    const n = parseFloat(raw.replace(/[^0-9.-]/g, ''))
    const val = isNaN(n) ? 0 : n
    setRaw(String(val))
    onChange(val)
  }

  if (!editing) {
    return (
      <span
        onClick={() => setEditing(true)}
        style={{
          display: 'inline-block', minWidth: 70, textAlign: 'right', padding: '4px 8px',
          borderRadius: 4, fontWeight: 500, color: '#3C3489',
          background: '#E8E5FC', border: '1px dashed #534AB7',
          fontFamily: "'DM Mono', monospace", fontSize: 12,
          cursor: 'text', transition: 'all 0.15s',
        }}
      >
        {fmt(defaultValue)}
      </span>
    )
  }

  return (
    <input
      autoFocus
      value={raw}
      onChange={e => setRaw(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit() }}
      style={{
        width: 90, textAlign: 'right', padding: '4px 8px', borderRadius: 4,
        border: '1px solid #534AB7', fontFamily: "'DM Mono', monospace", fontSize: 12,
        outline: 'none', background: '#FFFFFF',
        boxShadow: '0 0 0 3px rgba(83,74,183,0.15)',
      }}
    />
  )
}

function InvoiceStatusBadge({ status, num }: { status: string; num: string }) {
  const cfgs: Record<string, { bg: string; color: string; dot: string; label: string }> = {
    draft:    { bg: '#F5F4F1', color: '#6B6A65', dot: '#B4B2A9', label: 'Draft' },
    review:   { bg: '#FAEEDA', color: '#854F0B', dot: '#EF9F27', label: 'Under Review' },
    approved: { bg: '#E1F5EE', color: '#0F6E56', dot: '#1D9E75', label: 'Approved' },
    sent:     { bg: '#E6F1FB', color: '#185FA5', dot: '#185FA5', label: 'Sent' },
    rejected: { bg: '#FCEBEB', color: '#A32D2D', dot: '#E05252', label: 'Rejected' },
  }
  const cfg = cfgs[status] ?? cfgs.draft
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
      <span style={{
        fontFamily: "'DM Mono', monospace", fontSize: 11,
        color: '#3C3489', fontWeight: 500,
      }}>{num}</span>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap',
        color: cfg.color,
      }}>
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot }} />
        {cfg.label}
      </span>
    </div>
  )
}

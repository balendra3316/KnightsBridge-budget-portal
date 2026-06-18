import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PrintButton from '@/components/kbcbp/print-button'

const MONTH_MAP: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
}

function parseMonth(billing: string) {
  const [mon, year] = billing.split(' ')
  const num = MONTH_MAP[mon] ?? 1
  const y = Number(year ?? 2026)
  const longName = new Date(y, num - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' })
  const dateStr = `${String(num).padStart(2, '0')}/01/${y}`
  const dueNum = num + 1 > 12 ? 1 : num + 1
  const dueY = num + 1 > 12 ? y + 1 : y
  const dueDateStr = `${String(dueNum).padStart(2, '0')}/01/${dueY}`
  return { longName, dateStr, dueDateStr }
}

function fmtMoney(n: number | null | undefined) {
  if (n == null) return '$0.00'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtRate(n: number | null | undefined) {
  if (n == null) return '0.00'
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const STATUS_CLS: Record<string, { label: string; cls: string; dotCls: string }> = {
  draft:     { label: 'Draft',        cls: 'bg-kb-surface-alt text-kb-fg-2', dotCls: 'bg-kb-muted' },
  review:    { label: 'Under Review', cls: 'bg-kb-amber-light text-kb-amber', dotCls: 'bg-kb-amber-dot' },
  approved:  { label: 'Approved',     cls: 'bg-kb-green-light text-kb-green', dotCls: 'bg-kb-green-dot' },
  rejected:  { label: 'Rejected',     cls: 'bg-kb-red-light text-kb-red',     dotCls: 'bg-kb-red-dot' },
  sent:      { label: 'Sent',         cls: 'bg-kb-blue-light text-kb-blue',   dotCls: 'bg-kb-blue' },
  paid:      { label: 'Paid',         cls: 'bg-kb-green-light text-kb-green', dotCls: 'bg-kb-green-dot' },
}

export default async function InvoicePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', id)
    .single()

  if (!invoice) notFound()

  type LineItem = { name: string; amount: number; card?: string }
  let lineItems: LineItem[] = []

  // Each stored row now carries its `card` ('' / 'Client Card' / 'KB Card'), so we
  // can hide card-paid rows on the printed invoice (manager's UI preference) straight
  // from the snapshot. For older invoices saved before `card` existed, we fall back
  // to looking the card up from client_services. Amounts always stay frozen — the
  // card flag only decides which rows to *show*, so totals never drift.
  const { data: svcRows } = await supabase
    .from('client_services')
    .select('service_name, credit_card')
    .eq('client_id', invoice.client_id)

  const cardByName = new Map<string, string>()
  for (const s of svcRows ?? []) cardByName.set(s.service_name, s.credit_card ?? '')
  const isCardRow = (li: LineItem) => {
    const card = li.card ?? cardByName.get(li.name) ?? ''
    return card === 'KB Card' || card === 'Client Card'
  }

  // Render purely from the invoice snapshot — never recompute amounts from live
  // budget entries (which could drift from the locked totals).
  if (Array.isArray(invoice.line_items) && invoice.line_items.length > 0) {
    // Frozen rows, minus any KB-/Client-Card service rows (kept hidden). The
    // Commission row and fee rows remain. KB-card spend still counts in the total.
    lineItems = (invoice.line_items as LineItem[])
      .filter(li => !isCardRow(li))
      .map(li => ({
        name: String(li.name),
        amount: Number(li.amount) || 0,
      }))
  } else {
    // Fallback for invoices created before line_items existed: rebuild from the
    // saved aggregate fields. Neither client-card nor kb-card ad spend is itemized
    // on the printed invoice (manager's UI preference) — only the fees and the
    // combined commission are shown. The kb-card spend still lives in the total.
    const fee = Number(invoice.fee_amount) || 0
    const commission = Number(invoice.commission_amount) || 0
    if (fee > 0) lineItems.push({ name: 'Management & Service Fees', amount: fee })
    if (commission > 0) {
      lineItems.push({ name: `Commission (${fmtRate(invoice.commission_rate)}%)`, amount: commission })
    }
  }

  const pm = parseMonth(invoice.billing_month)
  const subtotal = Number(invoice.invoice_total) || 0
  const statusCfg = STATUS_CLS[invoice.status] ?? STATUS_CLS.draft

  return (
    <div className="min-h-screen bg-kb-bg font-sans">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 py-3 bg-kb-surface border-b border-kb-border print:hidden">
        <Link href="/invoices" className="text-[13px] text-kb-accent-text font-medium no-underline hover:underline">
          &larr; Back to Invoices
        </Link>
        <div className="flex-1" />
        <span className={`inline-flex items-center gap-[5px] px-2.5 py-1 rounded text-[11px] font-semibold ${statusCfg.cls}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dotCls}`} />
          {statusCfg.label}
        </span>
        <PrintButton />
      </div>

      {/* Invoice paper */}
      <div className="max-w-[820px] mx-auto my-8 print:my-0 print:max-w-none">
        <div className="bg-white rounded-lg shadow-lg border border-kb-border p-10 print:shadow-none print:border-none print:rounded-none">

          {/* Company header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <div className="text-[18px] font-bold tracking-tight text-kb-fg">
                KNIGHTSBRIDGE STRATEGIES, LTD
              </div>
              <div className="text-[12px] text-kb-fg-2 leading-relaxed mt-1">
                860 Broadway Fl 5<br />
                New York, NY 10003-1228<br />
                accounting@kbpark.com
              </div>
            </div>
            <div className="text-right">
              <div className="text-[32px] font-light tracking-[0.15em] text-[#9CBCD8]">
                INVOICE
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-[2px] bg-[#4A7C9B] mb-8" />

          {/* Bill To + Invoice Details */}
          <div className="grid grid-cols-[1fr_auto] gap-8 mb-8">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-kb-fg-3 mb-2">
                  Bill To
                </div>
                <div className="text-[13px] text-kb-fg leading-relaxed">
                  {invoice.client_name}<br />
                  <span className="text-kb-fg-2">New York, NY</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-kb-fg-3 mb-2">
                  Ship To
                </div>
                <div className="text-[13px] text-kb-fg leading-relaxed">
                  {invoice.client_name}<br />
                  <span className="text-kb-fg-2">New York, NY</span>
                </div>
              </div>
            </div>
            <div>
              <table className="text-[12px]">
                <tbody>
                  {[
                    ['Invoice #', invoice.invoice_number ?? '—'],
                    ['Date', pm.dateStr],
                    ['Due Date', pm.dueDateStr],
                    ['Terms', 'Net 30'],
                  ].map(([label, value]) => (
                    <tr key={label}>
                      <td className="pr-5 py-[3px] font-semibold text-kb-fg-3 uppercase text-[10px] tracking-wider text-right whitespace-nowrap">
                        {label}
                      </td>
                      <td className="py-[3px] text-kb-fg font-medium">
                        {value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Project bar */}
          <div className="mb-6 px-4 py-2.5 bg-[#F0F5F8] rounded border border-[#D4E1EA]">
            <span className="text-[10px] font-bold uppercase tracking-widest text-kb-fg-3 mr-2">Project</span>
            <span className="text-[13px] font-medium text-kb-fg">{invoice.client_name}</span>
            {invoice.pm_name && (
              <>
                <span className="text-kb-fg-3 mx-2">&middot;</span>
                <span className="text-[12px] text-kb-fg-2">PM: {invoice.pm_name}</span>
              </>
            )}
          </div>

          {/* Line Items Table */}
          <table className="w-full border-collapse mb-1">
            <thead>
              <tr className="bg-[#4A7C9B]">
                <th className="py-2 px-3 text-left text-[10px] font-bold uppercase tracking-widest text-white">
                  Description
                </th>
                <th className="py-2 px-3 text-right text-[10px] font-bold uppercase tracking-widest text-white w-[130px]">
                  Rate
                </th>
                <th className="py-2 px-3 text-right text-[10px] font-bold uppercase tracking-widest text-white w-[130px]">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-[#F7FAFB]'}>
                  <td className="py-2.5 px-3 text-[13px] text-kb-fg">
                    {item.name} &mdash; {pm.longName}
                  </td>
                  <td className="py-2.5 px-3 text-right text-[13px] text-kb-fg font-mono">
                    {fmtRate(item.amount)}
                  </td>
                  <td className="py-2.5 px-3 text-right text-[13px] text-kb-fg font-mono">
                    {fmtRate(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-8">
            <div className="w-[300px]">
              <div className="flex justify-between py-2 px-3 text-[13px]">
                <span className="text-kb-fg-2 font-medium">SUBTOTAL</span>
                <span className="font-mono text-kb-fg">{fmtRate(subtotal)}</span>
              </div>
              <div className="flex justify-between py-2 px-3 text-[13px]">
                <span className="text-kb-fg-2 font-medium">TAX</span>
                <span className="font-mono text-kb-fg">0.00</span>
              </div>
              <div className="flex justify-between py-2 px-3 text-[13px] border-t border-kb-border-strong">
                <span className="text-kb-fg font-semibold">TOTAL</span>
                <span className="font-mono text-kb-fg font-semibold">{fmtRate(subtotal)}</span>
              </div>
              <div className="flex justify-between py-3 px-4 mt-2 bg-[#4A7C9B] rounded">
                <span className="text-[13px] font-bold text-white">BALANCE DUE</span>
                <span className="text-[16px] font-bold font-mono text-white">{fmtMoney(subtotal)}</span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-kb-border mb-6" />

          {/* Payment Info */}
          <div className="grid grid-cols-2 gap-8 mb-6">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-kb-fg-3 mb-2">
                ACH Payment
              </div>
              <div className="text-[12px] text-kb-fg-2 leading-relaxed">
                <span className="font-semibold text-kb-fg">Chase Bank</span><br />
                Routing # 021000021<br />
                Checking # ****7892<br />
                <span className="text-kb-fg-3 italic mt-1 block">
                  Ref: {invoice.invoice_number}
                </span>
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-kb-fg-3 mb-2">
                Mail Check To
              </div>
              <div className="text-[12px] text-kb-fg-2 leading-relaxed">
                Knightsbridge Strategies, Ltd<br />
                860 Broadway Fl 5<br />
                New York, NY 10003-1228
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="text-center text-[11px] text-kb-fg-3 pt-4 border-t border-kb-border">
            Thank you for your business. Payment is due within 30 days of invoice date.
          </div>

        </div>
      </div>
    </div>
  )
}

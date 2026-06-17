import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import InvoiceRowActions from '@/components/kbcbp/invoice-row-actions'

const STATUS_CLS: Record<string, { label: string; cls: string; dotCls: string }> = {
  draft:     { label: 'Draft',        cls: 'bg-kb-surface-alt text-kb-fg-2', dotCls: 'bg-kb-muted' },
  review:    { label: 'Under Review', cls: 'bg-kb-amber-light text-kb-amber', dotCls: 'bg-kb-amber-dot' },
  approved:  { label: 'Approved',     cls: 'bg-kb-green-light text-kb-green', dotCls: 'bg-kb-green-dot' },
  rejected:  { label: 'Rejected',     cls: 'bg-kb-red-light text-kb-red',     dotCls: 'bg-kb-red-dot' },
  sent:      { label: 'Sent',         cls: 'bg-kb-blue-light text-kb-blue',   dotCls: 'bg-kb-blue' },
  paid:      { label: 'Paid',         cls: 'bg-kb-green-light text-kb-green', dotCls: 'bg-kb-green-dot' },
}

function fmt(n: number | null | undefined) {
  if (n == null || n === 0) return '—'
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CLS[status] ?? STATUS_CLS.draft
  return (
    <span className={`inline-flex items-center gap-[5px] px-2 py-[3px] rounded text-[11px] font-semibold whitespace-nowrap ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dotCls}`} />
      {cfg.label}
    </span>
  )
}

function AppBar() {
  return (
    <div className="flex items-center gap-1 px-6 py-3 bg-kb-surface border-b border-kb-border sticky top-0 z-[100]">
      <div className="font-semibold text-sm tracking-tight mr-3">
        KB<span className="text-kb-accent">CBP</span>
      </div>
      {[
        { label: 'Budget Entry', href: '/', active: false },
        { label: 'Approvals', href: '/approvals', active: false },
        { label: 'Invoices', href: '/invoices', active: true },
        { label: 'Reports', href: '#', active: false },
      ].map(item => (
        <Link key={item.label} href={item.href}
          className={`px-3 py-1 rounded-md text-[13px] font-medium no-underline transition-colors duration-150 ${item.active ? 'bg-kb-accent-light text-kb-accent-text' : 'bg-transparent text-kb-fg-2'}`}>
          {item.label}
        </Link>
      ))}
      <div className="flex-1" />
      <Link href="/invoices/new"
        className="px-3.5 py-1.5 rounded-md border-none bg-kb-accent text-white text-xs font-semibold no-underline font-sans">
        + Create Invoice
      </Link>
      <div className="w-px h-5 bg-kb-border mx-2" />
      <div className="w-7 h-7 rounded-full bg-kb-accent text-white flex items-center justify-center text-[11px] font-semibold">
        VM
      </div>
    </div>
  )
}

export default async function InvoicesPage() {
  const supabase = await createClient()
  const { data: invoices } = await supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false })

  const all = invoices ?? []
  const counts = {
    total:    all.length,
    draft:    all.filter(i => i.status === 'draft').length,
    review:   all.filter(i => i.status === 'review').length,
    approved: all.filter(i => i.status === 'approved').length,
  }

  const cols = ['Invoice #', 'Client', 'Month', 'PM', 'Fee', 'Ad Spend', 'Commission', 'Total', 'Status', '']

  return (
    <div className="min-h-screen bg-kb-bg font-sans">
      <AppBar />

      {/* Status bar */}
      <div className="flex items-center gap-4 px-6 py-2 bg-kb-surface-alt border-b border-kb-border text-xs text-kb-fg-2">
        <span className="flex items-center gap-[5px]">
          <span className="w-[7px] h-[7px] rounded-full inline-block bg-kb-accent" />
          {counts.total} total
        </span>
        <span className="w-px h-4 inline-block bg-kb-border" />
        <span className="flex items-center gap-[5px]">
          <span className="w-[7px] h-[7px] rounded-full inline-block bg-kb-muted" />
          {counts.draft} draft
        </span>
        <span className="w-px h-4 inline-block bg-kb-border" />
        <span className="flex items-center gap-[5px]">
          <span className="w-[7px] h-[7px] rounded-full inline-block bg-kb-amber-dot" />
          {counts.review} under review
        </span>
        <span className="w-px h-4 inline-block bg-kb-border" />
        <span className="flex items-center gap-[5px]">
          <span className="w-[7px] h-[7px] rounded-full inline-block bg-kb-green-dot" />
          {counts.approved} approved
        </span>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-5 pb-20">
        {all.length === 0 ? (
          <div className="bg-kb-surface rounded-xl border border-kb-border py-15 px-6 text-center">
            <div className="text-4xl mb-3">&#129466;</div>
            <div className="text-[15px] font-semibold text-kb-fg mb-1.5">No invoices yet</div>
            <div className="text-[13px] text-kb-fg-3 mb-5">
              Create your first invoice to get started
            </div>
            <Link href="/invoices/new"
              className="inline-block px-5 py-2 rounded-lg bg-kb-accent text-white text-[13px] font-semibold no-underline">
              Create Invoice
            </Link>
          </div>
        ) : (
          <div className="bg-kb-surface rounded-xl border border-kb-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr>
                    {cols.map((h, i) => (
                      <th key={i} className={`px-3.5 py-2.5 font-medium text-[11px] uppercase tracking-wider text-kb-fg-3 border-b border-kb-border bg-kb-surface whitespace-nowrap ${i >= 4 && i <= 7 ? 'text-right' : 'text-left'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {all.map((inv, idx) => (
                    <tr key={inv.id} className={idx < all.length - 1 ? 'border-b border-kb-border' : ''}>
                      <td className="px-3.5 py-2.5 font-mono font-medium whitespace-nowrap min-w-[90px]">
                        <Link href={`/invoices/${inv.id}`} className="text-kb-accent-text no-underline hover:underline">
                          {inv.invoice_number ?? '—'}
                        </Link>
                      </td>
                      <td className="px-3.5 py-2.5 font-medium text-kb-fg min-w-[160px]">
                        {inv.client_name}
                      </td>
                      <td className="px-3.5 py-2.5 text-kb-fg-2 whitespace-nowrap">
                        {inv.billing_month}
                      </td>
                      <td className="px-3.5 py-2.5 text-kb-fg-2 min-w-[100px]">
                        {inv.pm_name}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-kb-fg-2 whitespace-nowrap">
                        {fmt(inv.fee_amount)}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-kb-fg-2 whitespace-nowrap">
                        {fmt(inv.ad_spend_amount)}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono text-kb-green whitespace-nowrap">
                        {fmt(inv.commission_amount)}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-kb-fg whitespace-nowrap">
                        {fmt(inv.invoice_total)}
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <StatusBadge status={inv.status} />
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Link href={`/invoices/${inv.id}`}
                            className="px-2.5 py-1 rounded-[5px] border border-kb-border text-[11px] font-semibold text-kb-fg-2 no-underline font-sans hover:bg-kb-surface-alt transition-colors duration-150">
                            View
                          </Link>
                          <InvoiceRowActions id={inv.id} status={inv.status} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

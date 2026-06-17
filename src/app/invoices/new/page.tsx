import Link from 'next/link'
import CreateInvoiceForm from '@/components/kbcbp/create-invoice-form'

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
          className={`px-3 py-1 rounded-md text-[13px] font-medium no-underline ${item.active ? 'bg-kb-accent-light text-kb-accent-text' : 'bg-transparent text-kb-fg-2'}`}>
          {item.label}
        </Link>
      ))}
      <div className="flex-1" />
      <div className="w-7 h-7 rounded-full bg-kb-accent text-white flex items-center justify-center text-[11px] font-semibold">
        VM
      </div>
    </div>
  )
}

export default function NewInvoicePage() {
  return (
    <div className="min-h-screen bg-kb-bg font-sans">
      <AppBar />

      <div className="max-w-[760px] mx-auto px-6 py-7 pb-20">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 mb-5 text-xs text-kb-fg-3">
          <Link href="/invoices" className="text-kb-accent no-underline font-medium">
            Invoices
          </Link>
          <span>/</span>
          <span>New Invoice</span>
        </div>

        <h1 className="text-[22px] font-semibold tracking-tight text-kb-fg mb-1.5">
          Create Draft Invoice
        </h1>
        <p className="text-[13px] text-kb-fg-2 mb-7">
          Fill in the details below. The invoice will be saved as a draft — you can send it for review once ready.
        </p>

        <div className="bg-kb-surface rounded-xl border border-kb-border px-7 py-7">
          <CreateInvoiceForm />
        </div>
      </div>
    </div>
  )
}

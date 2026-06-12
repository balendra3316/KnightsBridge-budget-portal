import Link from 'next/link'
import CreateInvoiceForm from '@/components/kbcbp/create-invoice-form'

function AppBar() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4, padding: '12px 24px',
      background: '#FFFFFF', borderBottom: '1px solid #E8E6E1',
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <div style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-0.3px', marginRight: 12 }}>
        KB<span style={{ color: '#534AB7' }}>CBP</span>
      </div>
      {[
        { label: 'Budget Entry', href: '/', active: false },
        { label: 'Approvals', href: '/approvals', active: false },
        { label: 'Invoices', href: '/invoices', active: true },
        { label: 'Reports', href: '#', active: false },
      ].map(item => (
        <Link key={item.label} href={item.href} style={{
          padding: '5px 12px', borderRadius: 6, fontSize: 13, fontWeight: 500,
          background: item.active ? '#EEEDFE' : 'transparent',
          color: item.active ? '#3C3489' : '#6B6A65',
          textDecoration: 'none',
        }}>
          {item.label}
        </Link>
      ))}
      <div style={{ flex: 1 }} />
      <div style={{
        width: 28, height: 28, borderRadius: '50%', background: '#534AB7',
        color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 600,
      }}>VM</div>
    </div>
  )
}

export default function NewInvoicePage() {
  return (
    <div style={{ background: '#FAF9F7', minHeight: '100vh', fontFamily: "'DM Sans', -apple-system, sans-serif" }}>
      <AppBar />

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '28px 24px 80px' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 20, fontSize: 12, color: '#9C9A92' }}>
          <Link href="/invoices" style={{ color: '#534AB7', textDecoration: 'none', fontWeight: 500 }}>
            Invoices
          </Link>
          <span>/</span>
          <span>New Invoice</span>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.4px', color: '#1A1A18', marginBottom: 6 }}>
          Create Draft Invoice
        </h1>
        <p style={{ fontSize: 13, color: '#6B6A65', marginBottom: 28 }}>
          Fill in the details below. The invoice will be saved as a draft — you can send it for review once ready.
        </p>

        <div style={{
          background: '#FFFFFF', borderRadius: 12, border: '1px solid #E8E6E1',
          padding: '28px 28px 24px',
        }}>
          <CreateInvoiceForm />
        </div>
      </div>
    </div>
  )
}

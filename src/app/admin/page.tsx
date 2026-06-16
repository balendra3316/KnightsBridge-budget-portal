import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getAdmin } from './actions'
import AdminInvoiceTable, { LogoutButton } from '@/components/kbcbp/admin-invoice-table'

export default async function AdminDashboard() {
  const admin = await getAdmin()
  if (!admin) redirect('/admin/login')

  const supabase = await createClient()

  const { data: pendingInvoices } = await supabase
    .from('invoices')
    .select('*')
    .eq('status', 'review')
    .order('created_at', { ascending: false })

  const { data: recentInvoices } = await supabase
    .from('invoices')
    .select('*')
    .in('status', ['approved', 'rejected', 'sent'])
    .order('updated_at', { ascending: false })
    .limit(20)

  return (
    <div style={{
      minHeight: '100vh', background: '#FAF9F7',
      fontFamily: "'DM Sans', -apple-system, sans-serif",
    }}>
      {/* Admin header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4, padding: '12px 24px',
        background: '#FFFFFF', borderBottom: '1px solid #E8E6E1',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ fontWeight: 600, fontSize: 14, letterSpacing: '-0.3px', marginRight: 8 }}>
          KB<span style={{ color: '#534AB7' }}>CBP</span>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.3px',
          color: '#FFFFFF', background: '#534AB7', borderRadius: 4,
          padding: '2px 6px',
        }}>ADMIN</span>
        <Link href="/" style={{
          padding: '5px 12px', borderRadius: 6, fontSize: 13, fontWeight: 500,
          color: '#6B6A65', textDecoration: 'none', marginLeft: 12,
        }}>
          Budget Entry
        </Link>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 12, color: '#6B6A65', marginRight: 12 }}>
          {admin.name}
        </span>
        <LogoutButton />
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 24px 80px' }}>
        {/* Pending approvals */}
        <div style={{ marginBottom: 32 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12,
          }}>
            <h2 style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.3px', margin: 0 }}>
              Pending Approval
            </h2>
            <span style={{
              padding: '3px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700,
              background: '#FAEEDA', color: '#854F0B',
            }}>
              {pendingInvoices?.length ?? 0}
            </span>
          </div>

          {!pendingInvoices || pendingInvoices.length === 0 ? (
            <div style={{
              padding: '40px 20px', textAlign: 'center', background: '#FFFFFF',
              borderRadius: 12, border: '1px solid #E8E6E1',
            }}>
              <div style={{ fontSize: 13, color: '#9C9A92' }}>No invoices pending approval</div>
            </div>
          ) : (
            <AdminInvoiceTable invoices={pendingInvoices} showActions />
          )}
        </div>

        {/* Recent activity */}
        <div>
          <h2 style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.3px', marginBottom: 12 }}>
            Recent Activity
          </h2>
          {!recentInvoices || recentInvoices.length === 0 ? (
            <div style={{
              padding: '40px 20px', textAlign: 'center', background: '#FFFFFF',
              borderRadius: 12, border: '1px solid #E8E6E1',
            }}>
              <div style={{ fontSize: 13, color: '#9C9A92' }}>No recent activity</div>
            </div>
          ) : (
            <AdminInvoiceTable invoices={recentInvoices} />
          )}
        </div>
      </div>
    </div>
  )
}

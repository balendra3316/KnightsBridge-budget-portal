import { getAdmin } from '../actions'
import { redirect } from 'next/navigation'
import AdminLoginForm from '@/components/kbcbp/admin-login-form'

export default async function AdminLoginPage() {
  const admin = await getAdmin()
  if (admin) redirect('/admin')

  return (
    <div style={{
      minHeight: '100vh', background: '#FAF9F7',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Sans', -apple-system, sans-serif",
    }}>
      <div style={{
        width: 380, background: '#FFFFFF', borderRadius: 16,
        border: '1px solid #E8E6E1', padding: '40px 32px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontWeight: 600, fontSize: 18, letterSpacing: '-0.3px', marginBottom: 4 }}>
            KB<span style={{ color: '#534AB7' }}>CBP</span>
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.3px',
              color: '#FFFFFF', background: '#534AB7', borderRadius: 4,
              padding: '2px 6px', marginLeft: 8, verticalAlign: 'middle',
            }}>ADMIN</span>
          </div>
          <div style={{ fontSize: 13, color: '#9C9A92' }}>Sign in to manage invoices</div>
        </div>
        <AdminLoginForm />
      </div>
    </div>
  )
}

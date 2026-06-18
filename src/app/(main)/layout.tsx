import AppBar from '@/components/kbcbp/app-bar'
import { getSessionUser } from '@/lib/auth'
import { redirect } from 'next/navigation'

// Shared shell for Budget Entry, Approvals and Invoices. The AppBar lives here
// once and applies to every page in this route group automatically. The proxy
// already gates access; this is defense-in-depth and gives the AppBar the user.
export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  // Approvers get a single workspace: the approve/reject page. They don't see
  // Budget Entry, client grids or draft creation at all — bounce them there.
  if (user.role === 'approver') redirect('/admin')

  return (
    <div className="min-h-screen font-sans bg-kb-bg">
      <AppBar name={user.name} role={user.role} />
      {children}
    </div>
  )
}

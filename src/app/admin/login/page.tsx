import { redirect } from 'next/navigation'

// The old standalone admin login is gone — there is now a single sign-in page
// for everyone. Keep this route working by sending it to /login.
export default function AdminLoginPage() {
  redirect('/login')
}

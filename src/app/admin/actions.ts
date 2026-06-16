'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

export async function adminLogin(
  email: string,
  password: string
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { data: admin } = await supabase
    .from('admins')
    .select('id, name')
    .eq('email', email)
    .eq('password', password)
    .single()

  if (!admin) return { error: 'Invalid email or password' }

  const cookieStore = await cookies()
  cookieStore.set('admin_id', admin.id, { path: '/', maxAge: 60 * 60 * 24 })
  cookieStore.set('admin_name', admin.name, { path: '/', maxAge: 60 * 60 * 24 })

  redirect('/admin')
}

export async function adminLogout() {
  const cookieStore = await cookies()
  cookieStore.delete('admin_id')
  cookieStore.delete('admin_name')
  redirect('/admin/login')
}

export async function getAdmin(): Promise<{ id: string; name: string } | null> {
  const cookieStore = await cookies()
  const id = cookieStore.get('admin_id')?.value
  const name = cookieStore.get('admin_name')?.value
  if (!id || !name) return null
  return { id, name }
}

export async function approveInvoice(invoiceId: string): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('invoices')
    .update({ status: 'approved' })
    .eq('id', invoiceId)

  if (error) return { error: error.message }

  revalidatePath('/admin')
  revalidatePath('/invoices')
  revalidatePath('/')
  return {}
}

export async function rejectInvoice(
  invoiceId: string,
  note: string
): Promise<{ error?: string }> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('invoices')
    .update({ status: 'rejected', approver_note: note || 'Rejected by admin' })
    .eq('id', invoiceId)

  if (error) return { error: error.message }

  revalidatePath('/admin')
  revalidatePath('/invoices')
  revalidatePath('/')
  return {}
}

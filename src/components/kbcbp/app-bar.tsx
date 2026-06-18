'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTransition } from 'react'
import { logout } from '@/lib/auth-actions'
import type { Role } from '@/lib/auth'

const ROLE_LABEL: Record<Role, string> = {
  creator: 'Creator',
  approver: 'Approver',
  admin: 'Admin',
}

function initials(name: string) {
  return name
    .split(/[\s/]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('') || 'U'
}

export default function AppBar({ name, role }: { name: string; role: Role }) {
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  const canApprove = role === 'approver' || role === 'admin'
  const canCreate = role === 'creator' || role === 'admin'

  // Tabs follow what the role can actually do. Approvers never reach this bar
  // (they're routed straight to /admin), so in practice: creators see the two
  // creation tabs, admins additionally see Approvals.
  const tabs = [
    ...(canCreate ? [{ label: 'Budget Entry', href: '/' }, { label: 'Invoices', href: '/invoices' }] : []),
    ...(canApprove ? [{ label: 'Approvals', href: '/admin' }] : []),
  ]

  return (
    <div className="flex items-center gap-1 px-6 py-3 sticky top-0 z-50 bg-kb-surface border-b border-kb-border">
      <div className="font-semibold text-sm tracking-tight mr-3">
        KBP<span className="text-kb-accent">CBP</span>
      </div>
      {tabs.map(item => (
        <Link key={item.label} href={item.href}
          className={`px-3 py-1 rounded-md text-[13px] font-medium no-underline ${
            isActive(item.href)
              ? 'bg-kb-accent-light text-kb-accent-text'
              : 'bg-transparent text-kb-fg-2'
          }`}>
          {item.label}
        </Link>
      ))}
      <div className="flex-1" />
      <div className="flex flex-col items-end mr-2.5 leading-tight">
        <span className="text-xs font-medium text-kb-fg-2">{name}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-kb-accent-text">
          {ROLE_LABEL[role]}
        </span>
      </div>
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold bg-kb-accent text-white">
        {initials(name)}
      </div>
      <button
        onClick={() => startTransition(() => logout())}
        disabled={isPending}
        className="ml-3 px-3 py-1 rounded-md border border-kb-border bg-kb-surface text-kb-fg-2 text-[12px] font-medium font-sans cursor-pointer disabled:opacity-60"
      >
        {isPending ? '…' : 'Sign Out'}
      </button>
    </div>
  )
}

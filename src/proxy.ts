import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

// Next.js 16 renamed `middleware` to `proxy` (same mechanism). This gates the
// whole app behind Supabase Auth and keeps the session token fresh.
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // Run on everything except Next internals and static assets, so auth logic
    // never blocks CSS/JS/images.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}

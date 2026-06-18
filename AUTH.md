# Authentication & Authorization

How login, sessions, roles, and data protection work in this app. The system has
**two independent layers**: the **app** (Next.js proxy + server actions) and the
**database** (Supabase Row Level Security). Even if the UI were bypassed, the
database still enforces the rules.

```
Browser  ──cookie: sb-…-auth-token (JWT + refresh token)──►  Next.js
                                                              │
        ┌─────────────────────────────────────────────────────┘
        ▼
   src/proxy.ts        "is there a valid user?"  → no → redirect /login
        │
        ▼
   layout / page       getSessionUser()          → who you are + your role
        │              role-based redirects
        ▼
   Supabase Postgres   RLS policies use your JWT  → allow / deny each row
```

---

## The roles

| Action | Creator | Approver | Admin |
|---|:--:|:--:|:--:|
| Budget Entry, build & save drafts | ✅ | ❌ | ✅ |
| Submit invoice for review | ✅ | ❌ | ✅ |
| Approve / Reject | ❌ | ✅ | ✅ |
| Send approved invoice to QuickBooks | ✅ | ✅ | ✅ |
| Delete an invoice | ❌ | ❌ | ✅ |

A role lives in `public.profiles.role` (one row per user, keyed to `auth.users.id`).
Roles are assigned in SQL only — never from the app:

```sql
update public.profiles set role = 'approver' where email = 'boss@kb.com';
```

The helpers in `src/lib/auth.ts` are the single source of truth:

```ts
export const canApprove = (role) => role === 'approver' || role === 'admin'
export const canCreate  = (role) => role === 'creator'  || role === 'admin'
export const canSendToQuickbooks = (role) => true // any signed-in role
```

---

## 1. First time: user enters credentials → lands on their page

1. User opens any URL. `src/proxy.ts` sees no session and redirects to **`/login`**.
2. They submit the form, which calls the `login` server action (`src/lib/auth-actions.ts`):

   ```ts
   export async function login(email, password) {
     const supabase = await createClient()
     const { error } = await supabase.auth.signInWithPassword({ email, password })
     if (error) return { error: error.message }
     redirect('/')
   }
   ```

3. `signInWithPassword` sends the credentials to Supabase Auth. Supabase compares the
   password against the **bcrypt hash** in `auth.users`. On success it returns a
   **session** (a JWT access token + a refresh token) and `@supabase/ssr` writes it
   into cookies.
4. The action redirects to `/`. Then **role-based routing** kicks in:
   - **Creator / Admin** → stay on `/` (Budget Entry).
   - **Approver** → `src/app/(main)/layout.tsx` immediately redirects them to
     **`/admin`** (the approve/reject workspace). Approvers never see Budget Entry.

   ```ts
   // src/app/(main)/layout.tsx
   const user = await getSessionUser()
   if (!user) redirect('/login')
   if (user.role === 'approver') redirect('/admin')
   ```

So the "where do I land" decision is made by the role check in the layout, not by
the login form.

---

## 2. Coming back later on the same browser → automatic login

The session lives in cookies (`sb-<project>-auth-token`), so the browser sends it on
**every** request automatically. On each request `src/proxy.ts` runs first:

```ts
// src/lib/supabase/proxy.ts (called by src/proxy.ts)
const { data: { user } } = await supabase.auth.getUser()

if (!user && !isPublic) {            // no session → force login
  return NextResponse.redirect(new URL('/login', request.url))
}
if (user && path === '/login') {     // already logged in → leave the login page
  return NextResponse.redirect(new URL('/', request.url))
}
```

Two things happen here that make "auto-login" work:

- **`getUser()` validates the JWT** against Supabase (not just trusting the cookie).
- **It silently refreshes the token.** The access token only lives ~1 hour, but
  `getUser()` uses the long-lived **refresh token** to mint a new one when needed,
  and writes the fresh cookie back onto the response. As long as the user keeps
  visiting, the session rolls over indefinitely — **they stay logged in long-term
  and are never asked to log in again** on the same browser.

If they open `/login` while already signed in, the proxy bounces them straight back
into the app.

---

## 3. How a change request is sent (and protected per action)

When a logged-in user clicks e.g. **Approve**, a **server action** runs on the server.
The Supabase client attaches the user's **JWT** to the database call, so Postgres
knows exactly who is asking. Every sensitive action is guarded **twice**:

### Layer A — the server action checks the role

```ts
// src/app/(main)/invoices/actions.ts
export async function updateInvoiceStatus(id, status) {
  const user = await getSessionUser()
  if (!user) return { error: 'Not signed in' }

  // Approving/rejecting is approver-only; submitting is creator-only.
  if (status === 'approved' || status === 'rejected') {
    if (!canApprove(user.role)) return { error: 'Only approvers can approve or reject' }
  } else if (!canCreate(user.role)) {
    return { error: 'Only creators can submit invoices' }
  }

  const supabase = await createClient()
  await supabase.from('invoices').update({ status }).eq('id', id)
}
```

This is where the **status-transition rule** lives (which role may move which status),
because it depends on the *target* status. A creator trying to set `approved` is
stopped here, before the database is even touched.

### Layer B — the database (RLS) is the backstop

Even a direct DB call (outside the app) is checked by Row Level Security. See below.

> Invoices are **created** from the Budget Entry grid (`budget/actions.ts`
> `createDraftFromBudget`), which applies the card/commission rules. The old
> standalone "New Invoice" form was removed — there is no manual create path.

---

## 4. How the database protects each action (RLS)

**Mechanism:** once a table has `enable row level security`, it **denies everything
by default**; each *policy* re-opens a specific slice. The Supabase client sends the
user's JWT with each query, so inside a policy:

- `auth.uid()` = the logged-in user's id (from the JWT).
- `public.app_role()` = that user's role, looked up from `profiles`:

  ```sql
  create function public.app_role() returns text
  language sql stable security definer set search_path = public
  as $$ select role from public.profiles where id = auth.uid(); $$;
  ```

  (`security definer` lets it read `profiles` without tripping `profiles`' own RLS.)

### Policy on every table (migration `008_supabase_auth_roles.sql`)

| Table | Operation | Policy | Why |
|---|---|---|---|
| `profiles` | SELECT | `id = auth.uid() or app_role()='admin'` | You read only your own profile; admins read all. Roles can't be self-changed from the app. |
| `clients` | ALL | `to authenticated` (`true`) | Reference data any signed-in user needs. |
| `client_services` | ALL | `to authenticated` (`true`) | Same. |
| `budget_entries` | ALL | `to authenticated` (`true`) | Creators save spend numbers here. |
| `invoices` | SELECT | `true` (authenticated) | Everyone signed in can see the list. |
| `invoices` | INSERT | `app_role() in ('creator','approver','admin')` | Only these roles can create. |
| `invoices` | UPDATE | `app_role() in ('creator','approver','admin')` | Role gate; transition rule enforced in the action. |
| `invoices` | DELETE | `app_role() = 'admin'` | Only admin can delete. |

Example policy:

```sql
create policy invoices_insert on public.invoices
  for insert to authenticated
  with check (public.app_role() in ('creator', 'approver', 'admin'));
```

- `to authenticated` → must be logged in (valid JWT). A logged-out request matches
  **no** policy and gets nothing.
- `with check (...)` → the row is allowed only if **your** role passes.

**Why two layers?** RLS gates *who may touch the table by role*. The finer rule —
"a creator may submit but not approve" — depends on old-vs-new status, which is clean
in the action and messy in RLS. So: **RLS = role gate at the DB; server action =
transition rule in the app.**

---

## 5. How the navbar is hidden per role

The top bar (`src/components/kbcbp/app-bar.tsx`) is a client component that receives
the user's `role` as a prop from `(main)/layout.tsx`. It builds its tabs from what the
role can do — it doesn't render tabs the role can't use:

```tsx
const canApprove = role === 'approver' || role === 'admin'
const canCreate  = role === 'creator'  || role === 'admin'

const tabs = [
  ...(canCreate  ? [{ label: 'Budget Entry', href: '/' }, { label: 'Invoices', href: '/invoices' }] : []),
  ...(canApprove ? [{ label: 'Approvals', href: '/admin' }] : []),
]
```

Result:
- **Creator** → `Budget Entry`, `Invoices`.
- **Admin** → `Budget Entry`, `Invoices`, `Approvals`.
- **Approver** → never sees this bar at all (they're routed straight to `/admin`,
  which has its own minimal header).

**Important:** hiding a tab is only *cosmetic*. The real protection is the page
guards + RLS below — a hidden tab is not a security boundary on its own.

---

## 6. Are the pages actually protected? (Can an approver open Budget Entry?)

**Yes, the pages are protected — and no, an approver cannot open Budget Entry**, even
by typing the URL directly. There are three guard checkpoints, outermost to innermost:

**① `src/proxy.ts`** — runs on every request: logged in or not?
```ts
if (!user && !isPublic) redirect('/login')   // gate the whole app
```

**② `src/app/(main)/layout.tsx`** — wraps Budget Entry + Invoices:
```ts
if (!user) redirect('/login')
if (user.role === 'approver') redirect('/admin')   // approver can't reach creator pages
```

**③ `src/app/admin/page.tsx`** — the approval page:
```ts
if (!user) redirect('/login')
if (!canApprove(user.role)) redirect('/')          // creator hitting /admin → back to Budget Entry
```

So if an **approver** manually visits `/` or `/invoices`:
```
proxy: logged in? yes
  → (main) layout: role === 'approver'? yes → redirect /admin
```
They are bounced to their approval page every time. And a **creator** who tries
`/admin` is bounced back to `/`. The redirects happen on the **server** before any
page content is sent, so there's nothing to peek at.

---

## File map

| File | Responsibility |
|---|---|
| `supabase/migrations/008_supabase_auth_roles.sql` | `profiles` table, role trigger, `app_role()`, RLS policies |
| `supabase/migrations/009_seed_test_users.sql` | Three test logins (creator/approver/admin) |
| `src/lib/supabase/server.ts` | Server Supabase client (reads/writes session cookies) |
| `src/lib/supabase/proxy.ts` | Session refresh + redirect logic |
| `src/proxy.ts` | Next 16 proxy entry point (was "middleware") |
| `src/lib/auth.ts` | `getSessionUser()`, `canApprove/canCreate/...` helpers |
| `src/lib/auth-actions.ts` | `login()` / `logout()` server actions |
| `src/app/login/page.tsx` | The single sign-in page (no signup) |
| `src/app/(main)/layout.tsx` | Auth + approver→/admin routing for creator pages |
| `src/app/admin/page.tsx` | Approve/reject workspace (approver/admin only) |

## Test logins

| Email | Password | Role |
|---|---|---|
| `creator@kb.com` | `password123` | creator |
| `approver@kb.com` | `password123` | approver |
| `admin@kb.com` | `password123` | admin |

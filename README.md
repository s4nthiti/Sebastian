# Sebastian

Sebastian is a private household operating system for money, schedules, reminders, plans, recipes, and meal planning. The interface supports English and Thai, light/dark themes, collaborative household membership, realtime changes, and an immutable activity trail.

## What is included

- A responsive Next.js App Router application styled with Radix primitives and custom design tokens
- English / Thai interface switching and light / dark / system themes
- Finance dashboard with income, expenses, net balance, category visualization, weekly/monthly/yearly views, transaction entry, and installment debt tracking
- Combined calendar model for events, reminders, planning, money, and daily meal plans
- Recipe library with image-ready Supabase Storage configuration
- Google OAuth, an invite-only household, and `s4nthiti@gmail.com` as the bootstrap owner
- PostgreSQL row-level security, realtime publication, role-based membership, and automatic audit logs
- A polished demo mode that works without cloud credentials

## Run locally

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`. With no `.env.local`, Sebastian intentionally starts in demo mode.

## Connect Supabase

1. Create a free Supabase project in the Singapore region (closest common region to Thailand).
2. Open the SQL editor and run `supabase/migrations/202608240001_initial_schema.sql`.
3. In Authentication → Providers, enable Google and add the OAuth client ID and secret from Google Cloud Console.
4. In Authentication → URL Configuration:
   - Site URL: `http://localhost:3000` for local development, then your Vercel production URL.
   - Redirect URLs: add `http://localhost:3000/auth/callback` and `https://YOUR_DOMAIN/auth/callback`.
5. Copy `.env.example` to `.env.local` and fill in the project URL, publishable key, and service-role key.
6. Sign in first with `s4nthiti@gmail.com`. The database trigger creates the initial household and makes this account the owner.

The service-role key is used only by the server invitation endpoint. Never prefix it with `NEXT_PUBLIC_` or expose it to browser code.

## Google OAuth setup

In Google Cloud Console, create a Web application OAuth client. Add the Supabase callback shown under Supabase Authentication → Providers → Google as an authorized redirect URI. Supabase completes the provider exchange, then redirects the browser to Sebastian’s `/auth/callback` route.

## Deploy to Vercel

1. Push this folder to a Git repository and import it in Vercel.
2. Add all four variables from `.env.example` in Vercel Project Settings → Environment Variables.
3. Set `NEXT_PUBLIC_SITE_URL` to the production origin, without a trailing slash.
4. Add the production callback URL to Supabase’s redirect allow-list.
5. Deploy, then perform the first sign-in with the master account.

## Data and access model

- A user may belong to a household as `owner`, `admin`, `member`, or read-only `viewer`.
- Members collaborate on finance, calendar, recipe, and meal-plan rows. Row-level security prevents access outside their household.
- Only owners and admins can invite or manage members.
- Every insert, update, and delete on household content produces an audit-log record.
- Recipe images are restricted to JPEG, PNG, or WebP and 5 MB. Paths begin with the household ID.
- Realtime subscriptions notify clients of changes; authorization is still enforced by RLS.

## Sensible next iterations

1. Replace remaining sample summaries/cards with live aggregate queries and optimistic updates.
2. Add recurring transactions and recurring calendar events, including a scheduled reminder worker.
3. Add receipt OCR only after core finance entry is stable; an optional free-tier vision service can be evaluated then.
4. Add recipe ingredient scaling and a shared shopping list.
5. Add CSV import/export and encrypted periodic backups before storing long-term financial history.
6. Add browser and database tests around RLS, invitations, and money calculations before production use.

## Project notes

The requested `AGENTS.md` points to `RTK.md`, but `RTK.md` was not present in the workspace when the project was created. Add that file if it contains additional repository-specific rules.

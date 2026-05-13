# Helm Beta Tester Site

Web app for coordinating Helm's beta testers. React 19 + Vite 8 + TypeScript +
Tailwind v4 + Supabase + Netlify.

## What this app does

- **Admin (you):** invite testers, manage test cycles, triage bug reports,
  publish patch notes for the current beta, manage a Help Library, and review
  feedback + suggestions.
- **Testers (logged-in):** see the current beta version + patch notes on a
  dashboard, report bugs (with screenshots), browse the Help Library, and
  submit / view feature suggestions.

Schema is multi-project from day one (every relevant row has a `project_id`),
but the UI is single-project in v1 — adding a second project later is a UI
change, not a migration.

## Setup

### 1. Node

Use Node LTS (currently 20.x). If you use `nvm`:

```bash
nvm install --lts
nvm use --lts
```

Keep this folder OUT of iCloud Drive, OneDrive, and Dropbox — they break HMR
and occasionally corrupt `node_modules`.

### 2. Install deps

```bash
npm install
```

### 3. Create the Supabase project

1. Go to [supabase.com](https://supabase.com) → New project.
2. **SQL editor → New query → paste `supabase/schema.sql` → Run.**
3. **Storage → New bucket → name `bug-attachments`, Public bucket: OFF.**
4. **SQL editor → New query → paste `supabase/storage.sql` → Run.**
5. Create your admin auth user: **Authentication → Add user → Send invite**
   (use your own email).
6. After accepting the invite and setting a password, grab your user id:

   ```sql
   select id, email from auth.users;
   ```

7. Seed the Helm project (replace the uuid):

   ```sql
   insert into projects (name, slug, description, owner_id)
   values ('Helm', 'helm', 'Tauri desktop home-maintenance app',
           '<your-auth-user-id>');
   ```

### 4. Local env

Copy `.env.local.example` to `.env.local` and fill in your Supabase URL and
anon key (Project settings → API). **Vite only auto-loads `.env.local`, not
`.env` — don't rename it.**

```
VITE_SUPABASE_URL=https://YOUR-REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

### 5. Run

```bash
npm run dev
```

Open the printed URL, sign in with your admin email/password, and you should
land on the dashboard with the admin sidebar.

### 6. Deploy Edge Functions

The app uses five Supabase Edge Functions:

- `invite-tester` — sends Auth invites (admin only)
- `link-tester-account` — links new signups to pending tester rows
- `notify-bug-submitted` — tester ack + admin alert
- `notify-suggestion-submitted` — tester ack + admin alert
- `notify-feedback-submitted` — tester ack + admin alert

Install the [Supabase CLI](https://supabase.com/docs/guides/local-development),
log in (`supabase login`), link the project (`supabase link --project-ref
<ref>`), then deploy:

```bash
supabase functions deploy invite-tester
supabase functions deploy link-tester-account
supabase functions deploy notify-bug-submitted
supabase functions deploy notify-suggestion-submitted
supabase functions deploy notify-feedback-submitted
```

Set function env vars in the Supabase dashboard
(**Edge Functions → \<function> → Secrets**) or via CLI:

```bash
supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set RESEND_FROM='Helm Beta <noreply@your-domain.com>'
supabase secrets set ADMIN_NOTIFICATION_EMAIL=you@your-domain.com
supabase secrets set PUBLIC_SITE_URL=https://your-netlify-domain.netlify.app
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are
provided automatically by the Edge runtime.

### 7. GitHub + Netlify

1. Create a GitHub repo and push.
2. In Netlify: **Add new site → Import from Git → pick the repo.**
3. Build command: `npm run build`. Publish directory: `dist`. (Already in
   `netlify.toml`.)
4. **Site settings → Environment variables:** set `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`.
5. Once deployed, set `PUBLIC_SITE_URL` in the Supabase function secrets to
   your Netlify URL so invite-link redirects point to the live site.

## Project structure

```
src/
  App.tsx                  routing
  main.tsx                 React entry + providers (Router, QueryClient, Auth)
  index.css                Tailwind v4 entry + typography plugin
  types/index.ts           shared TS types + constants (mirrors schema enums)
  lib/
    supabase.ts            client (reads VITE_SUPABASE_* env)
    testers.ts             list/get/invite/update
    cycles.ts              list/get/create/update + junction
    bugs.ts                admin + tester reads, submit, status updates
    feedback.ts            list/submit
    suggestions.ts         admin + tester reads, submit
    appVersions.ts         current beta + patch notes
    helpArticles.ts        TipTap-backed Help Library
    attachments.ts         Supabase Storage wrapper (image only, 5 MB cap)
  contexts/AuthContext.tsx user/session/loading/signOut + isAdmin + tester
  components/
    Layout.tsx             sidebar + header + Outlet (mobile hamburger)
    Sidebar.tsx            role-conditional nav (admin vs tester)
    ProtectedRoute.tsx     auth gate + optional admin gate
    LoadingSpinner.tsx
    PagePlaceholder.tsx    used until each feature page is implemented
  pages/
    Login.tsx
    Welcome.tsx            post-invite "set your password" flow
    Dashboard.tsx          role-conditional content
    tester/                ReportBug, MySubmissions, HelpLibrary, HelpArticleView, Suggestions
    admin/                 Testers, TestCycles, BugTriage, BugDetail (outside Layout),
                           Feedback, PatchNotes, HelpLibraryAdmin,
                           HelpArticleEdit (outside Layout), SuggestionsTriage, Settings

supabase/
  schema.sql               all tables, RLS, views, triggers
  storage.sql              bug-attachments bucket policies
  functions/
    _shared/               cors, resend, supabase clients
    invite-tester/
    link-tester-account/
    notify-bug-submitted/
    notify-suggestion-submitted/
    notify-feedback-submitted/
```

## Build order

Per the original spec — done first three; remaining steps are the actual
feature pages (currently placeholders).

1. ✅ Architecture decisions
2. ✅ Schema sign-off
3. ✅ Scaffold + auth + app shell
4. Push to GitHub → connect Netlify
5. Implement pages in order: Testers → Test Cycles → Bug Reports → Feedback
   → Suggestions → Patch Notes → Help Library → Dashboard

## Gotchas (kept here so the next person doesn't re-learn them)

**Tailwind v4**
- `src/index.css` is `@import "tailwindcss";` + `@plugin "@tailwindcss/typography";`.
  Do NOT use the v3 `@tailwind base/components/utilities` directives — they
  break the v4 build silently. (`@plugin` is the v4-native way to register
  plugins; it is not the same thing as the v3 directives.)
- There is no `tailwind.config.js`.

**Supabase**
- Use `.env.local`, not `.env` — Vite only auto-loads `.env.local`.
- RLS policies need BOTH `USING` and `WITH CHECK`, or inserts will fail
  silently. The schema in this repo has both.
- Avoid `.maybeSingle()` on queries that could return multiple rows — it
  throws. Use `.order(...).limit(1)` and `data?.[0]` instead. Every wrapper
  in `src/lib/` follows that pattern.
- When seeding long text via the SQL editor, use dollar-quoting:
  `$content$...$content$` instead of single quotes.

**Routing / Navigation**
- Internal nav: always `navigate('/path')`, never `window.open(..., '_blank')`.
- Pages with their own fixed full-screen toolbar (e.g. `BugDetail`,
  `HelpArticleEdit`) are registered OUTSIDE the Layout in `App.tsx`,
  otherwise the toolbar overlays the Layout header.
- `public/_redirects` (`/*  /index.html  200`) is required for Netlify SPA
  routing. Without it, any direct URL or refresh returns 404.

**TypeScript**
- `npm run typecheck` after any significant change. Vite's dev server does
  not block on type errors.

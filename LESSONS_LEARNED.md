# Lessons Learned — Helm Beta Tester Site

Living retrospective for this build. Each entry distills a mistake, the fix, and the principle so future work doesn't repeat it. Add to this; don't rewrite history. Date entries. Note the feature or sub-task where the issue surfaced.

> **Origin:** the first three-quarters of this file was copied from the consulting practice app's `LESSONS_LEARNED.md` because most lessons there apply to any React + Supabase + Netlify project on Stephen's stack. The "Helm Beta Tester Site — Build Lessons" section at the bottom contains entries specific to this project.

---

## Environment & Developer Setup

### Verified working Mac toolchain (2026-04-30)

Clean MacBook Pro (Apple Silicon / arm64) setup completed successfully with these versions — use as a baseline for any fresh Mac setup on this project:

| Tool | Version |
|---|---|
| Homebrew | 5.1.8 |
| Node.js (LTS) | v24.15.0 |
| npm | 11.12.1 |
| git | 2.50.1 (Apple Git-155) |
| VS Code | 1.118.1 |
| Supabase CLI | 2.95.4 |
| Netlify CLI | 26.0.0 |

**Install order that worked:** Xcode CLT → Homebrew → nvm (via brew) → Node LTS → git config → VS Code → Supabase CLI (via brew tap) → Netlify CLI (via npm -g)

---

### GitHub no longer accepts HTTPS password auth — use SSH (2026-04-30)

`git push` over HTTPS with a GitHub password fails with "Invalid username or token. Password authentication is not supported." GitHub removed password auth for git operations in 2021.

**Fix (one-time per machine):**
1. `ssh-keygen -t ed25519 -C "your@email.com"` — generate key, accept defaults
2. `eval "$(ssh-agent -s)" && ssh-add ~/.ssh/id_ed25519` — add to agent
3. `cat ~/.ssh/id_ed25519.pub` — copy output
4. GitHub → Settings → SSH Keys → New SSH key → paste
5. `git remote set-url origin git@github.com:USERNAME/REPO.git` — switch remote to SSH

**Principle:** always set up SSH on a new machine before the first push. HTTPS with a token also works but SSH is simpler to maintain long-term and doesn't expire.

### Tailwind v4 removed `init` command and `tailwind.config.js` (2026-04-30)

`npx tailwindcss init -p` fails with "could not determine executable to run" when Tailwind v4 is installed. v4 dropped the config file and init command entirely — it uses a Vite plugin instead.

**Fix:**
```bash
npm uninstall tailwindcss postcss autoprefixer
npm install -D tailwindcss @tailwindcss/vite
```
In `vite.config.ts`, add `import tailwindcss from '@tailwindcss/vite'` and `tailwindcss()` to the plugins array. In `src/index.css`, replace all content with `@import "tailwindcss";`. No config file needed.

**Principle:** Tailwind v4 is a breaking change from v3. Any tutorial or doc written before 2025 will show the old setup. Use the `@tailwindcss/vite` plugin path for all new Vite projects.

---

### Never put a code repo on OneDrive / Dropbox / iCloud

OneDrive's sync agent fights with git: it locks files for upload while git is mid-write, produces conflict-named copies of objects in `.git/`, and silently corrupts repos. Symptoms: `git status` showing files as both modified and "incoming," random `.git/objects/` corruption, push/pull errors that don't match any normal git failure mode.

**Fix:** relocate to a path NOT under any cloud-sync root. On Windows, `C:\Users\<name>\Documents\Claude\Projects\` is fine; `C:\Users\<name>\OneDrive\Documents\...` is not.

**Principle:** any tool that creates large numbers of small files in tight succession (git, npm) is incompatible with cloud sync. Move BEFORE the first commit.

### Cowork sandbox cannot push to GitHub — always run git commands from your own terminal

The Cowork bash sandbox runs on a separate Linux VM. It mounts your project folder read/write, but `.git/` operations that touch native git object files fail silently or produce "Operation not permitted" warnings. `git add` may appear to succeed but `git commit` and `git push` will not actually update the remote repo.

**Fix:** always run the following directly in your Mac terminal (not through Claude's bash tool):
```
git add -A
git commit -m "your message"
git push
```
Claude can confirm which files changed and suggest the commit message, but you must execute the push yourself.

**Principle:** the sandbox is for file editing and running build checks (`tsc`, `npm install`, etc.). It is not a git client. After any context compaction, verify the git state manually — don't assume a push happened just because the previous session described one.

### `npm install` doesn't reconcile a cross-platform `node_modules` tree

A `node_modules/` populated on Linux carried to Windows won't fetch win32-x64 native bindings. npm sees the existing tree and assumes it's correct.

**Fix:** delete both `node_modules/` and `package-lock.json`, then `npm install` fresh.

**Principle:** binary-platform-specific dependencies need a clean install per OS. Never copy `node_modules` across machines or platforms.

---

## Web App / Frontend Gotchas

### Cowork can only write files inside the connected workspace folder

Claude's file tools (Read/Write/Edit) are scoped to the connected workspace folder. Any project scaffolded outside that folder cannot be written to directly. Files written elsewhere have to be manually copied.

**Fix:** keep the active project inside the connected workspace folder from the start.

**Principle:** scaffold new projects inside the Cowork workspace folder. Moving mid-project works but costs extra cleanup steps.

### `mv` into an existing destination nests instead of merging

When moving a project into a folder where the destination already exists, `mv source destination` moves source *into* destination rather than replacing it — creating `app/app/`. No error is shown.

**Fix:** check if the destination exists before `mv`. If it does, remove it first or use a temp name.

**Principle:** `mv` on macOS is not a merge — it nests. Always verify the destination is clear before moving a folder into it.

### Pasting long code blocks into VS Code from chat truncates lines

Chat interfaces wrap long lines visually. When copying multi-line code with long strings (e.g., long Tailwind class strings) from a chat response and pasting into VS Code, lines can be silently truncated at the wrap point — producing a parse error like "Unterminated string."

**Fix:** when a file needs to be replaced entirely, Claude writes it to the workspace folder and the user copies it with `cp` rather than pasting from chat.

**Principle:** never ask the user to paste more than ~20 lines of code from chat. For full file replacements, use the Write tool.

### Don't ship two source files whose names case-fold to the same identifier

On Windows and default-config macOS, the filesystem is case-insensitive. Two files like `ServiceCard.tsx` and `serviceCard.ts` in the same directory are the same name as far as the OS is concerned. Vite's module resolver can return the wrong file — creating a circular import that returns `undefined` at first evaluation and causes a **silent blank white screen**.

**Fix:** ensure no two source files in the same directory case-fold to the same identifier. Use a naming convention:
- Components in PascalCase (`ServiceCard.tsx`)
- Non-component modules with a distinct suffix (`serviceCardIpc.ts`, `useServiceCard.ts`)

**Principle:** assume the lowest-common-denominator filesystem (case-insensitive) for all cross-platform projects. CI on Linux won't catch this.

### CSS theme tokens: separate role from value

Name tokens by **role** ("urgent," "secondary brand," "muted text") rather than by appearance ("orange," "blue"). One token doing two semantic jobs breaks when you add a second theme — the same color value may not work for both roles in the new palette.

**Fix:** give each semantic role its own CSS variable. The test: "Could these two roles ever need different values in the same theme?" If yes, they're two tokens.

**Principle:** when a theme token is doing two jobs that could need different values per theme, split it.

---

## Data & Schema Design

### Audit value shape, not just key presence

When typing a schema from real data (e.g., a client form submission, an API response), audit BOTH:
1. Does each field exist? (key presence)
2. What value type does each field hold? (shape — string vs list vs map vs nested object)
3. For lists: what are the element types?
4. For maps: what are the key+value types?

**Principle:** strong types catch typos at compile time, but only if the types match the data. The audit bridges the two — and it has to look at values, not just keys.

---

## Process & Planning

### Front-load architectural decisions before coding

Before any non-trivial implementation phase, write out the decisions that need answers — even if you have a recommended default for each — and confirm before opening the editor.

**Fix:** enumerate decisions, recommend defaults, wait for "go" or redirects before writing code.

**Principle:** the cost of pausing to confirm decisions is one round-trip. The cost of rework when an assumption was wrong is potentially the entire phase.

### The same rule applies WITHIN a sub-task, not just at phase scoping

Phase-level decisions front-load the high-level shape, but every sub-task still has implementation-level choices that didn't make it into the plan: which file to put a new helper in, state shape, event handler placement, visual aesthetics of small affordances, disabled-state styling. Each is small individually; collectively they shape the diff.

**Fix:** before any sub-task involving more than ~2 file edits, write a short (under 200 words) options block enumerating the implementation-level decisions about to be made — with a recommendation for each. Stop. Wait for "go" or redirects. If a sub-task is trivial, say so explicitly ("trivial — proceeding") rather than silently skipping the check-in.

**Principle:** "decisions are settled" at the plan level doesn't mean "no decisions remain" at the implementation level. The cost of one round-trip is fixed; the cost of rework scales with edit count.

### Capture cross-phase TODOs in one index doc, not scattered code comments

`TODO` comments scattered across modules are unfindable later. `grep TODO` returns dozens of stale items after a few weeks.

**Fix:** write each cross-phase TODO into `DECISIONS.md` (or a similar single index doc) as a numbered entry with: what was decided, why it was deferred, and pseudocode or description of the eventual fix.

**Principle:** make deferred work findable from one place. Code comments are for explaining *what the code does*, not for tracking *what other code should eventually do*.

### Form complexity should collapse to what the system actually uses

Form fields should reflect *what the engine currently uses*, not *what the data model could theoretically support*. When in doubt, collapse to the minimum number of distinctions that produce different downstream behavior.

**Principle:** over-asking for data the system doesn't exploit yet is a UX cost with no current value.

### Welcome user pushback on UX decisions during implementation, not just at scoping

Locking design at scoping and treating implementation as pure execution loses the most valuable feedback loop. The most useful input often surfaces while touching real code — not during abstract planning.

**Principle:** the valuable feedback loop runs *through* implementation, not just before it.

### Run automated tests on every gate, even non-test-heavy phases

A stale assertion can ride undetected for weeks if `npm test` / `cargo test` isn't part of every sign-off gate. It only surfaces when you finally look — often at the worst time.

**Fix:** every phase gate, even ones whose primary verification is "page loads and renders," includes a test run as a step.

**Principle:** the cost of running tests is near-zero. The cost of stale assertions is hours of debugging much later. Tests that aren't run silently rot.

### Phase notes pattern: "delete after sign-off"

Transient implementation docs should declare their own end-of-life condition in their first paragraph. "Delete after Phase X is signed off" is enough. Keeps working directories clean.

**Principle:** transient docs should have a clearly stated expiration.

### Take docs at face value before pattern-matching

When a doc predicts an issue with a recipe, run the recipe; if it doesn't work, the diagnosis was incomplete, not the recipe wrong. Look for the underlying reason before re-trying variations.

**Principle:** "the doc predicted this but the fix doesn't help" is high-signal — it means there's a deeper issue the doc didn't anticipate. Treat that as a flag to investigate, not a reason to retry with variations.

---

## Helm Beta Tester Site — Build Lessons

Entries below are specific to this project. Dates are in 2026.

### Verify npm dependency versions against the registry — never write them from memory (2026-05-12, scaffold)

Wrote `package.json` with `@vitejs/plugin-react@^4.3.4` from training-data memory. That major peers on Vite 4–7; we'd specified Vite 8. `npm install` failed with `ERESOLVE`. Current at the time was `@vitejs/plugin-react@^6.0.0`, which peers on Vite 8.

**Fix:** before writing any dependency block for a project on bleeding-edge majors, hit `https://registry.npmjs.org/<pkg>/latest` or `npm view <pkg> peerDependencies` for the toolchain anchors — at minimum the bundler plugin and framework plugins. Pick version ranges that satisfy each other's peers.

**Principle:** training-data versions go stale fast. The registry is the only source of truth for current compatibility.

### Tailwind v4 needs the `vite/client` types reference (2026-05-12, scaffold)

Skipped creating `src/vite-env.d.ts` in the scaffold. The first `npm run build` failed with `Property 'env' does not exist on type 'ImportMeta'` and `Cannot find module './index.css'` errors. Vite's create-vite template includes this file by default; rolling your own scaffold needs to include it explicitly.

**Fix:** create `src/vite-env.d.ts` with:
```ts
/// <reference types="vite/client" />
```
Optionally augment `ImportMetaEnv` with your project-specific env var types for autocomplete.

**Principle:** when scaffolding a Vite project from scratch (not via `npm create vite`), add this file as a first-class step. It enables `import.meta.env`, side-effect CSS imports, and other Vite-specific types.

### TypeScript 6 deprecated `baseUrl`; remove it from tsconfig (2026-05-12, scaffold)

Included `"baseUrl": "."` + `"paths": { "@/*": ["src/*"] }` in `tsconfig.app.json` out of habit. TS 6 emits a hard error: `TS5101: Option 'baseUrl' is deprecated and will stop functioning in TypeScript 7.0`. Build fails.

**Fix:** if you're not actually using `@/...` path aliases, remove the entire `baseUrl` + `paths` block. If you ARE using aliases, `paths` alone works in TS 6 — no `baseUrl` needed.

**Principle:** TS 6 stricter deprecation enforcement means tsconfig snippets from older guides need a once-over before paste.

### Stage all dirty files when committing across multiple edits (2026-05-12, scaffold)

After a multi-round series of edits across several files, told the user `git add <one specific file>` instead of `git add -A`. The other dirty files (a tsconfig fix from a previous round) were left unstaged. The push deployed only the partial fix; Netlify failed on the still-unfixed file.

**Fix:** when prompting `git add ...` after multi-round edits, default to `git add -A` (or `git add .`). `.gitignore` already excludes secrets and `node_modules` — there's no reason to be selective for our workflow.

**Principle:** selective staging is a feature for when you have a specific reason to leave something out. Without that reason, stage everything.

### Test locally before pushing — every time (2026-05-12, Test Cycles)

`npm run dev` is permissive about TypeScript errors. `npm run build` is strict (runs `tsc -b --noEmit && vite build`). Several Netlify build failures were caused by TS errors that `npm run dev` happily ran past.

**Fix:** every feature build ends with the same three steps:
1. In-browser smoke test on `npm run dev`
2. `npm run build` to verify production build is clean
3. Only then `git add -A && git commit && git push`

Don't suggest pushing as soon as code "looks right." Local validation is 5 seconds; a failed Netlify build is 90 seconds plus context switch.

**Principle:** cheap local verification always beats remote failure.

### Self-review code for failure modes before declaring it "verified" (2026-05-13, Testers feature)

Wrote `AuthContext.loadUserContext` that destructured only `data` from every Supabase query, silently swallowing `error`. When an RLS or auth issue caused the projects query to return empty in production, the user got demoted to the tester sidebar with zero diagnostic signal — no way to tell what went wrong. The fix was trivial; the cost of NOT catching it was a full round trip plus loss of trust.

**Fix:** after writing any non-trivial async / auth / RLS code, before saying "this is ready" or "verification pass complete," explicitly ask:
- What happens if this network call fails? Is the error visible or swallowed?
- What happens if this returns empty/null/undefined? Does the user know why?
- Are there race conditions between concurrent async paths writing the same state?
- Have I left silent `catch` blocks or `const { data } = ...` (without `error`) anywhere?
- For each user-visible failure mode, can the user (or me, debugging) tell what went wrong?

**Principle:** "compiles and looks right" is not "verified." Verification means actively probing failure paths.

### Define helper SQL functions AFTER the tables they reference (2026-05-13, schema setup)

The first `schema.sql` placed `is_project_admin()` and `current_tester_in()` near the top — before the `projects` and `testers` tables. PostgreSQL parses `language sql` function bodies at CREATE time, so the functions failed to create with `relation "projects" does not exist`. Same problem with RLS policies that reference other tables.

**Fix:** order schema files so:
1. Extensions, enums, generic helpers (no table refs)
2. Tables created in dependency order
3. Helper functions that reference tables (defined after the tables exist)
4. RLS policies (last, since they may reference both tables and helpers)

**Principle:** `language sql` functions and RLS policies validate referenced relations at definition time, not call time. A function or policy that compiles fine in your head can still fail at CREATE if its references don't exist yet.

### Netlify free tier private-repo single-contributor restriction (2026-05-13, deploy)

Netlify free tier limits PRIVATE repos to one git contributor. When the commit author email differs from the GitHub account linked to the Netlify team, the deploy gets blocked. Hit this because the repo's commit email (`stephen.p.edward@gmail.com`) was a different identity from the Netlify team's primary GitHub identity (`ultimavicious`).

**Fix options:**
1. Make the repo public (no contributor limit). Safe for this codebase — `.env.local` is gitignored, the anon key is meant to be public, and security comes from RLS not obscurity.
2. Add the second email as a known identity at `app.netlify.com/teams/<team>/contributors`.
3. Upgrade to Netlify Pro.

**Principle:** when working with multiple GitHub identities on one machine, the commit-author/Netlify-team mismatch is a real friction point. Either consolidate identities or expect to do option 2 on each new repo.

### Multiple GitHub accounts on one machine need `~/.ssh/config` host aliases (2026-05-13, repo setup)

With two GitHub accounts on the same Mac (`ultimavicious` + `stepedwa23`), each with its own SSH key, the default `git@github.com:...` URL only authenticates as whichever account's key is loaded first by ssh-agent. `git push` to a repo owned by the OTHER account fails with `Permission denied (publickey)`.

**Fix:** add a host alias to `~/.ssh/config`:
```
Host github-helm
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_helm
  IdentitiesOnly yes
```
Then point the repo's remote at the alias:
```bash
git remote set-url origin git@github-helm:stepedwa23/helmhomebetatestersite.git
```
Also set the repo-local commit email so commits attribute to the right account:
```bash
git config user.email "stephen.p.edward@gmail.com"
git config user.name "Stephen"
```

**Principle:** one SSH key per GitHub account, with named host aliases in `~/.ssh/config`. Each repo's remote URL uses the alias matching its owning account.

### Vite snapshots env vars at server start — restart on `.env.local` changes (2026-05-13, local setup)

After editing `.env.local`, running with the dev server already up means Vite keeps using the OLD env vars. Symptom: app keeps hitting the placeholder URL from `.env.local.example` because `VITE_SUPABASE_URL` was never the real value.

**Fix:** every time you edit `.env.local`, stop (Ctrl+C) and restart `npm run dev`.

**Principle:** Vite's env loading is one-shot at boot, not file-watched. Other tools (Next.js, Remix) auto-restart on env changes; Vite does not.

### AuthContext must never hang the spinner forever (2026-05-13, post-deploy debugging)

Initial `AuthContext` had no try/catch around `loadUserContext` and no timeout. A single hung Supabase call left `loading=true` permanently — user stuck on the loading spinner with no recovery path, had to manually clear localStorage.

**Fix:** wrap initial-load auth flow in try/catch/finally. The `finally` clause sets `loading=false` regardless of what happened. Catch the error, log it, clear stale session state so the user lands on `/login` cleanly rather than half-loaded. Removed the explicit 10-second timeout later because it was firing prematurely in production environments where requests legitimately took longer — better to let the user see an indefinite spinner (which tells them something is wrong) than auto-sign-them-out after 10s of valid-but-slow loading.

**Principle:** any async initialization that gates UI rendering must have a guaranteed exit path. `finally { setLoading(false) }` is the minimum bar.

### Surface Supabase query errors instead of swallowing them (2026-05-13, post-deploy debugging)

Same `AuthContext` bug: destructuring `const { data } = await supabase.from(...)...` instead of `const { data, error } = ...`. On RLS rejection or stale JWT, the query returned `{ data: null, error: <object> }`, we ignored the error, set `project = null`, and the user got demoted to tester sidebar with zero diagnostic signal.

**Fix:** every Supabase query in `loadUserContext` (and any other auth-adjacent code) destructures `error` and logs it with `console.error('[Context] <query name> failed', error)`. Add `console.warn` when a query succeeds but returns empty results that imply something is wrong (e.g., logged-in user but no project visible).

**Principle:** silent failures are debt. Network calls in user-facing code paths should always either succeed visibly, fail visibly, or be explicitly documented as fire-and-forget.

### Some Chrome profiles block third-party Supabase requests in opaque ways (2026-05-13, post-deploy debugging)

On Stephen's primary Chrome profile, requests to `*.supabase.co` from the deployed Netlify site hang indefinitely, while:
- Same profile, same site on localhost works fine
- Same site in Safari works fine
- Same site in a fresh Chrome profile MIGHT work (didn't fully confirm)

Disabling all extensions didn't help. Suspected root cause: cached HSTS/connection state, third-party cookie restrictions, or QUIC/HTTP/3 interaction with the user's specific Chrome install.

**Fix (for the user):** use Safari for testing in the short term. For real Chrome users encountering the same issue, the long-term fix is a Supabase custom domain (Pro tier feature) so API calls go through a domain the user controls instead of `*.supabase.co`.

**Principle:** for any client-side app talking to a third-party backend, expect a small fraction of users to have browser-level blocks that are invisible from the server side. Have a workaround (different browser, custom domain) ready.

---

## How to Use This Document

**When starting a new build phase:**
1. Read **Environment & Developer Setup** against the target machine.
2. Skim the relevant framework section for your current stack.
3. Re-read **Process & Planning** before writing the first line of code.

**When wrapping up a work session:**
1. Add new entries in the relevant section. Date them. Note the feature or sub-task.
2. Don't rewrite older entries — they're history.

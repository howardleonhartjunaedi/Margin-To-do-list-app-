# Margin

A calm, fast task manager. Type a task the way you'd say it — `dentist fri 3pm p2 #health` — and Margin files it under the right day, reminds you at the right moment, and keeps everything else quiet.

- **Capture:** natural-language quick add in English and Bahasa Indonesia (dates, times, repeats, priority, projects, labels, estimates), from anywhere with <kbd>Q</kbd>.
- **Views:** Inbox, Today, Upcoming, projects and saved filters, each as a list, board, calendar, timeline or Eisenhower matrix.
- **Reminders:** in-app, Web Push and email, with snooze, quiet hours, repeats and a morning digest.
- **Productivity:** focus timer, habits with streaks, stats, and morning planning / evening review.
- **Together:** shared projects with roles (editor, commenter, viewer), comments and live updates.
- **Integrations:** iCal feed, import/export (text, CSV, JSON), REST API with personal tokens, signed webhooks.
- **Everywhere:** installable PWA that works offline (changes sync when you're back), two languages, light/dark, high contrast, four accents, reduced-motion settings.
- **Optional AI:** "Suggest steps" for a big task and "Sort Inbox", powered by the Claude API, off until a user turns it on.

## Run it locally

Needs Node 22+ (24 recommended). Nothing else: without `DATABASE_URL` it uses an embedded Postgres (PGlite) in `.data/`.

```bash
npm install
```

```bash
cp .env.example .env.local
```

Fill in `BETTER_AUTH_SECRET` (`openssl rand -base64 32`) and, for push, VAPID keys (`npx web-push generate-vapid-keys`). Then:

```bash
npm run dev
```

Open http://localhost:3000. Emails are written to `.data/outbox/` instead of being sent unless `SMTP_URL` is set.

> Stop the dev server with Ctrl+C. The embedded database closes cleanly on SIGINT/SIGTERM; a hard kill can leave `.data/pglite` unreadable (move it aside to start fresh).

## Deploy with Docker

The compose file runs Postgres, the app (Next's standalone server) and Caddy in front for automatic HTTPS and compression.

```bash
cp .env.example .env
```

Set `DOMAIN`, `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET`, the VAPID keys, and `SMTP_URL` / `EMAIL_FROM` for email. Then:

```bash
docker compose up -d
```

Migrations run automatically on start. The reminder scheduler runs inside the app by default; to run it separately (and scale it), set `SCHEDULER=off` and start the worker profile:

```bash
docker compose --profile workers up -d
```

Workers coordinate with `SKIP LOCKED`, so several can run at once.

## Deploy to Netlify

Netlify runs the whole app: pages and the API on Netlify Functions, reminders from a scheduled function (`netlify/functions/tick.mts`, every minute). It needs a hosted Postgres, since functions have no lasting disk.

1. Push this repository to GitHub (or GitLab/Bitbucket) and choose **Add new site → Import an existing project** in Netlify. `netlify.toml` sets the build; nothing to fill in there.
2. Database: add **Netlify DB** to the site (it sets `NETLIFY_DATABASE_URL`), or set `DATABASE_URL` to any Postgres — for Neon or Supabase, use the pooled connection string.
3. Under **Site configuration → Environment variables**, set:
   - `BETTER_AUTH_SECRET` and `CRON_SECRET`: two different values from `openssl rand -base64 32`
   - `BETTER_AUTH_URL`: the site's address, e.g. `https://margin-yourname.netlify.app` (or your domain once added)
   - optional: `VAPID_*` for push, `SMTP_URL` / `EMAIL_FROM` for email (without SMTP, emails are skipped), `ANTHROPIC_API_KEY` for AI
4. Deploy. Each build applies new migrations first (`scripts/migrate.ts`).

What differs from a single server: reminders can arrive up to a minute late, and changes from other devices or collaborators appear within about 15 seconds (open tabs poll) rather than instantly. The AI hourly limit is counted per function instance.

## Configuration

| Variable | Purpose |
| --- | --- |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Session signing secret and the public URL |
| `DATABASE_URL` | Postgres connection (`NETLIFY_DATABASE_URL` also works). Unset: embedded PGlite in `.data/pglite` (or `PGLITE_DIR`) |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Web Push |
| `SMTP_URL`, `EMAIL_FROM` | Email reminders, digest and invitations |
| `SCHEDULER` | `in-process` (default) or `off` when running `npm run worker` |
| `ANTHROPIC_API_KEY`, `AI_MODEL` | Optional AI suggestions (default model `claude-opus-5-5`) |
| `CRON_SECRET` | Enables `/api/cron/tick` for scheduled-function hosts (Netlify) |
| `REALTIME` | `stream` (server-sent events) or `poll`; fixed at build, defaults to `poll` on Netlify |
| `WEBHOOKS_ALLOW_PRIVATE` | Allow webhooks to private addresses (local testing only) |

### AI suggestions

With `ANTHROPIC_API_KEY` set, each user can turn on **Settings → AI suggestions**. Only the text of the tasks involved in a request is sent, and only when the user asks. Suggestions are proposals: nothing changes until the user applies them, and model output is validated against what was sent (unknown ids, past dates and impossible priorities are dropped). Requests are rate-limited per user and fall back to the server-side default if the model declines.

## Languages

English and Bahasa Indonesia. The app follows the account's choice (Settings → Language), else the browser's; the front page is prerendered per language and `/` serves the visitor's. Quick add understands both languages' dates at once ("tomorrow 3pm" and "besok jam 3 sore").

To add a language: add its code to `src/i18n/locales.ts`, copy `src/i18n/en/` to a new folder and translate it. TypeScript checks that every string exists (`Messages` is the English catalog's shape). Server error messages from the API are currently English only.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js development server, production build, production server |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Unit and integration tests (Vitest; integration tests use an in-memory PGlite) |
| `npm run contrast` | Checks every color pairing in every theme combination meets WCAG AA (AAA for body text in high contrast) |
| `npm run smoke` and `smoke:views`, `smoke:reminders`, `smoke:productivity`, `smoke:sharing` | End-to-end API checks against a running server (pass a base URL to target another) |
| `npm run worker` | Reminder scheduler as its own process |
| `npm run db:generate` | New SQL migration from schema changes |
| `node scripts/make-icons.mjs` | Re-renders the PWA icons |

## How it's built

- **Next.js 16** (App Router, Turbopack) with React 19, **TanStack Query** for data with optimistic updates, **Drizzle ORM** on Postgres/PGlite, **better-auth** for accounts.
- **Design system:** Tailwind with tokens in `src/app/globals.css` and a living style guide at `/styleguide`. Motion uses one set of tokens (`src/design/motion.ts`) and respects the system and in-app motion settings. Only transform and opacity animate.
- **Front page:** React Three Fiber hero (lazy, behind an SVG poster, only on capable desktop devices), GSAP ScrollTrigger + Lenis for the scroll story, a live quick-add demo.
- **Offline:** a service worker (`public/sw.js`) keeps pages, assets and recent API responses; task changes made offline queue in `src/lib/outbox.ts` and replay in order on reconnect.
- **Scale:** long lists are virtualized and boards page their cards, so 10,000+ tasks stay smooth.
- **Developer API:** see `/developers` in the running app.

```
src/
  app/          routes: (app) signed-in pages, (auth), [lang] front page, api/
  components/   UI by area: app shell, tasks, views, focus, habits, stats, sharing, landing, ui primitives
  i18n/         locales, catalogs (en, id), runtime and providers
  lib/          client logic: data hooks, quick-add parser, dates, filters, outbox
  server/       database, auth, access control, scheduler, webhooks, AI
drizzle/        SQL migrations
scripts/        smoke tests, worker, contrast check, icon renderer
```

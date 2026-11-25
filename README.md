# SevaSutra — government scheme eligibility & application assistant (PS 26)

SevaSutra helps people in India find central/state schemes and scholarships, see **why** they may or may not qualify, keep their documents ready, get reminders, and apply on the **official portal**. Eligibility comes from a deterministic rule engine with sources and versions on every result; the LLM only explains.

> SevaSutra is an independent assistant, not a government website. Results say "likely eligible based on the information provided"; the final decision rests with the scheme authority.

## Setup (first time, macOS)

### 1. Prerequisites
- **Node.js 20 or newer** — check with `node -v` (install from https://nodejs.org or `brew install node`)
- **PostgreSQL 16** — `brew install postgresql@16`
- **Git**

The npm scripts expect Postgres at `/opt/homebrew/opt/postgresql@16/bin` (Apple Silicon Homebrew). On an Intel Mac or Linux, edit the `db:start` / `db:stop` paths in `package.json`, or use any Postgres you already run and point `DATABASE_URL` at it.

### 2. Get the code and install packages
```bash
git clone git@github.com:Deepesh1024/sevasutra.git
cd sevasutra
npm install
```

### 3. Create your `.env`
```bash
cp .env.example .env
```

Then edit `.env`:

| Setting | What to put | Required? |
|---|---|---|
| `APP_SECRET` | A random 64-character hex string (command below) | Yes |
| `DOCUMENT_ENC_KEY` | Another, different 64-character hex string (encrypts uploaded documents — don't lose it) | Yes |
| `GROQ_API_KEY` | Key from https://console.groq.com/keys | For AI chat answers and document checks |
| `GROQ_MODEL` | `qwen/qwen3.8-27b` (must be a model your key can use) | — |
| `SMTP_URL` | `smtps://YOUR_GMAIL%40gmail.com:APP_PASSWORD@smtp.gmail.com:465` | To email sign-in codes and reminders |
| `MAIL_FROM` | `SevaSutra <YOUR_GMAIL@gmail.com>` (must be the same Gmail account) | With `SMTP_URL` |
| `GOOGLE_CLIENT_ID` | OAuth client ID from Google Cloud Console | Optional (a dev-only mock is used when empty) |

Generate a key (run twice, once for each secret):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Gmail app password:** turn on 2-Step Verification for the Gmail account, then create an app password at https://myaccount.google.com/apppasswords. Use the 16 letters without spaces, and write `@` in the email as `%40` inside `SMTP_URL`. Leave `SMTP_URL` empty to skip real email — codes then appear on screen and mail goes to http://localhost:3000/dev/mailbox.

### 4. Create the database (one time)
```bash
LC_ALL=en_US.UTF-8 /opt/homebrew/opt/postgresql@16/bin/initdb -D .pgdata -U sahayak --auth=trust -E UTF8
npm run db:start
/opt/homebrew/opt/postgresql@16/bin/createdb -h localhost -p 54329 -U sahayak sahayak
npx prisma migrate deploy
npm run db:seed
```

This keeps the database inside the project folder (`.pgdata/`, git-ignored) on port **54329**, so it never clashes with another Postgres. The seed loads 24 schemes, their sources and test cases, and two staff accounts.

### 5. Run it
```bash
npm run dev
```

Open **http://localhost:3000**.

## Running it again later
```bash
cd sevasutra
npm run db:start
npm run dev
```

To stop: press `Ctrl+C` in the terminal running `npm run dev`, then:
```bash
npm run db:stop
```

Optional, in a second terminal — delivers reminder emails (retries, quiet hours 9 pm–8 am IST):
```bash
npm run worker
```

Run the tests:
```bash
npm test
```

### Troubleshooting
| Problem | Fix |
|---|---|
| `pg_ctl: could not start server` / "postmaster became multithreaded" | Start with `LC_ALL=en_US.UTF-8` (the `db:start` script already does) and check `.pgdata/server.log` |
| `Can't reach database server at localhost:54329` | Run `npm run db:start` first |
| Port 3000 in use | Stop the other app, or run `npx next dev -p 3001` and set `APP_URL` in `.env` to match |
| Sign-in code email never arrives | Check spam; check `SMTP_URL` (app password, `%40`); look at **Admin → Audit log** for `otp.sent` |
| Chat shows only quoted excerpts | `GROQ_API_KEY` empty/invalid, or the model in `GROQ_MODEL` isn't available to your key |
| "Our document checker is busy" on upload | Groq free-tier rate limit — wait a minute and retry |
| Changed `.env` but nothing happened | Restart `npm run dev` |

### Test accounts (local development only)
- **Applicant (email):** sign in with an email address — the 6-digit code is emailed through the Gmail account in `SMTP_URL`.
- **Applicant (mobile):** sign in with any Indian mobile number. With `OTP_PROVIDER=dev` the code is shown on screen in development — it is never logged.
- **Admin / support:** the numbers in `.env` (`SEED_ADMIN_PHONE`, `SEED_SUPPORT_PHONE`). After OTP you enrol an authenticator app (TOTP) on first visit to `/admin`.
- **Explorer:** "Continue with Google (mock)" on `/login` when `GOOGLE_CLIENT_ID` is empty.
- **Emails** (OTP and reminders) go out through Gmail SMTP when `SMTP_URL` is set; with it empty they land in `/dev/mailbox`.
- **Document uploads** are OCR'd and checked by the LLM; uploading the wrong document type is rejected.

### Enabling the AI explainer (Groq)
Put your key in `.env` → `GROQ_API_KEY=...` (model via `GROQ_MODEL`, default `qwen/qwen3.8-27b`) and restart `npm run dev`. Without a key, chat answers with cited source excerpts only.

## What's inside
| Area | Path |
|---|---|
| Rule engine (DSL, 3-valued logic, intervals, conflicts, exceptions, benefits, explanations) | `src/lib/engine/` |
| Curated catalogue (24 schemes/scholarships) + source register | `src/lib/schemes/data.ts`, `sources.ts` |
| Regression harness (hand-written + generated cases) | `src/lib/schemes/testing.ts` |
| Versioning, publishing gate, diff, guideline extraction | `src/lib/schemes/versioning.ts`, `src/lib/admin/` |
| Auth: OTP provider interface, sessions, Google, TOTP | `src/lib/auth/`, `src/app/actions/auth.ts` |
| Progressive profile + provenance + consent | `src/lib/profile/`, `src/lib/consent.ts` |
| Encrypted document vault | `src/lib/documents/`, `src/app/api/documents/[id]` |
| Chat (retrieval, policy, Groq, citation checks) | `src/lib/chat/`, `src/lib/llm/` |
| Reminders (queue, worker, scheduler, unsubscribe) | `src/lib/notify/`, `scripts/` |
| Authorised-API adapter framework (sandbox mock) | `src/lib/integrations/adapter.ts` |
| Pages | `src/app/` (`/schemes`, `/check`, `/dashboard`, `/profile`, `/documents`, `/applications/[id]`, `/chat`, `/account`, `/admin/*`) |
| Phase 0 documents | `docs/` (PRD, data flow, threat model & PIA, consent matrix, source register, decision log, test report) |

## Scripts
| Command | Purpose |
|---|---|
| `npm run dev` | Dev server |
| `npm test` | Unit, property, regression and security tests |
| `npm run typecheck` / `npm run lint` | Static checks |
| `npm run db:start` / `db:stop` | Project-local Postgres on port 54329 |
| `npm run db:seed` | Seed sources, schemes, tests, staff, glossary (idempotent) |
| `npx tsx --env-file=.env prisma/refresh-seed.ts` | Refresh seed-authored v1 records after editing `data.ts` |
| `npm run reminders` | Enqueue reminders (run daily) |
| `npm run worker` | Deliver reminders with retries/quiet hours |

See `docs/decision-log.md` for known limitations and the production checklist.

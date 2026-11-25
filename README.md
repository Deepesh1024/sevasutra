# SevaSutra — government scheme eligibility & application assistant (PS 26)

SevaSutra helps people in India find central/state schemes and scholarships, see **why** they may or may not qualify, keep their documents ready, get reminders, and apply on the **official portal**. Eligibility comes from a deterministic rule engine with sources and versions on every result; the LLM only explains.

> SevaSutra is an independent assistant, not a government website. Results say "likely eligible based on the information provided"; the final decision rests with the scheme authority.

## Quick start (macOS, local Postgres already set up in `.pgdata`)

```bash
npm install
```

```bash
npm run db:start
```

```bash
npm run dev
```

Open http://localhost:3000. First time on a fresh machine: `npx prisma migrate dev` then `npm run db:seed`.

Optional:

```bash
npm run worker
```

```bash
npm test
```

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

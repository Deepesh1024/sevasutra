# Decision log

| # | Date | Decision | Why |
|---|---|---|---|
| 1 | 2026-11-25 | **Pilot = discovery + guided application (redirect only).** No submission to any government system. | No API approvals yet; brief forbids automating forms/CAPTCHA/OTP/payment. Adapter framework (`src/lib/integrations/adapter.ts`) exists with a sandbox mock to prove idempotency, retries, dead-lettering and audit. |
| 2 | 2026-11-25 | Product name **SevaSutra** (renamed from the brief's working name). | Chosen by the user. |
| 3 | 2026-11-25 | Stack: Next.js 15 (App Router, Server Actions) + Prisma 6 + PostgreSQL 16, TypeScript, Vitest. | Matches brief's recommended architecture; one typed codebase; Server Actions give CSRF protection by default. |
| 4 | 2026-11-25 | Rule engine is a pure TypeScript module with a JSON rule DSL (all/any/not, comparators, intervals, unknown & conflict states, exceptions with precedence, effective dates). | Deterministic, testable, reproducible (rule hash + engine version + minimal input snapshot stored per evaluation). |
| 5 | 2026-11-25 | Age/income bands evaluated as **intervals** (three-valued). | Lets users avoid exact DOB/income while still getting definite answers when the band is clearly inside/outside a limit. |
| 6 | 2026-11-25 | "Prefer not to say" → `unknown`, never `fail`. | Declining sensitive data must not count against the user. |
| 7 | 2026-11-25 | Documents do **not** change eligibility status; they appear in the checklist and "what would change". | Otherwise no one without uploads could be "likely eligible"; documents are verified by the scheme authority anyway. Rules may still use `requireVerified` (e.g. Saksham disability %). |
| 8 | 2026-11-25 | Benefit totals: stated vs estimated never mixed; loans, insurance, savings, services and third-party offers listed but not summed; mutually exclusive scholarships counted once; household schemes counted once. | Never present uncertain estimates as money a citizen will receive. |
| 9 | 2026-11-25 | LLM provider: **Groq** (OpenAI-compatible) behind an interface; optional. Without a key, chat returns extractive, cited excerpts. | User has a Groq key; app must work without it. |
| 10 | 2026-11-25 | Seed catalogue marked `seed_unverified`, `lastVerifiedAt = null`. | Amounts/limits were prepared from public information and must be checked against the official guideline by a curator before launch. UI shows "not yet verified". |
| 11 | 2026-11-25 | Single Postgres with logically separate tables for identity/profile/documents/content/audit; local encrypted disk for objects. | MVP simplicity; boundaries kept so they can be split. |
| 13 | 2026-11-25 | Light-only white theme (blue/orange/black), featured-scheme banner carousel and scrolling update ticker. Both pause on hover/focus, have pause buttons and stop for reduced-motion users. No government emblems or tricolour, and the header says "not a government website". | User request; WCAG 2.2.2 for moving content; brief forbids implying government affiliation. |
| 14 | 2026-11-25 | Groq model `openai/gpt-oss-120b` with low reasoning effort; citation formats normalised before validation. | `llama-3.3-70b-versatile` is not available on the project's key. |
| 15 | 2026-11-25 | **Email OTP sign-in** delivered through Gmail SMTP (app password in `.env`). With `EMAIL_OTP_GRANTS_APPLICANT=true`, email-OTP users become verified applicants. Phone OTP remains available. | No SMS provider yet; requested by the team. **Deviation from the brief**, which asks for an Indian mobile OTP for applicants — set the flag to `false` to restore the brief's rule. |
| 16 | 2026-11-25 | **Upload verification:** every upload (except photographs) is read by OCR on our server (Tesseract, English + Hindi; PDF text layer via unpdf) and an LLM checks it is the declared document type. Wrong, unreadable, or instruction-containing documents are rejected and never stored. Accept requires LLM match ≥ 0.6 confidence **and** local keyword agreement (or ≥ 0.85). Without an LLM, ≥ 2 keyword hits are required. | Requested by the team. Only a redacted excerpt (ID/phone/account numbers removed) leaves the server; raw OCR text is never stored or logged. Values read (income, disability %) are suggestions the user must confirm. |
| 17 | 2026-11-25 | LLM switched to `qwen/qwen3.8-27b` (reasoning hidden, `<think>` stripped, JSON mode for document checks). | Requested by the team. |
| 18 | 2026-11-25 | **Vision fallback** for uploads: if OCR fails, reads < 20 characters, or the text model says "unreadable", the image (downscaled to ≤ 1600 px JPEG) or a rendering of the PDF's first page goes to the vision-capable LLM. Acceptance bar is higher (confidence ≥ 0.75, or ≥ 0.6 with any OCR keyword support). **Never for Aadhaar or bank passbooks**, whose images would expose full numbers. Rate limits (429) are retried up to 3 times; if still busy the user is told to retry and nothing is stored. | Requested by the team; Groq free tier is 7,000 input tokens/min (≈ 3 image checks/min). |
| 12 | 2026-11-25 | No SMS/WhatsApp. Email only, opt-in, quiet hours 21:00–08:00 IST. | Brief: add other channels only after consent and provider approvals. |

## Known limitations
- OTP provider is a dev mock (code shown on screen in development only). Production needs a DLT-registered SMS adapter.
- Google sign-in needs `GOOGLE_CLIENT_ID`; a dev-only mock is used otherwise.
- Scanned PDFs are checked from a picture of the first page only. Scanned Aadhaar/bank documents that OCR cannot read are rejected (no vision for privacy). Groq's free tier allows only a few image checks per minute.
- Email OTP is sent from a personal Gmail account (Gmail sending limits apply, ~500/day). Use a transactional email provider and a domain sender in production.
- Malware scanning: EICAR + PDF-JavaScript heuristics, ClamAV used if installed.
- Rate limiting and the job queue use Postgres (fine for a pilot; Redis/BullMQ at scale).
- Scheme content is unverified seed data; deadlines are mostly "check portal" because cycle dates are not on file.
- Hindi covers UI, scheme names/summaries, rule explanations and steps; some long-form fields fall back to English (flagged in `/admin/translations`).

## Before production (checklist)
1. Curator verification of all 24 schemes against official guidelines (`/admin` → "Never verified" must be 0).
2. Real SMS OTP adapter (DLT templates), SMTP provider, secrets manager, rotated `APP_SECRET`/`DOCUMENT_ENC_KEY`.
3. Managed object storage with SSE + per-object keys; managed AV scanning.
4. Separate audit log to an append-only store; centralised logs/traces/alerts.
5. WCAG 2.1 AA audit with assistive-technology users; Hindi terminology review.
6. Load test; backups and DR drill; incident-response runbook.
7. myScheme / NSP / DigiLocker partner agreements before any data copying or integration.

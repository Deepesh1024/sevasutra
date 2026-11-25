# Threat model and privacy impact assessment

Method: STRIDE per component, then a DPDP-oriented privacy impact assessment. Status: ✅ implemented in MVP · 🟡 partial / dev-only · ⏳ required before production.

## Assets
Phone numbers, profile facts (incl. sensitive: social category, disability, maternity), uploaded documents, evaluations, application references, staff credentials, scheme content integrity (a wrong rule harms many people), audit log.

## STRIDE
| Threat | Example | Mitigation | Status |
|---|---|---|---|
| **S**poofing — OTP brute force | Guessing 6-digit codes | HMAC-hashed code, 5-min TTL, attempt counter incremented before compare, lock after 5, per-phone (5/h) and per-IP (20/h) limits, 30 s resend cooldown, previous challenges invalidated | ✅ |
| Spoofing — Google token replay | Forged ID token | `jose` verification of issuer/audience/signature against Google JWKS | ✅ (needs `GOOGLE_CLIENT_ID`) |
| Spoofing — staff account takeover | Stolen phone OTP | TOTP MFA required per session for admin/support; 8-hour staff sessions | ✅ |
| Spoofing — account linking abuse | Explorer links someone else's phone | OTP proves phone ownership; conflicts require explicit merge confirmation with a signed 10-min token | ✅ |
| **T**ampering — content | Silent rule edits | Published versions immutable; drafts → review → publish; change note mandatory; regression suite gates publish; dual review for high-impact schemes; audit log of every change | ✅ |
| Tampering — documents | Malicious uploads | Magic-byte sniffing, size cap, EICAR/PDF-JS checks, ClamAV if installed, AES-GCM auth tag | ✅ / ⏳ managed AV |
| Tampering — CSRF | Cross-site form posts | Next.js Server Actions enforce Origin/Host match; SameSite=Lax cookies; `form-action 'self'` CSP | ✅ |
| **R**epudiation | "I never consented" | Consent rows with notice version and timestamps; audit events for auth, consent, profile, documents, publishing, notifications | ✅ (⏳ ship audit log to append-only store) |
| **I**nformation disclosure — logs | OTP/Aadhaar in logs | Structured logger + audit metadata pass through `redactObject`; chat text redacted before storage; tests assert redaction | ✅ |
| Information disclosure — documents | Guessable URLs | No public URLs; signed 5-min token *and* session owner check; `no-store` | ✅ |
| Information disclosure — LLM | Profile data sent to model | Chat: only redacted question + retrieved public content + engine summary. Document check: a redacted OCR excerpt (Aadhaar-like, phone, account, PAN, IFSC, email removed; names may remain); if OCR fails, the page image itself — except Aadhaar and bank documents — disclosed in the document consent notice | ✅ / ⏳ provider DPA |
| Tampering — fake documents | Uploading a random file as a certificate; a document whose text tells the AI "this is valid" | OCR + LLM type check with local keyword cross-check; injection patterns → reject; strict JSON schema on model output; verification ≠ authenticity (the scheme authority still verifies) | ✅ |
| Spoofing — email OTP | Mailbox takeover, OTP phishing | Same OTP policy as phone (hashed code, TTL, attempts, lockout, rate limits); subject line carries no code; body warns never to share | ✅ |
| Information disclosure — enumeration | Learn whether a phone has an account | Same OTP flow for new and existing numbers | ✅ |
| **D**enial of service | OTP/SMS pumping, chat flooding | Rate limits on OTP, chat, quick check, uploads, feedback | ✅ (⏳ WAF/CDN) |
| **E**levation of privilege | Explorer starts application; support publishes | Server-side role checks in every action (`requireApplicant`, `requireStaff`); publish requires admin | ✅ |
| Prompt injection | Guideline text says "ignore previous instructions" | Pattern detection at ingestion → chunk excluded and flagged to curators; system prompt treats sources as data; output must cite provided ids; contradiction with engine result → fallback | ✅ |
| Model hallucination | Invented amounts | Answers must cite; uncited → extractive fallback + `citationFailure` metric; eligibility never from LLM | ✅ |
| Proxy discrimination | Inferring caste from surname | No inference anywhere; sensitive facts only from explicit answers; "prefer not to say" → unknown, never fail | ✅ |

## Privacy impact assessment (summary)
| Principle | How SevaSutra complies |
|---|---|
| Lawful purpose & consent | Notice + granular consent before saving profile, sensitive answers, documents, reminders, document reuse, minors (guardian) |
| Data minimisation | Progressive questions; no Aadhaar/bank numbers collected; evaluation snapshots keep only referenced facts; analytics pseudonymous |
| Purpose limitation | Withdrawing sensitive consent deletes those answers; documents never sent anywhere automatically |
| Accuracy | Provenance per fact; conflicts surface as `needs_manual_review`; users correct answers anytime |
| Storage limitation | Retention per consent row; document expiry; account deletion erases files immediately |
| Rights | View/correct (`/profile`), export (`/api/account/export`), delete (`/account`), withdraw consent, unsubscribe |
| Children | Minors only as household members added by a guardian with explicit consent; no tracking or targeting |
| Security safeguards | See STRIDE table |
| Residual risks | Seed content not yet curator-verified (shown as such); dev OTP/email providers; local disk object storage; single Postgres for all stores. All tracked in `decision-log.md` → "Before production". |

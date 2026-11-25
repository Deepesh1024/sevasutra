# Test report

Run: `npm test` (Vitest). Last run 2026-11-25: **6 files, 173 tests passing + 3 integration tests** (integration run with `RUN_INTEGRATION=1`).

| Suite | What it proves |
|---|---|
| `tests/engine.test.ts` (23) | Age on a reference date; age/income **bands as intervals**; all five statuses; "prefer not to say" is never a fail; conflicting values → manual review; government-verified values win; expired facts ignored; closed/expired deadlines still explain criteria; curator "ambiguous" flag; `requireVerified`; `all`/`any`/`not` semantics and exclusion wording; exception precedence; state scoping; benefit tiers & annualisation; loans never counted. **Property tests** (fast-check): determinism, failing facts stay failing, every non-eligible result has a "what would change" hint, lower income is never less eligible, stable rule hash. |
| `tests/schemes.test.ts` (121) | 24 curated schemes: registered sources, application route, benefit basis present; third-party labelled and never official; unique leaf ids; only known profile facts; required regression kinds present; **193 regression cases pass** (hand-written eligible/ineligible + generated boundary age, boundary income, missing document, conflicting document, expired deadline, state mismatch). |
| `tests/summary.test.ts` (5) | Stated vs estimated separation; non-eligible excluded; loans/insurance not summed; mutually exclusive scholarships counted once; household schemes counted once; third-party offers excluded from totals. |
| `tests/security.test.ts` (15) | Redaction of Aadhaar/phone/account/PAN/OTP; sensitive log keys; secret detection for chat; AES-GCM tamper detection; signed-link expiry and purpose binding; Indian mobile normalisation; magic-byte sniffing; EICAR and PDF-JavaScript rejection; prompt-injection detection; IST quiet hours; retrieval query building; guideline candidate extraction; adapter idempotency, retry/backoff and dead-lettering; chatbot scheme detection in English and Hindi. |

| `tests/verify.test.ts` (12) | Document-check decisions: accept on LLM + keyword agreement; reject wrong type naming what it looks like; reject unsupported LLM claims; reject unreadable files and documents containing AI instructions; keyword fallback without LLM; Aadhaar accepted as age proof; malformed model output ignored. |
| `tests/verify-integration.test.ts` (7, opt-in) | Real Tesseract OCR + Groq `qwen/qwen3.8-27b` on generated sample documents (fake test data): income-certificate image accepted (₹1,80,000 suggested); PAN-style card uploaded as income certificate rejected; digital PDF marksheet accepted, and rejected when declared as a caste certificate. Vision fallback: scanned (image-only) income-certificate PDF accepted from a page screenshot; scanned PAN declared as income certificate rejected; scanned file declared as Aadhaar never sent to vision. |

## Manual end-to-end checks (browser, 2026-11-25)
- Guest quick check on APY → "Likely eligible" with 5 passed conditions and document list.
- Phone OTP: wrong code rejected ("That code is not correct"), right code signs in; OTP audit entries contain no code.
- Consent screen → progressive profile (6 sections) → dashboard: 8 likely, 7 partial, benefit summary with stated vs estimated, exclusive scholarship struck through.
- Save scheme, start application checklist, status reporting form.
- Chat: correct scheme detection, engine-backed eligibility answer, OTP refusal (stored as `[code removed]`), cited retrieval answer.
- Admin: phone OTP + TOTP enrolment; draft v2 of APY; changing the age limit to 45 fails 1 regression test and **publishing is blocked server-side**; reverting and adding a caveat publishes v2; an evaluation made on v1 **reproduces** after v2 is live.
- Hindi UI renders on scheme pages.
- `next build` succeeds (33 routes); `tsc --noEmit` and ESLint clean.

## Not yet covered
Automated accessibility (axe) and multilingual rendering tests, load tests, OCR error tests, Playwright end-to-end suite. Recommended next.

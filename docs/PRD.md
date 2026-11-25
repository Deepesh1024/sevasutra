# SevaSutra — Product Requirements (PS 26)

## Problem
Indian citizens miss welfare schemes and scholarships they qualify for because eligibility rules are scattered across ministries, written in dense guidelines, and change every year. Existing directories list schemes but rarely explain *why* someone qualifies, which documents they need, or whether the information is current.

## Goal
An assistant that helps people **discover** schemes, **understand** eligibility and documents, **get reminders**, and **apply through official channels**, while staying trustworthy: every result is explainable, sourced, versioned and clearly not an official decision.

## Non-goals (pilot)
- Submitting applications on the user's behalf (no form filling, CAPTCHA, OTP entry or payment).
- Aadhaar authentication / eKYC, DigiLocker pulls, bank verification (adapters exist as mocks only).
- Deciding eligibility with an LLM.

## Users and roles
| Role | How | Can | Cannot |
|---|---|---|---|
| Guest | No account | Browse, search, filter, compare, run a quick check (nothing stored), chat | Save anything |
| Explorer | Google sign-in | Above + save schemes, save the basic discovery answers | Full profile, documents, application checklists, reminders |
| Verified applicant | Indian mobile + OTP | Full progressive profile, household members, document vault, application checklists, email reminders, export/delete | — |
| Support operator | Seeded role + TOTP | Answer feedback, draft content corrections, view sources | Publish, alter published results |
| Administrator / curator | Seeded role + TOTP | Everything above + publish (after tests and dual review), mark sources verified, approve translations, run notifications | Edit published versions in place |

## Core user journeys
1. **Discover** — Home → search/filter (ministry, level, state, category, beneficiary, benefit type, application mode, deadline, scholarship type) → group by ministry or jurisdiction → compare up to 4.
2. **Check eligibility** — Scheme page asks *only* the facts that scheme's rule needs. The deterministic engine returns one of five states with passed / failed / missing / unverified conditions, a "what would change this result" list, document checklist, benefit estimate *with its basis*, deadline and source freshness.
3. **Progressive profile** — Discovery questions first; deeper sections only when needed. Every value carries provenance (`user_entered`, `document_extracted`, `government_verified`, `operator_verified`) and timestamps.
4. **Dashboard** — Likely eligible / Partially eligible / Complete your profile / Closing soon / Needs review / Saved / Applied / Needs renewal; benefit summary separating stated vs estimated, excluding loans, insurance and third-party offers from totals; household view.
5. **Apply** — Checklist (documents + steps) → "Open official portal" in a new tab → user self-reports status and reference number. SevaSutra never claims submission happened.
6. **Ask** — RAG chatbot over approved, versioned content; cites sources; uses the rule engine for "am I eligible?"; refuses when unsupported; refuses secrets; escalates to support/CPGRAMS.
7. **Reminders** — Opt-in email for profile completion, missing documents, deadlines, deadline changes, renewals, status changes, and content corrections that change a previous result.
8. **Curate** — Admin imports/edits schemes as new versions, edits rules visually, compares versions, runs regression tests, publishes with dual review for high-impact schemes, checks source freshness, manages translations and feedback.

## Requirements traceability (MVP acceptance criteria)
| Criterion | Where |
|---|---|
| Explore without application privileges | `/schemes`, `/check`, `QuickCheck`; Google → explorer role |
| Phone OTP + progressive profile | `src/lib/auth/otp.ts`, `/login`, `/profile`, `/consent` |
| ≥20 curated schemes with rules, sources, versions, checklists, tests | `src/lib/schemes/data.ts` (24 schemes, 193 regression cases) |
| All five engine states | `src/lib/engine/evaluate.ts`, `tests/engine.test.ts`, `tests/schemes.test.ts` |
| Passed / failed / missing / unverified explanation | `EligibilityResultView` |
| Filters incl. ministry, central/state, category, deadline, benefit, scholarship | `/schemes` |
| Never present third-party / stale as official | Third-party label + separate totals; "not verified"/"stale" banners; chat warnings |
| Official-portal redirect + checklist without faking submission | `/applications/[id]`, `recordRedirectAction` |
| Chatbot cites and refuses | `src/lib/chat/assistant.ts` |
| Email reminders with opt-in, unsubscribe, retry, audit | `src/lib/notify/*`, `scripts/worker.ts` |
| View / correct / export / delete | `/profile`, `/documents`, `/account`, `/api/account/export` |
| Admin publishes new versions after regression tests | `/admin/versions/[id]`, `src/lib/admin/publish.ts` |
| Test reports | `docs/test-report.md`, `npm test` |

## Success metrics (pilot)
- Share of results that users rate "clear" in feedback; share of "needs information" results converted to a definite status after one follow-up question.
- Content freshness: % of published schemes verified within 180 days (target 100%).
- Chat: citation-failure rate < 2%; refusal rate tracked.
- Zero incidents of secrets in logs (redaction tests in CI).

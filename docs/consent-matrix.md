# Consent matrix

Source of truth: `src/lib/consent.ts` (rendered at `/privacy` and `/consent`). Notice version `2026-11-v3`.

| Purpose | Data collected | Legal basis | Retention | Shared with | Deletion |
|---|---|---|---|---|---|
| Save profile for eligibility (required to save) | Age/DOB or age band, state, rural/urban, occupation, income, student status and other non-sensitive answers | Consent (DPDP Act 2023 s.6) | Until deleted, or 24 months after last sign-in | Nobody; rule engine only | Delete any answer or the account at any time |
| Sensitive answers (optional) | Social category, disability %, pregnancy status — only if answered | Explicit consent; "prefer not to say" always available | Until deleted / consent withdrawn (erased within 30 days) | Nobody | Withdrawing consent deletes these answers immediately |
| Document vault (optional) | Uploaded files (encrypted) + metadata; OCR text used transiently for the type check | Consent | Until deleted or expired (e.g. income certificate 12 months); OCR text not stored | Redacted OCR excerpt to Groq for the type check; if OCR fails, the page image (never Aadhaar/bank documents) | Delete removes encrypted file immediately; backups roll off in 30 days |
| Email reminders (optional) | Email address, saved schemes | Consent; one-click unsubscribe | Until unsubscribed; delivery logs 12 months | Email provider | Unsubscribe link or Account → notifications |
| Document reuse (optional) | Link between a vault document and checklists | Consent | Same as document | Nobody | Withdraw to stop auto-ticking |
| Guardian consent for a minor | Child's age, gender, education entered by guardian | Verifiable parental consent (DPDP s.9) | Until the member is removed | Nobody | Remove the family member |

Not collected at all: Aadhaar number, bank account/IFSC, PAN, passwords, OTPs, biometrics, location.

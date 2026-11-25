# Source and licensing register

Source of truth: `src/lib/schemes/sources.ts` (seeded into the `Source` table, shown publicly at `/sources`, managed at `/admin/sources`). Every source starts as `reviewerStatus = pending`.

| Id | Source | Publisher | Kind | Official | How SevaSutra uses it | Terms notes |
|---|---|---|---|---|---|---|
| myscheme | myScheme | NeGD, MeitY | directory | ✅ | Discovery links only | Partner terms require original URL, forbid iframes/masking/intermediary layers, require written permission before copying data or implying affiliation. **No data copied.** |
| indiagov | National Portal of India | NIC | directory | ✅ | Links | Department remains source of truth |
| nsp | National Scholarship Portal | MeitY + ministries | portal | ✅ | Apply links, deadlines | No automated submission without approved integration |
| umang | UMANG | NeGD | portal | ✅ | Service discovery links | — |
| apisetu | API Setu | NeGD | api | ✅ | Not integrated | Onboarding + per-API approval required |
| digilocker | DigiLocker | NeGD | api | ✅ | Mock adapter only | Requester onboarding + terms required |
| uidai | UIDAI developer resources | UIDAI | api | ✅ | **Not used** | Only via authorised AUA/KUA; no unofficial Aadhaar OTP/eKYC |
| datagov | data.gov.in | NIC | dataset | ✅ | None yet | Record licence (GODL) per dataset |
| pmkisan … ka_seva_sindhu | 19 scheme-owner portals/guidelines | Respective ministries / state departments | portal / guideline | ✅ | Primary source per scheme; application links | Link to original; re-check copyright policy before reusing text verbatim |
| rf_scholarships | Reliance Foundation Scholarships | Reliance Foundation (private) | portal | ❌ third-party | Link only, labelled non-government | No scraping; partnership/permission before importing data; show provider privacy policy & terms |

Connector record per check (`SourceSnapshot`): URL, HTTP status, fetched timestamp, content hash, parser version, source version, reviewer status, notes. Takedown: set source to `blocked` and unpublish affected schemes via a new version.

Translations: UI strings and Hindi scheme text are hand-written drafts in this repo (no machine translation). The Hindi glossary in `/admin/translations` must be approved before speech/translation features. Bhashini is the intended route after terminology validation.

# Data-flow diagram

```mermaid
flowchart LR
  subgraph Citizen
    B[Browser]
  end
  subgraph SevaSutra["SevaSutra (Next.js server)"]
    AUTH[Auth: OTP / Google ID token / TOTP]
    PROF[Profile service<br/>facts + provenance]
    DOCS[Document vault<br/>validate · scan · AES-GCM]
    ENG[Deterministic rule engine]
    KB[Scheme knowledge base<br/>immutable versions + chunks]
    CHAT[Chat: retrieval + policy]
    Q[Notification queue + worker]
    ADM[Admin console]
    AUD[(Audit log)]
  end
  subgraph Stores
    IDDB[(Identity: User, Identity, Session, OtpChallenge)]
    PDB[(Profile: Profile, ProfileFact, Consent)]
    DDB[(Documents: metadata)]
    OBJ[(Encrypted object store)]
    CDB[(Content: Scheme, SchemeVersion, EligibilityRule, ContentChunk, Source)]
    EDB[(Evaluation, Application)]
  end
  subgraph External
    SMS[SMS/OTP provider<br/>adapter — dev mock]
    GIS[Google Identity Services]
    LLM[Groq LLM<br/>optional]
    MAIL[SMTP / dev mailbox]
    PORT[Official portals<br/>new tab only]
    SRC[Official source URLs<br/>freshness checks]
    GOV[API Setu / DigiLocker / UIDAI<br/>NOT integrated — adapters only]
  end

  B -- phone, OTP --> AUTH -- code (never logged) --> SMS
  B -- ID token --> AUTH -- verify JWKS --> GIS
  AUTH --> IDDB
  B -- answers (consented) --> PROF --> PDB
  B -- files (consented) --> DOCS --> DDB
  DOCS -- ciphertext --> OBJ
  PROF -- minimal facts --> ENG
  KB -- rule version --> ENG
  ENG -- result + input snapshot + rule hash --> EDB
  B -- question --> CHAT
  CHAT -- redacted question + retrieved chunks / engine summary --> LLM
  KB --> CHAT
  ENG --> CHAT
  EDB --> Q -- email (no sensitive subject) --> MAIL
  B -- opens --> PORT
  ADM -- new versions, tests --> KB
  ADM -- HEAD/GET + hash --> SRC
  AUTH & PROF & DOCS & ENG & Q & ADM --> AUD
  GOV -. future, after approval .- DOCS
```

## What crosses each boundary
| Flow | Data | Protection |
|---|---|---|
| Browser → OTP provider | Phone number, 6-digit code | Code hashed (HMAC) at rest, 5-min TTL, 5 attempts, lockout, never logged |
| Browser → Google | Google ID token | Verified server-side against Google JWKS; grants explorer only |
| Profile → engine | Only facts the rule references | Evaluation stores a *minimal* snapshot, not the whole profile |
| Vault → disk | File bytes | Magic-byte type check, 5 MB cap, malware scan, AES-256-GCM, random object key, no public URL; 5-min signed link + session owner check |
| Chat → LLM | Redacted question, retrieved chunks, engine summary | No profile values, no documents, no identifiers; source text wrapped as data; output citation-validated |
| Queue → email | Template + authenticated link | Subject lines are generic; links require sign-in; one-click unsubscribe |
| Admin → source sites | URL fetch | Low rate, identified user agent, hash only (no scraping) |

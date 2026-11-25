// Source and licensing register. Every scheme record cites one or more of these.
// `reviewerStatus` stays "pending" until a curator confirms the terms and the content.

export interface SourceSeed {
  id: string;
  title: string;
  url: string;
  publisher: string;
  kind: "guideline" | "portal" | "directory" | "faq" | "dataset" | "api";
  isOfficial: boolean;
  isThirdParty?: boolean;
  licence: string;
  termsNotes: string;
}

const GOV_TERMS =
  "Government website content. Link to the original URL; do not mirror, iframe or mask. Re-check the site's terms and copyright policy before reusing text verbatim.";

export const SOURCES: SourceSeed[] = [
  // Directories & platforms
  { id: "myscheme", title: "myScheme — National scheme discovery platform", url: "https://www.myscheme.gov.in", publisher: "NeGD, MeitY", kind: "directory", isOfficial: true, licence: "Partner terms required", termsNotes: "Partner terms require the original URL, prohibit iframes/masking/intermediary layers and require written permission before copying data or implying affiliation. Used here for discovery links only; no data copied." },
  { id: "indiagov", title: "National Portal of India — Schemes", url: "https://www.india.gov.in/my-government/schemes", publisher: "NIC, MeitY", kind: "directory", isOfficial: true, licence: "Government website", termsNotes: "Directory only; the owning department remains the source of truth." },
  { id: "nsp", title: "National Scholarship Portal", url: "https://scholarships.gov.in", publisher: "Ministry of Electronics & IT / participating ministries", kind: "portal", isOfficial: true, licence: "Government website", termsNotes: "No automated submission without an approved integration. Link users to the portal." },
  { id: "umang", title: "UMANG", url: "https://web.umang.gov.in", publisher: "NeGD, MeitY", kind: "portal", isOfficial: true, licence: "Government website", termsNotes: "Service discovery links only." },
  { id: "apisetu", title: "API Setu", url: "https://apisetu.gov.in", publisher: "NeGD, MeitY", kind: "api", isOfficial: true, licence: "API terms per publisher", termsNotes: "Onboarding and per-API approval required before production use. Not integrated in this MVP." },
  { id: "digilocker", title: "DigiLocker (requester integration via API Setu)", url: "https://www.digilocker.gov.in", publisher: "NeGD, MeitY", kind: "api", isOfficial: true, licence: "Requester terms", termsNotes: "Partner onboarding + requester terms required. Adapter is a mock in this MVP." },
  { id: "uidai", title: "UIDAI developer resources", url: "https://uidai.gov.in", publisher: "UIDAI", kind: "api", isOfficial: true, licence: "Authorised agencies only", termsNotes: "Only via an eligible authorised agency (AUA/KUA). SevaSutra does not build any Aadhaar OTP/eKYC flow." },
  { id: "datagov", title: "Open Government Data Platform", url: "https://data.gov.in", publisher: "NIC, MeitY", kind: "dataset", isOfficial: true, licence: "GODL-India (per dataset)", termsNotes: "Record licence, attribution and freshness per dataset." },
  // Scheme owners
  { id: "pmkisan", title: "PM-KISAN official portal", url: "https://pmkisan.gov.in", publisher: "Ministry of Agriculture & Farmers Welfare", kind: "portal", isOfficial: true, licence: "Government website", termsNotes: GOV_TERMS },
  { id: "pmjdy", title: "Pradhan Mantri Jan Dhan Yojana", url: "https://pmjdy.gov.in", publisher: "Department of Financial Services, Ministry of Finance", kind: "portal", isOfficial: true, licence: "Government website", termsNotes: GOV_TERMS },
  { id: "jansuraksha", title: "Jan Suraksha portal (PMJJBY, PMSBY, APY)", url: "https://www.jansuraksha.gov.in", publisher: "Department of Financial Services, Ministry of Finance", kind: "portal", isOfficial: true, licence: "Government website", termsNotes: GOV_TERMS },
  { id: "pfrda_apy", title: "Atal Pension Yojana — PFRDA", url: "https://www.pfrda.org.in", publisher: "PFRDA", kind: "guideline", isOfficial: true, licence: "Government website", termsNotes: GOV_TERMS },
  { id: "pmjay", title: "Ayushman Bharat PM-JAY", url: "https://pmjay.gov.in", publisher: "National Health Authority", kind: "portal", isOfficial: true, licence: "Government website", termsNotes: GOV_TERMS },
  { id: "nha_beneficiary", title: "PM-JAY beneficiary check", url: "https://beneficiary.nha.gov.in", publisher: "National Health Authority", kind: "portal", isOfficial: true, licence: "Government website", termsNotes: "Users check their own entitlement here; SevaSutra never queries it on their behalf." },
  { id: "pmuy", title: "Pradhan Mantri Ujjwala Yojana", url: "https://www.pmuy.gov.in", publisher: "Ministry of Petroleum & Natural Gas", kind: "portal", isOfficial: true, licence: "Government website", termsNotes: GOV_TERMS },
  { id: "pmayu", title: "PMAY-Urban 2.0", url: "https://pmay-urban.gov.in", publisher: "Ministry of Housing & Urban Affairs", kind: "portal", isOfficial: true, licence: "Government website", termsNotes: GOV_TERMS },
  { id: "indiapost_ssy", title: "Sukanya Samriddhi Account — India Post", url: "https://www.indiapost.gov.in", publisher: "Department of Posts", kind: "guideline", isOfficial: true, licence: "Government website", termsNotes: GOV_TERMS },
  { id: "nsiindia", title: "National Savings Institute — small savings schemes", url: "https://www.nsiindia.gov.in", publisher: "Ministry of Finance", kind: "guideline", isOfficial: true, licence: "Government website", termsNotes: GOV_TERMS },
  { id: "pmmvy", title: "PM Matru Vandana Yojana", url: "https://pmmvy.wcd.gov.in", publisher: "Ministry of Women & Child Development", kind: "portal", isOfficial: true, licence: "Government website", termsNotes: GOV_TERMS },
  { id: "nsap", title: "National Social Assistance Programme", url: "https://nsap.nic.in", publisher: "Ministry of Rural Development", kind: "portal", isOfficial: true, licence: "Government website", termsNotes: GOV_TERMS },
  { id: "msje", title: "Department of Social Justice & Empowerment — scholarships", url: "https://socialjustice.gov.in", publisher: "Ministry of Social Justice & Empowerment", kind: "guideline", isOfficial: true, licence: "Government website", termsNotes: GOV_TERMS },
  { id: "moe", title: "Ministry of Education — scholarships", url: "https://www.education.gov.in", publisher: "Ministry of Education", kind: "guideline", isOfficial: true, licence: "Government website", termsNotes: GOV_TERMS },
  { id: "aicte", title: "AICTE student development schemes", url: "https://www.aicte-india.org", publisher: "AICTE", kind: "guideline", isOfficial: true, licence: "Government website", termsNotes: GOV_TERMS },
  { id: "pmvishwakarma", title: "PM Vishwakarma", url: "https://pmvishwakarma.gov.in", publisher: "Ministry of MSME", kind: "portal", isOfficial: true, licence: "Government website", termsNotes: GOV_TERMS },
  { id: "pmsvanidhi", title: "PM SVANidhi", url: "https://pmsvanidhi.mohua.gov.in", publisher: "Ministry of Housing & Urban Affairs", kind: "portal", isOfficial: true, licence: "Government website", termsNotes: GOV_TERMS },
  { id: "standup", title: "Stand-Up India", url: "https://www.standupmitra.in", publisher: "SIDBI / Department of Financial Services", kind: "portal", isOfficial: true, licence: "Government website", termsNotes: GOV_TERMS },
  { id: "mh_ladkibahin", title: "Mukhyamantri Majhi Ladki Bahin Yojana portal", url: "https://ladakibahin.maharashtra.gov.in", publisher: "Women & Child Development Dept., Government of Maharashtra", kind: "portal", isOfficial: true, licence: "Government website", termsNotes: GOV_TERMS },
  { id: "ka_seva_sindhu", title: "Seva Sindhu — Gruha Lakshmi", url: "https://sevasindhugs.karnataka.gov.in", publisher: "Government of Karnataka", kind: "portal", isOfficial: true, licence: "Government website", termsNotes: GOV_TERMS },
  { id: "rf_scholarships", title: "Reliance Foundation Scholarships", url: "https://www.scholarships.reliancefoundation.org", publisher: "Reliance Foundation (private)", kind: "portal", isOfficial: false, isThirdParty: true, licence: "Third-party website", termsNotes: "Non-government provider. No scraping; link only. Show provider privacy policy and terms. Partnership/permission needed before importing data." },
];

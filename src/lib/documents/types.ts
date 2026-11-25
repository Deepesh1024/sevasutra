import type { Localized } from "@/lib/engine/types";

export interface DocTypeDef {
  type: string;
  label: Localized;
  sensitive?: boolean;
  /** Default validity in months (income certificates usually expire; Aadhaar does not). */
  validityMonths?: number;
}

export const DOC_TYPES: DocTypeDef[] = [
  { type: "aadhaar", label: { en: "Aadhaar card (masked copy recommended)", hi: "आधार कार्ड (मास्क्ड प्रति बेहतर)" }, sensitive: true },
  { type: "identity_proof", label: { en: "Other identity proof (voter ID, PAN, passport, driving licence)", hi: "अन्य पहचान प्रमाण (मतदाता पहचान पत्र, पैन, पासपोर्ट, ड्राइविंग लाइसेंस)" } },
  { type: "income_certificate", label: { en: "Income certificate", hi: "आय प्रमाणपत्र" }, validityMonths: 12, sensitive: true },
  { type: "caste_certificate", label: { en: "Caste / community certificate", hi: "जाति / समुदाय प्रमाणपत्र" }, sensitive: true },
  { type: "domicile_certificate", label: { en: "Domicile / residence certificate", hi: "अधिवास / निवास प्रमाणपत्र" } },
  { type: "disability_certificate", label: { en: "Disability certificate / UDID card", hi: "दिव्यांगता प्रमाणपत्र / UDID कार्ड" }, sensitive: true },
  { type: "bank_passbook", label: { en: "Bank passbook / cancelled cheque", hi: "बैंक पासबुक / रद्द चेक" }, sensitive: true },
  { type: "marksheet", label: { en: "Marksheet of last qualifying exam", hi: "पिछली योग्यता परीक्षा की अंकतालिका" } },
  { type: "admission_proof", label: { en: "Fee receipt / admission letter / bonafide certificate", hi: "शुल्क रसीद / प्रवेश पत्र / बोनाफाइड प्रमाणपत्र" }, validityMonths: 12 },
  { type: "land_record", label: { en: "Land ownership record (khatauni / RoR)", hi: "भूमि अभिलेख (खतौनी / अधिकार अभिलेख)" } },
  { type: "ration_card", label: { en: "Ration card", hi: "राशन कार्ड" } },
  { type: "birth_certificate", label: { en: "Birth certificate", hi: "जन्म प्रमाणपत्र" } },
  { type: "photo", label: { en: "Passport-size photograph", hi: "पासपोर्ट आकार का फ़ोटो" } },
  { type: "mcp_card", label: { en: "Mother and Child Protection (MCP) card", hi: "मातृ एवं शिशु सुरक्षा (MCP) कार्ड" }, sensitive: true },
  { type: "vending_certificate", label: { en: "Vending certificate / Letter of Recommendation", hi: "वेंडिंग प्रमाणपत्र / अनुशंसा पत्र" } },
  { type: "business_plan", label: { en: "Project report / business plan", hi: "परियोजना रिपोर्ट / व्यवसाय योजना" } },
  { type: "age_proof", label: { en: "Age proof", hi: "आयु प्रमाण" } },
];

export const DOC_MAP: Record<string, DocTypeDef> = Object.fromEntries(DOC_TYPES.map((d) => [d.type, d]));

export function docLabel(type: string): Localized {
  return DOC_MAP[type]?.label ?? { en: type.replace(/_/g, " ") };
}

import type { Localized } from "@/lib/engine/types";

// Consent matrix (also rendered at /privacy and documented in docs/consent-matrix.md).
export const NOTICE_VERSION = "2026-11-v3";

export type ConsentPurpose = "profile_basic" | "profile_sensitive" | "documents" | "reminders_email" | "document_reuse" | "guardian_minor";

export interface ConsentDef {
  purpose: ConsentPurpose;
  title: Localized;
  data: Localized;
  basis: Localized;
  retention: Localized;
  sharing: Localized;
  deletion: Localized;
  required: boolean;
}

export const CONSENTS: ConsentDef[] = [
  {
    purpose: "profile_basic",
    title: { en: "Save my profile to check eligibility", hi: "पात्रता जाँच के लिए मेरी प्रोफ़ाइल सहेजें" },
    data: { en: "Age or date of birth, state, rural/urban, occupation, income range, student status and other non-sensitive answers.", hi: "आयु या जन्म तिथि, राज्य, ग्रामीण/शहरी, व्यवसाय, आय सीमा, विद्यार्थी स्थिति और अन्य गैर-संवेदनशील उत्तर।" },
    basis: { en: "Your consent (DPDP Act 2023, s.6).", hi: "आपकी सहमति (डीपीडीपी अधिनियम 2023, धारा 6)।" },
    retention: { en: "Until you delete it, or 24 months after your last sign-in.", hi: "जब तक आप हटाएँ नहीं, या अंतिम साइन-इन के 24 महीने बाद तक।" },
    sharing: { en: "Not shared. Used only inside SevaSutra's rule engine.", hi: "साझा नहीं किया जाता। केवल सेवासूत्र के नियम इंजन में उपयोग।" },
    deletion: { en: "Delete any answer or your whole account from Account settings at any time.", hi: "खाता सेटिंग्स से कभी भी कोई उत्तर या पूरा खाता हटाएँ।" },
    required: true,
  },
  {
    purpose: "profile_sensitive",
    title: { en: "Use sensitive answers (social category, disability, maternity)", hi: "संवेदनशील उत्तरों का उपयोग (सामाजिक श्रेणी, दिव्यांगता, मातृत्व)" },
    data: { en: "Social category, disability status/percentage, pregnancy status — only if you choose to answer.", hi: "सामाजिक श्रेणी, दिव्यांगता, गर्भावस्था — केवल यदि आप उत्तर देना चुनें।" },
    basis: { en: "Your explicit consent; you can always answer 'prefer not to say'.", hi: "आपकी स्पष्ट सहमति; आप हमेशा 'नहीं बताना चाहते' चुन सकते हैं।" },
    retention: { en: "Until you delete it or withdraw consent (then erased within 30 days).", hi: "जब तक आप हटाएँ या सहमति वापस लें (फिर 30 दिनों में मिटाया जाता है)।" },
    sharing: { en: "Not shared.", hi: "साझा नहीं किया जाता।" },
    deletion: { en: "Withdrawing this consent deletes these answers.", hi: "यह सहमति वापस लेने पर ये उत्तर हट जाते हैं।" },
    required: false,
  },
  {
    purpose: "documents",
    title: { en: "Store documents I upload in my encrypted vault", hi: "मेरे अपलोड किए दस्तावेज़ एन्क्रिप्टेड तिजोरी में रखें" },
    data: { en: "Files you upload (certificates, marksheets). Each file is read by OCR on our server and a privacy-redacted text excerpt (ID, phone and account numbers removed) is sent to our AI provider (Groq) only to check it is the document type you chose. If the text cannot be read, the image itself (or a picture of the PDF's first page) is sent instead — never for Aadhaar or bank documents. Wrong documents are rejected and not stored. Contents are encrypted and never logged.", hi: "आपकी अपलोड की गई फ़ाइलें। हर फ़ाइल हमारे सर्वर पर OCR से पढ़ी जाती है और गोपनीयता हेतु संपादित पाठ-अंश (पहचान, फ़ोन, खाता संख्याएँ हटाकर) केवल यह जाँचने के लिए हमारे AI प्रदाता (Groq) को भेजा जाता है कि यह चुना गया दस्तावेज़ ही है। पाठ न पढ़े जाने पर छवि (या PDF के पहले पृष्ठ का चित्र) भेजी जाती है — आधार या बैंक दस्तावेज़ों के लिए कभी नहीं। गलत दस्तावेज़ अस्वीकार होते हैं और संग्रहीत नहीं होते। सामग्री एन्क्रिप्टेड रहती है और कभी लॉग नहीं होती।" },
    basis: { en: "Your consent.", hi: "आपकी सहमति।" },
    retention: { en: "Until you delete the file, or when it expires (e.g. income certificates after 12 months, with a reminder).", hi: "जब तक आप फ़ाइल हटाएँ, या समाप्ति तक।" },
    sharing: { en: "A redacted text excerpt — or, if OCR fails, the page image (not for Aadhaar/bank documents) — goes to Groq for the type check (not used to train models by default per provider terms — confirm before production). The file itself is never sent anywhere; you download it to upload on official portals.", hi: "प्रकार-जाँच हेतु संपादित पाठ-अंश Groq को जाता है। फ़ाइल स्वयं कहीं नहीं भेजी जाती; आप इसे डाउनलोड कर आधिकारिक पोर्टल पर अपलोड करते हैं।" },
    deletion: { en: "Delete removes the encrypted file immediately; backups roll off within 30 days.", hi: "हटाने पर एन्क्रिप्टेड फ़ाइल तुरंत मिटती है; बैकअप 30 दिनों में।" },
    required: false,
  },
  {
    purpose: "reminders_email",
    title: { en: "Email me reminders (deadlines, missing documents, status, corrections)", hi: "मुझे ईमेल रिमाइंडर भेजें (अंतिम तिथि, दस्तावेज़, स्थिति, सुधार)" },
    data: { en: "Your email address and which schemes you saved.", hi: "आपका ईमेल पता और सहेजी गई योजनाएँ।" },
    basis: { en: "Your consent; unsubscribe with one click.", hi: "आपकी सहमति; एक क्लिक में सदस्यता समाप्त करें।" },
    retention: { en: "Until you unsubscribe. Delivery logs kept 12 months for audit.", hi: "सदस्यता समाप्त करने तक। डिलीवरी लॉग 12 महीने।" },
    sharing: { en: "Sent through our email provider only.", hi: "केवल हमारे ईमेल प्रदाता के माध्यम से।" },
    deletion: { en: "Unsubscribe link in every email, or Account → Notifications.", hi: "हर ईमेल में सदस्यता समाप्ति लिंक, या खाता → सूचनाएँ।" },
    required: false,
  },
  {
    purpose: "document_reuse",
    title: { en: "Reuse a document I already uploaded for other schemes", hi: "पहले से अपलोड दस्तावेज़ को अन्य योजनाओं के लिए दोबारा उपयोग करें" },
    data: { en: "Links an existing vault document to another scheme's checklist.", hi: "मौजूदा दस्तावेज़ को अन्य योजना की चेकलिस्ट से जोड़ता है।" },
    basis: { en: "Your consent.", hi: "आपकी सहमति।" },
    retention: { en: "Same as the document.", hi: "दस्तावेज़ के समान।" },
    sharing: { en: "Not shared.", hi: "साझा नहीं।" },
    deletion: { en: "Withdraw to stop automatic reuse.", hi: "स्वतः उपयोग रोकने के लिए वापस लें।" },
    required: false,
  },
  {
    purpose: "guardian_minor",
    title: { en: "I am the parent/guardian and consent to processing this child's data", hi: "मैं माता-पिता/अभिभावक हूँ और इस बच्चे के डेटा के प्रसंस्करण की सहमति देता/देती हूँ" },
    data: { en: "The child's age, gender, education details entered by you.", hi: "आपके द्वारा दर्ज बच्चे की आयु, लिंग, शिक्षा विवरण।" },
    basis: { en: "Verifiable parental consent (DPDP Act 2023, s.9). No tracking or targeted content for children.", hi: "सत्यापन योग्य अभिभावक सहमति (डीपीडीपी अधिनियम 2023, धारा 9)।" },
    retention: { en: "Until you remove the family member.", hi: "परिवार सदस्य हटाने तक।" },
    sharing: { en: "Not shared.", hi: "साझा नहीं।" },
    deletion: { en: "Remove the family member to erase their data.", hi: "डेटा मिटाने के लिए परिवार सदस्य हटाएँ।" },
    required: true,
  },
];

export const CONSENT_MAP = Object.fromEntries(CONSENTS.map((c) => [c.purpose, c])) as Record<ConsentPurpose, ConsentDef>;

import type { Localized } from "@/lib/engine/types";

// Typed profile schema. Fields are asked progressively: only `discovery` fields up front,
// everything else only when a scheme the user is looking at needs it.

export type FieldType = "select" | "multiselect" | "number" | "money" | "date" | "boolean" | "text";

export interface FieldOption {
  value: string;
  label: Localized;
}

export interface FieldDef {
  key: string;
  section: SectionKey;
  type: FieldType;
  label: Localized;
  help?: Localized;
  options?: FieldOption[];
  min?: number;
  max?: number;
  /** Part of the minimal discovery set asked on first use. */
  discovery?: boolean;
  /** Sensitive personal data: requires the `sensitive_profile` consent and is masked in explanations. */
  sensitive?: boolean;
  /** Offer "prefer not to say". */
  allowDecline?: boolean;
  /** Household-level fact: shared by all members, stored on the primary profile. */
  household?: boolean;
}

export type SectionKey =
  | "basics"
  | "location"
  | "social"
  | "disability"
  | "education"
  | "work_income"
  | "agriculture"
  | "housing"
  | "benefits"
  | "family"
  | "business";

export const SECTIONS: { key: SectionKey; label: Localized }[] = [
  { key: "basics", label: { en: "Basics", hi: "बुनियादी जानकारी" } },
  { key: "location", label: { en: "Where you live", hi: "आप कहाँ रहते हैं" } },
  { key: "work_income", label: { en: "Work and income", hi: "काम और आय" } },
  { key: "education", label: { en: "Education", hi: "शिक्षा" } },
  { key: "social", label: { en: "Social category", hi: "सामाजिक श्रेणी" } },
  { key: "disability", label: { en: "Disability", hi: "दिव्यांगता" } },
  { key: "agriculture", label: { en: "Farming", hi: "खेती" } },
  { key: "housing", label: { en: "Housing and household", hi: "आवास और परिवार" } },
  { key: "family", label: { en: "Family and maternity", hi: "परिवार और मातृत्व" } },
  { key: "business", label: { en: "Business and trade", hi: "व्यवसाय और कारीगरी" } },
  { key: "benefits", label: { en: "Benefits you already receive", hi: "पहले से मिल रहे लाभ" } },
];

const YES_NO_NOTE: Localized = { en: "Answer for yourself (or this family member).", hi: "अपने (या इस परिवार सदस्य के) लिए उत्तर दें।" };

export const STATES: FieldOption[] = [
  ["AN", "Andaman and Nicobar Islands", "अंडमान और निकोबार द्वीपसमूह"],
  ["AP", "Andhra Pradesh", "आंध्र प्रदेश"],
  ["AR", "Arunachal Pradesh", "अरुणाचल प्रदेश"],
  ["AS", "Assam", "असम"],
  ["BR", "Bihar", "बिहार"],
  ["CH", "Chandigarh", "चंडीगढ़"],
  ["CT", "Chhattisgarh", "छत्तीसगढ़"],
  ["DH", "Dadra and Nagar Haveli and Daman and Diu", "दादरा और नगर हवेली और दमन और दीव"],
  ["DL", "Delhi", "दिल्ली"],
  ["GA", "Goa", "गोवा"],
  ["GJ", "Gujarat", "गुजरात"],
  ["HR", "Haryana", "हरियाणा"],
  ["HP", "Himachal Pradesh", "हिमाचल प्रदेश"],
  ["JK", "Jammu and Kashmir", "जम्मू और कश्मीर"],
  ["JH", "Jharkhand", "झारखंड"],
  ["KA", "Karnataka", "कर्नाटक"],
  ["KL", "Kerala", "केरल"],
  ["LA", "Ladakh", "लद्दाख"],
  ["LD", "Lakshadweep", "लक्षद्वीप"],
  ["MP", "Madhya Pradesh", "मध्य प्रदेश"],
  ["MH", "Maharashtra", "महाराष्ट्र"],
  ["MN", "Manipur", "मणिपुर"],
  ["ML", "Meghalaya", "मेघालय"],
  ["MZ", "Mizoram", "मिज़ोरम"],
  ["NL", "Nagaland", "नागालैंड"],
  ["OR", "Odisha", "ओडिशा"],
  ["PY", "Puducherry", "पुदुचेरी"],
  ["PB", "Punjab", "पंजाब"],
  ["RJ", "Rajasthan", "राजस्थान"],
  ["SK", "Sikkim", "सिक्किम"],
  ["TN", "Tamil Nadu", "तमिलनाडु"],
  ["TG", "Telangana", "तेलंगाना"],
  ["TR", "Tripura", "त्रिपुरा"],
  ["UP", "Uttar Pradesh", "उत्तर प्रदेश"],
  ["UK", "Uttarakhand", "उत्तराखंड"],
  ["WB", "West Bengal", "पश्चिम बंगाल"],
].map(([value, en, hi]) => ({ value, label: { en, hi } }));

const opt = (value: string, en: string, hi: string): FieldOption => ({ value, label: { en, hi } });

export const VISHWAKARMA_TRADES: FieldOption[] = [
  opt("carpenter", "Carpenter (Suthar/Badhai)", "बढ़ई"),
  opt("boat_maker", "Boat maker", "नाव निर्माता"),
  opt("armourer", "Armourer", "अस्त्रकार"),
  opt("blacksmith", "Blacksmith (Lohar)", "लोहार"),
  opt("hammer_toolkit_maker", "Hammer and tool kit maker", "हथौड़ा और टूलकिट निर्माता"),
  opt("locksmith", "Locksmith", "ताला बनाने वाला"),
  opt("goldsmith", "Goldsmith (Sonar)", "सुनार"),
  opt("potter", "Potter (Kumhaar)", "कुम्हार"),
  opt("sculptor", "Sculptor / stone carver / stone breaker", "मूर्तिकार / पत्थर तराशने वाला"),
  opt("cobbler", "Cobbler / footwear artisan", "मोची / जूता कारीगर"),
  opt("mason", "Mason (Rajmistri)", "राजमिस्त्री"),
  opt("basket_mat_broom_maker", "Basket / mat / broom maker, coir weaver", "टोकरी / चटाई / झाड़ू निर्माता"),
  opt("doll_toy_maker", "Doll and toy maker (traditional)", "पारंपरिक गुड़िया और खिलौना निर्माता"),
  opt("barber", "Barber (Naai)", "नाई"),
  opt("garland_maker", "Garland maker (Malakaar)", "माला बनाने वाला"),
  opt("washerman", "Washerman (Dhobi)", "धोबी"),
  opt("tailor", "Tailor (Darzi)", "दर्ज़ी"),
  opt("fishing_net_maker", "Fishing net maker", "मछली जाल निर्माता"),
];

export const FIELDS: FieldDef[] = [
  // ── Basics (discovery set) ──
  {
    key: "state", section: "location", type: "select", discovery: true, options: STATES,
    label: { en: "State / Union Territory where you live", hi: "आप किस राज्य / केंद्र शासित प्रदेश में रहते हैं" },
  },
  {
    key: "date_of_birth", section: "basics", type: "date", discovery: true,
    label: { en: "Date of birth", hi: "जन्म तिथि" },
    help: { en: "Used only to work out age limits. You can give an age range instead.", hi: "केवल आयु सीमा जाँचने के लिए। आप इसके बजाय आयु वर्ग भी दे सकते हैं।" },
  },
  {
    key: "age_band", section: "basics", type: "select", discovery: true,
    label: { en: "Age range (if you prefer not to give date of birth)", hi: "आयु वर्ग (यदि आप जन्म तिथि नहीं देना चाहते)" },
    options: [
      opt("0-9", "Under 10", "10 से कम"), opt("10-17", "10–17", "10–17"), opt("18-25", "18–25", "18–25"),
      opt("26-40", "26–40", "26–40"), opt("41-50", "41–50", "41–50"), opt("51-59", "51–59", "51–59"),
      opt("60-69", "60–69", "60–69"), opt("70-79", "70–79", "70–79"), opt("80-120", "80 or above", "80 या अधिक"),
    ],
  },
  {
    key: "is_indian_citizen", section: "basics", type: "boolean", discovery: true,
    label: { en: "Are you an Indian citizen?", hi: "क्या आप भारतीय नागरिक हैं?" },
  },
  {
    key: "gender", section: "basics", type: "select", allowDecline: true, sensitive: false,
    label: { en: "Gender", hi: "लिंग" },
    help: { en: "Asked only because some schemes are for women, girls or transgender persons.", hi: "केवल इसलिए पूछा गया है क्योंकि कुछ योजनाएँ महिलाओं, बालिकाओं या ट्रांसजेंडर व्यक्तियों के लिए हैं।" },
    options: [opt("female", "Female", "महिला"), opt("male", "Male", "पुरुष"), opt("transgender", "Transgender", "ट्रांसजेंडर")],
  },
  {
    key: "marital_status", section: "basics", type: "select", allowDecline: true,
    label: { en: "Marital status", hi: "वैवाहिक स्थिति" },
    options: [
      opt("unmarried", "Unmarried", "अविवाहित"), opt("married", "Married", "विवाहित"), opt("widowed", "Widowed", "विधवा/विधुर"),
      opt("divorced", "Divorced", "तलाकशुदा"), opt("separated", "Separated / abandoned", "परित्यक्त / अलग"),
    ],
  },
  // ── Location ──
  {
    key: "residence_area", section: "location", type: "select", discovery: true,
    label: { en: "Do you live in a rural or urban area?", hi: "आप ग्रामीण या शहरी क्षेत्र में रहते हैं?" },
    options: [opt("rural", "Rural (village)", "ग्रामीण (गाँव)"), opt("urban", "Urban (town / city)", "शहरी (कस्बा / शहर)")],
  },
  { key: "district", section: "location", type: "text", label: { en: "District", hi: "ज़िला" } },
  {
    key: "is_state_domicile", section: "location", type: "boolean",
    label: { en: "Are you a domicile (permanent resident) of this state?", hi: "क्या आप इस राज्य के मूल निवासी (अधिवासी) हैं?" },
  },
  // ── Social ──
  {
    key: "social_category", section: "social", type: "select", sensitive: true, allowDecline: true,
    label: { en: "Social category", hi: "सामाजिक श्रेणी" },
    help: { en: "Never guessed from your name or address. Choose 'prefer not to say' if you wish — some schemes will then show as 'needs information'.", hi: "आपके नाम या पते से कभी अनुमान नहीं लगाया जाता। चाहें तो 'नहीं बताना चाहते' चुनें।" },
    options: [
      opt("general", "General", "सामान्य"), opt("ews", "General – EWS", "सामान्य – ईडब्ल्यूएस"), opt("obc", "OBC", "अन्य पिछड़ा वर्ग (OBC)"),
      opt("ebc", "EBC", "अति पिछड़ा वर्ग (EBC)"), opt("dnt", "DNT (De-notified tribe)", "विमुक्त जनजाति (DNT)"),
      opt("sc", "Scheduled Caste (SC)", "अनुसूचित जाति (SC)"), opt("st", "Scheduled Tribe (ST)", "अनुसूचित जनजाति (ST)"),
    ],
  },
  // ── Disability ──
  {
    key: "has_disability", section: "disability", type: "boolean", sensitive: true, allowDecline: true,
    label: { en: "Do you have a disability (benchmark disability as per a certificate)?", hi: "क्या आपको कोई दिव्यांगता है (प्रमाणपत्र के अनुसार)?" },
  },
  {
    key: "disability_percent", section: "disability", type: "number", sensitive: true, min: 0, max: 100, allowDecline: true,
    label: { en: "Disability percentage on your certificate", hi: "प्रमाणपत्र में दिव्यांगता प्रतिशत" },
  },
  // ── Education ──
  { key: "is_student", section: "education", type: "boolean", discovery: true, label: { en: "Are you currently a student?", hi: "क्या आप अभी विद्यार्थी हैं?" } },
  {
    key: "education_level", section: "education", type: "select",
    label: { en: "Current class / course level", hi: "वर्तमान कक्षा / पाठ्यक्रम स्तर" },
    options: [
      opt("class_1_7", "Class 1–7", "कक्षा 1–7"), opt("class_8", "Class 8", "कक्षा 8"), opt("class_9_10", "Class 9–10", "कक्षा 9–10"),
      opt("class_11_12", "Class 11–12", "कक्षा 11–12"), opt("diploma", "Diploma / ITI / polytechnic", "डिप्लोमा / आईटीआई / पॉलिटेक्निक"),
      opt("ug", "Undergraduate degree", "स्नातक"), opt("pg", "Postgraduate degree", "स्नातकोत्तर"), opt("phd", "PhD / research", "पीएचडी / शोध"),
    ],
  },
  { key: "year_of_study", section: "education", type: "number", min: 1, max: 7, label: { en: "Year of study in current course", hi: "वर्तमान पाठ्यक्रम का वर्ष" } },
  {
    key: "institution_type", section: "education", type: "select",
    label: { en: "Type of school / institution", hi: "विद्यालय / संस्थान का प्रकार" },
    options: [
      opt("government", "Government", "सरकारी"), opt("government_aided", "Government-aided", "सरकारी सहायता प्राप्त"),
      opt("local_body", "Local body", "स्थानीय निकाय"), opt("private", "Private unaided", "निजी"),
      opt("kvs_nvs_residential", "KVS / JNV / state residential (with free boarding)", "केवी / जेएनवी / आवासीय (मुफ़्त छात्रावास)"),
    ],
  },
  { key: "is_technical_course", section: "education", type: "boolean", label: { en: "Is your course a technical degree or diploma (engineering, pharmacy, etc.)?", hi: "क्या आपका पाठ्यक्रम तकनीकी डिग्री या डिप्लोमा है?" } },
  { key: "institution_aicte_approved", section: "education", type: "boolean", label: { en: "Is your institution AICTE-approved?", hi: "क्या आपका संस्थान AICTE से मान्यता प्राप्त है?" } },
  { key: "is_regular_course", section: "education", type: "boolean", label: { en: "Is it a regular (not correspondence / distance) course?", hi: "क्या यह नियमित (पत्राचार / दूरस्थ नहीं) पाठ्यक्रम है?" } },
  { key: "first_year_admission", section: "education", type: "boolean", label: { en: "Were you admitted to the first year this academic year?", hi: "क्या इस शैक्षणिक वर्ष में आपका प्रथम वर्ष में प्रवेश हुआ है?" } },
  { key: "previous_exam_percent", section: "education", type: "number", min: 0, max: 100, label: { en: "Marks (%) in your last qualifying exam", hi: "पिछली योग्यता परीक्षा में अंक (%)" } },
  {
    key: "class12_above_80_percentile", section: "education", type: "boolean",
    label: { en: "Were you above the 80th percentile of successful candidates in your Class 12 board (your stream)?", hi: "क्या आप अपने कक्षा 12 बोर्ड (आपकी स्ट्रीम) में सफल उम्मीदवारों के 80वें पर्सेंटाइल से ऊपर थे?" },
    help: { en: "Boards publish the cut-off marks. Check your board's notice if unsure.", hi: "बोर्ड कट-ऑफ अंक प्रकाशित करते हैं। संदेह हो तो बोर्ड की सूचना देखें।" },
  },
  { key: "receiving_other_scholarship", section: "benefits", type: "boolean", label: { en: "Are you already receiving another government scholarship this year?", hi: "क्या आपको इस वर्ष पहले से कोई अन्य सरकारी छात्रवृत्ति मिल रही है?" } },
  // ── Work & income ──
  {
    key: "occupation", section: "work_income", type: "select", discovery: true,
    label: { en: "Main occupation", hi: "मुख्य व्यवसाय" },
    options: [
      opt("farmer", "Farmer / cultivator", "किसान"), opt("agri_labourer", "Agricultural labourer", "खेतिहर मज़दूर"),
      opt("street_vendor", "Street vendor", "रेहड़ी-पटरी विक्रेता"), opt("artisan", "Artisan / craftsperson", "कारीगर / शिल्पकार"),
      opt("self_employed", "Self-employed / small business", "स्व-रोज़गार / छोटा व्यवसाय"),
      opt("salaried_private", "Salaried (private)", "वेतनभोगी (निजी)"), opt("salaried_govt", "Government employee", "सरकारी कर्मचारी"),
      opt("unorganised_worker", "Other unorganised / daily-wage worker", "अन्य असंगठित / दिहाड़ी मज़दूर"),
      opt("student", "Student", "विद्यार्थी"), opt("homemaker", "Homemaker", "गृहिणी"),
      opt("unemployed", "Not working", "बेरोज़गार"), opt("retired", "Retired", "सेवानिवृत्त"),
    ],
  },
  {
    key: "annual_family_income", section: "work_income", type: "money", discovery: true, min: 0, allowDecline: true,
    label: { en: "Total annual family income (₹, all sources)", hi: "परिवार की कुल वार्षिक आय (₹, सभी स्रोत)" },
    help: { en: "Approximate is fine for discovery. Schemes check this against an income certificate later.", hi: "खोज के लिए अनुमानित राशि ठीक है। बाद में आय प्रमाणपत्र से जाँच होती है।" },
    household: true,
  },
  { key: "pays_income_tax", section: "work_income", type: "boolean", label: { en: "Did you (or your family, for family schemes) pay income tax last year?", hi: "क्या आपने (या परिवार ने) पिछले वर्ष आयकर दिया?" } },
  { key: "is_govt_employee", section: "work_income", type: "boolean", label: { en: "Are you a serving or retired government employee (central/state/PSU)?", hi: "क्या आप सेवारत या सेवानिवृत्त सरकारी कर्मचारी हैं (केंद्र/राज्य/PSU)?" } },
  { key: "is_registered_professional", section: "work_income", type: "boolean", label: { en: "Are you a registered practising professional (doctor, engineer, lawyer, CA, architect)?", hi: "क्या आप पंजीकृत पेशेवर हैं (डॉक्टर, इंजीनियर, वकील, सीए, आर्किटेक्ट)?" } },
  { key: "monthly_pension", section: "work_income", type: "money", min: 0, label: { en: "Monthly pension received (₹, 0 if none)", hi: "मासिक पेंशन (₹, न हो तो 0)" } },
  { key: "holds_constitutional_post", section: "work_income", type: "boolean", label: { en: "Do you (or a family member) hold or have held a constitutional post, or are/were an MP, MLA, minister or mayor?", hi: "क्या आप (या परिवार का कोई सदस्य) संवैधानिक पद पर हैं/थे या सांसद, विधायक, मंत्री या महापौर हैं/थे?" } },
  { key: "has_bank_account", section: "work_income", type: "boolean", label: { en: "Do you have a savings bank / post office account?", hi: "क्या आपका बचत बैंक / डाकघर खाता है?" } },
  // ── Agriculture ──
  { key: "owns_cultivable_land", section: "agriculture", type: "boolean", label: { en: "Does your family own cultivable land recorded in a family member's name?", hi: "क्या आपके परिवार के नाम पर खेती योग्य भूमि दर्ज है?" } },
  { key: "is_institutional_landholder", section: "agriculture", type: "boolean", label: { en: "Is the land held by an institution (trust, company, etc.) rather than your family?", hi: "क्या भूमि किसी संस्था (ट्रस्ट, कंपनी आदि) के नाम पर है?" } },
  // ── Housing & household ──
  { key: "has_pucca_house", section: "housing", type: "boolean", household: true, label: { en: "Does any member of your family own a pucca house anywhere in India?", hi: "क्या आपके परिवार के किसी सदस्य के पास भारत में कहीं पक्का मकान है?" } },
  {
    key: "ration_card", section: "housing", type: "select", household: true,
    label: { en: "Ration card type", hi: "राशन कार्ड का प्रकार" },
    options: [
      opt("none", "No ration card", "राशन कार्ड नहीं"), opt("aay", "Antyodaya (AAY)", "अंत्योदय (AAY)"),
      opt("phh", "Priority household (PHH / BPL)", "प्राथमिकता परिवार (PHH / BPL)"), opt("non_priority", "Non-priority / APL", "गैर-प्राथमिकता / APL"),
    ],
  },
  { key: "is_bpl", section: "housing", type: "boolean", household: true, label: { en: "Is your household on the BPL (below poverty line) list?", hi: "क्या आपका परिवार बीपीएल (गरीबी रेखा से नीचे) सूची में है?" } },
  { key: "household_has_lpg", section: "housing", type: "boolean", household: true, label: { en: "Does anyone in your household already have an LPG connection?", hi: "क्या आपके परिवार में किसी के पास पहले से एलपीजी कनेक्शन है?" } },
  { key: "in_pmjay_list", section: "housing", type: "boolean", household: true, label: { en: "Is your family listed as a PM-JAY (Ayushman Bharat) beneficiary family?", hi: "क्या आपका परिवार पीएम-जय (आयुष्मान भारत) लाभार्थी सूची में है?" }, help: { en: "You can check at beneficiary.nha.gov.in. Answer 'not sure' if you don't know.", hi: "beneficiary.nha.gov.in पर जाँच सकते हैं।" } },
  { key: "household_size", section: "housing", type: "number", household: true, min: 1, max: 30, label: { en: "Number of people in your household", hi: "परिवार में सदस्यों की संख्या" } },
  { key: "is_woman_head_of_family", section: "housing", type: "boolean", label: { en: "Are you recorded as the woman head of the family on the ration card?", hi: "क्या राशन कार्ड पर आप परिवार की महिला मुखिया के रूप में दर्ज हैं?" } },
  // ── Family & maternity ──
  { key: "is_pregnant_or_lactating", section: "family", type: "boolean", sensitive: true, label: { en: "Are you currently pregnant or breastfeeding?", hi: "क्या आप अभी गर्भवती हैं या स्तनपान करा रही हैं?" } },
  { key: "child_order", section: "family", type: "number", min: 1, max: 10, sensitive: true, label: { en: "This pregnancy / newborn is which child (1st, 2nd…)?", hi: "यह गर्भावस्था / नवजात कौन-सी संतान है (पहली, दूसरी…)?" } },
  { key: "expected_child_is_girl", section: "family", type: "boolean", sensitive: true, label: { en: "If this is your second child, is the child a girl? (after birth)", hi: "यदि यह दूसरी संतान है, तो क्या वह बालिका है? (जन्म के बाद)" } },
  { key: "girl_child_accounts_in_family", section: "family", type: "number", min: 0, max: 5, label: { en: "Number of Sukanya Samriddhi accounts already opened in the family", hi: "परिवार में पहले से खुले सुकन्या समृद्धि खातों की संख्या" } },
  { key: "girl_children_in_family", section: "family", type: "number", min: 0, max: 10, household: true, label: { en: "Number of girl children in the family", hi: "परिवार में बालिकाओं की संख्या" } },
  // ── Business & trade ──
  { key: "artisan_trade", section: "business", type: "select", options: VISHWAKARMA_TRADES, label: { en: "Traditional trade you work in", hi: "आपका पारंपरिक व्यवसाय" } },
  { key: "availed_credit_scheme_5y", section: "business", type: "boolean", label: { en: "Have you taken a loan under PMEGP, PM SVANidhi or MUDRA in the last 5 years (not fully repaid)?", hi: "क्या आपने पिछले 5 वर्षों में PMEGP, PM SVANidhi या मुद्रा के तहत ऋण लिया है (पूरा नहीं चुकाया)?" } },
  { key: "family_member_availed_vishwakarma", section: "business", type: "boolean", household: true, label: { en: "Has another member of your family already registered under PM Vishwakarma?", hi: "क्या परिवार का कोई अन्य सदस्य पहले से पीएम विश्वकर्मा में पंजीकृत है?" } },
  { key: "has_vending_certificate", section: "business", type: "boolean", label: { en: "Do you have a vending certificate / ID or a Letter of Recommendation from your urban local body?", hi: "क्या आपके पास वेंडिंग प्रमाणपत्र / पहचान पत्र या नगर निकाय का अनुशंसा पत्र है?" } },
  { key: "plans_greenfield_enterprise", section: "business", type: "boolean", label: { en: "Are you starting a new (first-time) enterprise in manufacturing, services, trading or agri-allied activity?", hi: "क्या आप विनिर्माण, सेवा, व्यापार या कृषि-संबद्ध क्षेत्र में नया (पहला) उद्यम शुरू कर रहे हैं?" } },
  { key: "is_loan_defaulter", section: "business", type: "boolean", label: { en: "Are you a defaulter to any bank or financial institution?", hi: "क्या आप किसी बैंक या वित्तीय संस्था के डिफ़ॉल्टर हैं?" } },
  // ── Existing benefits ──
  {
    key: "existing_benefits", section: "benefits", type: "multiselect",
    label: { en: "Schemes you or your household already benefit from", hi: "योजनाएँ जिनका लाभ आप या आपका परिवार पहले से ले रहा है" },
    options: [
      opt("pm_kisan", "PM-KISAN", "पीएम-किसान"), opt("pmuy", "PM Ujjwala (LPG)", "पीएम उज्ज्वला (एलपीजी)"),
      opt("pmay", "PM Awas Yojana house", "पीएम आवास योजना मकान"), opt("pmjjby", "PM Jeevan Jyoti Bima", "पीएम जीवन ज्योति बीमा"),
      opt("pmsby", "PM Suraksha Bima", "पीएम सुरक्षा बीमा"), opt("apy", "Atal Pension Yojana", "अटल पेंशन योजना"),
      opt("pmjdy", "Jan Dhan account", "जन धन खाता"), opt("ignoaps", "Old-age pension (NSAP)", "वृद्धावस्था पेंशन (NSAP)"),
      opt("pmmvy", "PM Matru Vandana", "पीएम मातृ वंदना"),
    ],
  },
];

export const FIELD_MAP: Record<string, FieldDef> = Object.fromEntries(FIELDS.map((f) => [f.key, f]));

/** Derived facts the engine computes; they are not asked directly. */
export const DERIVED_FACT_LABELS: Record<string, Localized> = {
  age: { en: "Age", hi: "आयु" },
};

export function factLabel(key: string): Localized {
  return FIELD_MAP[key]?.label ?? DERIVED_FACT_LABELS[key] ?? { en: key.replace(/_/g, " ") };
}

export function optionLabel(key: string, value: string): Localized | undefined {
  return FIELD_MAP[key]?.options?.find((o) => o.value === value)?.label;
}

export const DECLINED = "prefer_not_to_say";
export const NOT_SURE = "not_sure";
void YES_NO_NOTE;

// Curated seed catalogue. Prepared from public scheme information; every record ships with
// `lastVerifiedAt = null` and the `seed_unverified` flag until a curator checks it against the
// official guideline in the admin console. Amounts and limits change — the UI always says so.

import type { DocumentRequirement, FactLeaf, Localized, RuleNode } from "@/lib/engine/types";
import { docLabel } from "@/lib/documents/types";
import type { SchemeContent, SchemeSeed } from "./types";

const L = (en: string, hi?: string): Localized => (hi ? { en, hi } : { en });
const f = (id: string, fact: string, op: FactLeaf["op"], value: FactLeaf["value"], en: string, hi: string, extra: Partial<FactLeaf> = {}): FactLeaf => ({
  id, fact, op, ...(value === undefined ? {} : { value }), label: L(en, hi), ...extra,
});
const all = (...xs: RuleNode[]): RuleNode => ({ all: xs });
const any = (...xs: RuleNode[]): RuleNode => ({ any: xs });
const not = (x: RuleNode): RuleNode => ({ not: x });

const citizen = f("citizen", "is_indian_citizen", "is_true", undefined, "Is an Indian citizen", "भारतीय नागरिक है");
const female = f("female", "gender", "eq", "female", "Applicant is a woman / girl", "आवेदक महिला / बालिका है");
const ageMin = (n: number) => f("age_min", "age", "gte", n, `Age is at least ${n} years`, `आयु कम से कम ${n} वर्ष है`);
const ageMax = (n: number) => f("age_max", "age", "lte", n, `Age is at most ${n} years`, `आयु अधिकतम ${n} वर्ष है`);
const incomeMax = (n: number, label?: string) =>
  f("income_max", "annual_family_income", "lte", n, label ?? `Annual family income is at most ₹${n.toLocaleString("en-IN")}`, `वार्षिक पारिवारिक आय अधिकतम ₹${n.toLocaleString("en-IN")} है`, {
    changeHint: L(`This depends on annual family income being ₹${n.toLocaleString("en-IN")} or less, as shown on an income certificate.`, `यह वार्षिक पारिवारिक आय ₹${n.toLocaleString("en-IN")} या उससे कम होने पर निर्भर है (आय प्रमाणपत्र के अनुसार)।`),
  });
const bank = f("bank", "has_bank_account", "is_true", undefined, "Has a savings bank or post office account", "बचत बैंक या डाकघर खाता है", {
  changeHint: L("Open a savings account (for example a Jan Dhan account) first.", "पहले एक बचत खाता खोलें (उदाहरण: जन धन खाता)।"),
});
const student = f("student", "is_student", "is_true", undefined, "Is currently a student", "वर्तमान में विद्यार्थी है");
const noIncomeTax = not(f("income_tax", "pays_income_tax", "is_true", undefined, "Pays income tax", "आयकर दाता है"));
const notGovtEmployee = not(f("govt_employee", "is_govt_employee", "is_true", undefined, "Is a government employee", "सरकारी कर्मचारी है"));

const doc = (type: string, required = true, alternatives?: string[], extra: Partial<DocumentRequirement> = {}): DocumentRequirement => ({
  type, label: docLabel(type), required, ...(alternatives ? { alternatives } : {}), ...extra,
});

const CPGRAMS = L(
  "Use the helpline or grievance link on the official portal. You can also file a grievance on CPGRAMS (pgportal.gov.in).",
  "आधिकारिक पोर्टल की हेल्पलाइन या शिकायत लिंक का उपयोग करें। आप CPGRAMS (pgportal.gov.in) पर भी शिकायत दर्ज कर सकते हैं।",
);
const FREE = L("No fee to apply.", "आवेदन निःशुल्क है।");

const base: Pick<SchemeContent, "aliases" | "stateScope" | "isThirdParty" | "lifecycleStatus" | "level" | "kind" | "curator" | "dataConfidence" | "coverageFlags" | "publicationDate" | "reviewBy"> = {
  aliases: [],
  stateScope: [],
  isThirdParty: false,
  lifecycleStatus: "open",
  level: "central",
  kind: "scheme",
  curator: "SevaSutra seed catalogue",
  dataConfidence: "medium",
  coverageFlags: ["seed_unverified"],
  publicationDate: null,
  reviewBy: "2027-03-31",
};

function scheme(c: Omit<SchemeContent, keyof typeof base> & Partial<typeof base>): SchemeContent {
  return { ...base, ...c } as SchemeContent;
}

// ─────────────────────────── Schemes ───────────────────────────

export const SCHEMES: SchemeSeed[] = [
  {
    content: scheme({
      schemeId: "pm-kisan", beneficiaryUnit: "household",
      name: L("PM Kisan Samman Nidhi (PM-KISAN)", "प्रधानमंत्री किसान सम्मान निधि (पीएम-किसान)"),
      aliases: ["PM Kisan", "Kisan Samman Nidhi"],
      ministry: "Ministry of Agriculture & Farmers Welfare",
      category: "agriculture",
      targetGroups: ["farmers"],
      highImpact: true,
      summary: L(
        "Income support of ₹6,000 a year, paid in three instalments of ₹2,000 directly to the bank accounts of landholding farmer families.",
        "भूमिधारक किसान परिवारों को ₹6,000 प्रति वर्ष की आय सहायता, ₹2,000 की तीन किस्तों में सीधे बैंक खाते में।",
      ),
      officialDescription: L("Central sector scheme providing income support to all landholding farmer families, subject to exclusion criteria (institutional landholders, constitutional post holders, serving/retired government employees other than MTS/Class IV/Group D, income tax payers, registered professionals, and pensioners drawing ₹10,000 or more per month)."),
      benefit: {
        kind: "cash", amountMin: 6000, amountMax: 6000, frequency: "annual", stated: true, countsAsMoney: true,
        basis: L("Annual amount stated in the scheme guideline (3 instalments of ₹2,000).", "योजना दिशानिर्देश में बताई गई वार्षिक राशि (₹2,000 की 3 किस्तें)।"),
      },
      rule: {
        schemaVersion: 1,
        mandatory: all(
          citizen,
          f("land", "owns_cultivable_land", "is_true", undefined, "Family owns cultivable land recorded in its name", "परिवार के नाम पर खेती योग्य भूमि दर्ज है", {
            changeHint: L("PM-KISAN is only for families with cultivable land recorded in their name.", "पीएम-किसान केवल उन परिवारों के लिए है जिनके नाम पर खेती योग्य भूमि दर्ज है।"),
          }),
          not(f("institutional", "is_institutional_landholder", "is_true", undefined, "Land is held by an institution", "भूमि किसी संस्था के नाम पर है")),
          not(f("constitutional", "holds_constitutional_post", "is_true", undefined, "Family member holds/held a constitutional post or is/was an MP, MLA, minister or mayor", "परिवार का सदस्य संवैधानिक पद पर है/था या सांसद/विधायक/मंत्री/महापौर है/था")),
          not(f("govt_employee", "is_govt_employee", "is_true", undefined, "Is a serving or retired government employee", "सेवारत या सेवानिवृत्त सरकारी कर्मचारी है")),
          not(f("income_tax", "pays_income_tax", "is_true", undefined, "Paid income tax in the last assessment year", "पिछले कर-निर्धारण वर्ष में आयकर दिया")),
          not(f("professional", "is_registered_professional", "is_true", undefined, "Is a registered practising professional", "पंजीकृत पेशेवर है")),
          not(f("pension", "monthly_pension", "gte", 10000, "Receives a monthly pension of ₹10,000 or more", "₹10,000 या अधिक मासिक पेंशन मिलती है")),
        ),
        caveats: [
          L("Multi Tasking Staff / Class IV / Group D government employees are not excluded — if that applies to you, confirm with your agriculture office.", "मल्टी टास्किंग स्टाफ / क्लास IV / ग्रुप D कर्मचारी अपवर्जित नहीं हैं — यदि यह आप पर लागू है तो कृषि कार्यालय से पुष्टि करें।"),
          L("e-KYC and land-record seeding are mandatory for instalments to be released.", "किस्त जारी होने के लिए ई-केवाईसी और भूमि अभिलेख सीडिंग अनिवार्य है।"),
        ],
      },
      documents: [doc("aadhaar"), doc("land_record"), doc("bank_passbook")],
      application: {
        mode: "official_portal", url: "https://pmkisan.gov.in",
        steps: [
          L("Open the PM-KISAN portal and choose 'New Farmer Registration'.", "पीएम-किसान पोर्टल खोलें और 'नया किसान पंजीकरण' चुनें।"),
          L("Enter your details as on Aadhaar and your land record.", "आधार और भूमि अभिलेख के अनुसार विवरण भरें।"),
          L("Complete e-KYC (OTP, biometric at CSC, or face authentication).", "ई-केवाईसी पूरा करें (OTP, CSC पर बायोमेट्रिक, या फ़ेस ऑथेंटिकेशन)।"),
          L("State/district officials verify the land record before payment.", "भुगतान से पहले राज्य/ज़िला अधिकारी भूमि अभिलेख सत्यापित करते हैं।"),
        ],
        fee: FREE, deadline: null,
        deadlineNote: L("Registration is open throughout the year.", "पंजीकरण पूरे वर्ष खुला रहता है।"),
        grievance: CPGRAMS,
        statusTracking: L("Use 'Know Your Status' on the PM-KISAN portal with your registration number.", "पीएम-किसान पोर्टल पर 'अपनी स्थिति जानें' में पंजीकरण संख्या डालें।"),
      },
      sources: [{ sourceId: "pmkisan", section: "Eligibility / Exclusion criteria" }, { sourceId: "myscheme" }],
      effectiveFrom: "2019-02-01",
    }),
    tests: [
      { name: "Small farmer, no exclusions", kind: "eligible", expected: "eligible", facts: { is_indian_citizen: true, owns_cultivable_land: true, is_institutional_landholder: false, holds_constitutional_post: false, is_govt_employee: false, pays_income_tax: false, is_registered_professional: false, monthly_pension: 0 } },
      { name: "Income tax payer is excluded", kind: "ineligible", expected: "not_eligible", facts: { is_indian_citizen: true, owns_cultivable_land: true, is_institutional_landholder: false, holds_constitutional_post: false, is_govt_employee: false, pays_income_tax: true, is_registered_professional: false, monthly_pension: 0 } },
    ],
  },

  {
    content: scheme({
      schemeId: "pmjdy",
      name: L("Pradhan Mantri Jan Dhan Yojana (PMJDY)", "प्रधानमंत्री जन धन योजना"),
      aliases: ["Jan Dhan", "Jan Dhan account"],
      ministry: "Ministry of Finance", department: "Department of Financial Services",
      category: "banking", targetGroups: ["unbanked"],
      summary: L("A basic savings bank account with zero minimum balance, a RuPay debit card with accident insurance cover, and access to an overdraft facility.", "शून्य न्यूनतम शेष वाला बुनियादी बचत खाता, दुर्घटना बीमा सहित रुपे डेबिट कार्ड और ओवरड्राफ्ट सुविधा।"),
      officialDescription: L("National Mission for Financial Inclusion: a Basic Savings Bank Deposit (BSBD) account for any individual aged 10 years or above who does not have a bank account."),
      benefit: {
        kind: "non_cash", stated: true, countsAsMoney: false,
        basis: L("Non-cash service: zero-balance account; RuPay card accident cover (₹2 lakh for accounts opened after 28 Aug 2018); overdraft up to ₹10,000 subject to bank conditions. No monetary estimate.", "गैर-नकद सेवा: शून्य-शेष खाता; रुपे कार्ड दुर्घटना बीमा; बैंक शर्तों के अधीन ₹10,000 तक ओवरड्राफ्ट। कोई मौद्रिक अनुमान नहीं।"),
      },
      rule: {
        schemaVersion: 1,
        mandatory: all(
          ageMin(10),
          f("no_account", "has_bank_account", "is_false", undefined, "Does not already have a savings bank account", "पहले से बचत बैंक खाता नहीं है", {
            changeHint: L("PMJDY is for people without a bank account. If you already have one, you can still use its services.", "पीएमजेडीवाई बिना बैंक खाते वालों के लिए है।"),
          }),
        ),
        caveats: [L("Minors aged 10+ open the account with a guardian.", "10+ आयु के नाबालिग अभिभावक के साथ खाता खोलते हैं।")],
      },
      documents: [doc("aadhaar", true, ["identity_proof"]), doc("photo", false)],
      application: {
        mode: "department_office", url: "https://pmjdy.gov.in",
        steps: [L("Visit any bank branch or Business Correspondent (Bank Mitra) outlet.", "किसी भी बैंक शाखा या बैंक मित्र केंद्र पर जाएँ।"), L("Fill the account opening form and give an officially valid document for KYC.", "खाता खोलने का फ़ॉर्म भरें और केवाईसी हेतु मान्य दस्तावेज़ दें।")],
        fee: FREE, deadline: null, grievance: CPGRAMS,
        statusTracking: L("Ask your bank branch for your account details and RuPay card.", "अपनी बैंक शाखा से खाता विवरण और रुपे कार्ड प्राप्त करें।"),
      },
      sources: [{ sourceId: "pmjdy" }],
      effectiveFrom: "2014-08-28",
    }),
    tests: [
      { name: "Adult without bank account", kind: "eligible", expected: "eligible", facts: { date_of_birth: "1990-05-01", has_bank_account: false } },
      { name: "Already has account", kind: "ineligible", expected: "not_eligible", facts: { date_of_birth: "1990-05-01", has_bank_account: true } },
    ],
  },

  {
    content: scheme({
      schemeId: "apy",
      name: L("Atal Pension Yojana (APY)", "अटल पेंशन योजना"),
      ministry: "Ministry of Finance", department: "PFRDA / Department of Financial Services",
      category: "pension", targetGroups: ["unorganised_workers"],
      summary: L("A contributory pension scheme: pay a small monthly amount until 60 and get a guaranteed pension of ₹1,000–₹5,000 a month after that.", "अंशदायी पेंशन योजना: 60 वर्ष तक छोटी मासिक राशि जमा करें और उसके बाद ₹1,000–₹5,000 मासिक गारंटीड पेंशन पाएँ।"),
      officialDescription: L("Open to Indian citizens aged 18–40 with a savings bank account. From 1 October 2022, persons who are or have been income tax payers are not eligible to join."),
      benefit: {
        kind: "pension", amountMin: 1000, amountMax: 5000, frequency: "monthly", stated: true, countsAsMoney: false,
        basis: L("Guaranteed monthly pension after age 60 chosen by the subscriber (₹1,000–₹5,000), in return for monthly contributions. Not counted as current income.", "60 वर्ष के बाद चुनी गई गारंटीड मासिक पेंशन (₹1,000–₹5,000), मासिक अंशदान के बदले। वर्तमान आय के रूप में नहीं गिना गया।"),
      },
      rule: { schemaVersion: 1, mandatory: all(citizen, ageMin(18), ageMax(40), bank, noIncomeTax) },
      documents: [doc("bank_passbook"), doc("aadhaar", false)],
      application: {
        mode: "department_office", url: "https://www.jansuraksha.gov.in",
        steps: [L("Visit the bank or post office where you hold your savings account, or use your bank's net banking.", "अपनी बैंक/डाकघर शाखा जाएँ या नेट बैंकिंग का उपयोग करें।"), L("Choose a pension amount and allow auto-debit of contributions.", "पेंशन राशि चुनें और अंशदान का ऑटो-डेबिट स्वीकृत करें।")],
        fee: L("No application fee; monthly contributions depend on age and pension chosen.", "आवेदन शुल्क नहीं; मासिक अंशदान आयु और चुनी गई पेंशन पर निर्भर।"),
        deadline: null, grievance: CPGRAMS,
        statusTracking: L("Check your PRAN statement through your bank or the NSDL CRA APY portal.", "बैंक या NSDL CRA APY पोर्टल से PRAN विवरण देखें।"),
      },
      sources: [{ sourceId: "jansuraksha" }, { sourceId: "pfrda_apy" }],
      effectiveFrom: "2022-10-01",
    }),
    tests: [
      { name: "30-year-old with account, not a taxpayer", kind: "eligible", expected: "eligible", facts: { is_indian_citizen: true, date_of_birth: "1996-01-15", has_bank_account: true, pays_income_tax: false } },
      { name: "Income tax payer", kind: "ineligible", expected: "not_eligible", facts: { is_indian_citizen: true, date_of_birth: "1996-01-15", has_bank_account: true, pays_income_tax: true } },
    ],
  },

  {
    content: scheme({
      schemeId: "pmjjby",
      name: L("Pradhan Mantri Jeevan Jyoti Bima Yojana (PMJJBY)", "प्रधानमंत्री जीवन ज्योति बीमा योजना"),
      ministry: "Ministry of Finance", department: "Department of Financial Services",
      category: "insurance", targetGroups: ["bank_account_holders"],
      summary: L("One-year renewable life insurance of ₹2 lakh for a premium of ₹436 a year, auto-debited from your bank account.", "₹436 वार्षिक प्रीमियम पर ₹2 लाख का एक वर्षीय नवीकरणीय जीवन बीमा, बैंक खाते से ऑटो-डेबिट।"),
      officialDescription: L("Life cover of ₹2 lakh for death due to any cause, for savings account holders aged 18–50 who give consent for auto-debit."),
      benefit: { kind: "insurance", amountMin: 200000, amountMax: 200000, frequency: "per_event", stated: true, countsAsMoney: false, basis: L("Life insurance cover amount stated in the scheme (paid to the nominee). Not counted as money you receive.", "योजना में बताई गई जीवन बीमा राशि (नामांकित व्यक्ति को देय)। आपको मिलने वाली राशि के रूप में नहीं गिनी गई।") },
      rule: { schemaVersion: 1, mandatory: all(ageMin(18), ageMax(50), bank), caveats: [L("Premium ₹436 per year, auto-debited; cover runs 1 June to 31 May.", "प्रीमियम ₹436 प्रति वर्ष; कवर 1 जून से 31 मई तक।")] },
      documents: [doc("bank_passbook"), doc("aadhaar", false)],
      application: {
        mode: "department_office", url: "https://www.jansuraksha.gov.in",
        steps: [L("Enrol through your bank branch, net banking or the Jan Suraksha portal.", "अपनी बैंक शाखा, नेट बैंकिंग या जन सुरक्षा पोर्टल से नामांकन करें।")],
        fee: L("Annual premium ₹436.", "वार्षिक प्रीमियम ₹436।"), deadline: null,
        renewal: L("Renews every year on 1 June via auto-debit.", "हर वर्ष 1 जून को ऑटो-डेबिट से नवीनीकरण।"), renewalMonths: 12,
        grievance: CPGRAMS, statusTracking: L("Your bank provides the acknowledgement-cum-certificate of insurance.", "बैंक बीमा प्रमाणपत्र देता है।"),
      },
      sources: [{ sourceId: "jansuraksha" }],
      effectiveFrom: "2022-06-01",
    }),
    tests: [
      { name: "35-year-old account holder", kind: "eligible", expected: "eligible", facts: { date_of_birth: "1991-03-10", has_bank_account: true } },
      { name: "No bank account", kind: "ineligible", expected: "not_eligible", facts: { date_of_birth: "1991-03-10", has_bank_account: false } },
    ],
  },

  {
    content: scheme({
      schemeId: "pmsby",
      name: L("Pradhan Mantri Suraksha Bima Yojana (PMSBY)", "प्रधानमंत्री सुरक्षा बीमा योजना"),
      ministry: "Ministry of Finance", department: "Department of Financial Services",
      category: "insurance", targetGroups: ["bank_account_holders"],
      summary: L("Accident insurance of up to ₹2 lakh for a premium of ₹20 a year.", "₹20 वार्षिक प्रीमियम पर ₹2 लाख तक का दुर्घटना बीमा।"),
      officialDescription: L("Accidental death and disability cover for savings account holders aged 18–70: ₹2 lakh for death or total disability, ₹1 lakh for partial disability."),
      benefit: { kind: "insurance", amountMin: 100000, amountMax: 200000, frequency: "per_event", stated: true, countsAsMoney: false, basis: L("Accident cover stated in the scheme: ₹2 lakh (death / total disability), ₹1 lakh (partial disability). Not counted as money you receive.", "योजना में बताया गया दुर्घटना कवर। आपको मिलने वाली राशि के रूप में नहीं गिना गया।") },
      rule: { schemaVersion: 1, mandatory: all(ageMin(18), ageMax(70), bank) },
      documents: [doc("bank_passbook"), doc("aadhaar", false)],
      application: {
        mode: "department_office", url: "https://www.jansuraksha.gov.in",
        steps: [L("Enrol through your bank branch, net banking or the Jan Suraksha portal.", "अपनी बैंक शाखा, नेट बैंकिंग या जन सुरक्षा पोर्टल से नामांकन करें।")],
        fee: L("Annual premium ₹20.", "वार्षिक प्रीमियम ₹20।"), deadline: null,
        renewal: L("Renews every year on 1 June via auto-debit.", "हर वर्ष 1 जून को नवीनीकरण।"), renewalMonths: 12,
        grievance: CPGRAMS, statusTracking: L("Ask your bank for the enrolment acknowledgement.", "बैंक से नामांकन पावती लें।"),
      },
      sources: [{ sourceId: "jansuraksha" }],
      effectiveFrom: "2022-06-01",
    }),
    tests: [
      { name: "65-year-old account holder", kind: "eligible", expected: "eligible", facts: { date_of_birth: "1961-02-01", has_bank_account: true } },
      { name: "Age 75", kind: "ineligible", expected: "not_eligible", facts: { date_of_birth: "1950-02-01", has_bank_account: true } },
    ],
  },

  {
    content: scheme({
      schemeId: "ab-pmjay", beneficiaryUnit: "household",
      name: L("Ayushman Bharat – Pradhan Mantri Jan Arogya Yojana (AB PM-JAY)", "आयुष्मान भारत – प्रधानमंत्री जन आरोग्य योजना"),
      aliases: ["Ayushman card", "PMJAY", "Ayushman Vay Vandana"],
      ministry: "Ministry of Health & Family Welfare", department: "National Health Authority",
      category: "health", targetGroups: ["poor_households", "senior_citizens"], highImpact: true,
      summary: L("Free hospital treatment cover of up to ₹5 lakh per family per year at empanelled hospitals. All citizens aged 70 and above are covered regardless of income.", "सूचीबद्ध अस्पतालों में प्रति परिवार प्रति वर्ष ₹5 लाख तक का मुफ़्त इलाज। 70 वर्ष और उससे अधिक आयु के सभी नागरिक आय से परे शामिल।"),
      officialDescription: L("Entitlement-based scheme covering families identified from SECC 2011 deprivation criteria and subsequent expansions (including NFSA/AAY in many states), and since October 2024 all senior citizens aged 70+ (Ayushman Vay Vandana)."),
      benefit: { kind: "insurance", amountMax: 500000, frequency: "annual", stated: true, countsAsMoney: false, basis: L("Health cover of up to ₹5 lakh per family per year for hospitalisation, as stated in the scheme. Not counted as money you receive.", "प्रति परिवार प्रति वर्ष ₹5 लाख तक का स्वास्थ्य कवर। आपको मिलने वाली राशि के रूप में नहीं गिना गया।") },
      rule: {
        schemaVersion: 1,
        mandatory: all(
          citizen,
          any(
            f("senior70", "age", "gte", 70, "Is aged 70 or above (covered regardless of income)", "70 वर्ष या अधिक आयु (आय से परे शामिल)"),
            f("listed", "in_pmjay_list", "is_true", undefined, "Family is in the PM-JAY beneficiary list", "परिवार पीएम-जय लाभार्थी सूची में है", {
              changeHint: L("Check your family's name at beneficiary.nha.gov.in or at an empanelled hospital's Arogya Mitra desk.", "beneficiary.nha.gov.in पर या अस्पताल के आरोग्य मित्र से परिवार का नाम जाँचें।"),
            }),
          ),
        ),
        caveats: [L("Entitlement is decided by the beneficiary list, not by income alone. Many states extend coverage under their own health schemes.", "पात्रता लाभार्थी सूची से तय होती है, केवल आय से नहीं। कई राज्य अपनी योजनाओं के तहत कवरेज बढ़ाते हैं।")],
      },
      documents: [doc("aadhaar"), doc("ration_card", false)],
      application: {
        mode: "official_portal", url: "https://beneficiary.nha.gov.in",
        steps: [L("Check your entitlement on the beneficiary portal or the Ayushman app.", "लाभार्थी पोर्टल या आयुष्मान ऐप पर पात्रता जाँचें।"), L("Complete Aadhaar e-KYC to generate your Ayushman card.", "आयुष्मान कार्ड बनाने के लिए आधार ई-केवाईसी पूरा करें।"), L("Show the card at any empanelled hospital.", "किसी भी सूचीबद्ध अस्पताल में कार्ड दिखाएँ।")],
        fee: FREE, deadline: null, grievance: L("Call the national helpline 14555 or use the grievance section of pmjay.gov.in.", "राष्ट्रीय हेल्पलाइन 14555 पर कॉल करें या pmjay.gov.in पर शिकायत दर्ज करें।"),
        statusTracking: L("Card status is shown on the beneficiary portal.", "कार्ड की स्थिति लाभार्थी पोर्टल पर दिखती है।"),
      },
      sources: [{ sourceId: "pmjay" }, { sourceId: "nha_beneficiary" }],
      effectiveFrom: "2024-10-29",
    }),
    tests: [
      { name: "Senior citizen aged 72", kind: "eligible", expected: "eligible", facts: { is_indian_citizen: true, date_of_birth: "1954-01-01", in_pmjay_list: false } },
      { name: "Not listed, under 70", kind: "ineligible", expected: "not_eligible", facts: { is_indian_citizen: true, date_of_birth: "1980-01-01", in_pmjay_list: false } },
    ],
  },

  {
    content: scheme({
      schemeId: "pmuy", beneficiaryUnit: "household",
      name: L("Pradhan Mantri Ujjwala Yojana (PMUY)", "प्रधानमंत्री उज्ज्वला योजना"),
      aliases: ["Ujjwala", "free LPG connection"],
      ministry: "Ministry of Petroleum & Natural Gas", category: "energy", targetGroups: ["women", "poor_households"],
      summary: L("A deposit-free LPG connection for adult women from poor households, with a targeted subsidy on refills.", "गरीब परिवारों की वयस्क महिलाओं को बिना जमा राशि के एलपीजी कनेक्शन और रिफ़िल पर लक्षित सब्सिडी।"),
      officialDescription: L("Adult woman of a poor household with no LPG connection in the household, belonging to one of the listed categories (SC/ST, PMAY-G, AAY, forest dwellers, most backward classes, tea/ex-tea garden tribes, island dwellers, etc.) or a poor household per the 14-point declaration."),
      benefit: {
        kind: "subsidy", amountMax: 300, frequency: "per_event", periodsPerYear: 9, stated: false, countsAsMoney: true,
        basis: L("Targeted subsidy per 14.2 kg refill, subject to an annual cap on refills and to the government's yearly decision. Connection itself is non-cash.", "प्रति 14.2 किग्रा रिफ़िल लक्षित सब्सिडी, वार्षिक रिफ़िल सीमा और सरकार के वार्षिक निर्णय के अधीन।"),
      },
      rule: {
        schemaVersion: 1,
        mandatory: all(
          female, ageMin(18),
          f("no_lpg", "household_has_lpg", "is_false", undefined, "No LPG connection already in the household", "परिवार में पहले से एलपीजी कनेक्शन नहीं है"),
          any(
            f("bpl", "is_bpl", "is_true", undefined, "Household is on the BPL list", "परिवार बीपीएल सूची में है"),
            f("ration", "ration_card", "in", ["aay", "phh"], "Holds an Antyodaya or priority-household ration card", "अंत्योदय या प्राथमिकता परिवार राशन कार्ड है"),
            f("scst", "social_category", "in", ["sc", "st"], "Belongs to SC/ST", "अनुसूचित जाति/जनजाति से है"),
            f("pmayg", "existing_benefits", "contains", "pmay", "Household is a PM Awas Yojana beneficiary", "परिवार पीएम आवास योजना लाभार्थी है"),
          ),
        ),
        exceptions: [
          {
            id: "fourteen_point", priority: 1, effect: "needs_manual_review",
            when: all(
              f("x_female", "gender", "eq", "female", "Woman", "महिला"), f("x_age", "age", "gte", 18, "Adult", "वयस्क"),
              f("x_nolpg", "household_has_lpg", "is_false", undefined, "No LPG", "एलपीजी नहीं"),
              f("x_notbpl", "is_bpl", "is_false", undefined, "Not BPL", "बीपीएल नहीं"),
              f("x_ration", "ration_card", "in", ["none", "non_priority"], "No priority ration card", "प्राथमिकता राशन कार्ड नहीं"),
              f("x_notscst", "social_category", "not_in", ["sc", "st"], "Not SC/ST", "SC/ST नहीं"),
              f("x_nopmay", "existing_benefits", "not_contains", "pmay", "Not a PMAY beneficiary", "PMAY लाभार्थी नहीं"),
            ),
            explanation: L("You are not in a listed category, but poor households can still apply with the 14-point declaration. The LPG distributor decides.", "आप सूचीबद्ध श्रेणी में नहीं हैं, पर गरीब परिवार 14-बिंदु घोषणा के साथ आवेदन कर सकते हैं। निर्णय एलपीजी वितरक करता है।"),
          },
        ],
      },
      documents: [doc("aadhaar"), doc("ration_card", true, ["identity_proof"]), doc("bank_passbook"), doc("caste_certificate", false, undefined, { onlyIf: f("d_scst", "social_category", "in", ["sc", "st"], "SC/ST", "SC/ST") })],
      application: {
        mode: "official_portal", url: "https://www.pmuy.gov.in",
        steps: [L("Apply online on the PMUY portal choosing a distributor, or visit the nearest LPG distributor.", "पीएमयूवाई पोर्टल पर वितरक चुनकर ऑनलाइन आवेदन करें या नज़दीकी एलपीजी वितरक के पास जाएँ।"), L("Submit KYC and the household declaration.", "केवाईसी और परिवार घोषणा जमा करें।")],
        fee: FREE, deadline: null, grievance: L("LPG emergency/helpline 1906 (emergency) and 1800-2333-555 (toll-free), or CPGRAMS.", "एलपीजी हेल्पलाइन 1800-2333-555 या CPGRAMS।"),
        statusTracking: L("Your distributor confirms the connection; track via the oil company's app.", "वितरक कनेक्शन की पुष्टि करता है; तेल कंपनी के ऐप से ट्रैक करें।"),
      },
      sources: [{ sourceId: "pmuy" }],
      effectiveFrom: "2021-08-10",
    }),
    tests: [
      { name: "Woman, AAY card, no LPG", kind: "eligible", expected: "eligible", facts: { gender: "female", date_of_birth: "1988-07-01", household_has_lpg: false, is_bpl: false, ration_card: "aay", social_category: "general", existing_benefits: [] } },
      { name: "Household already has LPG", kind: "ineligible", expected: "not_eligible", facts: { gender: "female", date_of_birth: "1988-07-01", household_has_lpg: true, is_bpl: true, ration_card: "aay" } },
      { name: "Not in a listed category → 14-point declaration review", kind: "other", expected: "needs_manual_review", facts: { gender: "female", date_of_birth: "1988-07-01", household_has_lpg: false, is_bpl: false, ration_card: "non_priority", social_category: "general", existing_benefits: [] } },
    ],
  },

  {
    content: scheme({
      schemeId: "pmay-u-2", beneficiaryUnit: "household",
      name: L("Pradhan Mantri Awas Yojana – Urban 2.0", "प्रधानमंत्री आवास योजना – शहरी 2.0"),
      aliases: ["PMAY Urban", "PMAY-U 2.0"],
      ministry: "Ministry of Housing & Urban Affairs", category: "housing", targetGroups: ["ews", "lig", "mig", "urban_poor"], highImpact: true,
      summary: L("Help for urban families without a pucca house to build, buy or rent a home — central assistance per house for EWS families and interest subsidy on home loans for EWS/LIG/MIG.", "पक्के मकान के बिना शहरी परिवारों को घर बनाने, ख़रीदने या किराये पर लेने में सहायता।"),
      officialDescription: L("EWS (income up to ₹3 lakh), LIG (₹3–6 lakh) and MIG (₹6–9 lakh) families who do not own a pucca house anywhere in India, through Beneficiary-Led Construction, Affordable Housing in Partnership, Affordable Rental Housing and the Interest Subsidy Scheme."),
      benefit: {
        kind: "subsidy", amountMax: 250000, frequency: "one_time", stated: false, countsAsMoney: true,
        basis: L("Assistance of up to ₹2.5 lakh per housing unit under BLC/AHP (central + state share) for EWS; LIG/MIG may instead get a home-loan interest subsidy (up to about ₹1.8 lakh). Actual amount depends on the vertical and the state.", "BLC/AHP के तहत EWS हेतु प्रति इकाई ₹2.5 लाख तक की सहायता; LIG/MIG को गृह ऋण ब्याज सब्सिडी। वास्तविक राशि घटक और राज्य पर निर्भर।"),
        tiers: [
          { id: "ews", when: f("t_ews", "annual_family_income", "lte", 300000, "EWS", "EWS"), amount: 250000, label: L("EWS — BLC/AHP assistance ceiling", "EWS — BLC/AHP सहायता सीमा") },
          { id: "lig_mig", when: f("t_lig", "annual_family_income", "lte", 900000, "LIG/MIG", "LIG/MIG"), amount: 180000, label: L("LIG/MIG — approximate interest subsidy ceiling", "LIG/MIG — अनुमानित ब्याज सब्सिडी सीमा") },
        ],
      },
      rule: {
        schemaVersion: 1,
        mandatory: all(
          citizen,
          f("urban", "residence_area", "eq", "urban", "Lives in an urban area", "शहरी क्षेत्र में रहते हैं"),
          f("no_pucca", "has_pucca_house", "is_false", undefined, "No family member owns a pucca house anywhere in India", "परिवार के किसी सदस्य के पास भारत में कहीं पक्का मकान नहीं है"),
          incomeMax(900000),
          not(f("prior_pmay", "existing_benefits", "contains", "pmay", "Already received a house under a government housing scheme", "सरकारी आवास योजना के तहत पहले से मकान मिला है")),
        ),
        caveats: [L("House is preferably registered in the name of the woman of the household or jointly.", "मकान प्राथमिकता से परिवार की महिला के नाम या संयुक्त नाम पर पंजीकृत होता है।")],
      },
      documents: [doc("aadhaar"), doc("income_certificate"), doc("bank_passbook"), doc("identity_proof", false)],
      application: {
        mode: "official_portal", url: "https://pmay-urban.gov.in",
        steps: [L("Apply on the PMAY-U 2.0 portal ('Apply for PMAY-U 2.0') or through your urban local body.", "पीएमएवाई-यू 2.0 पोर्टल या नगर निकाय के माध्यम से आवेदन करें।"), L("Complete Aadhaar verification and select the vertical.", "आधार सत्यापन करें और घटक चुनें।")],
        fee: FREE, deadline: null, grievance: CPGRAMS,
        statusTracking: L("Track using your application reference on the PMAY-U portal.", "पीएमएवाई-यू पोर्टल पर आवेदन संदर्भ से ट्रैक करें।"),
      },
      sources: [{ sourceId: "pmayu", section: "PMAY-U 2.0 operational guidelines" }],
      effectiveFrom: "2024-09-01",
    }),
    tests: [
      { name: "Urban EWS family without pucca house", kind: "eligible", expected: "eligible", facts: { is_indian_citizen: true, residence_area: "urban", has_pucca_house: false, annual_family_income: 250000, existing_benefits: [] } },
      { name: "Owns pucca house", kind: "ineligible", expected: "not_eligible", facts: { is_indian_citizen: true, residence_area: "urban", has_pucca_house: true, annual_family_income: 250000, existing_benefits: [] } },
    ],
  },

  {
    content: scheme({
      schemeId: "pmay-u-clss", beneficiaryUnit: "household",
      name: L("PMAY-Urban (1.0) Credit Linked Subsidy Scheme", "पीएमएवाई-शहरी (1.0) क्रेडिट लिंक्ड सब्सिडी योजना"),
      aliases: ["CLSS"],
      ministry: "Ministry of Housing & Urban Affairs", category: "housing", targetGroups: ["ews", "lig", "mig"],
      lifecycleStatus: "closed",
      summary: L("Interest subsidy on home loans under PMAY-U 1.0. This component has closed — see PMAY-U 2.0 instead.", "पीएमएवाई-यू 1.0 के तहत गृह ऋण ब्याज सब्सिडी। यह घटक बंद हो चुका है — पीएमएवाई-यू 2.0 देखें।"),
      officialDescription: L("CLSS for MIG closed on 31 March 2021 and for EWS/LIG on 31 March 2022."),
      benefit: { kind: "subsidy", amountMax: 267280, frequency: "one_time", stated: false, countsAsMoney: true, basis: L("Historical maximum interest subsidy under CLSS (closed).", "CLSS के तहत ऐतिहासिक अधिकतम ब्याज सब्सिडी (बंद)।") },
      rule: { schemaVersion: 1, mandatory: all(f("urban", "residence_area", "eq", "urban", "Lives in an urban area", "शहरी क्षेत्र"), f("no_pucca", "has_pucca_house", "is_false", undefined, "No pucca house", "पक्का मकान नहीं"), incomeMax(1800000)) },
      documents: [doc("income_certificate")],
      application: { mode: "unavailable", url: "https://pmay-urban.gov.in", steps: [L("New applications are not accepted. Check PMAY-U 2.0.", "नए आवेदन स्वीकार नहीं। पीएमएवाई-यू 2.0 देखें।")], fee: FREE, deadline: "2022-03-31", grievance: CPGRAMS, statusTracking: L("Existing beneficiaries can track subsidy status through their lending institution.", "मौजूदा लाभार्थी ऋणदाता संस्था से स्थिति देखें।") },
      sources: [{ sourceId: "pmayu" }],
      effectiveFrom: "2017-01-01",
      dataConfidence: "high",
    }),
    tests: [
      { name: "Would have qualified, but scheme closed", kind: "eligible", expected: "expired_or_closed", facts: { residence_area: "urban", has_pucca_house: false, annual_family_income: 500000 } },
      { name: "Closed regardless of profile", kind: "ineligible", expected: "expired_or_closed", facts: { residence_area: "urban", has_pucca_house: true, annual_family_income: 500000 } },
    ],
  },

  {
    content: scheme({
      schemeId: "ssy",
      name: L("Sukanya Samriddhi Yojana (SSY)", "सुकन्या समृद्धि योजना"),
      ministry: "Ministry of Finance", department: "Department of Economic Affairs / Department of Posts",
      category: "women_child", targetGroups: ["girl_child"],
      summary: L("A high-interest small-savings account opened by a parent or guardian for a girl child below 10 years.", "10 वर्ष से कम आयु की बालिका के लिए माता-पिता या अभिभावक द्वारा खोला गया उच्च ब्याज वाला लघु बचत खाता।"),
      officialDescription: L("Account in the name of a girl child below 10 years, opened by her guardian; at most two accounts per family (exceptions for twins/triplets). Deposits ₹250 to ₹1.5 lakh per financial year."),
      benefit: { kind: "savings", stated: false, countsAsMoney: false, basis: L("Savings product: interest at the government-notified rate (revised quarterly) with tax benefits. No monetary estimate of benefit.", "बचत उत्पाद: सरकार द्वारा अधिसूचित ब्याज दर (तिमाही संशोधित)। कोई मौद्रिक अनुमान नहीं।") },
      rule: {
        schemaVersion: 1,
        mandatory: all(
          female,
          f("age_lt10", "age", "lt", 10, "Girl is below 10 years of age", "बालिका की आयु 10 वर्ष से कम है"),
          f("max2", "girl_child_accounts_in_family", "lt", 2, "Family has fewer than two SSY accounts", "परिवार में दो से कम सुकन्या खाते हैं"),
        ),
        caveats: [L("A third account is allowed for twins/triplets born in the second birth.", "दूसरे प्रसव में जुड़वाँ/तीन बच्चों के मामले में तीसरा खाता अनुमत है।"), L("Evaluate this scheme on the girl child's household-member profile.", "यह योजना बालिका की परिवार-सदस्य प्रोफ़ाइल पर जाँचें।")],
      },
      documents: [doc("birth_certificate"), doc("identity_proof", true, ["aadhaar"]), doc("photo", false)],
      application: {
        mode: "department_office", url: "https://www.indiapost.gov.in",
        steps: [L("Visit a post office or authorised bank branch with the girl's birth certificate and guardian KYC.", "बालिका के जन्म प्रमाणपत्र और अभिभावक केवाईसी के साथ डाकघर या अधिकृत बैंक जाएँ।")],
        fee: L("Minimum deposit ₹250.", "न्यूनतम जमा ₹250।"), deadline: null, grievance: CPGRAMS,
        statusTracking: L("Passbook updated at the post office / bank.", "डाकघर / बैंक में पासबुक अद्यतन।"),
      },
      sources: [{ sourceId: "indiapost_ssy" }, { sourceId: "nsiindia" }],
      effectiveFrom: "2019-12-12",
    }),
    tests: [
      { name: "Girl aged 4, first account", kind: "eligible", expected: "eligible", facts: { gender: "female", date_of_birth: "2022-03-01", girl_child_accounts_in_family: 0 } },
      { name: "Girl aged 12", kind: "ineligible", expected: "not_eligible", facts: { gender: "female", date_of_birth: "2014-03-01", girl_child_accounts_in_family: 0 } },
    ],
  },

  {
    content: scheme({
      schemeId: "pmmvy",
      name: L("Pradhan Mantri Matru Vandana Yojana (PMMVY)", "प्रधानमंत्री मातृ वंदना योजना"),
      ministry: "Ministry of Women & Child Development", category: "women_child", targetGroups: ["pregnant_women", "lactating_mothers"], highImpact: true,
      summary: L("Maternity benefit of ₹5,000 for the first child and ₹6,000 for a second child if it is a girl, paid by DBT.", "पहली संतान के लिए ₹5,000 और दूसरी संतान बालिका होने पर ₹6,000 का मातृत्व लाभ, डीबीटी द्वारा।"),
      officialDescription: L("Under Mission Shakti (PMMVY 2.0): pregnant women and lactating mothers meeting socio-economic criteria (e.g. SC/ST, women with 40%+ disability, BPL ration card, PM-JAY beneficiary, family income below ₹8 lakh, e-Shram card holders, MGNREGA job card holders, among others), excluding those in regular government employment."),
      benefit: {
        kind: "cash", amountMin: 5000, amountMax: 6000, frequency: "one_time", stated: true, countsAsMoney: true,
        basis: L("Amounts stated in PMMVY 2.0 guidelines: ₹5,000 (first child, in two instalments); ₹6,000 (second child, girl, one instalment after birth).", "पीएमएमवीवाई 2.0 दिशानिर्देशों में बताई गई राशि।"),
        tiers: [
          { id: "first", when: f("t1", "child_order", "eq", 1, "First child", "पहली संतान"), amount: 5000, label: L("First child", "पहली संतान") },
          { id: "second_girl", when: all(f("t2", "child_order", "eq", 2, "Second child", "दूसरी संतान"), f("t2g", "expected_child_is_girl", "is_true", undefined, "Girl", "बालिका")), amount: 6000, label: L("Second child (girl)", "दूसरी संतान (बालिका)") },
        ],
      },
      rule: {
        schemaVersion: 1,
        mandatory: all(
          female,
          f("preg", "is_pregnant_or_lactating", "is_true", undefined, "Is pregnant or a lactating mother", "गर्भवती या धात्री माता है"),
          any(
            f("first_child", "child_order", "eq", 1, "This is the first child", "यह पहली संतान है"),
            all(f("second_child", "child_order", "eq", 2, "This is the second child", "यह दूसरी संतान है"), f("second_girl", "expected_child_is_girl", "is_true", undefined, "The second child is a girl", "दूसरी संतान बालिका है")),
          ),
          any(
            f("c_income", "annual_family_income", "lt", 800000, "Family income is below ₹8 lakh", "पारिवारिक आय ₹8 लाख से कम है"),
            f("c_scst", "social_category", "in", ["sc", "st"], "Belongs to SC/ST", "अनुसूचित जाति/जनजाति से है"),
            f("c_bpl", "ration_card", "in", ["aay", "phh"], "Holds a BPL / priority ration card", "बीपीएल / प्राथमिकता राशन कार्ड है"),
            f("c_pmjay", "in_pmjay_list", "is_true", undefined, "Is a PM-JAY beneficiary", "पीएम-जय लाभार्थी है"),
            f("c_disab", "disability_percent", "gte", 40, "Has 40% or more disability", "40% या अधिक दिव्यांगता है"),
          ),
          notGovtEmployee,
        ),
        caveats: [L("Other qualifying categories include e-Shram, MGNREGA job card, Kisan Samman Nidhi beneficiaries and AWW/AWH/ASHA workers.", "अन्य योग्य श्रेणियों में ई-श्रम, मनरेगा जॉब कार्ड, किसान सम्मान निधि लाभार्थी और आंगनवाड़ी/आशा कार्यकर्ता शामिल हैं।")],
      },
      documents: [doc("aadhaar"), doc("mcp_card"), doc("bank_passbook"), doc("income_certificate", false, ["ration_card"])],
      application: {
        mode: "official_portal", url: "https://pmmvy.wcd.gov.in",
        steps: [L("Register through your Anganwadi worker / ASHA or on the PMMVY portal.", "आंगनवाड़ी कार्यकर्ता / आशा या पीएमएमवीवाई पोर्टल से पंजीकरण करें।"), L("Register the pregnancy and keep the MCP card updated with ANC check-ups.", "गर्भावस्था पंजीकृत करें और एएनसी जाँच के साथ MCP कार्ड अद्यतन रखें।")],
        fee: FREE, deadline: null,
        deadlineNote: L("Register within 270 days of the last menstrual period for the first instalment; for the second child, register after birth within the time limit in the guideline.", "पहली किस्त हेतु अंतिम मासिक धर्म के 270 दिनों के भीतर पंजीकरण करें।"),
        grievance: L("Contact your Anganwadi centre, the PMMVY helpline on the portal, or CPGRAMS.", "आंगनवाड़ी केंद्र, पोर्टल हेल्पलाइन या CPGRAMS से संपर्क करें।"),
        statusTracking: L("Check beneficiary status on the PMMVY portal.", "पीएमएमवीवाई पोर्टल पर स्थिति देखें।"),
      },
      sources: [{ sourceId: "pmmvy", section: "PMMVY 2.0 guidelines (Mission Shakti)" }],
      effectiveFrom: "2022-04-01",
    }),
    tests: [
      { name: "First pregnancy, income below ₹8 lakh", kind: "eligible", expected: "eligible", facts: { gender: "female", is_pregnant_or_lactating: true, child_order: 1, annual_family_income: 300000, is_govt_employee: false } },
      { name: "Government employee", kind: "ineligible", expected: "not_eligible", facts: { gender: "female", is_pregnant_or_lactating: true, child_order: 1, annual_family_income: 300000, is_govt_employee: true } },
    ],
  },

  {
    content: scheme({
      schemeId: "ignoaps",
      name: L("Indira Gandhi National Old Age Pension Scheme (IGNOAPS)", "इंदिरा गांधी राष्ट्रीय वृद्धावस्था पेंशन योजना"),
      aliases: ["old age pension", "NSAP"],
      ministry: "Ministry of Rural Development", department: "National Social Assistance Programme",
      category: "social_security", targetGroups: ["senior_citizens", "bpl"],
      summary: L("Monthly pension for persons aged 60 or above from BPL households: central share ₹200 (60–79) or ₹500 (80+), usually topped up by the state.", "बीपीएल परिवारों के 60+ आयु के व्यक्तियों को मासिक पेंशन: केंद्रीय हिस्सा ₹200 (60–79) या ₹500 (80+), प्रायः राज्य द्वारा बढ़ाया जाता है।"),
      officialDescription: L("NSAP component for persons aged 60 years or above belonging to a household below the poverty line as per criteria prescribed by the Government of India."),
      benefit: {
        kind: "pension", amountMin: 200, amountMax: 500, frequency: "monthly", stated: true, countsAsMoney: true,
        basis: L("Central contribution stated in NSAP guidelines; most states add their own top-up, so the amount you receive is usually higher.", "एनएसएपी दिशानिर्देशों में केंद्रीय अंशदान; अधिकांश राज्य अपना हिस्सा जोड़ते हैं।"),
        tiers: [
          { id: "80plus", when: f("t80", "age", "gte", 80, "80+", "80+"), amount: 500, label: L("Aged 80 or above", "80 वर्ष या अधिक") },
          { id: "60to79", when: f("t60", "age", "gte", 60, "60–79", "60–79"), amount: 200, label: L("Aged 60–79", "60–79 वर्ष") },
        ],
      },
      rule: {
        schemaVersion: 1,
        mandatory: all(
          ageMin(60),
          any(
            f("bpl", "is_bpl", "is_true", undefined, "Household is on the BPL list", "परिवार बीपीएल सूची में है"),
            f("ration", "ration_card", "in", ["aay", "phh"], "Holds an AAY / priority ration card", "अंत्योदय / प्राथमिकता राशन कार्ड है"),
          ),
        ),
        caveats: [L("States set the BPL criteria and process; many run their own old-age pension with different rules.", "राज्य बीपीएल मानदंड और प्रक्रिया तय करते हैं।")],
      },
      documents: [doc("age_proof", true, ["aadhaar", "birth_certificate"]), doc("ration_card"), doc("bank_passbook"), doc("photo", false)],
      application: {
        mode: "department_office", url: "https://nsap.nic.in",
        steps: [L("Apply at the Gram Panchayat / Block office (rural) or municipal office (urban), or the state's social welfare portal.", "ग्राम पंचायत / ब्लॉक कार्यालय (ग्रामीण) या नगर निकाय कार्यालय (शहरी) में आवेदन करें।")],
        fee: FREE, deadline: null, grievance: CPGRAMS,
        statusTracking: L("Search for your sanction order on nsap.nic.in reports or ask the block office.", "nsap.nic.in पर स्वीकृति आदेश देखें या ब्लॉक कार्यालय से पूछें।"),
      },
      sources: [{ sourceId: "nsap" }],
      effectiveFrom: "2011-04-01",
    }),
    tests: [
      { name: "BPL senior aged 82", kind: "eligible", expected: "eligible", facts: { date_of_birth: "1944-01-01", is_bpl: true, ration_card: "phh" } },
      { name: "Not BPL", kind: "ineligible", expected: "not_eligible", facts: { date_of_birth: "1944-01-01", is_bpl: false, ration_card: "non_priority" } },
    ],
  },

  {
    content: scheme({
      schemeId: "post-matric-sc",
      name: L("Post-Matric Scholarship for Scheduled Caste Students", "अनुसूचित जाति के विद्यार्थियों के लिए पोस्ट-मैट्रिक छात्रवृत्ति"),
      ministry: "Ministry of Social Justice & Empowerment", category: "education", targetGroups: ["sc_students"],
      kind: "scholarship", scholarshipType: "central", highImpact: true,
      summary: L("Covers compulsory non-refundable fees and an academic allowance for SC students studying from Class 11 onwards, for family income up to ₹2.5 lakh.", "कक्षा 11 से आगे पढ़ने वाले अनुसूचित जाति के विद्यार्थियों (पारिवारिक आय ₹2.5 लाख तक) हेतु अनिवार्य शुल्क और शैक्षणिक भत्ता।"),
      officialDescription: L("Centrally sponsored scheme implemented through states/UTs. Students belonging to Scheduled Castes, studying at post-matriculation or post-secondary stage, whose parents'/guardians' income from all sources does not exceed ₹2.5 lakh per annum."),
      benefit: {
        kind: "cash", amountMax: 13500, frequency: "annual", stated: false, countsAsMoney: true, exclusivityGroup: "post_matric_scholarship",
        basis: L("Maximum annual academic allowance stated in the revised guideline (depends on course group and hosteller/day-scholar status), plus reimbursement of non-refundable fees paid to the institution.", "संशोधित दिशानिर्देश में अधिकतम वार्षिक शैक्षणिक भत्ता (पाठ्यक्रम समूह और छात्रावासी/दैनिक छात्र पर निर्भर), साथ ही अप्रतिदेय शुल्क की प्रतिपूर्ति।"),
      },
      rule: {
        schemaVersion: 1,
        referenceDate: "academic_year_start",
        mandatory: all(
          citizen,
          f("sc", "social_category", "eq", "sc", "Belongs to a Scheduled Caste", "अनुसूचित जाति से है"),
          student,
          f("level", "education_level", "in", ["class_11_12", "diploma", "ug", "pg", "phd"], "Studying at Class 11 or above", "कक्षा 11 या उससे ऊपर पढ़ रहे हैं"),
          incomeMax(250000),
        ),
        caveats: [L("Implemented by states — the application portal and last date depend on your state.", "राज्यों द्वारा लागू — आवेदन पोर्टल और अंतिम तिथि आपके राज्य पर निर्भर।")],
      },
      documents: [doc("caste_certificate"), doc("income_certificate"), doc("marksheet"), doc("admission_proof"), doc("bank_passbook"), doc("aadhaar")],
      application: {
        mode: "official_portal", url: "https://scholarships.gov.in",
        steps: [L("Complete One Time Registration (OTR) on the National Scholarship Portal, or use your state's scholarship portal if your state is not on NSP.", "राष्ट्रीय छात्रवृत्ति पोर्टल पर वन टाइम रजिस्ट्रेशन (OTR) करें, या राज्य पोर्टल उपयोग करें।"), L("Fill the application and get it verified by your institution.", "आवेदन भरें और संस्थान से सत्यापित कराएँ।")],
        fee: FREE, deadline: null, deadlineNote: L("Last dates are announced each academic year on NSP / state portals.", "अंतिम तिथियाँ हर शैक्षणिक वर्ष NSP / राज्य पोर्टल पर घोषित होती हैं।"),
        renewal: L("Renew every academic year after passing the previous year.", "पिछला वर्ष उत्तीर्ण करने के बाद हर वर्ष नवीनीकरण करें।"), renewalMonths: 12,
        grievance: L("NSP helpdesk (helpdesk@nsp.gov.in / 0120-6619540) or your state nodal officer.", "NSP हेल्पडेस्क या राज्य नोडल अधिकारी।"),
        statusTracking: L("Check application status after logging in to NSP.", "NSP में लॉगिन करके स्थिति देखें।"),
      },
      sources: [{ sourceId: "msje", section: "Post Matric Scholarship for SC students — guidelines" }, { sourceId: "nsp" }],
      effectiveFrom: "2020-04-01",
    }),
    tests: [
      { name: "SC undergraduate, income ₹1.8 lakh", kind: "eligible", expected: "eligible", facts: { is_indian_citizen: true, social_category: "sc", is_student: true, education_level: "ug", annual_family_income: 180000 } },
      { name: "Income above limit", kind: "ineligible", expected: "not_eligible", facts: { is_indian_citizen: true, social_category: "sc", is_student: true, education_level: "ug", annual_family_income: 400000 } },
      { name: "Category not shared", kind: "other", expected: "partially_eligible", facts: { is_indian_citizen: true, social_category: "prefer_not_to_say", is_student: true, education_level: "ug", annual_family_income: 180000 } },
    ],
  },

  {
    content: scheme({
      schemeId: "pre-matric-sc",
      name: L("Pre-Matric Scholarship for SC Students (Classes 9–10)", "अनुसूचित जाति के विद्यार्थियों के लिए प्री-मैट्रिक छात्रवृत्ति (कक्षा 9–10)"),
      ministry: "Ministry of Social Justice & Empowerment", category: "education", targetGroups: ["sc_students"],
      kind: "scholarship", scholarshipType: "central",
      summary: L("Annual scholarship for SC students in Classes 9 and 10 whose family income is up to ₹2.5 lakh.", "कक्षा 9 और 10 के अनुसूचित जाति के विद्यार्थियों (पारिवारिक आय ₹2.5 लाख तक) के लिए वार्षिक छात्रवृत्ति।"),
      officialDescription: L("Scholarship for SC students studying in Classes IX and X, whose parents'/guardians' income does not exceed ₹2.5 lakh per annum; implemented through states/UTs."),
      benefit: {
        kind: "cash", amountMin: 3500, amountMax: 7000, frequency: "annual", stated: false, countsAsMoney: true, exclusivityGroup: "pre_matric_scholarship",
        basis: L("Annual amount stated in the guideline: about ₹3,500 for day scholars and ₹7,000 for hostellers (subject to state implementation).", "दिशानिर्देश में वार्षिक राशि: दैनिक छात्र लगभग ₹3,500, छात्रावासी ₹7,000।"),
      },
      rule: {
        schemaVersion: 1, referenceDate: "academic_year_start",
        mandatory: all(citizen, f("sc", "social_category", "eq", "sc", "Belongs to a Scheduled Caste", "अनुसूचित जाति से है"), student, f("level", "education_level", "eq", "class_9_10", "Studying in Class 9 or 10", "कक्षा 9 या 10 में पढ़ रहे हैं"), incomeMax(250000)),
      },
      documents: [doc("caste_certificate"), doc("income_certificate"), doc("marksheet"), doc("bank_passbook"), doc("aadhaar")],
      application: {
        mode: "official_portal", url: "https://scholarships.gov.in",
        steps: [L("Apply on NSP or your state's scholarship portal; the school verifies the application.", "NSP या राज्य छात्रवृत्ति पोर्टल पर आवेदन करें; स्कूल सत्यापन करता है।")],
        fee: FREE, deadline: null, deadlineNote: L("Announced each academic year.", "हर शैक्षणिक वर्ष घोषित।"),
        renewal: L("Renew for Class 10.", "कक्षा 10 के लिए नवीनीकरण करें।"), renewalMonths: 12,
        grievance: L("NSP helpdesk or state nodal officer.", "NSP हेल्पडेस्क या राज्य नोडल अधिकारी।"), statusTracking: L("Track on NSP.", "NSP पर ट्रैक करें।"),
      },
      sources: [{ sourceId: "msje" }, { sourceId: "nsp" }],
      effectiveFrom: "2019-04-01",
    }),
    tests: [
      { name: "SC student in Class 9", kind: "eligible", expected: "eligible", facts: { is_indian_citizen: true, social_category: "sc", is_student: true, education_level: "class_9_10", annual_family_income: 120000 } },
      { name: "Class 11 student", kind: "ineligible", expected: "not_eligible", facts: { is_indian_citizen: true, social_category: "sc", is_student: true, education_level: "class_11_12", annual_family_income: 120000 } },
    ],
  },

  {
    content: scheme({
      schemeId: "csss",
      name: L("Central Sector Scheme of Scholarship for College and University Students", "कॉलेज और विश्वविद्यालय विद्यार्थियों हेतु केंद्रीय क्षेत्र छात्रवृत्ति योजना"),
      aliases: ["CSSS", "PM scholarship for college students"],
      ministry: "Ministry of Education", department: "Department of Higher Education",
      category: "education", targetGroups: ["meritorious_students"], kind: "scholarship", scholarshipType: "central",
      summary: L("₹12,000 a year at graduation level and ₹20,000 a year at postgraduate level for meritorious students from families earning up to ₹4.5 lakh.", "₹4.5 लाख तक आय वाले परिवारों के मेधावी विद्यार्थियों को स्नातक स्तर पर ₹12,000 और स्नातकोत्तर पर ₹20,000 प्रति वर्ष।"),
      officialDescription: L("For students above the 80th percentile of successful candidates in the relevant stream of their Class 12 board, pursuing regular degree courses, with gross parental income up to ₹4.5 lakh, and not availing any other scholarship."),
      benefit: {
        kind: "cash", amountMin: 12000, amountMax: 20000, frequency: "annual", stated: true, countsAsMoney: true, exclusivityGroup: "post_matric_scholarship",
        basis: L("Annual amount stated in the scheme guideline.", "योजना दिशानिर्देश में बताई गई वार्षिक राशि।"),
        tiers: [
          { id: "pg", when: f("t_pg", "education_level", "eq", "pg", "PG", "PG"), amount: 20000, label: L("Postgraduate", "स्नातकोत्तर") },
          { id: "ug_late", when: all(f("t_ug", "education_level", "eq", "ug", "UG", "UG"), f("t_y4", "year_of_study", "gte", 4, "Year 4+", "वर्ष 4+")), amount: 20000, label: L("Undergraduate, 4th/5th year of professional course", "स्नातक, व्यावसायिक पाठ्यक्रम का चौथा/पाँचवाँ वर्ष") },
          { id: "ug", when: f("t_ug2", "education_level", "eq", "ug", "UG", "UG"), amount: 12000, label: L("Undergraduate, years 1–3", "स्नातक, वर्ष 1–3") },
        ],
      },
      rule: {
        schemaVersion: 1, referenceDate: "academic_year_start",
        mandatory: all(
          f("merit", "class12_above_80_percentile", "is_true", undefined, "Was above the 80th percentile in the Class 12 board (own stream)", "कक्षा 12 बोर्ड में (अपनी स्ट्रीम) 80वें पर्सेंटाइल से ऊपर"),
          f("level", "education_level", "in", ["ug", "pg"], "Pursuing a degree (UG/PG)", "डिग्री (स्नातक/स्नातकोत्तर) कर रहे हैं"),
          f("regular", "is_regular_course", "is_true", undefined, "Regular (not correspondence/distance) course", "नियमित पाठ्यक्रम (पत्राचार/दूरस्थ नहीं)"),
          incomeMax(450000),
          not(f("other_sch", "receiving_other_scholarship", "is_true", undefined, "Already receiving another scholarship", "पहले से अन्य छात्रवृत्ति मिल रही है")),
        ),
        caveats: [L("Slots are limited (a fixed number per year, distributed among boards) — eligibility does not guarantee selection.", "सीटें सीमित हैं — पात्रता चयन की गारंटी नहीं है।")],
      },
      documents: [doc("marksheet"), doc("income_certificate"), doc("admission_proof"), doc("bank_passbook"), doc("aadhaar")],
      application: {
        mode: "official_portal", url: "https://scholarships.gov.in",
        steps: [L("Apply (fresh or renewal) on the National Scholarship Portal.", "राष्ट्रीय छात्रवृत्ति पोर्टल पर (नया या नवीनीकरण) आवेदन करें।")],
        fee: FREE, deadline: null, deadlineNote: L("NSP announces the window each academic year.", "NSP हर शैक्षणिक वर्ष अवधि घोषित करता है।"),
        renewal: L("Renew each year with at least 50% marks and 75% attendance.", "हर वर्ष कम से कम 50% अंक और 75% उपस्थिति के साथ नवीनीकरण।"), renewalMonths: 12,
        grievance: L("NSP helpdesk.", "NSP हेल्पडेस्क।"), statusTracking: L("Track on NSP.", "NSP पर ट्रैक करें।"),
      },
      sources: [{ sourceId: "moe" }, { sourceId: "nsp" }],
      effectiveFrom: "2017-04-01",
    }),
    tests: [
      { name: "UG year 1, top percentile, income ₹3 lakh", kind: "eligible", expected: "eligible", facts: { class12_above_80_percentile: true, education_level: "ug", year_of_study: 1, is_regular_course: true, annual_family_income: 300000, receiving_other_scholarship: false } },
      { name: "Already has another scholarship", kind: "ineligible", expected: "not_eligible", facts: { class12_above_80_percentile: true, education_level: "ug", year_of_study: 1, is_regular_course: true, annual_family_income: 300000, receiving_other_scholarship: true } },
    ],
  },

  {
    content: scheme({
      schemeId: "nmmss",
      name: L("National Means-cum-Merit Scholarship (NMMSS)", "राष्ट्रीय साधन-सह-योग्यता छात्रवृत्ति"),
      ministry: "Ministry of Education", department: "Department of School Education & Literacy",
      category: "education", targetGroups: ["school_students"], kind: "scholarship", scholarshipType: "central",
      summary: L("₹12,000 a year from Class 9 to 12 for meritorious students from low-income families who clear the state selection test in Class 8.", "कक्षा 8 में राज्य चयन परीक्षा उत्तीर्ण करने वाले कम आय वाले परिवारों के मेधावी विद्यार्थियों को कक्षा 9 से 12 तक ₹12,000 प्रति वर्ष।"),
      officialDescription: L("For Class 8 students of government, government-aided and local body schools whose parental income is not more than ₹3.5 lakh per annum and who scored at least 55% in Class 7 (5% relaxation for SC/ST). Students of KVS, JNV, and residential schools with free boarding are not eligible."),
      benefit: { kind: "cash", amountMin: 12000, amountMax: 12000, frequency: "annual", stated: true, countsAsMoney: true, exclusivityGroup: "school_scholarship", basis: L("Annual amount stated in the guideline (₹1,000 per month), Classes 9–12.", "दिशानिर्देश में वार्षिक राशि (₹1,000 प्रति माह), कक्षा 9–12।") },
      rule: {
        schemaVersion: 1, referenceDate: "academic_year_start",
        mandatory: all(
          student,
          f("class8", "education_level", "eq", "class_8", "Studying in Class 8", "कक्षा 8 में पढ़ रहे हैं"),
          f("school", "institution_type", "in", ["government", "government_aided", "local_body"], "Studies in a government, aided or local body school", "सरकारी, सहायता प्राप्त या स्थानीय निकाय विद्यालय में पढ़ते हैं"),
          incomeMax(350000),
          any(
            f("marks55", "previous_exam_percent", "gte", 55, "Scored at least 55% in Class 7", "कक्षा 7 में कम से कम 55% अंक"),
            all(f("scst", "social_category", "in", ["sc", "st"], "SC/ST student", "SC/ST विद्यार्थी"), f("marks50", "previous_exam_percent", "gte", 50, "Scored at least 50% in Class 7 (SC/ST relaxation)", "कक्षा 7 में कम से कम 50% अंक (SC/ST छूट)")),
          ),
        ),
        caveats: [L("You must also clear the state-level selection test (MAT + SAT).", "राज्य स्तरीय चयन परीक्षा (MAT + SAT) भी उत्तीर्ण करनी होगी।")],
      },
      documents: [doc("income_certificate"), doc("marksheet"), doc("caste_certificate", false, undefined, { onlyIf: f("d_scst", "social_category", "in", ["sc", "st"], "SC/ST", "SC/ST") }), doc("bank_passbook"), doc("aadhaar")],
      application: {
        mode: "official_portal", url: "https://scholarships.gov.in",
        steps: [L("Register for the state NMMS exam through your school (state SCERT notice).", "विद्यालय के माध्यम से राज्य NMMS परीक्षा हेतु पंजीकरण करें।"), L("After selection, apply on NSP and renew every year.", "चयन के बाद NSP पर आवेदन करें और हर वर्ष नवीनीकरण करें।")],
        fee: FREE, deadline: null, deadlineNote: L("Exam dates are set by each state's SCERT.", "परीक्षा तिथियाँ राज्य SCERT तय करता है।"),
        renewal: L("Renew in Classes 10–12 with 55% in Class 9/11 and 60% in Class 10.", "कक्षा 10–12 में निर्धारित अंकों के साथ नवीनीकरण।"), renewalMonths: 12,
        grievance: L("State SCERT / NSP helpdesk.", "राज्य SCERT / NSP हेल्पडेस्क।"), statusTracking: L("Track on NSP.", "NSP पर ट्रैक करें।"),
      },
      sources: [{ sourceId: "moe" }, { sourceId: "nsp" }],
      effectiveFrom: "2021-04-01",
    }),
    tests: [
      { name: "Class 8, govt school, 62%", kind: "eligible", expected: "eligible", facts: { is_student: true, education_level: "class_8", institution_type: "government", annual_family_income: 200000, previous_exam_percent: 62, social_category: "general" } },
      { name: "SC student with 52% (relaxation)", kind: "other", expected: "eligible", facts: { is_student: true, education_level: "class_8", institution_type: "government", annual_family_income: 200000, previous_exam_percent: 52, social_category: "sc" } },
      { name: "Private school", kind: "ineligible", expected: "not_eligible", facts: { is_student: true, education_level: "class_8", institution_type: "private", annual_family_income: 200000, previous_exam_percent: 70 } },
    ],
  },

  {
    content: scheme({
      schemeId: "aicte-pragati",
      name: L("AICTE Pragati Scholarship for Girl Students", "एआईसीटीई प्रगति छात्रवृत्ति (छात्राओं हेतु)"),
      ministry: "Ministry of Education", department: "AICTE",
      category: "education", targetGroups: ["girl_students", "technical_education"], kind: "scholarship", scholarshipType: "central",
      summary: L("₹50,000 a year for girl students admitted to AICTE-approved technical degree or diploma courses, with family income up to ₹8 lakh.", "एआईसीटीई-मान्यता प्राप्त तकनीकी डिग्री/डिप्लोमा में प्रवेशित छात्राओं (पारिवारिक आय ₹8 लाख तक) को ₹50,000 प्रति वर्ष।"),
      officialDescription: L("For girl students admitted to the first year (or second year via lateral entry) of a degree or diploma course in an AICTE-approved institution; family income up to ₹8 lakh per annum; up to two girls per family."),
      benefit: { kind: "cash", amountMin: 50000, amountMax: 50000, frequency: "annual", stated: true, countsAsMoney: true, exclusivityGroup: "aicte_scholarship", basis: L("Annual amount stated in the AICTE scheme guideline, for the course duration (max 4 years degree / 3 years diploma).", "एआईसीटीई दिशानिर्देश में वार्षिक राशि, पाठ्यक्रम अवधि हेतु।") },
      rule: {
        schemaVersion: 1, referenceDate: "academic_year_start",
        mandatory: all(
          female,
          f("tech", "is_technical_course", "is_true", undefined, "Admitted to a technical degree / diploma course", "तकनीकी डिग्री / डिप्लोमा पाठ्यक्रम में प्रवेश"),
          f("aicte", "institution_aicte_approved", "is_true", undefined, "Institution is AICTE-approved", "संस्थान एआईसीटीई-मान्यता प्राप्त है"),
          f("first_year", "first_year_admission", "is_true", undefined, "Admitted to first year (or second year by lateral entry) this academic year", "इस वर्ष प्रथम वर्ष (या लेटरल एंट्री से द्वितीय वर्ष) में प्रवेश"),
          incomeMax(800000),
          f("girls2", "girl_children_in_family", "lte", 2, "Not more than two girl children in the family", "परिवार में दो से अधिक बालिकाएँ नहीं"),
        ),
        caveats: [L("A fixed number of scholarships is awarded each year on merit of the qualifying exam — eligibility does not guarantee selection.", "हर वर्ष निश्चित संख्या में छात्रवृत्तियाँ योग्यता के आधार पर दी जाती हैं।")],
      },
      documents: [doc("income_certificate"), doc("marksheet"), doc("admission_proof"), doc("bank_passbook"), doc("aadhaar")],
      application: {
        mode: "official_portal", url: "https://scholarships.gov.in",
        steps: [L("Apply on the National Scholarship Portal under AICTE schemes.", "राष्ट्रीय छात्रवृत्ति पोर्टल पर एआईसीटीई योजनाओं में आवेदन करें।")],
        fee: FREE, deadline: null, deadlineNote: L("Announced on NSP each academic year.", "हर वर्ष NSP पर घोषित।"),
        renewal: L("Renew annually after passing the previous year.", "पिछला वर्ष उत्तीर्ण कर हर वर्ष नवीनीकरण।"), renewalMonths: 12,
        grievance: L("AICTE scholarship helpline / NSP helpdesk.", "एआईसीटीई छात्रवृत्ति हेल्पलाइन / NSP हेल्पडेस्क।"), statusTracking: L("Track on NSP.", "NSP पर ट्रैक करें।"),
      },
      sources: [{ sourceId: "aicte" }, { sourceId: "nsp" }],
      effectiveFrom: "2022-04-01",
    }),
    tests: [
      { name: "First-year B.Tech girl, income ₹5 lakh", kind: "eligible", expected: "eligible", facts: { gender: "female", is_technical_course: true, institution_aicte_approved: true, first_year_admission: true, annual_family_income: 500000, girl_children_in_family: 2 } },
      { name: "Three girls in family", kind: "ineligible", expected: "not_eligible", facts: { gender: "female", is_technical_course: true, institution_aicte_approved: true, first_year_admission: true, annual_family_income: 500000, girl_children_in_family: 3 } },
    ],
  },

  {
    content: scheme({
      schemeId: "aicte-saksham",
      name: L("AICTE Saksham Scholarship for Specially-abled Students", "एआईसीटीई सक्षम छात्रवृत्ति (दिव्यांग विद्यार्थियों हेतु)"),
      ministry: "Ministry of Education", department: "AICTE",
      category: "education", targetGroups: ["students_with_disabilities", "technical_education"], kind: "scholarship", scholarshipType: "central",
      summary: L("₹50,000 a year for students with 40% or more disability in AICTE-approved technical courses, with family income up to ₹8 lakh.", "एआईसीटीई-मान्यता प्राप्त तकनीकी पाठ्यक्रमों में 40% या अधिक दिव्यांगता वाले विद्यार्थियों (आय ₹8 लाख तक) को ₹50,000 प्रति वर्ष।"),
      officialDescription: L("For specially-abled students (disability of not less than 40%) admitted to the first year (or second year via lateral entry) of an AICTE-approved degree or diploma course; family income up to ₹8 lakh per annum."),
      benefit: { kind: "cash", amountMin: 50000, amountMax: 50000, frequency: "annual", stated: true, countsAsMoney: true, exclusivityGroup: "aicte_scholarship", basis: L("Annual amount stated in the AICTE scheme guideline.", "एआईसीटीई दिशानिर्देश में वार्षिक राशि।") },
      rule: {
        schemaVersion: 1, referenceDate: "academic_year_start",
        mandatory: all(
          f("disab", "disability_percent", "gte", 40, "Disability of 40% or more (as per certificate)", "40% या अधिक दिव्यांगता (प्रमाणपत्र अनुसार)", { requireVerified: true }),
          f("tech", "is_technical_course", "is_true", undefined, "Admitted to a technical degree / diploma course", "तकनीकी डिग्री / डिप्लोमा पाठ्यक्रम में प्रवेश"),
          f("aicte", "institution_aicte_approved", "is_true", undefined, "Institution is AICTE-approved", "संस्थान एआईसीटीई-मान्यता प्राप्त है"),
          f("first_year", "first_year_admission", "is_true", undefined, "Admitted to first year (or second year by lateral entry)", "प्रथम वर्ष (या लेटरल एंट्री से द्वितीय वर्ष) में प्रवेश"),
          incomeMax(800000),
        ),
      },
      documents: [doc("disability_certificate"), doc("income_certificate"), doc("admission_proof"), doc("bank_passbook"), doc("aadhaar")],
      application: {
        mode: "official_portal", url: "https://scholarships.gov.in",
        steps: [L("Apply on the National Scholarship Portal under AICTE schemes.", "राष्ट्रीय छात्रवृत्ति पोर्टल पर आवेदन करें।")],
        fee: FREE, deadline: null, renewal: L("Renew annually.", "हर वर्ष नवीनीकरण।"), renewalMonths: 12,
        grievance: L("AICTE scholarship helpline / NSP helpdesk.", "एआईसीटीई हेल्पलाइन / NSP हेल्पडेस्क।"), statusTracking: L("Track on NSP.", "NSP पर ट्रैक करें।"),
      },
      sources: [{ sourceId: "aicte" }, { sourceId: "nsp" }],
      effectiveFrom: "2022-04-01",
    }),
    tests: [
      { name: "Verified 60% disability, first-year diploma", kind: "eligible", expected: "eligible", facts: { disability_percent: [{ value: 60, provenance: "government_verified" }], is_technical_course: true, institution_aicte_approved: true, first_year_admission: true, annual_family_income: 300000 } },
      { name: "Self-declared disability only → needs verification", kind: "other", expected: "partially_eligible", facts: { disability_percent: 60, is_technical_course: true, institution_aicte_approved: true, first_year_admission: true, annual_family_income: 300000 } },
      { name: "Disability 30%", kind: "ineligible", expected: "not_eligible", facts: { disability_percent: 30, is_technical_course: true, institution_aicte_approved: true, first_year_admission: true, annual_family_income: 300000 } },
    ],
  },

  {
    content: scheme({
      schemeId: "pm-vishwakarma",
      name: L("PM Vishwakarma", "पीएम विश्वकर्मा"),
      ministry: "Ministry of Micro, Small & Medium Enterprises", category: "business", targetGroups: ["artisans"],
      summary: L("Recognition, skill training with a stipend, a toolkit incentive and collateral-free concessional loans for artisans in 18 traditional trades.", "18 पारंपरिक व्यवसायों के कारीगरों को मान्यता, वजीफ़े सहित कौशल प्रशिक्षण, टूलकिट प्रोत्साहन और बिना गारंटी रियायती ऋण।"),
      officialDescription: L("Artisans and craftspeople aged 18+ working with hands and tools in one of 18 family-based traditional trades, self-employed in the unorganised sector; one member per family; government employees and those who availed similar credit schemes (PMEGP, PM SVANidhi, MUDRA) in the past 5 years are excluded (unless fully repaid)."),
      benefit: {
        kind: "loan", amountMax: 300000, frequency: "one_time", stated: true, countsAsMoney: false,
        basis: L("Collateral-free loan up to ₹3 lakh in two tranches (₹1 lakh + ₹2 lakh) at 5% concessional interest; toolkit incentive up to ₹15,000 (e-voucher); training stipend ₹500/day. Loans are not counted as money received.", "₹3 लाख तक बिना गारंटी ऋण (₹1 लाख + ₹2 लाख) 5% रियायती ब्याज पर; ₹15,000 तक टूलकिट प्रोत्साहन; प्रशिक्षण वजीफ़ा ₹500/दिन। ऋण को प्राप्त राशि नहीं गिना गया।"),
      },
      rule: {
        schemaVersion: 1,
        mandatory: all(
          ageMin(18),
          f("artisan", "occupation", "eq", "artisan", "Works as a self-employed artisan / craftsperson", "स्व-रोज़गार कारीगर / शिल्पकार हैं"),
          f("trade", "artisan_trade", "exists", undefined, "Works in one of the 18 listed traditional trades", "18 सूचीबद्ध पारंपरिक व्यवसायों में से एक में काम करते हैं"),
          not(f("prior_credit", "availed_credit_scheme_5y", "is_true", undefined, "Took a PMEGP / PM SVANidhi / MUDRA loan in the last 5 years (not repaid)", "पिछले 5 वर्षों में PMEGP / PM SVANidhi / मुद्रा ऋण लिया (नहीं चुकाया)")),
          not(f("govt", "is_govt_employee", "is_true", undefined, "Is a government employee or has one in the family", "सरकारी कर्मचारी है")),
          not(f("family", "family_member_availed_vishwakarma", "is_true", undefined, "Another family member is already registered", "परिवार का अन्य सदस्य पहले से पंजीकृत है")),
        ),
        caveats: [L("Registration is verified in three stages (Gram Panchayat/ULB, district, screening committee).", "पंजीकरण का तीन चरणों में सत्यापन होता है।")],
      },
      documents: [doc("aadhaar"), doc("bank_passbook"), doc("ration_card", false)],
      application: {
        mode: "csc_offline", url: "https://pmvishwakarma.gov.in",
        steps: [L("Register at a Common Service Centre (CSC) with Aadhaar biometric authentication.", "आधार बायोमेट्रिक प्रमाणीकरण के साथ कॉमन सर्विस सेंटर (CSC) पर पंजीकरण करें।"), L("Complete verification and basic skill training to unlock the toolkit incentive and loan.", "टूलकिट और ऋण हेतु सत्यापन और बुनियादी प्रशिक्षण पूरा करें।")],
        fee: FREE, deadline: null, grievance: L("PM Vishwakarma helpline on the portal, or CPGRAMS.", "पोर्टल हेल्पलाइन या CPGRAMS।"),
        statusTracking: L("Log in on the PM Vishwakarma portal with your registration.", "पोर्टल पर पंजीकरण से लॉगिन करें।"),
      },
      sources: [{ sourceId: "pmvishwakarma" }],
      effectiveFrom: "2023-09-17",
    }),
    tests: [
      { name: "Potter, 35, no prior loans", kind: "eligible", expected: "eligible", facts: { date_of_birth: "1991-06-01", occupation: "artisan", artisan_trade: "potter", availed_credit_scheme_5y: false, is_govt_employee: false, family_member_availed_vishwakarma: false } },
      { name: "Prior MUDRA loan outstanding", kind: "ineligible", expected: "not_eligible", facts: { date_of_birth: "1991-06-01", occupation: "artisan", artisan_trade: "potter", availed_credit_scheme_5y: true, is_govt_employee: false, family_member_availed_vishwakarma: false } },
    ],
  },

  {
    content: scheme({
      schemeId: "pm-svanidhi",
      name: L("PM Street Vendor's AtmaNirbhar Nidhi (PM SVANidhi)", "पीएम स्ट्रीट वेंडर्स आत्मनिर्भर निधि (पीएम स्वनिधि)"),
      ministry: "Ministry of Housing & Urban Affairs", category: "business", targetGroups: ["street_vendors"],
      summary: L("Collateral-free working-capital loans for urban street vendors in tranches, with interest subsidy and cashback on digital transactions.", "शहरी रेहड़ी-पटरी विक्रेताओं को किस्तों में बिना गारंटी कार्यशील पूंजी ऋण, ब्याज सब्सिडी और डिजिटल लेनदेन पर कैशबैक।"),
      officialDescription: L("Street vendors vending in urban areas holding a Certificate of Vending / Identity Card issued by the Urban Local Body, or identified in the ULB survey, or holding a Letter of Recommendation from the ULB / Town Vending Committee."),
      benefit: { kind: "loan", amountMax: 50000, frequency: "one_time", stated: false, countsAsMoney: false, basis: L("Working-capital loans in successive tranches (the latest guideline states the tranche limits) with a 7% interest subsidy on timely repayment. Loans are not counted as money received.", "क्रमिक किस्तों में कार्यशील पूंजी ऋण, समय पर चुकाने पर 7% ब्याज सब्सिडी। ऋण को प्राप्त राशि नहीं गिना गया।") },
      rule: {
        schemaVersion: 1,
        mandatory: all(
          f("vendor", "occupation", "eq", "street_vendor", "Works as a street vendor", "रेहड़ी-पटरी विक्रेता हैं"),
          f("urban", "residence_area", "eq", "urban", "Vends in an urban area", "शहरी क्षेत्र में विक्रय करते हैं"),
          f("cert", "has_vending_certificate", "is_true", undefined, "Has a vending certificate / ID or a Letter of Recommendation from the ULB", "नगर निकाय का वेंडिंग प्रमाणपत्र / पहचान पत्र या अनुशंसा पत्र है", {
            changeHint: L("Ask your Urban Local Body for a Letter of Recommendation — you can request it through the PM SVANidhi portal.", "अपने नगर निकाय से अनुशंसा पत्र माँगें — पीएम स्वनिधि पोर्टल से अनुरोध कर सकते हैं।"),
          }),
        ),
      },
      documents: [doc("vending_certificate"), doc("aadhaar"), doc("bank_passbook")],
      application: {
        mode: "official_portal", url: "https://pmsvanidhi.mohua.gov.in",
        steps: [L("Apply on the PM SVANidhi portal, via a CSC, or through a lending institution's agent.", "पीएम स्वनिधि पोर्टल, CSC या ऋणदाता संस्था के एजेंट से आवेदन करें।")],
        fee: FREE, deadline: null, grievance: CPGRAMS, statusTracking: L("Track using your application number on the portal.", "पोर्टल पर आवेदन संख्या से ट्रैक करें।"),
      },
      sources: [{ sourceId: "pmsvanidhi" }],
      effectiveFrom: "2020-06-01",
    }),
    tests: [
      { name: "Urban vendor with ULB certificate", kind: "eligible", expected: "eligible", facts: { occupation: "street_vendor", residence_area: "urban", has_vending_certificate: true } },
      { name: "Rural vendor", kind: "ineligible", expected: "not_eligible", facts: { occupation: "street_vendor", residence_area: "rural", has_vending_certificate: true } },
    ],
  },

  {
    content: scheme({
      schemeId: "standup-india",
      name: L("Stand-Up India", "स्टैंड-अप इंडिया"),
      ministry: "Ministry of Finance", department: "Department of Financial Services / SIDBI",
      category: "business", targetGroups: ["sc_st_entrepreneurs", "women_entrepreneurs"],
      summary: L("Bank loans between ₹10 lakh and ₹1 crore for SC/ST and women entrepreneurs setting up a new enterprise.", "नया उद्यम स्थापित करने वाले SC/ST और महिला उद्यमियों के लिए ₹10 लाख से ₹1 करोड़ तक बैंक ऋण।"),
      officialDescription: L("Composite loan for greenfield enterprises in manufacturing, services, trading or agri-allied activities, for SC/ST and/or women borrowers aged 18+, who are not defaulters to any bank/financial institution."),
      benefit: { kind: "loan", amountMin: 1000000, amountMax: 10000000, frequency: "one_time", stated: true, countsAsMoney: false, basis: L("Bank loan range stated in the scheme. Loans are not counted as money received.", "योजना में बताई गई ऋण सीमा। ऋण को प्राप्त राशि नहीं गिना गया।") },
      rule: {
        schemaVersion: 1,
        mandatory: all(
          ageMin(18),
          any(f("woman", "gender", "eq", "female", "Applicant is a woman", "आवेदक महिला है"), f("scst", "social_category", "in", ["sc", "st"], "Applicant belongs to SC/ST", "आवेदक अनुसूचित जाति/जनजाति से है")),
          f("greenfield", "plans_greenfield_enterprise", "is_true", undefined, "Setting up a first-time (greenfield) enterprise", "पहला (ग्रीनफ़ील्ड) उद्यम स्थापित कर रहे हैं"),
          not(f("defaulter", "is_loan_defaulter", "is_true", undefined, "Is a defaulter to a bank or financial institution", "किसी बैंक या वित्तीय संस्था के डिफ़ॉल्टर हैं")),
        ),
        caveats: [L("For non-individual enterprises, at least 51% shareholding and control must be with an SC/ST or woman entrepreneur.", "गैर-व्यक्तिगत उद्यमों में कम से कम 51% हिस्सेदारी SC/ST या महिला उद्यमी के पास होनी चाहिए।"), L("The bank appraises the project; eligibility does not guarantee a loan.", "बैंक परियोजना का मूल्यांकन करता है; पात्रता ऋण की गारंटी नहीं।")],
      },
      documents: [doc("identity_proof", true, ["aadhaar"]), doc("business_plan"), doc("caste_certificate", false, undefined, { onlyIf: f("d_scst", "social_category", "in", ["sc", "st"], "SC/ST", "SC/ST") }), doc("bank_passbook", false)],
      application: {
        mode: "official_portal", url: "https://www.standupmitra.in",
        steps: [L("Register on the Stand-Up Mitra portal or apply directly at a scheduled commercial bank branch.", "स्टैंड-अप मित्र पोर्टल पर पंजीकरण करें या सीधे बैंक शाखा में आवेदन करें।")],
        fee: L("Bank processing charges may apply.", "बैंक प्रसंस्करण शुल्क लागू हो सकता है।"), deadline: null, grievance: CPGRAMS,
        statusTracking: L("Track on the Stand-Up Mitra portal or with your bank.", "पोर्टल या बैंक से ट्रैक करें।"),
      },
      sources: [{ sourceId: "standup" }],
      effectiveFrom: "2016-04-05",
    }),
    tests: [
      { name: "Woman starting a new unit", kind: "eligible", expected: "eligible", facts: { date_of_birth: "1990-01-01", gender: "female", social_category: "general", plans_greenfield_enterprise: true, is_loan_defaulter: false } },
      { name: "Loan defaulter", kind: "ineligible", expected: "not_eligible", facts: { date_of_birth: "1990-01-01", gender: "female", plans_greenfield_enterprise: true, is_loan_defaulter: true } },
    ],
  },

  {
    content: scheme({
      schemeId: "mh-ladki-bahin",
      name: L("Mukhyamantri Majhi Ladki Bahin Yojana (Maharashtra)", "मुख्यमंत्री माझी लाडकी बहीण योजना (महाराष्ट्र)"),
      ministry: "Women & Child Development Department, Government of Maharashtra",
      level: "state", stateScope: ["MH"], category: "women_child", targetGroups: ["women"], highImpact: true,
      summary: L("Monthly financial assistance of ₹1,500 to eligible women aged 21–65 who are domiciled in Maharashtra, with family income up to ₹2.5 lakh.", "महाराष्ट्र की अधिवासी 21–65 वर्ष की पात्र महिलाओं (पारिवारिक आय ₹2.5 लाख तक) को ₹1,500 मासिक सहायता।"),
      officialDescription: L("Women domiciled in Maharashtra aged 21–65 (married, widowed, divorced, abandoned, destitute, and one unmarried woman per family), with annual family income up to ₹2.5 lakh; excludes families with income-tax payers, government employees/pensioners, or a four-wheeler (excluding tractors)."),
      benefit: { kind: "cash", amountMin: 1500, amountMax: 1500, frequency: "monthly", stated: true, countsAsMoney: true, basis: L("Monthly amount stated in the state government resolution.", "राज्य शासन निर्णय में बताई गई मासिक राशि।") },
      rule: {
        schemaVersion: 1,
        mandatory: all(
          female,
          f("age_range", "age", "between", [21, 65], "Aged between 21 and 65", "आयु 21 से 65 वर्ष के बीच"),
          f("domicile", "is_state_domicile", "is_true", undefined, "Is domiciled in Maharashtra", "महाराष्ट्र की अधिवासी है"),
          incomeMax(250000),
          noIncomeTax,
          notGovtEmployee,
        ),
        caveats: [L("Families owning a four-wheeler (other than a tractor) are excluded.", "चारपहिया वाहन (ट्रैक्टर को छोड़कर) वाले परिवार अपवर्जित हैं।")],
      },
      documents: [doc("aadhaar"), doc("domicile_certificate", true, ["birth_certificate", "ration_card"]), doc("income_certificate", true, ["ration_card"]), doc("bank_passbook"), doc("photo", false)],
      application: {
        mode: "official_portal", url: "https://ladakibahin.maharashtra.gov.in",
        steps: [L("Apply on the official portal or the Nari Shakti Doot app, or through the Anganwadi worker / ward office.", "आधिकारिक पोर्टल या नारी शक्ति दूत ऐप, अथवा आंगनवाड़ी सेविका / वार्ड कार्यालय से आवेदन करें।")],
        fee: FREE, deadline: null, deadlineNote: L("The state has opened and closed registration windows; check the portal for the current status.", "राज्य ने पंजीकरण अवधि खोली और बंद की है; वर्तमान स्थिति पोर्टल पर देखें।"),
        grievance: L("Helpline listed on the portal, or the district Women & Child Development office.", "पोर्टल पर दी गई हेल्पलाइन या ज़िला महिला एवं बाल विकास कार्यालय।"),
        statusTracking: L("Log in on the portal to see application status.", "पोर्टल पर लॉगिन करके स्थिति देखें।"),
      },
      sources: [{ sourceId: "mh_ladkibahin" }],
      effectiveFrom: "2024-07-01",
    }),
    tests: [
      { name: "Maharashtra woman, 35, income ₹1.5 lakh", kind: "eligible", expected: "eligible", facts: { state: "MH", gender: "female", date_of_birth: "1991-04-01", is_state_domicile: true, annual_family_income: 150000, pays_income_tax: false, is_govt_employee: false } },
      { name: "Age 66", kind: "ineligible", expected: "not_eligible", facts: { state: "MH", gender: "female", date_of_birth: "1959-04-01", is_state_domicile: true, annual_family_income: 150000, pays_income_tax: false, is_govt_employee: false } },
    ],
  },

  {
    content: scheme({
      schemeId: "ka-gruha-lakshmi",
      name: L("Gruha Lakshmi (Karnataka)", "गृह लक्ष्मी (कर्नाटक)"),
      ministry: "Women & Child Development Department, Government of Karnataka",
      level: "state", stateScope: ["KA"], category: "women_child", targetGroups: ["women_heads_of_household"],
      summary: L("₹2,000 a month to the woman head of the family as recorded on the ration card in Karnataka.", "कर्नाटक में राशन कार्ड पर दर्ज परिवार की महिला मुखिया को ₹2,000 प्रति माह।"),
      officialDescription: L("Woman head of the household as per the AAY/BPL/APL ration card; excludes cases where she or her husband is an income-tax payer or GST return filer, and government employees."),
      benefit: { kind: "cash", amountMin: 2000, amountMax: 2000, frequency: "monthly", stated: true, countsAsMoney: true, basis: L("Monthly amount stated in the state government order.", "राज्य सरकार के आदेश में बताई गई मासिक राशि।") },
      rule: {
        schemaVersion: 1,
        mandatory: all(
          female,
          f("head", "is_woman_head_of_family", "is_true", undefined, "Recorded as the woman head of the family on the ration card", "राशन कार्ड पर परिवार की महिला मुखिया के रूप में दर्ज"),
          f("ration", "ration_card", "in", ["aay", "phh", "non_priority"], "Family holds a ration card", "परिवार के पास राशन कार्ड है"),
          noIncomeTax, notGovtEmployee,
        ),
        caveats: [L("Excluded if the husband is an income-tax payer or GST return filer.", "पति आयकर दाता या जीएसटी रिटर्न दाखिलकर्ता हो तो अपवर्जित।")],
      },
      documents: [doc("ration_card"), doc("aadhaar"), doc("bank_passbook")],
      application: {
        mode: "official_portal", url: "https://sevasindhugs.karnataka.gov.in",
        steps: [L("Apply on Seva Sindhu, or at Grama One / Karnataka One / Bapuji Seva Kendra.", "सेवा सिंधु या ग्राम वन / कर्नाटक वन / बापूजी सेवा केंद्र पर आवेदन करें।")],
        fee: FREE, deadline: null, grievance: L("Karnataka WCD helpline or the Seva Sindhu grievance option.", "कर्नाटक WCD हेल्पलाइन या सेवा सिंधु शिकायत विकल्प।"),
        statusTracking: L("Check status on the Seva Sindhu portal / DBT Karnataka app.", "सेवा सिंधु पोर्टल / DBT कर्नाटक ऐप पर स्थिति देखें।"),
      },
      sources: [{ sourceId: "ka_seva_sindhu" }],
      effectiveFrom: "2023-08-30",
    }),
    tests: [
      { name: "Woman head of family with BPL card in Karnataka", kind: "eligible", expected: "eligible", facts: { state: "KA", gender: "female", is_woman_head_of_family: true, ration_card: "phh", pays_income_tax: false, is_govt_employee: false } },
      { name: "No ration card", kind: "ineligible", expected: "not_eligible", facts: { state: "KA", gender: "female", is_woman_head_of_family: true, ration_card: "none", pays_income_tax: false, is_govt_employee: false } },
    ],
  },

  {
    content: scheme({
      schemeId: "rf-ug-scholarship",
      name: L("Reliance Foundation Undergraduate Scholarships", "रिलायंस फ़ाउंडेशन स्नातक छात्रवृत्ति"),
      ministry: "Reliance Foundation (non-government)",
      category: "education", targetGroups: ["ug_students"], kind: "scholarship", scholarshipType: "corporate_csr",
      isThirdParty: true,
      provider: { name: "Reliance Foundation", termsUrl: "https://www.scholarships.reliancefoundation.org", privacyUrl: "https://www.scholarships.reliancefoundation.org" },
      summary: L("A private (CSR) scholarship of up to ₹2 lakh over the degree for first-year undergraduate students. This is not a government scheme.", "प्रथम वर्ष स्नातक विद्यार्थियों हेतु डिग्री अवधि में ₹2 लाख तक की निजी (CSR) छात्रवृत्ति। यह सरकारी योजना नहीं है।"),
      officialDescription: L("Third-party opportunity. Provider-stated criteria (check the provider's site for the current cycle): first-year regular undergraduate students, Class 12 marks of 60% or above, household income below ₹15 lakh (preference to below ₹2.5 lakh)."),
      benefit: { kind: "cash", amountMax: 200000, frequency: "one_time", stated: false, countsAsMoney: true, exclusivityGroup: "private_ug_scholarship", basis: L("Maximum amount over the full degree as stated by the provider; awarded on merit-cum-means selection. Not guaranteed.", "प्रदाता द्वारा बताई गई पूरी डिग्री की अधिकतम राशि; चयन आधारित। गारंटी नहीं।") },
      rule: {
        schemaVersion: 1,
        mandatory: all(
          student,
          f("ug", "education_level", "eq", "ug", "Studying an undergraduate degree", "स्नातक डिग्री कर रहे हैं"),
          f("first", "first_year_admission", "is_true", undefined, "In the first year of the degree", "डिग्री के प्रथम वर्ष में"),
          f("regular", "is_regular_course", "is_true", undefined, "Regular full-time course", "नियमित पूर्णकालिक पाठ्यक्रम"),
          f("marks", "previous_exam_percent", "gte", 60, "Scored at least 60% in Class 12", "कक्षा 12 में कम से कम 60% अंक"),
          f("income_max", "annual_family_income", "lt", 1500000, "Household income below ₹15 lakh", "पारिवारिक आय ₹15 लाख से कम"),
        ),
        caveats: [L("Selection includes an aptitude test; awards are limited.", "चयन में अभिक्षमता परीक्षा शामिल है; पुरस्कार सीमित हैं।")],
      },
      documents: [doc("marksheet"), doc("income_certificate"), doc("admission_proof"), doc("photo")],
      application: {
        mode: "official_url", url: "https://www.scholarships.reliancefoundation.org",
        steps: [L("Apply on the provider's own website. Read the provider's privacy policy and terms before sharing data.", "प्रदाता की वेबसाइट पर आवेदन करें। डेटा साझा करने से पहले प्रदाता की गोपनीयता नीति और शर्तें पढ़ें।")],
        fee: FREE, deadline: null, deadlineNote: L("Cycle dates are set by the provider each year.", "चक्र की तिथियाँ प्रदाता हर वर्ष तय करता है।"),
        grievance: L("Contact the provider through its website.", "वेबसाइट के माध्यम से प्रदाता से संपर्क करें।"), statusTracking: L("Provider's applicant dashboard.", "प्रदाता का आवेदक डैशबोर्ड।"),
      },
      sources: [{ sourceId: "rf_scholarships" }],
      effectiveFrom: "2025-01-01",
      dataConfidence: "low",
      coverageFlags: ["seed_unverified", "third_party", "cycle_dates_unknown"],
    }),
    tests: [
      { name: "First-year UG, 82%, income ₹3 lakh", kind: "eligible", expected: "eligible", facts: { is_student: true, education_level: "ug", first_year_admission: true, is_regular_course: true, previous_exam_percent: 82, annual_family_income: 300000 } },
      { name: "Second-year student", kind: "ineligible", expected: "not_eligible", facts: { is_student: true, education_level: "ug", first_year_admission: false, is_regular_course: true, previous_exam_percent: 82, annual_family_income: 300000 } },
    ],
  },
];

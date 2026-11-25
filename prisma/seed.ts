import { PrismaClient } from "@prisma/client";
import { SCHEMES } from "../src/lib/schemes/data";
import { SOURCES } from "../src/lib/schemes/sources";
import { createVersion, publishVersion } from "../src/lib/schemes/versioning";
import { generateCases } from "../src/lib/schemes/testing";

const db = new PrismaClient();

const GLOSSARY: [string, string, string][] = [
  ["eligible", "पात्र", "approved"],
  ["scheme", "योजना", "approved"],
  ["scholarship", "छात्रवृत्ति", "approved"],
  ["income certificate", "आय प्रमाणपत्र", "approved"],
  ["domicile", "अधिवास", "draft"],
  ["Direct Benefit Transfer (DBT)", "प्रत्यक्ष लाभ अंतरण (डीबीटी)", "approved"],
  ["grievance", "शिकायत", "approved"],
  ["below poverty line (BPL)", "गरीबी रेखा से नीचे (बीपीएल)", "approved"],
  ["benchmark disability", "बेंचमार्क दिव्यांगता", "draft"],
  ["lateral entry", "लेटरल एंट्री", "draft"],
];

async function main() {
  for (const s of SOURCES) {
    await db.source.upsert({
      where: { id: s.id },
      update: { title: s.title, url: s.url, publisher: s.publisher, kind: s.kind, isOfficial: s.isOfficial, isThirdParty: !!s.isThirdParty, licence: s.licence, termsNotes: s.termsNotes },
      create: { id: s.id, title: s.title, url: s.url, publisher: s.publisher, kind: s.kind, isOfficial: s.isOfficial, isThirdParty: !!s.isThirdParty, licence: s.licence, termsNotes: s.termsNotes },
    });
  }

  for (const { content, tests } of SCHEMES) {
    const existing = await db.scheme.findUnique({ where: { id: content.schemeId } });
    if (existing?.currentVersionId) continue; // never overwrite curated versions on re-seed
    await db.$transaction(async (tx) => {
      const v = await createVersion(tx, content, { status: "in_review", authorId: null, changeNote: "Initial seed from public scheme information" });
      await publishVersion(tx, v.id, null);
      const all = [...tests, ...generateCases(content, tests)];
      await tx.ruleTestCase.createMany({
        data: all.map((t) => ({ schemeId: content.schemeId, name: t.name, kind: t.kind, facts: t as never, documents: t.documents ?? [], referenceDate: t.now ? new Date(t.now) : null, expected: t.expected })),
      });
    }, { timeout: 30000 });
    console.log(`seeded ${content.schemeId}`);
  }

  const staff: [string | undefined, string, string][] = [
    [process.env.SEED_ADMIN_PHONE, "admin", "Admin (seed)"],
    [process.env.SEED_SUPPORT_PHONE, "support", "Support operator (seed)"],
  ];
  for (const [phone, role, name] of staff) {
    if (!phone) continue;
    const u = await db.user.upsert({ where: { phoneE164: phone }, update: { role }, create: { phoneE164: phone, phoneVerifiedAt: new Date(), role, displayName: name } });
    await db.identity.upsert({ where: { provider_subject: { provider: "phone", subject: phone } }, update: {}, create: { userId: u.id, provider: "phone", subject: phone } });
  }

  for (const [term, text, status] of GLOSSARY) {
    await db.translation.upsert({ where: { term_locale: { term, locale: "hi" } }, update: {}, create: { term, locale: "hi", text, status } });
  }

  // GIN index for full-text search over content chunks.
  await db.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS content_chunk_fts ON "ContentChunk" USING GIN (to_tsvector('simple', text))`);
  console.log("seed complete");
}

main().finally(() => db.$disconnect());

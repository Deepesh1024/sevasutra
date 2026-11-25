// Updates seed-authored v1 records in place when the catalogue file changes (never touches curator versions).
import { PrismaClient } from "@prisma/client";
import { SCHEMES } from "../src/lib/schemes/data";
import { denormalise } from "../src/lib/schemes/versioning";
import { hashRule } from "../src/lib/engine/evaluate";

const db = new PrismaClient();
(async () => {
  let n = 0;
  for (const { content } of SCHEMES) {
    const v = await db.schemeVersion.findFirst({ where: { schemeId: content.schemeId, version: 1, authorId: null } });
    if (!v) continue;
    await db.schemeVersion.update({ where: { id: v.id }, data: { content: content as never, ...denormalise(content) } });
    await db.eligibilityRule.update({ where: { schemeVersionId: v.id }, data: { definition: content.rule as never, ruleHash: hashRule(content.rule) } });
    n++;
  }
  console.log(`refreshed ${n} seed versions`);
  await db.$disconnect();
})();

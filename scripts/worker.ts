// Notification worker: delivers due reminders with retry/backoff, dead-lettering and quiet hours.
// Run alongside the app: `npm run worker` (use --once for a single pass).
import { PrismaClient } from "@prisma/client";
import { processDue } from "../src/lib/notify/queue";

const db = new PrismaClient();
const once = process.argv.includes("--once");

async function tick() {
  const s = await processDue(db);
  if (s.sent + s.failed + s.dead + s.deferred + s.suppressed > 0) console.log(JSON.stringify({ t: new Date().toISOString(), msg: "worker.tick", ...s }));
}

(async () => {
  await tick();
  if (once) return db.$disconnect();
  setInterval(() => void tick().catch((e) => console.error(JSON.stringify({ level: "error", msg: "worker.error", error: String(e) }))), 30_000);
})();

// Reminder scheduler: run daily (cron) — `npm run reminders`. Safe to re-run thanks to dedupe keys.
import { PrismaClient } from "@prisma/client";
import { scheduleReminders } from "../src/lib/notify/scheduler";

const db = new PrismaClient();
scheduleReminders(db)
  .then((n) => console.log(JSON.stringify({ t: new Date().toISOString(), msg: "reminders.scheduled", candidates: n })))
  .finally(() => db.$disconnect());

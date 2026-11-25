import { db } from "@/lib/db";
import { verifyToken } from "@/lib/crypto";
import { audit } from "@/lib/audit";

export const metadata = { title: "Unsubscribe" };

async function unsubscribe(formData: FormData) {
  "use server";
  const uid = verifyToken(String(formData.get("t") ?? ""), "unsub");
  if (!uid) return;
  const u = await db.user.findUnique({ where: { id: uid } });
  if (!u) return;
  await db.user.update({ where: { id: uid }, data: { notificationPrefs: { ...((u.notificationPrefs as object) ?? {}), email: false } } });
  await db.consent.updateMany({ where: { userId: uid, purpose: "reminders_email", withdrawnAt: null }, data: { withdrawnAt: new Date() } });
  await db.notification.updateMany({ where: { userId: uid, status: { in: ["queued", "failed"] } }, data: { status: "suppressed" } });
  await audit({ actorId: uid, actorType: "user", action: "notification.unsubscribed", entityType: "user", entityId: uid });
  const { redirect } = await import("next/navigation");
  redirect("/unsubscribe?done=1");
}

export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ t?: string; done?: string }> }) {
  const { t = "", done } = await searchParams;
  const valid = !!verifyToken(t, "unsub");
  if (done) return <section className="card p-6 max-w-lg"><h1 className="text-2xl font-bold">You are unsubscribed</h1><p>You will no longer receive reminder emails.</p></section>;
  return (
    <section className="card p-6 max-w-lg space-y-3">
      <h1 className="text-2xl font-bold">Unsubscribe from SevaSutra reminders</h1>
      {!valid ? <p>This link is invalid or has expired. You can change reminders from your Account page after signing in.</p> : (
        <form action={unsubscribe} className="space-y-2">
          <input type="hidden" name="t" value={t} />
          <p>Stop all reminder emails? You can turn them on again from your Account page.</p>
          <button className="btn btn-primary">Unsubscribe</button>
        </form>
      )}
    </section>
  );
}

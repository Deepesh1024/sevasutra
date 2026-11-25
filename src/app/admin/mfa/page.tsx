import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { MfaForm } from "./MfaForm";

export const metadata = { title: "Staff verification" };

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = "/admin" } = await searchParams;
  const s = await getSession();
  if (!s?.user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (s.user.role !== "admin" && s.user.role !== "support") redirect("/");
  if (s.mfaVerified) redirect(next);
  return (
    <section className="card p-6 max-w-xl">
      <h1 className="text-2xl font-bold mb-2">Staff two-factor verification</h1>
      <p className="text-ink-2 mb-4">Staff accounts need an authenticator-app code in addition to phone OTP.</p>
      <MfaForm next={next} enrolled={!!s.user.totpEnabledAt} />
    </section>
  );
}

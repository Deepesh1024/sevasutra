import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { PhoneOtpForm } from "@/components/PhoneOtpForm";
import { GoogleButton } from "@/components/GoogleButton";
import { devGoogleSignInAction } from "@/app/actions/auth";
import { currentUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { isApplicant } from "@/lib/auth/roles";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = "/dashboard" } = await searchParams;
  const { lang } = await getT();
  const hi = lang === "hi";
  const user = await currentUser();
  if (isApplicant(user)) redirect(next);
  const googleId = process.env.GOOGLE_CLIENT_ID;
  const devMode = process.env.NODE_ENV !== "production";

  return (
    <div className="grid gap-6 md:grid-cols-2 max-w-4xl">
      <section className="card p-6" aria-labelledby="phone-h">
        <h1 id="phone-h" className="text-2xl font-bold mb-1">{hi ? "ईमेल या मोबाइल OTP से साइन इन करें" : "Sign in with an email or mobile OTP"}</h1>
        <p className="text-ink-2 mb-4">{hi ? "प्रोफ़ाइल सहेजने, दस्तावेज़ रखने, आवेदन चेकलिस्ट और रिमाइंडर के लिए आवश्यक।" : "Needed to save your profile, keep documents, track applications and get reminders."}</p>
        {user && !isApplicant(user) ? (
          <p>{hi ? "आप एक्सप्लोरर के रूप में साइन इन हैं।" : "You are signed in as an explorer."} <Link href={`/login/verify-phone?next=${encodeURIComponent(next)}`}>{hi ? "अपना ईमेल या मोबाइल सत्यापित करें" : "Verify your email or mobile"}</Link></p>
        ) : (
          <PhoneOtpForm next={next} linking={false} lang={lang} />
        )}
      </section>

      <section className="card p-6" aria-labelledby="explore-h">
        <h2 id="explore-h" className="text-xl font-bold mb-1">{hi ? "केवल खोजना चाहते हैं?" : "Just exploring?"}</h2>
        <p className="text-ink-2 mb-4">{hi ? "Google से साइन इन करके योजनाएँ सहेजें, या बिना खाते के अतिथि के रूप में देखें। एक्सप्लोरर आवेदन शुरू नहीं कर सकते।" : "Sign in with Google to save schemes, or browse as a guest without an account. Explorers cannot start applications."}</p>
        <div className="space-y-4">
          {googleId ? (
            <GoogleButton clientId={googleId} next={next.startsWith("/admin") ? "/schemes" : next} />
          ) : devMode ? (
            <form action={devGoogleSignInAction} className="space-y-2 card p-3 border-dashed bg-surface-2">
              <p className="text-sm"><strong>Development mode:</strong> GOOGLE_CLIENT_ID is not set, so this simulates Google sign-in with an email you type. It is disabled in production.</p>
              <input type="hidden" name="next" value="/schemes" />
              <div className="field">
                <label htmlFor="gemail">Email</label>
                <input id="gemail" name="email" type="email" required placeholder="explorer@example.test" />
              </div>
              <button className="btn">Continue with Google (mock)</button>
            </form>
          ) : null}
          <Link href="/schemes" className="btn">{hi ? "अतिथि के रूप में जारी रखें" : "Continue as guest"}</Link>
        </div>
      </section>
    </div>
  );
}

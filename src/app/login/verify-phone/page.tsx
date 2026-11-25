import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { requireUser } from "@/lib/auth/session";
import { PhoneOtpForm } from "@/components/PhoneOtpForm";
import { isApplicant } from "@/lib/auth/roles";

export const metadata = { title: "Verify your email or mobile" };

export default async function VerifyPhonePage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next = "/dashboard", error } = await searchParams;
  const user = await requireUser("/login/verify-phone");
  if (isApplicant(user)) redirect(next);
  const { lang } = await getT();
  const hi = lang === "hi";
  return (
    <section className="card p-6 max-w-xl">
      <h1 className="text-2xl font-bold mb-1">{hi ? "आवेदक बनने के लिए ईमेल या मोबाइल सत्यापित करें" : "Verify your email or mobile to become an applicant"}</h1>
      <p className="text-ink-2 mb-4">
        {hi
          ? "पूरी प्रोफ़ाइल, दस्तावेज़ तिजोरी, आवेदन चेकलिस्ट और रिमाइंडर के लिए OTP से सत्यापित ईमेल या मोबाइल आवश्यक है। आपका Google साइन-इन जुड़ा रहेगा।"
          : "An OTP-verified email or mobile number is required for a complete profile, the document vault, application checklists and reminders. Your Google sign-in stays linked."}
      </p>
      {error === "merge" && <p role="alert" className="text-bad mb-3">The merge link expired or was not confirmed. Please try again.</p>}
      <PhoneOtpForm next={next} linking lang={lang} />
    </section>
  );
}

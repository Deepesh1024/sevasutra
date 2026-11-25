"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { otpFlowAction, confirmMergeAction, type OtpState } from "@/app/actions/auth";

export function PhoneOtpForm({ next, linking, lang, defaultChannel = "email" }: { next: string; linking: boolean; lang: "en" | "hi"; defaultChannel?: "email" | "phone" }) {
  const router = useRouter();
  const [channel, setChannel] = useState<"email" | "phone">(defaultChannel);
  const [state, action, pending] = useActionState<OtpState, FormData>(otpFlowAction, { stage: "phone" });
  const requestAction = action;
  const verifyAction = action;
  const requesting = pending;
  const verifying = pending;
  const hi = lang === "hi";

  useEffect(() => {
    if (state.stage === "done") router.push(state.next);
  }, [state, router]);

  if (state.stage === "conflict") {
    return (
      <form action={confirmMergeAction} className="space-y-3">
        <div role="alert" className="card p-4 bg-warn-soft text-ink">
          <p className="font-semibold">{hi ? "यह पहचान (मोबाइल/ईमेल) पहले से दूसरे सेवासूत्र खाते से जुड़ी है" : "This mobile number or email already belongs to another SevaSutra account"} ({state.maskedPhone}).</p>
          <p className="text-sm mt-1">{hi ? "आप अपने Google साइन-इन को उस खाते में जोड़ सकते हैं। आपकी सहेजी गई योजनाएँ स्थानांतरित होंगी और यह एक्सप्लोरर खाता बंद हो जाएगा।" : "You can move your Google sign-in to that account. Your saved schemes will be moved and this explorer account will be closed."}</p>
        </div>
        <input type="hidden" name="mergeToken" value={state.mergeToken} />
        <label className="flex gap-2 items-start">
          <input type="checkbox" name="confirm" required className="mt-1.5 w-5 h-5" />
          <span>{hi ? "मैं पुष्टि करता/करती हूँ कि दोनों खाते मेरे हैं और उन्हें जोड़ना चाहता/चाहती हूँ।" : "I confirm both accounts are mine and I want to combine them."}</span>
        </label>
        <div className="flex gap-2">
          <button className="btn btn-primary">{hi ? "खाते जोड़ें" : "Combine accounts"}</button>
          <a href="/dashboard" className="btn">{hi ? "रद्द करें" : "Cancel"}</a>
        </div>
      </form>
    );
  }

  if (state.stage === "code") {
    return (
      <form action={verifyAction} className="space-y-4" aria-describedby="otp-help">
        <input type="hidden" name="next" value={next} />
        <input type="hidden" name="step" value="verify" />
        <input type="hidden" name="channel" value={state.channel} />
        <p id="otp-help">{hi ? "हमने " : "We sent a 6-digit code to "}<strong className="text-primary">{state.phone}</strong>{hi ? " पर 6 अंकों का कोड भेजा है। यह 5 मिनट तक मान्य है।" : ". It is valid for 5 minutes. Not your address? Use “Change number” below."}{state.channel === "email" && (hi ? " स्पैम फ़ोल्डर भी देखें।" : " Check your spam folder too.")}</p>
        {state.devCode && (
          <div className="card p-3 border-dashed bg-surface-2 text-sm" role="note">
            <strong>Development mode:</strong> no {state.channel === "email" ? "mail server" : "SMS provider"} is configured, so the code is shown here instead: <code className="font-mono text-base">{state.devCode}</code>
          </div>
        )}
        <div className="field">
          <label htmlFor="code">{hi ? "OTP कोड" : "One-time code"}</label>
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required aria-invalid={!!state.error} aria-describedby={state.error ? "otp-err" : undefined} className="font-mono tracking-[0.3em] text-lg max-w-[12rem]" />
        </div>
        {state.error && <p id="otp-err" role="alert" className="text-bad font-semibold">{state.error}</p>}
        <p className="help">{hi ? "सेवासूत्र कभी भी आपसे यह कोड चैट या फ़ोन पर नहीं माँगेगा।" : "SevaSutra will never ask you for this code in chat or on a call."}</p>
        <div className="flex gap-2">
          <button className="btn btn-primary" disabled={verifying}>{verifying ? "…" : hi ? "सत्यापित करें" : "Verify"}</button>
          <button className="btn" name="step" value="reset" formNoValidate>{hi ? "नंबर बदलें" : "Change number"}</button>
        </div>
      </form>
    );
  }

  return (
    <form action={requestAction} className="space-y-4">
      <input type="hidden" name="linking" value={linking ? "1" : "0"} />
      <input type="hidden" name="step" value="request" />
      <input type="hidden" name="channel" value={channel} />
      <fieldset className="flex gap-1" aria-label={hi ? "कोड कहाँ भेजें" : "Where to send the code"}>
        <button type="button" className={`btn btn-sm ${channel === "email" ? "btn-primary" : ""}`} aria-pressed={channel === "email"} onClick={() => setChannel("email")}>{hi ? "ईमेल" : "Email"}</button>
        <button type="button" className={`btn btn-sm ${channel === "phone" ? "btn-primary" : ""}`} aria-pressed={channel === "phone"} onClick={() => setChannel("phone")}>{hi ? "मोबाइल" : "Mobile"}</button>
      </fieldset>
      {channel === "email" ? (
        <div className="field">
          <label htmlFor="email">{hi ? "ईमेल पता" : "Email address"}</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="max-w-sm" aria-describedby="email-help" />
          <p id="email-help" className="help mt-1">{hi ? "हम आपको 6 अंकों का कोड ईमेल करेंगे। सत्यापन केवल यह साबित करता है कि ईमेल आपका है — पात्रता का प्रमाण नहीं।" : "We'll email you a 6-digit code. Verification only proves the inbox is yours — it is not proof of eligibility."}</p>
        </div>
      ) : (
        <div className="field">
          <label htmlFor="phone">{hi ? "भारतीय मोबाइल नंबर" : "Indian mobile number"}</label>
          <div className="flex items-center gap-2">
            <span className="font-mono text-ink-2" aria-hidden>+91</span>
            <input id="phone" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" required aria-describedby="phone-help" className="max-w-xs" />
          </div>
          <p id="phone-help" className="help mt-1">{hi ? "OTP सत्यापन केवल यह साबित करता है कि नंबर आपका है — यह किसी योजना की पात्रता का प्रमाण नहीं है।" : "OTP verification only proves this number is yours — it is not proof of eligibility for any scheme."}</p>
        </div>
      )}
      {linking && (
        <label className="flex gap-2 items-start">
          <input type="checkbox" name="confirmLink" className="mt-1.5 w-5 h-5" />
          <span>{hi ? "मैं इसे अपने मौजूदा खाते से जोड़ना चाहता/चाहती हूँ।" : `I want to link this ${channel === "email" ? "email address" : "mobile number"} to my current account.`}</span>
        </label>
      )}
      {state.stage === "phone" && state.error && <p role="alert" className="text-bad font-semibold">{state.error}</p>}
      <button className="btn btn-primary" disabled={requesting}>{requesting ? "…" : hi ? "कोड भेजें" : "Send code"}</button>
    </form>
  );
}

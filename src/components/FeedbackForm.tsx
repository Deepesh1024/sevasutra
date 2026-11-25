"use client";

import { useActionState } from "react";
import { feedbackAction, type FeedbackState } from "@/app/actions/schemes";

export function FeedbackForm({ schemeId, lang }: { schemeId?: string; lang: "en" | "hi" }) {
  const [state, action, pending] = useActionState<FeedbackState, FormData>(feedbackAction, {});
  const hi = lang === "hi";
  if (state.ok) return <p role="status" className="text-ok font-semibold">{hi ? "धन्यवाद। एक क्यूरेटर इसकी समीक्षा करेगा।" : "Thank you. A curator will review this."}</p>;
  return (
    <form action={action} className="space-y-2">
      {schemeId && <input type="hidden" name="schemeId" value={schemeId} />}
      <div className="field">
        <label htmlFor="fb-kind">{hi ? "समस्या का प्रकार" : "What kind of problem?"}</label>
        <select id="fb-kind" name="kind" defaultValue="outdated">
          <option value="outdated">{hi ? "पुरानी जानकारी" : "Outdated information"}</option>
          <option value="incorrect">{hi ? "ग़लत जानकारी" : "Incorrect information"}</option>
          <option value="question">{hi ? "प्रश्न" : "Question"}</option>
          <option value="other">{hi ? "अन्य" : "Other"}</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="fb-msg">{hi ? "विवरण" : "Details"}</label>
        <textarea id="fb-msg" name="message" rows={3} required maxLength={2000} aria-describedby="fb-help" />
        <p id="fb-help" className="help">{hi ? "कृपया आधार, बैंक या OTP जैसी निजी जानकारी न लिखें।" : "Please don't include Aadhaar, bank details, OTPs or other personal information."}</p>
      </div>
      {state.error && <p role="alert" className="text-bad">{state.error}</p>}
      <button className="btn" disabled={pending}>{hi ? "भेजें" : "Send report"}</button>
    </form>
  );
}

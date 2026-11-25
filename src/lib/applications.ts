import type { Localized } from "@/lib/engine/types";
import type { SchemeContent } from "@/lib/schemes/types";

export const APP_STATES = [
  "not_started", "checklist_in_progress", "ready_to_apply", "redirected", "submitted_externally",
  "reference_received", "under_verification", "approved", "rejected", "withdrawn", "unknown",
] as const;
export type AppState = (typeof APP_STATES)[number];

export const APP_STATE_LABEL: Record<AppState, Localized> = {
  not_started: { en: "Not started", hi: "शुरू नहीं" },
  checklist_in_progress: { en: "Preparing checklist", hi: "चेकलिस्ट तैयार हो रही है" },
  ready_to_apply: { en: "Ready to apply", hi: "आवेदन हेतु तैयार" },
  redirected: { en: "Opened official portal", hi: "आधिकारिक पोर्टल खोला" },
  submitted_externally: { en: "You submitted on the official portal", hi: "आपने आधिकारिक पोर्टल पर जमा किया" },
  reference_received: { en: "Reference number received", hi: "संदर्भ संख्या प्राप्त" },
  under_verification: { en: "Under verification (as you reported)", hi: "सत्यापन में (आपके अनुसार)" },
  approved: { en: "Approved (as you reported)", hi: "स्वीकृत (आपके अनुसार)" },
  rejected: { en: "Rejected (as you reported)", hi: "अस्वीकृत (आपके अनुसार)" },
  withdrawn: { en: "Withdrawn", hi: "वापस लिया" },
  unknown: { en: "Status unknown", hi: "स्थिति अज्ञात" },
};

/** States a user may set themselves (statuses after submission come from the official portal; the user reports them). */
export const USER_SETTABLE: AppState[] = ["submitted_externally", "reference_received", "under_verification", "approved", "rejected", "withdrawn", "unknown"];

export const APPLIED_STATES: AppState[] = ["submitted_externally", "reference_received", "under_verification", "approved", "rejected"];

export interface Checklist {
  docs?: Record<string, boolean>;
  steps?: Record<string, boolean>;
}

export function checklistProgress(c: SchemeContent, cl: Checklist, vaultDocs: string[]) {
  const reqDocs = c.documents.filter((d) => d.required);
  const docDone = reqDocs.filter((d) => cl.docs?.[d.type] || [d.type, ...(d.alternatives ?? [])].some((t) => vaultDocs.includes(t)));
  const stepsDone = c.application.steps.filter((_, i) => cl.steps?.[String(i)]);
  const total = reqDocs.length + c.application.steps.length;
  const done = docDone.length + stepsDone.length;
  return { done, total, pct: total ? Math.round((done / total) * 100) : 100, docsReady: docDone.length === reqDocs.length };
}

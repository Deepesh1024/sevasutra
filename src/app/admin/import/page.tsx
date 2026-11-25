import { requireStaff } from "@/lib/auth/session";
import { ExtractForm } from "./ExtractForm";
import { importSchemeAction } from "@/app/actions/admin";
import { Flash } from "../Flash";
import { SCHEMES } from "@/lib/schemes/data";

export const metadata = { title: "Import scheme" };

export default async function ImportPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  await requireStaff(["admin", "support"], "/admin/import");
  const sp = await searchParams;
  const template = { ...SCHEMES[1].content, schemeId: "new-scheme-id", name: { en: "New scheme name", hi: "" }, aliases: [], coverageFlags: ["seed_unverified"] };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Import a scheme</h1>
      <Flash sp={sp} />
      <section className="card p-4 space-y-2">
        <h2 className="font-bold text-lg">1. Extract candidate fields from the official guideline</h2>
        <p className="text-sm text-ink-2">Paste the guideline text (copy from the official PDF). SevaSutra suggests ages, income limits, amounts, dates and URLs with the sentence they came from. These are suggestions only — a curator writes the rule.</p>
        <ExtractForm />
      </section>
      <section className="card p-4 space-y-2">
        <h2 className="font-bold text-lg">2. Create the draft</h2>
        <p className="text-sm text-ink-2">Edit this canonical scheme record (template shown), then create a draft. You can then use the visual rule builder, add tests, and submit for review.</p>
        <form action={importSchemeAction} className="space-y-2">
          <textarea name="content" rows={20} className="input font-mono text-xs" defaultValue={JSON.stringify(template, null, 2)} />
          <button className="btn btn-primary">Create draft</button>
        </form>
      </section>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { regressionFor } from "@/lib/admin/publish";
import { RuleBuilder } from "../../RuleBuilder";
import { Flash } from "../../Flash";
import { Pill, fmtDate } from "@/components/ui";
import { FIELDS } from "@/lib/profile/fields";
import { evaluate } from "@/lib/engine/evaluate";
import { evaluable } from "@/lib/schemes/repo";
import { specToFacts } from "@/lib/schemes/testing";
import type { SchemeContent, TestCaseSpec } from "@/lib/schemes/types";
import type { RuleDefinition } from "@/lib/engine/types";
import { addTestCaseAction, markVerifiedAction, publishAction, rejectVersionAction, saveDraftAction, submitForReviewAction } from "@/app/actions/admin";

export default async function VersionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string; profile?: string }> }) {
  const user = await requireStaff(["admin", "support"], "/admin/schemes");
  const { id } = await params;
  const sp = await searchParams;
  const v = await db.schemeVersion.findUnique({ where: { id }, include: { rule: true, scheme: true } });
  if (!v) notFound();
  const c = v.content as unknown as SchemeContent;
  const { content: _omit, ...rest } = { content: null, ...c };
  void _omit;
  const editable = v.status === "draft";
  const suite = await regressionFor(id);
  const cases = await db.ruleTestCase.findMany({ where: { schemeId: v.schemeId }, orderBy: { createdAt: "asc" } });
  const facts = [{ key: "age", label: "age (derived)" }, ...FIELDS.map((f) => ({ key: f.key, label: f.key }))];

  // Preview: evaluate this version against a chosen test profile.
  const previewCase = cases.find((x) => x.id === sp.profile) ?? cases[0];
  const preview = previewCase ? evaluate(evaluable(v), specToFacts((previewCase.facts as unknown as TestCaseSpec).facts), { documents: (previewCase.facts as unknown as TestCaseSpec).documents ?? c.documents.map((d) => d.type), now: new Date((previewCase.facts as unknown as TestCaseSpec).now ?? Date.now()) }) : null;

  const contentForEditor = { ...rest };
  delete (contentForEditor as Partial<SchemeContent>).rule;

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <nav className="text-sm"><Link href="/admin/schemes">Schemes</Link> › <Link href={`/admin/schemes/${v.schemeId}`}>{v.name}</Link></nav>
        <h1 className="text-2xl font-bold">{v.name} — v{v.version} <Pill tone={v.status === "published" ? "ok" : v.status === "in_review" ? "review" : "muted"}>{v.status}</Pill> {v.scheme.highImpact && <Pill tone="review">high impact: dual review</Pill>}</h1>
        <p className="text-sm text-ink-2">Rule hash <code>{v.rule?.ruleHash}</code> · effective {fmtDate(v.rule?.effectiveFrom)} · last verified {v.lastVerifiedAt ? fmtDate(v.lastVerifiedAt) : "never"} · {v.status === "published" ? "Published versions are immutable — create a new draft to change anything." : ""}</p>
      </header>
      <Flash sp={sp} />

      <section className="card p-4 space-y-2" aria-labelledby="reg-h">
        <h2 id="reg-h" className="font-bold text-lg">Regression tests: <span className={suite.failed ? "text-bad" : "text-ok"}>{suite.passed} passed, {suite.failed} failed</span></h2>
        <details open={suite.failed > 0}>
          <summary className="cursor-pointer text-sm">Show {suite.runs.length} cases</summary>
          <table className="w-full text-sm mt-2">
            <thead><tr className="text-left border-b border-line"><th className="p-1">Case</th><th className="p-1">Kind</th><th className="p-1">Expected</th><th className="p-1">Actual</th><th className="p-1"></th></tr></thead>
            <tbody>{suite.runs.map((r, i) => (
              <tr key={i} className={`border-b border-line ${r.passed ? "" : "bg-bad-soft"}`}><td className="p-1">{r.name}</td><td className="p-1">{r.kind}</td><td className="p-1">{r.expected}</td><td className="p-1">{r.actual}</td><td className="p-1">{r.passed ? "✓" : `✕ ${r.detail ?? ""}`}</td></tr>
            ))}</tbody>
          </table>
        </details>
        <details>
          <summary className="cursor-pointer text-sm font-semibold">Add a test case</summary>
          <form action={addTestCaseAction} className="grid gap-2 md:grid-cols-2 mt-2">
            <input type="hidden" name="versionId" value={id} />
            <div className="field"><label htmlFor="tn">Name</label><input id="tn" name="name" required /></div>
            <div className="field"><label htmlFor="tk">Kind</label><select id="tk" name="kind">{["eligible", "ineligible", "boundary_age", "boundary_income", "missing_document", "conflicting_document", "expired_deadline", "state_mismatch", "other"].map((k) => <option key={k}>{k}</option>)}</select></div>
            <div className="field md:col-span-2"><label htmlFor="tf">Facts (JSON)</label><textarea id="tf" name="facts" className="font-mono text-xs" rows={4} defaultValue={'{ "date_of_birth": "1990-01-01", "has_bank_account": true }'} /></div>
            <div className="field"><label htmlFor="te">Expected status</label><select id="te" name="expected">{["eligible", "partially_eligible", "not_eligible", "expired_or_closed", "needs_manual_review"].map((k) => <option key={k}>{k}</option>)}</select></div>
            <button className="btn self-end">Add test</button>
          </form>
        </details>
      </section>

      {preview && (
        <section className="card p-4 space-y-2" aria-labelledby="prev-h">
          <h2 id="prev-h" className="font-bold text-lg">Preview against a test profile</h2>
          <form method="get" className="flex gap-2 items-end"><div className="field"><label htmlFor="pp">Test profile</label><select id="pp" name="profile" defaultValue={previewCase!.id}>{cases.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div><button className="btn">Preview</button></form>
          <p><strong>{preview.status}</strong> — {preview.headline.en}</p>
          <ul className="text-sm list-disc pl-5">{preview.leaves.filter((l) => l.decisive).map((l) => <li key={l.id}>[{l.outcome}] {l.explanation.en}</li>)}</ul>
        </section>
      )}

      <form action={saveDraftAction} className="card p-4 space-y-4" aria-labelledby="ed-h">
        <h2 id="ed-h" className="font-bold text-lg">{editable ? "Edit draft" : "Content (read-only)"}</h2>
        <input type="hidden" name="id" value={id} />
        <div className="field"><label htmlFor="cn">Change note (required to publish — what changed and why, with the source section)</label><input id="cn" name="changeNote" defaultValue={v.changeNote ?? ""} disabled={!editable} maxLength={500} /></div>
        <div>
          <h3 className="font-semibold mb-1">Eligibility rule (visual builder)</h3>
          <RuleBuilder initial={(v.rule?.definition as unknown as RuleDefinition) ?? c.rule} facts={facts} readOnly={!editable} />
        </div>
        <div className="field">
          <label htmlFor="content">Scheme record (JSON: names, summary, benefit basis, documents, application, sources, translations…)</label>
          <textarea id="content" name="content" className="font-mono text-xs h-96" defaultValue={JSON.stringify({ ...contentForEditor, rule: c.rule }, null, 2)} readOnly={!editable} />
          <p className="help">The rule in this JSON is replaced by the visual builder on save. Hindi text goes in the <code>hi</code> keys (Translations).</p>
        </div>
        {editable && <button className="btn btn-primary">Save draft</button>}
      </form>

      <section className="card p-4 flex flex-wrap gap-2 items-center" aria-label="Workflow">
        {v.status === "draft" && <form action={submitForReviewAction}><input type="hidden" name="id" value={id} /><button className="btn">Submit for review</button></form>}
        {v.status === "in_review" && user.role === "admin" && (
          <>
            <form action={publishAction}><input type="hidden" name="id" value={id} /><button className="btn btn-primary" disabled={suite.failed > 0}>Approve & publish</button></form>
            <form action={rejectVersionAction} className="flex gap-2"><input type="hidden" name="id" value={id} /><input name="note" placeholder="Reason" className="input max-w-xs" /><button className="btn">Return to draft</button></form>
          </>
        )}
        {v.status === "published" && user.role === "admin" && <form action={markVerifiedAction}><input type="hidden" name="id" value={id} /><button className="btn">Mark verified against official source today</button></form>}
        <p className="text-sm text-ink-2 w-full">Publishing requires: status in review, a change note, all regression tests passing, and — for high-impact schemes — an approving admin who is not the author. Previous versions stay available so old evaluations remain reproducible.</p>
      </section>
    </div>
  );
}

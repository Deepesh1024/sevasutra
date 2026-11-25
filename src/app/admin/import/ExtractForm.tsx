"use client";

import { useActionState } from "react";
import { extractAction, type ExtractState } from "@/app/actions/admin";

export function ExtractForm() {
  const [state, action, pending] = useActionState<ExtractState, FormData>(extractAction, {});
  return (
    <div className="space-y-2">
      <form action={action} className="space-y-2">
        <label htmlFor="gtext" className="label">Guideline text</label>
        <textarea id="gtext" name="text" rows={8} className="input font-mono text-xs" defaultValue={state.text ?? ""} placeholder="Paste guideline text here…" />
        <button className="btn" disabled={pending}>Extract candidates</button>
      </form>
      {state.candidates && (state.candidates.length === 0 ? <p>No candidates found.</p> : (
        <table className="w-full text-sm">
          <thead><tr className="text-left border-b border-line"><th className="p-1">Suggested field</th><th className="p-1">Value</th><th className="p-1">Evidence</th></tr></thead>
          <tbody>{state.candidates.map((c, i) => <tr key={i} className="border-b border-line align-top"><td className="p-1">{c.field}</td><td className="p-1 font-mono">{c.value}</td><td className="p-1 text-ink-2">…{c.evidence}…</td></tr>)}</tbody>
        </table>
      ))}
    </div>
  );
}

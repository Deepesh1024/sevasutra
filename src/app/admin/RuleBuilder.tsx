"use client";

import { useState } from "react";
import type { RuleDefinition, RuleNode, FactLeaf, Op } from "@/lib/engine/types";

const OPS: Op[] = ["eq", "neq", "in", "not_in", "gte", "gt", "lte", "lt", "between", "is_true", "is_false", "exists", "contains", "not_contains"];
type Path = number[];

function setAt(n: RuleNode, p: Path, v: RuleNode | null): RuleNode {
  if (!p.length) return v!;
  const [h, ...rest] = p;
  if ("all" in n) { const kids = [...n.all]; if (rest.length === 0 && v === null) kids.splice(h, 1); else kids[h] = setAt(kids[h], rest, v); return { ...n, all: kids }; }
  if ("any" in n) { const kids = [...n.any]; if (rest.length === 0 && v === null) kids.splice(h, 1); else kids[h] = setAt(kids[h], rest, v); return { ...n, any: kids }; }
  if ("not" in n) return { ...n, not: setAt(n.not, rest, v) };
  return n;
}

let counter = 0;
const newLeaf = (): FactLeaf => ({ id: `new_${Date.now().toString(36)}_${counter++}`, fact: "age", op: "gte", value: 18, label: { en: "New condition", hi: "" } });

/** Visual editor for the declarative rule tree; writes JSON into a hidden `rule` field. */
export function RuleBuilder({ initial, facts, readOnly }: { initial: RuleDefinition; facts: { key: string; label: string }[]; readOnly?: boolean }) {
  const [rule, setRule] = useState<RuleDefinition>(initial);
  const update = (p: Path, v: RuleNode | null) => setRule((r) => ({ ...r, mandatory: setAt(r.mandatory, p, v) }));

  function NodeView({ node, path }: { node: RuleNode; path: Path }) {
    const depth = path.length;
    const box = `border-l-2 pl-3 ${depth % 2 ? "border-primary" : "border-line"}`;
    if ("all" in node || "any" in node) {
      const kind = "all" in node ? "all" : "any";
      const kids = "all" in node ? node.all : node.any;
      return (
        <div className={`${box} space-y-2 py-1`}>
          <div className="flex flex-wrap gap-2 items-center">
            <select aria-label="Group type" value={kind} disabled={readOnly} onChange={(e) => update(path, e.target.value === "all" ? { all: kids } : { any: kids })} className="input max-w-[16rem]">
              <option value="all">ALL of these must hold</option>
              <option value="any">ANY one of these must hold</option>
            </select>
            {!readOnly && <>
              <button type="button" className="btn btn-sm" onClick={() => update(path, { ...node, [kind]: [...kids, newLeaf()] } as RuleNode)}>+ condition</button>
              <button type="button" className="btn btn-sm" onClick={() => update(path, { ...node, [kind]: [...kids, { any: [newLeaf()] }] } as RuleNode)}>+ group</button>
              <button type="button" className="btn btn-sm" onClick={() => update(path, { ...node, [kind]: [...kids, { not: newLeaf() }] } as RuleNode)}>+ exclusion</button>
              {depth > 0 && <button type="button" className="btn btn-sm btn-danger" onClick={() => update(path, null)}>remove group</button>}
            </>}
          </div>
          {kids.map((k, i) => <NodeView key={i} node={k} path={[...path, i]} />)}
        </div>
      );
    }
    if ("not" in node) {
      return (
        <div className={`${box} py-1`}>
          <p className="text-sm font-semibold text-bad">EXCLUDED if:</p>
          <NodeView node={node.not} path={[...path, 0]} />
          {!readOnly && <button type="button" className="btn btn-sm btn-danger mt-1" onClick={() => update(path, null)}>remove exclusion</button>}
        </div>
      );
    }
    if ("doc" in node) return <p className={box}>Document present: <code>{node.doc}</code></p>;
    const leaf = node as FactLeaf;
    const set = (patch: Partial<FactLeaf>) => update(path, { ...leaf, ...patch });
    return (
      <div className={`${box} grid gap-2 md:grid-cols-[10rem_9rem_1fr] items-start py-1`}>
        <select aria-label="Fact" value={leaf.fact} disabled={readOnly} onChange={(e) => set({ fact: e.target.value })} className="input">
          {facts.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
        <select aria-label="Operator" value={leaf.op} disabled={readOnly} onChange={(e) => set({ op: e.target.value as Op })} className="input">
          {OPS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <input aria-label="Value (JSON)" className="input font-mono" disabled={readOnly || ["is_true", "is_false", "exists"].includes(leaf.op)} defaultValue={leaf.value === undefined ? "" : JSON.stringify(leaf.value)}
          onBlur={(e) => { try { set({ value: e.target.value === "" ? undefined : JSON.parse(e.target.value) }); } catch { e.target.setCustomValidity("Must be JSON, e.g. 18, \"female\", [\"sc\",\"st\"]"); e.target.reportValidity(); } }} />
        <input aria-label="Explanation (English)" className="input md:col-span-2" disabled={readOnly} defaultValue={leaf.label.en} onBlur={(e) => set({ label: { ...leaf.label, en: e.target.value } })} />
        <input aria-label="Explanation (Hindi)" lang="hi" className="input" disabled={readOnly} defaultValue={leaf.label.hi ?? ""} placeholder="हिन्दी" onBlur={(e) => set({ label: { ...leaf.label, hi: e.target.value } })} />
        <div className="md:col-span-3 flex gap-3 text-sm items-center">
          <code className="text-ink-2">{leaf.id}</code>
          <label className="inline-flex gap-1 items-center"><input type="checkbox" disabled={readOnly} checked={!!leaf.requireVerified} onChange={(e) => set({ requireVerified: e.target.checked })} /> requires verified evidence</label>
          {!readOnly && <button type="button" className="text-bad underline" onClick={() => update(path, null)}>remove</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <NodeView node={rule.mandatory} path={[]} />
      <div className="grid gap-2 md:grid-cols-2">
        <label className="text-sm">Reference date
          <select className="input" disabled={readOnly} value={rule.referenceDate ?? "today"} onChange={(e) => setRule({ ...rule, referenceDate: e.target.value })}>
            <option value="today">today</option><option value="academic_year_start">academic_year_start (1 April)</option>
          </select>
        </label>
        <label className="text-sm flex items-center gap-2 mt-5"><input type="checkbox" disabled={readOnly} checked={!!rule.ambiguous} onChange={(e) => setRule({ ...rule, ambiguous: e.target.checked ? { note: { en: "The guideline is ambiguous; results need manual review." } } : undefined })} /> Guideline is ambiguous → every result needs manual review</label>
      </div>
      <details><summary className="cursor-pointer text-sm font-semibold">Rule JSON (exceptions, caveats, advanced)</summary>
        <textarea name="rule" className="input font-mono text-xs h-64" value={JSON.stringify(rule, null, 2)} readOnly={readOnly} onChange={(e) => { try { setRule(JSON.parse(e.target.value)); } catch { /* keep typing */ } }} />
      </details>
      {readOnly && <input type="hidden" name="rule" value={JSON.stringify(rule)} />}
    </div>
  );
}

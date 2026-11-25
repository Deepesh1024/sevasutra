export function Flash({ sp }: { sp: { ok?: string; err?: string } }) {
  if (sp.ok) return <p role="status" className="card p-3 bg-ok-soft text-ok font-semibold">{sp.ok}</p>;
  if (sp.err) return <p role="alert" className="card p-3 bg-bad-soft text-bad font-semibold">{sp.err}</p>;
  return null;
}

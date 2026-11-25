// Minimal line diff (LCS) for comparing scheme versions in the admin console.
export type DiffLine = { kind: "same" | "add" | "del"; text: string };

export function pretty(v: unknown): string {
  const sort = (x: unknown): unknown =>
    Array.isArray(x) ? x.map(sort) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x as object).sort().map((k) => [k, sort((x as Record<string, unknown>)[k])])) : x;
  return JSON.stringify(sort(v), null, 2);
}

export function diffLines(a: string, b: string): DiffLine[] {
  const A = a.split("\n");
  const B = b.split("\n");
  const n = A.length, m = B.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { out.push({ kind: "same", text: A[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) out.push({ kind: "del", text: A[i++] });
    else out.push({ kind: "add", text: B[j++] });
  }
  while (i < n) out.push({ kind: "del", text: A[i++] });
  while (j < m) out.push({ kind: "add", text: B[j++] });
  return out;
}

/** Collapse unchanged runs to a few lines of context. */
export function withContext(lines: DiffLine[], ctx = 2): (DiffLine | { kind: "gap"; text: string })[] {
  const keep = new Set<number>();
  lines.forEach((l, i) => { if (l.kind !== "same") for (let k = i - ctx; k <= i + ctx; k++) keep.add(k); });
  const out: (DiffLine | { kind: "gap"; text: string })[] = [];
  let skipped = 0;
  lines.forEach((l, i) => {
    if (keep.has(i)) { if (skipped) { out.push({ kind: "gap", text: `… ${skipped} unchanged lines` }); skipped = 0; } out.push(l); }
    else skipped++;
  });
  if (skipped) out.push({ kind: "gap", text: `… ${skipped} unchanged lines` });
  return out;
}

import "server-only";

// LLM provider abstraction. The model only ever explains retrieved sources, a rule-engine result, or
// classifies OCR text of an uploaded document; it never decides eligibility. Raw prompts are not stored.

export type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };
export interface ChatMsg { role: "system" | "user" | "assistant"; content: string | ContentPart[] }
export interface CompleteOpts { maxTokens?: number; temperature?: number; json?: boolean }
export interface LlmProvider { name: string; model: string; complete(messages: ChatMsg[], opts?: CompleteOpts): Promise<string> }

export class RateLimitError extends Error {
  constructor(public retryAfterMs: number) {
    super("rate_limited");
  }
}

/** Remove any chain-of-thought a reasoning model leaks into the answer. */
export function stripReasoning(s: string): string {
  return s.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/^[\s\S]*?<\/think>/i, "").trim();
}

class GroqProvider implements LlmProvider {
  name = "groq";
  constructor(private key: string, public model: string) {}
  async complete(messages: ChatMsg[], opts: CompleteOpts = {}) {
    // Free-tier rate limits (429) are common with images: wait as Groq asks (max 3 tries, ≤ 15 s each).
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.once(messages, opts);
      } catch (e) {
        const wait = e instanceof RateLimitError ? e.retryAfterMs : -1;
        if (wait < 0 || attempt >= 3) throw e;
        await new Promise((r) => setTimeout(r, Math.min(15_000, wait + 250)));
      }
    }
  }

  private async once(messages: ChatMsg[], opts: CompleteOpts) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30_000);
    const reasoning = /gpt-oss/.test(this.model)
      ? { reasoning_effort: "low", include_reasoning: false }
      : /qwen3/.test(this.model)
        ? { reasoning_format: "hidden" }
        : {};
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          messages,
          max_tokens: opts.maxTokens ?? 1200,
          temperature: opts.temperature ?? 0.1,
          ...reasoning,
          ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        }),
        signal: ctrl.signal,
      });
      if (res.status === 429) {
        const body = await res.text();
        const hdr = Number(res.headers.get("retry-after"));
        const m = body.match(/try again in ([\d.]+)(ms|s)/i);
        const ms = m ? Number(m[1]) * (m[2].toLowerCase() === "ms" ? 1 : 1000) : Number.isFinite(hdr) && hdr > 0 ? hdr * 1000 : 5000;
        throw new RateLimitError(ms);
      }
      if (!res.ok) throw new Error(`groq ${res.status}`);
      const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return stripReasoning(j.choices?.[0]?.message?.content ?? "");
    } finally {
      clearTimeout(timer);
    }
  }
}

export function llm(): LlmProvider | null {
  const key = process.env.GROQ_API_KEY;
  if (!key) return null;
  return new GroqProvider(key, process.env.GROQ_MODEL || "qwen/qwen3.8-27b");
}

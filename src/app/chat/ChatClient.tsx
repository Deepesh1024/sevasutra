"use client";

import { useRef, useState, useTransition } from "react";
import { askAction, escalateAction } from "@/app/actions/chat";
import type { ChatAnswer } from "@/lib/chat/assistant";

type Turn = { q: string; a?: ChatAnswer };

export function ChatClient({ lang, llmEnabled }: { lang: "en" | "hi"; llmEnabled: boolean }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, start] = useTransition();
  const [escalated, setEscalated] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hi = lang === "hi";

  function send(q: string) {
    if (!q.trim()) return;
    setTurns((t) => [...t, { q }]);
    start(async () => {
      const a = await askAction(q);
      setTurns((t) => t.map((x, i) => (i === t.length - 1 ? { ...x, a } : x)));
    });
  }

  const examples = hi
    ? ["पीएम-किसान के लिए कौन-से दस्तावेज़ चाहिए?", "क्या मैं अटल पेंशन योजना के लिए पात्र हूँ?", "NMMSS में कितनी राशि मिलती है?"]
    : ["What documents do I need for PM-KISAN?", "Am I eligible for Atal Pension Yojana?", "How much does the Central Sector Scholarship pay?"];

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-2">
        {hi ? "उत्तर केवल स्वीकृत, संस्करणित योजना स्रोतों से आते हैं। " : "Answers come only from approved, versioned scheme sources. "}
        {llmEnabled ? (hi ? "AI केवल स्रोतों और नियम-इंजन के परिणाम को समझाता है।" : "AI only explains the sources and the rule-engine result.") : (hi ? "AI कॉन्फ़िगर नहीं है: स्रोतों के अंश सीधे दिखाए जाते हैं।" : "AI is not configured: matching source excerpts are shown directly.")}
      </p>
      <ol className="space-y-4" aria-live="polite">
        {turns.map((t, i) => (
          <li key={i} className="space-y-2">
            <p className="card p-3 bg-primary-soft ml-auto max-w-[85%]"><span className="sr-only">{hi ? "आपने पूछा" : "You asked"}: </span>{t.q}</p>
            {!t.a ? <p className="text-ink-2">…</p> : (
              <div className={`card p-3 max-w-[95%] space-y-2 ${t.a.refused ? "border-warn" : ""}`}>
                <p className="whitespace-pre-line">{t.a.text}</p>
                {t.a.warnings.map((w, j) => <p key={j} className="text-warn text-sm font-semibold">{w}</p>)}
                {t.a.citations.length > 0 && (
                  <details className="text-sm" open>
                    <summary className="font-semibold cursor-pointer">{hi ? "स्रोत" : "Sources"}</summary>
                    <ul className="space-y-1 mt-1">
                      {t.a.citations.map((c) => (
                        <li key={c.id}>
                          <strong>[{c.id}]</strong> {c.schemeName} — {c.section} · v{c.version} · {hi ? "प्रभावी" : "effective"} {c.effectiveFrom} · {hi ? "सत्यापित" : "verified"}: {c.lastVerified ?? (hi ? "अभी नहीं" : "not yet")}{" "}
                          {c.url && <a href={c.url} target="_blank" rel="noopener noreferrer">{c.title} ↗</a>} {!c.isOfficial && <span className="text-warn">({hi ? "तृतीय-पक्ष" : "third-party"})</span>}
                          <blockquote lang="en" className="border-l-2 border-line pl-2 text-ink-2">{c.excerpt.slice(0, 220)}{c.excerpt.length > 220 ? "…" : ""}</blockquote>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                {t.a.links.filter((l) => l.href.startsWith("/")).map((l) => <a key={l.href} href={l.href} className="btn btn-sm mr-2">{l.label}</a>)}
                <p className="text-xs text-ink-2">{hi ? "केवल जानकारी — आधिकारिक निर्णय नहीं।" : "Information only — not an official decision."} ({t.a.mode})</p>
              </div>
            )}
          </li>
        ))}
      </ol>
      {turns.length === 0 && (
        <div className="flex flex-wrap gap-2">{examples.map((e) => <button key={e} className="btn btn-sm" onClick={() => send(e)}>{e}</button>)}</div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); const v = inputRef.current?.value ?? ""; if (inputRef.current) inputRef.current.value = ""; send(v); }} className="space-y-2">
        <label htmlFor="chat-q" className="label">{hi ? "अपना प्रश्न लिखें" : "Type your question"}</label>
        <textarea id="chat-q" ref={inputRef} rows={2} maxLength={500} className="input" aria-describedby="chat-help" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); (e.currentTarget.form as HTMLFormElement).requestSubmit(); } }} />
        <p id="chat-help" className="help">{hi ? "OTP, पासवर्ड, आधार या बैंक विवरण कभी न लिखें।" : "Never type OTPs, passwords, Aadhaar or bank details."}</p>
        <button className="btn btn-primary" disabled={pending}>{pending ? "…" : hi ? "पूछें" : "Ask"}</button>
      </form>
      <section id="escalate" className="card p-3 text-sm space-y-2">
        <p className="font-semibold">{hi ? "उत्तर से संतुष्ट नहीं?" : "Not satisfied with the answer?"}</p>
        {escalated ? <p className="text-ok">{hi ? "आपका प्रश्न सहायता टीम को भेज दिया गया।" : "Your question was sent to the support team."}</p> : (
          <button className="btn btn-sm" disabled={turns.length === 0} onClick={async () => { const last = turns.at(-1); if (last) { const r = await escalateAction(last.q, last.a?.text ?? ""); setEscalated(r.ok); } }}>{hi ? "सहायता टीम से पूछें" : "Ask a support operator"}</button>
        )}
        <p>{hi ? "या आधिकारिक शिकायत:" : "Or use the official grievance channel:"} <a href="https://pgportal.gov.in" target="_blank" rel="noopener noreferrer">CPGRAMS ↗</a></p>
      </section>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export interface Slide { id: string; eyebrow: string; title: string; text: string; href: string; cta: string; tone: "blue" | "orange" }

const TONES = {
  blue: "linear-gradient(120deg, #0b4f9c 0%, #1565c0 55%, #2f80d8 100%)",
  orange: "linear-gradient(120deg, #c2410c 0%, #e8650a 55%, #f59e0b 100%)",
};

/** Rotating banner of featured schemes. Auto-advances every 6s; pauses on hover/focus, has controls, and stays still for reduced-motion users. */
export function HeroBanner({ slides, labels }: { slides: Slide[]; labels: { prev: string; next: string; pause: string; play: string; slide: string; note: string } }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hover, setHover] = useState(false);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced.current) setPaused(true);
  }, []);
  useEffect(() => {
    if (paused || hover || slides.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [paused, hover, slides.length]);

  if (slides.length === 0) return null;
  const go = (d: number) => setI((x) => (x + d + slides.length) % slides.length);

  return (
    <section
      aria-roledescription="carousel"
      aria-label={labels.slide}
      className="relative overflow-hidden rounded-2xl shadow-sm"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
    >
      <div className="relative min-h-[15rem] md:min-h-[17rem]">
        {slides.map((s, k) => (
          <div
            key={s.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`${k + 1} / ${slides.length}`}
            aria-hidden={k !== i}
            className="hero-slide absolute inset-0 px-6 py-7 md:px-10 md:py-9 text-white flex flex-col justify-center gap-2"
            style={{ background: TONES[s.tone], opacity: k === i ? 1 : 0, transform: k === i ? "translateX(0)" : "translateX(24px)", pointerEvents: k === i ? "auto" : "none" }}
          >
            <p className="uppercase tracking-wide text-xs font-semibold opacity-90">{s.eyebrow}</p>
            <h2 className="text-2xl md:text-3xl font-bold leading-tight max-w-3xl" style={{ color: "#fff" }}>{s.title}</h2>
            <p className="max-w-2xl text-[1.02rem] opacity-95">{s.text}</p>
            <div className="pt-2">
              <Link href={s.href} tabIndex={k === i ? 0 : -1} className="btn bg-white text-ink border-white hover:bg-white">
                {s.cta} →
              </Link>
            </div>
          </div>
        ))}
      </div>
      <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
        <button type="button" className="btn btn-sm bg-white/90" onClick={() => go(-1)} aria-label={labels.prev}>‹</button>
        <button type="button" className="btn btn-sm bg-white/90" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>{paused ? `▶ ${labels.play}` : `❚❚ ${labels.pause}`}</button>
        <button type="button" className="btn btn-sm bg-white/90" onClick={() => go(1)} aria-label={labels.next}>›</button>
      </div>
      <div className="absolute bottom-4 left-6 md:left-10 flex gap-1.5" role="tablist" aria-label={labels.slide}>
        {slides.map((s, k) => (
          <button key={s.id} type="button" role="tab" aria-selected={k === i} aria-label={`${k + 1}: ${s.title}`} onClick={() => setI(k)} className="w-2.5 h-2.5 rounded-full border border-white" style={{ background: k === i ? "#fff" : "transparent" }} />
        ))}
      </div>
      <p className="sr-only" aria-live={paused || hover ? "polite" : "off"}>{slides[i].title}</p>
      <p className="absolute top-3 right-4 text-[0.7rem] text-white/85 hidden md:block">{labels.note}</p>
    </section>
  );
}

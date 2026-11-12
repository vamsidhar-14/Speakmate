import React, { useEffect, useRef, useState } from "react";

/** Words fade in as the user scrolls. Pass your existing paragraph text. */
export function RevealParagraph({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [progress, setProgress] = useState(0);
  const words = text.split(" ");

  useEffect(() => {
    const onScroll = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = (vh * 0.85 - r.top) / (vh * 0.45 + r.height);
      setProgress(Math.min(1, Math.max(0, p)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <p className="aether-reveal" ref={ref}>
      {words.map((w, i) => (
        <span key={i} className={"aether-word" + (i / words.length < progress ? " on" : "")}>
          {w}{" "}
        </span>
      ))}
    </p>
  );
}

/** Two rows of slowly scrolling labels. */
export function Marquee({ chips }: { chips: string[] }) {
  const row = [...chips, ...chips, ...chips, ...chips];
  return (
    <section className="aether-marquee" aria-hidden="true">
      <div className="aether-marquee-row">
        {row.map((c, i) => <span className="aether-chip" key={i}>{c}</span>)}
      </div>
      <div className="aether-marquee-row rev">
        {row.map((c, i) => <span className="aether-chip" key={i}>{c}</span>)}
      </div>
    </section>
  );
}

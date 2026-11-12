# Fluencis + Aether Lane template (paste into Google AI Studio)

Paste **Part 1** first as your message. Then, in the same message or the next one, paste **Part 2** (`src/aether.css`) and **Part 3** (`src/AetherParts.tsx`).

---

## Part 1: The prompt

```
Restyle the PUBLIC LANDING PAGE of my Fluencis app to match a "dreamy lavender cloud" template (frosted-glass pill navbar, cloud-sky hero with a huge gradient headline, purple mist transitions, scroll-reveal paragraph, scrolling chips, soft glass cards). Keep ALL my existing text and features.

STEP 0: Before editing, reply with a short plan listing the exact files and elements you will touch. Then proceed.

STRICT RULES (highest priority):
1. Do NOT change any logic: state, hooks, handlers, routing, auth, API/Gemini calls, socket/server-status code, matching/chat logic, props of existing components, or env/config files.
2. Do NOT touch the logged-in dashboard or any app screens.
3. Do NOT touch or restyle any existing icons or icon libraries (the logo icon, card icons, the palette/theme icon, Chat icon, About icons).
4. Keep the theme/palette button working exactly as it does now. Keep "Server Live", "Chat", "Login", "Join Free" and every nav link, onClick and route unchanged.
5. Keep the two floating widgets ("Peer Chat" bottom-left, "Live Academic AI" bottom-right) exactly as they are, in the same position, always visible on top (do not let new sections cover them).
6. Do NOT edit global styles: no changes to html, body, *, :root, tailwind config or global fonts. All new CSS is scoped under classes starting with `aether-`.
7. Only ADD two files (src/aether.css, src/AetherParts.tsx) and make small edits that ADD className values or wrap existing JSX. Do not delete or rewrite existing sections or copy.
8. Keep my existing wording (Fluencis, the four steps, About text, "Ready to start?" CTA, footer). Do not invent statistics or numbers.
9. If anything conflicts with these rules, stop and ask me.
10. When done, list every file and line area you changed and confirm nothing else was touched.

HOW TO APPLY (landing page only):
A. Wrap the landing page's outermost container in `<div className="aether-root">` (add only the class if a wrapper already exists).
B. NAVBAR: add `aether-nav` to the navbar's outer container, and `aether-nav-link` to Home / How It Works / About. Make it a floating rounded glass bar centered at the top with a small margin from the edges. Keep the logo, STUDENT badge, Server Live, Chat, palette, Login and Join Free as they are (you may add `aether-cta` to Join Free for the soft white-pill look, but keep its handler).
C. HERO (top section): add `aether-hero` to it. Use the cloud-sky gradient background, make the main hero headline use `aether-title`, and any small supporting lines use `aether-taglines` / `aether-blurb`. Keep its buttons and handlers.
D. HOW IT WORKS: add `aether-section-light` to the section, `aether-card` to each of the 4 step cards. Keep the step numbers and icons.
E. ABOUT: add `aether-reveal-section` to the section and replace ONLY the long paragraph ("Fluencis is built exclusively for students...") with `<RevealParagraph text="...the same paragraph text..." />` from AetherParts. Keep the 3 feature columns and their icons unchanged.
F. Add `<Marquee chips={["Engineering Placements","Group Discussions","Mock HR & Technical Interviews","Peer Collaboration"]} />` between the About and CTA sections.
G. CTA ("Ready to start?") and FOOTER: add `aether-section-light` to the CTA section and `aether-footer` to the footer. Keep the Join Fluencis button and its handler.
H. Fonts: do not change my current fonts anywhere, except the hero headline which may use Inter via `aether-title`.
I. Fully responsive; respect prefers-reduced-motion.
```

---

## Part 2: `src/aether.css`

```css
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700&display=swap");

.aether-root {
  --ae-ink: #1c1633;
  --ae-mist: #d9ccf5;
  --ae-lilac: #efe9fb;
  overflow-x: clip;
}

/* ---------- Navbar (class added to existing nav) ---------- */
.aether-nav {
  background: rgba(255, 255, 255, 0.16) !important;
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(255, 255, 255, 0.25) !important;
  border-radius: 999px !important;
  box-shadow: 0 8px 30px rgba(60, 30, 140, 0.25);
  margin: 12px auto 0;
  width: min(calc(100% - 32px), 1280px);
}
.aether-nav-link { opacity: 0.85; transition: opacity 0.2s; }
.aether-nav-link:hover { opacity: 1; }

.aether-cta {
  background: rgba(255, 255, 255, 0.9) !important;
  color: var(--ae-ink) !important;
  border-radius: 999px;
  transition: transform 0.2s ease;
}
.aether-cta:hover { transform: translateY(-1px); }

/* ---------- Hero ---------- */
.aether-hero {
  position: relative;
  isolation: isolate;
  color: #fff;
  background:
    radial-gradient(60% 40% at 20% 15%, rgba(255, 150, 210, 0.55), transparent 70%),
    radial-gradient(55% 40% at 85% 20%, rgba(255, 170, 220, 0.5), transparent 70%),
    radial-gradient(70% 45% at 50% 70%, rgba(150, 120, 255, 0.55), transparent 75%),
    linear-gradient(180deg, #7b8cff 0%, #9b7bff 35%, #c07be0 62%, #6a4bb8 100%) !important;
}
.aether-hero::before {
  content: "";
  position: absolute; inset: 0; z-index: -1;
  background:
    radial-gradient(40% 14% at 15% 62%, rgba(255, 255, 255, 0.55), transparent 70%),
    radial-gradient(38% 12% at 80% 68%, rgba(255, 255, 255, 0.5), transparent 70%),
    radial-gradient(50% 12% at 50% 78%, rgba(255, 230, 250, 0.45), transparent 70%);
  filter: blur(14px);
  animation: ae-drift 24s ease-in-out infinite alternate;
}
.aether-hero::after {
  content: "";
  position: absolute; left: 0; right: 0; bottom: 0; height: 35%; z-index: -1;
  background: linear-gradient(180deg, transparent, var(--ae-mist));
}
@keyframes ae-drift { from { transform: translateX(-2%); } to { transform: translateX(2%); } }

.aether-title {
  font-family: "Inter", system-ui, sans-serif !important;
  font-weight: 700;
  letter-spacing: -0.04em;
  line-height: 0.98;
  font-size: clamp(44px, 10vw, 150px);
  text-align: center;
  background: linear-gradient(180deg, #ffffff 30%, rgba(255, 255, 255, 0.55));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent !important;
}
.aether-taglines { display: flex; justify-content: space-between; gap: 16px; opacity: 0.92; }
.aether-blurb { text-align: center; line-height: 1.6; }

/* ---------- Light lilac sections (cards, CTA) ---------- */
.aether-section-light {
  background: linear-gradient(180deg, var(--ae-mist), var(--ae-lilac) 40%, var(--ae-lilac)) !important;
  color: var(--ae-ink);
}
.aether-section-light :is(h1, h2, h3, h4, p, span, li) { color: inherit; }

.aether-card {
  background: rgba(255, 255, 255, 0.55) !important;
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.7) !important;
  border-radius: 24px !important;
  box-shadow: 0 10px 30px rgba(110, 80, 200, 0.15);
  color: var(--ae-ink);
}
.aether-card :is(h3, h4, p, span) { color: inherit; }

/* ---------- Reveal paragraph ---------- */
.aether-reveal-section {
  background: linear-gradient(180deg, var(--ae-lilac), #b9a2ee 45%, var(--ae-mist)) !important;
  color: #fff;
}
.aether-reveal-section :is(h1, h2, h3, span) { color: #fff; }
.aether-reveal {
  max-width: 760px;
  line-height: 1.35;
  font-size: clamp(20px, 2.6vw, 32px);
  font-weight: 500;
}
.aether-word { opacity: 0.28; transition: opacity 0.25s linear; }
.aether-word.on { opacity: 1; }

/* ---------- Marquee ---------- */
.aether-marquee { background: var(--ae-mist); padding: 32px 0; overflow: hidden; }
.aether-marquee-row { display: flex; width: max-content; gap: 56px; margin: 0 0 16px; animation: ae-scroll 32s linear infinite; }
.aether-marquee-row.rev { animation-direction: reverse; animation-duration: 38s; }
.aether-chip { color: #4b3a8f; font-size: 15px; font-weight: 500; white-space: nowrap; }
@keyframes ae-scroll { to { transform: translateX(-50%); } }

/* ---------- Footer ---------- */
.aether-footer {
  background: #2a1f5c !important;
  color: rgba(255, 255, 255, 0.85);
}
.aether-footer :is(p, a, span) { color: inherit; }

@media (max-width: 700px) {
  .aether-taglines { flex-direction: column; align-items: center; text-align: center; }
}
@media (prefers-reduced-motion: reduce) {
  .aether-hero::before, .aether-marquee-row { animation: none; }
  .aether-word { opacity: 1; transition: none; }
}
```

---

## Part 3: `src/AetherParts.tsx`

```tsx
import React, { useEffect, useRef, useState } from "react";
import "./aether.css";

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
```

---

## After AI Studio applies it: safety check

1. Reload the preview and click the palette/theme button, Chat, Login, Join Free, every nav link, and both floating widgets (Peer Chat, Live Academic AI).
2. Log in and confirm the dashboard looks and behaves exactly as before.
3. Ask AI Studio: "List every file you changed and confirm no logic, icons, or dashboard code was modified." If it touched anything else, reply "revert that file."
4. If something looks off, tell it the specific section and say "adjust only the aether- classes, change nothing else."

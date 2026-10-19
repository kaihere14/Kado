"use client";

import clsx from "clsx";
import { Globe, ImageIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { GitHubIcon, InstagramIcon, XIcon, YouTubeIcon } from "./brand-icons";

type IconProps = { className?: string };

/** What kado can turn into a card, each with an app-icon-style plate. */
const SUBJECTS: { name: string; Icon: (props: IconProps) => React.ReactNode; plate: string }[] = [
  { name: "screenshot", Icon: (p) => <ImageIcon {...p} strokeWidth={2.25} />, plate: "linear-gradient(150deg, #a58aff, #6d4dff)" },
  { name: "website", Icon: (p) => <Globe {...p} strokeWidth={2.25} />, plate: "linear-gradient(150deg, #63a6ff, #2a62f5)" },
  { name: "X profile", Icon: XIcon, plate: "linear-gradient(150deg, #3a3a3e, #0d0d0f)" },
  { name: "GitHub", Icon: GitHubIcon, plate: "linear-gradient(150deg, #3d444d, #1b1f24)" },
  { name: "YouTube", Icon: YouTubeIcon, plate: "linear-gradient(150deg, #ff4d5e, #e8001c)" },
  { name: "Instagram", Icon: InstagramIcon, plate: "linear-gradient(45deg, #feda75, #fa7e1e 30%, #d62976 60%, #962fbf 85%, #4f5bd5)" },
];

const TURN_MS = 2200;

function Subject({ subject, className }: { subject: (typeof SUBJECTS)[number]; className?: string }) {
  const { Icon } = subject;
  return (
    <span className={clsx("inline-block whitespace-nowrap", className)}>
      {/* An app icon a little under the cap height, sitting on the baseline. */}
      <span
        className="relative mr-[0.237em] inline-block h-[0.74em] w-[0.74em] overflow-hidden rounded-[22.5%] align-[-0.006em] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.14)]"
        style={{ background: subject.plate }}
      >
        <Icon className="absolute inset-[24%] h-[52%] w-[52%]" />
      </span>
      {subject.name}
    </span>
  );
}

/**
 * The headline, with a slot that cycles through what kado can turn into a card. The old subject lifts away as the
 * new one rises in, and the slot eases to the new word's width so the centred line re-centres smoothly.
 */
export function HeroTitle() {
  const [turn, setTurn] = useState(0);
  // Each subject's width in em, read from hidden copies, so the slot can animate between them at any type size.
  const [widths, setWidths] = useState<number[] | null>(null);
  const measureRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const measure = () => {
      const size = parseFloat(getComputedStyle(el).fontSize);
      setWidths([...el.children].map((child) => child.getBoundingClientRect().width / size));
    };
    // Again once the web font is in, since the fallback font sets different widths.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    document.fonts.ready.then(measure);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Swapping a word every two seconds is motion too, so it holds still for anyone who asked for less.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => {
      if (!document.hidden) setTurn((t) => t + 1);
    }, TURN_MS);
    return () => clearInterval(timer);
  }, []);

  const current = turn % SUBJECTS.length;
  const previous = turn > 0 ? (turn - 1) % SUBJECTS.length : null;

  return (
    // 8.6cqi fits the widest line, "into a card worth posting." at 11.4em, across the container.
    <h1 className="text-center text-[clamp(25px,min(8.6cqi,36px+1.6vw),56px)] leading-[1.02] font-medium tracking-[-0.03em]">
      <span className="sr-only">Turn your screenshots, websites and profiles into cards worth posting.</span>
      <span aria-hidden className="relative block">
        <span className="block whitespace-nowrap">
          Turn your{" "}
          <span
            className={clsx(
              "relative inline-block text-left align-baseline whitespace-nowrap",
              widths && "transition-[width] duration-[560ms] ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none",
            )}
            style={{ width: widths ? `${widths[current]}em` : undefined }}
          >
            {previous !== null && (
              <Subject key={turn - 1} subject={SUBJECTS[previous]} className="title-leave absolute top-0 left-0" />
            )}
            <Subject key={turn} subject={SUBJECTS[current]} className={turn > 0 ? "title-enter" : undefined} />
          </span>
        </span>
        <span className="block">into a card worth posting.</span>
        <span ref={measureRef} className="pointer-events-none invisible absolute top-0 left-0 whitespace-nowrap">
          {SUBJECTS.map((subject) => (
            <Subject key={subject.name} subject={subject} className="!block w-max" />
          ))}
        </span>
      </span>
    </h1>
  );
}

"use client";

import clsx from "clsx";
import { ArrowRight, Check, Copy, Download, Globe, ImageIcon, Sparkles, Users, WandSparkles } from "lucide-react";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { backdropStyle, BACKDROPS, tunedBackdrop } from "@/lib/backdrops";
import { FORMATS } from "@/lib/formats";
import type { Profile } from "@/lib/platforms";
import { PRESETS, presetLook } from "@/lib/presets";
import { GitHubIcon, InstagramIcon, XIcon, YouTubeIcon } from "./brand-icons";
import { ProfileCard, type CardOptions } from "./profile-card";

/** How long each step stays open before the next one takes over. */
const STEP_MS = 7000;

const STEPS = [
  {
    tag: "Start",
    title: "Start with a handle, a screenshot or a link",
    body: "Type an X, GitHub, YouTube or Instagram handle and kado pulls in the name, bio, counts and banner, live.",
    tip: { Icon: ImageIcon, text: "No profile? Drop in a screenshot or paste a website link. Screenshots never leave your browser." },
  },
  {
    tag: "Style",
    title: "Make it look like yours",
    body: "Pick a card style, a background and a frame, then add shadow and tilt. Every name, bio and count can be edited.",
    tip: { Icon: WandSparkles, text: "Short on time? A preset sets the whole look in one click, and you fine-tune from there." },
  },
  {
    tag: "Post",
    title: "Download it sized for the feed",
    body: "Pick X, LinkedIn, Instagram, Square or GitHub. Every image exports at 2× for sharp text, like 2400 × 1350 for an X post. Download a PNG or copy it to the clipboard.",
  },
];

// The mockup shows a real profile, saved locally so the section never waits on X.
const SAMPLE: Profile = {
  platform: "x",
  handle: "ArmanKiyotaka",
  name: "Arman",
  bio: "18 | SoB'26 | webdev l devops",
  avatarUrl: "/features/avatar.jpg",
  bannerUrl: "/features/banner.jpg",
  verified: false,
  url: "https://x.com/ArmanKiyotaka",
  stats: [
    { key: "followers", label: "followers", value: 282 },
    { key: "following", label: "following", value: 305 },
    { key: "posts", label: "posts", value: 1160 },
  ],
};

const SAMPLE_OPTIONS: CardOptions = {
  style: "native",
  shape: "square",
  size: 50,
  theme: "light",
  visibleStats: ["followers", "following"],
  showVerified: true,
  showBanner: true,
  showPlatformMark: false,
};

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(REDUCED_MOTION);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

/** Steps through `length` items every `interval` ms, or holds the first one when motion is reduced. */
function useCycle(length: number, interval: number, still: boolean) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (still) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % length), interval);
    return () => window.clearInterval(id);
  }, [length, interval, still]);
  return still ? 0 : index;
}

/** How much of `text` has been typed, one character every `perChar` ms after `delay`. */
function useTyped(text: string, delay: number, perChar: number, still: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (still) return;
    let id = 0;
    const start = window.setTimeout(() => {
      id = window.setInterval(() => setCount((c) => (c < text.length ? c + 1 : c)), perChar);
    }, delay);
    return () => {
      window.clearTimeout(start);
      window.clearInterval(id);
    };
  }, [text, delay, perChar, still]);
  return still ? text : text.slice(0, count);
}

/** Counts from zero up to `target` over `duration` ms, starting after `delay`. */
function useCountUp(target: number, delay: number, duration: number, still: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (still) return;
    let frame = 0;
    const begin = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - begin) / duration));
      // Ease out, so the count settles rather than stops.
      setValue(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, delay, duration, still]);
  return still ? target : value;
}

/**
 * Three steps on the left, each with a rule that fills while it's open, and a mockup on the right that acts
 * the step out. Steps advance on their own while the section is on screen and open on click. With reduced
 * motion they only change on click.
 */
export function Features() {
  const [active, setActive] = useState(0);
  // Bumped on every change so the active step's rule starts filling from empty again.
  const [run, setRun] = useState(0);
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const baseId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.4 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function open(index: number) {
    setActive(index);
    setRun((r) => r + 1);
  }

  return (
    <div
      ref={ref}
      className="mt-14 grid items-start gap-8 text-left lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16"
    >
      <ol className="flex flex-col gap-7 lg:pt-8">
        {STEPS.map(({ tag, title, body, tip }, index) => {
          const isActive = index === active;
          return (
            <li key={tag} className="relative pl-6">
              <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 overflow-hidden rounded-full bg-black/[.08]">
                {isActive && (
                  <span
                    key={run}
                    className="step-progress absolute inset-0 origin-top rounded-full bg-ink"
                    style={{ animationDuration: `${STEP_MS}ms`, animationPlayState: inView ? "running" : "paused" }}
                    onAnimationEnd={() => open((index + 1) % STEPS.length)}
                  />
                )}
              </span>
              <button
                type="button"
                aria-expanded={isActive}
                aria-controls={`${baseId}-${index}`}
                onClick={() => open(index)}
                className="group block w-full rounded-md text-left"
              >
                <span className="inline-flex items-center gap-1.5 rounded-md bg-well px-1.5 py-0.5 text-xs font-medium">
                  <span className="text-muted tabular-nums">0{index + 1}</span>
                  {tag}
                </span>
                <span
                  className={clsx(
                    "mt-2 block text-[20px] leading-snug font-medium tracking-[-0.02em] transition-colors duration-300",
                    isActive ? "text-ink" : "text-muted/80 group-hover:text-ink",
                  )}
                >
                  {title}
                </span>
              </button>
              <div
                id={`${baseId}-${index}`}
                inert={!isActive}
                className={clsx(
                  "grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
                  isActive ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                )}
              >
                {/* Room on every side for the focus ring, which the clip would otherwise cut off. */}
                <div className="-mx-1 min-h-0 overflow-hidden px-1 pb-1">
                  <p className="pt-2 text-[15px] leading-relaxed text-muted">{body}</p>
                  {tip && (
                    <p className="mt-4 flex gap-3 rounded-2xl bg-well/70 p-3.5 text-[14px] leading-snug">
                      <tip.Icon aria-hidden className="mt-px h-4 w-4 shrink-0" strokeWidth={1.75} />
                      {tip.text}
                    </p>
                  )}
                  {index === STEPS.length - 1 && (
                    <a
                      href="#studio"
                      className="press mt-5 inline-flex items-center gap-2 rounded-full bg-ink py-2 ps-4 pe-3.5 text-sm font-medium text-white transition-[background-color,scale] hover:bg-black"
                    >
                      Make your card
                      <ArrowRight aria-hidden className="h-4 w-4" />
                    </a>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Illustration only: the steps on the left carry the same information as text. */}
      <div aria-hidden className="order-first rounded-[28px] bg-well/70 p-2 lg:order-none">
        <div className="relative h-[456px] overflow-hidden rounded-[20px] bg-white shadow-[0_1px_2px_rgba(42,42,39,.06),0_30px_60px_-30px_rgba(60,40,120,.25)] ring-1 ring-black/[.05]">
          {active === 0 && <PullScene />}
          {active === 1 && <StyleScene />}
          {active === 2 && <PostScene />}
        </div>
      </div>
    </div>
  );
}

const SOURCE_ICONS = [ImageIcon, Globe, XIcon, GitHubIcon, InstagramIcon, YouTubeIcon];
// When the profile lands, after the handle has finished typing.
const PULLED_AT = 1500;

function PullScene() {
  const still = usePrefersReducedMotion();
  const typed = useTyped(SAMPLE.handle, 350, 70, still);
  const followers = useCountUp(SAMPLE.stats[0].value, PULLED_AT, 900, still);
  const pulledDelay = still ? 0 : PULLED_AT;

  return (
    <div className="scene-in flex h-full flex-col p-5">
      <div className="flex items-center gap-0.5 self-start rounded-full bg-well p-1">
        {SOURCE_ICONS.map((Icon, i) => (
          <span
            key={i}
            className={clsx(
              "flex h-7 w-9 items-center justify-center rounded-full",
              i === 2 ? "bg-white text-ink shadow-[0_1px_2px_rgba(42,42,39,.12)]" : "text-muted",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-full bg-white py-1.5 pr-1.5 pl-4 text-[15px] shadow-[0_1px_2px_rgba(42,42,39,.08),0_8px_24px_-12px_rgba(42,42,39,.25)] ring-1 ring-black/[.06]">
        <span className="min-w-0 truncate">
          <span className="text-muted">x.com/</span>
          {typed}
        </span>
        {typed.length < SAMPLE.handle.length && <span className="caret -ml-1.5 h-4 w-px shrink-0 bg-ink" />}
        <span className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-white">
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>

      <div className="scene-in mt-5 rounded-2xl p-4 ring-1 ring-black/[.06]" style={{ animationDelay: `${pulledDelay}ms` }}>
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- a small local image, no optimisation needed */}
          <img src={SAMPLE.avatarUrl!} alt="" className="h-10 w-10 rounded-full object-cover" />
          <span className="min-w-0">
            <span className="block leading-tight font-medium">{SAMPLE.name}</span>
            <span className="block text-[13px] text-muted">@{SAMPLE.handle}</span>
          </span>
          <XIcon className="ml-auto h-4 w-4 shrink-0" />
        </div>
        <p className="mt-3 text-[14px]">{SAMPLE.bio}</p>
        <div className="mt-3 flex flex-col gap-1.5">
          <div className="flex items-center gap-3 rounded-xl bg-well/60 px-3 py-2.5">
            <span className="flex h-7 w-12 shrink-0 items-center justify-center">
              <Users className="h-4 w-4 text-muted" />
            </span>
            <span className="min-w-0">
              <span className="block leading-tight font-medium tabular-nums">{followers} followers</span>
              <span className="block truncate text-[12px] text-muted">305 following, 1,160 posts</span>
            </span>
            <span className="ml-auto text-[12px] text-muted">Counts</span>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-well/60 px-3 py-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element -- a small local image, no optimisation needed */}
            <img src={SAMPLE.bannerUrl!} alt="" className="h-7 w-12 shrink-0 rounded-md object-cover" />
            <span className="min-w-0">
              <span className="block leading-tight font-medium">Banner and avatar</span>
              <span className="block truncate text-[12px] text-muted">Pulled at full size</span>
            </span>
            <span className="ml-auto text-[12px] text-muted">Images</span>
          </div>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between pt-4 text-[13px] text-muted">
        <span className="flex -space-x-1.5">
          {SOURCE_ICONS.slice(2).map((Icon, i) => (
            <span key={i} className="flex h-7 w-7 items-center justify-center rounded-full bg-white ring-1 ring-black/[.08]">
              <Icon className="h-3.5 w-3.5 text-ink" />
            </span>
          ))}
        </span>
        Pulled live, no sign-up
      </div>
    </div>
  );
}

const LOOKS = [
  { id: "flare", note: "Native card on blue light" },
  { id: "aurora", note: "Glass frame, tilted back" },
  { id: "onyx", note: "Minimal dark card, glass rim" },
  { id: "gold", note: "Ticket card, turned a little" },
].map(({ id, note }) => {
  const preset = PRESETS.find((p) => p.id === id)!;
  return { id, note, label: preset.label, style: preset.style, ...presetLook(preset, false) };
});

function StyleScene() {
  const still = usePrefersReducedMotion();
  const current = useCycle(LOOKS.length, 1600, still);

  return (
    <div className="scene-in flex h-full flex-col p-5">
      <div className="relative h-[180px] shrink-0 overflow-hidden rounded-xl">
        {LOOKS.map((look, i) => {
          const { layer, grain } = tunedBackdrop(look.backdrop, look.tune);
          return (
            <div
              key={look.id}
              className={clsx(
                "absolute inset-0 transition-opacity duration-500 ease-out motion-reduce:transition-none",
                i === current ? "opacity-100" : "opacity-0",
              )}
            >
              <div className="absolute" style={layer} />
              {grain && <div className="absolute inset-0" style={grain} />}
              <div className="absolute inset-0 flex items-center justify-center">
                <ProfileCard
                  profile={SAMPLE}
                  options={{ ...SAMPLE_OPTIONS, style: look.style, theme: look.theme }}
                  width={150}
                  effects={look.effects}
                  darkBackdrop={!!look.backdrop.dark}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between text-[13px]">
        <span className="flex items-center gap-1.5 font-medium">
          <Sparkles className="h-3.5 w-3.5" />
          Presets
        </span>
        <span className="text-muted">{PRESETS.length} looks</span>
      </div>
      <ul className="mt-1 divide-y divide-black/[.05]">
        {LOOKS.map((look, i) => (
          <li key={look.id} className="flex items-center gap-3 py-2">
            <span className="h-8 w-8 shrink-0 rounded-lg ring-1 ring-black/[.06]" style={backdropStyle(look.backdrop)} />
            <span className="min-w-0">
              <span className="block text-[14px] leading-tight font-medium">{look.label}</span>
              <span className="block truncate text-[12px] text-muted">{look.note}</span>
            </span>
            <span
              className={clsx(
                "ml-auto flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-[12px] font-medium transition-[background-color,color,box-shadow] duration-300",
                i === current ? "bg-ink text-white" : "bg-white text-ink ring-1 ring-black/[.08]",
              )}
            >
              {i === current && <Check className="h-3 w-3" strokeWidth={2.5} />}
              {i === current ? "Applied" : "Apply"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const FLARE = BACKDROPS.find((b) => b.id === "flare")!;
// The largest the exported image may get inside the mockup, in px. It also stays inside the scene's padding.
const EXPORT_BOX = { width: 360, height: 240 };

function PostScene() {
  const still = usePrefersReducedMotion();
  const current = useCycle(FORMATS.length, 1500, still);
  const format = FORMATS[current];
  const ratio = format.width / format.height;

  return (
    <div className="scene-in preview-surface flex h-full flex-col items-center p-5 @container">
      <span className="font-mono text-[12px] text-muted">
        kado-{SAMPLE.handle}-{format.id}.png · {format.width * 2}×{format.height * 2}
      </span>

      <div className="flex flex-1 items-center">
        <div
          className="relative overflow-hidden rounded-lg shadow-[0_1px_2px_rgba(42,42,39,.1),0_20px_40px_-20px_rgba(22,22,63,.45)] transition-[width,height] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none"
          style={{
            // 100cqw is the scene's width; 40px is its padding.
            width: `min(100cqw - 40px, ${EXPORT_BOX.width}px, ${EXPORT_BOX.height * ratio}px)`,
            height: `min((100cqw - 40px) / ${ratio}, ${EXPORT_BOX.width / ratio}px, ${EXPORT_BOX.height}px)`,
          }}
        >
          <div className="absolute inset-0" style={backdropStyle(FLARE)} />
          <div className="absolute inset-0 flex items-center justify-center">
            <ProfileCard profile={SAMPLE} options={SAMPLE_OPTIONS} width={136} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-1.5">
        {FORMATS.map((f, i) => (
          <span
            key={f.id}
            className={clsx(
              "rounded-full px-2.5 py-1 text-[12px] font-medium transition-[background-color,color,box-shadow] duration-300",
              i === current ? "bg-ink text-white" : "bg-white text-muted ring-1 ring-black/[.06]",
            )}
          >
            {f.label.split(" ")[0]} <span className="opacity-60">{f.ratio}</span>
          </span>
        ))}
      </div>

      <div className="mt-4 flex w-full gap-2">
        <span className="flex flex-1 items-center justify-center gap-2 rounded-full bg-ink py-2.5 text-sm font-medium text-white">
          <Download className="h-4 w-4" />
          Download
        </span>
        <span className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white py-2.5 text-sm font-medium ring-1 ring-black/[.08]">
          <Copy className="h-4 w-4" />
          Copy
        </span>
      </div>
    </div>
  );
}

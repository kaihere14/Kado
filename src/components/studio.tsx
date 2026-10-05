"use client";

import clsx from "clsx";
import { toBlob, toPng } from "html-to-image";
import { Check, ChevronDown, Copy, Download, ImagePlus, Loader2, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BACKDROPS, backdropStyle, DEFAULT_BACKDROP, type Backdrop } from "@/lib/backdrops";
import {
  blankProfile,
  normalizeHandle,
  PLATFORM_ORDER,
  PLATFORMS,
  type PlatformId,
  type Profile,
} from "@/lib/platforms";
import { PLATFORM_ICONS } from "./brand-icons";
import { DEFAULT_FORMAT, EXPORT_SCALE, FORMATS, getFormat } from "@/lib/formats";
import { cardWidth, ProfileCard, type CardOptions, type CardSize, type CardStyle } from "./profile-card";

type BackdropChoice = Backdrop | { upload: string };

// Shown before anyone generates a card, so the studio is never empty.
const SAMPLE: Profile = {
  ...blankProfile("x", "ada"),
  name: "Ada Lovelace",
  bio: "Writing the first program. Mostly notes on the Analytical Engine.",
  verified: true,
  stats: [
    { key: "followers", label: "followers", value: 18_420 },
    { key: "following", label: "following", value: 212 },
    { key: "posts", label: "posts", value: 1_318 },
  ],
};

const STYLES: { id: CardStyle; label: string }[] = [
  { id: "native", label: "Native" },
  { id: "minimal", label: "Minimal" },
  { id: "ticket", label: "Ticket" },
];

function defaultOptions(platform: PlatformId, style: CardStyle = "native"): CardOptions {
  const config = PLATFORMS[platform];
  return {
    style,
    size: "M",
    theme: "light",
    visibleStats: config.defaultVisible,
    showVerified: true,
    showBanner: config.hasBanner,
    showPlatformMark: false,
  };
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function capitalize(text: string) {
  return text[0].toUpperCase() + text.slice(1);
}

export function Studio() {
  const [platform, setPlatform] = useState<PlatformId>("x");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>(SAMPLE);
  const [generation, setGeneration] = useState(0);
  const [options, setOptions] = useState<CardOptions>(() => defaultOptions("x"));
  const [backdrop, setBackdrop] = useState<BackdropChoice>(DEFAULT_BACKDROP);
  const [exportState, setExportState] = useState<"idle" | "copying" | "copied" | "saving" | "saved">("idle");
  const [formatId, setFormatId] = useState(DEFAULT_FORMAT.x);
  const [previewBox, setPreviewBox] = useState({ width: 0, height: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const studioRef = useRef<HTMLElement>(null);

  const format = getFormat(formatId);
  // Fit the full-size frame inside the preview area, whichever side is tighter.
  const previewScale = previewBox.width
    ? Math.min(previewBox.width / format.width, previewBox.height / format.height)
    : 0;

  // The frame renders at its real export size; scale it down to fit the preview column.
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) =>
      setPreviewBox({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const config = PLATFORMS[platform];
  const cardConfig = PLATFORMS[profile.platform];

  function showProfile(next: Profile) {
    setProfile(next);
    setOptions((o) => defaultOptions(next.platform, o.style));
    setFormatId(DEFAULT_FORMAT[next.platform]);
    setGeneration((g) => g + 1);
  }

  const scrollPending = useRef(false);

  // Bring the studio into view once a freshly generated card has rendered.
  useEffect(() => {
    if (!scrollPending.current) return;
    scrollPending.current = false;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    studioRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }, [generation]);

  function scrollToStudio() {
    scrollPending.current = true;
  }

  async function generate(event: React.FormEvent) {
    event.preventDefault();
    const handle = normalizeHandle(input);
    if (!handle) return;
    setError(null);

    if (!config.fetchable) {
      showProfile(blankProfile(platform, handle));
      scrollToStudio();
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/profile/${platform}/${encodeURIComponent(handle)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      showProfile(data as Profile);
      scrollToStudio();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function updateProfile(patch: Partial<Profile>) {
    setProfile((p) => ({ ...p, ...patch }));
  }

  function updateStat(key: string, value: number) {
    setProfile((p) => ({ ...p, stats: p.stats.map((s) => (s.key === key ? { ...s, value } : s)) }));
  }

  async function exportImage(mode: "copy" | "download") {
    const node = canvasRef.current;
    if (!node) return;
    const opts = { pixelRatio: EXPORT_SCALE, cacheBust: true, width: format.width, height: format.height };
    try {
      if (mode === "copy") {
        setExportState("copying");
        // Pass a promise so Safari keeps the user-gesture context while rendering.
        const blob = toBlob(node, opts).then((b) => {
          if (!b) throw new Error("Render failed");
          return b;
        });
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setExportState("copied");
      } else {
        setExportState("saving");
        const url = await toPng(node, opts);
        const link = document.createElement("a");
        link.download = `kado-${profile.handle}-${format.id}.png`;
        link.href = url;
        link.click();
        setExportState("saved");
      }
    } catch {
      setError(
        mode === "copy"
          ? "Your browser blocked copying the image. Use Download instead."
          : "The image couldn't be rendered. Try a different background image.",
      );
      setExportState("idle");
      return;
    }
    setTimeout(() => setExportState("idle"), 1800);
  }

  return (
    <>
      <section className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 pt-14 text-center sm:pt-20">
        <h1 className="text-[40px] leading-[1.05] font-medium tracking-[-0.035em] text-balance sm:text-[60px]">
          Your profile, as a card worth posting.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed tracking-[-0.015em] text-muted sm:text-xl">
          Kado turns an X, LinkedIn or GitHub handle into a <span className="marker">share-ready card</span> in
          seconds. No sign-up, no design tool.
        </p>

        <div className="mt-9 flex flex-wrap justify-center gap-1 rounded-full bg-well p-1">
          {PLATFORM_ORDER.map((id) => {
            const Icon = PLATFORM_ICONS[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setPlatform(id);
                  setError(null);
                }}
                aria-pressed={platform === id}
                className={clsx(
                  "flex items-center gap-2 rounded-full px-4 py-2 text-sm transition",
                  platform === id
                    ? "bg-white font-medium text-ink shadow-[0_1px_2px_rgba(42,42,39,.12)]"
                    : "text-muted hover:text-ink",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {PLATFORMS[id].label}
              </button>
            );
          })}
        </div>

        <form
          onSubmit={generate}
          className="mt-3 flex w-full max-w-md items-center gap-2 rounded-full bg-white py-1.5 pr-1.5 pl-5 shadow-[0_1px_2px_rgba(42,42,39,.08),0_8px_24px_-12px_rgba(42,42,39,.25)] ring-1 ring-black/[.06] transition focus-within:ring-black/20"
        >
          <span className="shrink-0 text-[15px] text-muted/70">{config.prefix}</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={config.placeholder}
            aria-label={`${config.label} handle`}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none focus-visible:outline-none placeholder:font-normal placeholder:text-black/25"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex shrink-0 items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition hover:bg-black disabled:opacity-35"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Make card
          </button>
        </form>

        <p className={clsx("mt-3 min-h-5 text-sm", error ? "text-red-600" : "text-muted/80")}>
          {error ??
            (config.fetchable
              ? `We pull your public ${config.label} profile. Nothing is stored.`
              : `${config.label} keeps profiles private, so you'll fill in the numbers yourself.`)}
        </p>
      </section>

      <section ref={studioRef} id="studio" className="mx-auto mt-10 w-full max-w-7xl scroll-mt-4 px-2 sm:px-4">
        <div
          className="rounded-[28px] p-2 sm:p-6 lg:p-8"
          style={{
            background:
              "radial-gradient(ellipse 70% 80% at 0% 0%, #e6dcff 0%, transparent 60%), radial-gradient(ellipse 70% 80% at 100% 100%, #fbd9e8 0%, transparent 60%), #efebf7",
          }}
        >
          <div className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(42,42,39,.06),0_30px_60px_-30px_rgba(60,40,120,.35)] ring-1 ring-black/[.05]">
            <div className="flex items-center gap-3 border-b border-black/[.06] px-4 py-3">
              <div className="flex gap-1.5" aria-hidden>
                <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
                <span className="h-3 w-3 rounded-full bg-[#28c840]" />
              </div>
              <span className="flex-1 truncate text-center font-mono text-xs text-muted">
                kado-{profile.handle}-{format.id}.png · {format.width * EXPORT_SCALE}×{format.height * EXPORT_SCALE}
              </span>
              <button
                type="button"
                title="Back to the sample card"
                onClick={() => {
                  showProfile(SAMPLE);
                  setInput("");
                }}
                className="text-muted transition hover:text-ink"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Fixed-height body: the inspector scrolls on its own instead of stretching the window. */}
            <div className="grid lg:h-[min(660px,calc(100svh-120px))] lg:grid-cols-[1fr_320px]">
              <div className="flex h-[340px] bg-[#f6f5f1] p-4 sm:h-[460px] sm:p-6 lg:h-full lg:p-8">
                <div ref={previewRef} className="flex min-h-0 min-w-0 flex-1 items-center justify-center">
                  <div
                    className="relative shrink-0 overflow-hidden rounded-xl ring-1 ring-black/[.06]"
                    style={{
                      width: format.width * previewScale,
                      height: format.height * previewScale,
                      visibility: previewScale ? "visible" : "hidden",
                    }}
                  >
                    <div
                      className="absolute top-0 left-0 origin-top-left"
                      style={{ transform: `scale(${previewScale})` }}
                    >
                      <div
                        ref={canvasRef}
                        className="flex items-center justify-center"
                        style={{ width: format.width, height: format.height, ...backdropStyle(backdrop) }}
                      >
                        <div key={generation} className="card-in">
                          <ProfileCard profile={profile} options={options} width={cardWidth(options.size, format)} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <aside className="flex min-h-0 flex-col border-t border-black/[.06] text-sm lg:border-t-0 lg:border-l">
                <div className="min-h-0 flex-1 divide-y divide-black/[.06] overflow-y-auto overscroll-contain">
                  <InspectorSection title="Style">
                    <Segmented
                      value={options.style}
                      values={STYLES.map((s) => s.id)}
                      labels={Object.fromEntries(STYLES.map((s) => [s.id, s.label]))}
                      onChange={(style) => setOptions((o) => ({ ...o, style }))}
                    />
                  </InspectorSection>

                  <InspectorSection title="Format">
                    <div className="flex flex-col gap-0.5">
                      {FORMATS.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          aria-pressed={f.id === format.id}
                          onClick={() => setFormatId(f.id)}
                          className={clsx(
                            "flex items-center gap-3 rounded-lg px-2 py-1.5 text-left transition",
                            f.id === format.id ? "bg-well text-ink" : "text-muted hover:text-ink",
                          )}
                        >
                          <span aria-hidden className="flex h-5 w-5 shrink-0 items-center justify-center">
                            <span
                              className={clsx(
                                "block rounded-[2px] border-[1.5px]",
                                f.id === format.id ? "border-ink" : "border-current",
                              )}
                              style={
                                f.width >= f.height
                                  ? { width: 18, height: Math.round((18 * f.height) / f.width) }
                                  : { height: 18, width: Math.round((18 * f.width) / f.height) }
                              }
                            />
                          </span>
                          <span className="flex-1">{f.label}</span>
                          <span className="font-mono text-xs text-muted">{f.ratio}</span>
                        </button>
                      ))}
                    </div>
                  </InspectorSection>

                  <InspectorSection title="Background">
                    <div className="grid grid-cols-8 gap-1.5 lg:grid-cols-4">
                      {BACKDROPS.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          title={b.label}
                          aria-label={`${b.label} background`}
                          aria-pressed={"id" in backdrop && backdrop.id === b.id}
                          onClick={() => setBackdrop(b)}
                          className={clsx(
                            "aspect-square rounded-lg ring-offset-2 transition",
                            "id" in backdrop && backdrop.id === b.id
                              ? "ring-2 ring-ink"
                              : "ring-1 ring-black/10 hover:ring-black/25",
                          )}
                          style={backdropStyle(b)}
                        />
                      ))}
                      <label
                        title="Upload your own"
                        className={clsx(
                          "flex aspect-square cursor-pointer items-center justify-center rounded-lg text-muted ring-offset-2 transition hover:text-ink",
                          "upload" in backdrop ? "ring-2 ring-ink" : "border border-dashed border-black/20",
                        )}
                      >
                        <ImagePlus className="h-4 w-4" />
                        <span className="sr-only">Upload a background image</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) setBackdrop({ upload: await readFile(file) });
                          }}
                        />
                      </label>
                    </div>
                  </InspectorSection>

                  <InspectorSection title="Layout">
                    <div className="grid grid-cols-2 gap-2">
                      <Segmented
                        value={options.size}
                        values={["S", "M", "L"] as CardSize[]}
                        onChange={(size) => setOptions((o) => ({ ...o, size }))}
                      />
                      <Segmented
                        value={options.theme}
                        values={["light", "dark"] as const}
                        labels={{ light: "Light", dark: "Dark" }}
                        onChange={(theme) => setOptions((o) => ({ ...o, theme }))}
                      />
                    </div>
                  </InspectorSection>

                  <InspectorSection title="Show">
                    <div className="flex flex-col gap-0.5">
                      {profile.stats.map((s) => (
                        <Switch
                          key={s.key}
                          label={capitalize(s.label)}
                          checked={options.visibleStats.includes(s.key)}
                          onChange={(on) =>
                            setOptions((o) => ({
                              ...o,
                              visibleStats: on
                                ? [...o.visibleStats, s.key]
                                : o.visibleStats.filter((k) => k !== s.key),
                            }))
                          }
                        />
                      ))}
                      <Switch
                        label="Verified badge"
                        checked={options.showVerified}
                        onChange={(showVerified) => setOptions((o) => ({ ...o, showVerified }))}
                      />
                      {cardConfig.hasBanner && options.style === "native" && (
                        <Switch
                          label="Banner"
                          checked={options.showBanner}
                          onChange={(showBanner) => setOptions((o) => ({ ...o, showBanner }))}
                        />
                      )}
                      <Switch
                        label={`${cardConfig.label} logo`}
                        checked={options.showPlatformMark}
                        onChange={(showPlatformMark) => setOptions((o) => ({ ...o, showPlatformMark }))}
                      />
                    </div>
                  </InspectorSection>

                  <details className="group" open={!cardConfig.fetchable}>
                    <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 font-medium [&::-webkit-details-marker]:hidden">
                      Edit details
                      <ChevronDown className="h-4 w-4 text-muted transition group-open:rotate-180" />
                    </summary>
                    <div className="flex flex-col gap-3 px-5 pb-5">
                      <Field label="Name" value={profile.name} onChange={(name) => updateProfile({ name })} />
                      <Field
                        label={profile.platform === "linkedin" ? "Headline" : "Bio"}
                        value={profile.bio}
                        multiline
                        onChange={(bio) => updateProfile({ bio })}
                      />
                      <div className="grid grid-cols-3 gap-2">
                        {profile.stats.map((s) => (
                          <Field
                            key={s.key}
                            label={capitalize(s.label)}
                            type="number"
                            value={String(s.value)}
                            onChange={(v) => updateStat(s.key, Math.max(0, Number(v) || 0))}
                          />
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <ImageInput label="Photo" onChange={(avatarUrl) => updateProfile({ avatarUrl })} />
                        {cardConfig.hasBanner && (
                          <ImageInput label="Banner" onChange={(bannerUrl) => updateProfile({ bannerUrl })} />
                        )}
                      </div>
                      <Switch
                        label="Account is verified"
                        checked={profile.verified}
                        onChange={(verified) => updateProfile({ verified })}
                      />
                    </div>
                  </details>
                </div>

                <div className="flex gap-2 border-t border-black/[.06] bg-white p-4">
                  <button
                    type="button"
                    onClick={() => exportImage("download")}
                    className="flex flex-1 items-center justify-center gap-2 rounded-full bg-ink px-4 py-2.5 font-medium text-white transition hover:bg-black"
                  >
                    {exportState === "saving" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : exportState === "saved" ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    {exportState === "saved" ? "Downloaded" : "Download"}
                  </button>
                  <button
                    type="button"
                    onClick={() => exportImage("copy")}
                    className="flex flex-1 items-center justify-center gap-2 rounded-full bg-white px-4 py-2.5 font-medium ring-1 ring-black/10 transition hover:bg-well"
                  >
                    {exportState === "copying" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : exportState === "copied" ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    {exportState === "copied" ? "Copied" : "Copy"}
                  </button>
                </div>
              </aside>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-start justify-center gap-2 text-sm text-muted">
          <svg viewBox="0 0 40 28" className="mt-[-6px] h-7 w-10 shrink-0" fill="none" aria-hidden>
            <path
              d="M36 24C24 25 12 20 7 6m0 0L3 12m4-6 6 3"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>Sized to show uncropped in the feed, exported at 2× for sharp text.</span>
        </div>
      </section>
    </>
  );
}

function InspectorSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      <h2 className="font-medium">{title}</h2>
      {children}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  values,
  labels,
  onChange,
}: {
  value: T;
  values: readonly T[];
  labels?: Partial<Record<T, string>>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex rounded-full bg-well p-0.5">
      {values.map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={clsx(
            "flex-1 rounded-full px-2 py-1.5 text-[13px] transition",
            value === v ? "bg-white font-medium shadow-[0_1px_2px_rgba(42,42,39,.14)]" : "text-muted hover:text-ink",
          )}
        >
          {labels?.[v] ?? v}
        </button>
      ))}
    </div>
  );
}

function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="relative flex cursor-pointer items-center justify-between py-1.5">
      <span className={checked ? "text-ink" : "text-muted"}>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className={clsx(
          "relative h-5 w-9 rounded-full transition peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#8b7cf6]",
          checked ? "bg-ink" : "bg-black/15",
        )}
      >
        <span
          className={clsx(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-[left]",
            checked ? "left-[18px]" : "left-0.5",
          )}
        />
      </span>
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  type?: "text" | "number";
}) {
  const className =
    "w-full rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-black/10 outline-none transition focus:ring-2 focus:ring-[#8b7cf6]/60";
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs text-muted">{label}</span>
      {multiline ? (
        <textarea
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={clsx(className, "resize-none")}
        />
      ) : (
        <input type={type} min={0} value={value} onChange={(e) => onChange(e.target.value)} className={className} />
      )}
    </label>
  );
}

function ImageInput({ label, onChange }: { label: string; onChange: (dataUrl: string) => void }) {
  return (
    <label className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full py-2 text-[13px] ring-1 ring-black/10 transition hover:bg-well">
      <ImagePlus className="h-3.5 w-3.5" />
      Upload {label.toLowerCase()}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) onChange(await readFile(file));
        }}
      />
    </label>
  );
}

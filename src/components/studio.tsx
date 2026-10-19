"use client";

import clsx from "clsx";
import { toCanvas } from "html-to-image";
import { AtSign, Check, ChevronDown, Copy, Download, Globe, ImageIcon, ImagePlus, Loader2, RotateCcw } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  BACKDROPS,
  backdropStyle,
  blurImage,
  DEFAULT_BACKDROP,
  defaultTune,
  hueTrack,
  isDarkBackdrop,
  isDarkImage,
  tunableParts,
  tunedBackdrop,
  type BackdropChoice,
  type BackdropTune,
} from "@/lib/backdrops";
import {
  blankProfile,
  normalizeHandle,
  PLATFORM_ORDER,
  PLATFORMS,
  SOURCES,
  type PlatformId,
  type Profile,
  type Source,
} from "@/lib/platforms";
import { PLATFORM_ICONS } from "./brand-icons";
import { HeroTitle } from "./hero-title";
import { IMAGE_STYLES, ImageCard, imageCardWidth, type ImageStyle } from "./image-card";
import { Reveal } from "./reveal";
import { isImageFile, readCardImage, readFile, type CardImage } from "@/lib/card-image";
import { DEFAULT_FORMAT, EXPORT_SCALE, FORMATS, getFormat } from "@/lib/formats";
import { PRESETS, presetLook, type Preset } from "@/lib/presets";
import { loadStudio, saveStudio } from "@/lib/saved-studio";
import { drawProjected, projection } from "@/lib/warp";
import {
  cardWidth,
  DEFAULT_EFFECTS,
  DEFAULT_SIZE,
  FRAME_STYLES,
  ProfileCard,
  type CardEffects,
  type CardOptions,
  type CardShape,
  type CardStyle,
} from "./profile-card";

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

const IMAGE_STYLE_LABELS: Record<ImageStyle, string> = { card: "Card", window: "Window", plain: "Plain" };

// Image comes first: it works for anyone, with or without a profile on the platforms.
const SOURCE_TABS: Record<Source, { label: string; Icon: typeof Globe }> = {
  image: { label: "Image", Icon: ImageIcon },
  website: { label: "Website", Icon: Globe },
  profile: { label: "Profile", Icon: AtSign },
};

const NOT_AN_IMAGE = "That file isn't an image. Try a PNG, JPEG or WebP.";

// The server in capture-server/ that captures websites, called straight from the browser.
const CAPTURE_URL = process.env.NEXT_PUBLIC_CAPTURE_URL;

const INSPECTOR_TABS = [
  { id: "canvas", label: "Canvas" },
  { id: "card", label: "Card" },
  { id: "presets", label: "Presets" },
] as const;

type InspectorTab = (typeof INSPECTOR_TABS)[number]["id"];

function defaultOptions(platform: PlatformId, style: CardStyle = "native"): CardOptions {
  const config = PLATFORMS[platform];
  return {
    style,
    shape: "square",
    size: DEFAULT_SIZE,
    theme: "light",
    visibleStats: config.defaultVisible,
    showVerified: true,
    showBanner: config.hasBanner,
    showPlatformMark: false,
  };
}

// iPadOS reports itself as a Mac; touch support gives it away.
function isIOS() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
}

// iOS can draw the export before the avatar and banner inside it have decoded, so the first render or
// two come out without them. Each render warms WebKit's cache; the last one is kept.
const IOS_RENDER_PASSES = 5;

type RenderOptions = NonNullable<Parameters<typeof toCanvas>[1]> & { pixelRatio: number };

async function renderPasses(node: HTMLElement, options: RenderOptions, passes: number) {
  let canvas = await toCanvas(node, options);
  for (let i = 1; i < passes; i++) {
    // Zeroing a discarded canvas frees its memory now; iOS caps the total and blanks new canvases past it.
    canvas.width = canvas.height = 0;
    canvas = await toCanvas(node, options);
  }
  return canvas;
}

// A tilted card is rendered flat at 1.5x the export scale, so the side the tilt brings closer stays sharp.
const TILT_SUPERSAMPLE = 1.5;

/**
 * Renders the frame. A tilted or rotated card is rendered flat on its own, `pad` px of room around it for
 * its shadow, and projected onto the background in script: WebKit paints transforms inside the export
 * without perspective, and smears their shadows.
 */
async function renderFrame(node: HTMLElement, options: RenderOptions, pad: number) {
  const ios = isIOS();
  const passes = ios ? IOS_RENDER_PASSES : 1;
  const card = node.querySelector<HTMLElement>("[data-card-tilt]");
  // The export copies computed styles, so on iOS the card's shadow has to be off on the live node while it renders.
  if (ios) node.setAttribute("data-flat-export", "");
  try {
    if (!card || getComputedStyle(card).transform === "none") return await renderPasses(node, options, passes);
    const canvas = await renderPasses(node, { ...options, filter: (el) => el !== card }, passes);
    const sourceRatio = options.pixelRatio * TILT_SUPERSAMPLE;
    const flat = await renderPasses(
      card,
      {
        ...options,
        pixelRatio: sourceRatio,
        width: card.offsetWidth + 2 * pad,
        height: card.offsetHeight + 2 * pad,
        style: { transform: "none", padding: `${pad}px`, boxSizing: "border-box" },
      },
      passes,
    );
    drawProjected(canvas, flat, projection(card, node, { pad, sourceRatio, targetRatio: options.pixelRatio }));
    flat.width = flat.height = 0;
    return canvas;
  } finally {
    node.removeAttribute("data-flat-export");
  }
}

function pngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Render failed"))), "image/png"),
  );
}

function capitalize(text: string) {
  return text[0].toUpperCase() + text.slice(1);
}

/** "+12°", "−8°", "0°", with a true minus sign. */
function signed(unit: string) {
  return (value: number) => `${value > 0 ? "+" : value < 0 ? "\u2212" : ""}${Math.abs(value)}${unit}`;
}

function differs<T extends object>(a: T, b: T, keys: (keyof T)[] = Object.keys(a) as (keyof T)[]) {
  return keys.some((key) => a[key] !== b[key]);
}

const DEPTH_KEYS: (keyof CardEffects)[] = ["shadow", "rotate", "tiltX", "tiltY"];

// File inputs are visually hidden inside their label, so the label shows the keyboard focus ring.
const FILE_FOCUS =
  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus";

function isTextField(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.matches("textarea, input:not([type=file], [type=checkbox], [type=range])"))
  );
}

export function Studio() {
  const [source, setSource] = useState<Source>("image");
  const [platform, setPlatform] = useState<PlatformId>("x");
  const [input, setInput] = useState("");
  const [site, setSite] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>(SAMPLE);
  const [image, setImage] = useState<CardImage | null>(null);
  const [imageStyle, setImageStyle] = useState<ImageStyle>(IMAGE_STYLES[0]);
  const [dragging, setDragging] = useState(false);
  const [tab, setTab] = useState<InspectorTab>("canvas");
  const [generation, setGeneration] = useState(0);
  const [options, setOptions] = useState<CardOptions>(() => defaultOptions("x"));
  const [backdrop, setBackdrop] = useState<BackdropChoice>(DEFAULT_BACKDROP);
  const [tune, setTune] = useState<BackdropTune>(() => defaultTune(DEFAULT_BACKDROP));
  const [effects, setEffects] = useState<CardEffects>(DEFAULT_EFFECTS);
  const [blurredUpload, setBlurredUpload] = useState<{ src: string; radius: number; formatId: string; url: string }>();
  const [exportState, setExportState] = useState<"idle" | "copying" | "copied" | "saving" | "saved">("idle");
  const [formatId, setFormatId] = useState(DEFAULT_FORMAT.x);
  const [previewBox, setPreviewBox] = useState({ width: 0, height: 0 });
  const [restored, setRestored] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const studioRef = useRef<HTMLElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const exportResetRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const downloadUrlRef = useRef<string>(undefined);
  const exportingRef = useRef(false);

  useEffect(() => () => clearTimeout(exportResetRef.current), []);

  // The server can't read storage, so the last session's card comes back right after hydration.
  useEffect(() => {
    const saved = loadStudio();
    if (saved) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- a lazy initializer would mismatch the server HTML
      setSource(saved.source);
      setPlatform(saved.platform);
      setInput(saved.input);
      setProfile(saved.profile);
      setImage(saved.image);
      setImageStyle(saved.imageStyle);
      setOptions({ ...defaultOptions(saved.profile.platform), ...saved.options });
      setBackdrop(saved.backdrop);
      setTune(saved.tune);
      setEffects(saved.effects);
      setFormatId(saved.formatId);
    }
    setRestored(true);
  }, []);

  // Saves a beat after edits settle, and on pagehide so a refresh mid-typing keeps the last keystroke.
  useEffect(() => {
    if (!restored) return;
    const save = () =>
      saveStudio({ source, platform, input, profile, image, imageStyle, options, backdrop, tune, effects, formatId });
    const timer = setTimeout(save, 300);
    window.addEventListener("pagehide", save);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pagehide", save);
    };
  }, [restored, source, platform, input, profile, image, imageStyle, options, backdrop, tune, effects, formatId]);

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

  const upload = "upload" in backdrop ? backdrop.upload : null;

  // Blurs an uploaded background in script once the slider settles. Until then the preview uses a CSS blur.
  useEffect(() => {
    if (!upload || !tune.blur) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      blurImage(upload, tune.blur, format).then(
        (url) => !cancelled && setBlurredUpload({ src: upload, radius: tune.blur, formatId: format.id, url }),
        () => {},
      );
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [upload, tune.blur, format]);

  const config = PLATFORMS[platform];
  const cardConfig = PLATFORMS[profile.platform];
  const tuned = tunedBackdrop(
    backdrop,
    tune,
    blurredUpload?.src === upload && blurredUpload.radius === tune.blur && blurredUpload.formatId === format.id
      ? blurredUpload.url
      : undefined,
  );
  const tunable = tunableParts(backdrop);
  // Hidden spinners stop, so nothing animates off-screen while the studio is idle.
  const spinning = exportState !== "idle";
  const fileName = `kado-${image ? "image" : profile.handle}-${format.id}.png`;
  // The tabs that take typed input share one pill: a platform handle, or a website address.
  const field =
    source === "profile"
      ? {
          prefix: config.prefix,
          placeholder: config.placeholder,
          label: `${config.label} handle`,
          hint: `Your ${config.label} handle goes here`,
          value: input,
        }
      : source === "website"
        ? {
            prefix: "https://",
            placeholder: "yoursite.com",
            label: "Website address",
            hint: "Your website goes here",
            value: site,
          }
        : null;
  // The card's width on the frame, in CSS px; the size slider reads it back as a share of the frame.
  const shownWidth = image ? imageCardWidth(image, imageStyle, options.size, format) : cardWidth(options.size, format);

  function showProfile(next: Profile) {
    setProfile(next);
    setImage(null);
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

  /**
   * Puts a dropped, pasted, picked or captured image in the card, keeping the current style, background and
   * effects. `source` is the tab it came from.
   */
  async function openImage(file: File, from: Source = "image") {
    setError(null);
    if (!isImageFile(file)) {
      setError(NOT_AN_IMAGE);
      return;
    }
    try {
      setImage(await readCardImage(file));
    } catch {
      setError("That image couldn't be opened. Try a PNG, JPEG or WebP.");
      return;
    }
    setSource(from);
    setGeneration((g) => g + 1);
    scrollToStudio();
  }

  /** Captures the top of a web page on the capture server, then treats it like any other image. */
  async function captureSite(event: React.FormEvent) {
    event.preventDefault();
    const address = site.trim();
    if (!address) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${CAPTURE_URL}/api/capture?url=${encodeURIComponent(address)}`).catch(() => {
        throw new Error("Couldn't reach the capture server. Try again in a moment.");
      });
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Couldn't capture that site.");
      const blob = await res.blob();
      await openImage(new File([blob], "website.jpg", { type: blob.type }), "website");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const onDrop = useEffectEvent((file: File) => openImage(file));

  // An image dragged onto any part of the page, or pasted outside a text field, goes into the card.
  useEffect(() => {
    // dragenter and dragleave fire for every element crossed, so count them to know when the drag leaves the page.
    let depth = 0;
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes("Files") ?? false;
    function enter(e: DragEvent) {
      if (!hasFiles(e)) return;
      depth++;
      setDragging(true);
    }
    function over(e: DragEvent) {
      if (!hasFiles(e)) return;
      // Without this the browser opens the file in place of the page.
      e.preventDefault();
      e.dataTransfer!.dropEffect = "copy";
    }
    function leave(e: DragEvent) {
      if (!hasFiles(e)) return;
      depth = Math.max(0, depth - 1);
      if (!depth) setDragging(false);
    }
    function drop(e: DragEvent) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const files = [...e.dataTransfer!.files];
      const file = files.find(isImageFile);
      if (file) onDrop(file);
      else if (files.length) setError(NOT_AN_IMAGE);
    }
    function paste(e: ClipboardEvent) {
      const file = [...(e.clipboardData?.files ?? [])].find(isImageFile);
      // A text field keeps its normal paste whenever the clipboard holds text as well.
      if (!file || (isTextField(e.target) && e.clipboardData?.types.includes("text/plain"))) return;
      e.preventDefault();
      onDrop(file);
    }
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    window.addEventListener("paste", paste);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
      window.removeEventListener("paste", paste);
    };
  }, []);

  async function generate(event: React.FormEvent) {
    event.preventDefault();
    const handle = normalizeHandle(input);
    if (!handle) return;
    setError(null);

    setLoading(true);
    try {
      const res = await fetch(`/api/profile/${config.id}/${encodeURIComponent(handle)}`);
      const data = await res.json();
      // Instagram often hides profile data; fall back to a card the user fills in under Card.
      if (!res.ok && config.id === "instagram" && res.status !== 400) {
        showProfile(blankProfile(config.id, handle));
        setTab("card");
        scrollToStudio();
        setError(data.error ?? "Couldn't read that Instagram profile, so fill in the details yourself.");
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      showProfile(data as Profile);
      scrollToStudio();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  // Adjustments belong to the background they were made on, so a new pick starts from its own defaults.
  function pickBackdrop(next: BackdropChoice) {
    setBackdrop(next);
    setTune(defaultTune(next));
  }

  // Each tab opens at its top: on desktop the inspector's own scroll resets; on phones the page scrolls back
  // until the panel starts just under the pinned tabs.
  function selectTab(next: InspectorTab) {
    setTab(next);
    const panel = panelRef.current;
    const tabs = tabsRef.current;
    if (!panel || !tabs) return;
    panel.scrollTop = 0;
    const hidden = tabs.getBoundingClientRect().bottom - panel.getBoundingClientRect().top;
    if (hidden > 0) window.scrollBy({ top: -hidden });
  }

  /** Takes on a preset's whole look. The format and what's on the card stay as they are. */
  function applyPreset(preset: Preset) {
    const look = presetLook(preset, !!image);
    setBackdrop(look.backdrop);
    setTune(look.tune);
    setEffects(look.effects);
    setOptions((o) => ({ ...o, style: preset.style, theme: look.theme, size: look.size }));
    setImageStyle(preset.image.style);
  }

  /** Whether the studio shows a preset untouched, so its tile can read as picked. */
  function isPresetActive(preset: Preset) {
    const look = presetLook(preset, !!image);
    return (
      "id" in backdrop &&
      backdrop.id === preset.backdrop &&
      !differs(tune, look.tune) &&
      !differs(effects, look.effects) &&
      options.theme === look.theme &&
      options.size === look.size &&
      (image ? imageStyle === preset.image.style : options.style === preset.style)
    );
  }

  /** The card with these settings, sized for the current format: the preview's, or a preset's miniature. */
  function renderCard(look: { options: CardOptions; imageStyle: ImageStyle; effects: CardEffects; darkBackdrop: boolean }) {
    return image ? (
      <ImageCard
        image={image}
        style={look.imageStyle}
        theme={look.options.theme}
        width={imageCardWidth(image, look.imageStyle, look.options.size, format)}
        effects={look.effects}
        darkBackdrop={look.darkBackdrop}
      />
    ) : (
      <ProfileCard
        profile={profile}
        options={look.options}
        width={cardWidth(look.options.size, format)}
        effects={look.effects}
        darkBackdrop={look.darkBackdrop}
      />
    );
  }

  function updateTune(patch: Partial<BackdropTune>) {
    setTune((t) => ({ ...t, ...patch }));
  }

  function updateEffects(patch: Partial<CardEffects>) {
    setEffects((e) => ({ ...e, ...patch }));
  }

  function updateProfile(patch: Partial<Profile>) {
    setProfile((p) => ({ ...p, ...patch }));
  }

  function updateStat(key: string, value: number) {
    setProfile((p) => ({ ...p, stats: p.stats.map((s) => (s.key === key ? { ...s, value } : s)) }));
  }

  async function exportImage(mode: "copy" | "download") {
    const node = canvasRef.current;
    // One render at a time: another tap mid-render would save the image twice, and the first render's
    // cleanup would bring the iOS shadow back while the second is still working. The spinner keeps going.
    if (!node || exportingRef.current) return;
    exportingRef.current = true;
    const opts = {
      pixelRatio: EXPORT_SCALE,
      cacheBust: true,
      // Every proxied image is `/api/image?url=…`; without the query, they all share one cache entry,
      // so a banner can come out as the avatar, or a new profile as the last one exported.
      includeQueryParams: true,
      width: format.width,
      height: format.height,
    };
    // Enough room around a tilted card for its strongest shadow to fade out.
    const shadowRoom = Math.ceil(24 + effects.shadow * 1.2);
    const download = (blob: Blob) => {
      // iOS Safari asks before downloading and does nothing when the answer is Download for a
      // multi-megabyte data: URL. A blob URL works, as long as it outlives that prompt, so each one
      // is kept until the next download replaces it.
      if (downloadUrlRef.current) URL.revokeObjectURL(downloadUrlRef.current);
      downloadUrlRef.current = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = fileName;
      link.href = downloadUrlRef.current;
      link.click();
      setExportState("saved");
    };
    // A second export must not be cut short by the first one's pending reset.
    clearTimeout(exportResetRef.current);
    try {
      if (mode === "copy") {
        setExportState("copying");
        const blob = renderFrame(node, opts, shadowRoom).then(pngBlob);
        try {
          // Pass a promise so Safari keeps the user-gesture context while rendering.
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          setExportState("copied");
        } catch {
          // The clipboard only exists on https and localhost, and a browser may still refuse the write.
          // The image goes out as a download instead.
          download(await blob);
        }
      } else {
        setExportState("saving");
        download(await pngBlob(await renderFrame(node, opts, shadowRoom)));
      }
    } catch {
      setError("The image couldn't be rendered. Try a different background image.");
      setExportState("idle");
      return;
    } finally {
      exportingRef.current = false;
    }
    exportResetRef.current = setTimeout(() => setExportState("idle"), 1800);
  }

  return (
    <>
      <section className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 pt-14 text-center sm:pt-20">
        {/* Above the fold, so the entrance plays on first paint, staggered 50ms per chunk. */}
        {/* A size container, so the headline's type can scale to fit its longest line at any width. */}
        <Reveal immediate className="w-full @container">
          <HeroTitle />
        </Reveal>
        <Reveal immediate delay={50}>
          <p className="mt-6 max-w-[560px] text-[17px] leading-relaxed tracking-[-0.01em] text-muted sm:text-lg">
            Drop a screenshot, paste a link or pick a profile. Kado turns it into a{" "}
            <span className="marker whitespace-nowrap">share-ready card</span>, sized for every feed.
          </p>
        </Reveal>

        <Reveal immediate delay={100} className="w-full max-w-md sm:w-auto sm:max-w-none">
          {/* Three equal tabs, one pill row at every width. The platforms live in the Profile pill's menu. */}
          <div className="relative mt-9 grid w-full grid-cols-3 rounded-full bg-well p-1 sm:w-[360px]">
            <span
              aria-hidden
              className="pointer-events-none absolute top-1 bottom-1 left-1 w-[calc((100%-8px)/3)] rounded-full bg-white shadow-[0_1px_2px_rgba(42,42,39,.12)] transition-transform duration-200 ease-in-out motion-reduce:transition-none"
              style={{ transform: `translateX(${SOURCES.indexOf(source) * 100}%)` }}
            />
            {SOURCES.map((id) => {
              const { label, Icon } = SOURCE_TABS[id];
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setSource(id);
                    setError(null);
                  }}
                  aria-pressed={source === id}
                  className={clsx(
                    "relative z-10 flex items-center justify-center gap-1.5 rounded-full px-2 py-2 text-[13px] transition-[color] sm:text-sm",
                    source === id ? "font-medium text-ink" : "text-muted hover:text-ink",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {label}
                </button>
              );
            })}
          </div>
        </Reveal>

        {/* Its entrance makes it a stacking context, so it's lifted whole to keep the platform menu above the hint and studio. */}
        <Reveal immediate delay={150} className="relative z-30 w-full max-w-md">
          {field ? (
            // The transparent border keeps an edge in forced-colors mode, which drops the ring.
            <form
              onSubmit={source === "profile" ? generate : captureSite}
              className={clsx(
                "group relative mt-3 flex w-full max-w-md items-center gap-2 rounded-full border border-transparent bg-white py-1.5 pr-1.5 shadow-[0_1px_2px_rgba(42,42,39,.08),0_8px_24px_-12px_rgba(42,42,39,.25)] ring-1 ring-black/[.06] transition-[box-shadow] focus-within:ring-black/20",
                source === "profile" ? "pl-1.5" : "pl-4 sm:pl-5",
              )}
            >
              {source === "profile" && (
                <PlatformPicker
                  value={platform}
                  onChange={(next) => {
                    setPlatform(next);
                    setError(null);
                    handleRef.current?.focus();
                  }}
                />
              )}
              {/* Phones show just "@" before a handle, which leaves the input room beside the menu button. */}
              <span className="shrink-0 text-[14px] text-muted sm:text-[15px]">
                {source === "profile" ? (
                  <>
                    <span className="sm:hidden">@</span>
                    <span className="hidden sm:inline">{field.prefix}</span>
                  </>
                ) : (
                  field.prefix
                )}
              </span>
              <input
                ref={handleRef}
                value={field.value}
                onChange={(e) =>
                  // A pasted profile link is fine as it is; a pasted website drops the https:// already shown.
                  source === "profile" ? setInput(e.target.value) : setSite(e.target.value.replace(/^https?:\/\//i, ""))
                }
                placeholder={field.placeholder}
                aria-label={field.label}
                inputMode={source === "website" ? "url" : undefined}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent text-base font-medium sm:text-[15px] outline-none focus-visible:outline-none placeholder:font-normal placeholder:text-black/25"
              />
              {/* The spinner cross-fades over the label instead of widening the button. */}
              <button
                type="submit"
                disabled={loading || !field.value.trim()}
                aria-busy={loading}
                className="press grid shrink-0 place-items-center rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-white transition-[background-color,opacity,scale] hover:bg-black disabled:opacity-35 sm:px-5"
              >
                <span className={clsx("[grid-area:1/1] transition-opacity", loading && "opacity-0")}>Make card</span>
                <span aria-hidden className={clsx("[grid-area:1/1] transition-opacity", !loading && "opacity-0")}>
                  <Loader2 className={clsx("h-4 w-4", loading && "animate-spin")} strokeWidth={2} absoluteStrokeWidth />
                </span>
              </button>
              <HintCursor label={field.hint} hidden={!!field.value} />
            </form>
          ) : (
            // Same pill as the handle form, so switching tabs never shifts the page. The whole pill opens the
            // file picker; a drop or paste anywhere on the page works too.
            <label
              className={clsx(
                "group relative mt-3 flex w-full max-w-md cursor-pointer items-center gap-2.5 rounded-full border border-transparent bg-white py-1.5 pr-1.5 pl-4 shadow-[0_1px_2px_rgba(42,42,39,.08),0_8px_24px_-12px_rgba(42,42,39,.25)] ring-1 transition-[box-shadow] sm:pl-5",
                FILE_FOCUS,
                dragging ? "ring-2 ring-focus" : "ring-black/[.06] hover:ring-black/20",
              )}
            >
              <ImagePlus className="h-4 w-4 shrink-0 text-muted" strokeWidth={1.5} absoluteStrokeWidth />
              <span className="min-w-0 flex-1 truncate text-left text-[14px] text-muted sm:text-[15px]">
                {dragging ? (
                  "Drop it to make a card"
                ) : (
                  <>
                    <span className="sm:hidden">Screenshot or photo</span>
                    <span className="hidden sm:inline">Drop or paste a screenshot</span>
                  </>
                )}
              </span>
              <span className="press grid shrink-0 place-items-center rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-white transition-[background-color,scale] group-hover:bg-black sm:px-5">
                Open image
              </span>
              <input
                type="file"
                accept="image/*"
                aria-label="Open an image"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  // Clear the value so picking the same file again still fires.
                  e.target.value = "";
                  if (file) openImage(file);
                }}
              />
              <HintCursor label="Your screenshot goes here" hidden={dragging} />
            </label>
          )}
        </Reveal>

        <Reveal immediate delay={200}>
          <p aria-live="polite" className={clsx("mt-5 min-h-5 text-sm", error ? "text-red-600" : "text-muted")}>
            {error ??
              (source === "profile"
                ? `We pull your public ${config.label} profile. Nothing is stored.`
                : source === "website"
                  ? loading
                    ? "Capturing the page. This takes a few seconds."
                    : "We capture the top of the page, as a 1440 × 900 browser window shows it."
                  : "Your image stays in your browser. Nothing is uploaded.")}
          </p>
        </Reveal>
      </section>

      <section ref={studioRef} id="studio" className="mx-auto mt-10 w-full max-w-7xl scroll-mt-4 px-2 sm:px-4">
        <h2 className="sr-only">Card studio</h2>
        <Reveal>
          {/* Outer radius = window radius (16) + padding (8) on phones; from sm the padding passes 24px and the two read as separate surfaces. */}
          <div
            className="rounded-3xl p-2 sm:rounded-[28px] sm:p-7 lg:p-8"
            style={{
              background:
                "radial-gradient(ellipse 70% 80% at 0% 0%, #e6dcff 0%, transparent 60%), radial-gradient(ellipse 70% 80% at 100% 100%, #fbd9e8 0%, transparent 60%), #efebf7",
            }}
          >
            <div className="overflow-clip rounded-2xl border border-transparent bg-white shadow-[0_1px_2px_rgba(42,42,39,.06),0_30px_60px_-30px_rgba(60,40,120,.35)] ring-1 ring-black/[.05]">
              <div className="flex items-center gap-3 border-b border-black/[.06] px-4 py-3">
                <div className="flex gap-1.5" aria-hidden>
                  <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                  <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
                  <span className="h-3 w-3 rounded-full bg-[#28c840]" />
                </div>
                <span className="flex-1 truncate text-center font-mono text-xs text-muted">
                  {fileName} · {format.width * EXPORT_SCALE}×{format.height * EXPORT_SCALE}
                </span>
                <button
                  type="button"
                  title="Back to the sample card"
                  aria-label="Back to the sample card"
                  onClick={() => {
                    showProfile(SAMPLE);
                    setInput("");
                  }}
                  className="press -m-1.5 rounded-md p-1.5 text-muted transition-[color,scale] hover:text-ink"
                >
                  <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} absoluteStrokeWidth />
                </button>
              </div>

              {/* Fixed-height body on desktop: the inspector scrolls on its own instead of stretching the window.
                  Stacked below lg, where the preview sticks to the top so every tweak stays in view. */}
              <div className="flex flex-col lg:grid lg:h-[min(660px,calc(100svh-120px))] lg:grid-cols-[1fr_320px]">
                <div className="preview-surface sticky top-0 z-20 flex h-[250px] border-b border-black/[.06] p-4 sm:h-[400px] sm:p-6 lg:relative lg:h-full lg:border-b-0 lg:p-8">
                  <div ref={previewRef} className="flex min-h-0 min-w-0 flex-1 items-center justify-center">
                    {/* Outlined like an image: an inset hairline that never changes the frame's size. */}
                    <div
                      className="relative shrink-0 overflow-hidden rounded-xl outline-1 -outline-offset-1 outline-black/10"
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
                        <Scene ref={canvasRef} format={format} backdrop={tuned}>
                          {/* Only freshly generated cards settle in; the sample shows without a second entrance. */}
                          <div key={generation} className={clsx("relative", generation > 0 && "card-in")}>
                            {renderCard({ options, imageStyle, effects, darkBackdrop: isDarkBackdrop(backdrop) })}
                          </div>
                        </Scene>
                      </div>
                    </div>
                  </div>

                  {/* While a file is dragged over the page, the preview says where it will land. */}
                  <div
                    aria-hidden
                    className={clsx(
                      "pointer-events-none absolute inset-2 flex items-center justify-center rounded-xl border-[1.5px] border-dashed border-ink/25 bg-white/70 transition-opacity duration-200 sm:inset-3",
                      dragging ? "opacity-100" : "opacity-0",
                    )}
                  >
                    <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium shadow-[0_1px_2px_rgba(42,42,39,.08),0_8px_24px_-12px_rgba(42,42,39,.25)] ring-1 ring-black/[.06]">
                      <ImagePlus className="h-4 w-4 text-muted" strokeWidth={1.5} absoluteStrokeWidth />
                      Drop it to make a card
                    </span>
                  </div>
                </div>

                <aside className="flex min-h-0 flex-col text-sm lg:border-l lg:border-black/[.06]">
                  <InspectorTabs ref={tabsRef} value={tab} onChange={selectTab} />
                  {/* Its own scroll box only on desktop: on phones an empty overflow box with overscroll-contain swallows page swipes. */}
                  <div
                    ref={panelRef}
                    id="inspector-panel"
                    role="tabpanel"
                    aria-labelledby={`inspector-tab-${tab}`}
                    className="divide-y divide-black/[.06] lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain"
                  >
                    {tab === "presets" && (
                      <div className="flex flex-col gap-3 px-5 py-4">
                        <p className="text-muted">Pick a look, then fine-tune it under Card and Canvas.</p>
                        <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 lg:grid-cols-2">
                          {PRESETS.map((preset) => {
                            const look = presetLook(preset, !!image);
                            return (
                              <PresetTile
                                key={preset.id}
                                label={preset.label}
                                frame={format}
                                selected={isPresetActive(preset)}
                                onClick={() => applyPreset(preset)}
                              >
                                <Scene format={format} backdrop={tunedBackdrop(look.backdrop, look.tune)}>
                                  {renderCard({
                                    options: { ...options, style: preset.style, theme: look.theme, size: look.size },
                                    imageStyle: preset.image.style,
                                    effects: look.effects,
                                    darkBackdrop: isDarkBackdrop(look.backdrop),
                                  })}
                                </Scene>
                              </PresetTile>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {tab === "card" && (
                      <>
                        <InspectorSection title="Style">
                          {image ? (
                            <Segmented value={imageStyle} values={IMAGE_STYLES} labels={IMAGE_STYLE_LABELS} onChange={setImageStyle} />
                          ) : (
                            <Segmented
                              value={options.style}
                              values={STYLES.map((s) => s.id)}
                              labels={Object.fromEntries(STYLES.map((s) => [s.id, s.label]))}
                              onChange={(style) => setOptions((o) => ({ ...o, style }))}
                            />
                          )}
                        </InspectorSection>

                        <InspectorSection
                          title="Layout"
                          action={
                            options.size !== DEFAULT_SIZE && (
                              <ResetButton label="card size" onClick={() => setOptions((o) => ({ ...o, size: DEFAULT_SIZE }))} />
                            )
                          }
                        >
                          <Segmented
                            value={options.theme}
                            values={["light", "dark"] as const}
                            labels={{ light: "Light", dark: "Dark" }}
                            onChange={(theme) => setOptions((o) => ({ ...o, theme }))}
                          />
                          {/* An image sets its own proportions. */}
                          {!image && options.style !== "ticket" && (
                            <Segmented
                              value={options.shape}
                              values={["square", "rectangle"] as CardShape[]}
                              labels={{ square: "Square", rectangle: "Rectangle" }}
                              onChange={(shape) => setOptions((o) => ({ ...o, shape }))}
                            />
                          )}
                          <Slider
                            label="Size"
                            value={options.size}
                            min={0}
                            max={100}
                            // Reads as how much of the frame's width the card covers, which means the same on every format.
                            format={() => `${Math.round((shownWidth / format.width) * 100)}%`}
                            onChange={(size) => setOptions((o) => ({ ...o, size }))}
                          />
                        </InspectorSection>

                        <InspectorSection title="Frame">
                          <Segmented
                            value={effects.frame}
                            values={FRAME_STYLES}
                            labels={{ none: "None", glass: "Glass", solid: "Solid", line: "Line" }}
                            onChange={(frame) => updateEffects({ frame })}
                          />
                          <Slider
                            label="Width"
                            value={effects.frameWidth}
                            min={4}
                            max={32}
                            disabled={effects.frame === "none"}
                            format={String}
                            onChange={(frameWidth) => updateEffects({ frameWidth })}
                          />
                        </InspectorSection>

                        <InspectorSection
                          title="Shadow and tilt"
                          action={
                            differs(effects, DEFAULT_EFFECTS, DEPTH_KEYS) && (
                              <ResetButton
                                label="shadow and tilt"
                                onClick={() =>
                                  updateEffects(Object.fromEntries(DEPTH_KEYS.map((key) => [key, DEFAULT_EFFECTS[key]])))
                                }
                              />
                            )
                          }
                        >
                          <div className="flex flex-col">
                            <Slider
                              label="Shadow"
                              value={effects.shadow}
                              min={0}
                              max={100}
                              format={(v) => `${v}%`}
                              onChange={(shadow) => updateEffects({ shadow })}
                            />
                            <Slider
                              label="Rotate"
                              value={effects.rotate}
                              min={-30}
                              max={30}
                              format={signed("°")}
                              onChange={(rotate) => updateEffects({ rotate })}
                            />
                            <Slider
                              label="Tilt X"
                              value={effects.tiltX}
                              min={-40}
                              max={40}
                              format={signed("°")}
                              onChange={(tiltX) => updateEffects({ tiltX })}
                            />
                            <Slider
                              label="Tilt Y"
                              value={effects.tiltY}
                              min={-40}
                              max={40}
                              format={signed("°")}
                              onChange={(tiltY) => updateEffects({ tiltY })}
                            />
                          </div>
                        </InspectorSection>

                        {image ? (
                          <InspectorSection title="Image">
                            <div className="flex items-center gap-3">
                              {/* eslint-disable-next-line @next/next/no-img-element -- a data URL thumbnail */}
                              <img src={image.src} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover ring-1 ring-black/10" />
                              <div className="min-w-0 leading-snug">
                                <div className="font-mono text-xs tabular-nums">
                                  {image.width} × {image.height}
                                </div>
                                <div className="text-xs text-muted">Drop or paste another to swap it.</div>
                              </div>
                            </div>
                            <div className="flex">
                              <ImageInput label="Replace image" onFile={openImage} />
                            </div>
                          </InspectorSection>
                        ) : (
                          <>
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

                            <details className="group">
                              <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 font-medium [&::-webkit-details-marker]:hidden">
                                Edit details
                                <ChevronDown
                                  className="h-4 w-4 text-muted transition-[rotate] duration-200 ease-in-out group-open:rotate-180 motion-reduce:transition-none"
                                  strokeWidth={2}
                                  absoluteStrokeWidth
                                />
                              </summary>
                              <div className="flex flex-col gap-3 px-5 pb-5">
                                <Field label="Name" value={profile.name} onChange={(name) => updateProfile({ name })} />
                                <Field
                                  label="Bio"
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
                                  <ImageInput
                                    label="Upload photo"
                                    onFile={async (file) => updateProfile({ avatarUrl: await readFile(file) })}
                                  />
                                  {cardConfig.hasBanner && (
                                    <ImageInput
                                      label="Upload banner"
                                      onFile={async (file) => updateProfile({ bannerUrl: await readFile(file) })}
                                    />
                                  )}
                                </div>
                                <Switch
                                  label="Account is verified"
                                  checked={profile.verified}
                                  onChange={(verified) => updateProfile({ verified })}
                                />
                              </div>
                            </details>
                          </>
                        )}
                      </>
                    )}

                    {tab === "canvas" && (
                      <>
                        <InspectorSection title="Format">
                          <div className="flex flex-col gap-0.5">
                            {FORMATS.map((f) => (
                              <button
                                key={f.id}
                                type="button"
                                aria-pressed={f.id === format.id}
                                onClick={() => setFormatId(f.id)}
                                className={clsx(
                                  "flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-[color,background-color] lg:py-1.5",
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

                        <InspectorSection
                          title="Background"
                          action={
                            differs(tune, defaultTune(backdrop)) && (
                              <ResetButton label="background adjustments" onClick={() => setTune(defaultTune(backdrop))} />
                            )
                          }
                        >
                          <div className="grid grid-cols-8 gap-1.5 lg:grid-cols-4">
                            {BACKDROPS.map((b) => (
                              <button
                                key={b.id}
                                type="button"
                                title={b.label}
                                aria-label={`${b.label} background`}
                                aria-pressed={"id" in backdrop && backdrop.id === b.id}
                                onClick={() => pickBackdrop(b)}
                                className={clsx(
                                  "press aspect-square rounded-lg ring-offset-2 transition-[box-shadow,scale]",
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
                                "press flex aspect-square cursor-pointer items-center justify-center rounded-lg text-muted ring-offset-2 transition-[color,box-shadow,scale] hover:text-ink",
                                FILE_FOCUS,
                                "upload" in backdrop ? "ring-2 ring-ink" : "border border-dashed border-black/20",
                              )}
                            >
                              <ImagePlus className="h-4 w-4" strokeWidth={1.5} absoluteStrokeWidth />
                              <span className="sr-only">Upload a background image</span>
                              <input
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  // Clear the value so picking the same file again still fires.
                                  e.target.value = "";
                                  if (!file) return;
                                  const image = await readFile(file);
                                  pickBackdrop({ upload: image, dark: await isDarkImage(image) });
                                }}
                              />
                            </label>
                          </div>
                          <div className="flex flex-col">
                            <Slider
                              label="Hue"
                              value={tune.hue}
                              min={0}
                              max={359}
                              track={hueTrack(backdrop)}
                              disabled={!tunable.hue}
                              format={(v) => `${v}°`}
                              onChange={(hue) => updateTune({ hue })}
                            />
                            <Slider
                              label="Intensity"
                              value={tune.intensity}
                              min={-100}
                              max={100}
                              disabled={!tunable.intensity}
                              format={signed("%")}
                              onChange={(intensity) => updateTune({ intensity })}
                            />
                            <Slider
                              label="Blur"
                              value={tune.blur}
                              min={0}
                              max={60}
                              disabled={!tunable.blur}
                              format={(v) => `${v}px`}
                              onChange={(blur) => updateTune({ blur })}
                            />
                            <Slider
                              label="Grain"
                              value={tune.grain}
                              min={0}
                              max={100}
                              format={(v) => `${v}%`}
                              onChange={(grain) => updateTune({ grain })}
                            />
                          </div>
                        </InspectorSection>
                      </>
                    )}
                  </div>

                  <div className="sticky bottom-0 z-10 flex gap-2 border-t border-black/[.06] bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:static">
                    <button
                      type="button"
                      onClick={() => exportImage("download")}
                      className="press flex flex-1 items-center justify-center gap-2 rounded-full border border-transparent bg-ink px-4 py-2.5 font-medium text-white transition-[background-color,scale] hover:bg-black"
                    >
                      <IconSwap
                        active={exportState === "saving" ? "busy" : exportState === "saved" ? "done" : "idle"}
                        icons={{
                          idle: <Download className="h-4 w-4" strokeWidth={2} absoluteStrokeWidth />,
                          busy: <Loader2 className={clsx("h-4 w-4", spinning && "animate-spin")} strokeWidth={2} absoluteStrokeWidth />,
                          done: <Check className="h-4 w-4" strokeWidth={2} absoluteStrokeWidth />,
                        }}
                      />
                      {exportState === "saved" ? "Downloaded" : "Download"}
                    </button>
                    <button
                      type="button"
                      onClick={() => exportImage("copy")}
                      className="press flex flex-1 items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5 font-medium transition-[background-color,scale] hover:bg-well"
                    >
                      <IconSwap
                        active={exportState === "copying" ? "busy" : exportState === "copied" ? "done" : "idle"}
                        icons={{
                          idle: <Copy className="h-4 w-4" strokeWidth={2} absoluteStrokeWidth />,
                          busy: <Loader2 className={clsx("h-4 w-4", spinning && "animate-spin")} strokeWidth={2} absoluteStrokeWidth />,
                          done: <Check className="h-4 w-4 text-emerald-600" strokeWidth={2} absoluteStrokeWidth />,
                        }}
                      />
                      {exportState === "copied" ? "Copied" : "Copy"}
                    </button>
                  </div>
                </aside>
              </div>
            </div>
          </div>

        </Reveal>

        <Reveal delay={50}>
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
        </Reveal>
      </section>
    </>
  );
}

/**
 * The groups of settings, pinned above them: in their own row on desktop, under the sticky preview on phones.
 * Arrow keys move between tabs, as in any tab list.
 */
function InspectorTabs({
  value,
  onChange,
  ref,
}: {
  value: InspectorTab;
  onChange: (tab: InspectorTab) => void;
  ref: React.Ref<HTMLDivElement>;
}) {
  const index = INSPECTOR_TABS.findIndex((t) => t.id === value);

  function onKeyDown(e: React.KeyboardEvent) {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = INSPECTOR_TABS[(index + step + INSPECTOR_TABS.length) % INSPECTOR_TABS.length].id;
    onChange(next);
    document.getElementById(`inspector-tab-${next}`)?.focus();
  }

  return (
    <div
      ref={ref}
      role="tablist"
      aria-label="Settings"
      onKeyDown={onKeyDown}
      className="sticky top-[250px] z-10 flex border-b border-black/[.06] bg-white px-2 sm:top-[400px] lg:relative lg:top-0"
    >
      {INSPECTOR_TABS.map((t) => (
        <button
          key={t.id}
          id={`inspector-tab-${t.id}`}
          type="button"
          role="tab"
          aria-selected={t.id === value}
          aria-controls="inspector-panel"
          tabIndex={t.id === value ? 0 : -1}
          onClick={() => onChange(t.id)}
          className={clsx(
            "flex-1 py-3 text-[13px] transition-[color]",
            t.id === value ? "font-medium text-ink" : "text-muted hover:text-ink",
          )}
        >
          {t.label}
        </button>
      ))}
      {/* One underline slides between the tabs, like the pill in the platform tabs. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-px left-2 px-4 transition-transform duration-200 ease-in-out motion-reduce:transition-none"
        style={{ width: `calc((100% - 16px) / ${INSPECTOR_TABS.length})`, transform: `translateX(${index * 100}%)` }}
      >
        <span className="block h-0.5 rounded-full bg-ink" />
      </span>
    </div>
  );
}

/** The frame at its full export size: the tuned background, its grain, and the card on top. */
function Scene({
  format,
  backdrop,
  ref,
  children,
}: {
  format: { width: number; height: number };
  backdrop: ReturnType<typeof tunedBackdrop>;
  ref?: React.Ref<HTMLDivElement>;
  children: React.ReactNode;
}) {
  return (
    <div
      ref={ref}
      className="relative isolate flex items-center justify-center overflow-hidden"
      style={{ width: format.width, height: format.height }}
    >
      <div aria-hidden className="absolute" style={backdrop.layer} />
      {backdrop.grain && <div aria-hidden className="absolute inset-0" style={backdrop.grain} />}
      {children}
    </div>
  );
}

/** A preset drawn as a live miniature of the frame, so every tile previews the real card in that look. */
function PresetTile({
  label,
  frame,
  selected,
  onClick,
  children,
}: {
  label: string;
  frame: { width: number; height: number };
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const tileRef = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = tileRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const scale = width / frame.width;
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      onClick={onClick}
      className="press group flex flex-col gap-1.5 text-left transition-[scale]"
    >
      <span
        ref={tileRef}
        aria-hidden
        className={clsx(
          "pointer-events-none relative block w-full overflow-hidden rounded-lg ring-offset-2 transition-[box-shadow]",
          selected ? "ring-2 ring-ink" : "ring-1 ring-black/10 group-hover:ring-black/25",
        )}
        style={{ aspectRatio: `${frame.width} / ${frame.height}` }}
      >
        {/* Drawn once measured, which also keeps the miniatures out of the server HTML. */}
        {scale > 0 && (
          <span className="absolute top-0 left-0 origin-top-left" style={{ transform: `scale(${scale})` }}>
            {children}
          </span>
        )}
      </span>
      <span className={clsx("text-xs", selected ? "font-medium text-ink" : "text-muted")}>{label}</span>
    </button>
  );
}

/**
 * The platform switch at the start of the Profile pill: its icon opens a menu of the platforms we pull from.
 * Arrow keys move through the menu, Enter picks, Escape closes it.
 */
function PlatformPicker({ value, onChange }: { value: PlatformId; onChange: (platform: PlatformId) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const Icon = PLATFORM_ICONS[value];

  // A press anywhere outside closes it.
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  // It opens on the platform already picked, so Enter keeps it.
  useEffect(() => {
    if (open) itemRefs.current[PLATFORM_ORDER.indexOf(value)]?.focus();
  }, [open, value]);

  function pick(platform: PlatformId) {
    setOpen(false);
    onChange(platform);
  }

  function onMenuKeyDown(e: React.KeyboardEvent) {
    const items = itemRefs.current;
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const focus = (index: number) => items[(index + items.length) % items.length]?.focus();
    if (e.key === "ArrowDown") focus(at + 1);
    else if (e.key === "ArrowUp") focus(at - 1);
    else if (e.key === "Home") focus(0);
    else if (e.key === "End") focus(items.length - 1);
    else if (e.key === "Escape") {
      setOpen(false);
      buttonRef.current?.focus();
    } else {
      if (e.key === "Tab") setOpen(false);
      return;
    }
    e.preventDefault();
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Platform: ${PLATFORMS[value].label}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
          e.preventDefault();
          setOpen(true);
        }}
        className="press flex items-center gap-1 rounded-full py-2 pr-2 pl-2.5 transition-[background-color,scale] hover:bg-well aria-expanded:bg-well"
      >
        <Icon className="h-4 w-4" />
        <ChevronDown
          className={clsx(
            "h-3.5 w-3.5 text-muted transition-[rotate] duration-200 ease-in-out motion-reduce:transition-none",
            open && "rotate-180",
          )}
          strokeWidth={2}
          absoluteStrokeWidth
        />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Platform"
          onKeyDown={onMenuKeyDown}
          className="menu-in absolute top-[calc(100%+10px)] -left-1 z-30 w-52 origin-top-left rounded-2xl border border-transparent bg-white p-1.5 text-left shadow-[0_1px_2px_rgba(42,42,39,.08),0_16px_40px_-12px_rgba(42,42,39,.35)] ring-1 ring-black/[.06]"
        >
          {PLATFORM_ORDER.map((id, index) => {
            const ItemIcon = PLATFORM_ICONS[id];
            return (
              <button
                key={id}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                type="button"
                role="menuitemradio"
                aria-checked={id === value}
                tabIndex={-1}
                onClick={() => pick(id)}
                // The highlight follows the pointer as well as the keys, so there's only ever one.
                onPointerEnter={(e) => e.currentTarget.focus()}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm outline-none transition-[background-color] focus:bg-well"
              >
                <ItemIcon className="h-4 w-4 shrink-0" />
                <span className={clsx("flex-1", id === value && "font-medium")}>{PLATFORMS[id].label}</span>
                {id === value && <Check className="h-4 w-4" strokeWidth={2} absoluteStrokeWidth />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Collaborator-style cursor pointing into the pill above it; leaves faster than it returns. */
function HintCursor({ label, hidden }: { label: string; hidden: boolean }) {
  return (
    <div
      aria-hidden
      className={clsx(
        "pointer-events-none absolute top-[54%] left-[31%] hidden transition-opacity group-focus-within:opacity-0 group-focus-within:duration-150 sm:block",
        hidden ? "opacity-0 duration-150" : "duration-300",
      )}
    >
      <div className="cursor-nudge flex items-start">
        <svg viewBox="0 0 20 22" className="h-[22px] w-5 drop-shadow-[0_2px_4px_rgba(60,40,140,.35)]">
          <path
            d="M2 2 L2 18 L6.5 13.8 L9.6 20.2 L12.4 18.9 L9.4 12.6 L15.6 12.4 Z"
            fill="#7c5cff"
            stroke="#fff"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
        </svg>
        <span className="mt-4 -ml-1 rounded-full rounded-tl-sm bg-[#7c5cff] px-2.5 py-1 text-xs font-medium whitespace-nowrap text-white shadow-[0_4px_12px_-4px_rgba(60,40,140,.5)]">
          {label}
        </span>
      </div>
    </div>
  );
}

function InspectorSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function ResetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    // The negative margin keeps the header the height of its title, so the button never shifts the section.
    <button
      type="button"
      aria-label={`Reset ${label}`}
      onClick={onClick}
      className="press -my-1 rounded-md px-1.5 py-1 text-xs text-muted transition-[color,scale] hover:text-ink"
    >
      Reset
    </button>
  );
}

/** A labelled range with its value alongside. The track fills from zero, or shows `track` instead. */
function Slider({
  label,
  value,
  min,
  max,
  format,
  onChange,
  disabled,
  track,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
  disabled?: boolean;
  track?: string;
}) {
  const at = (v: number) => ((v - min) / (max - min)) * 100;
  const zero = at(Math.min(max, Math.max(min, 0)));
  return (
    <label
      title={disabled ? "Doesn't apply to this background" : undefined}
      className={clsx("flex items-center gap-3 py-1.5", disabled && "opacity-40")}
    >
      <span className="w-[68px] shrink-0 text-muted">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        aria-label={label}
        aria-valuetext={format(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider min-w-0 flex-1"
        style={
          {
            "--fill-from": `${Math.min(zero, at(value))}%`,
            "--fill-to": `${Math.max(zero, at(value))}%`,
            ...(track && { "--track": track }),
          } as React.CSSProperties
        }
      />
      <span className="w-11 shrink-0 text-right font-mono text-xs text-muted tabular-nums">{format(value)}</span>
    </label>
  );
}

/** Cross-fades stacked icons on an infrequent state change, so the swap never resizes the button. */
function IconSwap({ active, icons }: { active: string; icons: Record<string, React.ReactNode> }) {
  return (
    <span aria-hidden className="grid place-items-center">
      {Object.entries(icons).map(([key, icon]) => (
        <span
          key={key}
          className={clsx(
            "[grid-area:1/1] transition-[opacity,filter,scale] duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
            "motion-reduce:scale-100 motion-reduce:blur-[0px]",
            key === active ? "scale-100 opacity-100 blur-[0px]" : "scale-[0.25] opacity-0 blur-[4px]",
          )}
        >
          {icon}
        </span>
      ))}
    </span>
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
  const selectedIndex = values.indexOf(value);
  return (
    <div
      className="relative grid rounded-full bg-well p-0.5"
      style={{ gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute top-0.5 bottom-0.5 left-0.5 rounded-full bg-white shadow-[0_1px_2px_rgba(42,42,39,.14)] transition-transform duration-200 ease-in-out motion-reduce:transition-none"
        style={{
          width: `calc((100% - 4px) / ${values.length})`,
          transform: `translateX(${selectedIndex * 100}%)`,
        }}
      />
      {values.map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={clsx(
            "relative z-10 rounded-full px-2 py-2 text-[13px] transition-[color] lg:py-1.5",
            value === v ? "font-medium text-ink" : "text-muted hover:text-ink",
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
          "relative h-5 w-9 rounded-full transition-[background-color] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus",
          checked ? "bg-ink" : "bg-black/15",
        )}
      >
        {/* Slides with translate rather than `left`, so the toggle never triggers layout. */}
        <span
          className={clsx(
            "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-[translate] duration-200 ease-in-out motion-reduce:transition-none",
            checked && "translate-x-4",
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
    "w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-base outline-none transition-[box-shadow] focus:ring-2 focus:ring-focus/60 sm:text-sm";
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

function ImageInput({ label, onFile }: { label: string; onFile: (file: File) => void }) {
  return (
    <label
      className={clsx(
        "press flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-black/10 py-2 text-[13px] transition-[background-color,scale] hover:bg-well",
        FILE_FOCUS,
      )}
    >
      <ImagePlus className="h-3.5 w-3.5" strokeWidth={1.5} absoluteStrokeWidth />
      {label}
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) onFile(file);
        }}
      />
    </label>
  );
}

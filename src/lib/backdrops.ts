import type { CSSProperties } from "react";
import { hexToOklch, oklchToHex, rotateHue } from "./color";

export interface Backdrop {
  id: string;
  label: string;
  css: string;
  /** Film-grain strength (0–1), blended over the gradient. */
  grain?: number;
  /** Reads as dark where the card sits, so frames around the card draw in light tones. */
  dark?: boolean;
}

export type BackdropChoice = Backdrop | { upload: string; dark?: boolean };

/** Adjustments made on top of the chosen background. */
export interface BackdropTune {
  /** Degrees every colour turns around the OKLCH hue wheel. */
  hue: number;
  /** -100 to 100: how far the light spreads, or how bright an uploaded image is. */
  intensity: number;
  /** Blur radius in px of the full-size frame. */
  blur: number;
  /** Film grain, 0–100. */
  grain: number;
}

/** Tileable SVG noise, grayscale, so it can be overlay-blended onto any colour. */
function grainLayer(strength: number): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0 0 0 ${strength}'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>`;
  // Encode the parentheses too: html-to-image reads the inner `url(#n)` as a file to fetch, blanks it
  // when the fetch fails, and the export loses its grain while the unfiltered rect darkens the gradient.
  const encoded = svg.replace(/"/g, "'").replace(/</g, "%3C").replace(/>/g, "%3E").replace(/\(/g, "%28").replace(/\)/g, "%29");
  return `url("data:image/svg+xml,${encoded}") 0 0 / 220px 220px`;
}

export const BACKDROPS: Backdrop[] = [
  // One large, soft light source on a near-black base, finished with fine grain.
  {
    id: "wave",
    label: "Wave",
    dark: true,
    grain: 0.5,
    css: "radial-gradient(ellipse 105% 85% at 100% -8%, #eef2fd 0%, #a3b9ef 13%, #4169d2 28%, #1c3290 42%, #0d1640 54%, transparent 66%), radial-gradient(ellipse 95% 80% at -6% 110%, #f4f5f8 0%, #abbff0 12%, #4169d4 27%, #1a2f88 41%, #0c143c 53%, transparent 64%), linear-gradient(160deg, #0b0d16 0%, #07080c 100%)",
  },
  {
    id: "flare",
    label: "Flare",
    dark: true,
    grain: 0.5,
    css: "radial-gradient(ellipse 70% 100% at 45% 108%, #f3effd 0%, #a9c1f4 14%, #5a83e8 28%, #2348d6 42%, #12259a 55%, #070c3a 70%, transparent 86%), #020205",
  },
  {
    id: "horizon",
    label: "Horizon",
    dark: true,
    grain: 0.45,
    css: "linear-gradient(0deg, #e6def8 0%, #a493e3 11%, #6650c4 24%, #34238a 40%, #150f45 58%, #06061a 78%, #030309 100%)",
  },
  {
    id: "graphite",
    label: "Graphite",
    dark: true,
    grain: 0.6,
    css: "radial-gradient(ellipse 85% 120% at 58% 112%, #f4f4f4 0%, #c2c2c2 12%, #7a7a7a 26%, #3a3a3a 42%, #181818 58%, transparent 80%), linear-gradient(180deg, #030303, #0a0a0a)",
  },
  {
    id: "ember",
    label: "Ember",
    dark: true,
    grain: 0.5,
    css: "radial-gradient(ellipse 80% 95% at 20% 110%, #fff3e6 0%, #ffbf85 13%, #f2742e 28%, #b8380f 43%, #4a1206 60%, transparent 80%), #050302",
  },
  { id: "black", label: "Black", dark: true, css: "#000000" },
  {
    id: "lavender",
    label: "Lavender",
    css: "radial-gradient(ellipse 80% 70% at 20% 10%, #f3e8ff 0%, transparent 60%), radial-gradient(ellipse 70% 60% at 90% 90%, #fde2ef 0%, transparent 60%), #e9e4fb",
  },
  {
    id: "peach",
    label: "Peach",
    css: "radial-gradient(ellipse 70% 60% at 80% 20%, #fff1df 0%, transparent 60%), linear-gradient(160deg, #ffd9c7, #f7b8a8)",
  },
  {
    id: "sage",
    label: "Sage",
    css: "radial-gradient(ellipse 60% 50% at 30% 30%, #eef3e6 0%, transparent 70%), linear-gradient(150deg, #cfdcc0, #a8bf98)",
  },
  {
    id: "dusk",
    label: "Dusk",
    dark: true,
    css: "linear-gradient(180deg, #4b3f6b 0%, #b0708d 55%, #f0b69a 100%)",
  },
  {
    id: "sky",
    label: "Sky",
    css: "radial-gradient(ellipse 80% 60% at 50% 0%, #ffffff 0%, transparent 70%), linear-gradient(180deg, #d6e6fb, #b9d0f2)",
  },
  { id: "stone", label: "Stone", css: "#ecebe6" },
];

export const DEFAULT_BACKDROP = BACKDROPS.find((b) => b.id === "flare")!;

export function backdropStyle(backdrop: BackdropChoice): CSSProperties {
  if ("upload" in backdrop) return { background: `center / cover no-repeat url("${backdrop.upload}")` };
  if (!backdrop.grain) return { background: backdrop.css };
  const gradientLayers = backdrop.css.split(/,(?![^(]*\))/).length;
  return {
    background: `${grainLayer(backdrop.grain)}, ${backdrop.css}`,
    // Overlay the grain only; every gradient layer below blends normally.
    backgroundBlendMode: ["overlay", ...Array(gradientLayers).fill("normal")].join(", "),
  };
}

const HEX = /#[0-9a-f]{3,8}\b/gi;
// Colour stops only: the ellipse sizes and positions in the same string end in % too.
const STOP = /(#[0-9a-f]{3,8}|transparent)\s+(-?[\d.]+)%/gi;

export function isDarkBackdrop(backdrop: BackdropChoice): boolean {
  return "upload" in backdrop ? (backdrop.dark ?? true) : !!backdrop.dark;
}

export function defaultTune(backdrop: BackdropChoice): BackdropTune {
  return { hue: 0, intensity: 0, blur: 0, grain: "upload" in backdrop ? 0 : Math.round((backdrop.grain ?? 0) * 100) };
}

/** Which adjustments change anything on this background; a flat colour has no light to spread or blur. */
export function tunableParts(backdrop: BackdropChoice) {
  if ("upload" in backdrop) return { hue: false, intensity: true, blur: true };
  const colors = backdrop.css.match(HEX) ?? [];
  return {
    hue: colors.some((hex) => hexToOklch(hex).c > 0.02),
    intensity: backdrop.css.match(STOP) !== null,
    blur: colors.length > 1,
  };
}

/** The rainbow under the hue slider. It starts at the background's own hue, so the thumb sits on the colour it shows. */
export function hueTrack(backdrop: BackdropChoice): string {
  const colors = "upload" in backdrop ? [] : (backdrop.css.match(HEX) ?? []).map(hexToOklch);
  const base = colors.reduce((best, c) => (c.c > best.c ? c : best), { l: 0, c: 0, h: 0 }).h;
  const stops = Array.from({ length: 13 }, (_, i) => oklchToHex({ l: 0.72, c: 0.15, h: (base + i * 30) % 360 }));
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

/**
 * The frame's background with its adjustments: a layer that can be blurred, plus grain to blend over it.
 * Grain sits on its own layer so blurring the background doesn't smear it. `blurredUpload` is the upload
 * already run through `blurImage` at the current radius, when it's ready.
 */
export function tunedBackdrop(
  backdrop: BackdropChoice,
  tune: BackdropTune,
  blurredUpload?: string,
): { layer: CSSProperties; grain: CSSProperties | null } {
  const filters: string[] = [];
  let background: string;
  let blur = tune.blur;
  if ("upload" in backdrop) {
    background = `center / cover no-repeat url("${blurredUpload ?? backdrop.upload}")`;
    if (blurredUpload) blur = 0;
    if (tune.intensity) filters.push(`brightness(${1 + tune.intensity / 200})`);
  } else {
    // Stretching every stop makes the light reach further, like a stronger source; shrinking dims it.
    const spread = 2 ** (tune.intensity / 140);
    background = backdrop.css
      .replace(HEX, (hex) => (tune.hue ? rotateHue(hex, tune.hue) : hex))
      .replace(STOP, (_, color: string, at: string) => `${color} ${+(Number(at) * spread).toFixed(2)}%`);
  }
  if (blur) filters.push(`blur(${blur}px)`);
  return {
    // Blur pulls transparency in from the edges, so the layer bleeds three radii past the frame.
    layer: { inset: -3 * blur, background, filter: filters.join(" ") || undefined },
    grain: tune.grain ? { background: grainLayer(tune.grain / 100), mixBlendMode: "overlay" } : null,
  };
}

/** Whether an uploaded image reads as dark overall, judged from an 8×8 downscale. */
export function isDarkImage(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 8;
      const context = canvas.getContext("2d");
      if (!context) return resolve(true);
      context.drawImage(image, 0, 0, 8, 8);
      const data = context.getImageData(0, 0, 8, 8).data;
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      resolve(sum / (data.length / 4) / 255 < 0.5);
    };
    image.onerror = () => resolve(true);
    image.src = src;
  });
}

let lastImage: { src: string; image: Promise<HTMLImageElement> } | null = null;

// Only the latest upload is kept decoded; slider drags blur the same image over and over.
function loadImage(src: string): Promise<HTMLImageElement> {
  if (lastImage?.src !== src) {
    const image = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
    lastImage = { src, image };
  }
  return lastImage.image;
}

/** One box-blur pass along rows or columns. Edges repeat their last pixel, so nothing fades in from outside. */
function boxBlurPass(src: Uint8ClampedArray, dst: Uint8ClampedArray, width: number, height: number, radius: number, rows: boolean) {
  const length = rows ? width : height;
  const lines = rows ? height : width;
  const step = rows ? 4 : width * 4;
  const span = 2 * radius + 1;
  const at = (start: number, i: number) => start + Math.min(length - 1, Math.max(0, i)) * step;
  for (let line = 0; line < lines; line++) {
    const start = rows ? line * width * 4 : line * 4;
    for (let channel = 0; channel < 4; channel++) {
      let sum = 0;
      for (let i = -radius; i <= radius; i++) sum += src[at(start, i) + channel];
      for (let i = 0; i < length; i++) {
        dst[start + i * step + channel] = sum / span;
        sum += src[at(start, i + radius + 1) + channel] - src[at(start, i - radius) + channel];
      }
    }
  }
}

/**
 * Blurs an uploaded background by `radius` px of the frame it covers. WebKit's export paints only the part of
 * a background image inside the frame before a CSS blur, so the edges fade to transparent there. Blur keeps
 * only coarse detail, so the work happens on a copy small enough that the radius is a few pixels, and the
 * browser scales the result back up.
 */
export async function blurImage(src: string, radius: number, frame: { width: number; height: number }): Promise<string> {
  const image = await loadImage(src);
  // Image pixels per frame pixel under `background-size: cover`.
  const density = Math.min(image.naturalWidth / frame.width, image.naturalHeight / frame.height);
  const shrink = Math.max(1, (radius * density) / 4);
  const width = Math.max(1, Math.round(image.naturalWidth / shrink));
  const height = Math.max(1, Math.round(image.naturalHeight / shrink));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height);
  const scratch = new Uint8ClampedArray(pixels.data.length);
  // Three box passes approximate a Gaussian with the same standard deviation, which is what CSS blur() uses.
  const sigma = (radius * density) / shrink;
  const box = Math.max(1, Math.round((Math.sqrt(4 * sigma * sigma + 1) - 1) / 2));
  for (let pass = 0; pass < 3; pass++) {
    boxBlurPass(pixels.data, scratch, width, height, box, true);
    boxBlurPass(scratch, pixels.data, width, height, box, false);
  }
  context.putImageData(pixels, 0, 0);
  return canvas.toDataURL("image/png");
}

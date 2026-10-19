import type { ImageStyle } from "@/components/image-card";
import { DEFAULT_EFFECTS, type CardEffects, type CardStyle, type CardTheme } from "@/components/profile-card";
import { BACKDROPS, defaultTune, type Backdrop, type BackdropTune } from "./backdrops";

/** A finished look: a background with its adjustments, and how the card sits on it. Format and content stay put. */
export interface Preset {
  id: string;
  label: string;
  /** Id of one of the preset backgrounds. */
  backdrop: string;
  /** Changes from that background's default adjustments. Hue turns a gradient into a colour of its own. */
  tune?: Partial<BackdropTune>;
  /** How a profile card sits on it. */
  style: CardStyle;
  theme: CardTheme;
  size: number;
  /** Changes from the default effects. */
  effects?: Partial<CardEffects>;
  /**
   * How an image card sits on it, where that differs. A screenshot brings its own colours, so most image looks keep
   * to light chrome and leave the padded card out of frames, where a mat inside a rim reads as two bezels.
   */
  image: { style: ImageStyle; theme?: CardTheme; size?: number; effects?: Partial<CardEffects> };
}

export const PRESETS: Preset[] = [
  // Dark, one soft light source. A translucent light card turns grey on these, so light cards here are solid.
  {
    // A hairline of glass round the card, made for dark sites and apps.
    id: "onyx",
    label: "Onyx",
    backdrop: "graphite",
    style: "minimal",
    theme: "dark",
    size: 50,
    effects: { frame: "glass", frameWidth: 4, shadow: 65 },
    image: { style: "plain", size: 70 },
  },
  {
    id: "flare",
    label: "Flare",
    backdrop: "flare",
    style: "native",
    theme: "light",
    size: 50,
    effects: { shadow: 60 },
    image: { style: "window" },
  },
  {
    id: "glass",
    label: "Glass",
    backdrop: "wave",
    style: "native",
    theme: "light",
    size: 46,
    effects: { frame: "glass", frameWidth: 14, shadow: 55 },
    image: { style: "plain" },
  },
  {
    id: "showcase",
    label: "Showcase",
    backdrop: "horizon",
    style: "native",
    theme: "dark",
    size: 44,
    effects: { shadow: 75, tiltX: 12, tiltY: -18 },
    image: { style: "window", theme: "light" },
  },
  {
    id: "rose",
    label: "Rose",
    backdrop: "flare",
    tune: { hue: 89 },
    style: "native",
    theme: "light",
    size: 46,
    effects: { shadow: 70, tiltY: -14 },
    image: { style: "card" },
  },
  {
    id: "graphite",
    label: "Graphite",
    backdrop: "graphite",
    style: "minimal",
    theme: "dark",
    size: 46,
    effects: { frame: "solid", frameWidth: 10, shadow: 65 },
    // A light mat, like a framed print, rather than a black bezel round a light screenshot.
    image: { style: "plain", theme: "light" },
  },
  {
    id: "aurora",
    label: "Aurora",
    backdrop: "horizon",
    tune: { hue: 263 },
    style: "native",
    theme: "light",
    size: 44,
    effects: { frame: "glass", frameWidth: 10, shadow: 60, tiltX: 8, tiltY: 14 },
    image: { style: "window", effects: { frame: "none" } },
  },
  {
    id: "ember",
    label: "Ember",
    backdrop: "ember",
    style: "native",
    theme: "dark",
    size: 48,
    effects: { frame: "glass", frameWidth: 12, shadow: 60 },
    image: { style: "plain" },
  },
  {
    id: "emerald",
    label: "Emerald",
    backdrop: "wave",
    tune: { hue: 250 },
    style: "minimal",
    theme: "dark",
    size: 46,
    effects: { frame: "line", frameWidth: 12, shadow: 50 },
    image: { style: "plain" },
  },
  {
    id: "noir",
    label: "Noir",
    backdrop: "black",
    tune: { grain: 35 },
    style: "minimal",
    theme: "dark",
    size: 46,
    effects: { frame: "line", frameWidth: 14, shadow: 0 },
    image: { style: "plain" },
  },
  {
    id: "violet",
    label: "Violet",
    backdrop: "flare",
    tune: { hue: 40, intensity: 25 },
    style: "native",
    theme: "dark",
    size: 44,
    effects: { shadow: 80, tiltX: 20 },
    image: { style: "window", theme: "light" },
  },
  {
    id: "gold",
    label: "Gold",
    backdrop: "ember",
    tune: { hue: 34 },
    style: "ticket",
    theme: "dark",
    size: 50,
    effects: { shadow: 70, rotate: -4 },
    image: { style: "card", theme: "light" },
  },
  // Light and airy.
  {
    id: "paper",
    label: "Paper",
    backdrop: "stone",
    tune: { grain: 30 },
    style: "native",
    theme: "light",
    size: 48,
    effects: { frame: "solid", frameWidth: 12, shadow: 35 },
    image: { style: "plain" },
  },
  {
    id: "lilac",
    label: "Lilac",
    backdrop: "lavender",
    tune: { grain: 20 },
    style: "minimal",
    theme: "light",
    size: 46,
    effects: { frame: "glass", frameWidth: 14, shadow: 40 },
    image: { style: "window", effects: { frame: "none" } },
  },
  {
    id: "peach",
    label: "Peach",
    backdrop: "peach",
    tune: { grain: 20 },
    style: "ticket",
    theme: "light",
    size: 50,
    effects: { shadow: 45, rotate: -4 },
    image: { style: "plain" },
  },
  {
    id: "sky",
    label: "Sky",
    backdrop: "sky",
    style: "native",
    theme: "light",
    size: 44,
    effects: { shadow: 45, tiltX: 10, tiltY: 12 },
    image: { style: "window" },
  },
  {
    id: "dusk",
    label: "Dusk",
    backdrop: "dusk",
    tune: { grain: 30 },
    style: "minimal",
    theme: "dark",
    size: 46,
    effects: { frame: "glass", frameWidth: 12, shadow: 60 },
    image: { style: "plain" },
  },
];

/** Everything a preset sets, filled in, for a profile card or for an image card. */
export function presetLook(
  preset: Preset,
  forImage: boolean,
): { backdrop: Backdrop; tune: BackdropTune; theme: CardTheme; size: number; effects: CardEffects } {
  const backdrop = BACKDROPS.find((b) => b.id === preset.backdrop)!;
  return {
    backdrop,
    tune: { ...defaultTune(backdrop), ...preset.tune },
    theme: (forImage && preset.image.theme) || preset.theme,
    size: (forImage && preset.image.size) || preset.size,
    effects: { ...DEFAULT_EFFECTS, ...preset.effects, ...(forImage && preset.image.effects) },
  };
}

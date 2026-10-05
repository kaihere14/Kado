import type { CSSProperties } from "react";

export interface Backdrop {
  id: string;
  label: string;
  css: string;
  /** Film-grain strength (0–1), blended over the gradient. */
  grain?: number;
}

/** Tileable SVG noise, grayscale, so it can be overlay-blended onto any colour. */
function grainLayer(strength: number): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0 0 0 ${strength}'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>`;
  return `url("data:image/svg+xml,${svg.replace(/"/g, "'").replace(/</g, "%3C").replace(/>/g, "%3E")}") 0 0 / 220px 220px`;
}

export const BACKDROPS: Backdrop[] = [
  // One large, soft light source on a near-black base, finished with fine grain.
  {
    id: "wave",
    label: "Wave",
    grain: 0.5,
    css: "radial-gradient(ellipse 105% 85% at 100% -8%, #eef2fd 0%, #a3b9ef 13%, #4169d2 28%, #1c3290 42%, #0d1640 54%, transparent 66%), radial-gradient(ellipse 95% 80% at -6% 110%, #f4f5f8 0%, #abbff0 12%, #4169d4 27%, #1a2f88 41%, #0c143c 53%, transparent 64%), linear-gradient(160deg, #0b0d16 0%, #07080c 100%)",
  },
  {
    id: "flare",
    label: "Flare",
    grain: 0.5,
    css: "radial-gradient(ellipse 70% 100% at 45% 108%, #f3effd 0%, #a9c1f4 14%, #5a83e8 28%, #2348d6 42%, #12259a 55%, #070c3a 70%, transparent 86%), #020205",
  },
  {
    id: "horizon",
    label: "Horizon",
    grain: 0.45,
    css: "linear-gradient(0deg, #e6def8 0%, #a493e3 11%, #6650c4 24%, #34238a 40%, #150f45 58%, #06061a 78%, #030309 100%)",
  },
  {
    id: "graphite",
    label: "Graphite",
    grain: 0.6,
    css: "radial-gradient(ellipse 85% 120% at 58% 112%, #f4f4f4 0%, #c2c2c2 12%, #7a7a7a 26%, #3a3a3a 42%, #181818 58%, transparent 80%), linear-gradient(180deg, #030303, #0a0a0a)",
  },
  {
    id: "ember",
    label: "Ember",
    grain: 0.5,
    css: "radial-gradient(ellipse 80% 95% at 20% 110%, #fff3e6 0%, #ffbf85 13%, #f2742e 28%, #b8380f 43%, #4a1206 60%, transparent 80%), #050302",
  },
  { id: "black", label: "Black", css: "#000000" },
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

export function backdropStyle(backdrop: Backdrop | { upload: string }): CSSProperties {
  if ("upload" in backdrop) return { background: `center / cover no-repeat url("${backdrop.upload}")` };
  if (!backdrop.grain) return { background: backdrop.css };
  const gradientLayers = backdrop.css.split(/,(?![^(]*\))/).length;
  return {
    background: `${grainLayer(backdrop.grain)}, ${backdrop.css}`,
    // Overlay the grain only; every gradient layer below blends normally.
    backgroundBlendMode: ["overlay", ...Array(gradientLayers).fill("normal")].join(", "),
  };
}

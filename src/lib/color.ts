// Hex <-> OKLCH, so hue can turn without the lightness jumps a plain RGB hue rotation causes.

type Rgb = [number, number, number];

export interface Oklch {
  l: number;
  c: number;
  /** Degrees, 0–360. */
  h: number;
}

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function parseHex(hex: string): { rgb: Rgb; alpha: string } {
  let digits = hex.slice(1);
  if (digits.length <= 4) digits = [...digits].map((d) => d + d).join("");
  const rgb = [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16) / 255) as Rgb;
  return { rgb, alpha: digits.slice(6) };
}

function rgbToOklch([r, g, b]: Rgb): Oklch {
  const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const h = (Math.atan2(B, A) * 180) / Math.PI;
  return { l: L, c: Math.hypot(A, B), h: h < 0 ? h + 360 : h };
}

/** Linear sRGB; channels can fall outside 0–1 when the colour is out of gamut. */
function oklchToLinear({ l: L, c, h }: Oklch): Rgb {
  const A = c * Math.cos((h * Math.PI) / 180);
  const B = c * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (rgb: Rgb) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);

function toHex(linear: Rgb): string {
  return `#${linear
    .map((v) =>
      Math.round(toGamma(Math.min(1, Math.max(0, v))) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

export function hexToOklch(hex: string): Oklch {
  return rgbToOklch(parseHex(hex).rgb);
}

/** Out-of-gamut colours keep their lightness and hue and give up chroma until they fit sRGB. */
export function oklchToHex(color: Oklch): string {
  if (inGamut(oklchToLinear(color))) return toHex(oklchToLinear(color));
  let low = 0;
  let high = color.c;
  for (let i = 0; i < 20; i++) {
    const mid = (low + high) / 2;
    if (inGamut(oklchToLinear({ ...color, c: mid }))) low = mid;
    else high = mid;
  }
  return toHex(oklchToLinear({ ...color, c: low }));
}

export function rotateHue(hex: string, degrees: number): string {
  const { rgb, alpha } = parseHex(hex);
  const color = rgbToOklch(rgb);
  return oklchToHex({ ...color, h: (color.h + degrees) % 360 }) + alpha;
}

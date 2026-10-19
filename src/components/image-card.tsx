import type { CardImage } from "@/lib/card-image";
import {
  CardMount,
  cardShadow,
  DEFAULT_EFFECTS,
  dropShadow,
  LIFT,
  type CardEffects,
  type CardTheme,
} from "./profile-card";

export const IMAGE_STYLES = ["card", "window", "plain"] as const;
export type ImageStyle = (typeof IMAGE_STYLES)[number];

// Chrome is drawn at this card width and scales with it, the way profile cards scale from 360px.
const DESIGN_WIDTH = 480;

/** Each style's chrome at the design width: padding round the image, title bar height and corner radius. */
const CHROME: Record<ImageStyle, { pad: number; bar: number; radius: number }> = {
  // A slim mat: the image's corners (radius − padding) come out the same as the plain style's.
  card: { pad: 6, bar: 0, radius: 18 },
  window: { pad: 0, bar: 26, radius: 12 },
  plain: { pad: 0, bar: 0, radius: 12 },
};

// Screenshots carry their own detail, so they fill more of the frame than a profile card does: 40% at size 0,
// all of it at 100.
function fill(size: number) {
  return 0.4 + (size / 100) * 0.6;
}

const TRAFFIC_LIGHTS = ["#ff5f57", "#febc2e", "#28c840"];

/** The widest card that fits its share of the frame on both sides, whatever the image's proportions. */
export function imageCardWidth(
  image: CardImage,
  style: ImageStyle,
  size: number,
  frame: { width: number; height: number },
): number {
  const { pad, bar } = CHROME[style];
  // Card height per px of card width: the image below its padding, plus the chrome above and below it.
  const tall = ((DESIGN_WIDTH - 2 * pad) * (image.height / image.width) + 2 * pad + bar) / DESIGN_WIDTH;
  return Math.round(Math.min(frame.width * fill(size), (frame.height * fill(size)) / tall));
}

function Picture({ image, width }: { image: CardImage; width: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- plain img keeps html-to-image export reliable
    <img src={image.src} alt="" className="block" style={{ width, height: (width * image.height) / image.width }} />
  );
}

/** A hairline over the image, so a white screenshot's edge doesn't melt into a white card or background. */
function Edge({ dark }: { dark: boolean }) {
  return (
    <div
      aria-hidden
      className="absolute inset-0"
      style={{ borderRadius: "inherit", boxShadow: `inset 0 0 0 1px ${dark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.08)"}` }}
    />
  );
}

/** A screenshot or picture set inside a card, a window or nothing at all. */
export function ImageCard({
  image,
  style,
  theme,
  width,
  effects = DEFAULT_EFFECTS,
  darkBackdrop = true,
}: {
  image: CardImage;
  style: ImageStyle;
  theme: CardTheme;
  /** Rendered width in CSS px; the chrome scales from it. */
  width: number;
  effects?: CardEffects;
  darkBackdrop?: boolean;
}) {
  const scale = width / DESIGN_WIDTH;
  const { pad, bar, radius } = CHROME[style];
  const dark = theme === "dark";
  const shadow = cardShadow(effects);
  const lift = shadow ? dropShadow(shadow, LIFT) : null;
  const outline = `0 0 0 1px ${dark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)"}`;

  let card: React.ReactNode;
  switch (style) {
    case "window":
      card = (
        <div
          data-card-shadow
          // Positioned like the other styles' clipping boxes: Chrome skipped painting this one inside a scaled preset tile.
          className="relative overflow-hidden"
          style={{
            width,
            borderRadius: radius * scale,
            background: dark ? "#1b1b1e" : "#ffffff",
            boxShadow: [outline, lift].filter(Boolean).join(", "),
          }}
        >
          <div
            className="flex items-center"
            style={{
              height: bar * scale,
              gap: 6 * scale,
              paddingLeft: 11 * scale,
              background: dark ? "#26262a" : "#f5f4f2",
              borderBottom: `1px solid ${dark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)"}`,
            }}
          >
            {TRAFFIC_LIGHTS.map((color) => (
              <span key={color} className="rounded-full" style={{ width: 10 * scale, height: 10 * scale, background: color }} />
            ))}
          </div>
          <Picture image={image} width={width} />
        </div>
      );
      break;
    case "plain":
      card = (
        <div
          data-card-shadow
          className="relative overflow-hidden"
          style={{ width, borderRadius: radius * scale, boxShadow: lift ?? undefined }}
        >
          <Picture image={image} width={width} />
          <Edge dark={dark} />
        </div>
      );
      break;
    default:
      card = (
        <div
          data-card-shadow
          style={{
            width,
            padding: pad * scale,
            borderRadius: radius * scale,
            background: dark ? "#121214" : "#ffffff",
            boxShadow: [outline, lift].filter(Boolean).join(", "),
          }}
        >
          {/* Inner radius = card radius − padding, so the corners stay concentric. */}
          <div className="relative overflow-hidden" style={{ borderRadius: (radius - pad) * scale }}>
            <Picture image={image} width={width - 2 * pad * scale} />
            <Edge dark={dark} />
          </div>
        </div>
      );
  }

  return (
    <CardMount effects={effects} darkBackdrop={darkBackdrop} dark={dark} width={width} scale={scale} radius={radius * scale}>
      {card}
    </CardMount>
  );
}

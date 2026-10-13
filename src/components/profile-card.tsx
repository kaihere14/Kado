import clsx from "clsx";
import { Fragment } from "react";
import { formatCount, type PlatformId, type Profile } from "@/lib/platforms";
import { PLATFORM_ICONS, VerifiedBadge } from "./brand-icons";

export type CardSize = "S" | "M" | "L";
export type CardTheme = "light" | "dark";
export type CardStyle = "native" | "minimal" | "ticket";
export type CardShape = "square" | "rectangle";

export const FRAME_STYLES = ["none", "glass", "solid", "line"] as const;
export type FrameStyle = (typeof FRAME_STYLES)[number];

/** How the card sits on the background: its frame, shadow and tilt. Kept when a new profile loads. */
export interface CardEffects {
  frame: FrameStyle;
  /** Gap between card and frame edge, in px of the 360px design. */
  frameWidth: number;
  /** 0–100; 50 is each card's original shadow. */
  shadow: number;
  /** Degrees. `rotate` turns the card flat on the page; `tiltX` and `tiltY` lean it back in 3D. */
  rotate: number;
  tiltX: number;
  tiltY: number;
}

export const DEFAULT_EFFECTS: CardEffects = { frame: "none", frameWidth: 12, shadow: 50, rotate: 0, tiltX: 0, tiltY: 0 };

export interface CardOptions {
  style: CardStyle;
  shape: CardShape;
  size: CardSize;
  theme: CardTheme;
  visibleStats: string[];
  showVerified: boolean;
  showBanner: boolean;
  showPlatformMark: boolean;
}

// Card width as a share of the frame, capped by frame height so landscape formats never overflow.
const WIDTH_SHARE: Record<CardSize, { ofWidth: number; ofHeight: number }> = {
  S: { ofWidth: 0.4, ofHeight: 0.62 },
  M: { ofWidth: 0.5, ofHeight: 0.76 },
  L: { ofWidth: 0.6, ofHeight: 0.9 },
};

export function cardWidth(size: CardSize, frame: { width: number; height: number }): number {
  const share = WIDTH_SHARE[size];
  return Math.round(Math.min(frame.width * share.ofWidth, frame.height * share.ofHeight));
}

const ACCENTS: Record<PlatformId, string> = {
  x: "#1d9bf0",
  linkedin: "#0a66c2",
  github: "#8957e5",
  instagram: "#e1306c",
  youtube: "#ff0033",
};

/** Route remote images through our proxy so the PNG export can read them. */
export function proxied(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("data:") || url.startsWith("blob:") || url.startsWith("/")) return url;
  return `/api/image?url=${encodeURIComponent(url)}`;
}

interface CardProps {
  profile: Profile;
  options: CardOptions;
  /** Rendered width in CSS px; everything inside scales from it. */
  width: number;
  /** Drop-shadow strength, 0–100. */
  shadow: number;
}

/** Corner radius of each style at the 360px design width. A frame adds its gap to stay concentric. */
const RADIUS: Record<CardStyle, number> = { native: 16, minimal: 22, ticket: 12 };

/**
 * One soft drop shadow, scaled from how it looks at strength 50. Leave out `spread` for a `drop-shadow()`
 * filter, which has none.
 */
function dropShadow(strength: number, { y, blur, spread, rgb, alpha }: { y: number; blur: number; spread?: number; rgb: string; alpha: number }) {
  const s = strength / 50;
  return `0 ${y * s}px ${blur * s}px${spread === undefined ? "" : ` ${spread * s}px`} rgba(${rgb}, ${Math.min(1, alpha * s)})`;
}

const LIFT = { y: 18, blur: 40, spread: -18, rgb: "22,22,63", alpha: 0.45 };

function frameLook(frame: Exclude<FrameStyle, "none">, darkCard: boolean, darkBackdrop: boolean) {
  switch (frame) {
    case "solid":
      // A mat a shade off the card's own surface, so the card's edge still reads against it.
      return { background: darkCard ? "#232326" : "#f4f3ef", line: darkCard ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.05)" };
    case "glass":
      return darkBackdrop
        ? { background: "linear-gradient(180deg, rgba(255,255,255,.18), rgba(255,255,255,.07))", line: "rgba(255,255,255,.22)" }
        : { background: "linear-gradient(180deg, rgba(255,255,255,.7), rgba(255,255,255,.4))", line: "rgba(255,255,255,.85)" };
    case "line":
      return { background: undefined, line: darkBackdrop ? "rgba(255,255,255,.45)" : "rgba(42,42,39,.28)" };
  }
}

// A card on a glass or solid frame keeps a faint lift of its own; the frame carries the main shadow.
const SHADOW_IN_FRAME = 12;

export function ProfileCard({
  effects = DEFAULT_EFFECTS,
  darkBackdrop = true,
  ...props
}: Omit<CardProps, "shadow"> & { effects?: CardEffects; darkBackdrop?: boolean }) {
  const { frame, frameWidth, shadow, rotate, tiltX, tiltY } = effects;
  const scale = props.width / 360;
  const surfaceFrame = frame === "glass" || frame === "solid";
  const cardProps = { ...props, shadow: surfaceFrame ? Math.min(shadow, SHADOW_IN_FRAME) : shadow };

  let card: React.ReactNode;
  switch (props.options.style) {
    case "minimal":
      card = <MinimalCard {...cardProps} />;
      break;
    case "ticket":
      // The notch mask would clip a box-shadow, so the ticket's shadow follows its outline instead.
      card = (
        <div
          data-card-shadow
          style={{
            filter: cardProps.shadow
              ? `drop-shadow(${dropShadow(cardProps.shadow, { y: 10, blur: 16, rgb: "22,22,63", alpha: 0.35 })})`
              : undefined,
          }}
        >
          <TicketCard {...cardProps} />
        </div>
      );
      break;
    default:
      card = <NativeCard {...cardProps} />;
  }

  if (frame !== "none") {
    const gap = frameWidth * scale;
    const border = frame === "line" ? 1.5 * scale : 1;
    const look = frameLook(frame, props.options.theme === "dark", darkBackdrop);
    card = (
      <div
        data-card-shadow
        style={{
          padding: gap,
          borderRadius: RADIUS[props.options.style] * scale + gap + border,
          border: `${border}px solid ${look.line}`,
          background: look.background,
          boxShadow: surfaceFrame && shadow ? dropShadow(shadow, LIFT) : undefined,
        }}
      >
        {card}
      </div>
    );
  }

  const tilted = tiltX || tiltY;
  return (
    <div
      data-card-tilt
      style={{
        // A perspective a few card-widths away keeps the tilt readable without fish-eye distortion.
        transform: tilted
          ? `perspective(${props.width * 2.5}px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) rotate(${rotate}deg)`
          : rotate
            ? `rotate(${rotate}deg)`
            : undefined,
      }}
    >
      {card}
    </div>
  );
}

function useCardBasics({ profile, options, width }: CardProps) {
  return {
    width,
    scale: width / 360,
    dark: options.theme === "dark",
    accent: ACCENTS[profile.platform],
    PlatformIcon: PLATFORM_ICONS[profile.platform],
    stats: profile.stats.filter((s) => options.visibleStats.includes(s.key)),
    avatar: proxied(profile.avatarUrl),
    handleText: profile.platform === "linkedin" ? `in/${profile.handle}` : `@${profile.handle}`,
    verified: options.showVerified && profile.verified,
  };
}

function Avatar({ src, name, accent, className }: { src: string | null; name: string; accent: string; className?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- plain img keeps html-to-image export reliable
    <img src={src} alt="" crossOrigin="anonymous" className={clsx("h-full w-full object-cover", className)} />
  ) : (
    <div
      className={clsx("flex h-full w-full items-center justify-center font-bold text-white", className)}
      style={{ background: accent, fontSize: "2em" }}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

/** Looks like the profile header on the source platform. */
function NativeCard(props: CardProps) {
  const { profile, options } = props;
  const { width, scale, dark, accent, PlatformIcon, stats, avatar, handleText, verified } = useCardBasics(props);
  const rectangular = options.shape === "rectangle";
  const isInstagram = profile.platform === "instagram";
  const isYouTube = profile.platform === "youtube";
  const hasBannerSlot = options.showBanner && (profile.platform === "x" || profile.platform === "linkedin" || isYouTube);
  const banner = hasBannerSlot ? proxied(profile.bannerUrl) : null;
  // X and LinkedIn tuck the avatar into the banner; YouTube insets a rounded banner above the avatar row.
  const avatarOverlapsBanner = hasBannerSlot && !isYouTube;
  const avatarSize = (isYouTube ? 64 : 72) * scale;
  // The ring cuts the avatar out of the banner (or frames Instagram's story ring); YouTube's sits clear of it.
  const ring = isYouTube ? 0 : 4 * scale;
  const padding = (rectangular ? 16 : 18) * scale;
  const surface = dark ? "#121214" : "#ffffff";
  const muted = dark ? "text-white/50" : "text-neutral-500";
  const verifiedColor = profile.platform === "linkedin" || isYouTube ? "#71717a" : accent;

  const identity = (
    <>
      <div className="flex items-center gap-[0.3em]">
        <span className="truncate font-bold" style={{ fontSize: "1.25em" }}>
          {profile.name}
        </span>
        {verified && <VerifiedBadge className="h-[1.15em] w-[1.15em] shrink-0" color={verifiedColor} />}
      </div>
      <div className={clsx("truncate", muted)} style={{ fontSize: "0.9em" }}>
        {handleText}
      </div>
    </>
  );

  return (
    <div
      data-card-shadow
      className={clsx(
        "relative overflow-hidden font-sans",
        dark ? "text-white ring-1 ring-white/10" : "text-neutral-900 ring-1 ring-black/5",
      )}
      style={{
        width,
        // A cap, not a fixed height: profiles without a bio or banner would leave an empty block.
        maxHeight: rectangular ? width * 0.74 : undefined,
        borderRadius: RADIUS.native * scale,
        fontSize: 14 * scale,
        background: surface,
        boxShadow: ["0 1px 0 rgba(0,0,0,.06)", props.shadow && dropShadow(props.shadow, LIFT)]
          .filter(Boolean)
          .join(", "),
      }}
    >
      {hasBannerSlot && (
        <div
          style={{
            height: isYouTube ? (width - 2 * padding) / (rectangular ? 6 : 4.5) : rectangular ? width / 4 : width / 3,
            margin: isYouTube ? `${padding}px ${padding}px 0` : undefined,
            borderRadius: isYouTube ? 10 * scale : undefined,
            background: banner
              ? `center / cover no-repeat url("${banner}")`
              : `linear-gradient(120deg, ${accent}, ${accent}88)`,
          }}
        />
      )}

      {options.showPlatformMark && (
        <div
          className={clsx(
            "absolute flex items-center justify-center rounded-full",
            hasBannerSlot ? "bg-black/45 text-white" : dark ? "bg-white/10 text-white" : "bg-black/5 text-neutral-800",
          )}
          style={{
            top: (isYouTube && hasBannerSlot ? padding : 0) + 12 * scale,
            right: (isYouTube && hasBannerSlot ? padding : 0) + 12 * scale,
            width: 28 * scale,
            height: 28 * scale,
          }}
        >
          <PlatformIcon className="h-1/2 w-1/2" />
        </div>
      )}

      <div style={{ padding: `0 ${padding}px ${padding}px` }}>
        <div
          className={clsx(isInstagram && "flex items-center gap-[1.2em]", isYouTube && "flex items-center gap-[0.9em]")}
          style={{ marginTop: avatarOverlapsBanner ? -avatarSize / 2 : padding }}
        >
          <div
            className="shrink-0 rounded-full"
            style={{
              width: avatarSize + 2 * ring,
              height: avatarSize + 2 * ring,
              padding: ring,
              background: isInstagram ? "linear-gradient(45deg, #feda75, #fa7e1e, #d62976, #962fbf, #4f5bd5)" : surface,
            }}
          >
            <div className="h-full w-full overflow-hidden rounded-full" style={{ boxShadow: isInstagram ? `0 0 0 ${3 * scale}px ${surface}` : undefined }}>
              <Avatar src={avatar} name={profile.name} accent={accent} />
            </div>
          </div>

          {isInstagram && stats.length > 0 && (
            <div className="flex flex-1 justify-around text-center">
              {stats.map((s) => (
                <div key={s.key} className="leading-tight">
                  <div className="font-semibold" style={{ fontSize: "1.1em" }}>
                    {formatCount(s.value)}
                  </div>
                  <div className={dark ? "text-white/60" : "text-neutral-500"} style={{ fontSize: "0.85em" }}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* YouTube's header line: name, then handle, then the numbers joined by bullets. */}
          {isYouTube && (
            <div className="min-w-0 flex-1">
              {identity}
              {stats.length > 0 && (
                // Wraps between stats rather than truncating mid-number when all three are shown.
                <div className={muted} style={{ fontSize: "0.9em" }}>
                  {stats.map((s, i) => (
                    <Fragment key={s.key}>
                      {i > 0 && " • "}
                      <span className="whitespace-nowrap">
                        {formatCount(s.value)} {s.label}
                      </span>
                    </Fragment>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {!isYouTube && <div style={{ marginTop: 10 * scale }}>{identity}</div>}

        {profile.bio && (
          <p
            className={clsx(rectangular ? "mt-[0.5em] line-clamp-2" : "mt-[0.6em]", "leading-snug whitespace-pre-line")}
            style={{ fontSize: "0.95em" }}
          >
            {profile.bio}
          </p>
        )}

        {!isInstagram && !isYouTube && stats.length > 0 && (
          <div className={clsx("flex flex-wrap gap-x-[1.1em] gap-y-1", rectangular ? "mt-[0.65em]" : "mt-[0.8em]")} style={{ fontSize: "0.9em" }}>
            {stats.map((s) => (
              <span key={s.key}>
                <span className="font-semibold" style={profile.platform === "linkedin" ? { color: accent } : undefined}>
                  {formatCount(s.value)}
                </span>{" "}
                <span className={muted}>{s.label}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Centered, quiet layout: avatar, name, a single row of numbers. */
function MinimalCard(props: CardProps) {
  const { profile, options } = props;
  const { width, scale, dark, accent, PlatformIcon, stats, avatar, handleText, verified } = useCardBasics(props);
  const rectangular = options.shape === "rectangle";
  const avatarSize = (rectangular ? 76 : 84) * scale;

  return (
    <div
      data-card-shadow
      className={clsx("relative flex flex-col items-center text-center font-sans", rectangular && "overflow-hidden", dark ? "text-white" : "text-[#2a2a27]")}
      style={{
        width,
        maxHeight: rectangular ? width * 0.74 : undefined,
        padding: rectangular ? `${22 * scale}px ${24 * scale}px ${18 * scale}px` : `${28 * scale}px ${24 * scale}px ${22 * scale}px`,
        fontSize: 14 * scale,
        borderRadius: RADIUS.minimal * scale,
        background: dark ? "rgba(30,30,28,0.86)" : "rgba(255,255,255,0.86)",
        boxShadow: (dark
          ? ["inset 0 0 0 1px rgba(255,255,255,.08)", props.shadow && dropShadow(props.shadow, { y: 20, blur: 50, spread: -20, rgb: "0,0,0", alpha: 0.6 })]
          : [
              "inset 0 0 0 1px rgba(255,255,255,.9)",
              "0 1px 2px rgba(42,42,39,.06)",
              props.shadow && dropShadow(props.shadow, { y: 20, blur: 50, spread: -24, rgb: "42,42,39", alpha: 0.35 }),
            ]
        )
          .filter(Boolean)
          .join(", "),
        backdropFilter: "blur(12px)",
      }}
    >
      {options.showPlatformMark && (
        <PlatformIcon
          className={clsx("absolute h-[1.2em] w-[1.2em]", dark ? "text-white/50" : "text-black/35")}
          style={{ top: 16 * scale, right: 16 * scale }}
        />
      )}
      <div className="overflow-hidden rounded-full" style={{ width: avatarSize, height: avatarSize }}>
        <Avatar src={avatar} name={profile.name} accent={accent} />
      </div>

      <div className="flex items-center justify-center gap-[0.3em]" style={{ marginTop: (rectangular ? 10 : 14) * scale }}>
        <span className="font-medium tracking-[-0.02em]" style={{ fontSize: "1.45em" }}>
          {profile.name}
        </span>
        {verified && <VerifiedBadge className="h-[1.05em] w-[1.05em] shrink-0" color={accent} />}
      </div>
      <div className={clsx("font-mono", dark ? "text-white/45" : "text-black/40")} style={{ fontSize: "0.8em", marginTop: 2 * scale }}>
        {handleText}
      </div>

      {profile.bio && (
        <p className={clsx(rectangular && "line-clamp-2", "leading-snug", dark ? "text-white/75" : "text-black/60")} style={{ marginTop: (rectangular ? 8 : 10) * scale, maxWidth: "26em" }}>
          {profile.bio}
        </p>
      )}

      {stats.length > 0 && (
        <div
          className={clsx("flex w-full justify-center", dark ? "divide-white/10" : "divide-black/8", "divide-x")}
          style={{ marginTop: (rectangular ? 14 : 18) * scale }}
        >
          {stats.map((s) => (
            <div key={s.key} className="flex-1" style={{ maxWidth: 110 * scale }}>
              <div className="font-medium tracking-[-0.02em]" style={{ fontSize: "1.2em" }}>
                {formatCount(s.value)}
              </div>
              <div className={dark ? "text-white/45" : "text-black/45"} style={{ fontSize: "0.8em" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Admission-ticket layout with a perforated stub. */
function TicketCard(props: CardProps) {
  const { profile, options } = props;
  const { width, scale, dark, accent, PlatformIcon, stats, avatar, handleText, verified } = useCardBasics(props);
  const stub = width * 0.3;
  const notch = 9 * scale;
  // Punch two half-circles where the stub meets the body.
  const mask = `radial-gradient(circle at ${stub}px 0, transparent ${notch}px, #000 ${notch + 0.5}px) top / 100% 51% no-repeat, radial-gradient(circle at ${stub}px 100%, transparent ${notch}px, #000 ${notch + 0.5}px) bottom / 100% 51% no-repeat`;

  return (
    <div
      className={clsx("flex font-sans", dark ? "text-white" : "text-[#2a2a27]")}
      style={{
        width,
        minHeight: width * 0.48,
        fontSize: 13 * scale,
        borderRadius: RADIUS.ticket * scale,
        background: dark ? "#2a2a27" : "#ffffff",
        mask,
        WebkitMask: mask,
      }}
    >
      <div
        className="flex shrink-0 flex-col items-center justify-between text-white"
        style={{ width: stub, padding: `${16 * scale}px ${10 * scale}px`, background: accent }}
      >
        <div className="overflow-hidden rounded-full" style={{ width: stub * 0.62, height: stub * 0.62, boxShadow: `0 0 0 ${3 * scale}px #ffffff55` }}>
          <Avatar src={avatar} name={profile.name} accent={accent} />
        </div>
        {options.showPlatformMark ? (
          <PlatformIcon className="h-[1.5em] w-[1.5em]" />
        ) : (
          <span className="font-semibold opacity-80" style={{ fontSize: "0.8em" }}>
            admit one
          </span>
        )}
      </div>

      <div
        className="flex min-w-0 flex-1 flex-col justify-between"
        style={{
          padding: `${16 * scale}px ${18 * scale}px`,
          borderLeft: `${1.5 * scale}px dashed ${dark ? "#ffffff40" : "#2a2a2740"}`,
        }}
      >
        <div>
          <div className="flex items-center gap-[0.3em]">
            <span className="truncate leading-tight font-semibold tracking-[-0.02em]" style={{ fontSize: "1.45em" }}>
              {profile.name}
            </span>
            {verified && <VerifiedBadge className="h-[1.1em] w-[1.1em] shrink-0" color={accent} />}
          </div>
          <div className="truncate opacity-60">{handleText}</div>
          {profile.bio && (
            <p className="line-clamp-2 leading-snug" style={{ marginTop: 8 * scale }}>
              {profile.bio}
            </p>
          )}
        </div>

        {stats.length > 0 && (
          <div className="flex gap-[1.2em]" style={{ marginTop: 12 * scale }}>
            {stats.map((s) => (
              <div key={s.key}>
                <div className="font-bold" style={{ fontSize: "1.15em" }}>
                  {formatCount(s.value)}
                </div>
                <div className="opacity-60" style={{ fontSize: "0.85em" }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

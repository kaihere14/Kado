export type PlatformId = "x" | "github" | "instagram" | "youtube";

export interface Stat {
  key: string;
  label: string;
  value: number;
}

export interface Profile {
  platform: PlatformId;
  handle: string;
  name: string;
  bio: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  verified: boolean;
  url: string;
  stats: Stat[];
}

export interface PlatformConfig {
  id: PlatformId;
  label: string;
  /** Shown before the handle input, e.g. "x.com/" */
  prefix: string;
  placeholder: string;
  /** Default stat rows for a blank profile, in display order. */
  stats: { key: string; label: string }[];
  /** Stat keys visible by default. */
  defaultVisible: string[];
  hasBanner: boolean;
}

export const PLATFORMS: Record<PlatformId, PlatformConfig> = {
  x: {
    id: "x",
    label: "X",
    prefix: "x.com/",
    placeholder: "ArmanKiyotaka",
    stats: [
      { key: "followers", label: "followers" },
      { key: "following", label: "following" },
      { key: "posts", label: "posts" },
    ],
    defaultVisible: ["followers", "following"],
    hasBanner: true,
  },
  github: {
    id: "github",
    label: "GitHub",
    prefix: "github.com/",
    placeholder: "octocat",
    stats: [
      { key: "followers", label: "followers" },
      { key: "following", label: "following" },
      { key: "repos", label: "repos" },
    ],
    defaultVisible: ["followers", "following", "repos"],
    hasBanner: false,
  },
  instagram: {
    id: "instagram",
    label: "Instagram",
    prefix: "instagram.com/",
    placeholder: "your.handle",
    stats: [
      { key: "posts", label: "posts" },
      { key: "followers", label: "followers" },
      { key: "following", label: "following" },
    ],
    defaultVisible: ["posts", "followers", "following"],
    hasBanner: false,
  },
  youtube: {
    id: "youtube",
    label: "YouTube",
    prefix: "youtube.com/@",
    placeholder: "yourchannel",
    stats: [
      { key: "subscribers", label: "subscribers" },
      { key: "videos", label: "videos" },
      { key: "views", label: "views" },
    ],
    defaultVisible: ["subscribers", "videos"],
    hasBanner: true,
  },
};

export const PLATFORM_ORDER: PlatformId[] = ["x", "github", "youtube", "instagram"];

/** Where a card's content comes from: an image, a captured website, or a profile on one of the platforms. */
export const SOURCES = ["image", "website", "profile"] as const;
export type Source = (typeof SOURCES)[number];

export function isPlatformId(value: string): value is PlatformId {
  return value in PLATFORMS;
}

/** Accepts "@handle", full profile URLs, or a bare handle. */
export function normalizeHandle(input: string): string {
  let value = input.trim();
  value = value.replace(/^https?:\/\//, "").replace(/^www\./, "");
  value = value.replace(/^(x|twitter|github|instagram|youtube|m\.youtube)\.com\//i, "");
  value = value.split(/[/?#]/)[0];
  return value.replace(/^@/, "");
}

export function blankProfile(platform: PlatformId, handle: string): Profile {
  const config = PLATFORMS[platform];
  return {
    platform,
    handle,
    name: handle,
    bio: "",
    avatarUrl: null,
    bannerUrl: null,
    verified: false,
    url: `https://${config.prefix}${handle}`,
    stats: config.stats.map((s) => ({ ...s, value: 0 })),
  };
}

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

export function formatCount(value: number): string {
  return value < 10_000 ? value.toLocaleString("en") : compact.format(value);
}

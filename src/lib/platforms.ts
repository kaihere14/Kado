export type PlatformId = "x" | "github" | "linkedin" | "instagram";

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
  /** Whether we can pull public data automatically. Otherwise the user fills details by hand. */
  fetchable: boolean;
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
    fetchable: true,
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
    fetchable: true,
    stats: [
      { key: "followers", label: "followers" },
      { key: "following", label: "following" },
      { key: "repos", label: "repos" },
    ],
    defaultVisible: ["followers", "following", "repos"],
    hasBanner: false,
  },
  linkedin: {
    id: "linkedin",
    label: "LinkedIn",
    prefix: "linkedin.com/in/",
    placeholder: "your-name",
    fetchable: false,
    stats: [
      { key: "connections", label: "connections" },
      { key: "followers", label: "followers" },
    ],
    defaultVisible: ["connections", "followers"],
    hasBanner: true,
  },
  instagram: {
    id: "instagram",
    label: "Instagram",
    prefix: "instagram.com/",
    placeholder: "your.handle",
    fetchable: false,
    stats: [
      { key: "posts", label: "posts" },
      { key: "followers", label: "followers" },
      { key: "following", label: "following" },
    ],
    defaultVisible: ["posts", "followers", "following"],
    hasBanner: false,
  },
};

export const PLATFORM_ORDER: PlatformId[] = ["x", "linkedin", "github", "instagram"];

export function isPlatformId(value: string): value is PlatformId {
  return value in PLATFORMS;
}

/** Accepts "@handle", full profile URLs, or a bare handle. */
export function normalizeHandle(input: string): string {
  let value = input.trim();
  value = value.replace(/^https?:\/\//, "").replace(/^www\./, "");
  value = value.replace(/^(x|twitter|github|instagram)\.com\//i, "");
  value = value.replace(/^linkedin\.com\/in\//i, "");
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

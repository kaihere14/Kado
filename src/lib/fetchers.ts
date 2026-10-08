import "server-only";
import type { PlatformId, Profile } from "./platforms";

export class ProfileError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

interface FxUser {
  screen_name: string;
  name: string;
  description: string;
  followers: number;
  following: number;
  tweets: number;
  avatar_url: string | null;
  banner_url: string | null;
  url: string;
  verification?: { verified: boolean };
}

async function fetchX(handle: string): Promise<Profile> {
  // fxtwitter exposes public profile data without an API key.
  // It rejects requests without a User-Agent, and answers unknown handles with an HTML redirect.
  const res = await fetch(`https://api.fxtwitter.com/${encodeURIComponent(handle)}`, {
    headers: { "User-Agent": "kado/0.1 (profile card generator)" },
    next: { revalidate: 3600 },
  });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  if (res.status === 404 || (res.ok && !isJson)) {
    throw new ProfileError("No X account with that handle.", 404);
  }
  if (!res.ok) throw new ProfileError("Couldn't reach X right now. Try again.", 502);

  const { user } = (await res.json()) as { user?: FxUser };
  if (!user) throw new ProfileError("No X account with that handle.", 404);

  return {
    platform: "x",
    handle: user.screen_name,
    name: user.name,
    bio: user.description ?? "",
    // Upgrade the tiny default avatar to the 400px variant.
    avatarUrl: user.avatar_url?.replace("_normal.", "_400x400.") ?? null,
    bannerUrl: user.banner_url ? `${user.banner_url}/1500x500` : null,
    verified: Boolean(user.verification?.verified),
    url: user.url,
    stats: [
      { key: "followers", label: "followers", value: user.followers },
      { key: "following", label: "following", value: user.following },
      { key: "posts", label: "posts", value: user.tweets }
    ],
  };
}

interface GitHubUser {
  login: string;
  name: string | null;
  bio: string | null;
  avatar_url: string;
  html_url: string;
  followers: number;
  following: number;
  public_repos: number;
}

async function fetchGitHub(handle: string): Promise<Profile> {
  const headers: HeadersInit = { Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const res = await fetch(`https://api.github.com/users/${encodeURIComponent(handle)}`, {
    headers,
    next: { revalidate: 3600 },
  });
  if (res.status === 404) throw new ProfileError("No GitHub user with that name.", 404);
  if (res.status === 403) throw new ProfileError("GitHub rate limit hit. Try again shortly.", 429);
  if (!res.ok) throw new ProfileError("Couldn't reach GitHub right now. Try again.", 502);

  const user = (await res.json()) as GitHubUser;
  return {
    platform: "github",
    handle: user.login,
    name: user.name ?? user.login,
    bio: user.bio ?? "",
    avatarUrl: user.avatar_url,
    bannerUrl: null,
    verified: false,
    url: user.html_url,
    stats: [
      { key: "followers", label: "followers", value: user.followers },
      { key: "following", label: "following", value: user.following },
      { key: "repos", label: "repos", value: user.public_repos },
    ],
  };
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** "687M" → 687000000, "8,612" → 8612, "1.2K" → 1200 */
function parseCount(text: string): number {
  const match = text.replace(/,/g, "").match(/^([\d.]+)([KMB])?$/i);
  if (!match) return 0;
  const multiplier = { K: 1e3, M: 1e6, B: 1e9 }[match[2]?.toUpperCase() as "K" | "M" | "B"] ?? 1;
  return Math.round(parseFloat(match[1]) * multiplier);
}

function metaContent(html: string, property: string): string | null {
  const match = html.match(new RegExp(`<meta property="${property}" content="([^"]*)"`));
  return match ? decodeEntities(match[1]) : null;
}

/** Profile page Open Graph tags. Returns null when Instagram serves its login wall instead. */
async function fetchInstagramOpenGraph(handle: string): Promise<Profile | null> {
  // Instagram login-walls anonymous visitors from datacenter IPs (Vercel included),
  // but still serves Open Graph tags to Meta's own link-preview crawler.
  const res = await fetch(`https://www.instagram.com/${encodeURIComponent(handle)}/`, {
    headers: { "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)" },
    next: { revalidate: 3600 },
  });
  if (res.status === 404) throw new ProfileError("No Instagram account with that handle.", 404);
  if (!res.ok) return null;

  const html = await res.text();
  const description = metaContent(html, "og:description");
  const counts = description?.match(/^([\d.,]+[KMB]?) Followers, ([\d.,]+[KMB]?) Following, ([\d.,]+[KMB]?) Posts/i);
  if (!counts) return null;

  const title = metaContent(html, "og:title") ?? "";
  const name = title.match(/^(.*?)\s*\(@/)?.[1]?.trim();

  return {
    platform: "instagram",
    handle,
    name: name || handle,
    bio: "",
    avatarUrl: metaContent(html, "og:image"),
    bannerUrl: null,
    verified: false,
    url: `https://www.instagram.com/${handle}/`,
    stats: [
      { key: "posts", label: "posts", value: parseCount(counts[3]) },
      { key: "followers", label: "followers", value: parseCount(counts[1]) },
      { key: "following", label: "following", value: parseCount(counts[2]) },
    ],
  };
}

interface InstagramEmbedContext {
  username?: string;
  full_name?: string;
  is_verified?: boolean;
  profile_pic_url?: string;
  followers_count?: number;
  posts_count?: number;
}

/** Profile embed widget, made for third-party sites. Has exact counts but no following count. */
async function fetchInstagramEmbed(handle: string): Promise<Profile | null> {
  const res = await fetch(`https://www.instagram.com/${encodeURIComponent(handle)}/embed/`, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; kado/0.1; profile card generator)" },
    next: { revalidate: 3600 },
  });
  if (res.status === 404) throw new ProfileError("No Instagram account with that handle.", 404);
  if (!res.ok) throw new ProfileError("Couldn't reach Instagram right now. Try again.", 502);

  // The widget's data sits in a JSON string nested inside the page's own JSON.
  const raw = (await res.text()).match(/"contextJSON":("(?:[^"\\]|\\.)*")/)?.[1];
  let context: InstagramEmbedContext | undefined;
  try {
    context = raw ? (JSON.parse(JSON.parse(raw)) as { context?: InstagramEmbedContext }).context : undefined;
  } catch {
    return null;
  }
  if (context?.followers_count == null) return null;

  return {
    platform: "instagram",
    handle: context.username ?? handle,
    name: context.full_name || handle,
    bio: "",
    avatarUrl: context.profile_pic_url ?? null,
    bannerUrl: null,
    verified: Boolean(context.is_verified),
    url: `https://www.instagram.com/${handle}/`,
    stats: [
      { key: "posts", label: "posts", value: context.posts_count ?? 0 },
      { key: "followers", label: "followers", value: context.followers_count },
      // Not exposed by the embed, so the user fills it in.
      { key: "following", label: "following", value: 0 },
    ],
  };
}

async function fetchInstagram(handle: string): Promise<Profile> {
  // Instagram has no public API. Neither source exposes the bio, so the user adds it by hand.
  const profile = (await fetchInstagramOpenGraph(handle)) ?? (await fetchInstagramEmbed(handle));
  if (!profile) {
    throw new ProfileError("Couldn't read that Instagram profile. It may be private, so fill in the details yourself.", 404);
  }
  return profile;
}

const FETCHERS: Partial<Record<PlatformId, (handle: string) => Promise<Profile>>> = {
  x: fetchX,
  github: fetchGitHub,
  instagram: fetchInstagram,
};

export async function fetchProfile(platform: PlatformId, handle: string): Promise<Profile> {
  const fetcher = FETCHERS[platform];
  if (!fetcher) throw new ProfileError("This platform doesn't support auto-fetch yet.", 400);
  return fetcher(handle);
}

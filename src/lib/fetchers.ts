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
      { key: "posts", label: "posts", value: user.tweets },
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

const FETCHERS: Partial<Record<PlatformId, (handle: string) => Promise<Profile>>> = {
  x: fetchX,
  github: fetchGitHub,
};

export async function fetchProfile(platform: PlatformId, handle: string): Promise<Profile> {
  const fetcher = FETCHERS[platform];
  if (!fetcher) throw new ProfileError("This platform doesn't support auto-fetch yet.", 400);
  return fetcher(handle);
}

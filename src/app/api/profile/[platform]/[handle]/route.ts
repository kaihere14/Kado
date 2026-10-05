import { fetchProfile, ProfileError } from "@/lib/fetchers";
import { isPlatformId, normalizeHandle } from "@/lib/platforms";

const HANDLE_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;

export async function GET(_request: Request, ctx: RouteContext<"/api/profile/[platform]/[handle]">) {
  const { platform, handle: rawHandle } = await ctx.params;
  const handle = normalizeHandle(decodeURIComponent(rawHandle));

  if (!isPlatformId(platform)) {
    return Response.json({ error: "Unknown platform." }, { status: 400 });
  }
  if (!HANDLE_PATTERN.test(handle)) {
    return Response.json({ error: "That doesn't look like a valid handle." }, { status: 400 });
  }

  try {
    const profile = await fetchProfile(platform, handle);
    return Response.json(profile, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
    });
  } catch (error) {
    if (error instanceof ProfileError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Something went wrong." }, { status: 500 });
  }
}

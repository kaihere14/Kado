// Same-origin image proxy so html-to-image can read remote avatars/banners
// into a canvas without CORS tainting it. Only known profile CDNs are allowed.
const ALLOWED_HOSTS = new Set(["pbs.twimg.com", "abs.twimg.com", "avatars.githubusercontent.com"]);

const MAX_BYTES = 8 * 1024 * 1024;

export async function GET(request: Request) {
  const target = new URL(request.url).searchParams.get("url");
  if (!target) return new Response("Missing url", { status: 400 });

  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return new Response("Invalid url", { status: 400 });
  }
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) {
    return new Response("Host not allowed", { status: 403 });
  }

  const upstream = await fetch(url, { next: { revalidate: 86400 } });
  const contentType = upstream.headers.get("content-type") ?? "";
  if (!upstream.ok || !contentType.startsWith("image/")) {
    return new Response("Image unavailable", { status: 502 });
  }

  const body = await upstream.arrayBuffer();
  if (body.byteLength > MAX_BYTES) return new Response("Image too large", { status: 413 });

  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
    },
  });
}

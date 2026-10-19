import captureWebsite from "capture-website";
import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import { isPublicHost } from "./address.js";

// Each capture starts its own Chrome, so only this many run at once; more get a busy reply.
const MAX_RUNNING = 2;
// Chrome's sandbox stays on. A host that can't start it ("No usable sandbox" in the logs) can turn it off with
// CHROME_NO_SANDBOX=true, giving up that protection; the address checks below still apply.
const CHROME_ARGS = process.env.CHROME_NO_SANDBOX === "true" ? ["--no-sandbox"] : [];

const app = express();
// Render sits in front as one proxy, so req.ip is the visitor's address.
app.set("trust proxy", 1);
app.use(cors());
app.use(
  "/api/capture",
  rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "That's a lot of captures. Try again in a few minutes." },
  }),
);

let running = 0;

// GET /api/capture?url=example.com → a JPEG of the top of the page, in a 1440 × 900 window at 2x.
app.get("/api/capture", async (req, res) => {
  const input = String(req.query.url ?? "").trim();
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    res.status(400).json({ error: "That doesn't look like a web address." });
    return;
  }
  if (!(await isPublicHost(url.hostname))) {
    res.status(400).json({ error: "That site couldn't be found, or isn't on the public web." });
    return;
  }
  if (running >= MAX_RUNNING) {
    res.status(503).set("Retry-After", "10").json({ error: "The capture server is busy. Try again in a moment." });
    return;
  }

  running++;
  // Each host the page loads from is looked up once per capture.
  const verdicts = new Map<string, Promise<boolean>>();
  try {
    const image = await captureWebsite.buffer(url.href, {
      inputType: "url",
      width: 1440,
      height: 900,
      scaleFactor: 2,
      type: "jpeg",
      quality: 0.9,
      timeout: 25,
      // Ad blocking intercepts requests too, and two interceptors on one page conflict.
      blockAds: false,
      launchOptions: { args: CHROME_ARGS },
      // Every request the page makes, redirects included, must go to a public address too.
      beforeNavigation: async (page) => {
        await page.setRequestInterception(true);
        page.on("request", async (request) => {
          const { protocol, hostname } = new URL(request.url());
          if (protocol === "data:" || protocol === "blob:") return request.continue();
          if (!verdicts.has(hostname)) verdicts.set(hostname, isPublicHost(hostname));
          const ok = (protocol === "http:" || protocol === "https:") && (await verdicts.get(hostname));
          return ok ? request.continue() : request.abort("blockedbyclient");
        });
      },
    });
    res.type("jpeg").send(Buffer.from(image));
  } catch {
    res.status(502).json({ error: "Couldn't capture that site. Check the address and try again." });
  } finally {
    running--;
  }
});

app.listen(process.env.PORT || 10000, () => console.log("Capture server running"));

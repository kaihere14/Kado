import captureWebsite from "capture-website";
import cors from "cors";
import express from "express";

const app = express();
app.use(cors());

// GET /api/capture?url=example.com → a JPEG of the top of the page, in a 1440 × 900 window at 2x.
app.get("/api/capture", async (req, res) => {
  const input = String(req.query.url ?? "").trim();
  let url: string;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`).href;
  } catch {
    res.status(400).json({ error: "That doesn't look like a web address." });
    return;
  }

  try {
    const image = await captureWebsite.buffer(url, {
      inputType: "url",
      width: 1440,
      height: 900,
      scaleFactor: 2,
      type: "jpeg",
      quality: 0.9,
      timeout: 25,
      // Render can't start Chrome's sandbox.
      launchOptions: { args: ["--no-sandbox"] },
    });
    res.type("jpeg").send(Buffer.from(image));
  } catch {
    res.status(502).json({ error: "Couldn't capture that site. Check the address and try again." });
  }
});

app.listen(process.env.PORT || 10000, () => console.log("Capture server running"));

# kado capture server

An Express server for kado's Website tab. `GET /api/capture?url=example.com` opens the page in headless Chrome and returns a JPEG of the top of it.

- It refuses local and private network addresses, for the link and for every request the page makes, redirects included.
- Each visitor gets 20 captures every 10 minutes, and at most 2 captures run at once. Past either limit it answers 429 or 503.
- Chrome's sandbox stays on. If Chrome won't start on your host ("No usable sandbox" in the logs), set `CHROME_NO_SANDBOX=true`. That turns off a layer of protection against malicious pages, so only do it when the host leaves no other choice.

Run it locally:

```sh
cd capture-server
npm install
npm run dev   # http://localhost:10000, restarts on changes
```

Both `npm run dev` and `npm run build` download Chrome into `.cache/` the first time. For production, `npm run build` also compiles to `dist/`, and `npm start` runs it.

On Render, create a Web Service with:

- Root Directory: `capture-server`
- Build Command: `npm install --include=dev && npm run build`
- Start Command: `npm start`

Then set `NEXT_PUBLIC_CAPTURE_URL` in kado (`.env.local`, and the Vercel project) to the server's address, without `/api`.

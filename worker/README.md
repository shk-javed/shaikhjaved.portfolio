# SHK JAVED guide: Gemini proxy (Cloudflare Worker)

This small Cloudflare Worker lets the "Talk to Me" pangolin on the portfolio phrase its answers with Google Gemini, without putting an API key in the browser or in this repo.

**The site works without it.** With no endpoint set, the guide answers fully on the page. When an endpoint is set, the browser still builds the verified answer locally first. It sends only the question and the ids of the facts behind that answer (never fact text) to this worker. The worker loads the matching facts from the public `twin/knowledge.json`, asks Gemini to reword them, and checks the reply. If anything fails, the browser keeps its local answer.

```
browser ──{ v, q, factIds }──▶ worker ──▶ Gemini Interactions API
   ▲                              │  (loads fact text from KB_URL, validates the reply)
   └──{ ok, answer, used } ◀──────┘
```

| File | What it is |
| --- | --- |
| `src/index.js` | The Worker entry (`export default { fetch }`). |
| `src/twin.js` | All logic: CORS, limits, prompt, Gemini call and answer validation. |
| `wrangler.toml` | Worker name and public settings. It holds **no secrets**. |
| `test.mjs` | Offline tests with mocked `fetch`. They need no key and no network. |
| `.gitignore` | Keeps `.dev.vars` (your local key) and wrangler caches out of git. |

This folder is public on GitHub Pages, which is fine because it contains no secrets. The Gemini key only ever lives in Cloudflare's secret store.

## Turn it on (about 10 minutes)

You need Node.js 20 or newer (for `npx`).

1. **Create a Gemini API key (free, no billing).**
   - Open [Google AI Studio → API keys](https://aistudio.google.com/apikey).
   - Click **Create API key** and copy it. Keep the tab open.
   - **Do not set up billing** for this project. Without billing, Gemini's free quota is the hard limit, and going over it just returns "quota" errors, never charges.
   - Optional: in Google Cloud Console → APIs & Services → Credentials, restrict the key to the "Generative Language API".
2. **Create a free Cloudflare account** at [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up). No card is needed for the Workers Free plan.
3. **Log in from this folder:**
   ```sh
   cd worker && npx wrangler@latest login
   ```
   A browser tab opens. Click **Allow**.
4. **Store the key as a secret:**
   ```sh
   npx wrangler@latest secret put GEMINI_API_KEY
   ```
   Paste the key when asked. If wrangler offers to create the `shk-javed-twin` Worker, answer **yes**. The key goes straight to Cloudflare and is never written to this repo.
5. **Deploy:**
   ```sh
   npx wrangler@latest deploy
   ```
   The first time, wrangler may ask you to pick a `workers.dev` subdomain. At the end it prints a URL like `https://shk-javed-twin.<your-subdomain>.workers.dev`. Copy it.
6. **Point the site at it.** In `index.html`, put the URL in the `data-tw-endpoint` attribute of the `twin/tw-boot.js` script tag:
   ```html
   <script src="twin/tw-boot.js" data-tw-endpoint="https://shk-javed-twin.<your-subdomain>.workers.dev" defer></script>
   ```
7. **Push:**
   ```sh
   git add index.html && git commit -m "Turn on Gemini phrasing for the guide" && git push
   ```
   GitHub Pages updates in a minute or two. The guide's footer then says that questions are sent to Google Gemini.

**Check it from a terminal** (this should print `{"ok":true,...}`):
```sh
curl -s https://shk-javed-twin.<your-subdomain>.workers.dev \
  -H 'Origin: https://shk-javed.github.io' -H 'Content-Type: application/json' \
  -d '{"v":1,"q":"What does Javed do?","factIds":["f.id.title"]}'
```
To watch live outcomes (reason codes and counts only, never questions), run `npx wrangler@latest tail`.

## Test locally

**Offline unit tests** need no key and no network:
```sh
node worker/test.mjs        # or: cd worker && npm test
```

**Real end-to-end run on your machine:**

1. Create `worker/.dev.vars`. Git already ignores it, and it must never be committed. Put these two lines in it:
   ```
   GEMINI_API_KEY=paste-your-key-here
   ALLOWED_ORIGINS=http://localhost:8000,http://127.0.0.1:8000
   ```
2. Start the worker:
   ```sh
   cd worker && npx wrangler@latest dev      # serves http://localhost:8787
   ```
3. In another terminal, serve the site from the repo root with `python3 -m http.server 8000`.
4. Temporarily set `data-tw-endpoint="http://localhost:8787"` in `index.html`. **Don't commit that.**
5. Open http://localhost:8000.

By default the worker reads facts from the live site (`KB_URL`). To test unpublished knowledge.json edits, add `KB_URL=http://localhost:8000/twin/knowledge.json` to `.dev.vars`.

## Turn it off

- **Site side (instant, recommended):** empty or remove the `data-tw-endpoint` attribute in `index.html`, then push. The guide goes back to fully on-page answers.
- **Server side:** set `DAILY_CAP = "0"` in `wrangler.toml` and run `npx wrangler@latest deploy`. Every call then gets `reason:"rate"` and the browser falls back to local answers.
- **Remove everything:** run `npx wrangler@latest delete` and delete the key in AI Studio.

## Settings (`wrangler.toml` → `[vars]`)

| Var | Default | Meaning |
| --- | --- | --- |
| `MODEL` | `gemini-3.5-flash-lite` | Gemini model id. Keep it to one with a free tier. |
| `KB_URL` | `https://shk-javed.github.io/shaikhjaved.portfolio/twin/knowledge.json` | Where fact text is loaded from (cached for 1 h per isolate). |
| `ALLOWED_ORIGINS` | `https://shk-javed.github.io` | Comma list of exact origins (no path). Add a custom domain here if you ever use one. |
| `DAILY_CAP` | `1000` | Accepted requests per isolate per UTC day. `0` turns it off. |
| `TIMEOUT_MS` | `9000` | Budget for the knowledge base fetch + Gemini call (clamped to 1000–20000). Keep it below the site's 10 s. |
| `GEMINI_API_KEY` | (secret) | Set only with `wrangler secret put`. Never put it in `[vars]`. |

## Cost: ₹0, as long as billing stays off

- **Cloudflare Workers Free:** 100,000 requests/day (resets at midnight UTC), 10 ms CPU per request (waiting on Gemini doesn't count) and 50 subrequests per request. This worker uses at most 2 subrequests (knowledge base and Gemini). Going over the free limits makes requests fail; it never bills you.
- **Gemini free tier:** when the quota runs out, Gemini returns HTTP 429. The worker answers `reason:"quota"` and the site shows its local answer.
- **Never enable billing** on the Google AI Studio / Cloud project that owns this key. Billing is the only way this setup could cost money. Without it, Gemini's free quota is the real hard cap.

## Limits and safety

**Origin.** Only origins in `ALLOWED_ORIGINS` get CORS headers. Other origins, and requests without an `Origin` header, get `reason:"origin"` and Gemini is never called. A non-browser client can fake `Origin`, so the rate limits below are the real abuse guard.

**Request shape.** The worker accepts only `POST` with `Content-Type: application/json`, a body of at most 4 KB, and `{ "v": 1, "q": 1–500 chars, "factIds": 1–6 ids of ≤ 64 chars }`. It drops unknown ids and `resume_only` facts. If no ids are left, it answers `bad_request`.

**Rate limits are best effort.** Per IP, it allows 6 requests per minute and 60 per 24 h (sliding windows; IPv6 is grouped by /64). On top of that there is a global `DAILY_CAP` per UTC day. These counters live in each Worker **isolate's memory**. Cloudflare runs many isolates and recycles them, so the limits are approximate and reset whenever an isolate restarts. The firm ceiling is Gemini's free quota, which holds as long as billing is not enabled.

**Answer checks.** The worker rejects a Gemini reply with `reason:"unverified"`, and the site falls back to its local answer, if any of these is true:
- the answer is empty or longer than 600 characters;
- `used` is not a non-empty subset of the ids that were sent;
- it has a number or date token (digits, number words or month names; commas and `%` are normalised, so `2,224` = `2224`) that is not in the used facts' text;
- it has a URL or an email address;
- it has a phone-like number;
- it speaks as Javed ("I am Javed", "my name is Shaikh Javed", "as Javed, I…", "my projects", "I built…");
- it claims to be human;
- it uses markdown (`*`, `#`, backticks, links or lists).

So contact and repo questions, whose facts contain links or emails, always use the local answer. The browser runs the same kind of checks again.

**Timeouts.** The whole upstream budget is `TIMEOUT_MS` (9 s, AbortController). Meanwhile the site shows the local answer as a grey draft while the guide searches. A reply within 10 s turns it into Gemini's wording; otherwise the draft becomes final as is. Free-tier Flash-Lite took 1.5–9 s in Nov 2026, with occasional 503s.

**Logs.** Each request logs one line: `{evt, ok, reason, why, facts, up, gm, use, steps, ms}`. Here `up` is Gemini's HTTP status, `gm` its round-trip in ms, `use` its token counts, and `steps` its step types. Watch them with `npx wrangler@latest tail --format json`.

## Privacy

- The question, plus the text of at most 6 verified public facts, is sent to Google Gemini.
- On the free tier, Google may use submitted content to improve its products. The site discloses this next to the chat, and a **Local mode** toggle keeps everything on the page.
- The worker sends `"store": false` so the interaction isn't stored for later retrieval.
- The worker sets no cookies and stores nothing.
- It keeps visitor IPs in memory only, for rate limiting, and never logs them.
- Its logs hold reason codes and counts only. It never logs the question, the answer or the key.
- Cloudflare and Google may keep their own standard request metadata.

## Contract (shared with `twin/tw-app.js`)

- **Request:** `POST` with `Content-Type: application/json` and body `{ "v": 1, "q": string, "factIds": [string] }`. No cookies.
- **Response:** always HTTP 200 JSON with CORS headers (preflight is 204; non-POST is 405):
  - `{ "ok": true, "answer": string, "used": [factId] }`
  - `{ "ok": false, "reason": "bad_request" | "origin" | "rate" | "quota" | "upstream" | "unverified" | "timeout" }`
- **Fallback:** the client keeps its local answer on any `ok:false`, non-200, malformed JSON or after 10 s.

# Warthog Cloudflare Worker

The Worker is the private backend between the phone app and Gemini. The Gemini API key is never placed in the mobile site.

## Required secrets

Set these with Wrangler or in the Cloudflare dashboard:

- `GEMINI_API_KEY` — your Google Gemini API key.
- `GITHUB_TOKEN` — only required if the `/refresh` endpoint should trigger the repository knowledge-update workflow. Use a narrowly scoped token that can dispatch Actions in this repository.

## Public variables

See `wrangler.toml`. The Worker reads the generated `kb.json` and `manifest.json` from GitHub Pages.

## Deploy with Wrangler

1. Install Node.js LTS.
2. Install Wrangler: `npm install -g wrangler`.
3. Run `wrangler login` and authorize the Cloudflare account.
4. From this directory run `wrangler secret put GEMINI_API_KEY` and paste the key when prompted.
5. If automatic `/refresh` is desired, add a GitHub token as `wrangler secret put GITHUB_TOKEN`.
6. Run `wrangler deploy`.
7. Copy the resulting `https://...workers.dev` URL into `site/app.js` as `WORKER_URL`.

## Security notes

- Never put Gemini or GitHub tokens in Git.
- Do not expose the Worker token values to the browser.
- The Worker has request-size and evidence-size limits.
- This project provides external tactical advice only; it does not automate or modify War Thunder.

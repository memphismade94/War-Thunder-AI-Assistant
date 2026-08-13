# WARTHOG — War Thunder Ground RB AI Assistant

A voice-first tactical assistant for War Thunder Ground Realistic Battles.

## Current build

The repository now contains the first end-to-end application foundation:

- Mobile-first Ground RB interface in `site/`
- Persistent match context stored locally in the browser
- Hold-to-talk microphone capture
- Gemini audio input through the Cloudflare Worker
- Text question fallback
- Warthog tactical system prompt
- Official-first Wiki crawler
- Source-attributed knowledge chunks
- Match-aware retrieval and ranking
- Scheduled/manual GitHub Actions knowledge refresh
- Generated `kb.json` and `manifest.json` publication flow
- GitHub Pages deployment workflow
- Cloudflare Worker configuration template
- Unit tests for crawler behavior

## Architecture

```text
Phone
  -> GitHub Pages mobile app
  -> Cloudflare Worker
  -> official knowledge retrieval
  -> Gemini 3.6 Flash
  -> concise tactical answer
  -> phone text / speech synthesis

Official War Thunder Wiki
  -> crawler
  -> categorized chunks
  -> kb.json
  -> GitHub Pages
```

## Official knowledge policy

The initial knowledge source registry is official War Thunder Wiki material. The current Wiki exposes dedicated Ground Vehicles, Realistic Battles, armor and tank-ammunition material, and vehicle pages contain battle ratings, vehicle characteristics, armor, weapons and ammunition data. Community material may be added later as a clearly separated evidence tier rather than mixed invisibly with official facts.

## Setup status

The code is ready for deployment, but the external services still require the owner's credentials/configuration:

1. Enable GitHub Actions if it is disabled for the repository.
2. Enable GitHub Pages using the repository's GitHub Actions workflow.
3. Deploy `worker/src/index.js` to Cloudflare Workers.
4. Add `GEMINI_API_KEY` as an encrypted Cloudflare Worker secret.
5. Add a narrowly scoped `GITHUB_TOKEN` as a Worker secret if the mobile app should trigger knowledge refreshes.
6. Set `PUBLIC_KB_URL` and `PUBLIC_MANIFEST_URL` to the deployed GitHub Pages URLs.
7. Set the Worker URL in `site/app.js`.

Never commit API keys or tokens to this repository.

## Fair-play boundary

Warthog is an external tactical assistant. It does not read War Thunder process memory, inject into the client, automate controls, alter game files, or retrieve hidden client state.

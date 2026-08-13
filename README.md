# WARTHOG — War Thunder Ground RB AI Assistant

A voice-first tactical assistant for War Thunder Ground Realistic Battles.

## Project goals

- Mobile-first voice interface for live Ground RB questions
- Match-context aware tactical reasoning
- Official War Thunder knowledge-base ingestion and refresh
- Source-aware retrieval rather than relying on model memory alone
- Automatic knowledge update workflow
- External assistant only: no game-memory reading, injection, automation, or client modification

## Planned structure

- `site/` — mobile web app
- `worker/` — API/security layer
- `scripts/` — knowledge ingestion and processing
- `config/` — system prompt and source configuration
- `.github/workflows/` — automated knowledge refresh
- `data/` — source manifests and generated metadata

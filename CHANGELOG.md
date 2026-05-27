# Changelog

## Initial Production Release

### Product

- Added a heads-up No-Limit Hold'em table against a Daniel Negreanu-inspired opponent.
- Added post-hand coaching that explains the hand, the user's key decision, and a concrete adjustment.
- Added persistent mistake memory so repeated patterns can be surfaced in later coaching.
- Added a five-hand free tier with a user-provided Anthropic API key path for continued play.
- Added a settings page for API-key management and mistake notes.
- Added inline glossary support for poker terms in coaching text.

### Platform

- Added a Next.js frontend, Node/Express API, and Python/FastAPI poker engine.
- Added Clerk authentication across protected routes.
- Added Upstash Redis persistence for game state, mistakes, rate limits, and encrypted API keys.
- Added private Railway networking for the API and poker-engine services.
- Added production custom domain support at `playwithdanielnegreanu.com`.

### Security

- Removed public exposure for backend services.
- Restricted API CORS to the production frontend origin.
- Stripped deck data from game-state responses.
- Loaded canonical hand facts server-side for coaching.
- Hardened client-facing errors to avoid stack traces, file paths, and secret names.
- Added dependency pinning and audit checks.

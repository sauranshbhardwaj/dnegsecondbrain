# Agent Notes

This repo powers Kid Poker Second Brain, a production heads-up poker product with three services:

- `services/frontend`: Next.js App Router frontend.
- `services/api`: Node/Express API for auth, coaching, persistence, rate limits, and encrypted user API keys.
- `services/poker-engine`: Python/FastAPI poker engine.

Read these before making product or UI changes:

- `README.md`
- `DESIGN_BRIEF.md`
- `CLAUDE.md`
- `services/api/CLAUDE.md`

## Operating Rules

- Keep the API and poker-engine services private behind Railway internal networking.
- Never expose secret values, Clerk secret keys, Upstash tokens, Anthropic keys, or encrypted user API-key material.
- Treat browser input as untrusted. Coaching should use server-loaded canonical hand facts.
- Keep the deck out of all browser-facing game-state responses.
- Preserve Clerk auth on protected routes.
- Keep CORS restricted to the production frontend origin.
- Keep user Anthropic keys encrypted at rest, decrypted only at call time, and never returned in responses.

## Verification

Before shipping changes, run the checks that match the touched service:

```bash
cd services/frontend && npm run typecheck && npm run build
cd services/api && npm test && npm run build
cd services/poker-engine && python3 -m pytest
```

For launch or dependency work, also run:

```bash
cd services/frontend && npm audit
cd services/api && npm audit
cd services/poker-engine && python3 -m pip check
```

# Kid Poker Second Brain

Kid Poker Second Brain is a heads-up No-Limit Hold'em product where Daniel Negreanu is both the opponent and the post-hand coach. Users play real hands, make their own decisions, and receive hand-specific coaching after each completed pot.

Production: https://playwithdanielnegreanu.com

This project is not affiliated with Daniel Negreanu.

## Product

The product is built around a simple loop:

1. Sit down at a heads-up table.
2. Play against a Daniel Negreanu-inspired bot.
3. Finish the hand by folding or reaching showdown.
4. Receive coaching that explains the bot's thinking, the user's key decision, and one concrete adjustment.
5. Persist recurring mistake patterns so future coaching can call them out directly.

The first five hands are free. After that, users can connect their own Anthropic API key to keep playing. User-supplied keys are encrypted before storage, decrypted only when a Claude call is made, and never returned by the API.

## Architecture

The app is split into three Railway services:

| Service | Stack | Exposure | Purpose |
| --- | --- | --- | --- |
| `services/frontend` | Next.js App Router | Public | Web UI, Clerk auth, API proxy routes |
| `services/api` | Node.js and Express | Private Railway network | Authenticated coaching, rate limiting, persistence, Claude calls |
| `services/poker-engine` | Python and FastAPI | Private Railway network | Heads-up game state machine and showdown evaluation |

Supporting services:

- Clerk for authentication.
- Upstash Redis for sessions, mistake memory, free-hand counts, and encrypted API keys.
- Claude API for coaching and mistake extraction.
- Cloudflare for DNS and `www` to root-domain redirect.

## Security Posture

- The API and poker-engine services are private Railway services.
- The browser calls only the public frontend domain.
- Clerk auth protects game, profile, coaching, and API-key routes.
- CORS on the API is restricted to the production frontend origin.
- Poker-engine responses strip the deck before returning game state.
- Coaching facts are loaded server-side from the canonical completed hand instead of trusting browser-supplied hand data.
- User Anthropic keys are encrypted at rest and never included in API responses.
- Prompt construction treats wiki context, mistake history, and user profile data as untrusted data, not executable instructions.

## Local Development

Install dependencies for each service:

```bash
cd services/frontend && npm install
cd services/api && npm install
cd services/poker-engine && python3 -m pip install -r requirements.txt
```

Run the services locally:

```bash
cd services/poker-engine && uvicorn app.main:app --reload
cd services/api && npm run dev
cd services/frontend && npm run dev
```

Required environment variables are documented in:

- `services/frontend/.env.example`
- `services/api/.env.example`
- `DEPLOYMENT.md`

## Verification

Run the core checks before shipping:

```bash
cd services/frontend && npm run typecheck && npm run build && npm audit
cd services/api && npm test && npm run build && npm audit
cd services/poker-engine && python3 -m pytest && python3 -m pip check
```

Production smoke checks:

- `https://playwithdanielnegreanu.com` loads over HTTPS.
- `https://www.playwithdanielnegreanu.com` redirects to the root domain.
- Clerk live sign-in redirects to `/table`.
- A user can play hands, fold, reach showdown, receive coaching, view settings, add/remove an API key, and continue past the free-hand limit with their own key.

## Future Features

Planned post-launch work:

- Spoken coaching with a voice layer.
- Hand replay and visual decision review.
- Richer session history and trend summaries.
- Expanded mistake taxonomy with severity over time.
- Mobile-first table layout refinements.
- Additional bot personalities and training modes.
- More poker formats after heads-up Hold'em is stable.
- Optional solver-style review overlays for advanced users.

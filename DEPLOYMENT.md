# Deployment Guide

Production domain: https://playwithdanielnegreanu.com

## Services

All three services run on Railway:

- `services/frontend`: Next.js, public, mapped to the production domain.
- `services/api`: Node.js/Express, private Railway network only.
- `services/poker-engine`: Python/FastAPI, private Railway network only.

The browser should never call the API or poker-engine services directly. It calls the frontend domain, and the frontend talks to the private services from server-side proxy routes.

## Railway Environment Variables

### `poker-engine`

No app secrets are required.

Start command:

```bash
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Set:

```text
PORT=8000
```

### `api`

Set:

```text
PORT=3001
NODE_ENV=production
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-sonnet-4-20250514
CLAUDE_MAX_TOKENS=700
CLERK_SECRET_KEY=sk_live_...
CLERK_PUBLISHABLE_KEY=pk_live_...
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
API_KEY_ENCRYPTION_SECRET=<stable 32+ character secret>
FRONTEND_URL=https://playwithdanielnegreanu.com
POKER_ENGINE_URL=http://poker-engine.railway.internal:8000
```

### `frontend`

Set:

```text
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
NODE_API_URL=http://api.railway.internal:3001
POKER_ENGINE_URL=http://poker-engine.railway.internal:8000
```

## DNS

Cloudflare manages DNS for `playwithdanielnegreanu.com`.

Required behavior:

- Root domain points to the Railway frontend service.
- `www.playwithdanielnegreanu.com` redirects to `https://playwithdanielnegreanu.com`.
- Clerk DNS records remain DNS-only in Cloudflare.
- Cloudflare SSL mode is `Full`.

## Launch Verification

Before announcing:

- Root domain loads over HTTPS.
- `www` redirects to root and preserves path/query string.
- Clerk live Google sign-in works.
- Sign-in from the landing page redirects to `/table`.
- The user can play a new hand, fold, check/call, raise, reach showdown, and start a new hand.
- Coaching appears after fold and showdown hands.
- Mistake memory appears in settings and can be referenced by coaching.
- The free-hand limit blocks after five hands without a user API key.
- Adding a user Anthropic API key allows continued play.
- Removing the user API key restores free-limit behavior.
- The settings page never displays plaintext or encrypted API-key material.
- Old public API and poker-engine Railway URLs return fallback or not-found responses.
- `npm audit`, frontend build/typecheck, API tests/build, poker-engine tests, and `pip check` pass.

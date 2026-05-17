---
# Deployment Guide — playlikedanielnegreanu.com

## Services to deploy (Railway)
Three services, all on Railway:
- services/poker-engine — Python FastAPI (private, internal only)
- services/api — Node.js/Express (private, internal only)
- services/frontend — Next.js (public, mapped to playlikedanielnegreanu.com)

## Deployment order
1. Deploy poker engine first. Copy its internal Railway URL.
2. Deploy Node API second. Copy its internal Railway URL.
3. Deploy frontend last, using the URLs from steps 1 and 2.

## Environment variables

### services/poker-engine
No app secrets required.
Set the start command to:
uvicorn app.main:app --host 0.0.0.0 --port $PORT

### services/api
PORT=3001 (Railway injects this automatically)
NODE_ENV=production
ANTHROPIC_API_KEY=sk-ant-...
CLERK_SECRET_KEY=sk_live_...
CLERK_PUBLISHABLE_KEY=pk_live_...
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
API_KEY_ENCRYPTION_SECRET=<stable 32+ char secret, never rotate>
FRONTEND_URL=https://playlikedanielnegreanu.com

### services/frontend
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
NODE_API_URL=<internal Railway URL for Node API>
POKER_ENGINE_URL=<internal Railway URL for poker engine>

## Post-deployment steps (in order)
1. Set poker engine to private/internal on Railway so it is
   not reachable from the public internet.
2. Set Node API to private/internal on Railway so only the
   frontend can reach it.
3. Map playlikedanielnegreanu.com to the frontend Railway service.
4. Switch Clerk keys from pk_test/sk_test to pk_live/sk_live
   in both the frontend and Node API environment variables.
5. Verify the full flow: sign in, play a hand, receive coaching,
   check settings.
6. Confirm CORS is blocking requests from origins other than
   playlikedanielnegreanu.com.
---

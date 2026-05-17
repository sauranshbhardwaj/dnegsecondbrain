# API Service

Node/Express API for Claude-powered DN coaching, Clerk auth, and Upstash-backed persistence.

Run locally:

```bash
npm install
npm run dev
```

Run tests:

```bash
npm test
```

Environment:

- `ANTHROPIC_API_KEY`: app-level Anthropic key for Day 2.
- `CLAUDE_MODEL`: defaults to `claude-sonnet-4-20250514`.
- `CLAUDE_MAX_TOKENS`: defaults to `700`.
- `CLERK_SECRET_KEY`: Clerk backend secret for verifying protected API requests.
- `CLERK_PUBLISHABLE_KEY`: Clerk publishable key used by Clerk middleware.
- `CLERK_JWT_KEY`: optional Clerk JWT key for networkless verification.
- `UPSTASH_REDIS_REST_URL`: Upstash Redis REST endpoint.
- `UPSTASH_REDIS_REST_TOKEN`: Upstash Redis REST token.
- `API_KEY_ENCRYPTION_SECRET`: at least 16 characters; used to derive the AES-256-GCM key for user Anthropic keys.
- `PORT`: defaults to `3001`.

Protected routes:

- `POST /coaching/analyze`: requires Clerk auth, uses Clerk `userId`, reads permanent mistakes, applies the 5-hand free limit, streams coaching over SSE, then persists extracted mistakes.
- `GET /user/profile`: requires Clerk auth, returns mistake profile, free-hand usage, free-hand limit, and whether a user Anthropic key is connected.
- `POST /user/apikey`: requires Clerk auth. Send `{ "apiKey": "sk-ant-..." }` to store an encrypted user Anthropic key, or `{ "delete": true }` to remove it. The API never returns plaintext or encrypted key material.
Redis keys:

- `session:{userId}:current`
- `mistakes:{userId}`
- `ratelimit:{userId}:hands`
- `apikey:{userId}`

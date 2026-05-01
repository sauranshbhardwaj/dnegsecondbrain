# Daniel Negreanu Second Brain - V1 Build Roadmap

## Product Vision

Build a heads-up No-Limit Hold'em poker product where Daniel Negreanu acts as both opponent and post-hand coach. After every hand, DN explains his own thinking, the user's key decisions, recurring mistakes, and one concrete adjustment.

The product is framed as Daniel sitting at the table with the user, watching every hand, remembering their habits, and commenting because that is who he is.

## Target User

The product serves mixed-skill poker players. Serious players should get real strategic depth. Casual players should still understand key concepts through an inline glossary written in a brief DN-like voice.

## V1 Tech Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Frontend | Next.js App Router | UI, routing, streaming responses |
| Backend API | Node.js + Express | Game orchestration, coaching endpoints, auth middleware |
| Poker Engine | Python + FastAPI | Game state machine and treys showdown evaluation |
| LLM | Claude API (`claude-sonnet-4-20250514`) | DN persona, coaching, mistake extraction |
| Auth | Clerk | User identity |
| Persistence | Upstash Redis | Game state, mistake profiles, rate limits, API keys |
| Hosting | Railway or Render | Service deployment |

## Architecture

Browser clients talk to the Node API. The Node API calls the Python poker engine for game state updates and Claude for coaching. Redis stores session state, mistake memory, rate limits, user API keys, and eval results.

## Redis Schema

All keys must be namespaced by Clerk `userId`.

```text
session:{userId}:current
mistakes:{userId}
ratelimit:{userId}:hands
apikey:{userId}
eval:{userId}:{sessionId}
```

Mistake objects contain:

```json
{
  "pattern": "over-folds to 3-bets out of position",
  "firstSeen": "2026-04-17T03:00:00Z",
  "lastSeen": "2026-04-17T05:00:00Z",
  "frequency": 3,
  "severity": "high",
  "handsContext": ["hand_id_1", "hand_id_2"]
}
```

## Rate Limiting

Users get 5 free hands without an API key. After hand 5, prompt for their Anthropic API key. API-key users get unlimited hands and Claude calls should use the user's key.

## Day 1 - Poker Engine

Goal: complete a playable hand via API calls with correct game logic.

- Set up the FastAPI project and `treys`.
- Build deck management: shuffle, deal, and burn.
- Build the state machine: `WAITING -> PREFLOP -> FLOP -> TURN -> RIVER -> SHOWDOWN -> COMPLETE`.
- Implement betting validation: call, check, raise min/max, all-in, and pot/stack accounting.
- Add a rule-based DN bot that feels stylistically authentic without trying to be a solver.
- Use `treys` only at showdown.
- Expose `/game/new`, `/game/action`, `/game/state`, and `/game/showdown`.
- Verify fold, call/check, raise, all-in, street advancement, and showdown winner behavior.

Day 1 uses in-memory sessions only, keyed by `userId`. Defaults are starting stack `1000`, small blind `25`, and big blind `50`.

## Day 2 - DN Persona and Claude API

Goal: feed complete hand history into Claude and receive coaching that sounds like modern Daniel Negreanu.

- Use `CLAUDE.md` as the system prompt.
- Add 15 to 20 curated wiki files.
- Build `/coaching/analyze`.
- Select 2 to 3 relevant wiki articles per hand.
- Include the user's mistake profile in prompt context.
- Make a secondary lightweight mistake-extraction call.
- Store new or repeated mistake patterns.

## Build Memory

### 2026-05-01 - Day 1 Poker Engine Complete

- Added the DN persona foundation in `CLAUDE.md`, including voice, strategy, teaching style, mistake memory, era awareness, and the approved warm deflection for AI/authenticity questions.
- Added first curated wiki context files: `wiki/small-ball-poker.md` and `wiki/mental-game.md`.
- Built the FastAPI poker engine in `services/poker-engine/` with in-memory sessions keyed by `userId`.
- Implemented deck management, blind posting, heads-up state progression, betting validation, all-in handling, fold settlement, and `treys` showdown evaluation.
- Added a rule-based DN bot with bounded randomized preflop, postflop, and river behavior.
- Exposed `POST /game/new`, `POST /game/action`, `GET /game/state`, and `POST /game/showdown`.
- Verified with `pytest`: 16 passing tests across deck logic, engine behavior, API endpoints, and showdown outcomes.
- Verified manually over localhost HTTP by playing a complete hand through new/action/showdown and confirming pot award plus revealed showdown hands.

## Day 3 - Persistence and Auth

Goal: users have separate persistent mistake profiles and working rate limits.

- Add Clerk to frontend and backend.
- Set up Upstash Redis.
- Store game state, mistakes, hand counters, API keys, and evals.
- Encrypt user API keys.
- Enforce the 5-hand free limit.

## Day 4 - Frontend

Goal: play a complete browser session.

- Build landing, onboarding, table, and settings pages.
- Render cards, board, pot, action history, controls, hand counter, and rate-limit modal.
- Stream DN coaching with a typewriter effect.
- Add settings for API key and "DN's notes on you."

## Day 5 - Integration and Polish

Goal: complete end-to-end V1.

- Highlight repeated mistakes in coaching.
- Add glossary tooltips.
- Add DN fidelity eval modal.
- Handle API failures and game-state corruption.
- Add loading states and responsive layout.
- Deploy services.
- Test with real users.

## Explicitly Out of Scope for V1

- Voice cloning.
- Multiplayer.
- Mobile app.
- graph.json retrieval layer.
- Hand history replay.
- Leaderboards.
- Multiple poker variants.
- GTO solver integration.
- Real money or chip economy.
- Social features.

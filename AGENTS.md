# Daniel Negreanu Second Brain — Complete V1 Build Roadmap

## Product Vision

A heads-up No-Limit Hold'em poker product where Daniel Negreanu acts simultaneously as your opponent and your post-hand coach. After every hand, DN breaks down what happened — his own thinking, your mistakes, and what you should have done differently. The product remembers every mistake a user makes across all sessions permanently, so when they repeat a mistake, DN calls it out by name in his voice.

This is not a coaching app. The framing is: Daniel Negreanu is sitting next to you at the table, watching every hand, and can't help but comment. That's who he is.

---

## Target User

Mixed skill level. Serious players who know what a 3-bet and ICM mean, and casual players who just know hand rankings. The product handles both via an inline glossary — poker terms are explained briefly in DN's voice on hover/tap for newcomers, ignorable by experienced players.

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js (App Router) | UI, routing, streaming responses |
| Backend API | Node.js + Express | Game endpoints, coaching endpoints, auth middleware |
| Poker Engine | Python microservice (FastAPI) | Game state machine + treys for hand evaluation |
| LLM | Claude API (`claude-sonnet-4-20250514`) | DN persona, post-hand coaching, mistake extraction |
| Auth | Clerk | User authentication, userId for all persistence |
| Persistence | Upstash Redis | Game state, mistake profiles, rate limiting, API keys |
| Hosting | Railway or Render | Deploy all services |

---

## Architecture Overview

```
User Browser (Next.js)
        ↓
Node.js/Express API
    ↓           ↓
Python        Claude API
Microservice  (DN persona)
(treys)           ↓
                Upstash Redis
                (mistake profiles)
```

The Python microservice handles all poker logic. Node.js orchestrates — it receives frontend actions, calls the poker microservice for game state updates, and calls Claude API for DN coaching. Upstash Redis persists everything that needs to survive across sessions.

---

## Upstash Redis Schema

Every key is namespaced by Clerk `userId` to prevent cross-user data leakage.

```
session:{userId}:current        → JSON of current game state (hand in progress)
mistakes:{userId}               → JSON array of mistake objects (permanent, never deleted)
ratelimit:{userId}:hands        → integer count of hands played on free tier
apikey:{userId}                 → user's own Anthropic API key (encrypted)
eval:{userId}:{sessionId}       → DN fidelity rating (1-5) + optional text feedback
```

**Mistake object schema:**
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

---

## Rate Limiting Logic

- 5 hands free, no API key required
- After hand 5: prompt user to add their own Anthropic API key to continue
- With API key: unlimited hands, key stored encrypted in Upstash
- API key bypass: all Claude calls use the user's key instead of the app key
- No daily cap on API key users — their spend, their choice

---

## Poker Engine (Python Microservice)

**What `treys` handles:** showdown hand evaluation only. Who wins, hand rankings, ties/splits. Never call treys mid-hand — only at showdown.

**What the custom engine handles:** everything else.

### Game State Machine

States: `WAITING → PREFLOP → FLOP → TURN → RIVER → SHOWDOWN → COMPLETE`

Game state object (stored in Redis and returned to frontend):
```json
{
  "handId": "uuid",
  "userId": "clerk_user_id",
  "state": "FLOP",
  "street": 2,
  "deck": [...remaining cards],
  "userHand": ["Ah", "Kd"],
  "dnHand": ["hidden", "hidden"],
  "board": ["7c", "2h", "Jd"],
  "pot": 150,
  "sidePots": [],
  "userStack": 925,
  "dnStack": 875,
  "userBet": 0,
  "dnBet": 0,
  "smallBlind": 25,
  "bigBlind": 50,
  "actionOn": "user",
  "lastAction": "dn_call",
  "handHistory": [...all actions this hand],
  "isAllIn": false
}
```

### Betting Validation Rules
- Minimum raise = 2x the previous bet or the previous raise size (whichever is larger)
- Maximum raise = user's remaining stack (all-in)
- Call amount = current bet - player's existing bet this street
- Cannot raise after all-in unless another player has acted

### DN Bot Decision Logic

DN plays stylistically authentic, not GTO-perfect. His decision logic per street:

**Preflop:** Plays ~30% of hands from SB (wide range). Raises 2.5x-3x with strong hands, limps occasionally with speculative hands (DN does this), folds trash.

**Postflop:** Small ball tendencies — prefers smaller bets (25-40% pot) with strong hands to keep pots manageable. Bets larger (60-75% pot) when bluffing or value-betting the nuts. Check-raises on coordinated boards with strong hands.

**River:** Overbets occasionally with the nuts or as bluffs (authentic DN behavior). Will check back medium-strength hands.

**Implementation note:** This does not need to be a solver. It needs a rule-based decision tree that captures DN's style. Randomize within ranges to prevent patterns.

### REST Endpoints

```
POST /game/new          → create new hand, deal cards, post blinds, return game state
POST /game/action       → { action: "fold"|"call"|"raise", amount?: number }
                          validate action, update state, trigger DN response if needed
                          return updated game state
GET  /game/state        → return current game state for userId
POST /game/showdown     → reveal hands, use treys to determine winner, return result
```

---

## Claude API Integration (DN Persona Layer)

### CLAUDE.md Structure

The CLAUDE.md file is the persona definition injected as the system prompt on every Claude API call. It must cover:

1. **Voice and tone** — how DN speaks. Warm but direct. Competitive. Uses "buddy", "pal", "come on". Mixes high-level strategy with human stories. Cracks jokes mid-analysis but always returns to the lesson.

2. **Poker philosophy** — small ball poker, live reads over pure GTO, exploitative adjustments, mixed game mastery, tournament ICM awareness, mental game emphasis.

3. **Teaching style** — never condescending. Acknowledges when a play was reasonable before explaining why it was wrong. Uses specific hand examples from his career. "This reminds me of a hand I played against Ivey in 2005..."

4. **Era awareness** — DN's thinking evolved. Early career: pure exploitative, small ball. Post-2015: integrating GTO concepts. Modern: hybrid. The coaching should reflect his current (modern era) thinking while respecting his foundational philosophy.

5. **Engagement metrics directive** — tweet/content engagement is a weak signal of quality. Judge content value by strategic depth, not likes or views.

### Wiki Articles (15-20 files)

These are hand-curated markdown files injected as context. Do not rely on graph.json for v1. Write these manually — they will be higher quality and more controllable than anything Graphify produced.

Suggested articles to write:
1. Small Ball Poker Philosophy
2. Live Reads and Physical Tells
3. 3-Bet Strategy (when DN 3-bets, sizing, ranges)
4. River Play and Bet Sizing
5. Mental Game and Handling Bad Beats
6. ICM and Tournament Survival
7. Exploitative vs GTO — DN's View
8. Bluffing Philosophy and Semi-Bluffs
9. Reading Opponent Ranges
10. Heads-Up Dynamics and Adjustments
11. Game Selection and Table Dynamics
12. Bet Sizing Principles
13. Continuation Betting
14. Check-Raise Strategy
15. How DN Thinks About Variance

### Post-Hand Coaching Endpoint

`POST /coaching/analyze`

**Input:**
```json
{
  "userId": "clerk_user_id",
  "handHistory": [...complete action sequence],
  "userHand": ["Ah", "Kd"],
  "dnHand": ["Jc", "Ts"],
  "board": ["7c", "2h", "Jd", "4s", "9c"],
  "winner": "dn",
  "pot": 450,
  "userMistakeProfile": [...existing mistake objects from Redis]
}
```

**System prompt construction:**
```
[CLAUDE.md content]
[Relevant wiki articles — select 2-3 based on hand characteristics]
[User mistake profile: "This player has previously shown these patterns: ..."]
```

**User prompt:**
```
Here is the complete hand history: [hand history]
The user held [cards], you held [cards], board ran out [board].
[Winner] won the pot of [amount].

Analyze this hand in your voice. Cover:
1. Your own decision-making this hand (1-2 sentences)
2. The key decision point for the user and what they should have done
3. If this matches any pattern from their mistake history, call it out directly
4. One concrete takeaway they can apply immediately

Keep it under 200 words. Sound like yourself — direct, warm, a little funny, always teaching.
```

**Output:** streamed text response from Claude, displayed typewriter-style in the UI.

### Mistake Extraction (Secondary Call)

After the coaching response is generated, make a second lightweight Claude call:

**Prompt:**
```
Based on this hand analysis, extract the primary mistake pattern if one exists.
Return ONLY valid JSON, no other text:
{"pattern": "brief description", "severity": "low|medium|high", "exists": true|false}
If no clear mistake was made, return {"exists": false}
```

Store the result in the user's mistake profile in Upstash.

---

## Frontend (Next.js)

### Pages and Components

**Landing page (`/`)**
- Hero: strong visual of a poker table, "Play heads-up with Kid Poker"
- One paragraph about what the product does
- Single CTA: "Start Playing" → Clerk sign-up
- No feature list, no pricing, no noise

**Onboarding (`/onboarding`)**
- 3 slides, skippable
- Slide 1: Who DN is (2 sentences, not a biography)
- Slide 2: How it works (play a hand, DN coaches you after)
- Slide 3: The memory feature ("DN remembers your mistakes")
- "Let's Play" → `/table`

**Table (`/table`)**

The main UI. Components:

```
<PokerTable>
  <Board />                    — community cards
  <DNHand />                   — face down until showdown
  <UserHand />                 — always visible
  <PotDisplay />               — current pot
  <BettingControls />          — Fold / Call / Raise slider
  <ActionHistory />            — log of actions this street
  <DNCoachingPanel />          — slides up after hand completes
    <StreamingResponse />      — typewriter effect
    <MistakeCallout />         — highlighted if referencing past mistake
    <GlossaryTooltips />       — poker terms explained inline
  <HandCounter />              — "Hand 3 of 5 free hands"
  <RateLimitModal />           — appears after hand 5, prompts API key
</PokerTable>
```

**Settings (`/settings`)**
- Add/remove Anthropic API key
- "DN's notes on you" — displays mistake profile in a readable format
- Session history (last 10 hands, win/loss)

### Streaming Implementation

DN's coaching response streams from the Claude API. The Node.js backend uses `response.body` as a readable stream, pipes it to the frontend via Server-Sent Events. The frontend renders characters as they arrive — typewriter effect, feels like DN is speaking in real time.

### Inline Glossary

Poker terms in DN's coaching responses are wrapped in `<Glossary term="3-bet">` components. On hover (desktop) or tap (mobile), a small tooltip appears with a brief DN-voiced explanation. These definitions are hardcoded — not LLM-generated — for speed and consistency.

Example definitions:
- **3-bet**: "Re-raising before the flop, buddy. Someone raises, you re-raise. It says 'I'm not messing around.'"
- **Pot odds**: "The math of whether a call makes sense. If the pot is $100 and it costs you $20 to call, you're getting 5-to-1. Know the number."
- **Value bet**: "Betting because you think you have the best hand and want to get paid. Not a bluff. Real hand, real money."

---

## Eval Framework

After each session (user closes table or hits rate limit), show a modal:

"How much did that sound like the real Daniel Negreanu?"
★ ★ ★ ★ ★ (1-5 stars)
[Optional text: "What felt off?" — text input, skippable]

Store in Upstash: `eval:{userId}:{timestamp}`

**Portfolio metric:** Pull aggregate scores. "Average DN fidelity rating: 4.2/5 across 847 sessions." This is the quantifiable eval story for FAANG/SIG interviews.

---

## 5-Day Build Order

### Day 1 — Poker Engine (Python Microservice)

Goal: complete playable hand via Postman with correct game logic.

1. Set up FastAPI project, install `treys`
2. Build deck management (shuffle, deal, burn cards)
3. Build game state machine with all 5 states
4. Build betting validation (call, raise min/max, all-in)
5. Build DN decision logic (rule-based per street)
6. Integrate `treys` at showdown only
7. Expose REST endpoints: `/game/new`, `/game/action`, `/game/state`, `/game/showdown`
8. Test complete hand end-to-end via Postman

**Done when:** you can fold, call, raise, get to showdown, and the correct player wins — all through API calls.

### Day 2 — DN Persona + Claude API

Goal: feed a hand history, receive something that genuinely sounds like DN coaching.

1. Write `CLAUDE.md` — persona definition (do this carefully, it's the soul of the product)
2. Write 15 wiki markdown files (see list above)
3. Build `/coaching/analyze` endpoint in Node.js
4. Implement system prompt construction (CLAUDE.md + relevant wiki articles + mistake profile)
5. Implement mistake extraction secondary call
6. Test with 5 different hand histories, evaluate voice quality
7. Refine CLAUDE.md based on outputs until it genuinely sounds like DN

**Done when:** you show 3 poker players (your raters) the outputs and they say "yeah that sounds like him."

### Day 3 — Persistence + Auth

Goal: two different users have separate permanent mistake profiles. Rate limiting works.

1. Set up Clerk — add to Next.js and Node.js
2. Set up Upstash Redis
3. Implement all Redis key operations (read/write game state, mistake profile, hand counter)
4. Implement rate limiting middleware in Node.js
5. Implement API key storage (encrypt before storing, decrypt before using)
6. Wire mistake profile into coaching call (read before, write after)
7. Test: play 5 hands, hit rate limit, add API key, continue playing

**Done when:** user data persists across browser restarts. Rate limit triggers correctly. Mistake profile grows with each hand.

### Day 4 — Frontend

Goal: complete playable session in the browser.

1. Set up Next.js project, install Clerk provider
2. Build landing page
3. Build 3-slide onboarding
4. Build table UI — cards, pot, betting controls
5. Wire to Node.js API — game actions, state updates
6. Build DN coaching panel with streaming typewriter effect
7. Build hand counter and rate limit modal
8. Build settings page (API key input, mistake profile display)

**Done when:** you can play a complete hand from landing page through DN's coaching response in the browser.

### Day 5 — Integration + Eval + Polish

Goal: everything works end-to-end, eval framework live, ready to show.

1. Wire mistake callbacks — highlight when DN references past mistake in coaching panel
2. Add inline glossary tooltips
3. Build eval modal (post-session fidelity rating)
4. Error states — API down, game state corruption, network failures
5. Loading states — DN "thinking" indicator during coaching generation
6. Basic mobile-responsive layout (not mobile-first, not broken)
7. Deploy: Python microservice on Railway, Node.js on Railway, Next.js on Vercel
8. End-to-end test with 3 real users

---

## What Not to Build in V1

These are explicitly out of scope. Do not get distracted.

- Voice (ElevenLabs) — v2
- Multiplayer — v2
- Mobile app — v2
- graph.json retrieval layer — v2
- Hand history replay/visualization
- Leaderboards
- Multiple game formats (Omaha, mixed games)
- GTO solver integration
- Real money or chip economy
- Social features

---

## V2 Roadmap (Reference Only)

- ElevenLabs DN voice cloning — coaching responses spoken aloud
- Mobile app (React Native)
- Multiplayer — bot opponents first, then human vs human with DN coaching both
- graph.json retrieval layer replacing static wiki articles
- GTO equity overlays showing user's EV on each decision

---

## Portfolio Story (For Interviews)

"I built a heads-up poker product where Daniel Negreanu acts as both opponent and coach. The system combines a custom Python poker engine using treys for hand evaluation, a Claude API persona layer built on 1,851 documents of Negreanu's content processed through a custom knowledge ingestion pipeline, and a persistent mistake memory system in Upstash Redis that tracks each user's recurring errors permanently — so Negreanu calls them out by name when they repeat mistakes. I built an eval framework measuring persona fidelity scored by real poker players, averaging 4.x/5 across N sessions. The rate limiting architecture uses a token bucket pattern in Upstash with an API key bypass for power users."

Hits: LLM engineering, distributed systems, data pipelines, product thinking, quantitative evaluation.

For SIG specifically: emphasize the GTO vs exploitative framework, the EV-based decision architecture, and the poker game theory layer. SIG interviews involve poker strategy — this project demonstrates you understand the domain at a technical level.

---

## Key Files to Create First (Before Any Code)

1. `CLAUDE.md` — DN persona definition
2. `wiki/small-ball-poker.md` — first and most important wiki article
3. `wiki/mental-game.md` — DN's mental game philosophy
4. `CLAUDE_DN_SECONDBRAIN.md` — this roadmap document, kept in the repo root for LLM context

The CLAUDE.md and first 3 wiki articles should exist before a single line of application code is written. They are the foundation everything else is built on.

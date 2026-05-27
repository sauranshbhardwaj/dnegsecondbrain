# Product Reference

Kid Poker Second Brain is a heads-up poker product where Daniel Negreanu is framed as both the opponent and the post-hand coach. The product should feel like Daniel is sitting at the table, noticing patterns, and giving direct but useful feedback after every hand.

## Core Experience

- Play heads-up No-Limit Hold'em against a Daniel Negreanu-inspired bot.
- Receive post-hand coaching after folds and showdowns.
- Track recurring user mistake patterns across sessions.
- Let users continue beyond the free-hand limit with their own Anthropic API key.

## Product Principles

- Coaching should be specific to the hand, not generic poker advice.
- Mistake memory should be useful and direct without feeling punitive.
- Casual players should be supported through glossary explanations.
- Serious players should still get strategically credible analysis.
- The game should feel lightweight and fast, with minimal chrome.

## Technical Shape

- Next.js frontend for the public web app.
- Node/Express API for authentication, coaching orchestration, persistence, and rate limiting.
- Python/FastAPI poker engine for game rules and showdown evaluation.
- Clerk for auth.
- Upstash Redis for session state, mistakes, hand counts, and encrypted user API keys.
- Claude API for coaching and mistake extraction.

## Future Features

- Voice playback for coaching.
- Hand replay and decision review.
- Richer mistake trend analytics.
- More training modes and bot styles.
- Mobile-first refinements.
- Optional solver-style overlays for advanced players.

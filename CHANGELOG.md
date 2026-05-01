# Changelog

## 2026-05-01 - Day 1 Poker Engine

### Added

- Created the Daniel Negreanu persona foundation for future Claude coaching, including voice, strategy, mistake memory, teaching style, and authenticity-question handling.
- Added the first two curated poker knowledge articles: small-ball poker and mental game.
- Built the Day 1 FastAPI poker engine with in-memory heads-up No-Limit Hold'em sessions.
- Added deck management, blind posting, betting validation, street advancement, folds, all-ins, and showdown settlement.
- Added a rule-based DN bot that mixes small-ball value, pot control, pressure bluffs, and river aggression.
- Added `treys` showdown evaluation for winners, hand ranks, and split pots.
- Exposed the initial poker API: `/game/new`, `/game/action`, `/game/state`, and `/game/showdown`.

### Verified

- Added automated coverage for deck behavior, betting rules, state progression, all-ins, folds, showdown scoring, split pots, and API errors.
- Ran the full poker engine test suite: `16 passed`.
- Played a complete hand over localhost HTTP through the FastAPI service and confirmed the hand completed with showdown scoring and pot award.

### Notes

- Day 1 storage is intentionally process-local memory only. Redis, Clerk, Claude API integration, rate limiting, and frontend work remain for later days.

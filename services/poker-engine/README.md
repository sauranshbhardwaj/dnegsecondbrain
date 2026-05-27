# Poker Engine Microservice

FastAPI microservice for the Kid Poker Second Brain game engine.

The service owns heads-up No-Limit Hold'em game logic only:

- Sessions keyed by `userId`.
- Fixed defaults: 1000 starting stack, 25 small blind, 50 big blind.
- Rule-based DN bot decisions.
- `treys` hand evaluation only at showdown.

Run locally:

```bash
pip install -e .
uvicorn app.main:app --reload
```

Run tests:

```bash
pytest
```

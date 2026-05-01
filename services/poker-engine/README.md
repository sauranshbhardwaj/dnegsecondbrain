# Poker Engine Microservice

Day 1 FastAPI microservice for the Daniel Negreanu Second Brain poker product.

The service owns heads-up No-Limit Hold'em game logic only:

- In-memory sessions keyed by `userId`.
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

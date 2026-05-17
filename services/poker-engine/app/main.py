# SECURITY NOTE: This service has no authentication.
# It must be deployed as a private internal service on Railway,
# not exposed to the public internet.
# Post-deployment fix: restrict network access at the
# infrastructure level so only the Node API and Next.js
# server can reach this service.
# Tracked: fix after initial deployment to Railway.

from fastapi import FastAPI, HTTPException, Query

from app.models import ActionRequest, GameState, NewGameRequest, ShowdownRequest, ShowdownResult
from app.store import game_service

app = FastAPI(title="DN Second Brain Poker Engine")


@app.post("/game/new", response_model=GameState)
def new_game(request: NewGameRequest) -> GameState:
    try:
        return game_service.new_game(request.userId)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/game/action", response_model=GameState)
def game_action(request: ActionRequest) -> GameState:
    try:
        return game_service.apply_user_action(request.userId, request.action, request.amount)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/game/state", response_model=GameState)
def game_state(userId: str = Query(...)) -> GameState:
    try:
        return game_service.get_state(userId)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/game/showdown", response_model=ShowdownResult)
def game_showdown(request: ShowdownRequest) -> ShowdownResult:
    try:
        return game_service.showdown(request.userId)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

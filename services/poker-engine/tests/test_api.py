import asyncio

import httpx

from app.constants import BIG_BLIND, SMALL_BLIND
from app.main import app
from app.models import GamePhase, GameState
from app.store import game_service


def setup_function() -> None:
    game_service.sessions.clear()
    game_service.rng.seed(11)


def test_new_and_get_state_endpoints() -> None:
    response = request("POST", "/game/new", json={"userId": "api_user"})

    assert response.status_code == 200
    state = response.json()
    assert state["userId"] == "api_user"
    assert state["smallBlind"] == SMALL_BLIND
    assert state["bigBlind"] == BIG_BLIND
    if state["state"] == "COMPLETE":
        assert state["terminal"] is not None
        assert state["dnHand"] == state["terminal"]["dnHand"]
    else:
        assert state["dnHand"] == ["hidden", "hidden"]

    get_response = request("GET", "/game/state", params={"userId": "api_user"})

    assert get_response.status_code == 200
    assert get_response.json()["handId"] == state["handId"]


def test_action_endpoint_rejects_missing_game() -> None:
    response = request("POST", "/game/action", json={"userId": "missing", "action": "call"})

    assert response.status_code == 400
    assert response.json()["detail"] == "No active game for user"


def test_action_endpoint_accepts_user_turn_action() -> None:
    user_id, state = _new_active_user_turn()
    action = "call"

    response = request("POST", "/game/action", json={"userId": user_id, "action": action})

    assert response.status_code == 200
    updated = response.json()
    assert updated["userId"] == user_id
    assert updated["state"] in {"PREFLOP", "FLOP", "TURN", "RIVER", "SHOWDOWN", "COMPLETE"}
    assert updated["handHistory"]
    assert updated["dnHand"] == ["hidden", "hidden"] or updated["showdown"] is not None or updated["terminal"] is not None
    assert state["handId"] == updated["handId"]


def test_showdown_endpoint_reveals_and_scores_hand() -> None:
    game_service.sessions["api_showdown"] = GameState(
        handId="api_showdown_hand",
        userId="api_showdown",
        state=GamePhase.SHOWDOWN,
        street=5,
        deck=[],
        userHand=["Ah", "Ad"],
        dnHand=["Kc", "Kd"],
        board=["2c", "3d", "4h", "8s", "9c"],
        pot=400,
        userStack=800,
        dnStack=800,
        smallBlind=SMALL_BLIND,
        bigBlind=BIG_BLIND,
        actionOn=None,
        currentBet=0,
        lastRaiseSize=BIG_BLIND,
    )

    response = request("POST", "/game/showdown", json={"userId": "api_showdown"})

    assert response.status_code == 200
    result = response.json()
    assert result["winner"] == "user"
    assert result["potAwarded"] == {"user": 400, "dn": 0}
    assert result["gameState"]["dnHand"] == ["Kc", "Kd"]
    assert result["gameState"]["terminal"]["reason"] == "showdown"
    assert result["gameState"]["terminal"]["potAwarded"] == {"user": 400, "dn": 0}


def test_state_endpoint_rejects_missing_game() -> None:
    response = request("GET", "/game/state", params={"userId": "nobody"})

    assert response.status_code == 404


def _new_active_user_turn() -> tuple[str, dict]:
    for index in range(30):
        user_id = f"api_user_{index}"
        response = request("POST", "/game/new", json={"userId": user_id})
        assert response.status_code == 200
        state = response.json()
        if state["actionOn"] == "user" and state["state"] != "COMPLETE":
            return user_id, state
    raise AssertionError("DN bot did not yield an active user turn")


def request(method: str, url: str, **kwargs) -> httpx.Response:
    async def _send() -> httpx.Response:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.request(method, url, **kwargs)
            await response.aread()
            return response

    return asyncio.run(_send())

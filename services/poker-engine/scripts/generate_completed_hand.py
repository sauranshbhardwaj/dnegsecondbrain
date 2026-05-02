import json
import random

from app.engine import GameService
from app.models import GamePhase, PlayerAction


def generate_completed_hand() -> dict:
    for seed in range(1, 200):
        user_id = f"integration_user_{seed}"
        service = GameService(random.Random(seed), auto_play_dn=True)
        state = service.new_game(user_id)

        for _ in range(30):
            if state.state == GamePhase.SHOWDOWN:
                result = service.showdown(user_id)
                return build_payload(service, user_id, result)
            if state.state == GamePhase.COMPLETE:
                break
            if state.actionOn == "user":
                state = service.apply_user_action(user_id, PlayerAction.CALL)
            else:
                state = service.get_state(user_id)

    raise RuntimeError("Could not generate a showdown hand for integration")


def build_payload(service: GameService, user_id: str, result) -> dict:
    state = service.sessions[user_id]
    pot = sum(result.potAwarded.values())

    return {
        "userId": user_id,
        "handHistory": [entry.model_dump(mode="json") for entry in state.handHistory],
        "userHand": state.userHand,
        "dnHand": state.dnHand,
        "board": state.board,
        "winner": state.winner,
        "pot": pot,
        "userRank": result.userRank,
        "dnRank": result.dnRank,
        "userMistakeProfile": [
            {
                "pattern": "calls down too wide with medium-strength hands",
                "firstSeen": "2026-05-01T18:00:00Z",
                "lastSeen": "2026-05-01T22:00:00Z",
                "frequency": 2,
                "severity": "medium",
                "handsContext": ["integration_prior_1"],
            }
        ],
    }


if __name__ == "__main__":
    print(json.dumps(generate_completed_hand()))

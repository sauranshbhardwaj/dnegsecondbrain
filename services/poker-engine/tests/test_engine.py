import random

import pytest

from app.constants import BIG_BLIND, DN, SMALL_BLIND, STARTING_STACK, USER
from app.engine import GameService
from app.models import GamePhase, GameState, PlayerAction


def test_new_game_posts_blinds_and_hides_dn_hand() -> None:
    service = GameService(random.Random(1), auto_play_dn=False)

    public = service.new_game("user_1")
    internal = service.sessions["user_1"]

    assert public.state == GamePhase.PREFLOP
    assert public.street == 1
    assert public.pot == SMALL_BLIND + BIG_BLIND
    assert public.userStack == STARTING_STACK - BIG_BLIND
    assert public.dnStack == STARTING_STACK - SMALL_BLIND
    assert public.userBet == BIG_BLIND
    assert public.dnBet == SMALL_BLIND
    assert public.actionOn == DN
    assert public.dnHand == ["hidden", "hidden"]
    assert "deck" not in public.model_dump()
    assert internal.dnHand != ["hidden", "hidden"]
    assert len(internal.deck) == 48


def test_min_raise_validation_and_valid_raise() -> None:
    service = GameService(random.Random(2), auto_play_dn=False)
    service.new_game("user_1")
    state = service.sessions["user_1"]
    state.actionOn = USER
    state.actedThisStreet = [DN]

    with pytest.raises(ValueError, match="Minimum raise"):
        service.apply_user_action("user_1", PlayerAction.RAISE, 75)

    public = service.apply_user_action("user_1", PlayerAction.RAISE, 100)

    assert public.userBet == 100
    assert public.userStack == 900
    assert public.pot == 125
    assert public.actionOn == DN


def test_calling_blind_advances_to_flop() -> None:
    service = GameService(random.Random(3), auto_play_dn=False)
    service.new_game("user_1")
    state = service.sessions["user_1"]

    service._apply_action(state, DN, PlayerAction.CALL)
    service._apply_action(state, USER, PlayerAction.CALL)

    assert state.state == GamePhase.FLOP
    assert state.street == 2
    assert len(state.board) == 3
    assert state.pot == 100
    assert state.userBet == 0
    assert state.dnBet == 0
    assert state.actionOn == USER


def test_fold_awards_pot_with_terminal_context() -> None:
    service = GameService(random.Random(4), auto_play_dn=False)
    service.new_game("user_1")
    state = service.sessions["user_1"]
    internal_dn_hand = list(state.dnHand)

    service._apply_action(state, DN, PlayerAction.RAISE, 100)
    public = service.apply_user_action("user_1", PlayerAction.FOLD)

    assert public.state == GamePhase.COMPLETE
    assert public.winner == DN
    assert public.pot == 0
    assert public.userStack == 950
    assert public.dnStack == 1050
    assert public.dnHand == internal_dn_hand
    assert public.terminal is not None
    assert public.terminal.reason == "fold"
    assert public.terminal.winner == DN
    assert public.terminal.potAwarded == {"user": 0, "dn": 150}
    assert public.terminal.userHand == public.userHand
    assert public.terminal.dnHand == internal_dn_hand
    assert len(public.terminal.board) == 5
    assert public.userStack + public.dnStack + public.pot == STARTING_STACK * 2


def test_user_can_fold_when_check_is_available() -> None:
    service = GameService(random.Random(12), auto_play_dn=False)
    service.new_game("user_1")
    state = service.sessions["user_1"]
    internal_dn_hand = list(state.dnHand)

    service._apply_action(state, DN, PlayerAction.CALL)
    service._apply_action(state, USER, PlayerAction.CALL)
    assert state.state == GamePhase.FLOP
    assert state.actionOn == USER
    assert state.userBet == 0
    assert state.dnBet == 0

    public = service.apply_user_action("user_1", PlayerAction.FOLD)

    assert public.state == GamePhase.COMPLETE
    assert public.winner == DN
    assert public.pot == 0
    assert public.userStack == 950
    assert public.dnStack == 1050
    assert public.dnHand == internal_dn_hand
    assert public.terminal is not None
    assert public.terminal.reason == "fold"
    assert public.terminal.potAwarded == {"user": 0, "dn": 100}
    assert public.terminal.board == public.board
    assert "deck" not in public.model_dump()


def test_all_in_call_moves_to_showdown() -> None:
    service = GameService(random.Random(5), auto_play_dn=False)
    service.new_game("user_1")
    state = service.sessions["user_1"]

    service._apply_action(state, DN, PlayerAction.RAISE, 1000)
    public = service.apply_user_action("user_1", PlayerAction.CALL)

    assert public.state == GamePhase.SHOWDOWN
    assert public.isAllIn is True
    assert public.actionOn is None
    assert public.pot == STARTING_STACK * 2
    assert public.userStack == 0
    assert public.dnStack == 0


def test_showdown_awards_winning_hand() -> None:
    service = GameService(random.Random(6), auto_play_dn=False)
    service.sessions["user_1"] = _showdown_state(
        user_hand=["Ah", "Ad"],
        dn_hand=["Kc", "Kd"],
        board=["2c", "3d", "4h", "8s", "9c"],
        pot=500,
    )

    result = service.showdown("user_1")

    assert result.winner == USER
    assert result.potAwarded == {"user": 500, "dn": 0}
    assert result.gameState.userStack == 1250
    assert result.gameState.dnStack == 750
    assert result.gameState.pot == 0
    assert result.gameState.dnHand == ["Kc", "Kd"]
    assert result.gameState.terminal is not None
    assert result.gameState.terminal.reason == "showdown"
    assert result.gameState.terminal.winner == USER
    assert result.gameState.terminal.potAwarded == {"user": 500, "dn": 0}
    assert result.gameState.terminal.userRank == result.userRank
    assert result.gameState.terminal.dnRank == result.dnRank


def test_showdown_splits_tied_board() -> None:
    service = GameService(random.Random(7), auto_play_dn=False)
    service.sessions["user_1"] = _showdown_state(
        user_hand=["Ah", "Kd"],
        dn_hand=["Qh", "Jd"],
        board=["2c", "3d", "4h", "5s", "6c"],
        pot=501,
    )

    result = service.showdown("user_1")

    assert result.winner == "split"
    assert result.isSplit is True
    assert result.potAwarded == {"user": 251, "dn": 250}
    assert result.gameState.userStack + result.gameState.dnStack == STARTING_STACK * 2 + 1


def _showdown_state(user_hand: list[str], dn_hand: list[str], board: list[str], pot: int) -> GameState:
    return GameState(
        handId="hand_test",
        userId="user_1",
        state=GamePhase.SHOWDOWN,
        street=5,
        deck=[],
        userHand=user_hand,
        dnHand=dn_hand,
        board=board,
        pot=pot,
        userStack=1000 - pot // 2,
        dnStack=1000 - pot // 2,
        smallBlind=SMALL_BLIND,
        bigBlind=BIG_BLIND,
        actionOn=None,
        currentBet=0,
        lastRaiseSize=BIG_BLIND,
    )

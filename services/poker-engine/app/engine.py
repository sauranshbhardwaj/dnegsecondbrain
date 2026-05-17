import random
from uuid import uuid4

from app.bot import DNBot
from app.constants import BIG_BLIND, DN, SMALL_BLIND, STARTING_STACK, USER
from app.deck import assert_unique_cards, burn, deal, shuffled_deck
from app.evaluator import evaluate_showdown
from app.models import GamePhase, GameState, HandHistoryEntry, PlayerAction, ShowdownResult, TerminalHand


ACTIVE_PHASES = {GamePhase.PREFLOP, GamePhase.FLOP, GamePhase.TURN, GamePhase.RIVER}


class GameService:
    def __init__(self, rng: random.Random | None = None, auto_play_dn: bool = True) -> None:
        self.rng = rng or random.Random()
        self.bot = DNBot(self.rng)
        self.auto_play_dn = auto_play_dn
        self.sessions: dict[str, GameState] = {}

    def new_game(self, user_id: str) -> GameState:
        deck = shuffled_deck(self.rng)
        user_hand = deal(deck, 2)
        dn_hand = deal(deck, 2)
        assert_unique_cards(user_hand + dn_hand + deck)

        state = GameState(
            handId=str(uuid4()),
            userId=user_id,
            state=GamePhase.PREFLOP,
            street=1,
            deck=deck,
            userHand=user_hand,
            dnHand=dn_hand,
            board=[],
            pot=SMALL_BLIND + BIG_BLIND,
            userStack=STARTING_STACK - BIG_BLIND,
            dnStack=STARTING_STACK - SMALL_BLIND,
            userBet=BIG_BLIND,
            dnBet=SMALL_BLIND,
            smallBlind=SMALL_BLIND,
            bigBlind=BIG_BLIND,
            actionOn=DN,
            lastAction="blinds_posted",
            currentBet=BIG_BLIND,
            lastRaiseSize=BIG_BLIND,
            handHistory=[
                HandHistoryEntry(
                    actor="system",
                    action="post_blinds",
                    amount=SMALL_BLIND + BIG_BLIND,
                    state=GamePhase.PREFLOP,
                    street=1,
                    pot=SMALL_BLIND + BIG_BLIND,
                    note="DN posts small blind, user posts big blind",
                )
            ],
        )
        self.sessions[user_id] = state
        if self.auto_play_dn:
            self._run_dn_until_user_or_terminal(state)
        return self.public_state(state)

    def get_state(self, user_id: str) -> GameState:
        return self.public_state(self._require_state(user_id))

    def apply_user_action(self, user_id: str, action: PlayerAction, amount: int | None = None) -> GameState:
        state = self._require_state(user_id)
        if state.actionOn != USER:
            raise ValueError("It is not the user's turn")
        self._apply_action(state, USER, action, amount)
        if self.auto_play_dn:
            self._run_dn_until_user_or_terminal(state)
        return self.public_state(state)

    def showdown(self, user_id: str) -> ShowdownResult:
        state = self._require_state(user_id)
        if state.state == GamePhase.COMPLETE and state.showdown:
            return self._showdown_result_from_state(state)
        if state.state != GamePhase.SHOWDOWN:
            raise ValueError("Hand is not ready for showdown")

        self._deal_remaining_board(state)
        result = evaluate_showdown(state.userHand, state.dnHand, state.board)
        pot = state.pot
        awards = {"user": 0, "dn": 0}

        if result["winner"] == "split":
            awards["user"] = pot // 2 + pot % 2
            awards["dn"] = pot // 2
            state.userStack += awards["user"]
            state.dnStack += awards["dn"]
        elif result["winner"] == USER:
            awards["user"] = pot
            state.userStack += pot
        else:
            awards["dn"] = pot
            state.dnStack += pot

        state.pot = 0
        state.userBet = 0
        state.dnBet = 0
        state.currentBet = 0
        state.actedThisStreet = []
        state.state = GamePhase.COMPLETE
        state.actionOn = None
        state.winner = result["winner"]  # type: ignore[assignment]
        state.lastAction = "showdown_complete"
        state.showdown = {
            **result,
            "potAwarded": awards,
            "board": list(state.board),
            "userHand": list(state.userHand),
            "dnHand": list(state.dnHand),
        }
        state.terminal = TerminalHand(
            reason="showdown",
            winner=result["winner"],  # type: ignore[arg-type]
            potAwarded=awards,
            userHand=list(state.userHand),
            dnHand=list(state.dnHand),
            board=list(state.board),
            userRank=result["userRank"],  # type: ignore[arg-type]
            dnRank=result["dnRank"],  # type: ignore[arg-type]
        )
        state.handHistory.append(
            HandHistoryEntry(
                actor="system",
                action="showdown",
                amount=pot,
                state=GamePhase.COMPLETE,
                street=5,
                pot=0,
                note=f"{result['winner']} wins at showdown",
            )
        )
        return self._showdown_result_from_state(state)

    def public_state(self, state: GameState) -> GameState:
        data = state.model_dump()
        if not (state.state == GamePhase.COMPLETE and state.terminal):
            data["dnHand"] = ["hidden", "hidden"]
        return GameState(**data)

    def _showdown_result_from_state(self, state: GameState) -> ShowdownResult:
        if not state.showdown:
            raise ValueError("No showdown result exists")
        public = self.public_state(state)
        return ShowdownResult(
            winner=state.showdown["winner"],
            userScore=state.showdown["userScore"],
            dnScore=state.showdown["dnScore"],
            userRank=state.showdown["userRank"],
            dnRank=state.showdown["dnRank"],
            potAwarded=state.showdown["potAwarded"],
            isSplit=state.showdown["winner"] == "split",
            gameState=public,
        )

    def _require_state(self, user_id: str) -> GameState:
        try:
            return self.sessions[user_id]
        except KeyError as exc:
            raise ValueError("No active game for user") from exc

    def _run_dn_until_user_or_terminal(self, state: GameState) -> None:
        steps = 0
        while state.actionOn == DN and state.state in ACTIVE_PHASES:
            steps += 1
            if steps > 8:
                raise RuntimeError("DN bot exceeded action loop limit")
            decision = self.bot.decide(state)
            self._apply_action(state, DN, decision.action, decision.amount, decision.note)

    def _apply_action(
        self,
        state: GameState,
        actor: str,
        action: PlayerAction,
        amount: int | None = None,
        note: str | None = None,
    ) -> None:
        if state.state not in ACTIVE_PHASES:
            raise ValueError("Hand is not accepting actions")
        if state.actionOn != actor:
            raise ValueError(f"It is not {actor}'s turn")

        if action == PlayerAction.FOLD:
            self._fold(state, actor, note)
            return
        if action == PlayerAction.CALL:
            self._call_or_check(state, actor, note)
            return
        if action == PlayerAction.RAISE:
            self._raise(state, actor, amount, note)
            return
        raise ValueError("Unsupported action")

    def _fold(self, state: GameState, actor: str, note: str | None) -> None:
        if self._to_call(state, actor) <= 0:
            raise ValueError("Cannot fold when facing no bet")
        winner = self._opponent(actor)
        pot = state.pot
        awards = {"user": 0, "dn": 0}
        if winner == USER:
            awards["user"] = pot
            state.userStack += pot
        else:
            awards["dn"] = pot
            state.dnStack += pot
        self._deal_remaining_board(state)
        state.pot = 0
        state.userBet = 0
        state.dnBet = 0
        state.currentBet = 0
        state.actedThisStreet = []
        state.state = GamePhase.COMPLETE
        state.actionOn = None
        state.winner = winner  # type: ignore[assignment]
        state.lastAction = f"{actor}_fold"
        state.terminal = TerminalHand(
            reason="fold",
            winner=winner,  # type: ignore[arg-type]
            potAwarded=awards,
            userHand=list(state.userHand),
            dnHand=list(state.dnHand),
            board=list(state.board),
        )
        self._record(state, actor, "fold", 0, note or f"{winner} wins by fold")

    def _call_or_check(self, state: GameState, actor: str, note: str | None) -> None:
        call_amount = self._to_call(state, actor)
        stack = self._stack(state, actor)
        commit = min(call_amount, stack)

        self._commit(state, actor, commit)
        if actor not in state.actedThisStreet:
            state.actedThisStreet.append(actor)
        if self._stack(state, actor) == 0 or self._stack(state, self._opponent(actor)) == 0:
            state.isAllIn = True

        verb = "check" if call_amount == 0 else "call"
        state.lastAction = f"{actor}_{verb}"
        self._record(state, actor, verb, commit, note)
        self._complete_or_pass_action(state, actor)

    def _raise(self, state: GameState, actor: str, amount: int | None, note: str | None) -> None:
        if amount is None:
            raise ValueError("Raise amount is required")
        if amount <= 0:
            raise ValueError("Raise amount must be positive")
        if self._stack(state, self._opponent(actor)) == 0:
            raise ValueError("Cannot raise after opponent is all-in")

        player_bet = self._bet(state, actor)
        current = max(state.userBet, state.dnBet)
        max_total = player_bet + self._stack(state, actor)
        if amount <= current:
            raise ValueError("Raise amount must exceed the current bet")
        if amount > max_total:
            raise ValueError("Raise amount exceeds remaining stack")

        minimum = self._minimum_raise_total(state)
        if amount < minimum and amount != max_total:
            raise ValueError(f"Minimum raise total is {minimum}")

        commit = amount - player_bet
        previous_current = current
        self._commit(state, actor, commit)
        state.currentBet = max(state.userBet, state.dnBet)
        state.lastRaiseSize = max(amount - previous_current, state.bigBlind)
        state.actedThisStreet = [actor]
        if self._stack(state, actor) == 0:
            state.isAllIn = True
        state.actionOn = self._opponent(actor)
        state.lastAction = f"{actor}_raise"
        self._record(state, actor, "raise", amount, note)

    def _complete_or_pass_action(self, state: GameState, actor: str) -> None:
        bets_equal = state.userBet == state.dnBet
        both_acted = USER in state.actedThisStreet and DN in state.actedThisStreet
        any_all_in = state.userStack == 0 or state.dnStack == 0

        if bets_equal and any_all_in:
            state.state = GamePhase.SHOWDOWN
            state.street = 5
            state.actionOn = None
            state.lastAction = "all_in_called"
            return
        if bets_equal and both_acted:
            self._advance_street(state)
            return
        state.actionOn = self._opponent(actor)

    def _advance_street(self, state: GameState) -> None:
        state.userBet = 0
        state.dnBet = 0
        state.currentBet = 0
        state.lastRaiseSize = state.bigBlind
        state.actedThisStreet = []

        if state.state == GamePhase.PREFLOP:
            burn(state.deck)
            state.board.extend(deal(state.deck, 3))
            state.state = GamePhase.FLOP
            state.street = 2
            action = "deal_flop"
        elif state.state == GamePhase.FLOP:
            burn(state.deck)
            state.board.extend(deal(state.deck, 1))
            state.state = GamePhase.TURN
            state.street = 3
            action = "deal_turn"
        elif state.state == GamePhase.TURN:
            burn(state.deck)
            state.board.extend(deal(state.deck, 1))
            state.state = GamePhase.RIVER
            state.street = 4
            action = "deal_river"
        elif state.state == GamePhase.RIVER:
            state.state = GamePhase.SHOWDOWN
            state.street = 5
            state.actionOn = None
            state.lastAction = "ready_for_showdown"
            self._record(state, "system", "ready_for_showdown", 0, None)
            return
        else:
            raise ValueError("Cannot advance street from current state")

        assert_unique_cards(state.userHand + state.dnHand + state.board + state.deck)
        state.actionOn = USER
        state.lastAction = action
        self._record(state, "system", action, 0, None)

    def _deal_remaining_board(self, state: GameState) -> None:
        while len(state.board) < 5:
            burn(state.deck)
            draw = 3 if len(state.board) == 0 else 1
            state.board.extend(deal(state.deck, draw))
        assert_unique_cards(state.userHand + state.dnHand + state.board + state.deck)

    def _record(self, state: GameState, actor: str, action: str, amount: int, note: str | None) -> None:
        state.handHistory.append(
            HandHistoryEntry(
                actor=actor,  # type: ignore[arg-type]
                action=action,
                amount=amount,
                state=state.state,
                street=state.street,
                pot=state.pot,
                note=note,
            )
        )

    def _minimum_raise_total(self, state: GameState) -> int:
        current = max(state.userBet, state.dnBet)
        if current == 0:
            return state.bigBlind
        return max(current * 2, current + state.lastRaiseSize)

    def _commit(self, state: GameState, actor: str, amount: int) -> None:
        if amount < 0:
            raise ValueError("Cannot commit a negative amount")
        if amount > self._stack(state, actor):
            raise ValueError("Commit exceeds remaining stack")
        if actor == USER:
            state.userStack -= amount
            state.userBet += amount
        else:
            state.dnStack -= amount
            state.dnBet += amount
        state.pot += amount
        state.currentBet = max(state.userBet, state.dnBet)

    def _to_call(self, state: GameState, actor: str) -> int:
        return max(self._bet(state, self._opponent(actor)) - self._bet(state, actor), 0)

    def _bet(self, state: GameState, actor: str) -> int:
        return state.userBet if actor == USER else state.dnBet

    def _stack(self, state: GameState, actor: str) -> int:
        return state.userStack if actor == USER else state.dnStack

    def _opponent(self, actor: str) -> str:
        return DN if actor == USER else USER

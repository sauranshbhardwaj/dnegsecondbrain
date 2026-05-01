import random
from dataclasses import dataclass

from app.constants import BIG_BLIND, DN, RANK_VALUE
from app.models import GamePhase, GameState, PlayerAction


@dataclass(frozen=True)
class BotDecision:
    action: PlayerAction
    amount: int | None = None
    note: str | None = None


class DNBot:
    def __init__(self, rng: random.Random | None = None) -> None:
        self.rng = rng or random.Random()

    def decide(self, state: GameState) -> BotDecision:
        to_call = max(state.userBet - state.dnBet, 0)
        if state.state == GamePhase.PREFLOP:
            return self._preflop(state, to_call)
        return self._postflop(state, to_call)

    def _preflop(self, state: GameState, to_call: int) -> BotDecision:
        category = self._preflop_category(state.dnHand)

        if to_call > 0:
            if category == "premium" and self.rng.random() < 0.65:
                amount = self._raise_amount(state, 3 * state.bigBlind)
                if amount:
                    return BotDecision(PlayerAction.RAISE, amount, "DN 3-bets a premium preflop hand")
            if category in {"premium", "strong", "playable"}:
                return BotDecision(PlayerAction.CALL, None, "DN continues with a playable preflop hand")
            if to_call <= state.bigBlind and self.rng.random() < 0.35:
                return BotDecision(PlayerAction.CALL, None, "DN peels cheaply with position and price")
            return BotDecision(PlayerAction.FOLD, None, "DN releases a weak preflop hand")

        if category == "premium":
            amount = self._raise_amount(state, self.rng.randint(125, 150))
            if amount:
                return BotDecision(PlayerAction.RAISE, amount, "DN opens a premium hand")
        if category == "strong":
            amount = self._raise_amount(state, self.rng.randint(100, 150))
            if amount and self.rng.random() < 0.8:
                return BotDecision(PlayerAction.RAISE, amount, "DN applies preflop pressure")
            return BotDecision(PlayerAction.CALL, None, "DN limps a hand with postflop playability")
        if category == "playable":
            if self.rng.random() < 0.35:
                amount = self._raise_amount(state, self.rng.randint(100, 125))
                if amount:
                    return BotDecision(PlayerAction.RAISE, amount, "DN mixes in a small-ball open")
            return BotDecision(PlayerAction.CALL, None, "DN limps a speculative hand")
        if self.rng.random() < 0.18:
            return BotDecision(PlayerAction.CALL, None, "DN keeps a weak hand in cheaply")
        return BotDecision(PlayerAction.FOLD, None, "DN folds preflop trash")

    def _postflop(self, state: GameState, to_call: int) -> BotDecision:
        category = self._postflop_category(state.dnHand, state.board)
        pot = max(state.pot, state.bigBlind)

        if to_call > 0:
            if category == "strong":
                if self.rng.random() < 0.35 and state.dnStack > to_call:
                    amount = self._raise_amount(state, state.dnBet + to_call + max(int(pot * 0.6), BIG_BLIND))
                    if amount:
                        return BotDecision(PlayerAction.RAISE, amount, "DN check-raises pressure on a strong texture")
                return BotDecision(PlayerAction.CALL, None, "DN continues with strong value")
            if category == "medium":
                if to_call <= max(int(pot * 0.4), state.bigBlind) or self.rng.random() < 0.25:
                    return BotDecision(PlayerAction.CALL, None, "DN controls the pot with medium strength")
                return BotDecision(PlayerAction.FOLD, None, "DN lets go of a medium hand facing pressure")
            if self.rng.random() < 0.12 and state.dnStack > to_call:
                amount = self._raise_amount(state, state.dnBet + to_call + max(int(pot * 0.75), BIG_BLIND))
                if amount:
                    return BotDecision(PlayerAction.RAISE, amount, "DN finds an occasional pressure bluff")
            if to_call <= max(int(pot * 0.2), state.bigBlind // 2):
                return BotDecision(PlayerAction.CALL, None, "DN takes a small price")
            return BotDecision(PlayerAction.FOLD, None, "DN folds weak showdown value")

        if category == "strong":
            pct = self.rng.uniform(0.25, 0.4)
            if state.state == GamePhase.RIVER and self.rng.random() < 0.18:
                pct = self.rng.uniform(1.0, 1.25)
            amount = self._raise_amount(state, state.dnBet + max(int(pot * pct), BIG_BLIND))
            if amount:
                return BotDecision(PlayerAction.RAISE, amount, "DN value-bets with small-ball pressure")
        if category == "medium":
            if self.rng.random() < 0.35:
                amount = self._raise_amount(state, state.dnBet + max(int(pot * 0.3), BIG_BLIND))
                if amount:
                    return BotDecision(PlayerAction.RAISE, amount, "DN probes with medium strength")
            return BotDecision(PlayerAction.CALL, None, "DN checks back medium strength")
        if self.rng.random() < (0.16 if state.state != GamePhase.RIVER else 0.22):
            pct = self.rng.uniform(0.6, 0.75)
            if state.state == GamePhase.RIVER and self.rng.random() < 0.35:
                pct = self.rng.uniform(1.0, 1.2)
            amount = self._raise_amount(state, state.dnBet + max(int(pot * pct), BIG_BLIND))
            if amount:
                return BotDecision(PlayerAction.RAISE, amount, "DN fires a polarized bluff")
        return BotDecision(PlayerAction.CALL, None, "DN checks and keeps the pot controlled")

    def _preflop_category(self, hand: list[str]) -> str:
        ranks = sorted((RANK_VALUE[card[0]] for card in hand), reverse=True)
        suited = hand[0][1] == hand[1][1]
        pair = ranks[0] == ranks[1]
        gap = abs(ranks[0] - ranks[1])

        if pair and ranks[0] >= 10:
            return "premium"
        if ranks == [14, 13] or ranks == [14, 12]:
            return "premium"
        if pair or ranks[0] >= 14 and ranks[1] >= 10 or suited and ranks[0] >= 12 and gap <= 4:
            return "strong"
        if ranks[0] >= 11 and ranks[1] >= 8 or suited and gap <= 3 or gap <= 1 and ranks[0] >= 7:
            return "playable"
        return "trash"

    def _postflop_category(self, hand: list[str], board: list[str]) -> str:
        cards = hand + board
        rank_counts: dict[str, int] = {}
        suit_counts: dict[str, int] = {}
        for card in cards:
            rank_counts[card[0]] = rank_counts.get(card[0], 0) + 1
            suit_counts[card[1]] = suit_counts.get(card[1], 0) + 1

        made_counts = sorted(rank_counts.values(), reverse=True)
        board_high = max((RANK_VALUE[card[0]] for card in board), default=0)
        hand_values = [RANK_VALUE[card[0]] for card in hand]
        has_pair_with_hole = any(rank_counts[card[0]] >= 2 for card in hand)
        top_pair_or_better = has_pair_with_hole and max(hand_values) >= board_high
        flush_draw = len(board) < 5 and max(suit_counts.values(), default=0) >= 4
        straight_draw = self._has_straight_draw(cards)

        if made_counts[0] >= 3 or made_counts[:2] == [2, 2] or top_pair_or_better:
            return "strong"
        if has_pair_with_hole or flush_draw or straight_draw:
            return "medium"
        return "weak"

    def _has_straight_draw(self, cards: list[str]) -> bool:
        values = {RANK_VALUE[card[0]] for card in cards}
        if 14 in values:
            values.add(1)
        for start in range(1, 11):
            window = set(range(start, start + 5))
            if len(window & values) >= 4:
                return True
        return False

    def _raise_amount(self, state: GameState, desired_total: int) -> int | None:
        current = max(state.userBet, state.dnBet)
        max_total = state.dnBet + state.dnStack
        if max_total <= current:
            return None
        minimum = state.bigBlind if current == 0 else max(current * 2, current + state.lastRaiseSize)
        if max_total < minimum:
            return max_total
        return max(min(desired_total, max_total), minimum)

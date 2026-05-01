import random

from app.constants import RANKS, SUITS


def build_deck() -> list[str]:
    return [rank + suit for rank in RANKS for suit in SUITS]


def shuffled_deck(rng: random.Random | None = None) -> list[str]:
    deck = build_deck()
    (rng or random).shuffle(deck)
    return deck


def deal(deck: list[str], count: int) -> list[str]:
    if count < 0:
        raise ValueError("Cannot deal a negative number of cards")
    if len(deck) < count:
        raise ValueError("Not enough cards left in deck")
    cards = deck[:count]
    del deck[:count]
    return cards


def burn(deck: list[str]) -> str:
    return deal(deck, 1)[0]


def assert_unique_cards(cards: list[str]) -> None:
    if len(cards) != len(set(cards)):
        raise ValueError("Duplicate card detected")

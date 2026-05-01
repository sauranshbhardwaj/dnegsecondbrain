import pytest

from app.deck import assert_unique_cards, build_deck, burn, deal, shuffled_deck


def test_build_deck_has_52_unique_cards() -> None:
    deck = build_deck()

    assert len(deck) == 52
    assert len(set(deck)) == 52
    assert "Ah" in deck
    assert "Tc" in deck


def test_deal_and_burn_remove_cards_from_deck() -> None:
    deck = build_deck()

    hand = deal(deck, 2)
    burned = burn(deck)

    assert hand == ["2c", "2d"]
    assert burned == "2h"
    assert len(deck) == 49
    assert set(hand + [burned]).isdisjoint(deck)


def test_shuffled_deck_preserves_unique_cards() -> None:
    deck = shuffled_deck()

    assert len(deck) == 52
    assert set(deck) == set(build_deck())


def test_assert_unique_cards_rejects_duplicates() -> None:
    with pytest.raises(ValueError, match="Duplicate card"):
        assert_unique_cards(["Ah", "Ah"])

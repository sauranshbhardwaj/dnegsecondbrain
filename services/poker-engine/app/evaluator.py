from treys import Card, Evaluator


def evaluate_showdown(user_hand: list[str], dn_hand: list[str], board: list[str]) -> dict[str, object]:
    if len(user_hand) != 2 or len(dn_hand) != 2:
        raise ValueError("Both players need exactly two hole cards")
    if len(board) != 5:
        raise ValueError("Showdown requires a complete five-card board")

    evaluator = Evaluator()
    treys_board = [Card.new(card) for card in board]
    treys_user = [Card.new(card) for card in user_hand]
    treys_dn = [Card.new(card) for card in dn_hand]

    user_score = evaluator.evaluate(treys_board, treys_user)
    dn_score = evaluator.evaluate(treys_board, treys_dn)

    if user_score < dn_score:
        winner = "user"
    elif dn_score < user_score:
        winner = "dn"
    else:
        winner = "split"

    return {
        "winner": winner,
        "userScore": user_score,
        "dnScore": dn_score,
        "userRank": evaluator.class_to_string(evaluator.get_rank_class(user_score)),
        "dnRank": evaluator.class_to_string(evaluator.get_rank_class(dn_score)),
    }

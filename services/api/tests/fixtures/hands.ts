import type { CoachingAnalyzeRequest } from "../../src/coaching/types.js";

export const handFixtures: CoachingAnalyzeRequest[] = [
  {
    userId: "fixture_river_payoff",
    handHistory: [
      { actor: "system", action: "post_blinds", amount: 75, state: "PREFLOP", street: 1, pot: 75 },
      { actor: "dn", action: "raise", amount: 125, state: "PREFLOP", street: 1, pot: 175, note: "DN opens button" },
      { actor: "user", action: "call", amount: 75, state: "PREFLOP", street: 1, pot: 250 },
      { actor: "system", action: "deal_flop", state: "FLOP", street: 2, pot: 250 },
      { actor: "user", action: "check", state: "FLOP", street: 2, pot: 250 },
      { actor: "dn", action: "raise", amount: 75, state: "FLOP", street: 2, pot: 325, note: "small c-bet" },
      { actor: "user", action: "call", amount: 75, state: "FLOP", street: 2, pot: 400 },
      { actor: "system", action: "deal_turn", state: "TURN", street: 3, pot: 400 },
      { actor: "user", action: "check", state: "TURN", street: 3, pot: 400 },
      { actor: "dn", action: "check", state: "TURN", street: 3, pot: 400 },
      { actor: "system", action: "deal_river", state: "RIVER", street: 4, pot: 400 },
      { actor: "user", action: "check", state: "RIVER", street: 4, pot: 400 },
      { actor: "dn", action: "raise", amount: 350, state: "RIVER", street: 4, pot: 750, note: "polarized river value" },
      { actor: "user", action: "call", amount: 350, state: "RIVER", street: 4, pot: 1100 }
    ],
    userHand: ["Ah", "Jd"],
    dnHand: ["Qs", "Qh"],
    board: ["Jc", "7d", "2s", "4h", "Qc"],
    winner: "dn",
    pot: 1100,
    userMistakeProfile: [
      {
        pattern: "pays off river pressure with medium-strength hands",
        firstSeen: "2026-05-01T20:00:00Z",
        lastSeen: "2026-05-01T21:00:00Z",
        frequency: 2,
        severity: "high",
        handsContext: ["hand_river_1", "hand_river_2"]
      }
    ]
  },
  {
    userId: "fixture_three_bet_fold",
    handHistory: [
      { actor: "system", action: "post_blinds", amount: 75, state: "PREFLOP", street: 1, pot: 75 },
      { actor: "dn", action: "raise", amount: 125, state: "PREFLOP", street: 1, pot: 175 },
      { actor: "user", action: "raise", amount: 375, state: "PREFLOP", street: 1, pot: 500, note: "user 3-bet" },
      { actor: "dn", action: "raise", amount: 1000, state: "PREFLOP", street: 1, pot: 1375, note: "DN 4-bet shoves" },
      { actor: "user", action: "fold", state: "PREFLOP", street: 1, pot: 0 }
    ],
    userHand: ["As", "Kd"],
    dnHand: ["9c", "8c"],
    board: ["2d", "4s", "7h", "Jc", "Qd"],
    winner: "dn",
    pot: 1375,
    userMistakeProfile: [
      {
        pattern: "over-folds to preflop pressure after investing chips",
        firstSeen: "2026-05-01T19:00:00Z",
        lastSeen: "2026-05-01T20:30:00Z",
        frequency: 3,
        severity: "high",
        handsContext: ["hand_3bet_1"]
      }
    ]
  },
  {
    userId: "fixture_small_ball",
    handHistory: [
      { actor: "system", action: "post_blinds", amount: 75, state: "PREFLOP", street: 1, pot: 75 },
      { actor: "dn", action: "call", amount: 25, state: "PREFLOP", street: 1, pot: 100 },
      { actor: "user", action: "check", state: "PREFLOP", street: 1, pot: 100 },
      { actor: "system", action: "deal_flop", state: "FLOP", street: 2, pot: 100 },
      { actor: "user", action: "raise", amount: 300, state: "FLOP", street: 2, pot: 400, note: "oversized one-pair bet" },
      { actor: "dn", action: "call", amount: 300, state: "FLOP", street: 2, pot: 700 },
      { actor: "system", action: "deal_turn", state: "TURN", street: 3, pot: 700 },
      { actor: "user", action: "check", state: "TURN", street: 3, pot: 700 },
      { actor: "dn", action: "raise", amount: 250, state: "TURN", street: 3, pot: 950 },
      { actor: "user", action: "fold", state: "TURN", street: 3, pot: 0 }
    ],
    userHand: ["Kc", "7s"],
    dnHand: ["Kh", "9h"],
    board: ["Kd", "6c", "2h", "9d", "3s"],
    winner: "dn",
    pot: 950,
    userMistakeProfile: []
  },
  {
    userId: "fixture_missed_draw_bluff",
    handHistory: [
      { actor: "system", action: "post_blinds", amount: 75, state: "PREFLOP", street: 1, pot: 75 },
      { actor: "dn", action: "raise", amount: 125, state: "PREFLOP", street: 1, pot: 175 },
      { actor: "user", action: "call", amount: 75, state: "PREFLOP", street: 1, pot: 250 },
      { actor: "system", action: "deal_flop", state: "FLOP", street: 2, pot: 250 },
      { actor: "user", action: "check", state: "FLOP", street: 2, pot: 250 },
      { actor: "dn", action: "raise", amount: 90, state: "FLOP", street: 2, pot: 340 },
      { actor: "user", action: "raise", amount: 280, state: "FLOP", street: 2, pot: 620, note: "semi-bluff check-raise" },
      { actor: "dn", action: "call", amount: 190, state: "FLOP", street: 2, pot: 810 },
      { actor: "system", action: "deal_turn", state: "TURN", street: 3, pot: 810 },
      { actor: "user", action: "raise", amount: 500, state: "TURN", street: 3, pot: 1310 },
      { actor: "dn", action: "call", amount: 500, state: "TURN", street: 3, pot: 1810 },
      { actor: "system", action: "deal_river", state: "RIVER", street: 4, pot: 1810 },
      { actor: "user", action: "check", state: "RIVER", street: 4, pot: 1810 },
      { actor: "dn", action: "check", state: "RIVER", street: 4, pot: 1810 }
    ],
    userHand: ["Ac", "Tc"],
    dnHand: ["Qd", "Qs"],
    board: ["Kc", "7c", "2d", "4s", "9h"],
    winner: "dn",
    pot: 1810,
    userMistakeProfile: []
  },
  {
    userId: "fixture_good_losing_play",
    handHistory: [
      { actor: "system", action: "post_blinds", amount: 75, state: "PREFLOP", street: 1, pot: 75 },
      { actor: "dn", action: "raise", amount: 125, state: "PREFLOP", street: 1, pot: 175 },
      { actor: "user", action: "call", amount: 75, state: "PREFLOP", street: 1, pot: 250 },
      { actor: "system", action: "deal_flop", state: "FLOP", street: 2, pot: 250 },
      { actor: "user", action: "check", state: "FLOP", street: 2, pot: 250 },
      { actor: "dn", action: "raise", amount: 80, state: "FLOP", street: 2, pot: 330 },
      { actor: "user", action: "call", amount: 80, state: "FLOP", street: 2, pot: 410 },
      { actor: "system", action: "deal_turn", state: "TURN", street: 3, pot: 410 },
      { actor: "user", action: "check", state: "TURN", street: 3, pot: 410 },
      { actor: "dn", action: "raise", amount: 220, state: "TURN", street: 3, pot: 630 },
      { actor: "user", action: "fold", state: "TURN", street: 3, pot: 0, note: "disciplined fold to pressure" }
    ],
    userHand: ["8c", "8d"],
    dnHand: ["As", "Ah"],
    board: ["Qh", "Jd", "4s", "Kc", "2h"],
    winner: "dn",
    pot: 630,
    userMistakeProfile: [
      {
        pattern: "calls down too light after making one pair",
        firstSeen: "2026-05-01T18:00:00Z",
        lastSeen: "2026-05-01T21:30:00Z",
        frequency: 4,
        severity: "medium",
        handsContext: ["hand_call_1", "hand_call_2"]
      }
    ]
  }
];

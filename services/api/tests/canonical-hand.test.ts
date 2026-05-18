import { describe, expect, it } from "vitest";

import { buildCanonicalCoachingHand } from "../src/coaching/canonical-hand.js";
import { handFixtures } from "./fixtures/hands.js";

describe("canonical coaching hand facts", () => {
  it("builds coaching facts from completed poker-engine state", () => {
    const fixture = handFixtures[0];
    const canonical = buildCanonicalCoachingHand(
      {
        handId: "hand_authoritative",
        userId: "clerk_user_123",
        handHistory: fixture.handHistory,
        terminal: {
          reason: "showdown",
          winner: fixture.winner,
          potAwarded: { user: 0, dn: fixture.pot },
          userHand: fixture.userHand,
          dnHand: fixture.dnHand,
          board: fixture.board,
          userRank: "pair of jacks",
          dnRank: "three queens"
        }
      },
      "clerk_user_123",
      "hand_authoritative"
    );

    expect(canonical).toEqual({
      handId: "hand_authoritative",
      userId: "clerk_user_123",
      handHistory: fixture.handHistory,
      userHand: fixture.userHand,
      dnHand: fixture.dnHand,
      board: fixture.board,
      winner: fixture.winner,
      pot: fixture.pot,
      userRank: "pair of jacks",
      dnRank: "three queens"
    });
  });

  it("rejects mismatched users or stale hand ids", () => {
    const fixture = handFixtures[1];
    const state = {
      handId: "current_hand",
      userId: "clerk_user_123",
      handHistory: fixture.handHistory,
      terminal: {
        reason: "fold",
        winner: fixture.winner,
        potAwarded: { user: 0, dn: fixture.pot },
        userHand: fixture.userHand,
        dnHand: fixture.dnHand,
        board: fixture.board
      }
    };

    expect(() => buildCanonicalCoachingHand(state, "other_user")).toThrow("Canonical game state user mismatch");
    expect(() => buildCanonicalCoachingHand(state, "clerk_user_123", "old_hand")).toThrow(
      "Canonical game state hand mismatch"
    );
  });
});

import { describe, expect, it } from "vitest";

import { selectWikiSlugs } from "../src/coaching/wiki.js";
import { handFixtures } from "./fixtures/hands.js";

describe("wiki selection", () => {
  it("selects river and sizing context for river payoff hands", () => {
    const slugs = selectWikiSlugs(handFixtures[0]);

    expect(slugs).toContain("river-play-and-bet-sizing");
    expect(slugs).toContain("bet-sizing-principles");
    expect(slugs).toHaveLength(3);
  });

  it("selects 3-bet context for preflop pressure hands", () => {
    const slugs = selectWikiSlugs(handFixtures[1]);

    expect(slugs[0]).toBe("three-bet-strategy");
  });
});

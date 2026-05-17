import { describe, expect, it } from "vitest";

import type { ClaudeClient } from "../src/claude/client.js";
import {
  buildMistakeExtractionPrompt,
  ClaudeMistakeExtractor,
  inferMistakeFromHand,
  inferMistakeFromAnalysis,
  parseMistakeExtraction
} from "../src/coaching/mistake-extraction.js";
import { handFixtures } from "./fixtures/hands.js";

class FalseOnlyClaudeClient implements ClaudeClient {
  streamText(): AsyncIterable<string> {
    throw new Error("not used");
  }

  async completeText(): Promise<string> {
    return '{"exists":false}';
  }
}

describe("mistake extraction", () => {
  it("parses valid mistake JSON", () => {
    const result = parseMistakeExtraction(
      '{"exists":true,"pattern":"pays off river pressure with medium-strength hands","severity":"high"}'
    );

    expect(result).toEqual({
      exists: true,
      pattern: "pays off river pressure with medium-strength hands",
      severity: "high"
    });
  });

  it("parses valid no-mistake JSON", () => {
    expect(parseMistakeExtraction('{"exists":false}')).toEqual({ exists: false });
  });

  it("falls back safely on malformed model output", () => {
    expect(parseMistakeExtraction("Sure, buddy: no mistake here")).toEqual({ exists: false });
  });

  it("includes the analysis and hand result in the extraction prompt", () => {
    const prompt = buildMistakeExtractionPrompt("River call was the key leak.", handFixtures[0]);

    expect(prompt).toContain("Return ONLY valid JSON");
    expect(prompt).toContain("Previous mistake profile");
    expect(prompt).toContain("paying off river pressure with medium-strength hands");
    expect(prompt).toContain("over-folding to 4-bet pressure");
    expect(prompt).toContain("River call was the key leak.");
    expect(prompt).toContain("winner: dn");
  });

  it("infers river payoff patterns when the model returns a false negative", async () => {
    const extractor = new ClaudeMistakeExtractor(new FalseOnlyClaudeClient());
    const analysis =
      "This is that same pattern again -- paying off pressure with medium strength. The river call is the key leak.";

    await expect(extractor.extract(analysis, handFixtures[0])).resolves.toEqual({
      exists: true,
      pattern: "paying off river pressure with medium-strength hands",
      severity: "high"
    });
  });

  it("infers over-folding to 4-bet pressure when the model returns a false negative", async () => {
    const extractor = new ClaudeMistakeExtractor(new FalseOnlyClaudeClient());
    const analysis =
      "This is that same over-fold-to-pressure pattern again. You 3-bet ace-king and folded to the 4-bet shove.";

    await expect(extractor.extract(analysis, handFixtures[1])).resolves.toEqual({
      exists: true,
      pattern: "over-folding to 4-bet pressure",
      severity: "high"
    });
  });

  it("keeps no-mistake analyses as false", () => {
    expect(inferMistakeFromAnalysis("Your fold was disciplined and reasonable.", handFixtures[4])).toBeUndefined();
    expect(inferMistakeFromHand(handFixtures[4])).toEqual({
      exists: false
    });
  });

  it("falls back to hand history for river payoff notes", async () => {
    const extractor = new ClaudeMistakeExtractor(new FalseOnlyClaudeClient());

    await expect(extractor.extract("Interesting hand, pal.", handFixtures[0])).resolves.toEqual({
      exists: true,
      pattern: "calling river pressure with marginal hands",
      severity: "high"
    });
  });

  it("falls back to hand history for passive checkdown notes", async () => {
    const extractor = new ClaudeMistakeExtractor(new FalseOnlyClaudeClient());

    await expect(
      extractor.extract("You checked it down and kept the pot small.", {
        ...handFixtures[2],
        handHistory: [
          { actor: "system", action: "deal_flop", state: "FLOP", street: 2, pot: 100 },
          { actor: "user", action: "check", state: "FLOP", street: 2, pot: 100 },
          { actor: "dn", action: "check", state: "FLOP", street: 2, pot: 100 },
          { actor: "system", action: "deal_turn", state: "TURN", street: 3, pot: 100 },
          { actor: "user", action: "check", state: "TURN", street: 3, pot: 100 },
          { actor: "dn", action: "check", state: "TURN", street: 3, pot: 100 },
          { actor: "system", action: "deal_river", state: "RIVER", street: 4, pot: 100 },
          { actor: "user", action: "check", state: "RIVER", street: 4, pot: 100 },
          { actor: "dn", action: "check", state: "RIVER", street: 4, pot: 100 }
        ],
        winner: "user",
        pot: 100,
        userMistakeProfile: []
      })
    ).resolves.toEqual({
      exists: true,
      pattern: "passive checkdowns with weak holdings",
      severity: "low"
    });
  });
});

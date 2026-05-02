import { describe, expect, it } from "vitest";

import type { ClaudeClient } from "../src/claude/client.js";
import {
  buildMistakeExtractionPrompt,
  ClaudeMistakeExtractor,
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
    expect(inferMistakeFromAnalysis("Your fold was disciplined and reasonable.", handFixtures[4])).toEqual({
      exists: false
    });
  });
});

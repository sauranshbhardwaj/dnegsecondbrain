import { describe, expect, it } from "vitest";

import { buildPromptBundle, buildUserPrompt, summarizeMistakeProfile } from "../src/coaching/prompt.js";
import { handFixtures } from "./fixtures/hands.js";

describe("prompt construction", () => {
  it("builds the exact coaching ask with hand details", () => {
    const prompt = buildUserPrompt({ ...handFixtures[0], userRank: "One Pair", dnRank: "Three of a Kind" });

    expect(prompt).toContain("Here is the complete hand history");
    expect(prompt).toContain("Same suit hole cards are suited, not offsuit.");
    expect(prompt).toContain("The user held [Ah (ace of hearts), Jd (jack of diamonds)]");
    expect(prompt).toContain("Authoritative showdown evaluation: user made One Pair; you made Three of a Kind");
    expect(prompt).toContain("Keep the response under 120 words");
    expect(prompt).toContain("One concrete takeaway");
  });

  it("summarizes mistake profiles by severity and frequency", () => {
    const summary = summarizeMistakeProfile(handFixtures[0].userMistakeProfile);

    expect(summary).toContain("pays off river pressure with medium-strength hands");
    expect(summary).toContain("high, frequency 2");
  });

  it("loads persona and selected wiki articles into the system prompt", async () => {
    const bundle = await buildPromptBundle(handFixtures[0]);

    expect(bundle.systemPrompt).toContain("Daniel Negreanu Persona System Prompt");
    expect(bundle.systemPrompt).toContain("Relevant Wiki Context");
    expect(bundle.systemPrompt).toContain("User Mistake Profile");
    expect(bundle.selectedArticles).toHaveLength(3);
  });
});

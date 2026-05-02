import { describe, expect, it } from "vitest";

import type { ClaudeClient, ClaudeMessage } from "../src/claude/client.js";
import { analyzeHand } from "../src/coaching/analyze.js";
import { coachingAnalyzeRequestSchema } from "../src/coaching/validation.js";
import type { MistakeExtractor } from "../src/coaching/extractor.js";
import type { CoachingAnalyzeRequest, MistakeExtraction } from "../src/coaching/types.js";
import { handFixtures } from "./fixtures/hands.js";

class FakeClaudeClient implements ClaudeClient {
  constructor(private readonly chunks: string[] = ["Nice hand, ", "buddy."]) {}

  async *streamText(_message: ClaudeMessage): AsyncIterable<string> {
    for (const chunk of this.chunks) {
      yield chunk;
    }
  }

  async completeText(): Promise<string> {
    return '{"exists":false}';
  }
}

class ThrowingClaudeClient implements ClaudeClient {
  async *streamText(): AsyncIterable<string> {
    throw new Error("Claude unavailable");
  }

  async completeText(): Promise<string> {
    throw new Error("Claude unavailable");
  }
}

class FakeMistakeExtractor implements MistakeExtractor {
  async extract(_analysis: string, _request: CoachingAnalyzeRequest): Promise<MistakeExtraction> {
    return {
      exists: true,
      pattern: "pays off river pressure with medium-strength hands",
      severity: "high"
    };
  }
}

describe("coaching route", () => {
  it("streams coaching chunks, mistake extraction, and final done event", async () => {
    const events: Array<{ name: string; data: unknown }> = [];

    await analyzeHand(handFixtures[0], {
      claudeClient: new FakeClaudeClient(["I checked back turn. ", "River is the lesson."]),
      mistakeExtractor: new FakeMistakeExtractor()
    }, (name, data) => events.push({ name, data }));

    expect(events.map((event) => event.name)).toEqual(["chunk", "chunk", "mistake", "done"]);
    expect(events[0].data).toMatchObject({ type: "chunk", text: "I checked back turn. " });
    expect(events[2].data).toMatchObject({
      type: "mistake",
      mistake: { exists: true, pattern: "pays off river pressure with medium-strength hands", severity: "high" }
    });
    expect(events[3].data).toMatchObject({
      type: "done",
      text: "I checked back turn. River is the lesson.",
      selectedArticles: expect.arrayContaining(["river-play-and-bet-sizing"])
    });
  });

  it("rejects invalid coaching input before opening SSE", async () => {
    const parsed = coachingAnalyzeRequestSchema.safeParse({ userId: "" });

    expect(parsed.success).toBe(false);
  });

  it("emits an SSE error when Claude streaming fails", async () => {
    await expect(
      analyzeHand(
        handFixtures[0],
        { claudeClient: new ThrowingClaudeClient(), mistakeExtractor: new FakeMistakeExtractor() },
        () => undefined
      )
    ).rejects.toThrow("Claude unavailable");
  });
});

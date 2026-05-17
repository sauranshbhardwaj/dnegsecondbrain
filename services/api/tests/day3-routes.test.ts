import type { NextFunction, Request, Response } from "express";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import type { ClaudeClient, ClaudeMessage } from "../src/claude/client.js";
import type { MistakeExtractor } from "../src/coaching/extractor.js";
import type { CoachingAnalyzeRequest, MistakeExtraction } from "../src/coaching/types.js";
import type { Env } from "../src/config/env.js";
import { createStaticAuthHandlers } from "../src/auth/clerk.js";
import { decryptApiKey, encryptApiKey } from "../src/security/api-key-crypto.js";
import { handFixtures } from "./fixtures/hands.js";
import { InMemoryRepository } from "./helpers/in-memory-repository.js";
import { invokeApp } from "./helpers/invoke-app.js";

const env: Env = {
  anthropicApiKey: "sk-ant-app-key",
  claudeModel: "claude-haiku-4-5-20251001",
  claudeMaxTokens: 700,
  apiKeyEncryptionSecret: "day3-route-encryption-secret",
  port: 3001
};

class CapturingClaudeClient implements ClaudeClient {
  messages: ClaudeMessage[] = [];

  constructor(private readonly chunks: string[] = ["That river call got pricey, pal."]) {}

  async *streamText(message: ClaudeMessage): AsyncIterable<string> {
    this.messages.push(message);
    for (const chunk of this.chunks) {
      yield chunk;
    }
  }

  async completeText(): Promise<string> {
    return '{"exists":false}';
  }
}

class CapturingMistakeExtractor implements MistakeExtractor {
  requests: CoachingAnalyzeRequest[] = [];

  constructor(private readonly result: MistakeExtraction) {}

  async extract(_analysis: string, request: CoachingAnalyzeRequest): Promise<MistakeExtraction> {
    this.requests.push(request);
    return this.result;
  }
}

describe("Day 3 protected routes", () => {
  it("returns 401 for coaching without Clerk auth", async () => {
    const response = await invokeApp(
      createApp({
        env,
        repository: new InMemoryRepository(),
        auth: {
          clerkMiddleware: (_req: Request, _res: Response, next: NextFunction) => next(),
          requireAuth: (_req: Request, res: Response) => {
            res.status(401).json({ error: "Unauthorized" });
          }
        }
      }),
      {
        method: "POST",
        url: "/coaching/analyze",
        body: handFixtures[0]
      }
    );

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Unauthorized" });
  });

  it("accepts authenticated Next proxy headers in local keyless development", async () => {
    const response = await invokeApp(
      createApp({
        env,
        repository: new InMemoryRepository()
      }),
      {
        method: "GET",
        url: "/user/profile",
        headers: {
          authorization: "Bearer local-keyless-session",
          "x-clerk-user-id": "clerk_keyless_123"
        }
      }
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      mistakes: [],
      freeHandsUsed: 0,
      freeHandsLimit: 5,
      hasApiKey: false
    });
  });

  it("uses Clerk userId, reads Redis mistakes, persists extracted mistakes, and increments usage once", async () => {
    const repository = new InMemoryRepository();
    const claudeClient = new CapturingClaudeClient();
    const extractor = new CapturingMistakeExtractor({
      exists: true,
      pattern: "paying off river pressure with medium-strength hands",
      severity: "high"
    });
    await repository.setMistakes("clerk_user_123", [
      {
        pattern: "Paying off river pressure with medium strength hands",
        firstSeen: "2026-05-01T10:00:00.000Z",
        lastSeen: "2026-05-01T11:00:00.000Z",
        frequency: 2,
        severity: "medium",
        handsContext: ["hand_old"]
      }
    ]);

    const response = await invokeApp(
      createApp({
        env,
        claudeClient,
        createClaudeClientForUserKey: () => claudeClient,
        createMistakeExtractor: () => extractor,
        repository,
        auth: createStaticAuthHandlers("clerk_user_123")
      }),
      {
        method: "POST",
        url: "/coaching/analyze",
        body: {
          ...handFixtures[0],
          handId: "hand_new",
          userId: "spoofed_body_user",
          userMistakeProfile: []
        }
      }
    );

    expect(response.status).toBe(200);
    expect(parseSseEvents(response.text).map((event) => event.event)).toEqual(["chunk", "mistake", "done"]);
    expect(extractor.requests[0]).toMatchObject({
      handId: "hand_new",
      userId: "clerk_user_123",
      userMistakeProfile: [
        {
          pattern: "Paying off river pressure with medium strength hands",
          frequency: 2
        }
      ]
    });
    expect(await repository.getFreeHandCount("clerk_user_123")).toBe(1);
    expect(await repository.getMistakes("clerk_user_123")).toEqual([
      {
        pattern: "Paying off river pressure with medium strength hands",
        firstSeen: "2026-05-01T10:00:00.000Z",
        lastSeen: repository.nowIso,
        frequency: 3,
        severity: "high",
        handsContext: ["hand_old", "hand_new"]
      }
    ]);
  });

  it("returns 402 on the sixth free coaching hand", async () => {
    const repository = new InMemoryRepository();
    repository.freeHandCounts.set("clerk_user_123", 5);
    const claudeClient = new CapturingClaudeClient();

    const response = await invokeApp(
      createApp({
        env,
        claudeClient,
        repository,
        auth: createStaticAuthHandlers("clerk_user_123")
      }),
      {
        method: "POST",
        url: "/coaching/analyze",
        body: handFixtures[0]
      }
    );

    expect(response.status).toBe(402);
    expect(response.body).toEqual({
      error: "Payment Required",
      message: "Free hand limit reached. Add your Anthropic API key to continue playing unlimited hands.",
      freeHandsUsed: 5,
      requiresApiKey: true
    });
    expect(claudeClient.messages).toHaveLength(0);
    expect(await repository.getFreeHandCount("clerk_user_123")).toBe(5);
  });

  it("bypasses the free-hand limit with a stored user API key and uses that key for Claude", async () => {
    const repository = new InMemoryRepository();
    repository.freeHandCounts.set("clerk_user_123", 5);
    await repository.setEncryptedApiKey(
      "clerk_user_123",
      encryptApiKey("sk-ant-user-owned-key", env.apiKeyEncryptionSecret)
    );
    const claudeClient = new CapturingClaudeClient();
    const seenApiKeys: Array<string | undefined> = [];

    const response = await invokeApp(
      createApp({
        env,
        claudeClient: new CapturingClaudeClient(["app key should not be used"]),
        createClaudeClientForUserKey: (encryptedApiKey) => {
          seenApiKeys.push(decryptApiKey(encryptedApiKey, env.apiKeyEncryptionSecret));
          return claudeClient;
        },
        repository,
        auth: createStaticAuthHandlers("clerk_user_123")
      }),
      {
        method: "POST",
        url: "/coaching/analyze",
        body: handFixtures[0]
      }
    );

    expect(response.status).toBe(200);
    expect(seenApiKeys).toEqual(["sk-ant-user-owned-key"]);
    expect(await repository.getFreeHandCount("clerk_user_123")).toBe(5);
  });

  it("stores and deletes encrypted API keys without returning secret material", async () => {
    const repository = new InMemoryRepository();
    const app = createApp({
      env,
      repository,
      auth: createStaticAuthHandlers("clerk_user_123")
    });

    const storeResponse = await invokeApp(app, {
      method: "POST",
      url: "/user/apikey",
      body: { apiKey: "sk-ant-user-owned-key" }
    });
    const encrypted = await repository.getEncryptedApiKey("clerk_user_123");

    expect(storeResponse.status).toBe(200);
    expect(storeResponse.body).toEqual({ hasApiKey: true });
    expect(storeResponse.text).not.toContain("sk-ant-user-owned-key");
    expect(encrypted).not.toBeNull();
    expect(JSON.stringify(encrypted)).not.toContain("sk-ant-user-owned-key");
    expect(decryptApiKey(encrypted!, env.apiKeyEncryptionSecret)).toBe("sk-ant-user-owned-key");

    const deleteResponse = await invokeApp(app, {
      method: "POST",
      url: "/user/apikey",
      body: { delete: true }
    });

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body).toEqual({ hasApiKey: false });
    expect(await repository.getEncryptedApiKey("clerk_user_123")).toBeNull();
  });

  it("returns profile data without API key material", async () => {
    const repository = new InMemoryRepository();
    repository.freeHandCounts.set("clerk_user_123", 3);
    await repository.setMistakes("clerk_user_123", [
      {
        pattern: "over-folding to pressure",
        firstSeen: "2026-05-01T10:00:00.000Z",
        lastSeen: "2026-05-01T11:00:00.000Z",
        frequency: 2,
        severity: "medium",
        handsContext: ["hand_1"]
      }
    ]);
    await repository.setEncryptedApiKey(
      "clerk_user_123",
      encryptApiKey("sk-ant-user-owned-key", env.apiKeyEncryptionSecret)
    );

    const response = await invokeApp(
      createApp({
        env,
        repository,
        auth: createStaticAuthHandlers("clerk_user_123")
      }),
      {
        method: "GET",
        url: "/user/profile"
      }
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      mistakes: [
        {
          pattern: "over-folding to pressure",
          firstSeen: "2026-05-01T10:00:00.000Z",
          lastSeen: "2026-05-01T11:00:00.000Z",
          frequency: 2,
          severity: "medium",
          handsContext: ["hand_1"]
        }
      ],
      freeHandsUsed: 3,
      freeHandsLimit: 5,
      hasApiKey: true
    });
    expect(response.text).not.toContain("sk-ant-user-owned-key");
  });

  it("stores session eval ratings for the authenticated user", async () => {
    const repository = new InMemoryRepository();

    const response = await invokeApp(
      createApp({
        env,
        repository,
        auth: createStaticAuthHandlers("clerk_user_123")
      }),
      {
        method: "POST",
        url: "/user/eval",
        body: {
          rating: 5,
          feedback: "Warm, direct, and specific.",
          sessionId: "session_abc"
        }
      }
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
    expect([...repository.evals.values()]).toEqual([
      expect.objectContaining({
        userId: "clerk_user_123",
        rating: 5,
        feedback: "Warm, direct, and specific.",
        sessionId: "session_abc"
      })
    ]);
  });
});

function parseSseEvents(text: string): Array<{ event: string; data: unknown }> {
  return text
    .trim()
    .split("\n\n")
    .map((block) => {
      const event = block.match(/^event: (.+)$/m)?.[1] ?? "";
      const data = JSON.parse(block.match(/^data: (.+)$/m)?.[1] ?? "{}") as unknown;
      return { event, data };
    });
}

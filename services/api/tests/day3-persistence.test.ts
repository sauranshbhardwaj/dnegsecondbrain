import { describe, expect, it } from "vitest";

import { type MistakeExtraction, type MistakeProfileEntry } from "../src/coaching/types.js";
import { sessionKey, mistakesKey, rateLimitHandsKey, apiKeyKey } from "../src/persistence/keys.js";
import { normalizePattern, upsertMistakeProfile } from "../src/persistence/mistakes.js";
import { checkAndIncrementFreeHandLimit } from "../src/rate-limit/free-hands.js";
import { decryptApiKey, encryptApiKey } from "../src/security/api-key-crypto.js";
import { InMemoryRepository } from "./helpers/in-memory-repository.js";

const encryptionSecret = "day3-test-encryption-secret";

describe("Day 3 persistence helpers", () => {
  it("builds the exact Upstash key schema", () => {
    expect(sessionKey("user_123")).toBe("session:user_123:current");
    expect(mistakesKey("user_123")).toBe("mistakes:user_123");
    expect(rateLimitHandsKey("user_123")).toBe("ratelimit:user_123:hands");
    expect(apiKeyKey("user_123")).toBe("apikey:user_123");
  });

  it("normalizes and merges mistake profile entries permanently", () => {
    const existing: MistakeProfileEntry[] = [
      {
        pattern: "Paying off river pressure with medium strength hands",
        firstSeen: "2026-05-01T10:00:00.000Z",
        lastSeen: "2026-05-01T11:00:00.000Z",
        frequency: 2,
        severity: "medium",
        handsContext: ["hand_old"]
      }
    ];
    const extraction: MistakeExtraction = {
      exists: true,
      pattern: "paying off river pressure with medium-strength hands",
      severity: "high"
    };

    const next = upsertMistakeProfile(existing, extraction, "2026-05-02T12:00:00.000Z", "hand_new");
    const repeated = upsertMistakeProfile(next, extraction, "2026-05-02T13:00:00.000Z", "hand_new");

    expect(normalizePattern(extraction.pattern)).toBe("paying off river pressure with medium strength hands");
    expect(repeated).toEqual([
      {
        pattern: "Paying off river pressure with medium strength hands",
        firstSeen: "2026-05-01T10:00:00.000Z",
        lastSeen: "2026-05-02T13:00:00.000Z",
        frequency: 4,
        severity: "high",
        handsContext: ["hand_old", "hand_new"]
      }
    ]);
    expect(existing[0].frequency).toBe(2);
  });

  it("encrypts API keys without exposing plaintext and rejects bad secrets or corrupted payloads", () => {
    const encrypted = encryptApiKey("sk-ant-user-secret", encryptionSecret);

    expect(encrypted).toMatchObject({ version: 1 });
    expect(JSON.stringify(encrypted)).not.toContain("sk-ant-user-secret");
    expect(decryptApiKey(encrypted, encryptionSecret)).toBe("sk-ant-user-secret");
    expect(() => encryptApiKey("sk-ant-user-secret", "too-short")).toThrow(
      "API_KEY_ENCRYPTION_SECRET must be at least 16 characters"
    );
    expect(() =>
      decryptApiKey({ ...encrypted, ciphertext: encrypted.ciphertext.slice(1) }, encryptionSecret)
    ).toThrow();
  });

  it("allows five free coaching hands, blocks the sixth, and bypasses with a user API key", async () => {
    const repository = new InMemoryRepository();

    const results = [];
    for (let index = 0; index < 5; index += 1) {
      results.push(await checkAndIncrementFreeHandLimit(repository, "user_limit", false));
    }

    expect(results.every((result) => result.allowed)).toBe(true);
    expect(await repository.getFreeHandCount("user_limit")).toBe(5);
    expect(await checkAndIncrementFreeHandLimit(repository, "user_limit", false)).toMatchObject({
      allowed: false,
      status: 402,
      count: 5
    });

    const bypassed = await checkAndIncrementFreeHandLimit(repository, "user_limit", true);
    expect(bypassed).toEqual({ allowed: true, bypassed: true, count: 5 });
    expect(await repository.getFreeHandCount("user_limit")).toBe(5);
  });

  it("allows only five simultaneous free-hand claims", async () => {
    const repository = new InMemoryRepository();

    const results = await Promise.all(
      Array.from({ length: 6 }, () => checkAndIncrementFreeHandLimit(repository, "user_race", false))
    );

    expect(results.filter((result) => result.allowed)).toHaveLength(5);
    expect(results.filter((result) => !result.allowed)).toHaveLength(1);
    expect(await repository.getFreeHandCount("user_race")).toBe(5);
  });
});

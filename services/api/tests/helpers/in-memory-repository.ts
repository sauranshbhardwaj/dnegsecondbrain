import type { MistakeExtraction, MistakeProfileEntry } from "../../src/coaching/types.js";
import type { PersistenceRepository } from "../../src/persistence/repository.js";
import { upsertMistakeProfile } from "../../src/persistence/mistakes.js";
import type { EncryptedApiKey } from "../../src/security/api-key-crypto.js";

export class InMemoryRepository implements PersistenceRepository {
  sessions = new Map<string, unknown>();
  mistakes = new Map<string, MistakeProfileEntry[]>();
  freeHandCounts = new Map<string, number>();
  apiKeys = new Map<string, EncryptedApiKey>();
  nowIso = "2026-05-02T00:00:00.000Z";

  async getCurrentSession<T = unknown>(userId: string): Promise<T | null> {
    return (this.sessions.get(userId) as T | undefined) ?? null;
  }

  async setCurrentSession<T = unknown>(userId: string, gameState: T): Promise<void> {
    this.sessions.set(userId, gameState);
  }

  async getMistakes(userId: string): Promise<MistakeProfileEntry[]> {
    return this.mistakes.get(userId) ?? [];
  }

  async setMistakes(userId: string, mistakes: MistakeProfileEntry[]): Promise<void> {
    this.mistakes.set(userId, mistakes);
  }

  async upsertMistake(userId: string, mistake: MistakeExtraction, handId?: string): Promise<MistakeProfileEntry[]> {
    if (!mistake.exists) {
      return this.getMistakes(userId);
    }

    const next = upsertMistakeProfile(await this.getMistakes(userId), mistake, this.nowIso, handId);
    this.mistakes.set(userId, next);
    return next;
  }

  async getFreeHandCount(userId: string): Promise<number> {
    return this.freeHandCounts.get(userId) ?? 0;
  }

  async incrementFreeHandCount(userId: string): Promise<number> {
    const next = (this.freeHandCounts.get(userId) ?? 0) + 1;
    this.freeHandCounts.set(userId, next);
    return next;
  }

  async getEncryptedApiKey(userId: string): Promise<EncryptedApiKey | null> {
    return this.apiKeys.get(userId) ?? null;
  }

  async setEncryptedApiKey(userId: string, apiKey: EncryptedApiKey): Promise<void> {
    this.apiKeys.set(userId, apiKey);
  }

  async deleteEncryptedApiKey(userId: string): Promise<void> {
    this.apiKeys.delete(userId);
  }

  async hasEncryptedApiKey(userId: string): Promise<boolean> {
    return this.apiKeys.has(userId);
  }
}

import { Redis } from "@upstash/redis";

import type { MistakeExtraction, MistakeProfileEntry } from "../coaching/types.js";
import type { Env } from "../config/env.js";
import type { EncryptedApiKey } from "../security/api-key-crypto.js";
import { apiKeyKey, evalKey, mistakesKey, rateLimitHandsKey, sessionKey } from "./keys.js";
import { upsertMistakeProfile } from "./mistakes.js";

export type SessionEval = {
  userId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  feedback?: string;
  sessionId?: string;
  createdAt: string;
};

export interface PersistenceRepository {
  getCurrentSession<T = unknown>(userId: string): Promise<T | null>;
  setCurrentSession<T = unknown>(userId: string, gameState: T): Promise<void>;
  getMistakes(userId: string): Promise<MistakeProfileEntry[]>;
  setMistakes(userId: string, mistakes: MistakeProfileEntry[]): Promise<void>;
  upsertMistake(userId: string, mistake: MistakeExtraction, handId?: string): Promise<MistakeProfileEntry[]>;
  getFreeHandCount(userId: string): Promise<number>;
  incrementFreeHandCount(userId: string): Promise<number>;
  getEncryptedApiKey(userId: string): Promise<EncryptedApiKey | null>;
  setEncryptedApiKey(userId: string, apiKey: EncryptedApiKey): Promise<void>;
  deleteEncryptedApiKey(userId: string): Promise<void>;
  hasEncryptedApiKey(userId: string): Promise<boolean>;
  setSessionEval(userId: string, createdAt: string, evaluation: SessionEval): Promise<void>;
}

export class UpstashPersistenceRepository implements PersistenceRepository {
  constructor(private readonly redis: Redis) {}

  async getCurrentSession<T = unknown>(userId: string): Promise<T | null> {
    return this.redis.get<T>(sessionKey(userId));
  }

  async setCurrentSession<T = unknown>(userId: string, gameState: T): Promise<void> {
    await this.redis.set(sessionKey(userId), gameState);
  }

  async getMistakes(userId: string): Promise<MistakeProfileEntry[]> {
    return (await this.redis.get<MistakeProfileEntry[]>(mistakesKey(userId))) ?? [];
  }

  async setMistakes(userId: string, mistakes: MistakeProfileEntry[]): Promise<void> {
    await this.redis.set(mistakesKey(userId), mistakes);
  }

  async upsertMistake(userId: string, mistake: MistakeExtraction, handId?: string): Promise<MistakeProfileEntry[]> {
    if (!mistake.exists) {
      return this.getMistakes(userId);
    }

    const next = upsertMistakeProfile(await this.getMistakes(userId), mistake, new Date().toISOString(), handId);
    await this.setMistakes(userId, next);
    return next;
  }

  async getFreeHandCount(userId: string): Promise<number> {
    return (await this.redis.get<number>(rateLimitHandsKey(userId))) ?? 0;
  }

  async incrementFreeHandCount(userId: string): Promise<number> {
    return this.redis.incr(rateLimitHandsKey(userId));
  }

  async getEncryptedApiKey(userId: string): Promise<EncryptedApiKey | null> {
    return this.redis.get<EncryptedApiKey>(apiKeyKey(userId));
  }

  async setEncryptedApiKey(userId: string, apiKey: EncryptedApiKey): Promise<void> {
    await this.redis.set(apiKeyKey(userId), apiKey);
  }

  async deleteEncryptedApiKey(userId: string): Promise<void> {
    await this.redis.del(apiKeyKey(userId));
  }

  async hasEncryptedApiKey(userId: string): Promise<boolean> {
    return (await this.getEncryptedApiKey(userId)) !== null;
  }

  async setSessionEval(userId: string, createdAt: string, evaluation: SessionEval): Promise<void> {
    await this.redis.set(evalKey(userId, createdAt), evaluation);
  }
}

export class MissingPersistenceRepository implements PersistenceRepository {
  getCurrentSession(): Promise<null> {
    return Promise.reject(missingRedisError());
  }
  setCurrentSession(): Promise<void> {
    return Promise.reject(missingRedisError());
  }
  getMistakes(): Promise<MistakeProfileEntry[]> {
    return Promise.reject(missingRedisError());
  }
  setMistakes(): Promise<void> {
    return Promise.reject(missingRedisError());
  }
  upsertMistake(): Promise<MistakeProfileEntry[]> {
    return Promise.reject(missingRedisError());
  }
  getFreeHandCount(): Promise<number> {
    return Promise.reject(missingRedisError());
  }
  incrementFreeHandCount(): Promise<number> {
    return Promise.reject(missingRedisError());
  }
  getEncryptedApiKey(): Promise<EncryptedApiKey | null> {
    return Promise.reject(missingRedisError());
  }
  setEncryptedApiKey(): Promise<void> {
    return Promise.reject(missingRedisError());
  }
  deleteEncryptedApiKey(): Promise<void> {
    return Promise.reject(missingRedisError());
  }
  hasEncryptedApiKey(): Promise<boolean> {
    return Promise.reject(missingRedisError());
  }
  setSessionEval(): Promise<void> {
    return Promise.reject(missingRedisError());
  }
}

export function createPersistenceRepository(env: Env): PersistenceRepository {
  if (!env.upstashRedisRestUrl || !env.upstashRedisRestToken) {
    return new MissingPersistenceRepository();
  }

  return new UpstashPersistenceRepository(
    new Redis({
      url: env.upstashRedisRestUrl,
      token: env.upstashRedisRestToken
    })
  );
}

function missingRedisError(): Error {
  return new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required");
}

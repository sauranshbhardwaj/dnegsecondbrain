import "dotenv/config";

export type Env = {
  anthropicApiKey?: string;
  claudeModel: string;
  claudeMaxTokens: number;
  clerkSecretKey?: string;
  clerkPublishableKey?: string;
  clerkJwtKey?: string;
  upstashRedisRestUrl?: string;
  upstashRedisRestToken?: string;
  apiKeyEncryptionSecret?: string;
  port: number;
};

function numberFromEnv(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function readEnv(): Env {
  return {
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    claudeModel: process.env.CLAUDE_MODEL ?? "claude-sonnet-4-20250514",
    claudeMaxTokens: numberFromEnv(process.env.CLAUDE_MAX_TOKENS, 700),
    clerkSecretKey: process.env.CLERK_SECRET_KEY,
    clerkPublishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    clerkJwtKey: process.env.CLERK_JWT_KEY,
    upstashRedisRestUrl: process.env.UPSTASH_REDIS_REST_URL,
    upstashRedisRestToken: process.env.UPSTASH_REDIS_REST_TOKEN,
    apiKeyEncryptionSecret: process.env.API_KEY_ENCRYPTION_SECRET,
    port: numberFromEnv(process.env.PORT, 3001)
  };
}

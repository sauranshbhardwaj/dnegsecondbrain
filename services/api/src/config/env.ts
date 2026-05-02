import "dotenv/config";

export type Env = {
  anthropicApiKey?: string;
  claudeModel: string;
  claudeMaxTokens: number;
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
    port: numberFromEnv(process.env.PORT, 3001)
  };
}

import Anthropic from "@anthropic-ai/sdk";

import type { Env } from "../config/env.js";
import type { EncryptedApiKey } from "../security/api-key-crypto.js";
import { decryptApiKey } from "../security/api-key-crypto.js";

export type ClaudeMessage = {
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
};

export interface ClaudeClient {
  streamText(message: ClaudeMessage): AsyncIterable<string>;
  completeText(message: ClaudeMessage): Promise<string>;
}

export class AnthropicClaudeClient implements ClaudeClient {
  private readonly client: Anthropic;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(env: Env, apiKey = env.anthropicApiKey) {
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is required for Claude calls");
    }

    this.client = new Anthropic({ apiKey });
    this.model = env.claudeModel;
    this.maxTokens = env.claudeMaxTokens;
  }

  async *streamText(message: ClaudeMessage): AsyncIterable<string> {
    const stream = await this.client.messages.create({
      model: this.model,
      max_tokens: message.maxTokens ?? this.maxTokens,
      system: message.systemPrompt,
      messages: [{ role: "user", content: message.userPrompt }],
      stream: true
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }
  }

  async completeText(message: ClaudeMessage): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: message.maxTokens ?? this.maxTokens,
      system: message.systemPrompt,
      messages: [{ role: "user", content: message.userPrompt }]
    });

    return response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("");
  }
}

export class MissingClaudeClient implements ClaudeClient {
  streamText(): AsyncIterable<string> {
    throw new Error("ANTHROPIC_API_KEY is required for Claude calls");
  }

  completeText(): Promise<string> {
    throw new Error("ANTHROPIC_API_KEY is required for Claude calls");
  }
}

export function createClaudeClient(env: Env, apiKey = env.anthropicApiKey): ClaudeClient {
  if (!apiKey) {
    return new MissingClaudeClient();
  }
  return new AnthropicClaudeClient(env, apiKey);
}

export function createClaudeClientFromEncryptedApiKey(env: Env, encryptedApiKey: EncryptedApiKey): ClaudeClient {
  return createClaudeClient(env, decryptApiKey(encryptedApiKey, env.apiKeyEncryptionSecret));
}

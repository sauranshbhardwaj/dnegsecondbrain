import cors from "cors";
import express from "express";

import type { ClaudeClient } from "./claude/client.js";
import {
  createClaudeClient,
  createClaudeClientFromEncryptedApiKey,
  MissingClaudeClient
} from "./claude/client.js";
import type { AuthHandlers } from "./auth/clerk.js";
import { createAuthHandlers } from "./auth/clerk.js";
import { NoopMistakeExtractor, type MistakeExtractor } from "./coaching/extractor.js";
import { ClaudeMistakeExtractor } from "./coaching/mistake-extraction.js";
import { readEnv } from "./config/env.js";
import type { PersistenceRepository } from "./persistence/repository.js";
import { createPersistenceRepository } from "./persistence/repository.js";
import { createCoachingRouter } from "./routes/coaching.js";
import { createUserApiKeyRouter } from "./routes/user/apikey.js";
import type { EncryptedApiKey } from "./security/api-key-crypto.js";

export type AppDeps = {
  env?: ReturnType<typeof readEnv>;
  claudeClient?: ClaudeClient;
  mistakeExtractor?: MistakeExtractor;
  createClaudeClientForUserKey?: (encryptedApiKey: EncryptedApiKey) => ClaudeClient;
  createMistakeExtractor?: (claudeClient: ClaudeClient) => MistakeExtractor;
  repository?: PersistenceRepository;
  auth?: AuthHandlers;
};

export function createApp(deps: AppDeps = {}) {
  const app = express();
  const env = deps.env ?? readEnv();
  const claudeClient = deps.claudeClient ?? createClaudeClient(env);
  const createClaudeClientForUserKey =
    deps.createClaudeClientForUserKey ??
    ((encryptedApiKey: EncryptedApiKey) => createClaudeClientFromEncryptedApiKey(env, encryptedApiKey));
  const createMistakeExtractor =
    deps.createMistakeExtractor ??
    (deps.mistakeExtractor ? () => deps.mistakeExtractor as MistakeExtractor : defaultMistakeExtractor);
  const repository = deps.repository ?? createPersistenceRepository(env);
  const auth = deps.auth ?? createAuthHandlers(env);

  app.use(
    cors({
      origin: process.env.FRONTEND_URL || "http://localhost:3000",
      credentials: true
    })
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "dn-second-brain-api" });
  });

  app.use(auth.clerkMiddleware);

  app.use(
    "/coaching",
    createCoachingRouter({
      claudeClient,
      createClaudeClientForUserKey,
      createMistakeExtractor,
      repository,
      requireAuth: auth.requireAuth,
      env
    })
  );
  app.use("/user", createUserApiKeyRouter({ repository, requireAuth: auth.requireAuth, env }));

  return app;
}

function defaultMistakeExtractor(claudeClient: ClaudeClient): MistakeExtractor {
  if (claudeClient instanceof MissingClaudeClient) {
    return new NoopMistakeExtractor();
  }
  return new ClaudeMistakeExtractor(claudeClient);
}

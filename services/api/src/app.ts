import cors from "cors";
import express from "express";

import type { ClaudeClient } from "./claude/client.js";
import { createClaudeClient, MissingClaudeClient } from "./claude/client.js";
import { NoopMistakeExtractor, type MistakeExtractor } from "./coaching/extractor.js";
import { ClaudeMistakeExtractor } from "./coaching/mistake-extraction.js";
import { readEnv } from "./config/env.js";
import { createCoachingRouter } from "./routes/coaching.js";

export type AppDeps = {
  claudeClient?: ClaudeClient;
  mistakeExtractor?: MistakeExtractor;
};

export function createApp(deps: AppDeps = {}) {
  const app = express();
  const env = readEnv();
  const claudeClient = deps.claudeClient ?? createClaudeClient(env);
  const mistakeExtractor = deps.mistakeExtractor ?? defaultMistakeExtractor(claudeClient);

  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "dn-second-brain-api" });
  });

  app.use("/coaching", createCoachingRouter({ claudeClient, mistakeExtractor }));

  return app;
}

function defaultMistakeExtractor(claudeClient: ClaudeClient): MistakeExtractor {
  if (claudeClient instanceof MissingClaudeClient) {
    return new NoopMistakeExtractor();
  }
  return new ClaudeMistakeExtractor(claudeClient);
}

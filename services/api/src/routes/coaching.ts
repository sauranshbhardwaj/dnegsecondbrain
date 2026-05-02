import type { Request, RequestHandler, Response, Router } from "express";
import express from "express";
import { ZodError } from "zod";

import type { ClaudeClient } from "../claude/client.js";
import { analyzeHand } from "../coaching/analyze.js";
import { ClaudeMistakeExtractor } from "../coaching/mistake-extraction.js";
import type { MistakeExtractor } from "../coaching/extractor.js";
import type { CoachingAnalyzeRequest, CoachingStreamEvent } from "../coaching/types.js";
import { coachingAnalyzeRequestSchema } from "../coaching/validation.js";
import { getAuthenticatedUserId } from "../auth/clerk.js";
import type { Env } from "../config/env.js";
import type { PersistenceRepository } from "../persistence/repository.js";
import { checkAndIncrementFreeHandLimit } from "../rate-limit/free-hands.js";
import type { EncryptedApiKey } from "../security/api-key-crypto.js";

export type CoachingRouteDeps = {
  claudeClient: ClaudeClient;
  createClaudeClientForUserKey: (encryptedApiKey: EncryptedApiKey) => ClaudeClient;
  createMistakeExtractor?: (claudeClient: ClaudeClient) => MistakeExtractor;
  repository: PersistenceRepository;
  requireAuth: RequestHandler;
  env: Env;
};

export function createCoachingRouter(deps: CoachingRouteDeps): Router {
  const router = express.Router();

  router.post("/analyze", deps.requireAuth, async (req: Request, res: Response) => {
    const parsed = coachingAnalyzeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid coaching request",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
      return;
    }

    const userId = getAuthenticatedUserId(req);
    let claudeClient: ClaudeClient;
    let mistakeExtractor: MistakeExtractor;
    let requestWithPersistence: CoachingAnalyzeRequest;

    try {
      const storedKey = await deps.repository.getEncryptedApiKey(userId);
      const hasUserApiKey = storedKey !== null;
      const rateLimit = await checkAndIncrementFreeHandLimit(deps.repository, userId, hasUserApiKey);

      if (!rateLimit.allowed) {
        res.status(rateLimit.status).json({
          error: "Payment Required",
          message: rateLimit.message,
          freeHandsUsed: rateLimit.count,
          requiresApiKey: true
        });
        return;
      }

      claudeClient = storedKey ? deps.createClaudeClientForUserKey(storedKey) : deps.claudeClient;
      mistakeExtractor = deps.createMistakeExtractor
        ? deps.createMistakeExtractor(claudeClient)
        : new ClaudeMistakeExtractor(claudeClient);
      requestWithPersistence = {
        ...parsed.data,
        userId,
        userMistakeProfile: await deps.repository.getMistakes(userId)
      };
    } catch (error) {
      res.status(500).json({
        error: "Coaching setup failed",
        message: errorMessage(error)
      });
      return;
    }

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    flushHeaders(res);

    try {
      await analyzeHand(
        requestWithPersistence,
        {
          claudeClient,
          mistakeExtractor,
          onMistake: async (mistake) => {
            await deps.repository.upsertMistake(userId, mistake, requestWithPersistence.handId);
          }
        },
        (eventName, event) => writeSse(res, eventName, event)
      );
    } catch (error) {
      writeSse(res, "error", {
        type: "error",
        message: errorMessage(error)
      });
    } finally {
      res.end();
    }
  });

  return router;
}

export function writeSse(res: Response, event: string, payload: CoachingStreamEvent): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function flushHeaders(res: Response): void {
  try {
    res.flushHeaders?.();
  } catch {
    // node-mocks-http exposes Express' flushHeaders method without a real socket behind it.
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof ZodError) {
    return "Invalid model output";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown coaching error";
}

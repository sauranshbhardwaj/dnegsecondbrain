import type { Request, RequestHandler, Response, Router } from "express";
import express from "express";
import { z } from "zod";

import type { ClaudeClient } from "../claude/client.js";
import type { LoadCanonicalHand } from "../coaching/canonical-hand.js";
import { analyzeHand } from "../coaching/analyze.js";
import { ClaudeMistakeExtractor } from "../coaching/mistake-extraction.js";
import type { MistakeExtractor } from "../coaching/extractor.js";
import type { CoachingAnalyzeRequest, CoachingStreamEvent } from "../coaching/types.js";
import { getAuthenticatedUserId } from "../auth/clerk.js";
import type { Env } from "../config/env.js";
import type { PersistenceRepository } from "../persistence/repository.js";
import { checkAndIncrementFreeHandLimit } from "../rate-limit/free-hands.js";
import type { EncryptedApiKey } from "../security/api-key-crypto.js";

export type CoachingRouteDeps = {
  claudeClient: ClaudeClient;
  createClaudeClientForUserKey: (encryptedApiKey: EncryptedApiKey) => ClaudeClient;
  createMistakeExtractor?: (claudeClient: ClaudeClient) => MistakeExtractor;
  loadCanonicalHand: LoadCanonicalHand;
  repository: PersistenceRepository;
  requireAuth: RequestHandler;
  env: Env;
};

const coachingClientRequestSchema = z.object({
  handId: z.string().min(1).optional()
});

export function createCoachingRouter(deps: CoachingRouteDeps): Router {
  const router = express.Router();

  router.post("/analyze", deps.requireAuth, async (req: Request, res: Response) => {
    const parsed = coachingClientRequestSchema.safeParse(req.body);
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
      const [canonicalHand, mistakeProfile] = await Promise.all([
        deps.loadCanonicalHand(userId, parsed.data.handId),
        deps.repository.getMistakes(userId)
      ]);
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
        ...canonicalHand,
        userId,
        userMistakeProfile: mistakeProfile
      };
    } catch {
      res.status(500).json({
        error: "Coaching setup failed",
        message: "Unable to prepare coaching right now."
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
    } catch {
      writeSse(res, "error", {
        type: "error",
        message: "Unable to generate coaching right now."
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

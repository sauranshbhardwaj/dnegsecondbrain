import type { Request, RequestHandler, Response, Router } from "express";
import express from "express";
import { z } from "zod";

import { getAuthenticatedUserId } from "../../auth/clerk.js";
import { inferMistakeFromHand } from "../../coaching/mistake-extraction.js";
import { coachingAnalyzeRequestSchema } from "../../coaching/validation.js";
import type { Env } from "../../config/env.js";
import type { PersistenceRepository } from "../../persistence/repository.js";
import { FREE_HAND_LIMIT } from "../../rate-limit/free-hands.js";
import { encryptApiKey } from "../../security/api-key-crypto.js";

const apiKeyRequestSchema = z.union([
  z.object({
    apiKey: z.string().min(10),
    delete: z.never().optional()
  }),
  z.object({
    delete: z.literal(true),
    apiKey: z.never().optional()
  })
]);

export type UserApiKeyRouteDeps = {
  repository: PersistenceRepository;
  requireAuth: RequestHandler;
  env: Env;
};

export function createUserApiKeyRouter(deps: UserApiKeyRouteDeps): Router {
  const router = express.Router();

  router.get("/profile", deps.requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getAuthenticatedUserId(req);
      const [mistakes, freeHandsUsed, hasApiKey] = await Promise.all([
        deps.repository.getMistakes(userId),
        deps.repository.getFreeHandCount(userId),
        deps.repository.hasEncryptedApiKey(userId)
      ]);

      res.json({
        mistakes,
        freeHandsUsed,
        freeHandsLimit: FREE_HAND_LIMIT,
        hasApiKey
      });
    } catch (error) {
      res.status(500).json({
        error: "Profile lookup failed",
        message: errorMessage(error)
      });
    }
  });

  router.post("/apikey", deps.requireAuth, async (req: Request, res: Response) => {
    const parsed = apiKeyRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid API key request",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
      return;
    }

    try {
      const userId = getAuthenticatedUserId(req);
      if ("delete" in parsed.data && parsed.data.delete) {
        await deps.repository.deleteEncryptedApiKey(userId);
        res.json({ hasApiKey: false });
        return;
      }

      await deps.repository.setEncryptedApiKey(
        userId,
        encryptApiKey(parsed.data.apiKey, deps.env.apiKeyEncryptionSecret)
      );
      res.json({ hasApiKey: true });
    } catch (error) {
      res.status(500).json({
        error: "API key update failed",
        message: errorMessage(error)
      });
      return;
    }
  });

  router.post("/mistake/infer", deps.requireAuth, async (req: Request, res: Response) => {
    const parsed = coachingAnalyzeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid mistake inference request",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
      return;
    }

    try {
      const userId = getAuthenticatedUserId(req);
      const existingMistakes = await deps.repository.getMistakes(userId);
      const requestWithAuthUser = {
        ...parsed.data,
        userId,
        userMistakeProfile: existingMistakes
      };
      const mistake = inferMistakeFromHand(requestWithAuthUser);
      const mistakes = mistake.exists
        ? await deps.repository.upsertMistake(userId, mistake, requestWithAuthUser.handId)
        : existingMistakes;

      res.json({ mistake, mistakes });
    } catch (error) {
      res.status(500).json({
        error: "Mistake inference failed",
        message: errorMessage(error)
      });
    }
  });

  return router;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown API key storage error";
}

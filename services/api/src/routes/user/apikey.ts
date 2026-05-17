import type { Request, RequestHandler, Response, Router } from "express";
import express from "express";
import { z } from "zod";

import { getAuthenticatedUserId } from "../../auth/clerk.js";
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

const evalRequestSchema = z.object({
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  feedback: z.string().trim().max(1000).optional(),
  sessionId: z.string().trim().min(1).max(200).optional()
});

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

  router.post("/eval", deps.requireAuth, async (req: Request, res: Response) => {
    const parsed = evalRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid eval request",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
      return;
    }

    try {
      const userId = getAuthenticatedUserId(req);
      const createdAt = new Date().toISOString();
      await deps.repository.setSessionEval(userId, createdAt, {
        userId,
        rating: parsed.data.rating,
        ...(parsed.data.feedback ? { feedback: parsed.data.feedback } : {}),
        ...(parsed.data.sessionId ? { sessionId: parsed.data.sessionId } : {}),
        createdAt
      });

      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({
        error: "Eval storage failed",
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

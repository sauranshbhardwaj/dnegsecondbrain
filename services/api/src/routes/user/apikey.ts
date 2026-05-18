import type { Request, RequestHandler, Response, Router } from "express";
import express from "express";
import { z } from "zod";

import { getAuthenticatedUserId } from "../../auth/clerk.js";
import type { LoadCanonicalHand } from "../../coaching/canonical-hand.js";
import { inferMistakeFromHand } from "../../coaching/mistake-extraction.js";
import type { Env } from "../../config/env.js";
import type { PersistenceRepository } from "../../persistence/repository.js";
import { FREE_HAND_LIMIT } from "../../rate-limit/free-hands.js";
import { encryptApiKey } from "../../security/api-key-crypto.js";

const apiKeyErrorMessage = "Enter a valid Anthropic API key.";
const anthropicApiKeySchema = z
  .string()
  .trim()
  .min(20, apiKeyErrorMessage)
  .max(512, apiKeyErrorMessage)
  .regex(/^sk-ant-[A-Za-z0-9_-]+$/, apiKeyErrorMessage);

const apiKeyRequestSchema = z
  .object({
    apiKey: anthropicApiKeySchema.optional(),
    delete: z.literal(true).optional()
  })
  .superRefine((value, context) => {
    const hasApiKey = typeof value.apiKey === "string";
    const shouldDelete = value.delete === true;

    if (hasApiKey === shouldDelete) {
      context.addIssue({
        code: "custom",
        path: ["apiKey"],
        message: apiKeyErrorMessage
      });
    }
  });

const mistakeInferenceRequestSchema = z.object({
  handId: z.string().min(1).optional()
});

export type UserApiKeyRouteDeps = {
  loadCanonicalHand: LoadCanonicalHand;
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
    } catch {
      res.status(500).json({
        error: "Profile lookup failed",
        message: "Unable to load profile right now."
      });
    }
  });

  router.post("/apikey", deps.requireAuth, async (req: Request, res: Response) => {
    const parsed = apiKeyRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid API key request",
        message: apiKeyErrorMessage,
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      });
      return;
    }

    try {
      const userId = getAuthenticatedUserId(req);
      if (parsed.data.delete) {
        await deps.repository.deleteEncryptedApiKey(userId);
        res.json({ hasApiKey: false });
        return;
      }

      const apiKey = parsed.data.apiKey;
      if (!apiKey) {
        res.status(400).json({
          error: "Invalid API key request",
          message: apiKeyErrorMessage
        });
        return;
      }

      await deps.repository.setEncryptedApiKey(
        userId,
        encryptApiKey(apiKey, deps.env.apiKeyEncryptionSecret)
      );
      res.json({ hasApiKey: true });
    } catch {
      res.status(500).json({
        error: "API key update failed",
        message: "Unable to update API key right now."
      });
      return;
    }
  });

  router.post("/mistake/infer", deps.requireAuth, async (req: Request, res: Response) => {
    const parsed = mistakeInferenceRequestSchema.safeParse(req.body);
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
      const canonicalHand = await deps.loadCanonicalHand(userId, parsed.data.handId);
      const requestWithAuthUser = {
        ...canonicalHand,
        userId,
        userMistakeProfile: existingMistakes
      };
      const mistake = inferMistakeFromHand(requestWithAuthUser);
      const mistakes = mistake.exists
        ? await deps.repository.upsertMistake(userId, mistake, requestWithAuthUser.handId)
        : existingMistakes;

      res.json({ mistake, mistakes });
    } catch {
      res.status(500).json({
        error: "Mistake inference failed",
        message: "Unable to infer mistake notes right now."
      });
    }
  });

  return router;
}

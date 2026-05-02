import type { Request, RequestHandler, Response, Router } from "express";
import express from "express";
import { z } from "zod";

import { getAuthenticatedUserId } from "../../auth/clerk.js";
import type { Env } from "../../config/env.js";
import type { PersistenceRepository } from "../../persistence/repository.js";
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

  return router;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown API key storage error";
}

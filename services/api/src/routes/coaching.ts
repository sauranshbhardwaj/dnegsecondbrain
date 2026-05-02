import type { Request, Response, Router } from "express";
import express from "express";
import { ZodError } from "zod";

import type { ClaudeClient } from "../claude/client.js";
import { analyzeHand } from "../coaching/analyze.js";
import type { MistakeExtractor } from "../coaching/extractor.js";
import type { CoachingStreamEvent } from "../coaching/types.js";
import { coachingAnalyzeRequestSchema } from "../coaching/validation.js";

export type CoachingRouteDeps = {
  claudeClient: ClaudeClient;
  mistakeExtractor: MistakeExtractor;
};

export function createCoachingRouter(deps: CoachingRouteDeps): Router {
  const router = express.Router();

  router.post("/analyze", async (req: Request, res: Response) => {
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

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    try {
      await analyzeHand(parsed.data, deps, (eventName, event) => writeSse(res, eventName, event));
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

function errorMessage(error: unknown): string {
  if (error instanceof ZodError) {
    return "Invalid model output";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown coaching error";
}

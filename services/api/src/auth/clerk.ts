import { clerkMiddleware, getAuth } from "@clerk/express";
import type { NextFunction, Request, RequestHandler, Response } from "express";

import type { Env } from "../config/env.js";

export type AuthenticatedRequest = Request & {
  authUserId?: string;
};

export type AuthHandlers = {
  clerkMiddleware: RequestHandler;
  requireAuth: RequestHandler;
};

export function createAuthHandlers(env: Env): AuthHandlers {
  return {
    clerkMiddleware: createClerkMiddleware(env),
    requireAuth: requireApiAuth
  };
}

export function createClerkMiddleware(env: Env): RequestHandler {
  if (!env.clerkSecretKey || !env.clerkPublishableKey) {
    return (_req, _res, next) => next();
  }

  return clerkMiddleware({
    secretKey: env.clerkSecretKey,
    publishableKey: env.clerkPublishableKey,
    ...(env.clerkJwtKey ? { jwtKey: env.clerkJwtKey } : {})
  });
}

export function requireApiAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const auth = getAuth(req);
    if (!auth.isAuthenticated || !auth.userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    (req as AuthenticatedRequest).authUserId = auth.userId;
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
}

export function getAuthenticatedUserId(req: Request): string {
  const userId = (req as AuthenticatedRequest).authUserId;
  if (!userId) {
    throw new Error("Authenticated user id missing");
  }
  return userId;
}

export function createStaticAuthHandlers(userId: string): AuthHandlers {
  return {
    clerkMiddleware: (_req, _res, next) => next(),
    requireAuth: (req, _res, next) => {
      (req as AuthenticatedRequest).authUserId = userId;
      next();
    }
  };
}

import { z } from "zod";

import type { Env } from "../config/env.js";
import { coachingAnalyzeRequestSchema, handHistoryEntrySchema } from "./validation.js";

const terminalHandSchema = z.object({
  reason: z.enum(["fold", "showdown"]),
  winner: z.enum(["user", "dn", "split"]),
  potAwarded: z.object({
    user: z.number().int().nonnegative(),
    dn: z.number().int().nonnegative()
  }),
  userHand: z.tuple([z.string(), z.string()]),
  dnHand: z.tuple([z.string(), z.string()]),
  board: z.tuple([z.string(), z.string(), z.string(), z.string(), z.string()]),
  userRank: z.string().min(1).nullable().optional(),
  dnRank: z.string().min(1).nullable().optional()
});

const publicGameStateSchema = z.object({
  handId: z.string().min(1),
  userId: z.string().min(1),
  handHistory: z.array(handHistoryEntrySchema).min(1),
  terminal: terminalHandSchema
});

const canonicalHandSchema = coachingAnalyzeRequestSchema.omit({ userMistakeProfile: true });

export type CanonicalCoachingHand = z.infer<typeof canonicalHandSchema>;
export type LoadCanonicalHand = (userId: string, requestedHandId?: string) => Promise<CanonicalCoachingHand>;

export function createPokerEngineHandLoader(env: Pick<Env, "pokerEngineUrl">): LoadCanonicalHand {
  return async (userId, requestedHandId) => {
    if (!env.pokerEngineUrl) {
      throw new Error("POKER_ENGINE_URL is required for canonical coaching facts");
    }

    const url = new URL("/game/state", env.pokerEngineUrl);
    url.searchParams.set("userId", userId);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Poker engine state lookup failed");
    }

    return buildCanonicalCoachingHand(await response.json(), userId, requestedHandId);
  };
}

export function buildCanonicalCoachingHand(
  payload: unknown,
  userId: string,
  requestedHandId?: string
): CanonicalCoachingHand {
  const state = publicGameStateSchema.parse(payload);

  if (state.userId !== userId) {
    throw new Error("Canonical game state user mismatch");
  }

  if (requestedHandId && state.handId !== requestedHandId) {
    throw new Error("Canonical game state hand mismatch");
  }

  const terminal = state.terminal;
  return canonicalHandSchema.parse({
    handId: state.handId,
    userId,
    handHistory: state.handHistory,
    userHand: terminal.userHand,
    dnHand: terminal.dnHand,
    board: terminal.board,
    winner: terminal.winner,
    pot: terminal.potAwarded.user + terminal.potAwarded.dn,
    userRank: terminal.userRank ?? undefined,
    dnRank: terminal.dnRank ?? undefined
  });
}

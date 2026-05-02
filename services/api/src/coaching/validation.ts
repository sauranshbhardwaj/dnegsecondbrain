import { z } from "zod";

const cardSchema = z.string().regex(/^[2-9TJQKA][cdhs]$/, "Card must use compact notation like Ah or Td");

export const handHistoryEntrySchema = z.object({
  actor: z.enum(["user", "dn", "system"]),
  action: z.string().min(1),
  amount: z.number().int().nonnegative().optional(),
  state: z.string().min(1).optional(),
  street: z.number().int().nonnegative().optional(),
  pot: z.number().int().nonnegative().optional(),
  note: z.string().nullable().optional()
});

export const mistakeProfileEntrySchema = z.object({
  pattern: z.string().min(1),
  firstSeen: z.string().min(1),
  lastSeen: z.string().min(1),
  frequency: z.number().int().positive(),
  severity: z.enum(["low", "medium", "high"]),
  handsContext: z.array(z.string())
});

export const coachingAnalyzeRequestSchema = z.object({
  handId: z.string().min(1).optional(),
  userId: z.string().min(1),
  handHistory: z.array(handHistoryEntrySchema).min(1),
  userHand: z.tuple([cardSchema, cardSchema]),
  dnHand: z.tuple([cardSchema, cardSchema]),
  board: z.tuple([cardSchema, cardSchema, cardSchema, cardSchema, cardSchema]),
  winner: z.enum(["user", "dn", "split"]),
  pot: z.number().int().positive(),
  userRank: z.string().min(1).optional(),
  dnRank: z.string().min(1).optional(),
  userMistakeProfile: z.array(mistakeProfileEntrySchema).default([])
});

export const mistakeExtractionSchema = z.discriminatedUnion("exists", [
  z.object({ exists: z.literal(false) }),
  z.object({
    exists: z.literal(true),
    pattern: z.string().min(1),
    severity: z.enum(["low", "medium", "high"])
  })
]);

export type CoachingAnalyzeInput = z.infer<typeof coachingAnalyzeRequestSchema>;

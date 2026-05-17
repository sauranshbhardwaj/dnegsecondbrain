import type { ClaudeClient } from "../claude/client.js";
import type { CoachingAnalyzeRequest, MistakeExtraction } from "./types.js";
import { mistakeExtractionSchema } from "./validation.js";
import type { MistakeExtractor } from "./extractor.js";

const EXTRACTION_SYSTEM_PROMPT = `You extract a single primary poker mistake pattern from Daniel Negreanu-style hand coaching.
Your job is to preserve mistake memory. If the coaching names a leak, problem, mistake, repeated pattern, or "same pattern again", extract it.
Return only valid JSON. Do not include markdown, code fences, commentary, or extra keys.`;

export class ClaudeMistakeExtractor implements MistakeExtractor {
  constructor(private readonly claudeClient: ClaudeClient) {}

  async extract(analysis: string, request: CoachingAnalyzeRequest): Promise<MistakeExtraction> {
    const raw = await this.claudeClient.completeText({
      systemPrompt: EXTRACTION_SYSTEM_PROMPT,
      userPrompt: buildMistakeExtractionPrompt(analysis, request),
      maxTokens: 150
    });

    const parsed = parseMistakeExtraction(raw);
    if (parsed.exists) {
      return parsed;
    }
    return inferMistakeFromAnalysis(analysis, request) ?? inferMistakeFromHand(request);
  }
}

export function buildMistakeExtractionPrompt(analysis: string, request: CoachingAnalyzeRequest): string {
  return `Based on this hand analysis, extract the primary mistake pattern if one exists.
Return ONLY valid JSON, no other text:
{"exists": true, "pattern": "brief description", "severity": "low|medium|high"}
If no clear mistake was made, return {"exists": false}.

Extraction rules:
- Return {"exists": true, ...} if the analysis says "same pattern", "pattern again", "leak", "problem", "mistake", "should have", or clearly says what the user did wrong.
- Return {"exists": true, ...} if the analysis references any previous mistake pattern below, even if it paraphrases the pattern.
- Return {"exists": false} only when the analysis says the user's play was reasonable and does not identify a strategic leak.
- Prefer concise habit names like "paying off river pressure with medium-strength hands" or "over-folding to 4-bet pressure".

Examples:
Analysis: "This is that same pattern again -- paying off pressure with medium strength."
Output: {"exists": true, "pattern": "paying off river pressure with medium-strength hands", "severity": "high"}

Analysis: "This is that same over-fold-to-pressure pattern again. You 3-bet ace-king and folded to the 4-bet shove."
Output: {"exists": true, "pattern": "over-folding to 4-bet pressure", "severity": "high"}

Hand result:
- userId: ${request.userId}
- userHand: ${request.userHand.join(", ")}
- dnHand: ${request.dnHand.join(", ")}
- board: ${request.board.join(", ")}
- winner: ${request.winner}
- pot: ${request.pot}
- userRank: ${request.userRank ?? "not provided"}
- dnRank: ${request.dnRank ?? "not provided"}

Previous mistake profile:
${formatMistakeProfile(request)}

Analysis:
${analysis}`;
}

export function parseMistakeExtraction(raw: string): MistakeExtraction {
  try {
    const parsed: unknown = JSON.parse(raw.trim());
    return mistakeExtractionSchema.parse(parsed);
  } catch {
    return { exists: false };
  }
}

export function inferMistakeFromAnalysis(
  analysis: string,
  request: CoachingAnalyzeRequest
): MistakeExtraction | undefined {
  const normalized = normalize(analysis);
  const hasMistakeSignal =
    /\b(same pattern|pattern again|leak|problem|mistake|should have|went sideways|textbook)\b/.test(normalized);

  if (!hasMistakeSignal) {
    return undefined;
  }

  if (/pay\w* off/.test(normalized) && /river|pressure|medium strength|medium-strength/.test(normalized)) {
    return {
      exists: true,
      pattern: "paying off river pressure with medium-strength hands",
      severity: "high"
    };
  }

  if (/over fold|overfold|over-fold|fold.*4 bet|fold.*4-bet|4 bet.*fold|4-bet.*fold/.test(normalized)) {
    return {
      exists: true,
      pattern: "over-folding to 4-bet pressure",
      severity: "high"
    };
  }

  if (/sizing leak|oversized|over sized/.test(normalized) && /one pair|one-pair/.test(normalized)) {
    return {
      exists: true,
      pattern: "oversizing one-pair hands",
      severity: "medium"
    };
  }

  if (/semi bluff|semi-bluff/.test(normalized) && /pure bluff|second barrel|barrel/.test(normalized)) {
    return {
      exists: true,
      pattern: "barreling missed draws without enough fold equity",
      severity: "medium"
    };
  }

  const profileMatch = bestProfileMatch(normalized, request);
  if (profileMatch) {
    return {
      exists: true,
      pattern: profileMatch.pattern,
      severity: profileMatch.severity
    };
  }

  return { exists: false };
}

export function inferMistakeFromHand(request: CoachingAnalyzeRequest): MistakeExtraction {
  if (calledRiverPressureAndLost(request)) {
    return {
      exists: true,
      pattern: "calling river pressure with marginal hands",
      severity: "high"
    };
  }

  if (foldedStrongPreflopAfterReraising(request)) {
    return {
      exists: true,
      pattern: "over-folding strong preflop hands after investing chips",
      severity: "high"
    };
  }

  if (overbuiltOnePairPot(request)) {
    return {
      exists: true,
      pattern: "oversizing one-pair hands",
      severity: "medium"
    };
  }

  if (barreledMissedDraw(request)) {
    return {
      exists: true,
      pattern: "barreling missed draws without enough fold equity",
      severity: "medium"
    };
  }

  if (checkedDownPassively(request)) {
    return {
      exists: true,
      pattern: "passive checkdowns with weak holdings",
      severity: "low"
    };
  }

  return { exists: false };
}

function formatMistakeProfile(request: CoachingAnalyzeRequest): string {
  if (request.userMistakeProfile.length === 0) {
    return "- No previous mistake patterns.";
  }

  return request.userMistakeProfile
    .map((mistake) => `- ${mistake.pattern} (${mistake.severity}, frequency ${mistake.frequency})`)
    .join("\n");
}

function bestProfileMatch(
  normalizedAnalysis: string,
  request: CoachingAnalyzeRequest
): { pattern: string; severity: "low" | "medium" | "high" } | undefined {
  for (const mistake of request.userMistakeProfile) {
    const tokens = normalize(mistake.pattern)
      .split(" ")
      .filter((token) => token.length >= 5);
    const hits = tokens.filter((token) => normalizedAnalysis.includes(token)).length;
    if (hits >= 2) {
      return { pattern: mistake.pattern, severity: mistake.severity };
    }
  }
  return undefined;
}

function calledRiverPressureAndLost(request: CoachingAnalyzeRequest): boolean {
  if (request.winner !== "dn") {
    return false;
  }

  const lastUserAction = [...request.handHistory].reverse().find((entry) => entry.actor === "user");
  if (!lastUserAction || lastUserAction.action !== "call" || !isRiver(lastUserAction)) {
    return false;
  }

  const previousPressure = [...request.handHistory]
    .reverse()
    .find((entry) => entry.actor === "dn" && isRiver(entry) && entry.action === "raise");

  return Boolean(previousPressure);
}

function foldedStrongPreflopAfterReraising(request: CoachingAnalyzeRequest): boolean {
  const lastUserAction = [...request.handHistory].reverse().find((entry) => entry.actor === "user");
  if (!lastUserAction || lastUserAction.action !== "fold" || !isPreflop(lastUserAction)) {
    return false;
  }

  const userReraised = request.handHistory.some(
    (entry) => entry.actor === "user" && entry.action === "raise" && isPreflop(entry)
  );
  const facedReraise = request.handHistory.some(
    (entry) => entry.actor === "dn" && entry.action === "raise" && isPreflop(entry) && (entry.amount ?? 0) >= request.pot * 0.5
  );

  return userReraised && facedReraise && isStrongPreflopHand(request.userHand);
}

function overbuiltOnePairPot(request: CoachingAnalyzeRequest): boolean {
  if (request.winner !== "dn") {
    return false;
  }

  const noteSaysOversized = request.handHistory.some(
    (entry) => entry.actor === "user" && /oversized|over sized|too big|one-pair|one pair/i.test(entry.note ?? "")
  );
  const userMadeOnePair = /one pair/i.test(request.userRank ?? "");
  const largeUserRaise = request.handHistory.some(
    (entry) => entry.actor === "user" && entry.action === "raise" && !isPreflop(entry) && (entry.amount ?? 0) >= Math.max(250, request.pot * 0.25)
  );

  return (noteSaysOversized || userMadeOnePair) && largeUserRaise;
}

function barreledMissedDraw(request: CoachingAnalyzeRequest): boolean {
  if (request.winner !== "dn") {
    return false;
  }

  const aggressivePostflopActions = request.handHistory.filter(
    (entry) => entry.actor === "user" && entry.action === "raise" && !isPreflop(entry)
  );
  const noteMentionsDraw = request.handHistory.some(
    (entry) => entry.actor === "user" && /draw|semi bluff|semi-bluff|barrel/i.test(entry.note ?? "")
  );

  return aggressivePostflopActions.length >= 2 && (noteMentionsDraw || hadFlopFlushDraw(request));
}

function checkedDownPassively(request: CoachingAnalyzeRequest): boolean {
  const lastUserAction = [...request.handHistory].reverse().find((entry) => entry.actor === "user");
  if (lastUserAction?.action !== "check") {
    return false;
  }

  const postflopChecks = request.handHistory.filter(
    (entry) => entry.actor === "user" && entry.action === "check" && !isPreflop(entry)
  );
  const postflopBets = request.handHistory.filter(
    (entry) => entry.actor === "user" && entry.action === "raise" && !isPreflop(entry)
  );

  return postflopChecks.length >= 2 && postflopBets.length === 0;
}

function hadFlopFlushDraw(request: CoachingAnalyzeRequest): boolean {
  const flop = request.board.slice(0, 3);
  return request.userHand.some((card) => {
    const suit = card[1];
    const suitedFlopCards = flop.filter((boardCard) => boardCard[1] === suit).length;
    return suitedFlopCards >= 2;
  });
}

function isStrongPreflopHand(hand: readonly [string, string]): boolean {
  const ranks = hand.map((card) => rankValue(card[0])).sort((left, right) => right - left);
  const pair = ranks[0] === ranks[1];

  return pair && ranks[0] >= 10 || ranks[0] === 14 && ranks[1] >= 12;
}

function rankValue(rank: string): number {
  const values: Record<string, number> = {
    A: 14,
    K: 13,
    Q: 12,
    J: 11,
    T: 10
  };

  return values[rank] ?? Number(rank);
}

function isPreflop(entry: { state?: string; street?: number }): boolean {
  return entry.state === "PREFLOP" || entry.street === 1;
}

function isRiver(entry: { state?: string; street?: number }): boolean {
  return entry.state === "RIVER" || entry.street === 4;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\*\*/g, "")
    .replace(/[-–—]/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

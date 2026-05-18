import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { CoachingAnalyzeRequest, MistakeProfileEntry, PromptBundle, WikiArticle } from "./types.js";
import { loadWikiArticles, selectWikiSlugs } from "./wiki.js";

const API_PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function buildPromptBundle(request: CoachingAnalyzeRequest): Promise<PromptBundle> {
  const repoRoot = await findRepoRoot();
  const persona = await readFile(path.join(repoRoot, "CLAUDE.md"), "utf8");
  const selectedArticles = await loadWikiArticles(selectWikiSlugs(request), repoRoot);
  const mistakeProfileSummary = summarizeMistakeProfile(request.userMistakeProfile);

  return {
    systemPrompt: buildSystemPrompt(persona, selectedArticles, mistakeProfileSummary),
    userPrompt: buildUserPrompt(request),
    selectedArticles,
    mistakeProfileSummary
  };
}

export function buildSystemPrompt(
  persona: string,
  selectedArticles: WikiArticle[],
  mistakeProfileSummary: string
): string {
  const articleBlock = selectedArticles
    .map((article) => `## Wiki Article: ${article.title}\n\n${article.content.trim()}`)
    .join("\n\n---\n\n");

  return [
    persona.trim(),
    "# Relevant Wiki Context",
    articleBlock,
    "# User Mistake Profile",
    mistakeProfileSummary
  ].join("\n\n");
}

export function buildUserPrompt(request: CoachingAnalyzeRequest): string {
  const handHistory = JSON.stringify(request.handHistory, null, 2);

  return `Here is the complete hand history: ${handHistory}
Card notation uses rank + suit: c=clubs, d=diamonds, h=hearts, s=spades. Same suit hole cards are suited, not offsuit.
The user held ${formatCards(request.userHand)}, you held ${formatCards(request.dnHand)}, board ran out ${formatCards(request.board)}.
${formatWinner(request.winner)} won the pot of ${request.pot}.
${formatShowdownFacts(request)}

Analyze this hand in your voice. Cover:
1. Your own decision-making this hand (1-2 sentences)
2. The key decision point for the user and what they should have done
3. If this matches any pattern from their mistake history, call it out directly
4. One concrete takeaway they can apply immediately

Keep the response under 120 words. Be direct and specific. One observation about your own play, one clear mistake the user made, one concrete fix. No more than 3 short paragraphs.`;
}

export function summarizeMistakeProfile(profile: MistakeProfileEntry[]): string {
  if (profile.length === 0) {
    return "This player has no previously recorded mistake patterns.";
  }

  const lines = profile
    .slice()
    .sort((left, right) => severityWeight(right.severity) - severityWeight(left.severity) || right.frequency - left.frequency)
    .map((mistake) => {
      return `- ${mistake.pattern} (${mistake.severity}, frequency ${mistake.frequency}, first seen ${mistake.firstSeen}, last seen ${mistake.lastSeen})`;
    });

  return `This player has previously shown these patterns:\n${lines.join("\n")}`;
}

export async function findRepoRoot(start = process.cwd()): Promise<string> {
  const candidates = [process.env.COACHING_PROMPT_ROOT, start, API_PACKAGE_ROOT].filter(
    (candidate): candidate is string => Boolean(candidate)
  );
  const searched = new Set<string>();

  for (const candidate of candidates) {
    const root = await findNearestPromptRoot(candidate, searched);
    if (root) {
      return root;
    }
  }

  throw new Error("Could not find prompt root containing CLAUDE.md");
}

async function findNearestPromptRoot(start: string, searched: Set<string>): Promise<string | null> {
  let current = path.resolve(start);
  while (true) {
    if (searched.has(current)) {
      return null;
    }
    searched.add(current);

    try {
      await readFile(path.join(current, "CLAUDE.md"), "utf8");
      return current;
    } catch {
      const parent = path.dirname(current);
      if (parent === current) {
        return null;
      }
      current = parent;
    }
  }
}

function formatCards(cards: readonly string[]): string {
  return `[${cards.map(formatCard).join(", ")}]`;
}

function formatWinner(winner: CoachingAnalyzeRequest["winner"]): string {
  if (winner === "dn") {
    return "dn";
  }
  if (winner === "user") {
    return "user";
  }
  return "split";
}

function formatShowdownFacts(request: CoachingAnalyzeRequest): string {
  if (request.userRank && request.dnRank) {
    return `Authoritative showdown evaluation: user made ${request.userRank}; you made ${request.dnRank}. Do not contradict these hand classes or the winner.`;
  }
  return "The winner field is authoritative. Do not contradict the stated winner.";
}

function severityWeight(severity: MistakeProfileEntry["severity"]): number {
  if (severity === "high") {
    return 3;
  }
  if (severity === "medium") {
    return 2;
  }
  return 1;
}

function formatCard(card: string): string {
  return `${card} (${rankName(card[0])} of ${suitName(card[1])})`;
}

function rankName(rank: string): string {
  const names: Record<string, string> = {
    A: "ace",
    K: "king",
    Q: "queen",
    J: "jack",
    T: "ten"
  };
  return names[rank] ?? rank;
}

function suitName(suit: string): string {
  const names: Record<string, string> = {
    c: "clubs",
    d: "diamonds",
    h: "hearts",
    s: "spades"
  };
  return names[suit] ?? suit;
}

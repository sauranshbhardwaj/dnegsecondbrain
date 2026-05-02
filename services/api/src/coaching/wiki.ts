import { readFile } from "node:fs/promises";
import path from "node:path";

import type { CoachingAnalyzeRequest, WikiArticle } from "./types.js";

type ArticleRule = {
  slug: string;
  file: string;
  keywords: string[];
};

const ARTICLE_RULES: ArticleRule[] = [
  {
    slug: "three-bet-strategy",
    file: "three-bet-strategy.md",
    keywords: ["3-bet", "three-bet", "3bet", "reraise", "re-raise", "preflop"]
  },
  {
    slug: "river-play-and-bet-sizing",
    file: "river-play-and-bet-sizing.md",
    keywords: ["river", "overbet", "thin value", "bluff catch", "bluff-catch"]
  },
  {
    slug: "bet-sizing-principles",
    file: "bet-sizing-principles.md",
    keywords: ["bet", "raise", "sizing", "pot", "overbet", "blocker"]
  },
  {
    slug: "bluffing-philosophy-and-semi-bluffs",
    file: "bluffing-philosophy-and-semi-bluffs.md",
    keywords: ["bluff", "semi-bluff", "draw", "missed draw"]
  },
  {
    slug: "reading-opponent-ranges",
    file: "reading-opponent-ranges.md",
    keywords: ["range", "line", "story", "call", "fold"]
  },
  {
    slug: "check-raise-strategy",
    file: "check-raise-strategy.md",
    keywords: ["check-raise", "check raise", "raise"]
  },
  {
    slug: "continuation-betting",
    file: "continuation-betting.md",
    keywords: ["continuation", "c-bet", "cbet", "flop"]
  },
  {
    slug: "heads-up-dynamics-and-adjustments",
    file: "heads-up-dynamics-and-adjustments.md",
    keywords: ["heads-up", "blind", "button", "wide", "defend"]
  },
  {
    slug: "mental-game",
    file: "mental-game.md",
    keywords: ["tilt", "frustration", "bad beat", "revenge", "emotion"]
  },
  {
    slug: "small-ball-poker",
    file: "small-ball-poker.md",
    keywords: ["small ball", "pot control", "small", "probe"]
  },
  {
    slug: "how-dn-thinks-about-variance",
    file: "how-dn-thinks-about-variance.md",
    keywords: ["variance", "bad beat", "suckout", "unlucky"]
  },
  {
    slug: "exploitative-vs-gto",
    file: "exploitative-vs-gto.md",
    keywords: ["gto", "exploit", "pattern", "tendency"]
  },
  {
    slug: "live-reads-and-physical-tells",
    file: "live-reads-and-physical-tells.md",
    keywords: ["timing", "tell", "read", "pattern"]
  },
  {
    slug: "icm-and-tournament-survival",
    file: "icm-and-tournament-survival.md",
    keywords: ["icm", "tournament", "survival", "pay jump"]
  },
  {
    slug: "game-selection-and-table-dynamics",
    file: "game-selection-and-table-dynamics.md",
    keywords: ["table", "dynamic", "image", "adjust"]
  }
];

const FALLBACK_SLUGS = ["small-ball-poker", "reading-opponent-ranges", "mental-game"];

export function selectWikiSlugs(request: CoachingAnalyzeRequest, count = 3): string[] {
  const text = searchableText(request);
  const scores = ARTICLE_RULES.map((rule, index) => {
    const score = rule.keywords.reduce((total, keyword) => {
      return total + (text.includes(keyword.toLowerCase()) ? 1 : 0);
    }, 0);
    return { slug: rule.slug, score, index };
  });

  for (const slug of boardTextureSlugs(request)) {
    const entry = scores.find((score) => score.slug === slug);
    if (entry) {
      entry.score += 2;
    }
  }

  const selected = scores
    .filter((score) => score.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((score) => score.slug);

  for (const fallback of FALLBACK_SLUGS) {
    if (!selected.includes(fallback)) {
      selected.push(fallback);
    }
  }

  return selected.slice(0, count);
}

export async function loadWikiArticles(slugs: string[], repoRoot: string): Promise<WikiArticle[]> {
  const bySlug = new Map(ARTICLE_RULES.map((rule) => [rule.slug, rule]));

  return Promise.all(
    slugs.map(async (slug) => {
      const rule = bySlug.get(slug);
      if (!rule) {
        throw new Error(`Unknown wiki article slug: ${slug}`);
      }
      const content = await readFile(path.join(repoRoot, "wiki", rule.file), "utf8");
      return {
        slug,
        title: extractTitle(content),
        content
      };
    })
  );
}

function searchableText(request: CoachingAnalyzeRequest): string {
  const history = request.handHistory
    .map((entry) => [entry.actor, entry.action, entry.state, entry.street, entry.amount, entry.pot, entry.note].join(" "))
    .join(" ");
  const mistakes = request.userMistakeProfile
    .map((mistake) => `${mistake.pattern} ${mistake.severity}`)
    .join(" ");
  return `${history} ${mistakes} ${request.winner} ${request.pot}`.toLowerCase();
}

function boardTextureSlugs(request: CoachingAnalyzeRequest): string[] {
  const [flopA, flopB, flopC] = request.board;
  const suits = request.board.map((card) => card[1]);
  const ranks = request.board.map((card) => card[0]);
  const slugs: string[] = [];

  if (new Set(suits.slice(0, 3)).size <= 2) {
    slugs.push("bluffing-philosophy-and-semi-bluffs");
  }
  if (new Set(ranks).size < ranks.length) {
    slugs.push("reading-opponent-ranges");
  }
  if (isConnected([flopA, flopB, flopC])) {
    slugs.push("check-raise-strategy");
  }
  if (request.handHistory.some((entry) => entry.state === "RIVER" || entry.street === 4)) {
    slugs.push("river-play-and-bet-sizing");
  }
  return slugs;
}

function isConnected(cards: string[]): boolean {
  const values = cards.map((card) => "23456789TJQKA".indexOf(card[0]) + 2).sort((a, b) => a - b);
  return values[2] - values[0] <= 4;
}

function extractTitle(content: string): string {
  const firstLine = content.split("\n")[0] ?? "";
  return firstLine.replace(/^#\s*/, "").trim();
}

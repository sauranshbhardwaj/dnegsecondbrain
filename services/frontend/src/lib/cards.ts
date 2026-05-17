export type DisplayCard = {
  code: string;
  rank: string;
  suit: string;
  isRed: boolean;
  hidden: boolean;
};

const SUITS: Record<string, { symbol: string; isRed: boolean }> = {
  c: { symbol: "♣", isRed: false },
  d: { symbol: "♦", isRed: true },
  h: { symbol: "♥", isRed: true },
  s: { symbol: "♠", isRed: false }
};

export function formatChips(amount: number): string {
  return new Intl.NumberFormat("en-US").format(amount);
}

export function toDisplayCard(code: string | undefined): DisplayCard {
  if (!code || code === "hidden") {
    return {
      code: "hidden",
      rank: "",
      suit: "",
      isRed: false,
      hidden: true
    };
  }

  const rank = code.slice(0, -1);
  const suitCode = code.slice(-1).toLowerCase();
  const suit = SUITS[suitCode] ?? { symbol: suitCode, isRed: false };

  return {
    code,
    rank,
    suit: suit.symbol,
    isRed: suit.isRed,
    hidden: false
  };
}

export function cardLabel(code: string | undefined): string {
  const card = toDisplayCard(code);
  if (card.hidden) {
    return "Face-down card";
  }

  return `${card.rank}${card.suit}`;
}

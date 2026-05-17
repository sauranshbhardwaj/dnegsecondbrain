"use client";

import { useMemo, useState } from "react";

const GLOSSARY = {
  "3-bet": "Re-raising before the flop, buddy. Someone raises, you re-raise. It says, “I’m not messing around.”",
  "pot odds": "The math of whether a call makes sense. If the pot is 100 and it costs you 20 to call, you’re getting 5-to-1.",
  "value bet": "Betting because you think you have the best hand and want to get paid. Not a bluff. Real hand, real money.",
  "check-raise": "Checking first, then raising after the other player bets. It is a trap when used well and a leak when used scared.",
  "continuation bet": "The preflop raiser keeps betting on the flop. Sometimes it is strength, sometimes it is just pressure.",
  range: "The set of hands a player can reasonably have. Do not put them on one exact hand too early, pal.",
  equity: "Your share of the pot in the long run if the hand played out from here.",
  ICM: "Tournament math for how chips convert to prize money. One chip won is not always worth one chip lost.",
  "semi-bluff": "A bluff with backup. You may not have the best hand now, but you can improve if called.",
  blocker: "A card in your hand that makes it less likely the other player has a specific strong hand.",
  "fold equity": "The value you get when a bet can make the other player fold. Sometimes the fold is the whole point.",
  "implied odds": "The money you expect to win later if you hit your hand. The future matters, but do not invent it.",
  polarized: "A range made of very strong hands and bluffs, with the medium stuff mostly missing.",
  nuts: "The best possible hand right now. When you have it, the question is how to get paid."
} as const;

const TERMS = Object.keys(GLOSSARY).sort((left, right) => right.length - left.length);
const TERM_PATTERN = new RegExp(`\\b(${TERMS.map(escapeRegExp).join("|")})\\b`, "gi");

export function GlossaryText({ text }: { text: string }) {
  const paragraphs = text.split(/\n+/).filter(Boolean);

  return (
    <div className="space-y-4">
      {paragraphs.map((paragraph, index) => (
        <p key={`${index}-${paragraph.slice(0, 20)}`}>
          <GlossaryParagraph text={paragraph} />
        </p>
      ))}
    </div>
  );
}

function GlossaryParagraph({ text }: { text: string }) {
  const parts = useMemo(() => splitGlossaryText(text), [text]);

  return (
    <>
      {parts.map((part, index) =>
        part.definition ? (
          <GlossaryTerm key={`${part.text}-${index}`} term={part.text} definition={part.definition} />
        ) : (
          <span key={`${part.text}-${index}`}>{part.text}</span>
        )
      )}
    </>
  );
}

function GlossaryTerm({ definition, term }: { definition: string; term: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="group relative inline-block">
      <button
        type="button"
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((value) => !value)}
        className="border-b border-dotted border-[color:var(--color-gold)] bg-transparent p-0 text-left text-[color:var(--color-gold)]"
      >
        {term}
      </button>
      <span
        role="tooltip"
        className={`pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-max max-w-[240px] -translate-x-1/2 rounded-[var(--radius-md)] border border-[color:var(--color-gold)] bg-[color:var(--color-surface)] px-3 py-2 text-left font-sans text-[13px] leading-5 text-[color:var(--color-text-primary)] shadow-lift transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 ${
          open ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        {definition}
      </span>
    </span>
  );
}

function splitGlossaryText(text: string): Array<{ text: string; definition?: string }> {
  const parts: Array<{ text: string; definition?: string }> = [];
  let lastIndex = 0;

  for (const match of text.matchAll(TERM_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, index) });
    }

    const matchedText = match[0];
    const canonicalTerm = TERMS.find((term) => term.toLowerCase() === matchedText.toLowerCase());
    parts.push({
      text: matchedText,
      definition: canonicalTerm ? GLOSSARY[canonicalTerm as keyof typeof GLOSSARY] : undefined
    });
    lastIndex = index + matchedText.length;
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex) });
  }

  return parts;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

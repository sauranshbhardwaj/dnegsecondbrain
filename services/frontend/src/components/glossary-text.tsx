"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";

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
const TOOLTIP_GUTTER = 16;
const TOOLTIP_OFFSET = 8;

type TooltipPosition = {
  left: number;
  top: number;
};

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
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const tooltipRef = useRef<HTMLSpanElement | null>(null);
  const lastPointerType = useRef<string | null>(null);
  const tooltipId = useId();

  const updateTooltipPosition = useCallback(() => {
    const button = buttonRef.current;
    const tooltip = tooltipRef.current;
    if (!button || !tooltip) {
      return;
    }

    const buttonRect = button.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const maxLeft = window.innerWidth - tooltipRect.width - TOOLTIP_GUTTER;
    const centeredLeft = buttonRect.left + buttonRect.width / 2 - tooltipRect.width / 2;
    const left = clamp(centeredLeft, TOOLTIP_GUTTER, maxLeft);
    const topAbove = buttonRect.top - tooltipRect.height - TOOLTIP_OFFSET;
    const topBelow = buttonRect.bottom + TOOLTIP_OFFSET;
    const maxTop = window.innerHeight - tooltipRect.height - TOOLTIP_GUTTER;
    const top = topAbove >= TOOLTIP_GUTTER ? topAbove : clamp(topBelow, TOOLTIP_GUTTER, maxTop);

    setTooltipPosition({ left, top });
  }, []);

  const showTooltip = useCallback(() => {
    setOpen(true);
  }, []);

  const hideTooltip = useCallback(() => {
    setOpen(false);
    setTooltipPosition(null);
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    updateTooltipPosition();
    const frame = window.requestAnimationFrame(updateTooltipPosition);
    return () => window.cancelAnimationFrame(frame);
  }, [open, updateTooltipPosition]);

  useEffect(() => {
    if (!open) {
      return;
    }

    window.addEventListener("resize", updateTooltipPosition);
    window.addEventListener("scroll", updateTooltipPosition, true);
    return () => {
      window.removeEventListener("resize", updateTooltipPosition);
      window.removeEventListener("scroll", updateTooltipPosition, true);
    };
  }, [open, updateTooltipPosition]);

  return (
    <span className="inline">
      <button
        ref={buttonRef}
        type="button"
        aria-describedby={open ? tooltipId : undefined}
        onBlur={hideTooltip}
        onClick={() => {
          if (lastPointerType.current !== "mouse") {
            showTooltip();
          }
        }}
        onFocus={showTooltip}
        onPointerDown={(event) => {
          lastPointerType.current = event.pointerType;
        }}
        onPointerEnter={(event) => {
          lastPointerType.current = event.pointerType;
          if (event.pointerType === "mouse") {
            showTooltip();
          }
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") {
            hideTooltip();
          }
        }}
        className="border-b border-dotted border-[color:var(--color-gold)] bg-transparent p-0 text-left text-[color:var(--color-gold)]"
      >
        {term}
      </button>
      {open ? (
        <span
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none fixed z-50 w-[min(17.5rem,calc(100vw-2rem))] rounded-[var(--radius-md)] border border-[color:var(--color-gold)] bg-[color:var(--color-surface)] px-3 py-2 text-left font-sans text-[13px] leading-5 text-[color:var(--color-text-primary)] shadow-lift"
          style={{
            left: tooltipPosition?.left ?? 0,
            top: tooltipPosition?.top ?? 0,
            visibility: tooltipPosition ? "visible" : "hidden"
          }}
        >
          {definition}
        </span>
      ) : null}
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

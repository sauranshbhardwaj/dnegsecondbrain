"use client";

import { useEffect, useMemo, useState } from "react";

type HeroTypewriterTextProps = {
  className?: string;
  durationMs?: number;
  paragraphs: string[];
};

function getVisibleParagraphs(paragraphs: string[], visibleCharacters: number) {
  let remainingCharacters = visibleCharacters;

  return paragraphs.map((paragraph) => {
    if (remainingCharacters <= 0) {
      return "";
    }

    const visibleParagraph = paragraph.slice(0, remainingCharacters);
    remainingCharacters -= paragraph.length + 1;
    return visibleParagraph;
  });
}

export function HeroTypewriterText({ className = "", durationMs = 3500, paragraphs }: HeroTypewriterTextProps) {
  const [visibleCharacters, setVisibleCharacters] = useState(0);
  const fullText = useMemo(() => paragraphs.join("\n"), [paragraphs]);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const totalCharacters = fullText.length;

    if (reduceMotion || totalCharacters === 0) {
      setVisibleCharacters(totalCharacters);
      return;
    }

    let animationFrame = 0;
    const startedAt = performance.now();

    const animate = (now: number) => {
      const progress = Math.min((now - startedAt) / durationMs, 1);
      const nextVisibleCharacters = Math.floor(progress * totalCharacters);

      setVisibleCharacters(nextVisibleCharacters);

      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(animate);
      } else {
        setVisibleCharacters(totalCharacters);
      }
    };

    animationFrame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [durationMs, fullText]);

  const visibleParagraphs = getVisibleParagraphs(paragraphs, visibleCharacters);

  return (
    <div className={`relative ${className}`}>
      <span className="sr-only">{fullText}</span>
      <div className="invisible space-y-4" aria-hidden="true">
        {paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
      <div className="absolute inset-0 space-y-4" aria-hidden="true" data-hero-typewriter-visible>
        {visibleParagraphs.map((paragraph, index) => (
          <p key={`${index}-${paragraphs[index]}`}>{paragraph}</p>
        ))}
      </div>
    </div>
  );
}

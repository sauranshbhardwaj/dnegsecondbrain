"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type OnboardingSlide = {
  title: string;
  body: [string, string] | string[];
};

export function OnboardingFlow({ slides }: { slides: OnboardingSlide[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentSlide = slides[currentIndex];
  const isFinalSlide = currentIndex === slides.length - 1;
  const progressLabel = useMemo(() => `Slide ${currentIndex + 1} of ${slides.length}`, [currentIndex, slides.length]);

  return (
    <main className="min-h-svh bg-[color:var(--color-bg)] text-[color:var(--color-text-primary)]">
      <div className="mx-auto flex min-h-svh w-full max-w-[980px] flex-col px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex items-center justify-between">
          <Link href="/" translate="no" className="group flex items-baseline gap-2 rounded-[var(--radius-sm)]">
            <span className="font-display text-[22px] font-semibold leading-none text-[color:var(--color-text-primary)] transition-colors group-hover:text-[color:var(--color-gold)]">
              Kid Poker
            </span>
            <span className="text-[13px] leading-none text-[color:var(--color-text-muted)]" aria-hidden="true">
              ·
            </span>
            <span className="text-[13px] font-normal uppercase leading-none tracking-[0.15em] text-[color:var(--color-text-muted)]">
              SECOND BRAIN
            </span>
          </Link>
          <Link
            href="/table"
            className="rounded-[var(--radius-sm)] px-2 py-1 text-sm font-medium text-[color:var(--color-text-secondary)] transition-colors hover:text-[color:var(--color-text-primary)]"
          >
            Skip
          </Link>
        </div>

        <section className="grid flex-1 place-items-center py-16">
          <div className="w-full max-w-[680px]">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-[color:var(--color-gold)]">{progressLabel}</p>
            <h1 className="mt-6 font-display text-[44px] font-bold leading-[1.05] text-[color:var(--color-text-primary)] [text-wrap:balance] sm:text-[64px]">
              {currentSlide.title}
            </h1>
            <div className="mt-8 max-w-[620px] space-y-5 text-lg leading-[1.75] text-[color:var(--color-text-secondary)] sm:text-xl">
              {currentSlide.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
        </section>

        <div className="flex items-center justify-between gap-6 border-t border-[color:var(--color-border)] pt-6">
          <div className="flex items-center gap-2" aria-label={progressLabel}>
            {slides.map((slide, index) => (
              <button
                key={slide.title}
                type="button"
                aria-label={`Go to slide ${index + 1}`}
                aria-current={index === currentIndex ? "step" : undefined}
                onClick={() => setCurrentIndex(index)}
                className={`size-2.5 rounded-full transition-colors ${
                  index === currentIndex ? "bg-[color:var(--color-gold)]" : "bg-[color:var(--color-border)] hover:bg-[color:var(--color-text-muted)]"
                }`}
              />
            ))}
          </div>

          {isFinalSlide ? (
            <Link
              href="/table"
              className="rounded-[var(--radius-md)] bg-[color:var(--color-gold)] px-7 py-3 text-sm font-bold uppercase tracking-[0.08em] text-[color:var(--color-bg)] shadow-lift transition-colors hover:bg-[#d8b95c]"
            >
              Sit Down
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setCurrentIndex((index) => Math.min(index + 1, slides.length - 1))}
              className="rounded-[var(--radius-md)] bg-[color:var(--color-gold)] px-7 py-3 text-sm font-bold uppercase tracking-[0.08em] text-[color:var(--color-bg)] shadow-lift transition-colors hover:bg-[#d8b95c]"
            >
              Next
            </button>
          )}
        </div>
      </div>
    </main>
  );
}

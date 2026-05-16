"use client";

import Link from "next/link";
import { Show, SignUpButton } from "@clerk/nextjs";

type LandingActionsProps = {
  className?: string;
  centered?: boolean;
  note?: string;
};

export function LandingActions({
  className = "",
  centered = false,
  note
}: LandingActionsProps) {
  const buttonClassName =
    "inline-flex rounded-[var(--radius-md)] bg-[color:var(--color-gold)] px-10 py-4 text-base font-bold uppercase tracking-[0.08em] text-[color:var(--color-bg)] shadow-lift transition-colors duration-200 ease-out hover:bg-[#d8b95c]";

  return (
    <div className={`${centered ? "text-center" : ""} ${className}`}>
      <Show when="signed-out">
        <SignUpButton mode="modal" fallbackRedirectUrl="/onboarding" forceRedirectUrl="/onboarding">
          <button type="button" className={buttonClassName}>
            Sit Down
          </button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <Link href="/table" className={buttonClassName}>
          Sit Down
        </Link>
      </Show>
      {note ? <p className="mt-3 text-xs text-[color:var(--color-text-muted)]">{note}</p> : null}
    </div>
  );
}

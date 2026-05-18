"use client";

import { SignInButton } from "@clerk/nextjs";

export function AuthNav() {
  return (
    <nav aria-label="Primary" className="flex self-center items-center gap-4 text-sm text-[color:var(--color-text-secondary)] sm:gap-5">
      <SignInButton
        mode="modal"
        fallbackRedirectUrl="/table"
        forceRedirectUrl="/table"
        signUpFallbackRedirectUrl="/onboarding"
        signUpForceRedirectUrl="/onboarding"
      >
        <button type="button" className="border-0 bg-transparent p-0 text-sm font-normal leading-none text-[color:var(--color-text-secondary)] transition-colors hover:text-[color:var(--color-text-primary)]">
          Sign in
        </button>
      </SignInButton>
    </nav>
  );
}

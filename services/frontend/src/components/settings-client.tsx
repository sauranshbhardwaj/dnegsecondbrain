"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { MistakeProfileEntry, UserProfile } from "@/lib/game-types";

export function SettingsClient() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setProfile(await fetchJson<UserProfile>("/api/user/profile"));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const saveKey = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const result = await fetchJson<{ hasApiKey: boolean }>("/api/user/apikey", {
        method: "POST",
        body: JSON.stringify({ apiKey })
      });
      setProfile((current) => (current ? { ...current, hasApiKey: result.hasApiKey } : current));
      setApiKey("");
      setMessage("API key connected.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setIsSaving(false);
    }
  }, [apiKey]);

  const removeKey = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const result = await fetchJson<{ hasApiKey: boolean }>("/api/user/apikey", {
        method: "POST",
        body: JSON.stringify({ delete: true })
      });
      setProfile((current) => (current ? { ...current, hasApiKey: result.hasApiKey } : current));
      setMessage("API key removed.");
      setConfirmRemove(false);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setIsSaving(false);
    }
  }, []);

  return (
    <main className="min-h-svh bg-[color:var(--color-bg)] px-5 py-8 text-[color:var(--color-text-primary)] sm:px-8">
      <div className="mx-auto max-w-[1120px]">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[color:var(--color-border)] pb-6">
          <div>
            <Link href="/table" className="text-sm text-[color:var(--color-text-secondary)] transition-colors hover:text-[color:var(--color-text-primary)]">
              Back to table
            </Link>
            <h1 className="mt-4 font-display text-[40px] font-bold leading-tight text-[color:var(--color-text-primary)] sm:text-[56px]">
              Settings
            </h1>
          </div>
          {profile ? (
            <p className="font-mono text-sm tabular-nums text-[color:var(--color-gold)]">
              {Math.min(profile.freeHandsUsed, profile.freeHandsLimit)} / {profile.freeHandsLimit} free hands used
            </p>
          ) : null}
        </header>

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[var(--radius-xl)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-lift sm:p-8">
            <h2 className="text-base font-semibold text-[color:var(--color-text-primary)]">Daniel Negreanu&rsquo;s notes on you</h2>
            <p className="mt-1 text-[13px] text-[color:var(--color-text-muted)]">
              Permanent patterns from completed hands.
            </p>
            <div className="mt-7 space-y-4">
              {isLoading ? (
                <SettingsSkeleton />
              ) : profile && profile.mistakes.length > 0 ? (
                profile.mistakes.map((mistake) => <MistakeCard key={mistake.pattern} mistake={mistake} />)
              ) : (
                <p className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] p-5 text-sm leading-6 text-[color:var(--color-text-secondary)]">
                  No permanent notes yet. Play a few hands and the recurring patterns will show up here.
                </p>
              )}
            </div>
          </section>

          <section className="h-fit rounded-[var(--radius-xl)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-lift sm:p-8">
            <h2 className="text-base font-semibold text-[color:var(--color-text-primary)]">Anthropic API key</h2>
            <p className="mt-3 text-sm leading-6 text-[color:var(--color-text-secondary)]">
              Five hands are free. Connect your own key to keep playing unlimited hands, with your own Anthropic usage.
            </p>

            {profile?.hasApiKey ? (
              <div className="mt-6 rounded-[var(--radius-lg)] border border-[rgb(45_106_79_/_0.42)] bg-[rgb(45_106_79_/_0.16)] p-5">
                <p className="text-sm font-semibold text-[rgb(123_194_157)]">API key connected ✓</p>
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => (confirmRemove ? void removeKey() : setConfirmRemove(true))}
                  className="mt-4 rounded-[var(--radius-md)] border border-[color:var(--color-border)] px-4 py-3 text-sm font-bold uppercase tracking-[0.08em] text-[color:var(--color-text-primary)] transition-colors hover:border-[rgb(201_168_76_/_0.35)]"
                >
                  {confirmRemove ? "Confirm Remove" : "Remove"}
                </button>
                {confirmRemove ? <p className="mt-3 text-xs text-[color:var(--color-text-muted)]">Click again to remove the stored key.</p> : null}
              </div>
            ) : (
              <div className="mt-6">
                <label className="block text-sm font-medium text-[color:var(--color-text-primary)]" htmlFor="settings-api-key">
                  API key
                </label>
                <input
                  id="settings-api-key"
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  type="password"
                  placeholder="sk-ant-..."
                  className="mt-2 w-full rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-4 py-3 text-sm text-[color:var(--color-text-primary)] outline-none transition-colors focus:border-[color:var(--color-gold)]"
                />
                <button
                  type="button"
                  disabled={isSaving || apiKey.trim().length < 10}
                  onClick={() => void saveKey()}
                  className="mt-4 w-full rounded-[var(--radius-md)] bg-[color:var(--color-gold)] px-5 py-3 text-sm font-bold uppercase tracking-[0.08em] text-[color:var(--color-bg)] transition-colors hover:bg-[#d8b95c]"
                >
                  {isSaving ? "Saving" : "Save Key"}
                </button>
              </div>
            )}

            {message ? <p className="mt-4 text-sm text-[rgb(123_194_157)]">{message}</p> : null}
            {error ? <p className="mt-4 text-sm text-[rgb(222_120_134)]">{error}</p> : null}
          </section>
        </div>
      </div>
    </main>
  );
}

function MistakeCard({ mistake }: { mistake: MistakeProfileEntry }) {
  const severityClass =
    mistake.severity === "high"
      ? "bg-[color:var(--color-danger)]"
      : mistake.severity === "medium"
        ? "bg-[color:var(--color-gold-muted)]"
        : "bg-[color:var(--color-success)]";

  return (
    <article className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`size-2.5 shrink-0 rounded-full ${severityClass}`} aria-hidden="true" />
          <span className="sr-only">{mistake.severity} severity</span>
          <h3 className="text-sm font-semibold text-[color:var(--color-text-primary)]">{mistake.pattern}</h3>
        </div>
        <span className="rounded-[var(--radius-sm)] border border-[rgb(201_168_76_/_0.24)] px-2 py-1 font-mono text-xs tabular-nums text-[color:var(--color-gold)]">
          ×{mistake.frequency}
        </span>
      </div>
      <p className="mt-3 text-[13px] leading-6 text-[color:var(--color-text-secondary)]">
        Last seen {new Date(mistake.lastSeen).toLocaleDateString()} across {mistake.handsContext.length} tracked hand
        {mistake.handsContext.length === 1 ? "" : "s"}.
      </p>
    </article>
  );
}

function SettingsSkeleton() {
  return (
    <>
      <div className="h-[112px] animate-pulse rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-bg)]" />
      <div className="h-[112px] animate-pulse rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-bg)]" />
    </>
  );
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers
    },
    cache: "no-store"
  });

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string; error?: string; detail?: string };
      message = body.message ?? body.detail ?? body.error ?? message;
    } catch {
      // Keep status-based fallback.
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { GlossaryText } from "@/components/glossary-text";
import { formatChips, toDisplayCard } from "@/lib/cards";
import { buildCoachingPayload, callAmount, getRaiseBounds, hasCompleteTerminalContext, isActiveHand, isUserTurn, nextActionLabel, terminalPotAwarded } from "@/lib/game-helpers";
import type { CoachingStreamEvent, GameState, MistakeExtraction, PlayerAction, ShowdownResult, UserProfile } from "@/lib/game-types";
import { parseSseMessages } from "@/lib/sse";

const BOARD_SLOTS = Array.from({ length: 5 }, (_, index) => index);
const FREE_HANDS_FALLBACK = 5;

export function TableGameClient() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [raiseAmount, setRaiseAmount] = useState(0);
  const [isBooting, setIsBooting] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [tableError, setTableError] = useState<string | null>(null);
  const [coachingText, setCoachingText] = useState("");
  const [visibleCoachingText, setVisibleCoachingText] = useState("");
  const [coachingStatus, setCoachingStatus] = useState<"idle" | "thinking" | "streaming" | "done" | "error" | "rate_limited">("idle");
  const [coachingError, setCoachingError] = useState<string | null>(null);
  const [coachingMistake, setCoachingMistake] = useState<MistakeExtraction | null>(null);
  const [pastPatternMatch, setPastPatternMatch] = useState<string | null>(null);
  const [showRateLimitModal, setShowRateLimitModal] = useState(false);
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [evalRating, setEvalRating] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [evalFeedback, setEvalFeedback] = useState("");
  const [isSubmittingEval, setIsSubmittingEval] = useState(false);
  const [evalSubmitted, setEvalSubmitted] = useState(false);
  const coachedHandId = useRef<string | null>(null);
  const profileBeforeHand = useRef<UserProfile | null>(null);

  const raiseBounds = useMemo(() => getRaiseBounds(gameState), [gameState]);
  const amountToCall = callAmount(gameState);
  const handCounter = formatHandCounter(profile, gameState);
  const displayedPot = gameState && hasCompleteTerminalContext(gameState) ? terminalPotAwarded(gameState) : gameState?.pot ?? 0;
  const visibleBoardCards = useMemo(() => getVisibleBoardCards(gameState), [gameState]);
  const revealNegreanuCards = shouldRevealNegreanuCards(gameState);
  const negreanuCards = revealNegreanuCards ? gameState?.terminal?.dnHand ?? [] : ["hidden", "hidden"];
  const isHandComplete = gameState?.state === "COMPLETE";

  const loadProfile = useCallback(async () => {
    const nextProfile = await fetchJson<UserProfile>("/api/user/profile");
    setProfile(nextProfile);
    if (nextProfile.freeHandsUsed >= nextProfile.freeHandsLimit && !nextProfile.hasApiKey) {
      setShowRateLimitModal(true);
      setShowEvalModal(true);
    }
    return nextProfile;
  }, []);

  const loadCurrentOrNewHand = useCallback(async () => {
    const stateResponse = await fetch("/api/game/state", { cache: "no-store" });
    if (stateResponse.ok) {
      setGameState((await stateResponse.json()) as GameState);
      return;
    }

    const nextState = await fetchJson<GameState>("/api/game/new", { method: "POST" });
    setGameState(nextState);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setIsBooting(true);
      setTableError(null);
      try {
        await Promise.all([loadProfile(), loadCurrentOrNewHand()]);
      } catch (error) {
        if (!cancelled) {
          setTableError(errorMessage(error));
        }
      } finally {
        if (!cancelled) {
          setIsBooting(false);
        }
      }
    }

    void boot();

    return () => {
      cancelled = true;
    };
  }, [loadCurrentOrNewHand, loadProfile]);

  useEffect(() => {
    if (!profileBeforeHand.current && profile) {
      profileBeforeHand.current = profile;
    }
  }, [profile]);

  useEffect(() => {
    setRaiseAmount(raiseBounds.canRaise ? raiseBounds.minTotal : 0);
  }, [raiseBounds.canRaise, raiseBounds.minTotal]);

  const startNewHand = useCallback(async () => {
    setIsActing(true);
    setTableError(null);
    try {
      const currentProfile = await loadProfile();
      profileBeforeHand.current = currentProfile;
      const nextState = await fetchJson<GameState>("/api/game/new", { method: "POST" });
      setGameState(nextState);
      coachedHandId.current = null;
      setCoachingText("");
      setVisibleCoachingText("");
      setCoachingStatus("idle");
      setCoachingError(null);
      setCoachingMistake(null);
      setPastPatternMatch(null);
    } catch (error) {
      setTableError(errorMessage(error));
    } finally {
      setIsActing(false);
    }
  }, [loadProfile]);

  const resolveShowdownIfNeeded = useCallback(async (state: GameState) => {
    if (state.state !== "SHOWDOWN") {
      return state;
    }

    const result = await fetchJson<ShowdownResult>("/api/game/showdown", { method: "POST" });
    return result.gameState;
  }, []);

  const submitAction = useCallback(
    async (action: PlayerAction) => {
      if (!isUserTurn(gameState) || isActing) {
        return;
      }

      setIsActing(true);
      setTableError(null);
      try {
        const body = action === "raise" ? { action, amount: raiseAmount } : { action };
        const updated = await fetchJson<GameState>("/api/game/action", {
          method: "POST",
          body: JSON.stringify(body)
        });
        const settled = await resolveShowdownIfNeeded(updated);
        setGameState(settled);
      } catch (error) {
        setTableError(errorMessage(error));
      } finally {
        setIsActing(false);
      }
    },
    [gameState, isActing, raiseAmount, resolveShowdownIfNeeded]
  );

  const streamCoaching = useCallback(
    async (state: GameState) => {
      const baselineProfile = profileBeforeHand.current ?? profile;
      if (!baselineProfile || !hasCompleteTerminalContext(state)) {
        return;
      }

      setCoachingStatus("thinking");
      setCoachingError(null);
      setCoachingText("");
      setVisibleCoachingText("");
      setCoachingMistake(null);
      setPastPatternMatch(null);

      try {
        const response = await fetch("/api/coaching/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(buildCoachingPayload(state, baselineProfile.mistakes))
        });

        if (response.status === 402) {
          setCoachingStatus("rate_limited");
          setShowRateLimitModal(true);
          setShowEvalModal(true);
          await loadProfile();
          return;
        }

        if (!response.ok || !response.body) {
          let message = `Coaching failed with status ${response.status}`;
          try {
            const body = (await response.json()) as { message?: string; error?: string };
            message = body.message ?? body.error ?? message;
          } catch {
            // Keep status-based message.
          }
          throw new Error(message);
        }

        setCoachingStatus("streaming");
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const parsed = parseSseMessages<CoachingStreamEvent>(buffer);
          buffer = parsed.rest;

          for (const message of parsed.messages) {
            const event = message.data;
            switch (event.type) {
              case "chunk":
                setCoachingText((text) => text + event.text);
                break;
              case "mistake":
                setCoachingMistake(event.mistake);
                if (event.mistake.exists) {
                  setPastPatternMatch(findPastPattern(event.mistake.pattern, baselineProfile.mistakes));
                }
                break;
              case "done":
                setCoachingText(event.text);
                setCoachingStatus("done");
                break;
              case "error":
                throw new Error(event.message);
            }
          }
        }

        await loadProfile();
      } catch (error) {
        setCoachingStatus("error");
        setCoachingError(errorMessage(error));
      }
    },
    [loadProfile, profile]
  );

  useEffect(() => {
    if (!gameState || !hasCompleteTerminalContext(gameState) || coachedHandId.current === gameState.handId) {
      return;
    }

    coachedHandId.current = gameState.handId;
    void streamCoaching(gameState);
  }, [gameState, streamCoaching]);

  useEffect(() => {
    if (visibleCoachingText.length >= coachingText.length) {
      return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setVisibleCoachingText(coachingText);
      return;
    }

    const timeout = window.setTimeout(() => {
      setVisibleCoachingText(coachingText.slice(0, visibleCoachingText.length + 1));
    }, 12);

    return () => window.clearTimeout(timeout);
  }, [coachingText, visibleCoachingText]);

  const canAct = isUserTurn(gameState) && !isActing;
  const canFold = canAct && amountToCall > 0;
  const canCall = canAct;

  const saveApiKey = useCallback(async () => {
    setIsSavingApiKey(true);
    setApiKeyError(null);
    try {
      await fetchJson<{ hasApiKey: boolean }>("/api/user/apikey", {
        method: "POST",
        body: JSON.stringify({ apiKey: apiKeyInput })
      });
      setApiKeyInput("");
      setShowRateLimitModal(false);
      await loadProfile();
    } catch (error) {
      setApiKeyError(errorMessage(error));
    } finally {
      setIsSavingApiKey(false);
    }
  }, [apiKeyInput, loadProfile]);

  const submitEval = useCallback(async () => {
    if (!evalRating) {
      return;
    }

    setIsSubmittingEval(true);
    try {
      await fetchJson<{ ok: true }>("/api/user/eval", {
        method: "POST",
        body: JSON.stringify({
          rating: evalRating,
          feedback: evalFeedback.trim() || undefined,
          sessionId: gameState?.handId
        })
      });
      setEvalSubmitted(true);
      setShowEvalModal(false);
    } catch (error) {
      setTableError(errorMessage(error));
    } finally {
      setIsSubmittingEval(false);
    }
  }, [evalFeedback, evalRating, gameState?.handId]);

  const skipEval = useCallback(() => {
    setShowEvalModal(false);
    setEvalRating(null);
    setEvalFeedback("");
  }, []);

  return (
    <main className="min-h-svh bg-[color:var(--color-bg)] text-[color:var(--color-text-primary)]">
      <div className="mx-auto grid min-h-svh w-full max-w-[1500px] gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,1.42fr)_minmax(360px,0.58fr)] lg:px-8">
        <section className="felt-texture relative min-h-[620px] overflow-hidden rounded-[var(--radius-xl)] border border-[rgb(201_168_76_/_0.16)] shadow-table">
          <div className="absolute inset-5 rounded-[var(--radius-xl)] border border-dashed border-[rgb(201_168_76_/_0.18)]" aria-hidden="true" />
          <div className="absolute left-1/2 top-8 flex -translate-x-1/2 flex-col items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text-secondary)]">Daniel Negreanu</p>
            <HandCards cards={negreanuCards} hidden={!revealNegreanuCards} owner="Daniel Negreanu" />
          </div>

          <ChipStack className="right-6 top-8" label="Stack" amount={gameState?.dnStack ?? 0} align="end" variant="negreanu" />
          <ChipStack className="bottom-8 left-6" label="Your stack" amount={gameState?.userStack ?? 0} variant="user" />

          <div className="absolute left-1/2 top-[42%] flex w-full max-w-[440px] -translate-x-1/2 -translate-y-1/2 justify-center gap-2 px-4 sm:gap-3">
            {BOARD_SLOTS.map((slot) => (
              <PlayingCard key={`board-${slot}`} code={visibleBoardCards[slot]} label={`Community card ${slot + 1}`} placeholder />
            ))}
          </div>

          <div className="absolute left-1/2 top-[56%] -translate-x-1/2 rounded-[var(--radius-sm)] border border-[rgb(201_168_76_/_0.22)] bg-[rgb(10_10_10_/_0.76)] px-5 py-2 font-mono text-sm tabular-nums text-[color:var(--color-gold)] shadow-lift">
            Pot {formatChips(displayedPot)}
          </div>

          <div className="absolute bottom-9 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3">
            <HandCards cards={gameState?.userHand ?? []} owner="You" />
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text-secondary)]">You</p>
          </div>
        </section>

        <aside className="flex min-h-[620px] flex-col gap-4">
          <header className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <div>
              <p className="font-display text-2xl font-semibold text-[color:var(--color-text-primary)]">Heads-up table</p>
              <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">{handCounter}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowEvalModal(true)}
                className="rounded-[var(--radius-sm)] px-2 py-1 text-sm text-[color:var(--color-text-secondary)] transition-colors hover:text-[color:var(--color-text-primary)]"
              >
                Leave Table
              </button>
              <Link href="/settings" className="rounded-[var(--radius-sm)] px-2 py-1 text-sm text-[color:var(--color-text-secondary)] transition-colors hover:text-[color:var(--color-text-primary)]">
                Settings
              </Link>
            </div>
          </header>

          <section className="rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--color-gold)]">Action</p>
              <p className="text-xs text-[color:var(--color-text-muted)]">{gameStatus(gameState, isBooting)}</p>
            </div>
            {isHandComplete ? (
              <div className="mt-5">
                <div className="rounded-[var(--radius-md)] border border-[rgb(201_168_76_/_0.2)] bg-[rgb(201_168_76_/_0.08)] px-4 py-3 text-sm text-[color:var(--color-text-primary)]">
                  Hand complete
                </div>
                <button
                  type="button"
                  onClick={() => void startNewHand()}
                  disabled={isActing}
                  className="mt-3 w-full rounded-[var(--radius-md)] border border-[rgb(201_168_76_/_0.28)] px-4 py-3 text-sm font-bold uppercase tracking-[0.08em] text-[color:var(--color-gold)] transition-colors hover:bg-[rgb(201_168_76_/_0.1)]"
                >
                  New Hand
                </button>
              </div>
            ) : (
              <>
                <div className="mt-5 grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    disabled={!canFold}
                    onClick={() => void submitAction("fold")}
                    className="rounded-[var(--radius-md)] border border-[rgb(139_38_53_/_0.45)] px-4 py-3 text-sm font-bold uppercase tracking-[0.08em] text-[rgb(196_82_98)] transition-colors hover:bg-[rgb(139_38_53_/_0.14)] disabled:hover:bg-transparent"
                  >
                    Fold
                  </button>
                  <button
                    type="button"
                    disabled={!canCall}
                    onClick={() => void submitAction("call")}
                    className="rounded-[var(--radius-md)] border border-[color:var(--color-border)] px-4 py-3 text-sm font-bold uppercase tracking-[0.08em] text-[color:var(--color-text-primary)] transition-colors hover:border-[rgb(201_168_76_/_0.35)] disabled:hover:border-[color:var(--color-border)]"
                  >
                    {nextActionLabel("call", gameState)}
                  </button>
                  <button
                    type="button"
                    disabled={!canAct || !raiseBounds.canRaise}
                    onClick={() => void submitAction("raise")}
                    className="rounded-[var(--radius-md)] bg-[color:var(--color-gold)] px-4 py-3 text-sm font-bold uppercase tracking-[0.08em] text-[color:var(--color-bg)] transition-colors hover:bg-[#d8b95c] disabled:hover:bg-[color:var(--color-gold)]"
                  >
                    Raise
                  </button>
                </div>
                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between text-xs text-[color:var(--color-text-muted)]">
                    <span>Raise amount</span>
                    <span className="font-mono tabular-nums text-[color:var(--color-gold)]">{formatChips(raiseAmount)}</span>
                  </div>
                  <input
                    className="w-full accent-[color:var(--color-gold)]"
                    type="range"
                    min={raiseBounds.minTotal}
                    max={raiseBounds.maxTotal}
                    value={raiseAmount}
                    disabled={!canAct || !raiseBounds.canRaise}
                    onChange={(event) => setRaiseAmount(Number(event.target.value))}
                  />
                </div>
              </>
            )}
            {tableError ? (
              <p className="mt-4 rounded-[var(--radius-sm)] border border-[rgb(139_38_53_/_0.35)] bg-[rgb(139_38_53_/_0.12)] px-3 py-2 text-sm text-[rgb(222_120_134)]">
                {tableError}
              </p>
            ) : null}
            {tableError ? (
              <button
                type="button"
                onClick={() => void startNewHand()}
                disabled={isActing}
                className="mt-3 w-full rounded-[var(--radius-md)] border border-[rgb(201_168_76_/_0.28)] px-4 py-3 text-sm font-bold uppercase tracking-[0.08em] text-[color:var(--color-gold)] transition-colors hover:bg-[rgb(201_168_76_/_0.1)]"
              >
                Start Fresh
              </button>
            ) : null}
          </section>

          <section className="flex-1 rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-full bg-[color:var(--color-gold)] text-sm font-semibold text-[color:var(--color-bg)]">N</div>
              <div>
                <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">Daniel Negreanu</p>
              <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">{coachingStatusLabel(coachingStatus)}</p>
            </div>
          </div>
          <div className="mt-6 h-px bg-[color:var(--color-border)]" />
            {pastPatternMatch ? (
              <div className="mt-6 rounded-[var(--radius-md)] border border-[rgb(139_38_53_/_0.42)] bg-[rgb(139_38_53_/_0.14)] px-4 py-3 text-sm text-[rgb(238_152_164)]">
                Repeated pattern: {pastPatternMatch}
              </div>
            ) : coachingMistake?.exists ? (
              <div className="mt-6 rounded-[var(--radius-md)] border border-[rgb(201_168_76_/_0.3)] bg-[rgb(201_168_76_/_0.1)] px-4 py-3 text-sm text-[color:var(--color-gold)]">
                New pattern noticed: {coachingMistake.pattern}
              </div>
            ) : null}
            <div className="mt-6 min-h-[180px] text-[15px] leading-7 text-[color:var(--color-text-primary)]" aria-live="polite">
              {visibleCoachingText ? (
                <GlossaryText text={visibleCoachingText} />
              ) : coachingStatus === "thinking" || coachingStatus === "streaming" ? (
                <p className="text-[color:var(--color-text-secondary)]">Daniel Negreanu is thinking through the hand.</p>
              ) : coachingStatus === "rate_limited" ? (
                <p className="text-[color:var(--color-text-secondary)]">You have reached the free-hand limit. Add your Anthropic key in settings to keep playing.</p>
              ) : coachingStatus === "error" ? (
                <p className="text-[rgb(222_120_134)]">{coachingError ?? "Coaching failed."}</p>
              ) : (
                <p className="text-[color:var(--color-text-secondary)]">Coaching appears here after the hand. Play clean, because he is going to notice the decision that mattered.</p>
              )}
            </div>
          </section>
        </aside>
      </div>
      <RateLimitModal
        apiKeyError={apiKeyError}
        apiKeyInput={apiKeyInput}
        isOpen={showRateLimitModal}
        isSaving={isSavingApiKey}
        onClose={() => setShowRateLimitModal(false)}
        onInputChange={setApiKeyInput}
        onSave={() => void saveApiKey()}
      />
      <EvalModal
        feedback={evalFeedback}
        isOpen={showEvalModal && !evalSubmitted && !showRateLimitModal}
        isSubmitting={isSubmittingEval}
        rating={evalRating}
        onClose={skipEval}
        onFeedbackChange={setEvalFeedback}
        onRatingChange={setEvalRating}
        onSubmit={() => void submitEval()}
      />
    </main>
  );
}

function normalizePattern(pattern: string): string {
  return pattern
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatHandCounter(profile: UserProfile | null, state: GameState | null): string {
  const limit = profile?.freeHandsLimit ?? FREE_HANDS_FALLBACK;
  const completedHands = profile?.freeHandsUsed ?? 0;
  const currentHand = Math.max(1, Math.min(completedHands + (isActiveHand(state) || state?.state === "SHOWDOWN" ? 1 : 0), limit));

  return `Hand ${currentHand} of ${limit} free hands`;
}

function getVisibleBoardCards(state: GameState | null): Array<string | undefined> {
  const revealCount = getBoardRevealCount(state?.state);
  const board = state?.terminal?.board ?? state?.board ?? [];

  return BOARD_SLOTS.map((slot) => (slot < revealCount ? board[slot] : undefined));
}

function getBoardRevealCount(state?: GameState["state"]): number {
  switch (state) {
    case "FLOP":
      return 3;
    case "TURN":
      return 4;
    case "RIVER":
    case "SHOWDOWN":
    case "COMPLETE":
      return 5;
    default:
      return 0;
  }
}

function shouldRevealNegreanuCards(state: GameState | null): boolean {
  if (!state?.terminal?.dnHand || !["COMPLETE", "SHOWDOWN"].includes(state.state)) {
    return false;
  }

  if (state.terminal.reason === "fold" && state.terminal.winner === "user") {
    return false;
  }

  return state.terminal.dnHand.every((card) => card && card !== "hidden");
}

function findPastPattern(pattern: string, mistakes: UserProfile["mistakes"]): string | null {
  const normalized = normalizePattern(pattern);
  return mistakes.find((mistake) => normalizePattern(mistake.pattern) === normalized)?.pattern ?? null;
}

function coachingStatusLabel(status: "idle" | "thinking" | "streaming" | "done" | "error" | "rate_limited"): string {
  if (status === "thinking") {
    return "thinking";
  }
  if (status === "streaming") {
    return "coaching";
  }
  if (status === "done") {
    return "analysis complete";
  }
  if (status === "error") {
    return "needs attention";
  }
  if (status === "rate_limited") {
    return "key needed";
  }
  return "waiting for a hand";
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
      // Fall back to status text.
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

function gameStatus(state: GameState | null, isBooting: boolean): string {
  if (isBooting) {
    return "Loading table";
  }
  if (!state) {
    return "No hand loaded";
  }
  if (state.state === "COMPLETE") {
    return "Hand complete";
  }
  if (state.actionOn === "user") {
    return "Your action";
  }
  if (state.actionOn === "dn") {
    return "Negreanu is acting";
  }
  if (state.state === "SHOWDOWN") {
    return "Showdown";
  }
  return state.state.toLowerCase();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong at the table.";
}

function HandCards({ cards, hidden = false, owner }: { cards: string[]; hidden?: boolean; owner: string }) {
  const normalized = [cards[0], cards[1]];

  return (
    <div className="flex gap-3">
      {normalized.map((card, index) => (
        <PlayingCard key={`${owner}-${index}-${card ?? "empty"}`} code={hidden ? "hidden" : card} label={`${owner} card ${index + 1}`} />
      ))}
    </div>
  );
}

function PlayingCard({ code, label = "Card", placeholder = false }: { code?: string; label?: string; placeholder?: boolean }) {
  const card = toDisplayCard(code);
  if (card.hidden || !code) {
    return <CardSlot label={label} hidden={card.hidden} placeholder={placeholder} />;
  }

  return (
    <div aria-label={`${label}: ${card.rank}${card.suit}`} className="grid aspect-[5/7] w-[54px] place-items-center rounded-[var(--radius-sm)] border border-[#d8d6cc] bg-[color:var(--color-text-primary)] text-[color:var(--color-bg)] shadow-lift sm:w-[64px]">
      <div className={`font-mono text-xl leading-none sm:text-2xl ${card.isRed ? "text-[color:var(--color-danger)]" : ""}`}>
        {card.rank}
        <span className="block text-base sm:text-lg">{card.suit}</span>
      </div>
    </div>
  );
}

function CardSlot({ label = "Community card", hidden = false, placeholder = false }: { label?: string; hidden?: boolean; placeholder?: boolean }) {
  if (hidden) {
    return <CardBack label={label} />;
  }

  if (placeholder) {
    return <div aria-label={`${label} empty`} className="aspect-[5/7] w-[54px] rounded-[var(--radius-sm)] border border-dashed border-[color:var(--color-border)] bg-[rgb(10_10_10_/_0.16)] sm:w-[64px]" />;
  }

  return (
    <div
      aria-label={label}
      className="grid aspect-[5/7] w-[54px] place-items-center rounded-[var(--radius-sm)] border border-[rgb(245_245_240_/_0.12)] bg-[rgb(10_10_10_/_0.24)] shadow-[inset_0_0_0_1px_rgb(201_168_76_/_0.08)] sm:w-[64px]"
    >
      <span className="size-1.5 rounded-full bg-[rgb(201_168_76_/_0.24)]" />
    </div>
  );
}

function CardBack({ label = "Face-down card" }: { label?: string }) {
  return (
    <div aria-label={label} className="aspect-[5/7] w-[54px] rounded-[var(--radius-sm)] border border-[rgb(201_168_76_/_0.45)] bg-[repeating-linear-gradient(45deg,#5b1724,#5b1724_6px,#2f0c13_6px,#2f0c13_12px)] shadow-lift sm:w-[64px]">
      <div className="m-2 h-[calc(100%-1rem)] rounded-[var(--radius-sm)] border border-[rgb(201_168_76_/_0.35)]" />
    </div>
  );
}

function ChipStack({
  align = "start",
  amount,
  className,
  label,
  variant
}: {
  align?: "start" | "end";
  amount: number;
  className: string;
  label: string;
  variant: "user" | "negreanu";
}) {
  const colors = variant === "user" ? ["#1a6b3c", "#C9A84C", "#8B2635", "#1a6b3c", "#C9A84C"] : ["#8B2635", "#C9A84C", "#1a6b3c", "#8B2635", "#C9A84C"];

  return (
    <div className={`absolute flex flex-col ${align === "end" ? "items-end" : "items-start"} ${className}`}>
      <div className="relative h-[92px] w-7" aria-hidden="true">
        {colors.map((color, index) => (
          <span
            key={`${color}-${index}`}
            className="absolute left-0 size-7 rounded-full border-[1.5px] border-[rgb(255_255_255_/_0.2)]"
            style={{
              backgroundColor: color,
              bottom: `${index * 16}px`,
              boxShadow: "inset 0 0 0 3px rgba(255,255,255,0.15), 0 2px 4px rgba(0,0,0,0.4)"
            }}
          />
        ))}
      </div>
      <p className="mt-1 text-[11px] text-[color:var(--color-text-muted)]">{label}</p>
      <p className="font-mono text-[12px] tabular-nums text-[color:var(--color-gold)]">{formatChips(amount)}</p>
    </div>
  );
}

function RateLimitModal({
  apiKeyError,
  apiKeyInput,
  isOpen,
  isSaving,
  onClose,
  onInputChange,
  onSave
}: {
  apiKeyError: string | null;
  apiKeyInput: string;
  isOpen: boolean;
  isSaving: boolean;
  onClose: () => void;
  onInputChange: (value: string) => void;
  onSave: () => void;
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgb(0_0_0_/_0.72)] px-4">
      <div role="dialog" aria-modal="true" aria-labelledby="rate-limit-title" className="w-full max-w-[460px] rounded-[var(--radius-lg)] border border-[rgb(201_168_76_/_0.28)] bg-[color:var(--color-surface)] p-6 shadow-lift">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p id="rate-limit-title" className="font-display text-2xl font-semibold text-[color:var(--color-text-primary)]">
              Five free hands played.
            </p>
            <p className="mt-3 text-sm leading-6 text-[color:var(--color-text-secondary)]">
              Add your Anthropic API key to keep playing unlimited hands. The key is encrypted before storage and can be removed anytime.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-[var(--radius-sm)] px-2 py-1 text-sm text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]">
            Close
          </button>
        </div>
        <label className="mt-6 block text-sm font-medium text-[color:var(--color-text-primary)]" htmlFor="table-api-key">
          Anthropic API key
        </label>
        <input
          id="table-api-key"
          value={apiKeyInput}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="sk-ant-..."
          className="mt-2 w-full rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-4 py-3 text-sm text-[color:var(--color-text-primary)] outline-none transition-colors focus:border-[color:var(--color-gold)]"
          type="password"
        />
        {apiKeyError ? <p className="mt-3 text-sm text-[rgb(222_120_134)]">{apiKeyError}</p> : null}
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving || apiKeyInput.trim().length < 10}
          className="mt-5 w-full rounded-[var(--radius-md)] bg-[color:var(--color-gold)] px-5 py-3 text-sm font-bold uppercase tracking-[0.08em] text-[color:var(--color-bg)] transition-colors hover:bg-[#d8b95c]"
        >
          {isSaving ? "Saving" : "Save Key"}
        </button>
      </div>
    </div>
  );
}

function EvalModal({
  feedback,
  isOpen,
  isSubmitting,
  rating,
  onClose,
  onFeedbackChange,
  onRatingChange,
  onSubmit
}: {
  feedback: string;
  isOpen: boolean;
  isSubmitting: boolean;
  rating: 1 | 2 | 3 | 4 | 5 | null;
  onClose: () => void;
  onFeedbackChange: (value: string) => void;
  onRatingChange: (value: 1 | 2 | 3 | 4 | 5) => void;
  onSubmit: () => void;
}) {
  if (!isOpen) {
    return null;
  }

  const stars: Array<1 | 2 | 3 | 4 | 5> = [1, 2, 3, 4, 5];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-[rgb(0_0_0_/_0.72)] px-4">
      <div role="dialog" aria-modal="true" aria-labelledby="eval-title" className="w-full max-w-[480px] rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 shadow-lift">
        <div className="flex items-start justify-between gap-4">
          <p id="eval-title" className="font-display text-2xl font-semibold leading-tight text-[color:var(--color-text-primary)]">
            How much did that sound like Daniel Negreanu?
          </p>
          <button type="button" onClick={onClose} className="rounded-[var(--radius-sm)] px-2 py-1 text-sm text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]">
            Skip
          </button>
        </div>
        <div className="mt-6 flex gap-2" aria-label="Rating">
          {stars.map((star) => (
            <button
              key={star}
              type="button"
              aria-label={`${star} star${star === 1 ? "" : "s"}`}
              onClick={() => onRatingChange(star)}
              className={`text-4xl leading-none transition-colors ${rating && star <= rating ? "text-[color:var(--color-gold)]" : "text-[color:var(--color-border)] hover:text-[color:var(--color-gold-muted)]"}`}
            >
              ★
            </button>
          ))}
        </div>
        <label className="mt-6 block text-sm font-medium text-[color:var(--color-text-primary)]" htmlFor="eval-feedback">
          What felt off?
        </label>
        <textarea
          id="eval-feedback"
          value={feedback}
          onChange={(event) => onFeedbackChange(event.target.value)}
          rows={3}
          className="mt-2 w-full resize-none rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-4 py-3 text-sm text-[color:var(--color-text-primary)] outline-none transition-colors focus:border-[color:var(--color-gold)]"
          placeholder="Optional"
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={!rating || isSubmitting}
          className="mt-5 w-full rounded-[var(--radius-md)] bg-[color:var(--color-gold)] px-5 py-3 text-sm font-bold uppercase tracking-[0.08em] text-[color:var(--color-bg)] transition-colors hover:bg-[#d8b95c]"
        >
          {isSubmitting ? "Submitting" : "Submit"}
        </button>
      </div>
    </div>
  );
}

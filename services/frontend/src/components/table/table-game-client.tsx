"use client";

import { useClerk } from "@clerk/nextjs";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { GlossaryText } from "@/components/glossary-text";
import { formatChips, toDisplayCard } from "@/lib/cards";
import { buildCoachingPayload, callAmount, getRaiseBounds, hasCompleteTerminalContext, isActiveHand, isUserTurn, nextActionLabel, terminalPotAwarded } from "@/lib/game-helpers";
import type { CoachingStreamEvent, GameState, HandHistoryEntry, MistakeExtraction, PlayerAction, ShowdownResult, UserProfile } from "@/lib/game-types";
import { parseSseMessages } from "@/lib/sse";

const BOARD_SLOTS = Array.from({ length: 5 }, (_, index) => index);
const FREE_HANDS_FALLBACK = 5;

type NegreanuActionNotice = {
  key: string;
  text: string;
};

export function TableGameClient() {
  const { signOut } = useClerk();
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
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isSavingApiKey, setIsSavingApiKey] = useState(false);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [isLeavingTable, setIsLeavingTable] = useState(false);
  const [isStartingNewHand, setIsStartingNewHand] = useState(false);
  const [showCoachingScrollCue, setShowCoachingScrollCue] = useState(false);
  const [negreanuActionNotice, setNegreanuActionNotice] = useState<NegreanuActionNotice | null>(null);
  const [isNegreanuActionFresh, setIsNegreanuActionFresh] = useState(false);
  const coachedHandId = useRef<string | null>(null);
  const profileBeforeHand = useRef<UserProfile | null>(null);
  const coachingScrollRef = useRef<HTMLDivElement | null>(null);
  const coachingScrollCueTimeout = useRef<number | null>(null);
  const hasShownCoachingScrollCue = useRef(false);
  const latestNegreanuActionKey = useRef<string | null>(null);
  const negreanuActionTimeout = useRef<number | null>(null);

  const raiseBounds = useMemo(() => getRaiseBounds(gameState), [gameState]);
  const amountToCall = callAmount(gameState);
  const handCounter = formatHandCounter(profile, gameState);
  const displayedPot = gameState && hasCompleteTerminalContext(gameState) ? terminalPotAwarded(gameState) : gameState?.pot ?? 0;
  const winnerAnnouncement = isStartingNewHand ? null : formatWinnerAnnouncement(gameState);
  const visibleBoardCards = useMemo(() => getVisibleBoardCards(gameState), [gameState]);
  const revealNegreanuCards = shouldRevealNegreanuCards(gameState);
  const negreanuCards = revealNegreanuCards ? gameState?.terminal?.dnHand ?? [] : ["hidden", "hidden"];
  const isHandComplete = gameState?.state === "COMPLETE";
  const isUserActionPending = gameState?.actionOn === "user" && !isHandComplete;
  const isNegreanuThinking = gameState?.actionOn === "dn" && !isHandComplete;

  const resetCoachingScrollCue = useCallback(() => {
    if (coachingScrollCueTimeout.current) {
      clearTimeout(coachingScrollCueTimeout.current);
      coachingScrollCueTimeout.current = null;
    }
    hasShownCoachingScrollCue.current = false;
    setShowCoachingScrollCue(false);
  }, []);

  const leaveTable = useCallback(async () => {
    if (isLeavingTable) {
      return;
    }

    setIsLeavingTable(true);
    setTableError(null);
    try {
      await signOut({ redirectUrl: "/" });
    } catch (error) {
      setIsLeavingTable(false);
      setTableError(errorMessage(error));
    }
  }, [isLeavingTable, signOut]);

  const loadProfile = useCallback(async () => {
    const nextProfile = await fetchJson<UserProfile>("/api/user/profile");
    setProfile(nextProfile);
    if (nextProfile.freeHandsUsed >= nextProfile.freeHandsLimit && !nextProfile.hasApiKey) {
      setShowRateLimitModal(true);
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
    setIsStartingNewHand(true);
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
      resetCoachingScrollCue();
    } catch (error) {
      setTableError(errorMessage(error));
    } finally {
      setIsActing(false);
      setIsStartingNewHand(false);
    }
  }, [loadProfile, resetCoachingScrollCue]);

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
      resetCoachingScrollCue();

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
        let sawDone = false;
        const handleStreamEvent = (event: CoachingStreamEvent) => {
          switch (event.type) {
            case "chunk":
              setCoachingText((text) => text + event.text);
              return false;
            case "mistake":
              setCoachingMistake(event.mistake);
              if (event.mistake.exists) {
                setPastPatternMatch(findPastPattern(event.mistake.pattern, baselineProfile.mistakes));
              }
              return false;
            case "done":
              setCoachingText(event.text);
              setCoachingStatus("done");
              return true;
            case "error":
              throw new Error(event.message);
          }
        };

        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const parsed = parseSseMessages<CoachingStreamEvent>(buffer);
          buffer = parsed.rest;

          for (const message of parsed.messages) {
            sawDone = handleStreamEvent(message.data) || sawDone;
          }
        }

        if (buffer.trim()) {
          const parsed = parseSseMessages<CoachingStreamEvent>(`${buffer}\n\n`);
          for (const message of parsed.messages) {
            sawDone = handleStreamEvent(message.data) || sawDone;
          }
        }

        if (!sawDone) {
          setCoachingStatus("done");
        }

        await loadProfile();
      } catch (error) {
        setCoachingStatus("error");
        setCoachingError(errorMessage(error));
      }
    },
    [loadProfile, profile, resetCoachingScrollCue]
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

  useEffect(() => {
    const scrollArea = coachingScrollRef.current;
    if (!scrollArea || hasShownCoachingScrollCue.current) {
      return;
    }

    if (scrollArea.scrollHeight <= scrollArea.clientHeight + 4) {
      return;
    }

    hasShownCoachingScrollCue.current = true;
    setShowCoachingScrollCue(true);
    coachingScrollCueTimeout.current = window.setTimeout(() => {
      setShowCoachingScrollCue(false);
      coachingScrollCueTimeout.current = null;
    }, 1500);
  }, [coachingMistake, coachingStatus, pastPatternMatch, visibleCoachingText]);

  useEffect(() => {
    return () => {
      if (coachingScrollCueTimeout.current) {
        clearTimeout(coachingScrollCueTimeout.current);
      }
      if (negreanuActionTimeout.current) {
        clearTimeout(negreanuActionTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    const notice = latestNegreanuActionNotice(gameState);
    if (!notice) {
      setNegreanuActionNotice(null);
      latestNegreanuActionKey.current = null;
      return;
    }

    setNegreanuActionNotice(notice);
    if (notice.key === latestNegreanuActionKey.current) {
      return;
    }

    latestNegreanuActionKey.current = notice.key;
    setIsNegreanuActionFresh(true);
    if (negreanuActionTimeout.current) {
      clearTimeout(negreanuActionTimeout.current);
    }
    negreanuActionTimeout.current = window.setTimeout(() => {
      setIsNegreanuActionFresh(false);
      negreanuActionTimeout.current = null;
    }, 1000);
  }, [gameState]);

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

  return (
    <main className="min-h-svh bg-[color:var(--color-bg)] text-[color:var(--color-text-primary)] lg:h-svh lg:overflow-hidden">
      <div className="mx-auto grid min-h-svh w-full max-w-[1500px] gap-6 px-4 py-5 sm:px-6 lg:h-full lg:min-h-0 lg:grid-cols-[minmax(0,1.42fr)_minmax(360px,0.58fr)] lg:items-stretch lg:px-8">
        <section className="felt-texture relative min-h-[620px] overflow-hidden rounded-[var(--radius-xl)] border border-[rgb(201_168_76_/_0.16)] shadow-table lg:h-full lg:min-h-0">
          <div className="absolute inset-5 rounded-[var(--radius-xl)] border border-dashed border-[rgb(201_168_76_/_0.18)]" aria-hidden="true" />
          <div className="absolute left-1/2 top-8 flex -translate-x-1/2 flex-col items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text-secondary)]">Daniel Negreanu</p>
            <HandCards cards={negreanuCards} hidden={!revealNegreanuCards} owner="Daniel Negreanu" />
          </div>

          {winnerAnnouncement ? (
            <div
              className={`absolute left-1/2 top-[225px] z-20 w-[min(410px,calc(100%-2rem))] -translate-x-1/2 rounded-[var(--radius-md)] border px-5 py-4 text-center shadow-[0_18px_50px_rgb(0_0_0_/_0.3)] ${
                winnerAnnouncement.tone === "user"
                  ? "border-[rgb(45_106_79_/_0.7)] bg-[rgb(45_106_79_/_0.2)]"
                  : winnerAnnouncement.tone === "negreanu"
                    ? "border-[rgb(201_168_76_/_0.44)] bg-[rgb(10_10_10_/_0.84)]"
                    : "border-[rgb(201_168_76_/_0.52)] bg-[rgb(201_168_76_/_0.12)]"
              }`}
              aria-live="polite"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--color-gold)]">{winnerAnnouncement.eyebrow}</p>
              <p className="mt-2 font-display text-2xl font-semibold text-[color:var(--color-text-primary)]">{winnerAnnouncement.title}</p>
              <p className="mt-1 font-mono text-sm tabular-nums text-[color:var(--color-gold)]">{winnerAnnouncement.detail}</p>
            </div>
          ) : !isStartingNewHand && negreanuActionNotice ? (
            <div
              className={`absolute left-1/2 top-[178px] z-10 w-[min(360px,calc(100%-2rem))] -translate-x-1/2 rounded-[var(--radius-md)] border border-[rgb(201_168_76_/_0.3)] bg-[rgb(10_10_10_/_0.78)] px-4 py-3 text-center shadow-lift transition-shadow ${
                isNegreanuActionFresh
                  ? "animate-[negreanu-action-flash_1s_ease-out_1] border-[rgb(201_168_76_/_0.7)] shadow-[0_0_0_1px_rgb(201_168_76_/_0.55),0_0_34px_rgb(201_168_76_/_0.28)]"
                  : ""
              }`}
              aria-live="polite"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--color-gold)]">{negreanuActionNotice.text}</p>
            </div>
          ) : null}

          <ChipStack className="right-12 top-10" label="Stack" amount={gameState?.dnStack ?? 0} align="end" variant="negreanu" />
          <ChipStack className="bottom-10 left-12" label="Your stack" amount={gameState?.userStack ?? 0} variant="user" />

          <div className="absolute left-1/2 top-[42%] flex w-full max-w-[440px] -translate-x-1/2 -translate-y-1/2 justify-center gap-2 px-4 sm:gap-3">
            {BOARD_SLOTS.map((slot) => (
              <PlayingCard key={`board-${slot}`} code={visibleBoardCards[slot]} label={`Community card ${slot + 1}`} placeholder />
            ))}
          </div>

          <div className="absolute left-1/2 top-[56%] -translate-x-1/2 rounded-[var(--radius-sm)] border border-[rgb(201_168_76_/_0.22)] bg-[rgb(10_10_10_/_0.76)] px-5 py-2 font-mono text-sm tabular-nums text-[color:var(--color-gold)] shadow-lift">
            Pot {formatChips(displayedPot)}
          </div>

          <div className="absolute bottom-9 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3">
            {isUserActionPending ? (
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-[color:var(--color-gold)]">Your turn</p>
            ) : isNegreanuThinking ? (
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-[color:var(--color-text-muted)]">Negreanu is thinking...</p>
            ) : null}
            <div
              className={
                isUserActionPending
                  ? "relative rounded-[var(--radius-md)] before:pointer-events-none before:absolute before:-inset-2 before:rounded-[var(--radius-md)] before:shadow-[0_0_0_2px_var(--color-gold)] before:content-[''] before:animate-pulse before:[animation-duration:1.5s]"
                  : ""
              }
            >
              <HandCards cards={gameState?.userHand ?? []} owner="You" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--color-text-secondary)]">You</p>
          </div>
        </section>

        <aside className="flex min-h-[620px] flex-col gap-4 lg:h-full lg:min-h-0">
          <header className="flex shrink-0 items-center justify-between rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
            <div>
              <p className="font-display text-2xl font-semibold text-[color:var(--color-text-primary)]">Heads-up table</p>
              <p className="mt-1 text-sm text-[color:var(--color-text-secondary)]">{handCounter}</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void leaveTable()}
                disabled={isLeavingTable}
                className="rounded-[var(--radius-sm)] px-2 py-1 text-sm text-[color:var(--color-text-secondary)] transition-colors hover:text-[color:var(--color-text-primary)] disabled:cursor-wait disabled:text-[color:var(--color-text-muted)]"
              >
                {isLeavingTable ? "Leaving" : "Leave Table"}
              </button>
              <Link href="/settings" className="rounded-[var(--radius-sm)] px-2 py-1 text-sm text-[color:var(--color-text-secondary)] transition-colors hover:text-[color:var(--color-text-primary)]">
                Settings
              </Link>
            </div>
          </header>

          <section className="shrink-0 rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5">
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
          </section>

          <section className="relative flex min-h-[320px] flex-1 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5 lg:min-h-0">
            <div className="flex shrink-0 items-center gap-3">
              <div className="grid size-9 place-items-center rounded-full bg-[color:var(--color-gold)] text-sm font-semibold text-[color:var(--color-bg)]">N</div>
              <div>
                <p className="text-sm font-semibold text-[color:var(--color-text-primary)]">Daniel Negreanu</p>
              <p className="mt-1 text-xs text-[color:var(--color-text-muted)]">{coachingStatusLabel(coachingStatus)}</p>
            </div>
          </div>
          <div className="mt-6 h-px shrink-0 bg-[color:var(--color-border)]" />
            {pastPatternMatch ? (
              <div className="mt-6 shrink-0 rounded-[var(--radius-md)] border border-[rgb(139_38_53_/_0.42)] bg-[rgb(139_38_53_/_0.14)] px-4 py-3 text-sm text-[rgb(238_152_164)]">
                Repeated pattern: {pastPatternMatch}
              </div>
            ) : coachingMistake?.exists ? (
              <div className="mt-6 shrink-0 rounded-[var(--radius-md)] border border-[rgb(201_168_76_/_0.3)] bg-[rgb(201_168_76_/_0.1)] px-4 py-3 text-sm text-[color:var(--color-gold)]">
                New pattern noticed: {coachingMistake.pattern}
              </div>
            ) : null}
            <div
              className="relative mt-6 min-h-0 flex-1 overflow-hidden"
            >
              <div
                ref={coachingScrollRef}
                className="h-full overflow-y-auto overflow-x-hidden pr-4 text-[15px] leading-7 text-[color:var(--color-text-primary)] [overflow-wrap:anywhere] [&::-webkit-scrollbar]:h-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[color:var(--color-gold-muted)] [&::-webkit-scrollbar-track]:bg-[color:var(--color-surface)]"
                aria-live="polite"
                style={{ scrollbarColor: "var(--color-gold-muted) var(--color-surface)", scrollbarWidth: "thin" }}
              >
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
              {showCoachingScrollCue ? (
                <div
                  className="pointer-events-none absolute bottom-0 right-0 top-0 w-1 animate-[pulse_1.5s_ease-in-out_1] rounded-full bg-[color:var(--color-gold)] shadow-[0_0_16px_rgb(201_168_76_/_0.55)]"
                  aria-hidden="true"
                />
              ) : null}
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
  if (profile?.hasApiKey) {
    return "API key connected. Unlimited hands";
  }

  const limit = profile?.freeHandsLimit ?? FREE_HANDS_FALLBACK;
  const completedHands = profile?.freeHandsUsed ?? 0;
  const currentHand = Math.max(1, Math.min(completedHands + (isActiveHand(state) || state?.state === "SHOWDOWN" ? 1 : 0), limit));

  return `Hand ${currentHand} of ${limit} free hands`;
}

function formatWinnerAnnouncement(state: GameState | null): { eyebrow: string; title: string; detail: string; tone: "user" | "negreanu" | "split" } | null {
  if (state?.state !== "COMPLETE" || !state.terminal) {
    return null;
  }

  const awarded = state.terminal.potAwarded;
  if (state.terminal.winner === "split") {
    return {
      eyebrow: "Hand result",
      title: "Split pot",
      detail: `${formatChips(awarded.user)} each`,
      tone: "split"
    };
  }

  if (state.terminal.winner === "user") {
    return {
      eyebrow: "Hand result",
      title: "You win the hand",
      detail: `Won ${formatChips(awarded.user)}`,
      tone: "user"
    };
  }

  return {
    eyebrow: "Hand result",
    title: "Daniel Negreanu wins",
    detail: `Won ${formatChips(awarded.dn)}`,
    tone: "negreanu"
  };
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

function latestNegreanuActionNotice(state: GameState | null): NegreanuActionNotice | null {
  if (!state) {
    return null;
  }

  for (let index = state.handHistory.length - 1; index >= 0; index -= 1) {
    const entry = state.handHistory[index];
    if (entry.actor !== "dn") {
      continue;
    }

    return {
      key: `${state.handId}:${state.state}:${state.board.length}:${index}:${entry.action}:${entry.amount ?? ""}:${entry.pot ?? ""}`,
      text: formatNegreanuAction(entry)
    };
  }

  return null;
}

function formatNegreanuAction(entry: HandHistoryEntry): string {
  if (entry.action === "raise" && entry.amount) {
    return `Daniel Negreanu raises to ${formatChips(entry.amount)}`;
  }
  if (entry.action === "call" && entry.amount) {
    return `Daniel Negreanu calls ${formatChips(entry.amount)}`;
  }
  if (entry.action === "check") {
    return "Daniel Negreanu checks";
  }
  if (entry.action === "fold") {
    return "Daniel Negreanu folds";
  }

  return `Daniel Negreanu ${entry.action.replace(/_/g, " ")}`;
}

function coachingStatusLabel(status: "idle" | "thinking" | "streaming" | "done" | "error" | "rate_limited"): string {
  if (status === "thinking") {
    return "thinking";
  }
  if (status === "streaming") {
    return "coaching";
  }
  if (status === "done") {
    return "completed";
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
      <div className="relative h-[120px] w-10" aria-hidden="true">
        {colors.map((color, index) => (
          <span
            key={`${color}-${index}`}
            className="absolute bottom-0 left-0 size-10 rounded-full border-[1.5px] border-[rgb(255_255_255_/_0.2)]"
            style={{
              backgroundColor: color,
              transform: `translateY(-${index * 20}px)`,
              boxShadow: "inset 0 0 0 3px rgba(255,255,255,0.15), 0 2px 4px rgba(0,0,0,0.4)"
            }}
          />
        ))}
      </div>
      <p className="mt-1 text-[11px] text-[color:var(--color-text-muted)]">{label}</p>
      <p className="font-mono text-[16px] font-semibold leading-5 tabular-nums text-[color:var(--color-gold)]">{formatChips(amount)}</p>
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
          <button type="button" onClick={onClose} className="shrink-0 rounded-[var(--radius-sm)] px-2 py-1 text-sm text-[color:var(--color-text-secondary)] hover:text-[color:var(--color-text-primary)]">
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

import type { CoachingAnalyzePayload, GamePhase, GameState, MistakeProfileEntry, PlayerAction } from "@/lib/game-types";

const ACTIVE_PHASES = new Set<GamePhase>(["PREFLOP", "FLOP", "TURN", "RIVER"]);

export type RaiseBounds = {
  canRaise: boolean;
  minTotal: number;
  maxTotal: number;
};

export function isActiveHand(state: GameState | null): boolean {
  return Boolean(state && ACTIVE_PHASES.has(state.state));
}

export function isUserTurn(state: GameState | null): boolean {
  return Boolean(state && state.actionOn === "user" && ACTIVE_PHASES.has(state.state));
}

export function callAmount(state: GameState | null): number {
  if (!state) {
    return 0;
  }

  return Math.max(state.dnBet - state.userBet, 0);
}

export function getRaiseBounds(state: GameState | null): RaiseBounds {
  if (!state || !isUserTurn(state) || state.dnStack <= 0) {
    return { canRaise: false, minTotal: 0, maxTotal: 0 };
  }

  const current = Math.max(state.currentBet, state.userBet, state.dnBet);
  const maxTotal = state.userBet + state.userStack;
  const requiredMinimum = state.currentBet + state.lastRaiseSize;
  const minTotal = Math.min(requiredMinimum, maxTotal);
  const canRaise = maxTotal > current && minTotal > current;

  return { canRaise, minTotal, maxTotal };
}

export function nextActionLabel(action: PlayerAction, state: GameState | null): string {
  if (action === "call" && callAmount(state) === 0) {
    return "Check";
  }

  if (action === "raise") {
    return "Raise";
  }

  return action[0].toUpperCase() + action.slice(1);
}

export function terminalPotAwarded(state: GameState): number {
  if (!state.terminal) {
    return state.pot;
  }

  return state.terminal.potAwarded.user + state.terminal.potAwarded.dn;
}

export function hasCompleteTerminalContext(state: GameState | null): state is GameState & { terminal: NonNullable<GameState["terminal"]> } {
  return Boolean(state?.terminal && state.terminal.userHand.length === 2 && state.terminal.dnHand.length === 2 && state.terminal.board.length === 5);
}

export function buildCoachingPayload(state: GameState, mistakes: MistakeProfileEntry[]): CoachingAnalyzePayload {
  if (!hasCompleteTerminalContext(state)) {
    throw new Error("Hand is missing terminal coaching context");
  }

  return {
    handId: state.handId,
    userId: state.userId,
    handHistory: state.handHistory,
    userHand: state.terminal.userHand,
    dnHand: state.terminal.dnHand,
    board: state.terminal.board,
    winner: state.terminal.winner,
    pot: terminalPotAwarded(state),
    userRank: state.terminal.userRank,
    dnRank: state.terminal.dnRank,
    userMistakeProfile: mistakes
  };
}

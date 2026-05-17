export type Player = "user" | "dn" | "system";
export type Winner = "user" | "dn" | "split";
export type GamePhase = "WAITING" | "PREFLOP" | "FLOP" | "TURN" | "RIVER" | "SHOWDOWN" | "COMPLETE";
export type PlayerAction = "fold" | "call" | "raise";
export type MistakeSeverity = "low" | "medium" | "high";

export type HandHistoryEntry = {
  actor: Player;
  action: string;
  amount?: number;
  state?: GamePhase | string;
  street?: number;
  pot?: number;
  note?: string | null;
};

export type TerminalHand = {
  reason: "fold" | "showdown";
  winner: Winner;
  potAwarded: Record<"user" | "dn", number>;
  userHand: [string, string];
  dnHand: [string, string];
  board: [string, string, string, string, string];
  userRank?: string;
  dnRank?: string;
};

export type GameState = {
  handId: string;
  userId: string;
  state: GamePhase;
  street: number;
  deck: string[];
  userHand: string[];
  dnHand: string[];
  board: string[];
  pot: number;
  sidePots: unknown[];
  userStack: number;
  dnStack: number;
  userBet: number;
  dnBet: number;
  smallBlind: number;
  bigBlind: number;
  actionOn: "user" | "dn" | null;
  lastAction: string | null;
  handHistory: HandHistoryEntry[];
  isAllIn: boolean;
  currentBet: number;
  lastRaiseSize: number;
  actedThisStreet: string[];
  winner: Winner | null;
  showdown: Record<string, unknown> | null;
  terminal: TerminalHand | null;
};

export type ShowdownResult = {
  winner: Winner;
  userScore: number;
  dnScore: number;
  userRank: string;
  dnRank: string;
  potAwarded: Record<"user" | "dn", number>;
  isSplit: boolean;
  gameState: GameState;
};

export type MistakeProfileEntry = {
  pattern: string;
  firstSeen: string;
  lastSeen: string;
  frequency: number;
  severity: MistakeSeverity;
  handsContext: string[];
};

export type UserProfile = {
  mistakes: MistakeProfileEntry[];
  freeHandsUsed: number;
  freeHandsLimit: number;
  hasApiKey: boolean;
};

export type MistakeExtraction =
  | {
      exists: false;
    }
  | {
      exists: true;
      pattern: string;
      severity: MistakeSeverity;
    };

export type CoachingStreamEvent =
  | {
      type: "chunk";
      text: string;
    }
  | {
      type: "mistake";
      mistake: MistakeExtraction;
    }
  | {
      type: "done";
      text: string;
      selectedArticles: string[];
    }
  | {
      type: "error";
      message: string;
    };

export type CoachingAnalyzePayload = {
  handId: string;
  userId: string;
  handHistory: HandHistoryEntry[];
  userHand: [string, string];
  dnHand: [string, string];
  board: [string, string, string, string, string];
  winner: Winner;
  pot: number;
  userRank?: string;
  dnRank?: string;
  userMistakeProfile: MistakeProfileEntry[];
};

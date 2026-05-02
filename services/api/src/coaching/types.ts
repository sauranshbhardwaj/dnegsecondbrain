export type Player = "user" | "dn" | "system";
export type Winner = "user" | "dn" | "split";
export type MistakeSeverity = "low" | "medium" | "high";

export type HandHistoryEntry = {
  actor: Player;
  action: string;
  amount?: number;
  state?: string;
  street?: number;
  pot?: number;
  note?: string | null;
};

export type MistakeProfileEntry = {
  pattern: string;
  firstSeen: string;
  lastSeen: string;
  frequency: number;
  severity: MistakeSeverity;
  handsContext: string[];
};

export type CoachingAnalyzeRequest = {
  handId?: string;
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

export type WikiArticle = {
  slug: string;
  title: string;
  content: string;
};

export type PromptBundle = {
  systemPrompt: string;
  userPrompt: string;
  selectedArticles: WikiArticle[];
  mistakeProfileSummary: string;
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

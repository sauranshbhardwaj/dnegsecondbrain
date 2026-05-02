import type { CoachingAnalyzeRequest, MistakeExtraction } from "./types.js";

export interface MistakeExtractor {
  extract(analysis: string, request: CoachingAnalyzeRequest): Promise<MistakeExtraction>;
}

export class NoopMistakeExtractor implements MistakeExtractor {
  async extract(): Promise<MistakeExtraction> {
    return { exists: false };
  }
}

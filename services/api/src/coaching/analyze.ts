import type { ClaudeClient } from "../claude/client.js";
import type { MistakeExtractor } from "./extractor.js";
import { buildPromptBundle } from "./prompt.js";
import type { CoachingAnalyzeRequest, CoachingStreamEvent } from "./types.js";

export type AnalyzeDeps = {
  claudeClient: ClaudeClient;
  mistakeExtractor: MistakeExtractor;
};

export async function analyzeHand(
  request: CoachingAnalyzeRequest,
  deps: AnalyzeDeps,
  onEvent: (eventName: string, event: CoachingStreamEvent) => void
): Promise<string> {
  const promptBundle = await buildPromptBundle(request);
  let fullText = "";

  for await (const chunk of deps.claudeClient.streamText({
    systemPrompt: promptBundle.systemPrompt,
    userPrompt: promptBundle.userPrompt
  })) {
    fullText += chunk;
    onEvent("chunk", { type: "chunk", text: chunk });
  }

  const mistake = await deps.mistakeExtractor.extract(fullText, request);
  onEvent("mistake", { type: "mistake", mistake });
  onEvent("done", {
    type: "done",
    text: fullText,
    selectedArticles: promptBundle.selectedArticles.map((article) => article.slug)
  });

  return fullText;
}

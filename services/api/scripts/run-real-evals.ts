import "dotenv/config";

import { AnthropicClaudeClient } from "../src/claude/client.js";
import { ClaudeMistakeExtractor } from "../src/coaching/mistake-extraction.js";
import { buildPromptBundle } from "../src/coaching/prompt.js";
import { readEnv } from "../src/config/env.js";
import { handFixtures } from "../tests/fixtures/hands.js";

const env = readEnv();

if (!env.anthropicApiKey) {
  console.error("ANTHROPIC_API_KEY is required to run real Claude voice evaluations.");
  process.exit(1);
}

const claude = new AnthropicClaudeClient(env);
const extractor = new ClaudeMistakeExtractor(claude);

for (const [index, hand] of handFixtures.entries()) {
  const bundle = await buildPromptBundle(hand);
  let coaching = "";

  for await (const chunk of claude.streamText({
    systemPrompt: bundle.systemPrompt,
    userPrompt: bundle.userPrompt
  })) {
    coaching += chunk;
  }

  const mistake = await extractor.extract(coaching, hand);

  console.log(`\n# Evaluation ${index + 1}: ${hand.userId}`);
  console.log(`Selected wiki: ${bundle.selectedArticles.map((article) => article.slug).join(", ")}`);
  console.log("\n## Coaching Output");
  console.log(coaching.trim());
  console.log("\n## Mistake Extraction");
  console.log(JSON.stringify(mistake, null, 2));
}

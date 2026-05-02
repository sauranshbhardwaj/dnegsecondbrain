import "dotenv/config";

import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { AnthropicClaudeClient } from "../src/claude/client.js";
import { ClaudeMistakeExtractor } from "../src/coaching/mistake-extraction.js";
import { buildPromptBundle } from "../src/coaching/prompt.js";
import { coachingAnalyzeRequestSchema } from "../src/coaching/validation.js";
import { readEnv } from "../src/config/env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const pokerEngineRoot = path.join(repoRoot, "services", "poker-engine");
const generatorPath = path.join(pokerEngineRoot, "scripts", "generate_completed_hand.py");

const python = spawnSync("python3", [generatorPath], {
  cwd: pokerEngineRoot,
  encoding: "utf8"
});

if (python.status !== 0) {
  console.error(python.stderr || python.stdout);
  process.exit(python.status ?? 1);
}

const parsedPayload = coachingAnalyzeRequestSchema.parse(JSON.parse(python.stdout));
const env = readEnv();

if (!env.anthropicApiKey || env.anthropicApiKey === "placeholder") {
  console.error("A real ANTHROPIC_API_KEY is required in services/api/.env for integration.");
  process.exit(1);
}

const claude = new AnthropicClaudeClient(env);
const extractor = new ClaudeMistakeExtractor(claude);
const bundle = await buildPromptBundle(parsedPayload);

let coaching = "";
for await (const chunk of claude.streamText({
  systemPrompt: bundle.systemPrompt,
  userPrompt: bundle.userPrompt
})) {
  coaching += chunk;
}

const mistake = await extractor.extract(coaching, parsedPayload);

console.log("# Day 1 + Day 2 Integration");
console.log(`Hand ID: ${parsedPayload.userId}`);
console.log(`User hand: ${parsedPayload.userHand.join(" ")}`);
console.log(`DN hand: ${parsedPayload.dnHand.join(" ")}`);
console.log(`Board: ${parsedPayload.board.join(" ")}`);
console.log(`Winner: ${parsedPayload.winner}`);
console.log(`Pot: ${parsedPayload.pot}`);
console.log(`Selected wiki: ${bundle.selectedArticles.map((article) => article.slug).join(", ")}`);
console.log("\n## Coaching Output");
console.log(coaching.trim());
console.log("\n## Mistake Extraction");
console.log(JSON.stringify(mistake, null, 2));

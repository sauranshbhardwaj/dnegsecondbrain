import { createApp } from "./app.js";
import { readEnv } from "./config/env.js";

const env = readEnv();
const app = createApp();

app.listen(env.port, () => {
  console.log(`DN Second Brain API listening on port ${env.port}`);
});

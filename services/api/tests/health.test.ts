import { describe, expect, it } from "vitest";

import { createApp } from "../src/app.js";
import { invokeApp } from "./helpers/invoke-app.js";

describe("health route", () => {
  it("reports service health", async () => {
    const response = await invokeApp(createApp(), { url: "/health" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true, service: "dn-second-brain-api" });
  });
});

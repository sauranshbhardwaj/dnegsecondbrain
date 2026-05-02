import { EventEmitter } from "node:events";

import type { Express } from "express";
import httpMocks from "node-mocks-http";

type InvokeOptions = {
  method?: string;
  url: string;
  body?: unknown;
  headers?: Record<string, string>;
};

export async function invokeApp(app: Express, options: InvokeOptions) {
  const req = httpMocks.createRequest({
    method: options.method ?? "GET",
    url: options.url,
    body: options.body,
    headers: options.headers
  });
  Object.assign(req.socket, { destroy: () => undefined });
  const res = httpMocks.createResponse({ eventEmitter: EventEmitter });

  await new Promise<void>((resolve, reject) => {
    const done = () => resolve();
    res.on("end", done);
    res.on("finish", done);
    res.on("error", reject);
    app.handle(req, res);
    setImmediate(() => {
      if (res._isEndCalled()) {
        resolve();
      }
    });
  });

  return {
    status: res.statusCode,
    body: jsonBody(res),
    text: res._getData(),
    headers: res._getHeaders()
  };
}

function jsonBody(res: httpMocks.MockResponse<unknown>): unknown {
  try {
    return res._getJSONData();
  } catch {
    return undefined;
  }
}

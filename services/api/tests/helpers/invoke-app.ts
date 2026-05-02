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
    let interval: ReturnType<typeof setInterval>;
    let timeout: ReturnType<typeof setTimeout>;
    let settled = false;
    const cleanup = () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve();
    };
    const fail = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };
    timeout = setTimeout(() => {
      fail(new Error(`Timed out waiting for app response: status=${res.statusCode} data=${res._getData()}`));
    }, 2000);
    interval = setInterval(() => {
      if (res._isEndCalled()) {
        finish();
      }
    }, 5);
    res.on("end", finish);
    res.on("finish", finish);
    res.on("error", fail);
    app.handle(req, res);
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

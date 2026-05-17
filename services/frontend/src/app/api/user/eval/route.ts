import type { NextRequest } from "next/server";

import { bearerHeaders, nodeApiUrl, proxyJsonResponse, readJsonBody, requireNodeApiAuth } from "@/lib/server/proxy";

export async function POST(request: NextRequest) {
  const auth = await requireNodeApiAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  const body = await readJsonBody(request);

  return proxyJsonResponse(nodeApiUrl("/user/eval"), {
    method: "POST",
    headers: bearerHeaders(auth.token),
    body: JSON.stringify(body)
  });
}

import type { NextRequest } from "next/server";

import { bearerHeaders, nodeApiUrl, proxyJsonResponse, requireNodeApiAuth } from "@/lib/server/proxy";

export async function GET(request: NextRequest) {
  const auth = await requireNodeApiAuth(request);
  if (auth instanceof Response) {
    return auth;
  }

  return proxyJsonResponse(nodeApiUrl("/user/profile"), {
    headers: bearerHeaders(auth.token)
  });
}

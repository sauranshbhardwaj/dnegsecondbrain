import { nodeApiAuthHeaders, nodeApiUrl, proxyJsonResponse, readJsonBody, requireNodeApiAuth } from "@/lib/server/proxy";

export async function POST(request: Request) {
  const auth = await requireNodeApiAuth();
  if (auth instanceof Response) {
    return auth;
  }

  const body = await readJsonBody(request);

  return proxyJsonResponse(nodeApiUrl("/user/eval"), {
    method: "POST",
    headers: nodeApiAuthHeaders(auth),
    body: JSON.stringify(body)
  });
}

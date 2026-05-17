import { nodeApiAuthHeaders, nodeApiUrl, proxyJsonResponse, requireNodeApiAuth } from "@/lib/server/proxy";

export async function GET() {
  const auth = await requireNodeApiAuth();
  if (auth instanceof Response) {
    return auth;
  }

  return proxyJsonResponse(nodeApiUrl("/user/profile"), {
    headers: nodeApiAuthHeaders(auth)
  });
}

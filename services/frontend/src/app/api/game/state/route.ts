import { pokerEngineUrl, proxyGameJsonResponse, requireRouteAuth } from "@/lib/server/proxy";

export async function GET() {
  const auth = await requireRouteAuth();
  if (auth instanceof Response) {
    return auth;
  }

  const url = new URL(pokerEngineUrl("/game/state"));
  url.searchParams.set("userId", auth.userId);

  return proxyGameJsonResponse(url);
}

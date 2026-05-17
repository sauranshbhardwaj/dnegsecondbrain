import { pokerEngineUrl, proxyJsonResponse, readJsonBody, requireRouteAuth } from "@/lib/server/proxy";

export async function POST(request: Request) {
  const auth = await requireRouteAuth();
  if (auth instanceof Response) {
    return auth;
  }

  const body = await readJsonBody(request);

  return proxyJsonResponse(pokerEngineUrl("/game/showdown"), {
    method: "POST",
    body: JSON.stringify({
      ...body,
      userId: auth.userId
    })
  });
}

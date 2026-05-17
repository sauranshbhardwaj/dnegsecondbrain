import { nodeApiAuthHeaders, nodeApiUrl, readJsonBody, requireNodeApiAuth } from "@/lib/server/proxy";

export async function POST(request: Request) {
  const auth = await requireNodeApiAuth();
  if (auth instanceof Response) {
    return auth;
  }

  const body = await readJsonBody(request);

  try {
    const response = await fetch(nodeApiUrl("/coaching/analyze"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...nodeApiAuthHeaders(auth)
      },
      body: JSON.stringify({
        ...body,
        userId: auth.userId
      }),
      cache: "no-store"
    });

    if (!response.ok) {
      const text = await response.text();
      return new Response(text, {
        status: response.status,
        headers: {
          "Content-Type": response.headers.get("Content-Type") ?? "application/json"
        }
      });
    }

    return new Response(response.body, {
      status: response.status,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      }
    });
  } catch (error) {
    return Response.json(
      {
        error: "Coaching proxy failed",
        message: error instanceof Error ? error.message : "Unknown coaching proxy error"
      },
      { status: 502 }
    );
  }
}

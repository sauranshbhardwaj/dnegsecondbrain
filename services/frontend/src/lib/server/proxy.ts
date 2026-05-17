import { auth, getAuth } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";

const JSON_HEADERS = {
  "Content-Type": "application/json"
};

export type AuthContext = {
  userId: string;
  token: string | null;
};

export type NodeApiAuthContext = {
  userId: string;
  token: string;
};

export async function requireRouteAuth(request?: NextRequest): Promise<AuthContext | Response> {
  const session = request ? getAuth(request) : await auth();

  if (!session.userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return {
    userId: session.userId,
    token: await session.getToken()
  };
}

export async function requireNodeApiAuth(request: NextRequest): Promise<NodeApiAuthContext | Response> {
  const authContext = await requireRouteAuth(request);
  if (authContext instanceof Response) {
    return authContext;
  }

  if (!authContext.token) {
    return Response.json({ error: "Unauthorized", message: "Clerk session token missing" }, { status: 401 });
  }

  return {
    userId: authContext.userId,
    token: authContext.token
  };
}

export function pokerEngineUrl(path: string): string {
  const baseUrl = process.env.POKER_ENGINE_URL ?? "http://localhost:8000";
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

export function nodeApiUrl(path: string): string {
  const baseUrl = process.env.NODE_API_URL ?? "http://localhost:3001";
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = (await request.json()) as unknown;
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export async function proxyJsonResponse(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    const response = await fetch(input, {
      ...init,
      headers: {
        ...JSON_HEADERS,
        ...init?.headers
      },
      cache: "no-store"
    });
    const text = await response.text();

    return new Response(text, {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("Content-Type") ?? "application/json"
      }
    });
  } catch (error) {
    return Response.json(
      {
        error: "Proxy request failed",
        message: error instanceof Error ? error.message : "Unknown proxy error"
      },
      { status: 502 }
    );
  }
}

export function bearerHeaders(token: string | null): HeadersInit {
  return token
    ? {
        Authorization: `Bearer ${token}`
      }
    : {};
}

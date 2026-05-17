export function sessionKey(userId: string): string {
  return `session:${userId}:current`;
}

export function mistakesKey(userId: string): string {
  return `mistakes:${userId}`;
}

export function rateLimitHandsKey(userId: string): string {
  return `ratelimit:${userId}:hands`;
}

export function apiKeyKey(userId: string): string {
  return `apikey:${userId}`;
}

export function evalKey(userId: string, timestamp: string): string {
  return `eval:${userId}:${timestamp}`;
}

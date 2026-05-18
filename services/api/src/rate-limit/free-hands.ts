import type { PersistenceRepository } from "../persistence/repository.js";

export const FREE_HAND_LIMIT = 5;

export type RateLimitResult =
  | {
      allowed: true;
      bypassed: boolean;
      count: number;
    }
  | {
      allowed: false;
      status: 402;
      message: string;
      count: number;
    };

export async function checkAndIncrementFreeHandLimit(
  repository: PersistenceRepository,
  userId: string,
  hasUserApiKey: boolean
): Promise<RateLimitResult> {
  if (hasUserApiKey) {
    return { allowed: true, bypassed: true, count: await repository.getFreeHandCount(userId) };
  }

  const claim = await repository.claimFreeHand(userId, FREE_HAND_LIMIT);
  if (!claim.allowed) {
    return {
      allowed: false,
      status: 402,
      count: claim.count,
      message: "Free hand limit reached. Add your Anthropic API key to continue playing unlimited hands."
    };
  }

  return {
    allowed: true,
    bypassed: false,
    count: claim.count
  };
}

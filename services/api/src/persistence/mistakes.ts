import type { MistakeExtraction, MistakeProfileEntry, MistakeSeverity } from "../coaching/types.js";

const SEVERITY_WEIGHT: Record<MistakeSeverity, number> = {
  low: 1,
  medium: 2,
  high: 3
};

export function upsertMistakeProfile(
  existing: MistakeProfileEntry[],
  extraction: MistakeExtraction,
  nowIso: string,
  handId?: string
): MistakeProfileEntry[] {
  if (!extraction.exists) {
    return existing;
  }

  const normalizedPattern = normalizePattern(extraction.pattern);
  const next = existing.map((mistake) => ({ ...mistake, handsContext: [...mistake.handsContext] }));
  const match = next.find((mistake) => normalizePattern(mistake.pattern) === normalizedPattern);

  if (!match) {
    next.push({
      pattern: extraction.pattern,
      firstSeen: nowIso,
      lastSeen: nowIso,
      frequency: 1,
      severity: extraction.severity,
      handsContext: handId ? [handId] : []
    });
    return next;
  }

  match.lastSeen = nowIso;
  match.frequency += 1;
  match.severity = higherSeverity(match.severity, extraction.severity);
  if (handId && !match.handsContext.includes(handId)) {
    match.handsContext.push(handId);
  }

  return next;
}

export function normalizePattern(pattern: string): string {
  return pattern
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function higherSeverity(left: MistakeSeverity, right: MistakeSeverity): MistakeSeverity {
  return SEVERITY_WEIGHT[right] > SEVERITY_WEIGHT[left] ? right : left;
}

import type { Entry } from "@/types";
import type { SessionSummary } from "@/types";

const ACTION_PREFIXES = /^(next:|todo:|action:)/i;
const DECISION_PREFIX = /^decision:/i;
const MAX_ENTRIES = 30;

function isAction(entry: Entry): boolean {
  if (entry.type === "action") return true;
  return ACTION_PREFIXES.test(entry.body.trim());
}

function isDecision(entry: Entry): boolean {
  if (entry.type === "decision") return true;
  return DECISION_PREFIX.test(entry.body.trim());
}

function isQuestion(entry: Entry): boolean {
  if (entry.type === "question") return true;
  const t = entry.body.trim();
  return t.endsWith("?");
}

export function buildHeuristicSummary(entries: Entry[]): SessionSummary {
  const slice = entries.slice(-MAX_ENTRIES);
  const keyPoints: string[] = [];
  const nextActions: string[] = [];
  const openQuestions: string[] = [];

  for (const e of slice) {
    const line = e.body.trim();
    if (isDecision(e)) {
      const text = line.replace(DECISION_PREFIX, "").trim() || line;
      keyPoints.push(`${e.authorDisplayName}: ${text}`);
    }
    if (isAction(e)) {
      const text = line.replace(ACTION_PREFIXES, "").trim() || line;
      nextActions.push(`${e.authorDisplayName}: ${text}`);
    }
    if (isQuestion(e)) {
      openQuestions.push(`${e.authorDisplayName}: ${line}`);
    }
  }

  // Key points: also use first line of notable notes (non-action, non-question) up to 3
  const notable = slice.filter(
    (x) => x.type === "note" && !isAction(x) && !isQuestion(x)
  );
  for (const e of notable.slice(-5)) {
    const first = e.body.trim().split(/\n/)[0];
    if (first && keyPoints.length < 3) keyPoints.push(`${e.authorDisplayName}: ${first}`);
  }
  if (keyPoints.length > 3) keyPoints.splice(0, keyPoints.length - 3);
  if (nextActions.length > 3) nextActions.splice(0, nextActions.length - 3);

  return {
    keyPoints: keyPoints.slice(-3),
    nextActions: nextActions.slice(-3),
    openQuestions: openQuestions.slice(-10),
  };
}

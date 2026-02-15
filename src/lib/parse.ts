import type { EntryType } from "@/types";

// @recipientName: message body here END
const AT_MESSAGE_REGEX = /^\s*@(\S[^:]*):\s*([\s\S]*?)\s*END\s*$/im;

export interface ParsedInput {
  kind: "note" | "message";
  entryType?: EntryType;
  body?: string;
  toDisplayName?: string;
  messageBody?: string;
}

export function parseInput(
  text: string,
  defaultEntryType: EntryType = "note"
): ParsedInput {
  const trimmed = text.trim();
  if (!trimmed) return { kind: "note", body: "", entryType: defaultEntryType };

  const atMatch = trimmed.match(AT_MESSAGE_REGEX);
  if (atMatch) {
    return {
      kind: "message",
      toDisplayName: atMatch[1].trim(),
      messageBody: atMatch[2].trim(),
    };
  }

  const entryType = detectEntryType(trimmed);
  return { kind: "note", body: trimmed, entryType };
}

function detectEntryType(body: string): EntryType {
  const first = body.split(/\n/)[0]?.trim() ?? "";
  if (/^decision:/i.test(first)) return "decision";
  if (/^(next:|todo:|action:)/i.test(first)) return "action";
  if (first.endsWith("?")) return "question";
  return "note";
}

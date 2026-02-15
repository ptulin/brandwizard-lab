"use server";

import * as data from "@/lib/data";
import { getLLMReply, buildRecentContext } from "@/lib/llm";
import type { Entry, EntryType, QueuedMessage } from "@/types";

export async function fetchEntries(): Promise<Entry[]> {
  return data.getEntries();
}

function shouldReplyWithLLM(body: string, type: EntryType): boolean {
  const t = body.trim();
  return type === "question" || t.endsWith("?");
}

export async function postEntry(
  authorDisplayName: string,
  authorNameNorm: string,
  body: string,
  type: EntryType
): Promise<Entry> {
  const entry = await data.addEntry(authorDisplayName, authorNameNorm, body, type);

  if (shouldReplyWithLLM(body, type)) {
    const entries = await data.getEntries();
    const recentContext = buildRecentContext(
      entries.slice(0, -1).map((e) => ({ authorDisplayName: e.authorDisplayName, body: e.body }))
    );
    const reply = await getLLMReply({
      recentContext,
      userMessage: body,
      userName: authorDisplayName,
    });
    if (reply) {
      await data.addEntry("BW", "bw", reply, "note");
    }
  }

  return entry;
}

export async function postParticipant(displayName: string): Promise<{
  id: string;
  nameNorm: string;
  displayName: string;
}> {
  return data.ensureParticipant(displayName);
}

export async function fetchUndeliveredMessages(
  nameNorm: string
): Promise<QueuedMessage[]> {
  return data.getUndeliveredFor(nameNorm);
}

export async function deliverMessages(
  nameNorm: string
): Promise<{ delivered: QueuedMessage[] }> {
  const delivered = await data.deliverAllFor(nameNorm);
  return { delivered };
}

export async function postMessage(
  toDisplayName: string,
  fromDisplayName: string,
  body: string
): Promise<QueuedMessage> {
  return data.queueMessage(toDisplayName, fromDisplayName, body);
}

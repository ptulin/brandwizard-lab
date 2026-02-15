"use server";

import { store } from "@/lib/store";
import type { Entry, EntryType, QueuedMessage } from "@/types";

export async function fetchEntries(): Promise<Entry[]> {
  return store.getEntries();
}

export async function postEntry(
  authorDisplayName: string,
  authorNameNorm: string,
  body: string,
  type: EntryType
): Promise<Entry> {
  return store.addEntry(authorDisplayName, authorNameNorm, body, type);
}

export async function postParticipant(displayName: string): Promise<{
  id: string;
  nameNorm: string;
  displayName: string;
}> {
  return store.ensureParticipant(displayName);
}

export async function fetchUndeliveredMessages(
  nameNorm: string
): Promise<QueuedMessage[]> {
  return store.getUndeliveredFor(nameNorm);
}

export async function deliverMessages(
  nameNorm: string
): Promise<{ delivered: QueuedMessage[] }> {
  const delivered = store.deliverAllFor(nameNorm);
  return { delivered };
}

export async function postMessage(
  toDisplayName: string,
  fromDisplayName: string,
  body: string
): Promise<QueuedMessage> {
  return store.queueMessage(toDisplayName, fromDisplayName, body);
}

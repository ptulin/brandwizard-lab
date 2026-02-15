import * as db from "@/lib/db";
import { store } from "@/lib/store";
import type { Entry, EntryType, QueuedMessage, Participant } from "@/types";

function useSupabase(): boolean {
  return db.hasSupabase();
}

export async function getEntries(): Promise<Entry[]> {
  if (useSupabase()) return db.getEntries();
  return Promise.resolve(store.getEntries());
}

export async function addEntry(
  authorDisplayName: string,
  authorNameNorm: string,
  body: string,
  type: EntryType
): Promise<Entry> {
  if (useSupabase()) return db.addEntry(authorDisplayName, authorNameNorm, body, type);
  return Promise.resolve(store.addEntry(authorDisplayName, authorNameNorm, body, type));
}

export async function ensureParticipant(displayName: string): Promise<Participant> {
  if (useSupabase()) return db.ensureParticipant(displayName);
  return Promise.resolve(store.ensureParticipant(displayName));
}

export async function getParticipants(): Promise<Participant[]> {
  if (useSupabase()) return db.getParticipants();
  return Promise.resolve(store.getParticipants());
}

export async function queueMessage(
  toDisplayName: string,
  fromDisplayName: string,
  body: string
): Promise<QueuedMessage> {
  if (useSupabase()) return db.queueMessage(toDisplayName, fromDisplayName, body);
  return Promise.resolve(store.queueMessage(toDisplayName, fromDisplayName, body));
}

export async function getUndeliveredFor(nameNorm: string): Promise<QueuedMessage[]> {
  if (useSupabase()) return db.getUndeliveredFor(nameNorm);
  return Promise.resolve(store.getUndeliveredFor(nameNorm));
}

export async function deliverAllFor(nameNorm: string): Promise<QueuedMessage[]> {
  if (useSupabase()) return db.deliverAllFor(nameNorm);
  return Promise.resolve(store.deliverAllFor(nameNorm));
}

export async function uploadFile(
  authorDisplayName: string,
  authorNameNorm: string,
  file: File | Blob,
  filename: string
): Promise<{ url: string; filename: string }> {
  if (!useSupabase()) throw new Error("File upload requires Supabase (set env vars).");
  return db.uploadFile(authorDisplayName, authorNameNorm, file, filename);
}

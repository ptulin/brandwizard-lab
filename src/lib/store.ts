import type { Entry, QueuedMessage, Participant } from "@/types";

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

// In-memory store (replaced by Supabase later)
const entries: Entry[] = [];
const messages: QueuedMessage[] = [];
const participants: Participant[] = [];

function uuid(): string {
  return crypto.randomUUID();
}

export const store = {
  // Participants
  ensureParticipant(displayName: string): Participant {
    const nameNorm = normalizeName(displayName);
    let p = participants.find((x) => x.nameNorm === nameNorm);
    if (!p) {
      p = {
        id: uuid(),
        nameNorm,
        displayName: displayName.trim(),
        createdAt: new Date().toISOString(),
      };
      participants.push(p);
    }
    return p;
  },

  getParticipants(): Participant[] {
    return [...participants];
  },

  // Entries
  addEntry(
    authorDisplayName: string,
    authorNameNorm: string,
    body: string,
    type: Entry["type"]
  ): Entry {
    const entry: Entry = {
      id: uuid(),
      authorDisplayName,
      authorNameNorm,
      body: body.trim(),
      type,
      createdAt: new Date().toISOString(),
    };
    entries.push(entry);
    return entry;
  },

  getEntries(): Entry[] {
    return [...entries].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  },

  // Messages: parse @name: body END and queue
  queueMessage(
    toDisplayName: string,
    fromDisplayName: string,
    body: string
  ): QueuedMessage {
    const msg: QueuedMessage = {
      id: uuid(),
      toNameNorm: normalizeName(toDisplayName),
      fromDisplayName,
      body: body.trim(),
      createdAt: new Date().toISOString(),
      deliveredAt: null,
    };
    messages.push(msg);
    return msg;
  },

  getUndeliveredFor(nameNorm: string): QueuedMessage[] {
    return messages.filter(
      (m) => m.toNameNorm === nameNorm && !m.deliveredAt
    );
  },

  markDelivered(id: string): void {
    const m = messages.find((x) => x.id === id);
    if (m) m.deliveredAt = new Date().toISOString();
  },

  deliverAllFor(nameNorm: string): QueuedMessage[] {
    const undelivered = this.getUndeliveredFor(nameNorm);
    undelivered.forEach((m) => (m.deliveredAt = new Date().toISOString()));
    return undelivered;
  },
};

export { normalizeName };

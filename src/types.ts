export type EntryType = "note" | "decision" | "question" | "action";

export interface Entry {
  id: string;
  authorDisplayName: string;
  authorNameNorm: string;
  body: string;
  type: EntryType;
  createdAt: string; // ISO
}

export interface QueuedMessage {
  id: string;
  toNameNorm: string;
  fromDisplayName: string;
  body: string;
  createdAt: string;
  deliveredAt: string | null;
}

export interface Participant {
  id: string;
  nameNorm: string;
  displayName: string;
  createdAt: string;
}

export interface SessionSummary {
  keyPoints: string[];
  nextActions: string[];
  openQuestions: string[];
}

export interface PrototypePrompt {
  problem: string;
  targetUser: string;
  scope: string;
  constraints: string;
  dataModel: string;
  screens: string;
  acceptanceCriteria: string;
  implementationPlan: string;
}

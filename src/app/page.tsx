"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchEntries,
  postEntry,
  postParticipant,
  fetchUndeliveredMessages,
  deliverMessages,
  postMessage,
} from "./actions";
import { buildHeuristicSummary } from "@/lib/summary";
import { buildPrototypePrompt, formatPromptForCopy } from "@/lib/prototype";
import { parseInput } from "@/lib/parse";
import type { Entry, QueuedMessage, SessionSummary, PrototypePrompt } from "@/types";

const NAME_KEY = "bw-lab-name";
const ONBOARDING_TEXT = `Hello — I'm BW (BrandWizard). Type your name to begin.`;

export default function LabPage() {
  const [name, setName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [view, setView] = useState<"main" | "summary" | "prototype" | "mail">("main");
  const [inbox, setInbox] = useState<QueuedMessage[]>([]);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [prototypeIdea, setPrototypeIdea] = useState("");
  const [prototypeOutput, setPrototypeOutput] = useState<PrototypePrompt | null>(null);
  const [inputCollapsed, setInputCollapsed] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const loadName = useCallback(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(NAME_KEY);
    if (stored) setName(stored);
  }, []);

  const loadEntries = useCallback(async () => {
    const list = await fetchEntries();
    setEntries(list);
  }, []);

  useEffect(() => {
    loadName();
  }, [loadName]);

  useEffect(() => {
    if (name) loadEntries();
  }, [name, loadName, loadEntries]);

  const handleSubmitName = useCallback(async () => {
    const displayName = nameInput.trim();
    if (!displayName) return;
    try {
      await postParticipant(displayName);
      localStorage.setItem(NAME_KEY, displayName);
      setName(displayName);
      setNameInput("");
    } catch (e) {
      console.error(e);
    }
  }, [nameInput]);

  const handleSubmitInput = useCallback(async () => {
    if (!name || !inputValue.trim()) return;

    const parsed = parseInput(inputValue);

    if (parsed.kind === "message" && parsed.toDisplayName && parsed.messageBody != null) {
      try {
        await postMessage(parsed.toDisplayName, name, parsed.messageBody);
        setInputValue("");
      } catch (e) {
        console.error(e);
      }
      return;
    }

    // Commands
    const lower = inputValue.trim().toLowerCase();
    if (lower === "@onboarding") {
      setView("main");
      setInputValue("");
      return;
    }
    if (lower === "@checkmail") {
      setView("mail");
      setInputValue("");
      return;
    }
    if (lower === "@prototype") {
      setView("prototype");
      setPrototypeIdea("");
      setPrototypeOutput(null);
      setInputValue("");
      return;
    }
    if (lower === "@summary") {
      setSummary(buildHeuristicSummary(entries));
      setView("summary");
      setInputValue("");
      return;
    }

    // Normal note
    const body = parsed.body ?? inputValue.trim();
    const type = parsed.entryType ?? "note";
    try {
      const nameNorm = name.trim().toLowerCase().replace(/\s+/g, " ");
      await postEntry(name, nameNorm, body, type);
      setInputValue("");
      loadEntries();
    } catch (e) {
      console.error(e);
    }
  }, [name, inputValue, entries, loadEntries]);

  const handleCheckMail = useCallback(async () => {
    if (!name) return;
    const nameNorm = name.trim().toLowerCase().replace(/\s+/g, " ");
    const list = await fetchUndeliveredMessages(nameNorm);
    setInbox(list);
    setView("mail");
    if (list.length) await deliverMessages(nameNorm);
  }, [name]);

  const handleShowSummary = useCallback(() => {
    setSummary(buildHeuristicSummary(entries));
    setView("summary");
  }, [entries]);

  const handlePrototypeGenerate = useCallback(() => {
    setPrototypeOutput(buildPrototypePrompt(prototypeIdea));
  }, [prototypeIdea]);

  const handleCopyPrompt = useCallback(() => {
    if (!prototypeOutput) return;
    const text = formatPromptForCopy(prototypeOutput);
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    });
  }, [prototypeOutput]);

  const hasName = Boolean(name?.trim());

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <header className="border-b border-[var(--border)] px-4 py-3 flex items-center justify-between shrink-0">
        <h1 className="text-lg font-semibold text-burgundy-light">
          BrandWizard Lab
        </h1>
        {hasName && (
          <span className="text-sm text-zinc-400">
            {name}
          </span>
        )}
      </header>

      {!hasName ? (
        <Onboarding
          value={nameInput}
          onChange={setNameInput}
          onSubmit={handleSubmitName}
          placeholderText={ONBOARDING_TEXT}
        />
      ) : (
        <>
          <ActionCards
            onContinue={() => {
              setView("main");
              setInputCollapsed(false);
            }}
            onSummary={handleShowSummary}
            onPrototype={() => {
              setView("prototype");
              setPrototypeIdea("");
              setPrototypeOutput(null);
            }}
            onCheckMail={handleCheckMail}
          />

          {view === "summary" && summary && (
            <SummaryPanel summary={summary} onClose={() => setView("main")} />
          )}
          {view === "prototype" && (
            <PrototypePanel
              idea={prototypeIdea}
              onIdeaChange={setPrototypeIdea}
              output={prototypeOutput}
              onGenerate={handlePrototypeGenerate}
              onCopy={handleCopyPrompt}
              copyFeedback={copyFeedback}
              onClose={() => setView("main")}
            />
          )}
          {view === "mail" && (
            <InboxPanel
              messages={inbox}
              onClose={() => setView("main")}
            />
          )}

          {view === "main" && (
            <>
              <Thread entries={entries} />
              <InputArea
                value={inputValue}
                onChange={setInputValue}
                onSubmit={handleSubmitInput}
                collapsed={inputCollapsed}
                onCollapsedChange={setInputCollapsed}
              />
            </>
          )}
        </>
      )}

      <CommandsHint />
    </div>
  );
}

function Onboarding({
  value,
  onChange,
  onSubmit,
  placeholderText,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  placeholderText: string;
}) {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6">
      <p className="text-xl text-zinc-300 mb-6 text-center max-w-md">
        {placeholderText}
      </p>
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          placeholder="Your name"
          className="flex-1 px-4 py-3 rounded-lg bg-black border border-[var(--border)] text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--burgundy)]"
          autoFocus
        />
        <button
          type="button"
          onClick={onSubmit}
          disabled={!value.trim()}
          className="px-6 py-3 rounded-lg bg-[var(--burgundy)] text-white font-medium disabled:opacity-50 hover:bg-[var(--burgundy-light)]"
        >
          Begin
        </button>
      </div>
    </main>
  );
}

function ActionCards({
  onContinue,
  onSummary,
  onPrototype,
  onCheckMail,
}: {
  onContinue: () => void;
  onSummary: () => void;
  onPrototype: () => void;
  onCheckMail: () => void;
}) {
  const cards = [
    { label: "Continue", onClick: onContinue, desc: "Focus input" },
    { label: "Last session summary", onClick: onSummary, desc: "Key points & actions" },
    { label: "Prototype mode", onClick: onPrototype, desc: "Structured prompt" },
    { label: "Check mail", onClick: onCheckMail, desc: "Inbox" },
  ];
  return (
    <section className="p-4 border-b border-[var(--border)]">
      <p className="text-sm text-zinc-500 mb-3">What do you want to do next?</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={c.onClick}
            className="bento-card text-left p-4 rounded-xl border border-[var(--border)] bg-zinc-900/50 hover:border-[var(--burgundy)] hover:bg-zinc-800/50 transition-colors"
          >
            <span className="font-medium text-white block">{c.label}</span>
            <span className="text-xs text-zinc-500">{c.desc}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function Thread({ entries }: { entries: Entry[] }) {
  return (
    <main className="flex-1 overflow-auto p-4 space-y-3">
      {entries.length === 0 && (
        <p className="text-zinc-500 text-sm">No lab notes yet. Add one below.</p>
      )}
      {entries.map((e) => (
        <div
          key={e.id}
          className="rounded-lg border border-[var(--border)] bg-zinc-900/30 p-3"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-[var(--burgundy-light)]">
              {e.authorDisplayName}
            </span>
            <span className="text-xs text-zinc-500">{e.type}</span>
            <span className="text-xs text-zinc-600 ml-auto">
              {new Date(e.createdAt).toLocaleString()}
            </span>
          </div>
          <p className="text-zinc-200 whitespace-pre-wrap text-sm">{e.body}</p>
        </div>
      ))}
    </main>
  );
}

function InputArea({
  value,
  onChange,
  onSubmit,
  collapsed,
  onCollapsedChange,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  collapsed: boolean;
  onCollapsedChange: (c: boolean) => void;
}) {
  return (
    <div className="shrink-0 border-t border-[var(--border)] bg-black/80 p-4">
      <div className="max-w-3xl mx-auto">
        {collapsed ? (
          <button
            type="button"
            onClick={() => onCollapsedChange(false)}
            className="w-full py-2 text-sm text-zinc-500 border border-dashed border-[var(--border)] rounded-lg"
          >
            Tap to open input
          </button>
        ) : (
          <>
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSubmit();
                }
              }}
              placeholder="Lab note, or @name: message END to send mail"
              rows={3}
              className="w-full px-4 py-3 rounded-lg bg-black border border-[var(--border)] text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--burgundy)] resize-none"
            />
            <div className="flex justify-between items-center mt-2">
              <button
                type="button"
                onClick={() => onCollapsedChange(true)}
                className="text-xs text-zinc-500 md:hidden"
              >
                Collapse
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={!value.trim()}
                className="ml-auto px-4 py-2 rounded-lg bg-[var(--burgundy)] text-white text-sm font-medium disabled:opacity-50 hover:bg-[var(--burgundy-light)]"
              >
                Submit
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryPanel({
  summary,
  onClose,
}: {
  summary: SessionSummary;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-10 bg-black/90 flex flex-col items-center justify-center p-6">
      <div className="max-w-lg w-full rounded-xl border border-[var(--border)] bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold text-[var(--burgundy-light)] mb-4">
          Last session summary
        </h2>
        <div className="space-y-4 text-sm">
          <div>
            <h3 className="text-zinc-500 mb-1">Key points</h3>
            <ul className="list-disc list-inside text-zinc-300 space-y-1">
              {summary.keyPoints.length
                ? summary.keyPoints.map((s, i) => <li key={i}>{s}</li>)
                : <li className="text-zinc-500">None extracted</li>}
            </ul>
          </div>
          <div>
            <h3 className="text-zinc-500 mb-1">Next actions</h3>
            <ul className="list-disc list-inside text-zinc-300 space-y-1">
              {summary.nextActions.length
                ? summary.nextActions.map((s, i) => <li key={i}>{s}</li>)
                : <li className="text-zinc-500">None extracted</li>}
            </ul>
          </div>
          <div>
            <h3 className="text-zinc-500 mb-1">Open questions</h3>
            <ul className="list-disc list-inside text-zinc-300 space-y-1">
              {summary.openQuestions.length
                ? summary.openQuestions.map((s, i) => <li key={i}>{s}</li>)
                : <li className="text-zinc-500">None</li>}
            </ul>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full py-2 rounded-lg border border-[var(--border)] text-zinc-300 hover:bg-zinc-800"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function PrototypePanel({
  idea,
  onIdeaChange,
  output,
  onGenerate,
  onCopy,
  copyFeedback,
  onClose,
}: {
  idea: string;
  onIdeaChange: (v: string) => void;
  output: PrototypePrompt | null;
  onGenerate: () => void;
  onCopy: () => void;
  copyFeedback: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-10 bg-black/90 overflow-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <h2 className="text-lg font-semibold text-[var(--burgundy-light)]">
          Prototype mode
        </h2>
        <div>
          <label className="block text-sm text-zinc-500 mb-2">
            Paste idea or select from thread
          </label>
          <textarea
            value={idea}
            onChange={(e) => onIdeaChange(e.target.value)}
            placeholder="Describe the feature or idea..."
            rows={4}
            className="w-full px-4 py-3 rounded-lg bg-black border border-[var(--border)] text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--burgundy)] resize-none"
          />
        </div>
        <button
          type="button"
          onClick={onGenerate}
          className="px-4 py-2 rounded-lg bg-[var(--burgundy)] text-white font-medium hover:bg-[var(--burgundy-light)]"
        >
          Generate prompt
        </button>
        {output && (
          <div className="rounded-xl border border-[var(--border)] bg-zinc-900 p-6 space-y-4">
            <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-sans">
              {formatPromptForCopy(output)}
            </pre>
            <button
              type="button"
              onClick={onCopy}
              className="px-4 py-2 rounded-lg border border-[var(--burgundy)] text-[var(--burgundy-light)] hover:bg-[var(--burgundy-muted)]"
            >
              {copyFeedback ? "Copied!" : "Copy to clipboard"}
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          className="block w-full py-2 rounded-lg border border-[var(--border)] text-zinc-400 hover:bg-zinc-800"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function InboxPanel({
  messages,
  onClose,
}: {
  messages: QueuedMessage[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-10 bg-black/90 flex flex-col items-center justify-center p-6">
      <div className="max-w-lg w-full rounded-xl border border-[var(--border)] bg-zinc-900 p-6">
        <h2 className="text-lg font-semibold text-[var(--burgundy-light)] mb-4">
          Inbox
        </h2>
        {messages.length === 0 ? (
          <p className="text-zinc-500 text-sm">No new messages.</p>
        ) : (
          <ul className="space-y-3">
            {messages.map((m) => (
              <li
                key={m.id}
                className="rounded-lg border border-[var(--border)] p-3 text-sm"
              >
                <span className="text-zinc-500">From {m.fromDisplayName}:</span>
                <p className="text-zinc-200 mt-1 whitespace-pre-wrap">{m.body}</p>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full py-2 rounded-lg border border-[var(--border)] text-zinc-300 hover:bg-zinc-800"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function CommandsHint() {
  return (
    <footer className="shrink-0 px-4 py-2 border-t border-[var(--border)]">
      <p className="text-xs text-zinc-600">
        Commands: <code className="text-zinc-500">@onboarding</code>{" "}
        <code className="text-zinc-500">@checkmail</code>{" "}
        <code className="text-zinc-500">@prototype</code>{" "}
        <code className="text-zinc-500">@summary</code>
      </p>
    </footer>
  );
}

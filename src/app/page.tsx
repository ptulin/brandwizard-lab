"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchEntries,
  postEntry,
  postParticipant,
  fetchUndeliveredMessages,
  deliverMessages,
  postMessage,
  fetchUploads,
} from "./actions";
import { buildHeuristicSummary } from "@/lib/summary";
import { buildPrototypeFromForm, formatPromptForCopy } from "@/lib/prototype";
import { parseInput } from "@/lib/parse";
import { getSupabaseClientSafe } from "@/lib/supabase/client";
import type { Entry, QueuedMessage, SessionSummary, PrototypePrompt, Upload } from "@/types";
import type { User } from "@supabase/supabase-js";

const NAME_KEY = "bw-lab-name";
const ONBOARDING_TEXT = `Hello — I'm BW (BrandWizard). Type your name to begin.`;
const POLL_INTERVAL_MS = 4000;

export default function LabPage() {
  const [name, setName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [view, setView] = useState<"main" | "summary" | "prototype" | "mail" | "storage">("main");
  const [inbox, setInbox] = useState<QueuedMessage[]>([]);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [prototypeForm, setPrototypeForm] = useState<Partial<PrototypePrompt>>({});
  const [prototypeOutput, setPrototypeOutput] = useState<PrototypePrompt | null>(null);
  const [inputCollapsed, setInputCollapsed] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ title: string; link: string; snippet: string }[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [storageFilter, setStorageFilter] = useState<"all" | "mine">("all");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [addingLink, setAddingLink] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const loadName = useCallback(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(NAME_KEY);
    if (stored) {
      setName(stored);
      return;
    }
    if (authUser?.email) {
      setName(authUser.email);
      localStorage.setItem(NAME_KEY, authUser.email);
    }
  }, [authUser?.email]);

  useEffect(() => {
    const supabase = getSupabaseClientSafe();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data: { user } }) => setAuthUser(user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadEntries = useCallback(async () => {
    try {
      const list = await fetchEntries();
      setEntries(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load thread");
    }
  }, []);

  const loadUploads = useCallback(async () => {
    try {
      const res = await fetch(`/api/uploads?backfill=1&_=${Date.now()}`, { cache: "no-store" });
      const json = (await res.json()) as { uploads?: Upload[]; error?: string };
      if (!res.ok) {
        setError(json.error ?? "Failed to load storage");
        setUploads([]);
        return;
      }
      setError(null);
      setUploads(json.uploads ?? []);
    } catch {
      setUploads([]);
    }
  }, []);

  useEffect(() => {
    loadName();
  }, [loadName, authUser?.email]);

  const handleSignOut = useCallback(async () => {
    const supabase = getSupabaseClientSafe();
    if (supabase) {
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    }
  }, [router]);

  useEffect(() => {
    if (name) loadEntries();
  }, [name, loadEntries]);

  useEffect(() => {
    if (!name || view !== "main") return;
    const id = setInterval(loadEntries, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [name, view, loadEntries]);

  useEffect(() => {
    if (view === "storage" && name) loadUploads();
  }, [view, name, loadUploads]);

  const handleSubmitName = useCallback(async () => {
    const displayName = nameInput.trim();
    if (!displayName) return;
    setError(null);
    try {
      await postParticipant(displayName);
      localStorage.setItem(NAME_KEY, displayName);
      setName(displayName);
      setNameInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save name");
    }
  }, [nameInput]);

  const handleSaveEditName = useCallback(async () => {
    const displayName = editNameValue.trim();
    if (!displayName) return;
    setError(null);
    try {
      await postParticipant(displayName);
      localStorage.setItem(NAME_KEY, displayName);
      setName(displayName);
      setEditNameValue("");
      setEditingName(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update name");
    }
  }, [editNameValue]);

  const handleSubmitInput = useCallback(async () => {
    if (!name || !inputValue.trim()) return;
    setError(null);
    setStatus(null);

    const parsed = parseInput(inputValue);

    if (parsed.kind === "message" && parsed.toDisplayName && parsed.messageBody != null) {
      try {
        await postMessage(parsed.toDisplayName, name, parsed.messageBody);
        setInputValue("");
        setStatus(`Queued for ${parsed.toDisplayName}`);
        setTimeout(() => setStatus(null), 3000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to queue message");
      }
      return;
    }

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
      setPrototypeForm({});
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
    if (lower === "@storage") {
      setView("storage");
      loadUploads();
      setInputValue("");
      return;
    }

    const body = parsed.body ?? inputValue.trim();
    const type = parsed.entryType ?? "note";
    try {
      const nameNorm = name.trim().toLowerCase().replace(/\s+/g, " ");
      await postEntry(name, nameNorm, body, type);
      setInputValue("");
      setStatus("Saved");
      setTimeout(() => setStatus(null), 2000);
      loadEntries();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    }
  }, [name, inputValue, entries, loadEntries]);

  const handleCheckMail = useCallback(async () => {
    if (!name) return;
    setError(null);
    setStatus(null);
    try {
      const nameNorm = name.trim().toLowerCase().replace(/\s+/g, " ");
      const list = await fetchUndeliveredMessages(nameNorm);
      setInbox(list);
      setView("mail");
      if (list.length) await deliverMessages(nameNorm);
      if (list.length) setStatus(`${list.length} delivered`);
      else setStatus("No new messages");
      setTimeout(() => setStatus(null), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load mail");
    }
  }, [name]);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults(null);
    setError(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery.trim())}`);
      const data = (await res.json()) as {
        results?: Array<{ title: string; link: string; snippet: string }>;
        message?: string;
      };
      setSearchResults(data.results ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [searchQuery]);

  const handleAddSearchToThread = useCallback(async () => {
    if (!searchResults?.length || !name) return;
    const nameNorm = name.trim().toLowerCase().replace(/\s+/g, " ");
    const body = `[Search: ${searchQuery}]\n${searchResults.map((r) => `${r.title}: ${r.link}\n${r.snippet}`).join("\n\n")}`;
    setError(null);
    try {
      await postEntry(name, nameNorm, body, "note");
      setStatus("Search results added to thread");
      setTimeout(() => setStatus(null), 2000);
      setSearchResults(null);
      setSearchQuery("");
      loadEntries();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add to thread");
    }
  }, [searchResults, searchQuery, name, loadEntries]);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !name) return;
      setUploading(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.set("file", file);
        formData.set("authorDisplayName", name);
        formData.set("authorNameNorm", name.trim().toLowerCase().replace(/\s+/g, " "));
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error((err as { error?: string }).error ?? res.statusText);
        }
        setStatus("File attached — open Storage to view");
        setTimeout(() => setStatus(null), 4000);
        loadEntries();
        loadUploads();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed";
        setError(msg);
        setStatus(null);
      } finally {
        setUploading(false);
        e.target.value = "";
      }
    },
    [name, loadEntries, loadUploads]
  );

  const handleShowSummary = useCallback(() => {
    setSummary(buildHeuristicSummary(entries));
    setView("summary");
  }, [entries]);

  const handlePrototypeGenerate = useCallback(() => {
    setPrototypeOutput(buildPrototypeFromForm(prototypeForm));
  }, [prototypeForm]);

  const handleCopyPrompt = useCallback(() => {
    if (!prototypeOutput) return;
    const text = formatPromptForCopy(prototypeOutput);
    navigator.clipboard.writeText(text).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    });
  }, [prototypeOutput]);

  const handleAddLink = useCallback(async () => {
    const url = linkUrl.trim();
    if (!url || !name) return;
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      setError("URL must start with http:// or https://");
      return;
    }
    setAddingLink(true);
    setError(null);
    try {
      const res = await fetch("/api/uploads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorDisplayName: name,
          authorNameNorm: name.trim().toLowerCase().replace(/\s+/g, " "),
          url,
          title: linkTitle.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? res.statusText);
      }
      const body = linkTitle.trim() ? `Added link: ${linkTitle.trim()} — ${url}` : `Added link: ${url}`;
      const nameNorm = name.trim().toLowerCase().replace(/\s+/g, " ");
      await postEntry(name, nameNorm, body, "note");
      setLinkUrl("");
      setLinkTitle("");
      setStatus("Link added");
      setTimeout(() => setStatus(null), 2000);
      loadEntries();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add link");
    } finally {
      setAddingLink(false);
    }
  }, [name, linkUrl, linkTitle, loadEntries]);

  const hasName = Boolean(name?.trim());

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <header className="border-b border-[var(--border)] px-4 py-3 flex items-center justify-between shrink-0 flex-wrap gap-2">
        <h1 className="text-lg font-semibold text-burgundy-light">
          BrandWizard Lab
        </h1>
        {hasName && !editingName && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-400">{name}</span>
            <button
              type="button"
              onClick={() => {
                setEditNameValue(name);
                setEditingName(true);
              }}
              className="text-xs text-zinc-500 hover:text-zinc-300"
              aria-label="Edit name"
            >
              Edit
            </button>
          </div>
        )}
        {hasName && editingName && (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={editNameValue}
              onChange={(e) => setEditNameValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveEditName()}
              className="w-32 px-2 py-1 rounded bg-black border border-[var(--border)] text-sm text-white"
              autoFocus
            />
            <button
              type="button"
              onClick={handleSaveEditName}
              className="text-xs text-[var(--burgundy-light)] hover:underline"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditingName(false)}
              className="text-xs text-zinc-500 hover:underline"
            >
              Cancel
            </button>
          </div>
        )}
        {authUser && (
          <button
            type="button"
            onClick={handleSignOut}
            className="text-xs text-zinc-500 hover:text-zinc-300 border border-[var(--border)] px-2 py-1 rounded"
          >
            Sign out
          </button>
        )}
      </header>
      {(error || status) && (
        <div className="shrink-0 px-4 py-2 border-b border-[var(--border)]">
          {error && <p className="text-sm text-red-400">{error}</p>}
          {status && !error && <p className="text-sm text-zinc-400">{status}</p>}
        </div>
      )}

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
              setPrototypeForm({});
              setPrototypeOutput(null);
            }}
            onCheckMail={handleCheckMail}
            onStorage={() => {
              setView("storage");
              loadUploads();
            }}
          />

          {view === "summary" && summary && (
            <SummaryPanel summary={summary} onClose={() => setView("main")} />
          )}
          {view === "prototype" && (
            <PrototypePanel
              form={prototypeForm}
              onFormChange={setPrototypeForm}
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
          {view === "storage" && (
            <StoragePanel
              uploads={uploads}
              filter={storageFilter}
              onFilterChange={setStorageFilter}
              currentNameNorm={name ? name.trim().toLowerCase().replace(/\s+/g, " ") : ""}
              onClose={() => setView("main")}
              onRefresh={loadUploads}
              onForward={async (upload, toDisplayName) => {
                const body = `Attached: ${upload.title || upload.filename || upload.url}\n${upload.url}`;
                await postMessage(toDisplayName, name ?? "", body);
                setStatus(`Sent to ${toDisplayName}`);
                setTimeout(() => setStatus(null), 2000);
              }}
            />
          )}

          {view === "main" && (
            <>
              <Thread entries={entries} />
              {searchResults !== null && (
                <div className="shrink-0 px-4 py-2 border-t border-[var(--border)] bg-zinc-900/50">
                  <div className="max-w-3xl mx-auto">
                    <p className="text-xs text-zinc-500 mb-2">Web search results</p>
                    {searchResults.length === 0 ? (
                      <p className="text-sm text-zinc-500">No results or search not configured.</p>
                    ) : (
                      <>
                        <ul className="text-sm text-zinc-300 space-y-1 mb-2 max-h-32 overflow-auto">
                          {searchResults.map((r, i) => (
                            <li key={i}>
                              <a href={r.link} target="_blank" rel="noopener noreferrer" className="text-[var(--burgundy-light)] hover:underline">{r.title}</a>
                            </li>
                          ))}
                        </ul>
                        <button
                          type="button"
                          onClick={handleAddSearchToThread}
                          className="text-xs text-zinc-400 hover:text-white border border-[var(--border)] px-2 py-1 rounded"
                        >
                          Add to thread
                        </button>
                      </>
                    )}
                    <button type="button" onClick={() => setSearchResults(null)} className="text-xs text-zinc-500 ml-2">Close</button>
                  </div>
                </div>
              )}
              <div className="shrink-0 px-4 py-2 border-t border-[var(--border)] flex gap-2 items-center max-w-3xl mx-auto">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Search web…"
                  className="flex-1 px-3 py-1.5 rounded bg-black border border-[var(--border)] text-sm text-white placeholder:text-zinc-500"
                />
                <button
                  type="button"
                  onClick={handleSearch}
                  disabled={searching || !searchQuery.trim()}
                  className="text-xs text-zinc-400 hover:text-white border border-[var(--border)] px-2 py-1.5 rounded disabled:opacity-50"
                >
                  {searching ? "…" : "Search"}
                </button>
              </div>
              <div className="shrink-0 px-4 py-2 border-t border-[var(--border)] max-w-3xl mx-auto flex flex-wrap gap-2 items-center">
                <span className="text-xs text-zinc-500">Add link:</span>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://…"
                  className="flex-1 min-w-[120px] px-3 py-1.5 rounded bg-black border border-[var(--border)] text-sm text-white placeholder:text-zinc-500"
                />
                <input
                  type="text"
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  placeholder="Title (optional)"
                  className="w-32 px-3 py-1.5 rounded bg-black border border-[var(--border)] text-sm text-white placeholder:text-zinc-500"
                />
                <button
                  type="button"
                  onClick={handleAddLink}
                  disabled={addingLink || !linkUrl.trim()}
                  className="text-xs text-zinc-400 hover:text-white border border-[var(--border)] px-2 py-1.5 rounded disabled:opacity-50"
                >
                  {addingLink ? "…" : "Add link"}
                </button>
              </div>
              <InputArea
                value={inputValue}
                onChange={setInputValue}
                onSubmit={handleSubmitInput}
                collapsed={inputCollapsed}
                onCollapsedChange={setInputCollapsed}
                onUploadClick={() => fileInputRef.current?.click()}
                uploading={uploading}
              />
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileUpload}
                aria-hidden
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
  onStorage,
}: {
  onContinue: () => void;
  onSummary: () => void;
  onPrototype: () => void;
  onCheckMail: () => void;
  onStorage: () => void;
}) {
  const cards = [
    { label: "Continue", onClick: onContinue, desc: "Focus input" },
    { label: "Last session summary", onClick: onSummary, desc: "Key points & actions" },
    { label: "Prototype mode", onClick: onPrototype, desc: "Structured prompt" },
    { label: "Check mail", onClick: onCheckMail, desc: "Inbox" },
    { label: "Storage", onClick: onStorage, desc: "Docs, links, screenshots" },
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
          {e.type === "file" ? (
            <FileEntryBody body={e.body} />
          ) : (
            <p className="text-zinc-200 whitespace-pre-wrap text-sm">{e.body}</p>
          )}
        </div>
      ))}
    </main>
  );
}

function FileEntryBody({ body }: { body: string }) {
  const [filename, url] = body.split("\n");
  const href = url?.trim() || body;
  const label = filename?.trim() || "File";
  return (
    <div className="text-sm">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--burgundy-light)] hover:underline"
      >
        {label}
      </a>
      <span className="text-zinc-500 ml-2">(file)</span>
    </div>
  );
}

function InputArea({
  value,
  onChange,
  onSubmit,
  collapsed,
  onCollapsedChange,
  onUploadClick,
  uploading,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  collapsed: boolean;
  onCollapsedChange: (c: boolean) => void;
  onUploadClick: () => void;
  uploading: boolean;
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
            <div className="flex justify-between items-center mt-2 gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => onCollapsedChange(true)}
                className="text-xs text-zinc-500 md:hidden"
              >
                Collapse
              </button>
              <button
                type="button"
                onClick={onUploadClick}
                disabled={uploading}
                className="text-xs text-zinc-400 hover:text-zinc-200 border border-[var(--border)] px-2 py-1 rounded disabled:opacity-50"
              >
                {uploading ? "Uploading…" : "Attach file"}
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

const PROTOTYPE_FIELDS: { key: keyof PrototypePrompt; label: string; rows?: number }[] = [
  { key: "targetUser", label: "Target user" },
  { key: "problem", label: "Core problem", rows: 3 },
  { key: "scope", label: "MVP scope" },
  { key: "constraints", label: "Constraints" },
  { key: "inputsOutputs", label: "Inputs / Outputs" },
  { key: "successMetric", label: "Success metric" },
  { key: "dataModel", label: "Data model", rows: 2 },
  { key: "screens", label: "Screens" },
  { key: "acceptanceCriteria", label: "Acceptance criteria", rows: 2 },
  { key: "implementationPlan", label: "Implementation plan", rows: 2 },
];

function PrototypePanel({
  form,
  onFormChange,
  output,
  onGenerate,
  onCopy,
  copyFeedback,
  onClose,
}: {
  form: Partial<PrototypePrompt>;
  onFormChange: (f: Partial<PrototypePrompt>) => void;
  output: PrototypePrompt | null;
  onGenerate: () => void;
  onCopy: () => void;
  copyFeedback: boolean;
  onClose: () => void;
}) {
  const update = (key: keyof PrototypePrompt, value: string) => {
    onFormChange({ ...form, [key]: value });
  };
  return (
    <div className="fixed inset-0 z-10 bg-black/90 overflow-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <h2 className="text-lg font-semibold text-[var(--burgundy-light)]">
          Prototype mode
        </h2>
        <p className="text-sm text-zinc-500">
          Fill in the fields below. Generate to build a copy-ready prompt.
        </p>
        <div className="space-y-4">
          {PROTOTYPE_FIELDS.map(({ key, label, rows = 1 }) => (
            <div key={key}>
              <label className="block text-sm text-zinc-500 mb-1">{label}</label>
              {rows > 1 ? (
                <textarea
                  value={form[key] ?? ""}
                  onChange={(e) => update(key, e.target.value)}
                  placeholder={label}
                  rows={rows}
                  className="w-full px-4 py-2 rounded-lg bg-black border border-[var(--border)] text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--burgundy)] resize-none text-sm"
                />
              ) : (
                <input
                  type="text"
                  value={form[key] ?? ""}
                  onChange={(e) => update(key, e.target.value)}
                  placeholder={label}
                  className="w-full px-4 py-2 rounded-lg bg-black border border-[var(--border)] text-white placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-[var(--burgundy)] text-sm"
                />
              )}
            </div>
          ))}
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

function StoragePanel({
  uploads,
  filter,
  onFilterChange,
  currentNameNorm,
  onClose,
  onRefresh,
  onForward,
}: {
  uploads: Upload[];
  filter: "all" | "mine";
  onFilterChange: (f: "all" | "mine") => void;
  currentNameNorm: string;
  onClose: () => void;
  onRefresh: () => void;
  onForward: (upload: Upload, toDisplayName: string) => Promise<void>;
}) {
  const [forwarding, setForwarding] = useState<Upload | null>(null);
  const [forwardTo, setForwardTo] = useState("");
  const [forwardingState, setForwardingState] = useState<"idle" | "sending" | "done">("idle");

  const filtered =
    filter === "mine"
      ? uploads.filter((u) => u.uploaderNameNorm === currentNameNorm)
      : uploads;
  const label = (k: Upload["kind"]) => (k === "file" ? "File" : k === "link" ? "Link" : "Screenshot");

  const handleSendForward = useCallback(async () => {
    if (!forwarding || !forwardTo.trim()) return;
    setForwardingState("sending");
    try {
      await onForward(forwarding, forwardTo.trim());
      setForwarding(null);
      setForwardTo("");
      setForwardingState("done");
    } catch {
      setForwardingState("idle");
    }
  }, [forwarding, forwardTo, onForward]);

  return (
    <div className="fixed inset-0 z-10 bg-black/90 flex flex-col items-center p-6">
      <div className="max-w-2xl w-full flex flex-col max-h-full">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold text-[var(--burgundy-light)]">
            Storage — docs, links, screenshots
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-zinc-500 hover:text-zinc-300 border border-[var(--border)] px-2 py-1 rounded"
          >
            Close
          </button>
        </div>
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => onFilterChange("all")}
            className={`text-xs px-2 py-1 rounded border ${filter === "all" ? "border-[var(--burgundy)] text-white" : "border-[var(--border)] text-zinc-500"}`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => onFilterChange("mine")}
            className={`text-xs px-2 py-1 rounded border ${filter === "mine" ? "border-[var(--burgundy)] text-white" : "border-[var(--border)] text-zinc-500"}`}
          >
            Mine
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="text-xs text-zinc-500 hover:text-zinc-300 border border-[var(--border)] px-2 py-1 rounded ml-auto"
          >
            Refresh
          </button>
        </div>
        <ul className="flex-1 overflow-auto space-y-2 border border-[var(--border)] rounded-lg p-3 bg-zinc-900/50">
          {filtered.length === 0 ? (
            <li className="text-zinc-500 text-sm space-y-2">
              <p>No uploads yet. Add files or links from the main view, or click Refresh to sync.</p>
              <p className="text-xs">
                <a href="/api/uploads?backfill=1&debug=1" target="_blank" rel="noopener noreferrer" className="text-[var(--burgundy-light)] hover:underline">Check what the server sees</a>
              </p>
            </li>
          ) : (
            filtered.map((u) => (
              <li
                key={u.id}
                className="rounded border border-[var(--border)] p-2 bg-black/50 space-y-2"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-zinc-500 shrink-0 w-16">{label(u.kind)}</span>
                  <span className="text-xs text-zinc-500 shrink-0">{u.uploaderDisplayName}</span>
                  <a
                    href={u.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-0 truncate text-sm text-[var(--burgundy-light)] hover:underline"
                    title={u.url}
                  >
                    {u.title || u.filename || u.url}
                  </a>
                  <span className="text-xs text-zinc-600 shrink-0">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </span>
                  <a
                    href={u.url}
                    download={(u.filename || u.title || "file") as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-zinc-400 hover:text-white border border-[var(--border)] px-2 py-0.5 rounded shrink-0"
                  >
                    Download
                  </a>
                  <button
                    type="button"
                    onClick={() => setForwarding(u)}
                    className="text-xs text-zinc-400 hover:text-white border border-[var(--border)] px-2 py-0.5 rounded shrink-0"
                  >
                    Forward
                  </button>
                </div>
                {forwarding?.id === u.id && (
                  <div className="flex gap-2 items-center pl-4">
                    <span className="text-xs text-zinc-500">To:</span>
                    <input
                      type="text"
                      value={forwardTo}
                      onChange={(e) => setForwardTo(e.target.value)}
                      placeholder="Display name"
                      className="flex-1 min-w-0 px-2 py-1 rounded bg-black border border-[var(--border)] text-sm text-white placeholder:text-zinc-500"
                    />
                    <button
                      type="button"
                      onClick={handleSendForward}
                      disabled={forwardingState === "sending" || !forwardTo.trim()}
                      className="text-xs text-[var(--burgundy-light)] border border-[var(--burgundy)] px-2 py-1 rounded disabled:opacity-50"
                    >
                      {forwardingState === "sending" ? "…" : "Send"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setForwarding(null); setForwardTo(""); setForwardingState("idle"); }}
                      className="text-xs text-zinc-500 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </li>
            ))
          )}
        </ul>
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
        <code className="text-zinc-500">@summary</code>{" "}
        <code className="text-zinc-500">@storage</code>
      </p>
    </footer>
  );
}

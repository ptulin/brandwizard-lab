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

  const setViewWithUrl = useCallback(
    (v: "main" | "summary" | "prototype" | "mail" | "storage") => {
      setView(v);
      const url = new URL(window.location.href);
      if (v === "main") {
        url.searchParams.delete("view");
      } else {
        url.searchParams.set("view", v);
      }
      const newUrl = url.pathname + url.search;
      window.history.replaceState(null, "", newUrl);
      router.replace(newUrl, { scroll: false });
    },
    [router]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const v = new URLSearchParams(window.location.search).get("view");
    if (v === "storage" || v === "mail" || v === "summary" || v === "prototype") setView(v);
  }, []);

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
      setViewWithUrl("main");
      setInputValue("");
      return;
    }
    if (lower === "@checkmail") {
      setViewWithUrl("mail");
      setInputValue("");
      return;
    }
    if (lower === "@prototype") {
      setViewWithUrl("prototype");
      setPrototypeForm({});
      setPrototypeOutput(null);
      setInputValue("");
      return;
    }
    if (lower === "@summary") {
      setSummary(buildHeuristicSummary(entries));
      setViewWithUrl("summary");
      setInputValue("");
      return;
    }
    if (lower === "@storage") {
      setViewWithUrl("storage");
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
      setViewWithUrl("mail");
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
        const json = (await res.json().catch(() => ({}))) as { summary?: string; error?: string };
        if (!res.ok) {
          throw new Error(json.error ?? res.statusText ?? "Upload failed");
        }
        const msg = json.summary ?? `Attached: ${file.name} — open Storage to view`;
        setStatus(msg);
        setError(null);
        setTimeout(() => setStatus(null), 6000);
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
    setViewWithUrl("summary");
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
    <div className="h-screen bg-white text-black flex flex-col overflow-hidden">
      <header className="border-b border-[var(--border)] px-4 py-3 flex items-center justify-between shrink-0 flex-wrap gap-2">
        <h1 className="text-lg font-semibold text-burgundy-light">
          BrandWizard Lab
        </h1>
        {hasName && !editingName && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">{name}</span>
            <button
              type="button"
              onClick={() => {
                setEditNameValue(name);
                setEditingName(true);
              }}
              className="text-xs text-gray-600 hover:text-gray-700"
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
              className="w-32 px-2 py-1 rounded bg-gray-50 border border-[var(--border)] text-sm text-black"
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
              className="text-xs text-gray-600 hover:underline"
            >
              Cancel
            </button>
          </div>
        )}
        {authUser && (
          <button
            type="button"
            onClick={handleSignOut}
            className="text-xs text-gray-600 hover:text-gray-700 border border-[var(--border)] px-2 py-1 rounded"
          >
            Sign out
          </button>
        )}
      </header>
      {(error || status) && (
        <div className="shrink-0 px-4 py-2.5 border-b border-[var(--border)] bg-gray-50">
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          {status && !error && <p className="text-sm font-medium text-green-700">{status}</p>}
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
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <ActionCards
            onContinue={() => {
              setViewWithUrl("main");
              setInputCollapsed(false);
            }}
            onSummary={handleShowSummary}
            onPrototype={() => {
              setViewWithUrl("prototype");
              setPrototypeForm({});
              setPrototypeOutput(null);
            }}
            onCheckMail={handleCheckMail}
            onStorage={() => {
              setViewWithUrl("storage");
              loadUploads();
            }}
          />

          {view === "summary" && summary && (
            <SummaryPanel summary={summary} onClose={() => setViewWithUrl("main")} />
          )}
          {view === "prototype" && (
            <PrototypePanel
              form={prototypeForm}
              onFormChange={setPrototypeForm}
              output={prototypeOutput}
              onGenerate={handlePrototypeGenerate}
              onCopy={handleCopyPrompt}
              copyFeedback={copyFeedback}
              onClose={() => setViewWithUrl("main")}
            />
          )}
          {view === "mail" && (
            <InboxPanel
              messages={inbox}
              onClose={() => setViewWithUrl("main")}
            />
          )}
          {view === "storage" && (
            <StoragePanel
              uploads={uploads}
              filter={storageFilter}
              onFilterChange={setStorageFilter}
              currentNameNorm={name ? name.trim().toLowerCase().replace(/\s+/g, " ") : ""}
              onClose={() => setViewWithUrl("main")}
              onRefresh={loadUploads}
              onDelete={async (upload) => {
                const res = await fetch("/api/uploads", {
                  method: "DELETE",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ id: upload.id, url: upload.url }),
                });
                if (!res.ok) throw new Error((await res.json()).error ?? "Delete failed");
                loadUploads();
              }}
              onForward={async (upload, toDisplayName) => {
                const body = `Attached: ${upload.title || upload.filename || upload.url}\n${upload.url}`;
                await postMessage(toDisplayName, name ?? "", body);
                setStatus(`Sent to ${toDisplayName}`);
                setTimeout(() => setStatus(null), 2000);
              }}
            />
          )}

          {(view === "main" || view === "storage") && (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <div className="flex-1 min-h-0 overflow-auto">
                <Thread entries={entries} />
                {searchResults !== null && (
                <div className="shrink-0 px-4 py-2 border-t border-[var(--border)] bg-gray-100">
                  <div className="max-w-3xl mx-auto">
                    <p className="text-xs text-gray-600 mb-2">Web search results</p>
                    {searchResults.length === 0 ? (
                      <p className="text-sm text-gray-600">No results or search not configured.</p>
                    ) : (
                      <>
                        <ul className="text-sm text-gray-700 space-y-1 mb-2 max-h-32 overflow-auto">
                          {searchResults.map((r, i) => (
                            <li key={i}>
                              <a href={r.link} target="_blank" rel="noopener noreferrer" className="text-[var(--burgundy-light)] hover:underline">{r.title}</a>
                            </li>
                          ))}
                        </ul>
                        <button
                          type="button"
                          onClick={handleAddSearchToThread}
                          className="text-xs text-gray-600 hover:text-black border border-[var(--border)] px-2 py-1 rounded"
                        >
                          Add to thread
                        </button>
                      </>
                    )}
                    <button type="button" onClick={() => setSearchResults(null)} className="text-xs text-gray-600 ml-2">Close</button>
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
                  className="flex-1 px-3 py-1.5 rounded bg-gray-50 border border-[var(--border)] text-sm text-black placeholder:text-gray-600"
                />
                <button
                  type="button"
                  onClick={handleSearch}
                  disabled={searching || !searchQuery.trim()}
                  className="text-xs text-gray-600 hover:text-black border border-[var(--border)] px-2 py-1.5 rounded disabled:opacity-50"
                >
                  {searching ? "…" : "Search"}
                </button>
              </div>
              <div className="shrink-0 px-4 py-2 border-t border-[var(--border)] max-w-3xl mx-auto flex flex-wrap gap-2 items-center">
                <span className="text-xs text-gray-600">Add link:</span>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://…"
                  className="flex-1 min-w-[120px] px-3 py-1.5 rounded bg-gray-50 border border-[var(--border)] text-sm text-black placeholder:text-gray-600"
                />
                <input
                  type="text"
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                  placeholder="Title (optional)"
                  className="w-32 px-3 py-1.5 rounded bg-gray-50 border border-[var(--border)] text-sm text-black placeholder:text-gray-600"
                />
                <button
                  type="button"
                  onClick={handleAddLink}
                  disabled={addingLink || !linkUrl.trim()}
                  className="text-xs text-gray-600 hover:text-black border border-[var(--border)] px-2 py-1.5 rounded disabled:opacity-50"
                >
                  {addingLink ? "…" : "Add link"}
                </button>
              </div>
              </div>
              <div className="shrink-0 border-t border-[var(--border)] bg-white">
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
              <CommandsHint />
              </div>
            </div>
          )}
        </div>
      )}

      {hasName && view !== "main" && <CommandsHint />}
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
      <p className="text-xl text-gray-700 mb-6 text-center max-w-md">
        {placeholderText}
      </p>
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          placeholder="Your name"
          className="flex-1 px-4 py-3 rounded-lg bg-gray-50 border border-[var(--border)] text-black placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--burgundy)]"
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
    <section className="p-4 border-b-2 border-[var(--border)]">
      <p className="text-sm font-medium text-gray-700 mb-3">What do you want to do next?</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={c.onClick}
            className="bento-card text-left p-4 rounded-xl border-2 border-[var(--border)] bg-white shadow-sm hover:border-[var(--burgundy)] hover:shadow-md transition-colors"
          >
            <span className="font-medium text-black block">{c.label}</span>
            <span className="text-xs text-gray-600">{c.desc}</span>
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
        <p className="text-gray-600 text-sm">No lab notes yet. Add one below.</p>
      )}
      {entries.map((e) => (
        <div
          key={e.id}
          className="rounded-lg border-2 border-[var(--border)] bg-white shadow-sm p-3"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-[var(--burgundy-light)]">
              {e.authorDisplayName}
            </span>
            <span className="text-xs text-gray-600">{e.type}</span>
            <span className="text-xs text-gray-500 ml-auto">
              {new Date(e.createdAt).toLocaleString()}
            </span>
          </div>
          {e.type === "file" ? (
            <FileEntryBody body={e.body} />
          ) : (
            <p className="text-gray-800 whitespace-pre-wrap text-sm">{e.body}</p>
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
      <span className="text-gray-600 ml-2">(file)</span>
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
    <div className="shrink-0 border-t border-[var(--border)] bg-gray-50 p-4">
      <div className="max-w-3xl mx-auto">
        {collapsed ? (
          <button
            type="button"
            onClick={() => onCollapsedChange(false)}
            className="w-full py-2 text-sm text-gray-600 border border-dashed border-[var(--border)] rounded-lg"
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
              className="w-full px-4 py-3 rounded-lg bg-gray-50 border border-[var(--border)] text-black placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--burgundy)] resize-none"
            />
            <div className="flex justify-between items-center mt-2 gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => onCollapsedChange(true)}
                className="text-xs text-gray-600 md:hidden"
              >
                Collapse
              </button>
              <button
                type="button"
                onClick={onUploadClick}
                disabled={uploading}
                className="text-xs text-gray-600 hover:text-gray-800 border border-[var(--border)] px-2 py-1 rounded disabled:opacity-50"
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
    <div className="fixed inset-0 z-10 bg-black/40 flex flex-col items-center justify-center p-6">
      <div className="max-w-lg w-full rounded-xl border-2 border-[var(--border)] bg-white shadow-xl p-6">
        <h2 className="text-lg font-semibold text-[var(--burgundy-light)] mb-4">
          Last session summary
        </h2>
        <div className="space-y-4 text-sm">
          <div>
            <h3 className="text-gray-600 mb-1">Key points</h3>
            <ul className="list-disc list-inside text-gray-700 space-y-1">
              {summary.keyPoints.length
                ? summary.keyPoints.map((s, i) => <li key={i}>{s}</li>)
                : <li className="text-gray-600">None extracted</li>}
            </ul>
          </div>
          <div>
            <h3 className="text-gray-600 mb-1">Next actions</h3>
            <ul className="list-disc list-inside text-gray-700 space-y-1">
              {summary.nextActions.length
                ? summary.nextActions.map((s, i) => <li key={i}>{s}</li>)
                : <li className="text-gray-600">None extracted</li>}
            </ul>
          </div>
          <div>
            <h3 className="text-gray-600 mb-1">Open questions</h3>
            <ul className="list-disc list-inside text-gray-700 space-y-1">
              {summary.openQuestions.length
                ? summary.openQuestions.map((s, i) => <li key={i}>{s}</li>)
                : <li className="text-gray-600">None</li>}
            </ul>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full py-2 rounded-lg border-2 border-[var(--border)] text-gray-700 font-medium hover:bg-gray-100"
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
    <div className="fixed inset-0 z-10 bg-black/40 overflow-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6 rounded-xl border-2 border-[var(--border)] bg-white shadow-xl p-6">
        <h2 className="text-lg font-semibold text-[var(--burgundy-light)]">
          Prototype mode
        </h2>
        <p className="text-sm text-gray-600">
          Fill in the fields below. Generate to build a copy-ready prompt.
        </p>
        <div className="space-y-4">
          {PROTOTYPE_FIELDS.map(({ key, label, rows = 1 }) => (
            <div key={key}>
              <label className="block text-sm text-gray-600 mb-1">{label}</label>
              {rows > 1 ? (
                <textarea
                  value={form[key] ?? ""}
                  onChange={(e) => update(key, e.target.value)}
                  placeholder={label}
                  rows={rows}
                  className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-[var(--border)] text-black placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--burgundy)] resize-none text-sm"
                />
              ) : (
                <input
                  type="text"
                  value={form[key] ?? ""}
                  onChange={(e) => update(key, e.target.value)}
                  placeholder={label}
                  className="w-full px-4 py-2 rounded-lg bg-gray-50 border border-[var(--border)] text-black placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-[var(--burgundy)] text-sm"
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
          <div className="rounded-xl border border-[var(--border)] bg-gray-50 p-6 space-y-4">
            <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
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
          className="block w-full py-2 rounded-lg border-2 border-[var(--border)] text-gray-700 font-medium hover:bg-gray-100"
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
    <div className="fixed inset-0 z-10 bg-black/40 flex flex-col items-center justify-center p-6">
      <div className="max-w-lg w-full rounded-xl border-2 border-[var(--border)] bg-white shadow-xl p-6">
        <h2 className="text-lg font-semibold text-[var(--burgundy)] mb-4">
          Inbox
        </h2>
        {messages.length === 0 ? (
          <p className="text-gray-600 text-sm">No new messages.</p>
        ) : (
          <ul className="space-y-3">
            {messages.map((m) => (
              <li
                key={m.id}
                className="rounded-lg border-2 border-[var(--border)] p-3 text-sm bg-white shadow-sm"
              >
                <span className="text-gray-600">From {m.fromDisplayName}:</span>
                <p className="text-gray-800 mt-1 whitespace-pre-wrap">{m.body}</p>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full py-2 rounded-lg border-2 border-[var(--border)] text-gray-700 font-medium hover:bg-gray-100"
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
  onDelete,
  onForward,
}: {
  uploads: Upload[];
  filter: "all" | "mine";
  onFilterChange: (f: "all" | "mine") => void;
  currentNameNorm: string;
  onClose: () => void;
  onRefresh: () => void;
  onDelete: (upload: Upload) => Promise<void>;
  onForward: (upload: Upload, toDisplayName: string) => Promise<void>;
}) {
  const [forwarding, setForwarding] = useState<Upload | null>(null);
  const [forwardTo, setForwardTo] = useState("");
  const [forwardingState, setForwardingState] = useState<"idle" | "sending" | "done">("idle");
  const [deleting, setDeleting] = useState<Set<string>>(new Set());

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

  const handleDelete = useCallback(
    async (u: Upload) => {
      setDeleting((s) => new Set(s).add(u.id));
      try {
        await onDelete(u);
      } finally {
        setDeleting((s) => {
          const next = new Set(s);
          next.delete(u.id);
          return next;
        });
      }
    },
    [onDelete]
  );

  return (
    <div className="fixed inset-0 z-10 bg-black/25 flex flex-col items-center justify-center p-4">
      <div className="max-w-2xl w-full flex flex-col max-h-[85vh] rounded-xl border-2 border-[var(--border)] bg-white shadow-xl p-4">
        <div className="flex items-center justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold text-[var(--burgundy)]">
            Storage — docs, links, screenshots
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-700 hover:text-black border-2 border-[var(--border)] px-3 py-1.5 rounded-lg font-medium"
          >
            Close
          </button>
        </div>
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => onFilterChange("all")}
            className={`text-sm px-3 py-1.5 rounded-lg border-2 font-medium ${filter === "all" ? "border-[var(--burgundy)] bg-[var(--burgundy)] text-white" : "border-[var(--border)] text-gray-700 hover:bg-gray-100"}`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => onFilterChange("mine")}
            className={`text-sm px-3 py-1.5 rounded-lg border-2 font-medium ${filter === "mine" ? "border-[var(--burgundy)] bg-[var(--burgundy)] text-white" : "border-[var(--border)] text-gray-700 hover:bg-gray-100"}`}
          >
            Mine
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="text-sm text-gray-700 hover:text-black border-2 border-[var(--border)] px-3 py-1.5 rounded-lg font-medium ml-auto"
          >
            Refresh
          </button>
        </div>
        <ul className="flex-1 overflow-auto space-y-3 border-2 border-[var(--border)] rounded-lg p-4 bg-gray-50">
          {filtered.length === 0 ? (
            <li className="text-gray-600 text-sm py-4">
              No uploads yet. Add files or links from the main view, or click Refresh to sync.
            </li>
          ) : (
            filtered.map((u) => (
              <li
                key={u.id}
                className="rounded-lg border-2 border-[var(--border)] p-3 bg-white shadow-sm space-y-2"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-gray-600 shrink-0 w-16">{label(u.kind)}</span>
                  <span className="text-xs text-gray-600 shrink-0">{u.uploaderDisplayName}</span>
                  <a
                    href={u.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-0 truncate text-sm font-medium text-[var(--burgundy)] hover:underline"
                    title={u.url}
                  >
                    {u.title || u.filename || u.url}
                  </a>
                  <span className="text-xs text-gray-500 shrink-0">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </span>
                  <a
                    href={u.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-gray-700 hover:text-black border-2 border-[var(--border)] px-2 py-1 rounded shrink-0"
                  >
                    Open
                  </a>
                  <a
                    href={u.url}
                    download={(u.filename || u.title || "file") as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-gray-700 hover:text-black border-2 border-[var(--border)] px-2 py-1 rounded shrink-0"
                  >
                    Download
                  </a>
                  <button
                    type="button"
                    onClick={() => setForwarding(u)}
                    className="text-xs font-medium text-gray-700 hover:text-black border-2 border-[var(--border)] px-2 py-1 rounded shrink-0"
                  >
                    Forward
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(u)}
                    disabled={deleting.has(u.id)}
                    className="text-xs font-medium text-red-600 hover:text-red-700 border-2 border-red-300 px-2 py-1 rounded shrink-0 disabled:opacity-50"
                  >
                    {deleting.has(u.id) ? "…" : "Delete"}
                  </button>
                </div>
                {forwarding?.id === u.id && (
                  <div className="flex gap-2 items-center pl-4">
                    <span className="text-xs text-gray-600">To:</span>
                    <input
                      type="text"
                      value={forwardTo}
                      onChange={(e) => setForwardTo(e.target.value)}
                      placeholder="Display name"
                      className="flex-1 min-w-0 px-2 py-1 rounded bg-gray-50 border border-[var(--border)] text-sm text-black placeholder:text-gray-600"
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
                      className="text-xs text-gray-600 hover:text-black"
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
      <p className="text-xs text-gray-500">
        Commands: <code className="text-gray-600">@onboarding</code>{" "}
        <code className="text-gray-600">@checkmail</code>{" "}
        <code className="text-gray-600">@prototype</code>{" "}
        <code className="text-gray-600">@summary</code>{" "}
        <code className="text-gray-600">@storage</code>
      </p>
    </footer>
  );
}

import { getSupabase, getSupabaseAdmin } from "@/lib/supabase-server";
import type { Entry, EntryType, QueuedMessage, Participant, Upload, UploadKind } from "@/types";

const BUCKET = "lab-files";

function getStorageClient() {
  const admin = getSupabaseAdmin();
  return admin ?? getSupabase();
}

async function ensureStorageBucket() {
  const admin = getSupabaseAdmin();
  if (!admin) return;
  const { error } = await admin.storage.createBucket(BUCKET, { public: true });
  if (error) {
    const msg = (error as { message?: string }).message ?? "";
    if (/already exists|BucketAlreadyExists/i.test(msg)) return;
    console.error("Storage bucket create:", error);
  }
}

function norm(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function getEntries(): Promise<Entry[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("entries")
    .select("id, author_display_name, author_name_norm, body, type, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    authorDisplayName: r.author_display_name,
    authorNameNorm: r.author_name_norm,
    body: r.body,
    type: r.type as EntryType,
    createdAt: r.created_at,
  }));
}

export async function addEntry(
  authorDisplayName: string,
  authorNameNorm: string,
  body: string,
  type: EntryType
): Promise<Entry> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("entries")
    .insert({
      author_display_name: authorDisplayName,
      author_name_norm: authorNameNorm,
      body,
      type,
    })
    .select("id, author_display_name, author_name_norm, body, type, created_at")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    authorDisplayName: data.author_display_name,
    authorNameNorm: data.author_name_norm,
    body: data.body,
    type: data.type as EntryType,
    createdAt: data.created_at,
  };
}

export async function ensureParticipant(displayName: string): Promise<Participant> {
  const nameNorm = norm(displayName);
  const supabase = getSupabase();
  const { data: existing } = await supabase
    .from("participants")
    .select("id, name_norm, display_name, created_at")
    .eq("name_norm", nameNorm)
    .single();
  if (existing) {
    return {
      id: existing.id,
      nameNorm: existing.name_norm,
      displayName: existing.display_name,
      createdAt: existing.created_at,
    };
  }
  const { data: inserted, error } = await supabase
    .from("participants")
    .insert({ name_norm: nameNorm, display_name: displayName.trim() })
    .select("id, name_norm, display_name, created_at")
    .single();
  if (error) throw error;
  return {
    id: inserted.id,
    nameNorm: inserted.name_norm,
    displayName: inserted.display_name,
    createdAt: inserted.created_at,
  };
}

export async function getParticipants(): Promise<Participant[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("participants")
    .select("id, name_norm, display_name, created_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    nameNorm: r.name_norm,
    displayName: r.display_name,
    createdAt: r.created_at,
  }));
}

export async function queueMessage(
  toDisplayName: string,
  fromDisplayName: string,
  body: string
): Promise<QueuedMessage> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      to_name_norm: norm(toDisplayName),
      from_display_name: fromDisplayName,
      body: body.trim(),
    })
    .select("id, to_name_norm, from_display_name, body, created_at, delivered_at")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    toNameNorm: data.to_name_norm,
    fromDisplayName: data.from_display_name,
    body: data.body,
    createdAt: data.created_at,
    deliveredAt: data.delivered_at,
  };
}

export async function getUndeliveredFor(nameNorm: string): Promise<QueuedMessage[]> {
  const supabase = getSupabase();
  const n = norm(nameNorm);
  const { data, error } = await supabase
    .from("messages")
    .select("id, to_name_norm, from_display_name, body, created_at, delivered_at")
    .eq("to_name_norm", n)
    .is("delivered_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    toNameNorm: r.to_name_norm,
    fromDisplayName: r.from_display_name,
    body: r.body,
    createdAt: r.created_at,
    deliveredAt: r.delivered_at,
  }));
}

export async function deliverAllFor(nameNorm: string): Promise<QueuedMessage[]> {
  const list = await getUndeliveredFor(nameNorm);
  if (list.length === 0) return [];
  const supabase = getSupabase();
  const now = new Date().toISOString();
  await supabase
    .from("messages")
    .update({ delivered_at: now })
    .in("id", list.map((m) => m.id));
  return list;
}

export async function uploadFile(
  authorDisplayName: string,
  authorNameNorm: string,
  file: File | Blob,
  filename: string
): Promise<{ url: string; filename: string }> {
  await ensureStorageBucket();
  const supabase = getStorageClient();
  const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
  const path = `${authorNameNorm}/${Date.now()}-${safeName}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (uploadError) throw uploadError;
  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: urlData.publicUrl, filename };
}

export async function insertUpload(
  uploaderDisplayName: string,
  uploaderNameNorm: string,
  kind: UploadKind,
  url: string,
  opts: { title?: string; filename?: string; entryId?: string } = {}
): Promise<Upload> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("uploads")
    .insert({
      uploader_display_name: uploaderDisplayName,
      uploader_name_norm: uploaderNameNorm,
      kind,
      url,
      title: opts.title ?? null,
      filename: opts.filename ?? null,
      entry_id: opts.entryId ?? null,
    })
    .select("id, uploader_display_name, uploader_name_norm, kind, url, title, filename, entry_id, created_at")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    uploaderDisplayName: data.uploader_display_name,
    uploaderNameNorm: data.uploader_name_norm,
    kind: data.kind as UploadKind,
    url: data.url,
    title: data.title,
    filename: data.filename,
    entryId: data.entry_id,
    createdAt: data.created_at,
  };
}

export async function getUploads(uploaderNameNorm?: string): Promise<Upload[]> {
  const supabase = getSupabase();
  let q = supabase
    .from("uploads")
    .select("id, uploader_display_name, uploader_name_norm, kind, url, title, filename, entry_id, created_at")
    .order("created_at", { ascending: false });
  if (uploaderNameNorm?.trim()) {
    q = q.eq("uploader_name_norm", norm(uploaderNameNorm));
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    uploaderDisplayName: r.uploader_display_name,
    uploaderNameNorm: r.uploader_name_norm,
    kind: r.kind as UploadKind,
    url: r.url,
    title: r.title,
    filename: r.filename,
    entryId: r.entry_id,
    createdAt: r.created_at,
  }));
}

/** List files directly from Storage bucket (fallback when uploads/entries are empty). */
export async function listStorageBucketFiles(): Promise<Upload[]> {
  await ensureStorageBucket();
  const supabase = getStorageClient();
  const result: Upload[] = [];
  const { data: topLevel, error } = await supabase.storage.from(BUCKET).list("", { limit: 200 });
  if (error) {
    console.error("Storage list error:", error);
    return result;
  }
  for (const item of topLevel ?? []) {
    if (!item.name || item.name.startsWith(".")) continue;
    const { data: files } = await supabase.storage.from(BUCKET).list(item.name, { limit: 100 });
    if (files && files.length > 0) {
      for (const file of files) {
        if (!file.name || file.name.startsWith(".")) continue;
        const path = `${item.name}/${file.name}`;
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
        const match = file.name.match(/^\d+-(.+)$/);
        const filename = match ? match[1] : file.name;
        const kind = /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(filename) ? "screenshot" : "file";
        result.push({
          id: `storage-${path}`,
          uploaderDisplayName: item.name,
          uploaderNameNorm: item.name,
          kind,
          url: urlData.publicUrl,
          title: null,
          filename,
          entryId: null,
          createdAt: file.updated_at ?? new Date().toISOString(),
        });
      }
    } else if (/\.\w+$/.test(item.name)) {
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(item.name);
      result.push({
        id: `storage-${item.name}`,
        uploaderDisplayName: "unknown",
        uploaderNameNorm: "unknown",
        kind: "file",
        url: urlData.publicUrl,
        title: null,
        filename: item.name,
        entryId: null,
        createdAt: item.updated_at ?? new Date().toISOString(),
      });
    }
  }
  result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return result;
}

/** Delete an upload: from storage bucket (if our URL) and from uploads table (if UUID id). */
export async function deleteUpload(id: string, url: string): Promise<void> {
  const supabase = getStorageClient();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) {
    const { error } = await getSupabase().from("uploads").delete().eq("id", id);
    if (error) throw error;
  }
  const match = url.match(/\/storage\/v1\/object\/public\/lab-files\/(.+?)(?:\?|$)/);
  if (match) {
    const path = decodeURIComponent(match[1]!);
    await supabase.storage.from(BUCKET).remove([path]);
  }
}

/** Backfill uploads table from existing file entries so Storage shows everything. */
export async function backfillUploadsFromFileEntries(): Promise<number> {
  const supabase = getSupabase();
  const { data: fileEntries, error: fetchErr } = await supabase
    .from("entries")
    .select("id, author_display_name, author_name_norm, body")
    .eq("type", "file");
  if (fetchErr) throw fetchErr;
  const { data: existingUploads } = await supabase
    .from("uploads")
    .select("entry_id")
    .not("entry_id", "is", null);
  const existingIds = new Set((existingUploads ?? []).map((u) => u.entry_id));
  let inserted = 0;
  for (const e of fileEntries ?? []) {
    if (existingIds.has(e.id)) continue;
    const lines = (e.body ?? "").trim().split("\n").map((l: string) => l.trim()).filter(Boolean);
    const filename = lines.length > 1 ? lines[0]! : "file";
    const url = lines.length > 1 ? lines.slice(1).join("\n") : lines[0] ?? "";
    if (!url || !url.startsWith("http")) continue;
    const kind = url.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i) ? "screenshot" : "file";
    const { error: insErr } = await supabase.from("uploads").insert({
      uploader_display_name: e.author_display_name,
      uploader_name_norm: e.author_name_norm,
      kind,
      url,
      filename,
      entry_id: e.id,
    });
    if (!insErr) {
      inserted++;
      existingIds.add(e.id);
    }
  }
  return inserted;
}

export function hasSupabase(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
}

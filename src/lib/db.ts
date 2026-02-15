import { getSupabase } from "@/lib/supabase-server";
import type { Entry, EntryType, QueuedMessage, Participant } from "@/types";

const BUCKET = "lab-files";

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
  const supabase = getSupabase();
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

export function hasSupabase(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()
  );
}

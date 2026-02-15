import { NextResponse } from "next/server";
import * as db from "@/lib/db";
import type { EntryType } from "@/types";

const BUCKET = "lab-files";

export async function POST(request: Request) {
  if (!db.hasSupabase()) {
    return NextResponse.json({ error: "File upload not configured" }, { status: 503 });
  }
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const authorDisplayName = formData.get("authorDisplayName") as string | null;
    const authorNameNorm = formData.get("authorNameNorm") as string | null;
    if (!file || !authorDisplayName?.trim() || !authorNameNorm?.trim()) {
      return NextResponse.json(
        { error: "file, authorDisplayName, authorNameNorm required" },
        { status: 400 }
      );
    }
    const { url, filename } = await db.uploadFile(
      authorDisplayName.trim(),
      authorNameNorm.trim(),
      file,
      file.name
    );
    const body = `${filename}\n${url}`;
    const entry = await db.addEntry(
      authorDisplayName.trim(),
      authorNameNorm.trim(),
      body,
      "file" as EntryType
    );
    const kind = file.type.startsWith("image/") ? "screenshot" : "file";
    await db.insertUpload(
      authorDisplayName.trim(),
      authorNameNorm.trim(),
      kind,
      url,
      { filename, entryId: entry.id }
    );
    return NextResponse.json(entry);
  } catch (e) {
    console.error("Upload error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 500 }
    );
  }
}

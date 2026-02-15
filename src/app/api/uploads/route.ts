import { NextResponse } from "next/server";
import * as data from "@/lib/data";
import * as db from "@/lib/db";
import type { Upload } from "@/types";

export async function GET(request: Request) {
  if (!db.hasSupabase()) {
    return NextResponse.json({ uploads: [] });
  }
  try {
    const { searchParams } = new URL(request.url);
    const uploader = searchParams.get("uploader") ?? undefined;
    const backfill = searchParams.get("backfill") === "1";
    if (backfill) {
      try {
        await db.backfillUploadsFromFileEntries();
      } catch (err) {
        console.error("Uploads backfill error:", err);
      }
    }
    let uploads = await data.getUploads(uploader);
    const entries = await db.getEntries();
    const fileEntries = entries.filter((e) => e.type === "file");
    const hasEntryId = new Set(uploads.map((u) => u.entryId).filter(Boolean));
    for (const e of fileEntries) {
      if (hasEntryId.has(e.id)) continue;
      const lines = (e.body ?? "").trim().split("\n").map((l) => l.trim()).filter(Boolean);
      const filename = lines.length > 1 ? lines[0]! : "file";
      const url = lines.length > 1 ? lines.slice(1).join("\n") : lines[0] ?? "";
      if (!url || !url.startsWith("http")) continue;
      const kind = url.match(/\.(jpg|jpeg|png|gif|webp)(\?|$)/i) ? "screenshot" : "file";
      uploads = [
        ...uploads,
        {
          id: e.id,
          uploaderDisplayName: e.authorDisplayName,
          uploaderNameNorm: e.authorNameNorm,
          kind,
          url,
          title: null as string | null,
          filename,
          entryId: e.id,
          createdAt: e.createdAt,
        } satisfies Upload,
      ];
    }
    uploads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (uploader) {
      uploads = uploads.filter((u) => u.uploaderNameNorm === uploader);
    }
    return NextResponse.json({ uploads });
  } catch (e) {
    console.error("Uploads list error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to list uploads" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  if (!db.hasSupabase()) {
    return NextResponse.json({ error: "Document storage not configured" }, { status: 503 });
  }
  try {
    const body = await request.json();
    const authorDisplayName = body.authorDisplayName as string | null;
    const authorNameNorm = body.authorNameNorm as string | null;
    const url = body.url as string | null;
    const title = (body.title as string | undefined)?.trim() || undefined;
    if (!authorDisplayName?.trim() || !authorNameNorm?.trim() || !url?.trim()) {
      return NextResponse.json(
        { error: "authorDisplayName, authorNameNorm, url required" },
        { status: 400 }
      );
    }
    const normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
      return NextResponse.json({ error: "url must be http or https" }, { status: 400 });
    }
    const upload = await data.insertUpload(
      authorDisplayName.trim(),
      authorNameNorm.trim(),
      "link",
      normalizedUrl,
      { title }
    );
    return NextResponse.json(upload);
  } catch (e) {
    console.error("Add link error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to add link" },
      { status: 500 }
    );
  }
}

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
    const fileEntries = entries.filter((e) => {
      if (e.type === "file") return true;
      const body = (e.body ?? "").trim();
      return body.includes("http") && (body.includes("\n") || body.startsWith("http"));
    });
    const hasEntryId = new Set(uploads.map((u) => u.entryId).filter(Boolean));
    for (const e of fileEntries) {
      if (hasEntryId.has(e.id)) continue;
      const raw = (e.body ?? "").trim().replace(/\r\n/g, "\n");
      const lines = raw.split("\n").map((l: string) => l.trim()).filter(Boolean);
      let filename = "file";
      let url = "";
      if (lines.length >= 2) {
        filename = lines[0]!;
        url = lines.slice(1).join("\n");
      } else if (lines.length === 1 && lines[0]!.startsWith("http")) {
        url = lines[0]!;
      } else if (lines.length === 1) {
        url = lines[0]!;
      }
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
    if (uploads.length === 0) {
      try {
        const bucketFiles = await db.listStorageBucketFiles();
        const existingUrls = new Set(uploads.map((u) => u.url));
        for (const f of bucketFiles) {
          if (!existingUrls.has(f.url)) {
            uploads.push(f);
            existingUrls.add(f.url);
          }
        }
        uploads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        if (uploader) {
          uploads = uploads.filter((u) => u.uploaderNameNorm === uploader);
        }
      } catch (err) {
        console.error("Storage bucket list error:", err);
      }
    }
    const debug = searchParams.get("debug") === "1" ? { entriesTotal: entries.length, fileEntryCount: fileEntries.length, uploadsCount: uploads.length } : undefined;
    return NextResponse.json(debug ? { uploads, debug } : { uploads });
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

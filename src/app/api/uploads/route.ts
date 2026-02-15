import { NextResponse } from "next/server";
import * as data from "@/lib/data";
import * as db from "@/lib/db";

export async function GET(request: Request) {
  if (!db.hasSupabase()) {
    return NextResponse.json({ uploads: [] });
  }
  try {
    const { searchParams } = new URL(request.url);
    const uploader = searchParams.get("uploader") ?? undefined;
    const backfill = searchParams.get("backfill") === "1";
    if (backfill) await db.backfillUploadsFromFileEntries();
    const uploads = await data.getUploads(uploader);
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

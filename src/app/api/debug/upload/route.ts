import { NextResponse } from "next/server";
import * as db from "@/lib/db";

/** Diagnostic: check uploads table, file entries, and bucket. */
export async function GET() {
  if (!db.hasSupabase()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  try {
    const uploads = await db.getUploads();
    const entries = await db.getEntries();
    const fileEntries = entries.filter((e) => e.type === "file");
    let bucketFiles: { count: number; error?: string } = { count: 0 };
    try {
      const list = await db.listStorageBucketFiles();
      bucketFiles = { count: list.length };
    } catch (e) {
      bucketFiles = { count: 0, error: e instanceof Error ? e.message : String(e) };
    }
    return NextResponse.json({
      uploadsCount: uploads.length,
      fileEntriesCount: fileEntries.length,
      entriesTotal: entries.length,
      bucketFiles: bucketFiles.count,
      bucketError: bucketFiles.error,
      recentFileEntries: fileEntries.slice(-5).map((e) => ({
        id: e.id,
        body: e.body?.slice(0, 80),
        createdAt: e.createdAt,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Debug failed" },
      { status: 500 }
    );
  }
}

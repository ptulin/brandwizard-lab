import { NextResponse } from "next/server";
import * as data from "@/lib/data";
import type { EntryType } from "@/types";

export async function GET() {
  const entries = await data.getEntries();
  return NextResponse.json(entries);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      authorDisplayName,
      authorNameNorm,
      body: text,
      type = "note",
    } = body as {
      authorDisplayName: string;
      authorNameNorm: string;
      body: string;
      type?: EntryType;
    };
    if (!authorDisplayName || !authorNameNorm || text == null) {
      return NextResponse.json(
        { error: "authorDisplayName, authorNameNorm, body required" },
        { status: 400 }
      );
    }
    const validTypes: EntryType[] = ["note", "decision", "question", "action", "file"];
    const entryType = validTypes.includes(type) ? type : "note";
    const entry = await data.addEntry(
      authorDisplayName,
      authorNameNorm,
      String(text),
      entryType
    );
    return NextResponse.json(entry);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Bad request" },
      { status: 400 }
    );
  }
}

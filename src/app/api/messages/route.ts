import { NextResponse } from "next/server";
import * as data from "@/lib/data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const nameNorm = searchParams.get("nameNorm");
  if (!nameNorm) {
    return NextResponse.json(
      { error: "nameNorm query required" },
      { status: 400 }
    );
  }
  const messages = await data.getUndeliveredFor(nameNorm);
  return NextResponse.json(messages);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { toDisplayName, fromDisplayName, body: text } = body as {
      toDisplayName: string;
      fromDisplayName: string;
      body: string;
    };
    if (!toDisplayName || !fromDisplayName || text == null) {
      return NextResponse.json(
        { error: "toDisplayName, fromDisplayName, body required" },
        { status: 400 }
      );
    }
    const msg = await data.queueMessage(
      toDisplayName,
      fromDisplayName,
      String(text)
    );
    return NextResponse.json(msg);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Bad request" },
      { status: 400 }
    );
  }
}

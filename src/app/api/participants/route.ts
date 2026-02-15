import { NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET() {
  const participants = store.getParticipants();
  return NextResponse.json(participants);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { displayName } = body as { displayName: string };
    if (!displayName || !String(displayName).trim()) {
      return NextResponse.json(
        { error: "displayName required" },
        { status: 400 }
      );
    }
    const participant = store.ensureParticipant(displayName);
    return NextResponse.json(participant);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Bad request" },
      { status: 400 }
    );
  }
}

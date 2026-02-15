import { NextResponse } from "next/server";
import * as data from "@/lib/data";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { nameNorm } = body as { nameNorm: string };
    if (!nameNorm) {
      return NextResponse.json(
        { error: "nameNorm required" },
        { status: 400 }
      );
    }
    const delivered = await data.deliverAllFor(nameNorm);
    return NextResponse.json({ delivered });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Bad request" },
      { status: 400 }
    );
  }
}

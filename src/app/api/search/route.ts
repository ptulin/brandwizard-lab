import { NextResponse } from "next/server";

/**
 * Web search stub. Set SERPER_API_KEY or TAVILY_API_KEY for real results.
 * Returns minimal result; client can attach to thread as a note.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ error: "q required" }, { status: 400 });
  }

  const serperKey = process.env.SERPER_API_KEY?.trim();
  if (serperKey) {
    try {
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as {
        organic?: Array<{ title?: string; link?: string; snippet?: string }>;
      };
      const results = (data.organic ?? []).slice(0, 5).map((o) => ({
        title: o.title ?? "",
        link: o.link ?? "",
        snippet: o.snippet ?? "",
      }));
      return NextResponse.json({ q, results });
    } catch (e) {
      console.error("Search error:", e);
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Search failed" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    q,
    results: [],
    message: "Web search not configured (set SERPER_API_KEY for results).",
  });
}

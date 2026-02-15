/**
 * Extract text from PDF and generate a short AI summary.
 */

import { PDFParse } from "pdf-parse";

export async function summarizeFile(
  file: File,
  filename: string
): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) return null;

  let text: string | null = null;
  if (file.type === "application/pdf") {
    try {
      const buf = await file.arrayBuffer();
      const parser = new PDFParse({ data: new Uint8Array(buf) });
      const result = await parser.getText();
      text = result?.text?.trim()?.slice(0, 4000) ?? null;
    } catch {
      text = null;
    }
  }

  if (!text || text.length < 10) {
    return `Attached: ${filename} — ready in Storage.`;
  }

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content: "You are BW. In one short sentence (max 15 words), summarize what this document is about. Be specific.",
          },
          {
            role: "user",
            content: `Document: ${filename}\n\nExcerpt:\n${text.slice(0, 2000)}`,
          },
        ],
        max_tokens: 60,
        temperature: 0.3,
      }),
    });

    if (!res.ok) return `Attached: ${filename} — ready in Storage.`;

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const summary = data.choices?.[0]?.message?.content?.trim();
    if (summary) {
      return `Attached: ${filename} — ${summary}`;
    }
  } catch {
    // fallthrough
  }

  return `Attached: ${filename} — ready in Storage.`;
}

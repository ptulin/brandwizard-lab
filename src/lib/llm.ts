/**
 * LLM abstraction for BW (BrandWizard) replies.
 * Implementations: Groq (free, fast), or swap for Gemini/OpenAI later.
 */

export interface LLMMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface LLMOptions {
  /** Last N entries from thread for context (author: body) */
  recentContext: string;
  /** New user message we're replying to */
  userMessage: string;
  /** Who asked (for persona) */
  userName?: string;
}

export type LLMProvider = "groq" | "gemini" | "openai";

/**
 * Returns a reply from BW, or null if no API key / error.
 */
export async function getLLMReply(options: LLMOptions): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey?.trim()) return null;

  const systemPrompt = `You are BW (BrandWizard), a concise lab assistant in BrandWizard Lab. You help with ideas, decisions, and next steps. Keep replies short (1–3 sentences unless asked for more). Be friendly and direct. If the message is not a real question, you can briefly acknowledge or add a one-line thought.`;

  const userContent = options.recentContext
    ? `Recent lab notes:\n${options.recentContext}\n\n${options.userName ?? "Someone"} asked: ${options.userMessage}`
    : `${options.userName ?? "Someone"} said: ${options.userMessage}`;

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
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        max_tokens: 256,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      console.error("Groq API error:", res.status, await res.text());
      return null;
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    return content ?? null;
  } catch (e) {
    console.error("LLM error:", e);
    return null;
  }
}

/** Build recent context string from last N entries (for LLM). */
export function buildRecentContext(
  entries: Array<{ authorDisplayName: string; body: string }>,
  lastN: number = 10
): string {
  const slice = entries.slice(-lastN);
  return slice.map((e) => `${e.authorDisplayName}: ${e.body}`).join("\n");
}

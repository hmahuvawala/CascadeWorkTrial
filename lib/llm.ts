import Anthropic from "@anthropic-ai/sdk";
import { createLogger } from "./logger";

const MODEL = "claude-sonnet-4-6";
const log = createLogger("llm");

/**
 * Call Anthropic with a JSON-only prompt and parse the reply. Returns null when
 * the key is missing or anything fails, so callers can apply a rule-based
 * fallback and the demo never breaks.
 */
export async function callAnthropicJSON<T>(
  prompt: string,
  maxTokens = 1024
): Promise<T | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    log.warn("no ANTHROPIC_API_KEY — skipping LLM, caller will use fallback");
    return null;
  }
  const start = Date.now();
  try {
    log.info(`calling ${MODEL}`, { promptChars: prompt.length, maxTokens });
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content[0]?.type === "text" ? res.content[0].text : "";
    const parsed = parseJsonLoose<T>(text);
    log.info(
      `LLM responded in ${Date.now() - start}ms`,
      { replyChars: text.length, parsed: parsed !== null }
    );
    return parsed;
  } catch (err) {
    log.error(`LLM call failed in ${Date.now() - start}ms — using fallback`, err);
    return null;
  }
}

/** Parse JSON that may be wrapped in ```json fences or surrounded by prose. */
export function parseJsonLoose<T>(text: string): T | null {
  if (!text) return null;
  const cleaned = text
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Fall back to the first {...} or [...] block in the string.
    const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) {
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

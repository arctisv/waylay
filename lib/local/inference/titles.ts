/* Chat titles: the fallback a chat wears until the model names it, and the
   clean-up applied to whatever the model returns. */

export const TITLE_FALLBACK = "New thread";
const TITLE_MAX_CHARS = 60;
const TITLE_FALLBACK_WORDS = 5;
const TITLE_FALLBACK_MIN_CHARS = 4;
const TITLE_INPUT_MAX_CHARS = 2000;

export function sanitizeTitle(raw: string): string {
  let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  cleaned = cleaned.replace(/^title:\s*/i, "");
  cleaned = cleaned.replace(/^["'`“”‘’*]+|["'`“”‘’*]+$/g, "").trim();
  cleaned = cleaned.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ");
  cleaned = cleaned.replace(/[.!?…]+$/g, "").trim();
  if (cleaned.length > TITLE_MAX_CHARS) {
    cleaned = `${cleaned.slice(0, TITLE_MAX_CHARS - 1).trimEnd()}…`;
  }
  return cleaned;
}

export function titlePromptInput(content: string): string {
  return content.replace(/\s+/g, " ").trim().slice(0, TITLE_INPUT_MAX_CHARS);
}

/** The prompt's first few words, title-cased. */
export function fallbackTitleFromPrompt(prompt: string): string {
  const cleaned = prompt
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[`*_#[\](){}<>|~]/g, " ")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < TITLE_FALLBACK_MIN_CHARS) return TITLE_FALLBACK;
  const title = cleaned
    .split(" ")
    .filter(Boolean)
    .slice(0, TITLE_FALLBACK_WORDS)
    .map((word) => {
      const [first = "", ...rest] = word;
      return `${first.toLocaleUpperCase()}${rest.join("").toLocaleLowerCase()}`;
    })
    .join(" ");
  return sanitizeTitle(title) || TITLE_FALLBACK;
}

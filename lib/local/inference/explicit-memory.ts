/* "Remember that I'm vegetarian." Small models often answer a request like
   that without calling their memory tool, so an explicit one is saved
   directly — turned into the third person the way the tool would write
   it ("They're vegetarian."). Anything less explicit is left to the
   model. */

const LEADING = /^(?:please\s+)?(?:can you\s+|could you\s+)?remember(?:\s+that)?[:,]?\s+([\s\S]+)$/i;
const TRAILING = /^(?:please\s+)?(?:remember|keep in mind|don'?t forget)\s+(?:that|this|it)[.!]?$/i;

const PERSON: [RegExp, string][] = [
  [/\bI am\b/gi, "they are"],
  [/\bI'm\b/gi, "they're"],
  [/\bI've\b/gi, "they've"],
  [/\bI'll\b/gi, "they'll"],
  [/\bI'd\b/gi, "they'd"],
  [/\bI was\b/gi, "they were"],
  [/\bI\b/g, "they"],
  [/\bmyself\b/gi, "themselves"],
  [/\bmine\b/gi, "theirs"],
  [/\bmy\b/gi, "their"],
  [/\bme\b/gi, "them"],
];

function thirdPerson(text: string): string {
  let out = text.trim().replace(/[.!\s]+$/, "");
  for (const [pattern, replacement] of PERSON) out = out.replace(pattern, replacement);
  return out.charAt(0).toUpperCase() + out.slice(1) + ".";
}

/** The fact a message asks to be remembered, or null if it doesn't ask. */
export function explicitMemory(message: string): string | null {
  const text = message.trim();
  if (!text || text.endsWith("?")) return null;

  const leading = text.match(LEADING);
  /* "Remember when…" is reminiscing, not a fact to keep. */
  if (leading && !/^(when|what|who|where|how|why|if|whether)\b/i.test(leading[1])) {
    return thirdPerson(leading[1]);
  }
  if (leading) return null;

  const sentences = text.split(/(?<=[.!])\s+/);
  const ask = sentences.findIndex((sentence) => TRAILING.test(sentence.trim()));
  if (ask === -1) return null;
  const fact = sentences.filter((_, index) => index !== ask).join(" ").trim();
  return fact.length >= 3 ? thirdPerson(fact) : null;
}

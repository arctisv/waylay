import { query } from "../functions";

/* Full-text search over every message, for the search modal's "in your
   chats" results. Each thread appears once, with an excerpt around the
   first match. */

const EXCERPT_LENGTH = 400;
const MAX_RESULTS = 20;

function buildExcerpt(content: string, search: string): string {
  const haystack = content.toLowerCase();
  const terms = search.toLowerCase().split(/\s+/).filter((term) => term.length > 1);
  let hit = -1;
  for (const term of terms) {
    const index = haystack.indexOf(term);
    if (index !== -1 && (hit === -1 || index < hit)) hit = index;
  }
  const start = Math.max(0, (hit === -1 ? 0 : hit) - EXCERPT_LENGTH / 4);
  const end = Math.min(content.length, start + EXCERPT_LENGTH);
  const slice = content.slice(start, end).trim();
  return `${start > 0 ? "…" : ""}${slice}${end < content.length ? "…" : ""}`;
}

export const deepSearch = query((ctx, { query: search }: { query: string }) => {
  const terms = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const hidden = new Set(ctx.db.all("threads").filter((thread) => thread.incognito).map((thread) => thread._id));

  const scored = ctx.db
    .all("messages")
    .filter((message) => !hidden.has(message.threadId) && message.content)
    .map((message) => {
      const text = message.content.toLowerCase();
      const score = terms.reduce((total, term) => total + (text.includes(term) ? 1 : 0), 0);
      return { message, score };
    })
    .filter(({ score }) => score === terms.length)
    .sort((a, b) => b.message.createdAt - a.message.createdAt);

  const seen = new Set<string>();
  const results: Array<{ threadId: string; excerpt: string }> = [];
  for (const { message } of scored) {
    if (seen.has(message.threadId)) continue;
    seen.add(message.threadId);
    results.push({ threadId: message.threadId, excerpt: buildExcerpt(message.content, search) });
    if (results.length >= MAX_RESULTS) break;
  }
  return results;
});

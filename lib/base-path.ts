/* Where the app is served from: "" at a domain's root, "/waylay" on a
   GitHub Pages project site. next.config.ts reads the same variable, so
   Next's own assets and these public files always agree. */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

/** A file in public/, addressed from wherever the app is served. */
export function publicPath(path: string): string {
  return `${BASE_PATH}${path}`;
}

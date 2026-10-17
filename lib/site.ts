/* Everything that ties this build to one particular Waylay: its address and
   the places it links to. A fork edits this file and sets
   NEXT_PUBLIC_SITE_URL; nothing else in the app hardcodes a domain. */

export const SITE_NAME = "Waylay";

/** The public address, without a trailing slash. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://arctisv.github.io/waylay"
).replace(/\/+$/, "");

export const SITE_LINKS = {
  /** This app's source code. */
  repo: "https://github.com/arctisv/waylay",
  /** Whirl, the open-source chat app Waylay's interface comes from. */
  upstream: "https://github.com/whirlchat/whirl",
} as const;

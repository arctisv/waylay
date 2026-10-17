/* Everything that ties this build to one particular Waylay: its name and
   address. A fork edits this file and sets NEXT_PUBLIC_SITE_URL; nothing
   else in the app hardcodes a domain. */

export const SITE_NAME = "Waylay";

/** The public address, without a trailing slash. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://arctisv.github.io/waylay"
).replace(/\/+$/, "");

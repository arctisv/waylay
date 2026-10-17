import type { ComposerModel } from "@/lib/models";

/* Composer attachments, read in the browser. Waylay's models read text, so
   text and code files ride along as their contents; anything else gets a
   plain-language reason instead. Nothing is uploaded anywhere. */

export const MB = 1024 * 1024;

/* A model's context window holds a few thousand words; past this a file is
   mostly cut before the model ever sees it. */
const MAX_FILE_BYTES = 1 * MB;

const TEXT_ATTACHMENT_EXTENSIONS = new Set([
  "c",
  "conf",
  "cpp",
  "cs",
  "css",
  "csv",
  "dart",
  "diff",
  "env",
  "go",
  "h",
  "html",
  "htm",
  "ini",
  "java",
  "js",
  "json",
  "jsonc",
  "jsx",
  "kt",
  "kts",
  "log",
  "lua",
  "md",
  "mdx",
  "patch",
  "php",
  "py",
  "r",
  "rb",
  "rs",
  "scala",
  "sh",
  "sql",
  "srt",
  "svelte",
  "svg",
  "swift",
  "toml",
  "ts",
  "tsx",
  "tsv",
  "txt",
  "vue",
  "vtt",
  "xml",
  "yaml",
  "yml",
]);

const MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  conf: "text/plain",
  csv: "text/csv",
  diff: "text/plain",
  htm: "text/html",
  html: "text/html",
  // Browsers report an empty type for .jsonc — without this it lands on
  // application/octet-stream and the model never gets the text.
  jsonc: "text/plain",
  log: "text/plain",
  md: "text/markdown",
  mdx: "text/markdown",
  patch: "text/plain",
  sql: "application/sql",
  svg: "text/xml",
  toml: "application/toml",
  tsv: "text/tab-separated-values",
  txt: "text/plain",
  xml: "application/xml",
  yaml: "application/yaml",
  yml: "application/yaml",
};

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}

/** The fields the metadata/validation helpers need — a `File` and a draft
 * both satisfy this, so the same checks run before and after upload. */
export type FileLike = { name: string; type: string; size: number };

export function getFileExtension(name: string) {
  return name.includes(".") ? (name.split(".").pop()?.toLowerCase() ?? "") : "";
}

/* An SVG arrives from the OS as image/svg+xml, but it's markup, not
   pixels — no provider decodes it as an image, and handing over the source
   is what's actually useful ("tweak this icon"). Every image path in the
   app, UI and backend alike, keys off the type, so correcting it here is the
   whole story: no thumbnail, no @image tag, no vision-only gating, and it
   rides inline as text like any other code file. */
const TYPE_OVERRIDES: Record<string, string> = {
  "image/svg+xml": "text/xml",
};

export function getAttachmentType(file: Pick<FileLike, "name" | "type">) {
  const type =
    file.type ||
    MIME_TYPES_BY_EXTENSION[getFileExtension(file.name)] ||
    "application/octet-stream";
  return TYPE_OVERRIDES[type] ?? type;
}

export function isTextAttachment(file: Pick<FileLike, "name" | "type">) {
  return (
    getAttachmentType(file).startsWith("text/") ||
    TEXT_ATTACHMENT_EXTENSIONS.has(getFileExtension(file.name))
  );
}

export function makeAttachmentId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Why a file can't ride along with the chosen model, or `null` if it's
 * fine. Reactive to the selected model, so chips re-check on a switch.
 */
export function attachmentRejectionReason(
  file: FileLike,
  model: ComposerModel,
): string | null {
  const type = getAttachmentType(file);
  if (file.size > MAX_FILE_BYTES) {
    return `Attachments top out at ${formatSize(MAX_FILE_BYTES)}.`;
  }
  if (isTextAttachment(file)) return null;
  if (type.startsWith("image/")) {
    return `${model.name} doesn't read images.`;
  }
  return "Waylay reads text and code files.";
}

/** The ready-to-send shape: the file's details and its text. */
export type AttachmentUpload = {
  id: string;
  name: string;
  size: number;
  type: string;
  /** The file's contents, handed to the model with the message. */
  text?: string;
  /** Why the file couldn't be read, relayed to the model as a note. */
  skippedReason?: string;
};

/** Reads one file in the browser. */
export async function prepareAttachment(file: File): Promise<AttachmentUpload> {
  const type = getAttachmentType(file);
  if (!isTextAttachment(file)) {
    throw new Error("Waylay reads text and code files.");
  }
  let text: string;
  try {
    text = await file.text();
  } catch {
    throw new Error(`Waylay cannot read ${file.name}. Attach it again.`);
  }
  return { id: makeAttachmentId(), name: file.name, size: file.size, type, text };
}

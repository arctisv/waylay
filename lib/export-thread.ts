"use client";

import { api } from "@/lib/local/api";
import { localClient } from "@/lib/local/react";

/* A chat as a Markdown file, saved straight from the browser: the title,
   then each turn under who said it. Pictures are named rather than
   embedded, so the file stays plain text. */

function fileName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "waylay-chat"}.md`;
}

export async function exportThreadAsMarkdown(threadId: string, title: string) {
  const messages = await localClient.query(api.messages.listForThread, { threadId });
  const turns = messages
    .filter((message) => message.content.trim() || message.attachments?.length)
    .map((message) => {
      const who = message.role === "user" ? "You" : "Waylay";
      const files = (message.attachments ?? []).map((file) =>
        file.type.startsWith("image/") ? `*Picture: ${file.name}*` : `*Attached: ${file.name}*`,
      );
      return [`### ${who}`, message.content.trim(), ...files].filter(Boolean).join("\n\n");
    });
  const markdown = [`# ${title}`, ...turns].join("\n\n") + "\n";

  const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName(title);
  anchor.click();
  URL.revokeObjectURL(url);
}

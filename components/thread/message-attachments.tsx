import { formatSize } from "@/lib/attachments";
import type { MessageAttachment } from "@/lib/messages";
import { fileGlyph, fileLabel } from "../composer-attachments";

/* Read-only chips for attachments already sent with a message — the
   composer tray's chips minus the remove button and progress. */

export function MessageAttachments({
  attachments,
}: {
  attachments: MessageAttachment[];
}) {
  if (attachments.length === 0) return null;
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {attachments.map((attachment) => (
          <div
            key={attachment.id}
            className="flex w-52 items-center gap-2.5 rounded-2xl bg-black/[0.05] px-3 py-2 dark:bg-white/[0.06]"
          >
            {fileGlyph(
              attachment.name,
              attachment.type,
              "shrink-0 text-muted-foreground",
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px]/4.5 font-medium">
                {attachment.name}
              </div>
              <div className="mt-0.5 truncate text-[11.5px]/[14px] text-muted-foreground tabular-nums">
                {fileLabel(attachment.name, attachment.type)} ·{" "}
                {formatSize(attachment.size)}
              </div>
            </div>
          </div>
      ))}
    </div>
  );
}

"use client";

import { useRef } from "react";
import {
  IconFileFilled,
  IconMicrophoneFilled,
  IconPlus,
} from "@tabler/icons-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ITEM = "gap-2 px-2 py-1.5";

/* The composer's plus button, opening upward: the two things you can add
   to a message — your voice and your files. The plus turns into an × while
   open. */
export function AttachMenu({
  onFiles,
  onVoice,
}: {
  onFiles: (files: FileList) => void;
  /** Absent where dictation can't run (no recorder). */
  onVoice?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Attach files or dictate"
        className="raised group flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-surface text-muted-foreground transition-[background-color,color,scale] duration-150 hover:text-foreground data-popup-open:text-foreground active:scale-95"
      >
        <IconPlus
          size={18}
          stroke={2.5}
          className="transition-[rotate] duration-200 group-data-popup-open:rotate-45"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={8} className="min-w-52 p-1">
        {onVoice && (
          <DropdownMenuItem className={ITEM} onClick={onVoice}>
            <IconMicrophoneFilled size={15} className="text-muted-foreground" />
            Voice input
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className={ITEM}
          onClick={() => inputRef.current?.click()}
        >
          <IconFileFilled size={15} className="text-muted-foreground" />
          Attach files
        </DropdownMenuItem>
      </DropdownMenuContent>
      {/* Lives outside the portalled menu so it survives the menu closing
          mid-pick. Value resets so re-picking the same file still fires. */}
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        onChange={(event) => {
          if (event.target.files?.length) onFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </DropdownMenu>
  );
}

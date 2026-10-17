"use client";

import { memo, useState } from "react";
import {
  IconCheck,
  IconCircleCheckFilled,
  IconDots,
  IconFolderFilled,
  IconFolderMinus,
  IconFolderPlus,
  IconFolderSymlink,
  IconGitBranch,
  IconLoader2,
  IconPencil,
  IconPinFilled,
  IconSparklesFilled,
  IconTrash,
} from "@tabler/icons-react";
import { AnimatePresence, motion } from "motion/react";

import { pinRasterPath } from "@/lib/motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  beginThreadDrag,
  endThreadDrag,
  THREAD_DRAG_TYPE,
  useFolderActions,
  type FolderSummary,
} from "@/lib/folders";
import { runMutation as run } from "@/lib/toasts";
import { useThreadActions, type ThreadSummary } from "@/lib/threads";
import { useView } from "@/lib/view";
import { RenameDialog } from "./rename-dialog";
import { RowPill } from "./row-pill";
import { ThreadTitle } from "./thread-title";

/* Same rhythm as the user menu's items. */
const ITEM = "gap-2 px-2 py-1.5";
const ICON = "text-muted-foreground";

/* One chat in the sidebar: title, a pin glyph when pinned, and a ⋯ menu
   that fades in on hover — always visible on touch, where hover doesn't
   exist (pin / move to folder / rename / delete). The trigger overlays
   the row button — real nesting would be invalid HTML.

   Memoized field by field. The listing hands back brand-new thread objects
   on every push, so a plain memo would never bite; these are the fields the
   row actually draws, and comparing them keeps a hundred untouched rows out
   of every re-render. */
export const ThreadRow = memo(function ThreadRow({
  thread,
  folders,
  running = false,
  finished = false,
  onNavigate,
}: {
  thread: ThreadSummary;
  folders: FolderSummary[];
  /** A turn is in flight in this thread — the spinner outranks the pin. */
  running?: boolean;
  /** The reply landed while you were elsewhere — a tick where the
   *  spinner was, until the thread is opened. */
  finished?: boolean;
  onNavigate?: () => void;
}) {
  const threadActions = useThreadActions();
  const folderActions = useFolderActions();
  const { threadId, openThread, openHome } = useView();
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);

  const isPinned = thread.pinnedAt !== null;
  const isActive = threadId === thread.id;
  const isGeneratingTitle = thread.titleStatus === "generating";
  const title = thread.title;

  return (
    /* group/row lives on the wrapper so hovering the ⋯ trigger (an overlay
       sibling of the row button) still lights the pill. */
    <div
      className="group/row group/thread relative"
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(THREAD_DRAG_TYPE, thread.id);
        event.dataTransfer.effectAllowed = "move";
        beginThreadDrag({ threadId: thread.id, folderId: thread.folderId });
      }}
      onDragEnd={endThreadDrag}
      onContextMenu={(event) => {
        event.preventDefault();
        setMenuOpen(true);
      }}
    >
      <button
        type="button"
        onClick={() => {
          openThread(thread.id);
          onNavigate?.();
        }}
        className="relative flex h-8 w-full cursor-pointer items-center rounded-lg pr-8 pl-2.5 text-[13.5px]/4 font-medium text-foreground-soft before:absolute before:-inset-x-3 before:-inset-y-px"
      >
        <RowPill
          className={`group-has-data-popup-open/thread:bg-accent ${
            isActive ? "bg-accent" : ""
          }`}
        />
        <span className="relative flex min-w-0 flex-1 items-center gap-1.5 text-left">
          {thread.branchedFromThreadId ? (
            <IconGitBranch
              size={13}
              aria-label="Branched thread"
              className="shrink-0"
            />
          ) : null}
          <span className="min-w-0 flex-1">
            <ThreadTitle title={title} generating={isGeneratingTitle} />
          </span>
        </span>
      </button>

      {/* Right-edge status glyph: a spinner while the thread is generating,
          then a tick if it finished while you were elsewhere (both outrank
          the pin), fading away on hover as the ⋯ fades in. mode="wait" lets
          one glyph scale out before the next scales in — the spinner
          hands off to the tick in place. Hover-hide opacities are
          !important — motion owns the inline opacity, so plain utilities
          would lose to it. */}
      <AnimatePresence mode="wait" initial={false}>
        {running ? (
          <motion.span
            key="running"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            transformTemplate={pinRasterPath}
            className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 transition-opacity duration-150 group-hover/thread:opacity-0! group-has-data-popup-open/thread:opacity-0! coarse:opacity-0!"
          >
            <IconLoader2
              size={14}
              className="animate-spin text-foreground-soft"
            />
          </motion.span>
        ) : finished ? (
          <motion.span
            key="finished"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            transformTemplate={pinRasterPath}
            className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 transition-opacity duration-150 group-hover/thread:opacity-0! group-has-data-popup-open/thread:opacity-0! coarse:opacity-0!"
          >
            <IconCircleCheckFilled
              size={14}
              aria-label="Reply finished"
              className="text-foreground-soft"
            />
          </motion.span>
        ) : isPinned ? (
          <motion.span
            key="pin"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            transformTemplate={pinRasterPath}
            className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 transition-opacity duration-150 group-hover/thread:opacity-0! group-has-data-popup-open/thread:opacity-0! coarse:opacity-0!"
          >
            <IconPinFilled
              size={12}
              className="rotate-45 text-foreground-soft"
            />
          </motion.span>
        ) : null}
      </AnimatePresence>

      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          aria-label={`Actions for ${title}`}
          className="absolute top-1/2 right-1 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-foreground-soft opacity-0 transition-opacity duration-150 group-hover/thread:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100 coarse:opacity-100"
        >
          <IconDots size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={4} className="w-48 p-1">
          <DropdownMenuItem
            className={ITEM}
            onClick={() => run(threadActions.setPinned(thread.id, !isPinned))}
          >
            <IconPinFilled size={15} className={ICON} />
            {isPinned ? "Unpin" : "Pin"}
          </DropdownMenuItem>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger className={ITEM}>
              <IconFolderSymlink size={15} className={ICON} />
              Move to folder
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-52 p-1">
              {folders.map((folder) => (
                <DropdownMenuItem
                  key={folder.id}
                  className={ITEM}
                  onClick={() =>
                    run(
                      threadActions.setFolder(
                        thread.id,
                        thread.folderId === folder.id ? null : folder.id,
                      ),
                    )
                  }
                >
                  <IconFolderFilled size={15} className={ICON} />
                  <span className="min-w-0 flex-1 truncate">{folder.name}</span>
                  {thread.folderId === folder.id && (
                    <IconCheck size={15} className="shrink-0" />
                  )}
                </DropdownMenuItem>
              ))}
              {thread.folderId && (
                <DropdownMenuItem
                  className={ITEM}
                  onClick={() => run(threadActions.setFolder(thread.id, null))}
                >
                  <IconFolderMinus size={15} className={ICON} />
                  Remove from folder
                </DropdownMenuItem>
              )}
              {folders.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuItem
                className={ITEM}
                onClick={() => setNewFolderOpen(true)}
              >
                <IconFolderPlus size={15} className={ICON} />
                New folder…
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuItem
            className={ITEM}
            onClick={() => setRenameOpen(true)}
          >
            <IconPencil size={15} className={ICON} />
            Rename
          </DropdownMenuItem>

          {/* Same shimmer the thread got when it was first named, just asked
              for on purpose — and off the whole conversation this time. */}
          <DropdownMenuItem
            className={ITEM}
            disabled={isGeneratingTitle}
            onClick={() => run(threadActions.regenerateTitle(thread.id))}
          >
            <IconSparklesFilled size={15} className={ICON} />
            Regenerate title
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            className={ITEM}
            variant="destructive"
            onClick={() => {
              /* Don't leave the view staring at a thread that's ticking
                 toward deletion. */
              if (isActive) openHome();
              threadActions.requestDelete(thread);
            }}
          >
            <IconTrash size={15} />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <RenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title="Rename thread"
        placeholder="Thread title"
        initialValue={title}
        onSubmit={(next) => run(threadActions.rename(thread.id, next))}
      />
      <RenameDialog
        open={newFolderOpen}
        onOpenChange={setNewFolderOpen}
        title="New folder"
        placeholder="Folder name"
        submitLabel="Create"
        onSubmit={(name) =>
          run(
            folderActions
              .create(name)
              .then((folderId) => threadActions.setFolder(thread.id, folderId)),
          )
        }
      />
    </div>
  );
},
(previous, next) =>
  previous.running === next.running &&
  previous.finished === next.finished &&
  previous.folders === next.folders &&
  previous.onNavigate === next.onNavigate &&
  previous.thread.id === next.thread.id &&
  previous.thread.updatedAt === next.thread.updatedAt &&
  previous.thread.title === next.thread.title &&
  previous.thread.titleStatus === next.thread.titleStatus &&
  previous.thread.pinnedAt === next.thread.pinnedAt &&
  previous.thread.folderId === next.thread.folderId &&
  previous.thread.branchedFromThreadId === next.thread.branchedFromThreadId);

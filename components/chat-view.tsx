"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useLocalSession } from "@/lib/local/react";
import { AppError } from "@/lib/local/functions";
import { AnimatePresence, motion } from "motion/react";

import type { AttachmentUpload } from "@/lib/attachments";
import { setComposerDraft } from "@/lib/composer-draft";
import {
  finishComposerPrefill,
  takeComposerPrefill,
} from "@/lib/composer-prefill";
import { registerQuoteInsert } from "@/lib/composer-ingest";
import {
  latchIncognitoThread,
  useIncognitoActions,
  useIncognitoState,
} from "@/lib/incognito";
import { useQueueActions, useQueuedMessages } from "@/lib/message-queue";
import {
  computeIsGenerating,
  useMessageActions,
  useThreadMessages,
  type ChatMessage,
} from "@/lib/messages";
import { useModelPref } from "@/lib/model-pref";
import { EASE_OUT, pinRasterPath, SHED_BLUR } from "@/lib/motion";
import { runMutation as run, showToast } from "@/lib/toasts";
import { cn } from "@/lib/utils";
import { useView } from "@/lib/view";
import { ChatComposer } from "./chat-composer";
import type { ComposerGates } from "./composer";
import { HomeFooter } from "./home-footer";
import { HomeGreeting, HomeSuggestions } from "./home-intro";
import { IncognitoToggle } from "./incognito-toggle";
import { QuoteSelectionPopover } from "./quote-selection";
import type { QueuedTurn } from "./composer-queue";
import { ThreadErrorBoundary, ThreadView } from "./thread/thread-view";
import { DeviceStatusPills, ensureDeviceCanRun } from "./device-status";

/* The chat face: home and thread share it, and the composer is the one
   element that never remounts between them — a dock overlay holds it
   centered on home (greeting above, starters below) and glides it to the
   bottom edge when a thread opens, where it floats over the transcript. */

/* The dock glide: calm and springy, settling without a wobble. */
const DOCK_SPRING = {
  type: "spring",
  stiffness: 380,
  damping: 38,
  mass: 0.9,
} as const;

const TRIM_FADE = {
  initial: { opacity: 0, y: 10, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)", transitionEnd: SHED_BLUR },
  exit: { opacity: 0, filter: "blur(4px)" },
  transition: { duration: 0.16, ease: EASE_OUT },
} as const;

/* The toolbar's entrance is a plain fade — its pills carry backdrop
   blurs, and Chromium refuses to render a descendant backdrop-filter
   under an ancestor holding any filter, even blur(0). */
const TOOLBAR_FADE = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.16, ease: EASE_OUT },
} as const;

/* Hopping threads: the old transcript crossfades out while the new one
   fades in. Opacity only — a 6px blur across a full transcript pane was
   the single most expensive animation in the app, and at that area the
   radius barely read. */
const THREAD_SWAP = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.2, ease: EASE_OUT },
} as const;

export function ChatView() {
  const { threadId: routeThreadId, openThread, openHome } = useView();
  const { isAuthenticated, isLoading } = useLocalSession();
  const actions = useMessageActions();
  const queueActions = useQueueActions();

  /* Incognito drives the chat off an ephemeral in-memory thread id — the
     URL stays on "/" so nothing routes to (or bookmarks) a thread that's
     about to be deleted. */
  const incognito = useIncognitoState();
  const { leave: leaveIncognito } = useIncognitoActions();
  const threadId = incognito.enabled ? incognito.threadId : routeThreadId;

  /* History can still land on a real thread mid-incognito (back button) —
     honor the navigation, and take the ephemeral chat with us. Ephemeral
     means ephemeral; the explicit toggle is where the confirm lives. */
  useEffect(() => {
    if (incognito.enabled && routeThreadId !== null) leaveIncognito();
  }, [incognito.enabled, routeThreadId, leaveIncognito]);

  /* The draft rides lib/composer-draft's store, not state up here: only the
     pill subscribes, so a keystroke never reconciles the transcript (or
     re-measures the dock's layout projection) behind it. This face is a
     writer only. */
  const [model, setModel] = useModelPref();
  /* A tall composer (a long draft, the attachment tray) must push the transcript up,
     not float over it: an observer on the dock publishes its height as
     --dock-clearance on the chat column (the transcript's bottom pad
     reads it), and while the pill is growing, a viewport already reading
     the live edge stays glued to it — the last turn rides up on the same
     spring the capsule grows on. Direct DOM on purpose: the observer
     fires every frame of the height spring, and a setState here would
     re-render the whole thread per frame. */
  const columnRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const column = columnRef.current;
    const dock = dockRef.current;
    if (!column || !dock) return;
    let previous = 0;
    const observer = new ResizeObserver(() => {
      const clearance = Math.round(dock.offsetHeight) + 12;
      const delta = clearance - previous;
      if (delta === 0) return;
      previous = clearance;
      column.style.setProperty("--dock-clearance", `${clearance}px`);
      if (delta < 0) return;
      const viewport = column.querySelector<HTMLElement>(
        '[data-slot="message-scroller-viewport"]',
      );
      if (!viewport) return;
      /* distance already includes the padding we just added, so
         subtracting the delta asks "was the reader at the edge before
         this frame?" — mid-history stays exactly where it is. */
      const distance =
        viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      if (distance - delta <= 128) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    });
    observer.observe(dock);
    return () => observer.disconnect();
  }, []);
  /* The preference setter only closes over React state + the storage key.
     Freeze one instance so streamed message reports keep a stable callback. */
  const setModelRef = useRef(setModel);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  /* The thread face reports its messages up so the composer can wear its
     Stop button and adopt that thread's newest model. Refs absorb streamed
     chunks; state only flips for generation state or a genuinely new model.
     The message ref remembers which thread it's for, so a stale report from
     an exiting face can never stop the wrong reply. */
  const messagesRef = useRef<{ threadId: string; messages: ChatMessage[] }>({
    threadId: "",
    messages: [],
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const adoptedThreadModelRef = useRef<{
    threadId: string;
    model?: string;
  }>({ threadId: "" });
  const handleMessages = useCallback(
    (forThreadId: string, messages: ChatMessage[] | undefined) => {
      messagesRef.current = { threadId: forThreadId, messages: messages ?? [] };
      const generating = computeIsGenerating(messages);
      setIsGenerating((current) =>
        current === generating ? current : generating,
      );
      let model: string | undefined;
      for (let index = (messages?.length ?? 0) - 1; index >= 0; index -= 1) {
        const message = messages?.[index];
        if (message?.role === "assistant" && message.model) {
          model = message.model;
          break;
        }
      }
      const adopted = adoptedThreadModelRef.current;
      if (adopted.threadId === forThreadId && adopted.model === model) return;
      adoptedThreadModelRef.current = { threadId: forThreadId, model };
      /* Wearing a thread's model isn't picking one — it rides the composer
         for this visit, then reads back as Auto (lib/model-pref.ts). */
      if (model) setModelRef.current(model, { explicit: false });
    },
    [],
  );

  /* Type anywhere, land in the composer: focusing during keydown makes
     the browser deliver the keystroke to the textarea itself. Stays out
     of the way whenever a real input has focus (model search, ⌘K modal),
     any popup or dialog is up, or a focused button is being activated
     with space. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      )
        return;
      if (event.key.length !== 1) return;
      const active = document.activeElement;
      if (
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement ||
        (active instanceof HTMLElement && active.isContentEditable)
      )
        return;
      if (
        event.key === " " &&
        (active instanceof HTMLButtonElement ||
          active instanceof HTMLAnchorElement)
      )
        return;
      if (
        document.querySelector(
          "[data-popup-open], [role='dialog'], [role='menu']",
        )
      )
        return;
      /* This face can be the shell's hidden side (settings open) — never
         steal keystrokes into an invisible composer. */
      const composer = composerRef.current;
      if (!composer || !composer.checkVisibility()) return;
      composer.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const fillComposer = (prompt: string) => {
    setComposerDraft(prompt);
    requestAnimationFrame(() => {
      const el = composerRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
  };

  /* A prompt handed over before load (lib/composer-prefill.ts). Read it
     only after hydration, clear it atomically, then focus the real textarea. */
  useEffect(() => {
    const prompt = takeComposerPrefill();
    if (!prompt) return;
    let focusFrame = 0;
    const fillFrame = requestAnimationFrame(() => {
      setComposerDraft(prompt);
      finishComposerPrefill(prompt);
      focusFrame = requestAnimationFrame(() => {
        const el = composerRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      });
    });
    return () => {
      cancelAnimationFrame(fillFrame);
      cancelAnimationFrame(focusFrame);
    };
  }, []);

  const submit = async (
    text: string,
    model: string,
    attachments: AttachmentUpload[],
    gates: ComposerGates,
  ) => {
    /* No model can run here: explain why instead of sending into a reply
       that can only fail. */
    if (!(await ensureDeviceCanRun())) throw new Error("Unsupported device");

    try {
      const targetThreadId = await actions.send({
        threadId: threadId ?? undefined,
        text,
        model,
        attachments,
        search: gates.search,
        thinking: gates.thinking,
        incognito: incognito.enabled,
      });
      setComposerDraft("");
      /* Incognito never navigates — the thread id latches into the store
         and the URL keeps pretending nothing happened. */
      if (incognito.enabled) latchIncognitoThread(targetThreadId);
      else if (!threadId) openThread(targetThreadId);
    } catch (error) {
      showToast("That message didn't send. Try again?");
      throw error;
    }
  };

  /* Typed while the reply was still writing: parked, then sent the moment
     the reply settles (lib/message-queue.ts). The stack is read here, not
     in the transcript: it's the composer's to wear. */
  const canQueue = threadId !== null && isAuthenticated;
  const queued = useQueuedMessages(threadId, canQueue);
  const dequeue = useCallback(
    (item: QueuedTurn) => run(queueActions.dequeue(item.id)),
    [queueActions],
  );
  const queue = async (
    text: string,
    model: string,
    attachments: AttachmentUpload[],
    gates: ComposerGates,
  ) => {
    if (!threadId) return;
    try {
      await queueActions.queue({
        threadId,
        text,
        model,
        attachments,
        search: gates.search,
        thinking: gates.thinking,
      });
      setComposerDraft("");
    } catch (error) {
      showToast(
        error instanceof AppError && typeof error.data === "string"
          ? error.data
          : "That message didn't queue. Try again?",
      );
      throw error;
    }
  };

  const stop = () => {
    if (!threadId || messagesRef.current.threadId !== threadId) return;
    const promise = actions.stopAssistant(
      threadId,
      messagesRef.current.messages,
    );
    if (promise) run(promise);
  };

  const inThread = threadId !== null;
  /* The ghost toggle owns the top corner everywhere but a routed thread. */
  const inRoutedThread = routeThreadId !== null;

  /* A quoted selection ("Add to chat") lands here —
     appended to whatever's drafted, with the composer focused to reply. */
  useEffect(() => {
    registerQuoteInsert((quote) => {
      const inserted = quote.trimEnd();
      setComposerDraft((current) =>
        current.trim().length > 0
          ? `${current.trimEnd()}\n\n${inserted}\n\n`
          : `${inserted}\n\n`,
      );
      requestAnimationFrame(() => {
        const el = composerRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      });
      return true;
    });
    return () => registerQuoteInsert(null);
  }, []);

  return (
    <div className="relative flex min-h-0 min-w-0 flex-1">
      <QuoteSelectionPopover />
      <div
        ref={columnRef}
        className="relative flex min-h-0 min-w-0 flex-1 flex-col"
      >
        {/* The transcript lives behind the dock; keyed by thread so hopping
          between chats swaps cleanly (and the error boundary resets). */}
        <div className="min-h-0 flex-1">
          <AnimatePresence mode="popLayout" initial={false}>
            {inThread && (
              <motion.div
                key={threadId}
                {...THREAD_SWAP}
                className="h-full min-h-0"
              >
                <ThreadErrorBoundary onBackHome={openHome}>
                  <LiveThread
                    key={threadId}
                    threadId={threadId}
                    onMessages={handleMessages}
                    authReady={!isLoading}
                    isAuthenticated={isAuthenticated}
                    ephemeral={incognito.enabled}
                  />
                </ThreadErrorBoundary>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* The ghost toggle holds the top-right corner on home and all
          through an incognito chat. A plain fade: its pill carries a
          backdrop blur, which Chromium won't render under a filter. */}
        <AnimatePresence initial={false}>
          {!inRoutedThread && (
            <motion.div
              key="incognito-toggle"
              {...TOOLBAR_FADE}
              className="absolute top-[max(0.75rem,env(safe-area-inset-top))] right-3 z-10"
            >
              <IncognitoToggle />
            </motion.div>
          )}
        </AnimatePresence>

        {/* The dock overlays both faces: centered on home and floating above
          the transcript's bottom edge in a thread. Only its children catch
          pointers, so the transcript remains scrollable around it. */}
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end px-3 md:px-6",
            !inThread && "top-0 justify-center pb-16",
          )}
        >
          <div className="mx-auto w-full max-w-2xl">
            <AnimatePresence mode="popLayout" initial={false}>
              {!inThread && (
                <motion.div key="greeting" {...TRIM_FADE}>
                  <HomeGreeting />
                </motion.div>
              )}
            </AnimatePresence>
            <DeviceStatusPills />
            <motion.div
              ref={dockRef}
              layout="position"
              transition={DOCK_SPRING}
              transformTemplate={pinRasterPath}
              className={cn(
                "pointer-events-auto",
                /* The tab bar below the pane owns the home indicator's strip
                     now, so this only needs air between itself and the bar. */
                inThread && "pb-4",
              )}
            >
              <ChatComposer
                onSubmit={submit}
                model={model}
                onModelChange={setModel}
                textareaRef={composerRef}
                floating={inThread}
                isGenerating={inThread && isGenerating}
                onStop={stop}
                onQueue={canQueue ? queue : undefined}
                queued={queued}
                onDequeue={dequeue}
                placeholder={
                  incognito.enabled ? "Ask anything — off the record" : undefined
                }
              />
            </motion.div>
            <AnimatePresence mode="popLayout" initial={false}>
              {/* Incognito trims the starters — the mode reads as a bare
                  room on purpose. */}
              {!inThread && !incognito.enabled && (
                <motion.div
                  key="suggestions"
                  {...TRIM_FADE}
                  className="pointer-events-auto"
                >
                  <HomeSuggestions onPick={fillComposer} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        {!inThread && (
          <div className="pointer-events-auto absolute inset-x-0 bottom-0 z-10 hidden md:block">
            <HomeFooter />
          </div>
        )}
      </div>
    </div>
  );
}

/* The data-wired transcript for one thread. Separate component so the
   live subscription (which can throw) lives under the error boundary,
   and so its per-chunk re-renders never touch the composer above.

   Memoized for the other direction: every prop here is stable, and the
   transcript's own data arrives through the subscription inside it — so the
   chat face flipping its Stop button has no business reconciling the
   whole history. */
const LiveThread = memo(function LiveThread({
  threadId,
  onMessages,
  authReady,
  isAuthenticated,
  ephemeral = false,
}: {
  threadId: string;
  onMessages: (threadId: string, messages: ChatMessage[] | undefined) => void;
  authReady: boolean;
  isAuthenticated: boolean;
  /** Incognito: keep the transcript out of the localStorage cache. */
  ephemeral?: boolean;
}) {
  const messages = useThreadMessages(threadId, isAuthenticated, !ephemeral);
  const { retryAssistant, editUserMessage, branchFromMessage, rollbackToMessage } =
    useMessageActions();
  const { openThread } = useView();

  useEffect(() => {
    onMessages(threadId, messages);
  }, [threadId, messages, onMessages]);

  /* Stable identities: the transcript's rows are memoized on their props,
     and a handler rebuilt on every streamed chunk would defeat that for
     every message in the thread. */
  const handleRetry = useCallback(
    (message: ChatMessage) => run(retryAssistant(threadId, message.id)),
    [retryAssistant, threadId],
  );
  const handleEdit = useCallback(
    (message: ChatMessage, content: string) =>
      run(editUserMessage(threadId, message.id, content)),
    [editUserMessage, threadId],
  );
  const handleBranch = useCallback(
    (message: ChatMessage) =>
      run(
        branchFromMessage(threadId, message.id).then((newThreadId) =>
          openThread(newThreadId),
        ),
      ),
    [branchFromMessage, threadId, openThread],
  );
  const handleRollback = useCallback(
    (message: ChatMessage) => run(rollbackToMessage(threadId, message.id)),
    [rollbackToMessage, threadId],
  );
  if (authReady && !isAuthenticated) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-[15px]/5 font-medium text-muted-foreground">
        This browser can&apos;t open saved chats.
      </div>
    );
  }

  return (
    <ThreadView
      messages={messages}
      /* Room at the top so the first message never opens under the status
         bar on a notched phone. */
      contentClassName="pt-[calc(3.5rem+env(safe-area-inset-top))]"
      onRetryMessage={handleRetry}
      onEditMessage={handleEdit}
      /* No branching an incognito chat — the copy would outlive the
         original, which defeats the whole disappearing act. */
      onBranchMessage={ephemeral ? undefined : handleBranch}
      onRollbackMessage={handleRollback}
    />
  );
});

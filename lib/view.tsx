"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  isSettingsSection,
  settingsPath,
  type SettingsSection,
} from "./settings-sections";

export type { SettingsSection };

/* Which face the shell is showing (chats vs settings vs history), which
   thread the chat face is on, and the active settings section — all
   derived from the URL. Waylay is one static page, so routes live in the
   hash: #/settings, #/settings/<section>, #/history and #/thread/<id>. Deep
   links, refresh and the back button all work on any static host, and
   back/forward runs the same page slide.

   Navigation goes through the native History API: the face flips the same
   frame the user clicks, with nothing to fetch — the shell layout
   (app/(shell)/layout.tsx) already has every face mounted. */

const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener("popstate", emit);
    window.addEventListener("hashchange", emit);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("popstate", emit);
      window.removeEventListener("hashchange", emit);
    }
  };
}

/** The in-app path ("/thread/abc"), read from the hash. */
function readRoute(): string {
  const hash = window.location.hash.replace(/^#/, "");
  return hash.startsWith("/") ? hash : "/";
}

/** Moves to an in-app path, as a new history entry. */
export function navigate(path: string, { replace = false } = {}) {
  const url =
    path === "/"
      ? window.location.pathname + window.location.search
      : `${window.location.pathname}${window.location.search}#${path}`;
  if (replace) window.history.replaceState(null, "", url);
  else window.history.pushState(null, "", url);
  emit();
}

/** The current in-app path; "/" before hydration. */
export function useRoute(): string {
  return useSyncExternalStore(subscribe, readRoute, () => "/");
}

export function useView() {
  const pathname = useRoute();

  const settingsOpen =
    pathname === "/settings" || pathname.startsWith("/settings/");
  const segment = settingsOpen ? (pathname.split("/")[2] ?? "") : "";
  const section: SettingsSection = isSettingsSection(segment)
    ? segment
    : "general";

  /* Chat history as a page of its own. It exists for the phone, where the
     tab bar replaced the rail that holds the list — but it is a real route
     like the others, so the back button and a deep link both work, and a
     desktop visit renders the same page beside the rail. */
  const historyOpen = pathname === "/history";

  /* The chat face's current thread; null on home. Junk like
     /thread/a/b just reads as no thread. */
  const threadSegment = pathname.startsWith("/thread/")
    ? pathname.slice("/thread/".length)
    : "";
  const threadId =
    threadSegment && !threadSegment.includes("/") ? threadSegment : null;

  const openSettings = useCallback((target: SettingsSection = "general") => {
    navigate(settingsPath(target));
  }, []);

  const closeSettings = useCallback(() => navigate("/"), []);

  const openHistory = useCallback(() => navigate("/history"), []);

  const openThread = useCallback((id: string) => navigate(`/thread/${id}`), []);

  const openHome = useCallback(() => navigate("/"), []);

  return {
    settingsOpen,
    historyOpen,
    section,
    threadId,
    openSettings,
    closeSettings,
    openHistory,
    openThread,
    openHome,
    setSection: openSettings,
  };
}

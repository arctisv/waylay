"use client";

import { useSyncExternalStore } from "react";

/* Read a reply aloud with the browser's own voices (speechSynthesis) —
   offline wherever the system voices are installed. One reply speaks at a
   time; pressing again stops it. Long replies go out a sentence group at a
   time, because some engines stop a single long utterance partway. */

const CHUNK_CHARS = 220;

let speakingId: string | null = null;
const listeners = new Set<() => void>();

function setSpeaking(id: string | null) {
  speakingId = id;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Markdown down to what's worth saying: no code, math, links or markup. */
function speakable(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " (code) ")
    .replace(/\$\$[\s\S]*?\$\$/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_~|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Sentences, packed into chunks a speech engine reads in one go. */
function chunks(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) ?? [text];
  const out: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    if (current && (current + sentence).length > CHUNK_CHARS) {
      out.push(current.trim());
      current = "";
    }
    current += sentence;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

export function canReadAloud(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Starts reading a reply, or stops it if it's the one already speaking. */
export function toggleReadAloud(id: string, markdown: string) {
  const synth = window.speechSynthesis;
  synth.cancel();
  if (speakingId === id) {
    setSpeaking(null);
    return;
  }
  const parts = chunks(speakable(markdown));
  if (parts.length === 0) return;
  setSpeaking(id);
  parts.forEach((part, index) => {
    const utterance = new SpeechSynthesisUtterance(part);
    if (index === parts.length - 1) {
      utterance.onend = () => {
        if (speakingId === id) setSpeaking(null);
      };
    }
    utterance.onerror = () => {
      if (speakingId === id) setSpeaking(null);
    };
    synth.speak(utterance);
  });
}

/** Whether this reply is being read aloud right now. */
export function useReadingAloud(id: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => speakingId === id,
    () => false,
  );
}

/** Whether this browser can speak at all; false until hydrated. */
export function useCanReadAloud(): boolean {
  return useSyncExternalStore(
    () => () => {},
    canReadAloud,
    () => false,
  );
}

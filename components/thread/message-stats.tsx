"use client";

import { IconBoltFilled, IconClock, IconCpu } from "@tabler/icons-react";

import { useShowStatsPref } from "@/lib/chat-prefs";

function formatTokens(tokens: number): string {
  return tokens.toLocaleString();
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds < 10 ? seconds.toFixed(1) : Math.round(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remSeconds = Math.round(seconds % 60);
  return remSeconds > 0 ? `${minutes}m ${remSeconds}s` : `${minutes}m`;
}

function formatSpeed(tokens: number, ms: number): string {
  const perSecond = tokens / (ms / 1000);
  return `${perSecond < 10 ? perSecond.toFixed(1) : Math.round(perSecond)} tok/s`;
}

/**
 * Subtle stat chips at the end of an assistant message's action row —
 * output tokens (reasoning included), how long the reply took, and how
 * fast this device wrote it. Only shown when "Show stats" is on in
 * settings and the numbers are present.
 */
export function MessageStats({
  outputTokens,
  durationMs,
}: {
  outputTokens?: number;
  durationMs?: number;
}) {
  const [show] = useShowStatsPref();

  const hasTokens = typeof outputTokens === "number" && outputTokens > 0;
  const hasDuration = typeof durationMs === "number" && durationMs > 0;

  if (!show || (!hasTokens && !hasDuration)) return null;

  return (
    <div className="ml-1.5 flex items-center gap-2.5 px-0.5 text-[11.5px]/4 font-medium tabular-nums text-muted-foreground">
      {hasTokens && (
        <span
          className="inline-flex items-center gap-1"
          title="Output tokens (reasoning included)"
        >
          <IconCpu size={12} stroke={2} />
          {formatTokens(outputTokens)} tokens
        </span>
      )}
      {hasDuration && (
        <span className="inline-flex items-center gap-1" title="Response time">
          <IconClock size={12} stroke={2} />
          {formatDuration(durationMs)}
        </span>
      )}
      {hasTokens && hasDuration && (
        <span
          className="inline-flex items-center gap-1"
          title="How fast this device wrote the reply"
        >
          <IconBoltFilled size={12} />
          {formatSpeed(outputTokens, durationMs)}
        </span>
      )}
    </div>
  );
}

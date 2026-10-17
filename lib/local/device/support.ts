"use client";

import { useSyncExternalStore } from "react";

import { detectSupport } from "./detect-support";
import { previewReports } from "./requirements";
import type { SupportReport } from "./types";

/* Whether this browser and device can run a model, checked once per page
   load and shared by everything that asks. `?preview=browser|device` forces
   an answer, for designing the unsupported states on a capable machine. */

const CHECKING: SupportReport = { status: "checking", specs: { webgpu: false } };

let current: SupportReport = CHECKING;
let pending: Promise<SupportReport> | null = null;
const listeners = new Set<() => void>();

function readPreview(): SupportReport | null {
  const value = new URLSearchParams(window.location.search).get("preview");
  return value === "browser" || value === "device" ? previewReports[value] : null;
}

function publish(report: SupportReport) {
  current = report;
  for (const listener of listeners) listener();
}

export function getDeviceSupport(): Promise<SupportReport> {
  if (!pending) {
    const preview = readPreview();
    pending = (preview ? Promise.resolve(preview) : detectSupport()).then((report) => {
      publish(report);
      return report;
    });
  }
  return pending;
}

/** Runs the check again, for "Check again" after updating a browser. */
export function recheckDeviceSupport(): Promise<SupportReport> {
  pending = null;
  return getDeviceSupport();
}

/** The latest answer; "checking" until the first check finishes. */
export function useDeviceSupport(): SupportReport {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      void getDeviceSupport();
      return () => {
        listeners.delete(listener);
      };
    },
    () => current,
    () => CHECKING,
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { features } from '@/config/features';
import { previewReports } from '@/config/requirements';
import { detectSupport } from '@/lib/device/detectSupport';
import type { SupportReport } from '@/lib/device/types';

const INITIAL: SupportReport = { status: 'checking', specs: { webgpu: false } };
/** Keeps "Check again" visibly busy for a moment, so a fast result still reads as a fresh check. */
const MIN_RECHECK_MS = 600;

/** `?preview=browser|device` forces a screen, for designing and testing each state. */
function readPreview(): SupportReport | null {
  const value = new URLSearchParams(window.location.search).get('preview');
  if (value === 'browser' || value === 'device') return previewReports[value];
  return null;
}

async function resolveReport(): Promise<SupportReport> {
  const report = readPreview() ?? (await detectSupport());
  // Without chat there is nothing to show a capable device, so it gets the device screen too.
  if (report.status === 'ready' && !features.chat) return { ...report, status: 'unsupported-device' };
  return report;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useDeviceSupport() {
  const [report, setReport] = useState<SupportReport>(INITIAL);
  const [attempt, setAttempt] = useState(0);
  const [rechecking, setRechecking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const started = performance.now();

    (async () => {
      const next = await resolveReport();
      if (attempt > 0) await wait(MIN_RECHECK_MS - (performance.now() - started));
      if (cancelled) return;
      setReport(next);
      setRechecking(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const recheck = useCallback(() => {
    setRechecking(true);
    setAttempt((n) => n + 1);
  }, []);

  return { report, rechecking, recheck };
}

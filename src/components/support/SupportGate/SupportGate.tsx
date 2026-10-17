'use client';

import { AppShell } from '@/components/layout/AppShell/AppShell';
import { useDeviceSupport } from '@/hooks/useDeviceSupport';
import { BrowserUnsupported } from '../BrowserUnsupported/BrowserUnsupported';
import { DeviceUnsupported } from '../DeviceUnsupported/DeviceUnsupported';

/** Checks the device on load, then explains why Waylay can't run here. */
export function SupportGate() {
  const { report, rechecking, recheck } = useDeviceSupport();

  return (
    <AppShell>
      {report.status === 'unsupported-browser' ? (
        <BrowserUnsupported onRecheck={recheck} rechecking={rechecking} />
      ) : report.status === 'unsupported-device' ? (
        <DeviceUnsupported specs={report.specs} onRecheck={recheck} rechecking={rechecking} />
      ) : null}
    </AppShell>
  );
}

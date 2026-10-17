import type { SupportReport } from '@/lib/device/types';

/** Minimums a device has to meet before Waylay tries to load a model. */
export const requirements = {
  /** Reported by `navigator.deviceMemory` (Chromium only, capped at 8). */
  minMemoryGB: 4,
  /** The largest single buffer the GPU allows, from the WebGPU adapter limits. */
  minGpuBufferMB: 256,
} as const;

/** Browsers that ship WebGPU on both desktop and mobile, with the first version that has it everywhere. */
export const supportedBrowsers = [
  { name: 'Chrome', version: '121' },
  { name: 'Edge', version: '121' },
  { name: 'Safari', version: '26' },
] as const;

/** Sample reports for previewing each screen with `?preview=browser` or `?preview=device`. */
export const previewReports: Record<'browser' | 'device', SupportReport> = {
  browser: {
    status: 'unsupported-browser',
    specs: { webgpu: false },
  },
  device: {
    status: 'unsupported-device',
    specs: { webgpu: true, memoryGB: 2, gpuBufferMB: 128 },
  },
};

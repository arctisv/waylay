import type { SupportReport } from "./types";

/** Minimums a device has to meet before Waylay tries to load a model. */
export const requirements = {
  /** For the GPU models. Reported by `navigator.deviceMemory` (Chromium
   *  only, capped at 8). */
  minMemoryGB: 4,
  /** For the small model that runs on the processor instead. */
  minCpuMemoryGB: 2,
  /** The largest single buffer the GPU allows, from the WebGPU adapter limits. */
  minGpuBufferMB: 256,
} as const;

/** Sample reports for previewing each state with `?preview=browser`,
 *  `?preview=device` or `?preview=cpu`. */
export const previewReports: Record<"browser" | "device" | "cpu", SupportReport> = {
  browser: { status: "unsupported-browser", specs: { webgpu: false } },
  device: { status: "unsupported-device", specs: { webgpu: true, memoryGB: 1, gpuBufferMB: 128 } },
  cpu: { status: "ready", backend: "cpu", specs: { webgpu: false, memoryGB: 8 } },
};

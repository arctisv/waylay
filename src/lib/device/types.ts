export type SupportStatus = 'checking' | 'ready' | 'unsupported-browser' | 'unsupported-device';

export interface DeviceSpecs {
  webgpu: boolean;
  /** Approximate RAM in GB. Only Chromium browsers report it. */
  memoryGB?: number;
  /** Largest GPU buffer in MB. Only known when a WebGPU adapter is available. */
  gpuBufferMB?: number;
}

export interface SupportReport {
  status: SupportStatus;
  specs: DeviceSpecs;
}

/** The small slice of the WebGPU API this app reads, so no extra type package is needed. */
export interface GpuAdapterLike {
  limits: { maxBufferSize: number };
}

export interface NavigatorWithGpu extends Navigator {
  gpu?: { requestAdapter(options?: { powerPreference?: 'low-power' | 'high-performance' }): Promise<GpuAdapterLike | null> };
  deviceMemory?: number;
}

export type SupportStatus =
  | "checking"
  | "ready"
  | "unsupported-browser"
  | "unsupported-device";

export type DeviceSpecs = {
  webgpu: boolean;
  /** Approximate RAM in GB. Only Chromium browsers report it. */
  memoryGB?: number;
  /** Largest GPU buffer in MB. Only known when a WebGPU adapter is available. */
  gpuBufferMB?: number;
  /** Whether the GPU supports 16-bit floats in shaders, which allows the smaller, faster model builds. */
  shaderF16?: boolean;
};

/** Where the models run: the GPU through WebGPU, or the processor through
 *  WebAssembly when there's no usable GPU. */
export type Backend = "webgpu" | "cpu";

export type SupportReport = {
  status: SupportStatus;
  /** Set once the status is "ready". */
  backend?: Backend;
  specs: DeviceSpecs;
};

/** The small slice of the WebGPU API this app reads, so no extra type package is needed. */
export type GpuAdapterLike = {
  limits: { maxBufferSize: number };
  features: { has(feature: string): boolean };
};

export type NavigatorWithGpu = Navigator & {
  gpu?: {
    requestAdapter(options?: {
      powerPreference?: "low-power" | "high-performance";
    }): Promise<GpuAdapterLike | null>;
  };
  deviceMemory?: number;
};

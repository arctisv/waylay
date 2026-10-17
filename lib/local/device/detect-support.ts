import { requirements } from "./requirements";
import type { DeviceSpecs, NavigatorWithGpu, SupportReport } from "./types";

/** Checks whether this browser and device can run a model locally with WebGPU. */
export async function detectSupport(): Promise<SupportReport> {
  const nav = navigator as NavigatorWithGpu;

  if (!nav.gpu) {
    return { status: "unsupported-browser", specs: { webgpu: false } };
  }

  const adapter = await nav.gpu
    .requestAdapter({ powerPreference: "high-performance" })
    .catch(() => null);
  const specs: DeviceSpecs = {
    webgpu: true,
    memoryGB: nav.deviceMemory,
    gpuBufferMB: adapter ? adapter.limits.maxBufferSize / 2 ** 20 : undefined,
    shaderF16: adapter?.features.has("shader-f16"),
  };

  return {
    status: isCapable(specs, Boolean(adapter)) ? "ready" : "unsupported-device",
    specs,
  };
}

function isCapable(specs: DeviceSpecs, hasAdapter: boolean): boolean {
  if (!hasAdapter) return false;
  if (specs.memoryGB !== undefined && specs.memoryGB < requirements.minMemoryGB)
    return false;
  if (
    specs.gpuBufferMB !== undefined &&
    specs.gpuBufferMB < requirements.minGpuBufferMB
  )
    return false;
  return true;
}

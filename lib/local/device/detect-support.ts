import { requirements } from "./requirements";
import type { DeviceSpecs, NavigatorWithGpu, SupportReport } from "./types";

/** Checks where this browser and device can run a model: on the GPU with
 *  WebGPU, on the processor with WebAssembly, or not at all. */
export async function detectSupport(): Promise<SupportReport> {
  const nav = navigator as NavigatorWithGpu;
  const adapter = nav.gpu
    ? await nav.gpu.requestAdapter({ powerPreference: "high-performance" }).catch(() => null)
    : null;
  const specs: DeviceSpecs = {
    webgpu: Boolean(nav.gpu),
    memoryGB: nav.deviceMemory,
    gpuBufferMB: adapter ? adapter.limits.maxBufferSize / 2 ** 20 : undefined,
    shaderF16: adapter?.features.has("shader-f16"),
  };

  if (adapter && gpuCapable(specs)) return { status: "ready", backend: "webgpu", specs };
  if (typeof WebAssembly !== "object") return { status: "unsupported-browser", specs };
  if (specs.memoryGB !== undefined && specs.memoryGB < requirements.minCpuMemoryGB) {
    return { status: "unsupported-device", specs };
  }
  return { status: "ready", backend: "cpu", specs };
}

function gpuCapable(specs: DeviceSpecs): boolean {
  if (specs.memoryGB !== undefined && specs.memoryGB < requirements.minMemoryGB) return false;
  if (specs.gpuBufferMB !== undefined && specs.gpuBufferMB < requirements.minGpuBufferMB) {
    return false;
  }
  return true;
}

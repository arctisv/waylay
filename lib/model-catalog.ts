"use client";

import { useMemo } from "react";

import { useDeviceSupport } from "@/lib/local/device/support";
import { findModel, runsOn } from "@/lib/local/inference/models";
import { CHAT_MODELS, type ComposerModel } from "@/lib/models";

/* What the picker offers on this device: Auto plus every model with a
   build that runs here, each wearing its download size for this device.
   Until the device check answers, the GPU lineup stands in. */
export function useComposerModels(): ComposerModel[] {
  const support = useDeviceSupport();
  const cpu = support.backend === "cpu";
  const f16 = support.status !== "ready" || Boolean(support.specs.shaderF16);

  return useMemo(() => {
    const device = {
      status: "ready" as const,
      backend: cpu ? ("cpu" as const) : ("webgpu" as const),
      specs: { webgpu: !cpu, shaderF16: f16 },
    };
    return CHAT_MODELS.flatMap((model) => {
      const local = findModel(model.key);
      if (!local) return [model];
      if (!runsOn(local, device)) return [];
      const downloadMB = cpu ? local.cpu?.downloadMB : local.gpu?.downloadMB;
      return [{ ...model, downloadMB }];
    });
  }, [cpu, f16]);
}

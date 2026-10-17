import { DeviceLowIllustration } from '@/components/icons';
import { requirements } from '@/config/requirements';
import type { DeviceSpecs } from '@/lib/device/types';
import { formatMegabytes, formatMemory } from '@/lib/format';
import { RequirementList, type Requirement } from '../RequirementList/RequirementList';
import { SupportActions } from '../SupportActions/SupportActions';
import { UnsupportedScreen } from '../UnsupportedScreen/UnsupportedScreen';

interface DeviceUnsupportedProps {
  specs: DeviceSpecs;
  onRecheck: () => void;
  rechecking: boolean;
}

function toRequirements(specs: DeviceSpecs): Requirement[] {
  const memoryOk = specs.memoryGB === undefined || specs.memoryGB >= requirements.minMemoryGB;
  const bufferOk = specs.gpuBufferMB !== undefined && specs.gpuBufferMB >= requirements.minGpuBufferMB;

  return [
    { id: 'webgpu', label: 'WebGPU', detail: 'Lets the browser use your graphics chip', value: 'Supported', tone: 'ok' },
    {
      id: 'memory',
      label: 'Memory',
      detail: `Needs ${requirements.minMemoryGB} GB or more`,
      value: specs.memoryGB === undefined ? 'Not reported' : formatMemory(specs.memoryGB),
      tone: memoryOk ? 'ok' : 'bad',
    },
    {
      id: 'gpu-buffer',
      label: 'Graphics memory',
      detail: `Needs ${formatMegabytes(requirements.minGpuBufferMB)} per buffer or more`,
      value: specs.gpuBufferMB === undefined ? 'Unavailable' : formatMegabytes(specs.gpuBufferMB),
      tone: bufferOk ? 'ok' : 'bad',
    },
  ];
}

export function DeviceUnsupported({ specs, onRecheck, rechecking }: DeviceUnsupportedProps) {
  return (
    <UnsupportedScreen
      illustration={<DeviceLowIllustration />}
      eyebrow="Device not supported"
      title="This device needs a bit more power"
      description="Your browser supports WebGPU, but this device doesn’t have enough memory to run the model smoothly."
      listTitle="What Waylay found"
      list={<RequirementList items={toRequirements(specs)} />}
      hint="Try a laptop or desktop with a recent browser. Closing other apps and tabs can also free up memory."
      actions={<SupportActions onRecheck={onRecheck} rechecking={rechecking} />}
    />
  );
}

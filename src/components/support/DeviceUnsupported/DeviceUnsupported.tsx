import { requirements } from '@/config/requirements';
import type { DeviceSpecs } from '@/lib/device/types';
import { formatMegabytes, formatMemory } from '@/lib/format';
import { SpecGrid, type Spec } from '../SpecGrid/SpecGrid';
import { SupportActions } from '../SupportActions/SupportActions';
import { UnsupportedScreen } from '../UnsupportedScreen/UnsupportedScreen';

interface DeviceUnsupportedProps {
  specs: DeviceSpecs;
  onRecheck: () => void;
  rechecking: boolean;
}

function toSpecs({ memoryGB, gpuBufferMB }: DeviceSpecs): Spec[] {
  return [
    {
      id: 'memory',
      label: 'Memory',
      value: memoryGB === undefined ? 'Unknown' : formatMemory(memoryGB),
      note: `Needs ${requirements.minMemoryGB} GB`,
      short: memoryGB !== undefined && memoryGB < requirements.minMemoryGB,
    },
    {
      id: 'graphics',
      label: 'Graphics',
      value: gpuBufferMB === undefined ? 'Unavailable' : formatMegabytes(gpuBufferMB),
      note: `Needs ${formatMegabytes(requirements.minGpuBufferMB)}`,
      short: gpuBufferMB === undefined || gpuBufferMB < requirements.minGpuBufferMB,
    },
  ];
}

export function DeviceUnsupported({ specs, onRecheck, rechecking }: DeviceUnsupportedProps) {
  return (
    <UnsupportedScreen
      title="This device can’t run Waylay."
      description="Waylay runs the AI on your own hardware, and this device doesn’t have enough memory for it. A recent laptop or desktop will work."
      details={<SpecGrid items={toSpecs(specs)} />}
      actions={<SupportActions onRecheck={onRecheck} rechecking={rechecking} />}
    />
  );
}

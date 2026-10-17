import { supportedBrowsers } from '@/config/requirements';
import { SpecGrid } from '../SpecGrid/SpecGrid';
import { SupportActions } from '../SupportActions/SupportActions';
import { UnsupportedScreen } from '../UnsupportedScreen/UnsupportedScreen';

interface BrowserUnsupportedProps {
  onRecheck: () => void;
  rechecking: boolean;
}

export function BrowserUnsupported({ onRecheck, rechecking }: BrowserUnsupportedProps) {
  return (
    <UnsupportedScreen
      title="This browser can’t run Waylay."
      description="Waylay runs the AI on your own graphics chip with WebGPU, which this browser doesn’t support. Open it in one of these instead."
      details={
        <SpecGrid
          items={supportedBrowsers.map((browser) => ({
            id: browser.name,
            value: browser.name,
            note: `${browser.version} or later`,
          }))}
        />
      }
      actions={<SupportActions onRecheck={onRecheck} rechecking={rechecking} />}
    />
  );
}

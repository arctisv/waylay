import { BrowserBlockedIllustration } from '@/components/icons';
import { supportedBrowsers } from '@/config/requirements';
import { RequirementList } from '../RequirementList/RequirementList';
import { SupportActions } from '../SupportActions/SupportActions';
import { UnsupportedScreen } from '../UnsupportedScreen/UnsupportedScreen';

interface BrowserUnsupportedProps {
  onRecheck: () => void;
  rechecking: boolean;
}

export function BrowserUnsupported({ onRecheck, rechecking }: BrowserUnsupportedProps) {
  return (
    <UnsupportedScreen
      illustration={<BrowserBlockedIllustration />}
      eyebrow="Browser not supported"
      title="Your browser can’t run Waylay"
      description="Waylay runs the AI on your own graphics chip using WebGPU. This browser doesn’t support WebGPU, so the model can’t start here."
      listTitle="Open Waylay in one of these"
      list={
        <RequirementList
          items={supportedBrowsers.map((browser) => ({
            id: browser.name,
            label: browser.name,
            detail: browser.detail,
            tone: 'info',
          }))}
        />
      }
      hint="Already using one of these? Update it to the latest version, then check again."
      actions={<SupportActions onRecheck={onRecheck} rechecking={rechecking} />}
    />
  );
}

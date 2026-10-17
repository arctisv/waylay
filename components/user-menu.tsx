"use client";

import { useEffect, useState } from "react";
import {
  IconDatabaseFilled,
  IconDeviceDesktopFilled,
  IconMoonFilled,
  IconSettingsFilled,
  IconSunFilled,
} from "@tabler/icons-react";

import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes, storageEstimate } from "@/lib/local/storage";
import { useTheme, type Theme } from "@/lib/theme";
import { useView } from "@/lib/view";
import { UsageMeter } from "./usage-meter";

/* Compact, Cursor-ish rows: tight vertical rhythm, muted icons that
   brighten on focus (the base item styles handle the brighten). */
const ITEM = "gap-2 px-2 py-1.5";

/* Radio items reserve right padding for the absolutely-positioned check
   indicator — overriding it with px would run the label under the check. */
const RADIO_ITEM = "gap-2 py-1.5 pr-8 pl-2";

/* On the icon itself (not a descendant selector) so the item's
   focus:**:text-accent-foreground rule still wins on hover. */
const ICON = "text-muted-foreground";

/* Where the usage meter sits in a hosted chat app: here, the only budget
   is this browser's storage, and the bar shows how much of it is free. */
function StorageBlock() {
  const [estimate, setEstimate] = useState<
    { usage: number; quota: number } | null | undefined
  >(undefined);

  useEffect(() => {
    let live = true;
    void storageEstimate().then((next) => {
      if (live) setEstimate(next);
    });
    return () => {
      live = false;
    };
  }, []);

  if (estimate === undefined) {
    return (
      <div className="px-2 pt-1.5 pb-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3.5 w-14" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="mt-2 h-1.5 w-full"/>
        <div className="mt-1.5 flex items-center justify-between">
          <Skeleton className="h-2.5 w-16" />
          <Skeleton className="h-2.5 w-12" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-2 pt-1.5 pb-2">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium">Storage</span>
        <span className="text-xs text-muted-foreground">On this device</span>
      </div>
      {estimate ? (
        <>
          <UsageMeter
            remainingPct={100 - (estimate.usage / estimate.quota) * 100}
            className="mt-2"
          />
          <div className="mt-1.5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span className="truncate">{formatBytes(estimate.usage)} used</span>
            <span className="shrink-0 font-medium tabular-nums whitespace-nowrap text-foreground">
              {formatBytes(Math.max(0, estimate.quota - estimate.usage))} free
            </span>
          </div>
        </>
      ) : (
        <div className="mt-1 text-xs text-muted-foreground">
          Nothing leaves this browser.
        </div>
      )}
    </div>
  );
}

export function UserMenuContent() {
  const { theme, setTheme } = useTheme();
  const { openSettings } = useView();

  return (
    /* Solid on purpose — the user menu is the one popover that stays
       opaque. Width tracks the pill it anchors to; min-w-56 is the floor
       for the collapsed rail's tiny anchor. */
    <DropdownMenuContent
      side="top"
      sideOffset={8}
      className="w-(--anchor-width) min-w-56 bg-popover p-1 backdrop-blur-none"
    >
      <StorageBlock />
      <DropdownMenuSeparator />

      <DropdownMenuSub>
        <DropdownMenuSubTrigger className={ITEM}>
          <IconMoonFilled size={15} className={ICON} />
          Theme
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent className="p-1">
          <DropdownMenuRadioGroup
            value={theme}
            onValueChange={(value) => setTheme(value as Theme)}
          >
            <DropdownMenuRadioItem value="light" className={RADIO_ITEM}>
              <IconSunFilled size={15} className={ICON} />
              Light
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark" className={RADIO_ITEM}>
              <IconMoonFilled size={15} className={ICON} />
              Dark
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system" className={RADIO_ITEM}>
              <IconDeviceDesktopFilled size={15} className={ICON} />
              System
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>

      <DropdownMenuItem className={ITEM} onClick={() => openSettings("storage")}>
        <IconDatabaseFilled size={15} className={ICON} />
        Storage
      </DropdownMenuItem>
      <DropdownMenuItem className={ITEM} onClick={() => openSettings()}>
        <IconSettingsFilled size={15} className={ICON} />
        Settings
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}

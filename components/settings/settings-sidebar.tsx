"use client";

import {
  IconAdjustmentsFilled,
  IconArrowLeft,
  IconDatabaseFilled,
  IconPaletteFilled,
  IconSparklesFilled,
  type Icon,
} from "@tabler/icons-react";

import { IconBrainFilled } from "@/components/icons/brain-filled";
import { useView, type SettingsSection } from "@/lib/view";
import { SidebarRow } from "../sidebar-row";

const SECTIONS: { key: SettingsSection; label: string; icon: Icon }[] = [
  { key: "general", label: "General", icon: IconAdjustmentsFilled },
  { key: "personalization", label: "Personalization", icon: IconPaletteFilled },
  { key: "memory", label: "Memory", icon: IconBrainFilled },
  { key: "models", label: "Models", icon: IconSparklesFilled },
  { key: "storage", label: "Storage", icon: IconDatabaseFilled },
];

/* The sidebar's settings face: same rail, same pitch as the chats face —
   Back sits in the New pill's slot and the section rows tuck under it on
   the shared 2px seams (nav pulled up -mt-1.5 against the page's gap-2,
   hit areas splitting each seam 1px/1px, edge rows bleeding into the page
   gaps). The active section keeps its pill lit. */
export function SettingsSidebar({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const { section, setSection, closeSettings } = useView();
  const sections = SECTIONS;

  return (
    <>
      <SidebarRow
        icon={IconArrowLeft}
        label="Back"
        className="before:-top-1 before:-bottom-px"
        onClick={() => {
          closeSettings();
          onNavigate?.();
        }}
      />
      <nav className="-mt-1.5 flex flex-col gap-0.5">
        {sections.map(({ key, label, icon }, index) => (
          <SidebarRow
            key={key}
            icon={icon}
            label={label}
            active={section === key}
            className={
              index === sections.length - 1
                ? "before:-top-px before:-bottom-1"
                : "before:-top-px before:-bottom-px"
            }
            onClick={() => {
              setSection(key);
              onNavigate?.();
            }}
          />
        ))}
      </nav>
    </>
  );
}

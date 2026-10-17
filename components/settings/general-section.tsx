"use client";

import { useUser } from "@/lib/local/profile";
import { useMutation } from "@/lib/local/react";
import { api } from "@/lib/local/api";
import {
  IconDeviceDesktopFilled,
  IconMoonFilled,
  IconSunFilled,
  type Icon,
} from "@tabler/icons-react";

import {
  useAskBeforeBigPastePref,
  useAutoScrollPref,
  useShowStatsPref,
} from "@/lib/chat-prefs";
import { useTheme, type Theme } from "@/lib/theme";
import { useUnitsPref, type UnitsPref } from "@/lib/units";
import { ToggleSwitch } from "../toggle-switch";
import { ChoiceCapsules } from "./choice-capsules";
import { NameField } from "./name-field";
import { PreferencesField } from "./preferences-field";
import { SettingsCard, SettingsHeader, SettingsRow } from "./settings-rows";

const THEME_OPTIONS: { value: Theme; label: string; icon: Icon }[] = [
  { value: "light", label: "Light", icon: IconSunFilled },
  { value: "dark", label: "Dark", icon: IconMoonFilled },
  { value: "system", label: "System", icon: IconDeviceDesktopFilled },
];

const UNITS_OPTIONS: { value: UnitsPref; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "metric", label: "Metric" },
  { value: "imperial", label: "Imperial" },
];

export function GeneralSection() {
  const { user } = useUser();
  const { theme, setTheme } = useTheme();
  const { units, setUnits } = useUnitsPref();
  const syncUnits = useMutation(api.userContext.setUnitsSystem);
  const [autoScroll, setAutoScroll] = useAutoScrollPref();
  const [showStats, setShowStats] = useShowStatsPref();
  const [askBigPaste, setAskBigPaste] = useAskBeforeBigPastePref();

  /* localStorage is the source of truth for the picker; the chat model
     reads its copy from the local database. */
  const changeUnits = (next: UnitsPref) => {
    setUnits(next);
    if (user) void syncUnits({ unitsSystem: next }).catch(() => {});
  };

  return (
    <>
      <SettingsHeader title="General" description="Make Waylay feel like home." />
      <div className="flex flex-col gap-4">
        <SettingsCard>
          <NameField />
        </SettingsCard>

        <SettingsCard>
          <SettingsRow
            title="Theme"
            description="Pick a side, or let your system call it."
          >
            <ChoiceCapsules
              value={theme}
              onChange={setTheme}
              options={THEME_OPTIONS}
              aria-label="Theme"
            />
          </SettingsRow>
          <SettingsRow
            title="Units"
            description="Measurements in answers. Auto follows your region."
          >
            <ChoiceCapsules
              value={units}
              onChange={changeUnits}
              options={UNITS_OPTIONS}
              aria-label="Units"
            />
          </SettingsRow>
        </SettingsCard>

        <SettingsCard>
          <SettingsRow
            title="Auto-scroll"
            description="Follow new messages as they stream in. When off, the chat stays put and you scroll on your own terms."
            control={
              <ToggleSwitch
                checked={autoScroll}
                onCheckedChange={setAutoScroll}
                aria-label="Auto-scroll"
              />
            }
          />
          <SettingsRow
            title="Show stats"
            description="Show output tokens and response time under each reply."
            control={
              <ToggleSwitch
                checked={showStats}
                onCheckedChange={setShowStats}
                aria-label="Show stats"
              />
            }
          />
          <SettingsRow
            title="Ask about big pastes"
            description="Offer to turn long pastes into a .md attachment. When off, they land in the composer as plain text."
            control={
              <ToggleSwitch
                checked={askBigPaste}
                onCheckedChange={setAskBigPaste}
                aria-label="Ask about big pastes"
              />
            }
          />
        </SettingsCard>

        {/* Memory itself has its own tab; this is the hand-written half of
            "what Waylay knows about me", so it stays here. */}
        <SettingsCard>
          <PreferencesField />
        </SettingsCard>
      </div>
    </>
  );
}

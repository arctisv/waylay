import {
  SETTINGS_SECTIONS,
  type SettingsSection,
} from "@/lib/settings-sections";

/* The optional services this build has. Waylay runs on the device alone:
   there's no billing and no web search, so the controls for both stay
   hidden; long-term memory lives in the browser and is always available. */

export type DeploymentFeatures = {
  billing: boolean;
  search: boolean;
  memory: boolean;
};

const FEATURES: DeploymentFeatures = {
  billing: false,
  search: false,
  memory: true,
};

export function useDeploymentFeatures(): DeploymentFeatures {
  return FEATURES;
}

/** The settings sections worth showing. */
export function useSettingsSections(): readonly SettingsSection[] {
  return SETTINGS_SECTIONS;
}

/* Shared between the client shell (lib/view.tsx) and the document titles —
   no "use client" here, so plain modules can read the list too. */

export const SETTINGS_SECTIONS = [
  "general",
  "personalization",
  "memory",
  "models",
  "storage",
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export function isSettingsSection(value: string): value is SettingsSection {
  return (SETTINGS_SECTIONS as readonly string[]).includes(value);
}

/* Tab titles, kept in sync by the shell as sections change. */
export const SECTION_TITLES: Record<SettingsSection, string> = {
  general: "Settings",
  personalization: "Personalization settings",
  memory: "Memory settings",
  models: "Model settings",
  storage: "Storage settings",
};

/** General lives at the bare /settings; the rest get their own segment. */
export function settingsPath(section: SettingsSection): string {
  return section === "general" ? "/settings" : `/settings/${section}`;
}

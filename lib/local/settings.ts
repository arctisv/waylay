import type { LocalDatabase } from "./db";

/* Small singletons (preferences, favorites, gates, toggles) in the settings
   table, one row per name. */

export type SettingName =
  | "preferences"
  | "modelFavorites"
  | "memory"
  | "homeSuggestions"
  | "units"
  | "profile";

export function getSetting<T>(db: LocalDatabase, name: SettingName): T | undefined {
  return db.get("settings", name)?.value as T | undefined;
}

export function setSetting(db: LocalDatabase, name: SettingName, value: unknown): void {
  if (value === undefined || value === null) db.delete("settings", name);
  else db.insert("settings", { _id: name, value });
}

export type MemorySettings = { enabled: boolean };

/** Memory is on unless it's been turned off in settings. */
export function memoryEnabled(db: LocalDatabase): boolean {
  return getSetting<MemorySettings>(db, "memory")?.enabled ?? true;
}

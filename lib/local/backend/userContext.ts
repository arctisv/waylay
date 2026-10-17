import { mutation } from "../functions";
import { setSetting } from "../settings";

export const setUnitsSystem = mutation((ctx, { unitsSystem }: { unitsSystem: "auto" | "metric" | "imperial" }) => {
  setSetting(ctx.db, "units", unitsSystem);
  return null;
});

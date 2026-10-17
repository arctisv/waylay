/** Formats a size given in megabytes, e.g. 128 → "128 MB", 2048 → "2 GB". */
export function formatMegabytes(mb: number): string {
  if (mb >= 1024) return `${Number((mb / 1024).toFixed(1))} GB`;
  return `${Math.round(mb)} MB`;
}

/** Formats `navigator.deviceMemory`, which browsers cap at 8. */
export function formatMemory(gb: number): string {
  return gb >= 8 ? '8 GB+' : `${gb} GB`;
}

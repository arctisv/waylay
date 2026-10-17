import type { ComposerModel } from "@/lib/models";

/* A model's face at any size: its tier's Tabler glyph. Color follows
   currentColor, so callers just set a text class. */
export function ModelGlyph({
  model,
  size = 15,
  className = "",
}: {
  model: Pick<ComposerModel, "icon">;
  size?: number;
  className?: string;
}) {
  const Icon = model.icon;
  return <Icon size={size} className={className} />;
}

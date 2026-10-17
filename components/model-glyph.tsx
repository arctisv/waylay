import { IconSparklesFilled } from "@tabler/icons-react";

import { MakerLogo } from "@/components/icons/maker-logos";
import type { ComposerModel } from "@/lib/models";

/* A model's face at any size: its maker's mark, or Auto's sparkles. Color
   follows currentColor, so callers just set a text class. */
export function ModelGlyph({
  model,
  size = 15,
  className = "",
}: {
  model: Pick<ComposerModel, "maker">;
  size?: number;
  className?: string;
}) {
  if (!model.maker) return <IconSparklesFilled size={size} className={className} />;
  return <MakerLogo maker={model.maker} size={size} className={className} />;
}

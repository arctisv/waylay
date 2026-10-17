"use client";

import { HoverMark, useTwirl } from "./mark-rings";

export function WaylayLogo({
  size = 20,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const { twirling, twirl } = useTwirl();
  const dim = `${size}px`;

  return (
    <span
      onMouseEnter={twirl}
      style={{ width: dim, height: dim }}
      className={`relative inline-block shrink-0 ${className}`}
    >
      <HoverMark
        twirling={twirling}
        layers={[{ className: "accent-fill" }]}
      />
    </span>
  );
}

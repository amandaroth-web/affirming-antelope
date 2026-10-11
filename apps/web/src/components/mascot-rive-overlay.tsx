"use client";

import { Alignment, Fit, Layout, useRive } from "@rive-app/react-canvas";

const layout = new Layout({
  fit: Fit.Contain,
  alignment: Alignment.Center,
});

type MascotRiveOverlayProps = {
  src: string;
  className?: string;
  onReady?: () => void;
};

export function MascotRiveOverlay({
  src,
  className = "",
  onReady,
}: MascotRiveOverlayProps) {
  const { RiveComponent } = useRive({
    src,
    stateMachines: "State Machine 1",
    autoplay: true,
    layout,
    onRiveReady: () => onReady?.(),
  });

  return (
    <div className={className} aria-hidden="true">
      <RiveComponent className="pointer-events-none h-full w-full" />
    </div>
  );
}

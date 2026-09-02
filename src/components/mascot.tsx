"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useReducedMotion } from "motion/react";
import { useCallback, useState } from "react";
import { preload } from "react-dom";

const MascotThree = dynamic(
  () => import("./mascot-three").then((mod) => mod.MascotThree),
  { ssr: false },
);

type MascotProps = {
  alt: string;
  className?: string;
  width: number;
  height: number;
  priority?: boolean;
};

// The WebGL mascot shows the artwork's linearised colours (a deeper brown). The
// flat still is the same artwork with that transform baked in, so the mascot is
// one colour whether or not WebGL is up. See scripts/mascot-deepen.py.
const still = "/brand-mascot-wave-cartoon-deep.png";
/** Untransformed source: the shaders do the deepening on the GPU. */
const texture = "/brand-mascot-wave-cartoon.png";

export function Mascot({
  alt,
  className = "",
  width,
  height,
  priority = false,
}: MascotProps) {
  const reduce = useReducedMotion();
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);

  if (priority) {
    preload(still, { as: "image" });
  }

  if (reduce) {
    return (
      <Image
        src={still}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        className={className}
      />
    );
  }

  return (
    <div
      className={`relative ${className}`}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <Image
        src={still}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        className={`h-full w-auto max-w-full transition-opacity duration-300 ${
          ready ? "opacity-0" : "opacity-100"
        }`}
      />
      <MascotThree
        src={texture}
        depthSrc="/mascot-wave-depth.png"
        eyesSrc="/mascot-wave-lids.png"
        faceSrc="/mascot-wave-face.png"
        armSrc="/mascot-wave-arm.png"
        width={width}
        height={height}
        className="absolute -inset-[14%]"
        onReady={onReady}
      />
    </div>
  );
}

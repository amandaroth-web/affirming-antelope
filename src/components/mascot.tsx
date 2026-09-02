"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { Lottie, LottieInteractions, lottieInView } from "lottie-react";
import { useReducedMotion } from "motion/react";
import { useCallback, useState } from "react";
import { preload } from "react-dom";
import celebrateAnimation from "@/lottie/mascot-celebrate.json";

const MascotThree = dynamic(
  () => import("./mascot-three").then((mod) => mod.MascotThree),
  { ssr: false },
);

type MascotPose = "wave" | "celebrate";

type MascotProps = {
  pose: MascotPose;
  alt: string;
  className?: string;
  width: number;
  height: number;
  priority?: boolean;
};

// The WebGL hero shows the artwork's linearised colours (a deeper brown). The
// flat stills are the same artwork with that transform baked in, so the mascot
// is one colour everywhere. See scripts/mascot-deepen.py.
const waveStill = "/brand-mascot-wave-cartoon-deep.png";
const celebrateStill = "/brand-mascot-celebrate-cartoon-deep.png";
/** Untransformed source: the shaders do the deepening on the GPU. */
const waveTexture = "/brand-mascot-wave-cartoon.png";

export function Mascot({
  pose,
  alt,
  className = "",
  width,
  height,
  priority = false,
}: MascotProps) {
  const reduce = useReducedMotion();
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const still = pose === "wave" ? waveStill : celebrateStill;

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

  if (pose === "wave") {
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
          src={waveTexture}
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

  return (
    <LottieInteractions
      interactions={[lottieInView({ once: true, amount: 0.25 })]}
    >
      <Lottie
        src={celebrateAnimation}
        assetsPath="/"
        autoplay
        loop
        className={className}
        role="img"
        aria-label={alt}
        style={{ aspectRatio: `${width} / ${height}` }}
      />
    </LottieInteractions>
  );
}

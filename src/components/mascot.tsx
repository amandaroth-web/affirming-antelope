"use client";

import Image from "next/image";
import { Lottie, LottieInteractions, lottieInView } from "lottie-react";
import { useReducedMotion } from "motion/react";
import { preload } from "react-dom";
import celebrateAnimation from "@/lottie/mascot-celebrate.json";
import waveAnimation from "@/lottie/mascot-wave.json";

type MascotPose = "wave" | "celebrate";

type MascotProps = {
  pose: MascotPose;
  alt: string;
  className?: string;
  width: number;
  height: number;
  priority?: boolean;
};

const poses = {
  wave: {
    animation: waveAnimation,
    src: "/brand-mascot-wave-cartoon.png",
  },
  celebrate: {
    animation: celebrateAnimation,
    src: "/brand-mascot-celebrate-cartoon.png",
  },
} as const;

export function Mascot({
  pose,
  alt,
  className = "",
  width,
  height,
  priority = false,
}: MascotProps) {
  const reduce = useReducedMotion();
  const file = poses[pose];

  if (priority) {
    preload(file.src, { as: "image" });
  }

  if (reduce) {
    return (
      <Image
        src={file.src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        className={className}
      />
    );
  }

  return (
    <LottieInteractions
      interactions={[lottieInView({ once: true, amount: 0.25 })]}
    >
      <Lottie
        src={file.animation}
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

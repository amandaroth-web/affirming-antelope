"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

const MascotThree = dynamic(
  () => import("./mascot-three").then((mod) => mod.MascotThree),
  { ssr: false },
);

type MascotProps = {
  alt: string;
  className?: string;
  width: number;
  height: number;
  /** Above the fold: load the still eagerly at high priority so it is the LCP. */
  preload?: boolean;
  /** Rendered width hint for the responsive srcset. */
  sizes?: string;
  /** Below the fold: wait until it's about to scroll into view before loading WebGL. */
  whenVisible?: boolean;
};

/** True once the element is within ~400px of the viewport (always true when not gated). */
function useNearViewport(gated: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(!gated);
  useEffect(() => {
    if (!gated || near) return;
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [gated, near]);
  return { ref, near };
}

/**
 * Mount the WebGL mascot only once the page has loaded and the main thread is
 * idle, so the static still is the LCP and three.js never competes with it.
 */
function useIdleMount(enabled: boolean) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let idleId: number | undefined;
    let timer: number | undefined;
    const schedule = () => {
      // A short beat after load, then wait for idle (with a ceiling).
      timer = window.setTimeout(() => {
        if ("requestIdleCallback" in window) {
          idleId = window.requestIdleCallback(() => setMounted(true), { timeout: 2000 });
        } else {
          setMounted(true);
        }
      }, 600);
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => {
      window.removeEventListener("load", schedule);
      if (timer) window.clearTimeout(timer);
      if (idleId && "cancelIdleCallback" in window) window.cancelIdleCallback(idleId);
    };
  }, [enabled]);
  return mounted;
}

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
  preload = false,
  sizes = "(min-width: 768px) 300px, 270px",
  whenVisible = false,
}: MascotProps) {
  const reduce = useReducedMotion();
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const { ref, near } = useNearViewport(whenVisible);
  const mount3d = useIdleMount(!reduce && near);

  if (reduce) {
    return (
      <Image
        src={still}
        alt={alt}
        width={width}
        height={height}
        loading={preload ? "eager" : undefined}
        fetchPriority={preload ? "high" : undefined}
        sizes={sizes}
        className={className}
      />
    );
  }

  return (
    <div
      ref={ref}
      className={`relative ${className}`}
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      <Image
        src={still}
        alt={alt}
        width={width}
        height={height}
        loading={preload ? "eager" : undefined}
        fetchPriority={preload ? "high" : undefined}
        sizes={sizes}
        className={`h-full w-auto max-w-full transition-opacity duration-300 ${
          ready ? "opacity-0" : "opacity-100"
        }`}
      />
      {mount3d && (
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
      )}
    </div>
  );
}

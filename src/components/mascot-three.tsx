"use client";

import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

type MascotThreeProps = {
  src: string;
  depthSrc: string;
  eyesSrc: string;
  faceSrc: string;
  armSrc: string;
  width: number;
  height: number;
  className?: string;
  onReady?: () => void;
};

// Camera at z=4.1 with fov 30 sees 2.197 units tall; the canvas overhangs the
// still by 14% on every side, so this keeps the rendered mascot the same size.
const PLANE_H = 2.197 / 1.28;

/** Anything with this attribute gets watched on hover/focus. */
export const WATCH_ATTR = "data-mascot-watch";
/** Clicking anything with this attribute makes the mascot celebrate. */
export const CELEBRATE_ATTR = "data-mascot-celebrate";
/** Or dispatch this on window from anywhere (e.g. after a form succeeds). */
export const CELEBRATE_EVENT = "mascot:celebrate";

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Image-space anchors, converted to uv (v is up).
const IMG_W = 674;
const IMG_H = 978;
const MOUTH_TOP_V = 1 - 488 / IMG_H;
// Raised-arm rig, image px (see scripts/mascot-depth.py ARM_SHOULDER/ARM_WRIST).
const ARM_SHOULDER_PX: [number, number] = [205, 615];
const ARM_WRIST_PX: [number, number] = [120, 490];
/** How far the arm swings in toward the face at the top of a wave (radians). */
const WAVE_SWING = 0.19;
const WAVE_FLICK = 0.24;
const WAVE_LEN = 1.4;

/** Image pixel -> plane-local coordinates for a PLANE_H-tall plane. */
function planeXY([x, y]: [number, number], aspect: number): THREE.Vector2 {
  return new THREE.Vector2((x / IMG_W - 0.5) * PLANE_H * aspect, (0.5 - y / IMG_H) * PLANE_H);
}

// The arm is a second copy of the artwork, clipped to the sticker mask and
// bent by two soft bones in the vertex shader: shoulder (G) and wrist (B).
// Nothing is cut out of the drawing, so fill and outline move together.
const armVertex = /* glsl */ `
  uniform sampler2D uArm;
  uniform float uWave;
  uniform float uFlick;
  uniform vec2 uShoulder;
  uniform vec2 uWrist;
  varying vec2 vUv;

  vec2 spin(vec2 p, vec2 c, float a) {
    float s = sin(a);
    float k = cos(a);
    p -= c;
    return c + vec2(k * p.x - s * p.y, s * p.x + k * p.y);
  }

  void main() {
    vUv = uv;
    vec3 bones = texture2D(uArm, uv).rgb;
    vec2 p = position.xy;
    // wrist first (in rest space), then carry the whole forearm at the shoulder
    p = spin(p, uWrist, -uFlick * bones.b);
    p = spin(p, uShoulder, -uWave * bones.g);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, position.z, 1.0);
  }
`;

const armFragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform sampler2D uDepth;
  uniform sampler2D uArm;
  uniform vec2 uParallax;
  varying vec2 vUv;

  void main() {
    float d = texture2D(uDepth, vUv).r - 0.5;
    vec2 uv = vUv + d * uParallax;
    vec4 c = texture2D(uMap, uv);
    // same threshold as the base's erase, so the two partition the drawing
    c.a *= step(0.5, texture2D(uArm, uv).r);
    if (c.a < 0.004) discard;
    gl_FragColor = c;
  }
`;

const fragment = /* glsl */ `
  uniform sampler2D uMap;
  uniform sampler2D uDepth;
  uniform sampler2D uEyes;
  uniform sampler2D uFace;
  uniform sampler2D uArm;
  uniform vec2 uParallax;
  uniform vec2 uGaze;
  uniform float uBlink;
  uniform float uMouth;
  uniform float uBrow;
  varying vec2 vUv;

  const vec3 SCLERA = vec3(1.0);
  const vec3 FUR = vec3(0.875, 0.616, 0.259);
  const vec3 MUZZLE = vec3(0.996, 0.929, 0.812);
  const float MOUTH_TOP = ${MOUTH_TOP_V.toFixed(5)};

  void main() {
    float d = texture2D(uDepth, vUv).r - 0.5;
    vec2 uv = vUv + d * uParallax;
    vec4 c = texture2D(uMap, uv);
    // The raised arm lives on its own mesh; what it uncovers is background.
    c.a *= 1.0 - step(0.5, texture2D(uArm, uv).r);

    // --- Brows: lift the navy stroke, fill fur where it was.
    vec3 face = texture2D(uFace, uv).rgb;
    c.rgb = mix(c.rgb, FUR, face.g);
    vec2 buv = uv - vec2(0.0, uBrow);
    float browHere = texture2D(uFace, buv).g;
    c.rgb = mix(c.rgb, texture2D(uMap, buv).rgb, browHere);

    // --- Mouth: squash the open mouth up toward the upper lip.
    if (face.r > 0.0 && uv.y < MOUTH_TOP) {
      vec2 muv = vec2(uv.x, MOUTH_TOP - (MOUTH_TOP - uv.y) / max(uMouth, 0.05));
      float inMouth = texture2D(uFace, muv).r * step(0.0, muv.y);
      vec3 squashed = mix(MUZZLE, texture2D(uMap, muv).rgb, inMouth);
      c.rgb = mix(c.rgb, squashed, face.r);
    }

    // --- Eyes: r = eye interior (clip), g = top->bottom, b = pupil mask.
    // Erase the pupil where it was drawn, then stamp it at the gazed position,
    // clipped to the interior so it slides under the drawn lid.
    vec3 eye = texture2D(uEyes, uv).rgb;
    c.rgb = mix(c.rgb, SCLERA, face.b);
    vec2 puv = uv - uGaze;
    float pupil = texture2D(uEyes, puv).b * eye.r;
    c.rgb = mix(c.rgb, texture2D(uMap, puv).rgb, pupil);

    // Blink: fur-coloured lid drops from the top of the eye.
    float closed = eye.r * step(eye.g, uBlink) * step(0.01, uBlink);
    c.rgb = mix(c.rgb, FUR, closed);
    // Deliberately no linear->sRGB encode: the linearised artwork is the
    // deeper brown we ship. The flat stills bake the same transform in
    // (scripts/mascot-deepen.py), so keep the two in step if this changes.
    gl_FragColor = c;
  }
`;

function configure(t: THREE.Texture, colorSpace: THREE.ColorSpace) {
  t.colorSpace = colorSpace;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
}

/** The artwork: sRGB colour. */
class ColorTextureLoader extends THREE.TextureLoader {
  load(
    url: string,
    onLoad?: (t: THREE.Texture<HTMLImageElement>) => void,
    onProgress?: (e: ProgressEvent) => void,
    onError?: (e: unknown) => void,
  ) {
    return super.load(
      url,
      (t) => {
        configure(t, THREE.SRGBColorSpace);
        onLoad?.(t);
      },
      onProgress,
      onError,
    );
  }
}

/** Depth and feature masks: raw values, no colour management. */
class DataTextureLoader extends THREE.TextureLoader {
  load(
    url: string,
    onLoad?: (t: THREE.Texture<HTMLImageElement>) => void,
    onProgress?: (e: ProgressEvent) => void,
    onError?: (e: unknown) => void,
  ) {
    return super.load(
      url,
      (t) => {
        configure(t, THREE.NoColorSpace);
        onLoad?.(t);
      },
      onProgress,
      onError,
    );
  }
}

// ---------------------------------------------------------------------------
// Page awareness: cursor, watched elements, typing, celebrations.
// Module-level so the frame loop can read it without re-rendering React.

const page = {
  pointer: { x: 0, y: 0, active: false },
  /** Element the mascot should look at instead of the cursor. */
  watching: null as Element | null,
  /** Monotonic counters the frame loop diffs against. */
  keystrokes: 0,
  celebrations: 0,
};

const TEXT_INPUT = "input, textarea, [contenteditable]";

function normalised(el: Element) {
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  return {
    x: (cx / window.innerWidth) * 2 - 1,
    y: -((cy / window.innerHeight) * 2 - 1),
  };
}

function usePageAwareness() {
  useEffect(() => {
    const p = page.pointer;
    const move = (e: PointerEvent) => {
      p.x = (e.clientX / window.innerWidth) * 2 - 1;
      p.y = -((e.clientY / window.innerHeight) * 2 - 1);
      p.active = true;
    };
    const leave = () => {
      p.active = false;
    };
    const over = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.(`[${WATCH_ATTR}]`);
      if (el) page.watching = el;
    };
    const out = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest?.(`[${WATCH_ATTR}]`);
      if (el && el === page.watching && !document.activeElement?.closest?.(TEXT_INPUT)) {
        page.watching = null;
      }
    };
    const focusIn = (e: FocusEvent) => {
      const el = e.target as Element | null;
      const target = el?.closest?.(`[${WATCH_ATTR}], ${TEXT_INPUT}`);
      if (target) page.watching = target;
    };
    const focusOut = (e: FocusEvent) => {
      const el = e.target as Element | null;
      if (el && el.closest?.(`[${WATCH_ATTR}], ${TEXT_INPUT}`) === page.watching) {
        page.watching = null;
      }
    };
    const typed = () => {
      page.keystrokes += 1;
    };
    const click = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest?.(`[${CELEBRATE_ATTR}]`)) {
        page.celebrations += 1;
      }
    };
    const celebrate = () => {
      page.celebrations += 1;
    };

    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("mouseleave", leave);
    document.addEventListener("pointerover", over, { passive: true });
    document.addEventListener("pointerout", out, { passive: true });
    document.addEventListener("focusin", focusIn);
    document.addEventListener("focusout", focusOut);
    document.addEventListener("input", typed);
    document.addEventListener("click", click);
    window.addEventListener(CELEBRATE_EVENT, celebrate);
    return () => {
      window.removeEventListener("pointermove", move);
      document.removeEventListener("mouseleave", leave);
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerout", out);
      document.removeEventListener("focusin", focusIn);
      document.removeEventListener("focusout", focusOut);
      document.removeEventListener("input", typed);
      document.removeEventListener("click", click);
      window.removeEventListener(CELEBRATE_EVENT, celebrate);
    };
  }, []);
}

// ---------------------------------------------------------------------------
// Confetti: a fixed pool of small rectangles in brand colours.

const CONFETTI_COUNT = 110;
const CONFETTI_COLORS = ["#e8a638", "#4f6bed", "#0a284e", "#fff8e6", "#b97914", "#7f93f5"];

type Particle = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  life: number; // seconds remaining, <= 0 is dead
  size: number;
};

function Confetti({ burstsRef }: { burstsRef: React.MutableRefObject<number> }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const pool = useRef<{ particles: Particle[]; dummy: THREE.Object3D; seen: number } | null>(null);
  if (pool.current == null) {
    pool.current = {
      particles: Array.from({ length: CONFETTI_COUNT }, () => ({
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        rot: 0,
        vrot: 0,
        life: 0,
        size: 0.03,
      })),
      dummy: new THREE.Object3D(),
      seen: 0,
    };
  }

  useEffect(() => {
    const m = mesh.current;
    if (!m) return;
    const color = new THREE.Color();
    for (let i = 0; i < CONFETTI_COUNT; i++) {
      color.set(CONFETTI_COLORS[i % CONFETTI_COLORS.length]);
      m.setColorAt(i, color);
    }
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const m = mesh.current;
    if (!m || !pool.current) return;
    const { particles, dummy } = pool.current;

    if (burstsRef.current !== pool.current.seen) {
      pool.current.seen = burstsRef.current;
      // Launch everything from above the head in an upward fan.
      for (const p of particles) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
        const speed = 1.4 + Math.random() * 1.6;
        p.x = (Math.random() - 0.5) * 0.5;
        p.y = PLANE_H * 0.32;
        p.z = 0.05 + Math.random() * 0.1;
        p.vx = Math.cos(a) * speed * -1;
        p.vy = -Math.sin(a) * speed;
        p.rot = Math.random() * Math.PI;
        p.vrot = (Math.random() - 0.5) * 14;
        p.life = 1.5 + Math.random() * 0.8;
        p.size = 0.028 + Math.random() * 0.03;
      }
    }

    let any = false;
    for (let i = 0; i < CONFETTI_COUNT; i++) {
      const p = particles[i];
      if (p.life > 0) {
        any = true;
        p.life -= dt;
        p.vy -= 4.2 * dt;
        p.vx *= 1 - 1.6 * dt;
        p.vy *= 1 - 0.6 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;
        const fade = Math.min(1, p.life / 0.4);
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set(p.rot * 0.7, p.rot, p.rot * 0.3);
        dummy.scale.set(p.size * fade, p.size * 0.6 * fade, 1);
      } else {
        dummy.position.set(0, -10, 0);
        dummy.scale.set(0, 0, 0);
      }
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    m.visible = any;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, CONFETTI_COUNT]}
      renderOrder={2}
      frustumCulled={false}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial side={THREE.DoubleSide} depthWrite={false} />
    </instancedMesh>
  );
}

// ---------------------------------------------------------------------------

function Character({
  src,
  depthSrc,
  eyesSrc,
  faceSrc,
  armSrc,
  aspect,
  onReady,
}: {
  src: string;
  depthSrc: string;
  eyesSrc: string;
  faceSrc: string;
  armSrc: string;
  aspect: number;
  onReady?: () => void;
}) {
  const map = useLoader(ColorTextureLoader, src);
  const [depth, eyes, face, arm] = useLoader(DataTextureLoader, [depthSrc, eyesSrc, faceSrc, armSrc]);
  const group = useRef<THREE.Group>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const armMaterial = useRef<THREE.ShaderMaterial>(null);
  const bursts = useRef(0);
  const uniforms = useMemo(
    () => ({
      uMap: { value: map },
      uDepth: { value: depth },
      uEyes: { value: eyes },
      uFace: { value: face },
      uArm: { value: arm },
      uParallax: { value: new THREE.Vector2(0, 0) },
      uGaze: { value: new THREE.Vector2(0, 0) },
      uBlink: { value: 0 },
      uMouth: { value: 1 },
      uBrow: { value: 0 },
    }),
    [map, depth, eyes, face, arm],
  );
  const armUniforms = useMemo(
    () => ({
      uMap: { value: map },
      uDepth: { value: depth },
      uArm: { value: arm },
      uParallax: { value: new THREE.Vector2(0, 0) },
      uWave: { value: 0 },
      uFlick: { value: 0 },
      uShoulder: { value: planeXY(ARM_SHOULDER_PX, aspect) },
      uWrist: { value: planeXY(ARM_WRIST_PX, aspect) },
    }),
    [map, depth, arm, aspect],
  );

  useEffect(() => {
    onReady?.();
  }, [onReady]);

  const state = useRef({
    t: 0,
    px: 0,
    py: 0,
    gx: 0,
    gy: 0,
    // where the eyes wander when nobody is pointing at us
    idleX: 0,
    idleY: 0,
    nextIdle: 1.5,
    nextBlink: 2.2,
    blinkStart: -1,
    doubleBlink: false,
    hopStart: -1,
    // mouth: 1 = open as drawn. talkUntil > t means we're chattering.
    mouth: 1,
    talkUntil: -1,
    talkSeed: 0,
    // brows: event-driven raise on top of gaze-driven lift
    browPulseStart: -1,
    browPulseLen: 0.6,
    // small nod on keystrokes
    nodStart: -1,
    seenKeys: 0,
    seenCelebrations: 0,
    watchLean: 0,
    // arm wave: one on arrival, then now and again, and whenever greeted
    waveStart: -1,
    nextWave: 0.9,
    wave: 0,
    flick: 0,
  });

  const hop = () => {
    const s = state.current;
    if (s.hopStart < 0) s.hopStart = s.t;
  };
  const wave = () => {
    const s = state.current;
    if (s.waveStart < 0) s.waveStart = s.t;
  };
  const blinkNow = () => {
    const s = state.current;
    if (s.blinkStart < 0) {
      s.nextBlink = s.t;
      s.doubleBlink = false;
    }
  };
  const talk = (seconds: number) => {
    const s = state.current;
    s.talkUntil = Math.max(s.talkUntil, s.t + seconds);
    s.talkSeed = Math.random() * 100;
  };
  const raiseBrows = (seconds: number) => {
    const s = state.current;
    s.browPulseStart = s.t;
    s.browPulseLen = seconds;
  };
  const greet = () => {
    blinkNow();
    raiseBrows(0.7);
    talk(0.55);
    wave();
  };
  const celebrate = () => {
    hop();
    wave();
    raiseBrows(1.2);
    talk(1.1);
    bursts.current += 1;
    const s = state.current;
    s.nextBlink = s.t + 0.5;
    s.doubleBlink = false;
  };

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const s = state.current;
    s.t += dt;
    const t = s.t;
    const k = 1 - Math.exp(-dt * 6);

    // --- page events
    if (page.celebrations !== s.seenCelebrations) {
      s.seenCelebrations = page.celebrations;
      celebrate();
    }
    if (page.keystrokes !== s.seenKeys) {
      s.seenKeys = page.keystrokes;
      s.nodStart = t;
      if (Math.random() < 0.15) blinkNow();
    }

    // --- where to look
    let tx: number;
    let ty: number;
    const watching = page.watching && page.watching.isConnected ? page.watching : null;
    if (watching) {
      const n = normalised(watching);
      tx = n.x;
      ty = n.y;
    } else if (page.pointer.active) {
      tx = page.pointer.x;
      ty = page.pointer.y;
    } else {
      if (t >= s.nextIdle) {
        // glance somewhere new, mostly sideways, sometimes back to centre
        const back = Math.random() < 0.35;
        s.idleX = back ? 0 : (Math.random() - 0.5) * 1.3;
        s.idleY = back ? 0 : (Math.random() - 0.5) * 0.7;
        s.nextIdle = t + 1.6 + Math.random() * 2.4;
      }
      tx = s.idleX;
      ty = s.idleY;
    }
    s.watchLean += ((watching ? 1 : 0) - s.watchLean) * k;
    s.px += (tx - s.px) * k;
    s.py += (ty - s.py) * k;
    // Pupils lead the head: a quicker follow than the tilt.
    s.gx += (tx - s.gx) * (1 - Math.exp(-dt * 10));
    s.gy += (ty - s.gy) * (1 - Math.exp(-dt * 10));

    // three copies the uniforms object on construction; write through the material.
    const mat = material.current;
    if (!mat) return;
    const u = mat.uniforms;
    (u.uParallax.value as THREE.Vector2).set(s.px * 0.055, -s.py * 0.035);
    (u.uGaze.value as THREE.Vector2).set(s.gx * 0.0145, s.gy * 0.0095);

    // --- wave: the arm swings in toward the face a few times under a soft
    // envelope; the hoof trails the forearm by a beat.
    if (s.waveStart < 0 && t >= s.nextWave) s.waveStart = t;
    let waveTarget = 0;
    let flickTarget = 0;
    if (s.waveStart >= 0) {
      const e = (t - s.waveStart) / WAVE_LEN;
      if (e < 1) {
        const env = Math.sin(e * Math.PI) ** 0.8;
        const phase = e * Math.PI * 2 * 2.5;
        waveTarget = WAVE_SWING * env * (0.5 - 0.5 * Math.cos(phase));
        flickTarget = WAVE_FLICK * env * Math.sin(phase - 1.1);
      } else {
        s.waveStart = -1;
        s.nextWave = t + 9 + Math.random() * 9;
      }
    }
    // a touch of lag so the limb has weight
    s.wave += (waveTarget - s.wave) * (1 - Math.exp(-dt * 26));
    s.flick += (flickTarget - s.flick) * (1 - Math.exp(-dt * 20));
    const am = armMaterial.current;
    if (am) {
      const au = am.uniforms;
      (au.uParallax.value as THREE.Vector2).copy(u.uParallax.value as THREE.Vector2);
      au.uWave.value = s.wave;
      au.uFlick.value = s.flick;
    }

    // --- mouth
    let mouthTarget = 1;
    if (t < s.talkUntil) {
      // two overlapping rhythms so it doesn't look like a metronome
      const a = Math.sin((t + s.talkSeed) * 17.0);
      const b = Math.sin((t + s.talkSeed) * 11.3 + 1.7);
      mouthTarget = 0.28 + 0.72 * Math.abs(a * 0.6 + b * 0.4);
    }
    s.mouth += (mouthTarget - s.mouth) * (1 - Math.exp(-dt * 22));
    u.uMouth.value = s.mouth;

    // --- brows: lift a little when looking up, plus event pulses
    let brow = Math.max(0, s.py) * 0.35 + s.watchLean * 0.3;
    if (s.browPulseStart >= 0) {
      const e = (t - s.browPulseStart) / s.browPulseLen;
      if (e < 1) brow += Math.sin(e * Math.PI) ** 0.6;
      else s.browPulseStart = -1;
    }
    u.uBrow.value = Math.min(1, brow) * 0.0105;

    // --- hop: anticipation squash, jump, land with a little settle.
    let hopY = 0;
    let hopSy = 1;
    if (s.hopStart >= 0) {
      const e = t - s.hopStart;
      if (e < 0.1) {
        hopSy = 1 - 0.07 * Math.sin((e / 0.1) * Math.PI);
      } else if (e < 0.6) {
        const a = (e - 0.1) / 0.5;
        hopY = Math.sin(a * Math.PI) * 0.16;
        hopSy = 1 + 0.05 * Math.sin(a * Math.PI);
      } else if (e < 0.8) {
        const a = (e - 0.6) / 0.2;
        hopSy = 1 - 0.05 * Math.sin(a * Math.PI);
      } else {
        s.hopStart = -1;
      }
    }

    // --- keystroke nod
    let nod = 0;
    if (s.nodStart >= 0) {
      const e = (t - s.nodStart) / 0.22;
      if (e < 1) nod = Math.sin(e * Math.PI) * 0.045;
      else s.nodStart = -1;
    }

    if (group.current) {
      const g = group.current;
      g.rotation.y = s.px * (0.16 + s.watchLean * 0.05);
      g.rotation.x = -s.py * 0.1 + nod;
      g.rotation.z = -s.px * 0.035;
      const floatY = Math.sin(t * 1.15) * 0.022;
      g.position.y = floatY + hopY - (1 - hopSy) * (PLANE_H / 2);
      const breath = 1 + Math.sin(t * 1.15 + 0.8) * 0.006;
      const sy = breath * hopSy;
      g.scale.set(1 / sy, sy, 1);
    }
    if (shadow.current) {
      const lift = Math.min(1, (Math.sin(t * 1.15) + 1) / 2 + hopY * 4); // 0..1
      const sc = 1 - lift * 0.12;
      shadow.current.scale.set(sc, sc, 1);
      const sm = shadow.current.material as THREE.MeshBasicMaterial;
      sm.opacity = 0.28 - lift * 0.12;
    }

    // --- blink: fast close, brief hold, slower open. Occasional double blink.
    if (s.blinkStart < 0 && t >= s.nextBlink) {
      s.blinkStart = t;
    }
    if (s.blinkStart >= 0) {
      const e = t - s.blinkStart;
      let v = 0;
      if (e < 0.07) v = e / 0.07;
      else if (e < 0.11) v = 1;
      else if (e < 0.22) v = 1 - (e - 0.11) / 0.11;
      else {
        v = 0;
        s.blinkStart = -1;
        if (!s.doubleBlink && Math.random() < 0.25) {
          s.doubleBlink = true;
          s.nextBlink = t + 0.18;
        } else {
          s.doubleBlink = false;
          s.nextBlink = t + 2.6 + Math.random() * 2.4;
        }
      }
      u.uBlink.value = v;
    }
  });

  const shadowTex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d")!;
    const grd = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grd.addColorStop(0, "rgba(10,40,78,1)");
    grd.addColorStop(0.55, "rgba(10,40,78,0.55)");
    grd.addColorStop(1, "rgba(10,40,78,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, 256, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  return (
    <>
      <mesh ref={shadow} position={[0.02, -PLANE_H / 2 - 0.02, -0.2]} renderOrder={0}>
        <planeGeometry args={[PLANE_H * aspect * 0.78, 0.16]} />
        <meshBasicMaterial map={shadowTex} transparent opacity={0.25} depthWrite={false} />
      </mesh>
      <group ref={group} renderOrder={1}>
        <mesh
          onPointerDown={celebrate}
          onPointerEnter={() => {
            greet();
            document.body.style.cursor = "pointer";
          }}
          onPointerLeave={() => {
            document.body.style.cursor = "";
          }}
        >
          <planeGeometry args={[PLANE_H * aspect, PLANE_H]} />
          <shaderMaterial
            ref={material}
            uniforms={uniforms}
            vertexShader={vertex}
            fragmentShader={fragment}
            transparent
            depthWrite={false}
          />
        </mesh>
        {/* the raised arm, bent per-vertex; ~4px of artwork per grid cell.
            Same z as the body: any offset would re-project it by a fraction of a
            pixel and open a seam along the cut. renderOrder stacks it on top. */}
        <mesh renderOrder={2} raycast={() => null}>
          <planeGeometry args={[PLANE_H * aspect, PLANE_H, 168, 244]} />
          <shaderMaterial
            ref={armMaterial}
            uniforms={armUniforms}
            vertexShader={armVertex}
            fragmentShader={armFragment}
            transparent
            depthWrite={false}
          />
        </mesh>
      </group>
      <Confetti burstsRef={bursts} />
    </>
  );
}

export function MascotThree({
  src,
  depthSrc,
  eyesSrc,
  faceSrc,
  armSrc,
  width,
  height,
  className = "",
  onReady,
}: MascotThreeProps) {
  usePageAwareness();
  const aspect = width / height;

  return (
    <div className={className} aria-hidden="true">
      <Canvas
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true, premultipliedAlpha: true }}
        camera={{ position: [0, 0, 4.1], fov: 30 }}
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          <Character
            src={src}
            depthSrc={depthSrc}
            eyesSrc={eyesSrc}
            faceSrc={faceSrc}
            armSrc={armSrc}
            aspect={aspect}
            onReady={onReady}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

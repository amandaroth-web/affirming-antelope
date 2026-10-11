"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChartLine, ListBullets, Star } from "@phosphor-icons/react";
import type { Exchange } from "@/lib/trainer/exchanges";
import { FAMILY, MOVE, ZONE, moveLabel, stanceLabel, type MoveFamily, type ZoneKey } from "@/lib/trainer/content";
import { focusRing } from "../ui";

const LABEL_W = 108;
const PAD_X = 22;
const TOP = 10;
const PLOT_H = 210;
/** Breathing room so ±2 sits inside the plot instead of on its edge. */
const INSET = 16;
const AXIS_H = 30;
const H = TOP + PLOT_H + AXIS_H;

const BANDS: { key: ZoneKey; from: number; to: number; fill: string }[] = [
  { key: "change", from: 2, to: 0.67, fill: "var(--zone-change)" },
  { key: "mixed", from: 0.67, to: -0.67, fill: "var(--zone-mixed)" },
  { key: "hold", from: -0.67, to: -2, fill: "var(--zone-hold)" },
];

type Pt = { x: number; y: number };
type Seg = [Pt, Pt, Pt, Pt];

/** Monotone cubic (Fritsch–Carlson): smooth, never overshoots past ±2. Same curve as mobile. */
function monotone(pts: Pt[]): { d: string; segs: Seg[] } {
  const n = pts.length;
  if (n < 2) return { d: n ? `M${pts[0].x},${pts[0].y}` : "", segs: [] };
  const dx = pts.slice(1).map((p, i) => p.x - pts[i].x);
  const slope = pts.slice(1).map((p, i) => (p.y - pts[i].y) / dx[i]);
  const m = pts.map((_, i) =>
    i === 0 ? slope[0] : i === n - 1 ? slope[n - 2] : slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2,
  );
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * slope[i];
      m[i + 1] = t * b * slope[i];
    }
  }
  const segs: Seg[] = [];
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    const c1 = { x: pts[i].x + h, y: pts[i].y + m[i] * h };
    const c2 = { x: pts[i + 1].x - h, y: pts[i + 1].y - m[i + 1] * h };
    segs.push([pts[i], c1, c2, pts[i + 1]]);
    d += ` C${c1.x},${c1.y} ${c2.x},${c2.y} ${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return { d, segs };
}

function bez([p0, p1, p2, p3]: Seg, t: number): Pt {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

function segLen(seg: Seg, to = 1): number {
  let len = 0;
  let prev = seg[0];
  for (let k = 1; k <= 24; k++) {
    const p = bez(seg, (k / 24) * to);
    len += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  return len;
}

export function MoveShape({ family, x = 0, y = 0, size = 7, stroke = "white" }: { family: MoveFamily; x?: number; y?: number; size?: number; stroke?: string }) {
  const fill = FAMILY[family].color;
  const common = { fill, stroke, strokeWidth: 2 };
  switch (family) {
    case "question":
      return <circle cx={x} cy={y} r={size} {...common} />;
    case "reflection":
      return <rect x={x - size * 0.85} y={y - size * 0.85} width={size * 1.7} height={size * 1.7} rx={2} transform={`rotate(45 ${x} ${y})`} {...common} />;
    case "support":
      return <rect x={x - size * 0.85} y={y - size * 0.85} width={size * 1.7} height={size * 1.7} rx={2.5} {...common} />;
    case "inconsistent":
      return <path d={`M${x},${y - size * 1.05} L${x + size},${y + size * 0.75} L${x - size},${y + size * 0.75} Z`} strokeLinejoin="round" {...common} />;
    default:
      return <circle cx={x} cy={y} r={size * 0.55} {...common} />;
  }
}

export function TrajectoryChart({
  exchanges,
  personaName,
  counterpart,
}: {
  exchanges: Exchange[];
  personaName: string;
  /** "Patient" or "Employee". */
  counterpart: string;
}) {
  const reduce = useReducedMotion();
  const uid = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const inView = useInView(wrap, { once: true, amount: 0.4 });
  const [w, setW] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [asList, setAsList] = useState(false);
  const [landed, setLanded] = useState(false);
  const n = exchanges.length;
  const first = personaName.split(/\s+/)[0];

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    setW(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, [asList]);

  const geo = useMemo(() => {
    if (!w || !n) return null;
    const left = LABEL_W + PAD_X;
    const right = w - PAD_X;
    const step = n > 1 ? (right - left) / (n - 1) : 0;
    const yOf = (v: number) => TOP + INSET + ((2 - Math.max(-2, Math.min(2, v))) / 4) * (PLOT_H - 2 * INSET);
    /** Band edges: ±2 reach the plot's edges, the zone boundaries line up with yOf. */
    const bandY = (v: number) => (v >= 2 ? TOP : v <= -2 ? TOP + PLOT_H : yOf(v));
    const pts = exchanges.map((e, i) => ({ x: n > 1 ? left + i * step : (left + right) / 2, y: yOf(e.value) }));
    const { d, segs } = monotone(pts);
    const lens = segs.map((s) => segLen(s));
    const total = lens.reduce((a, b) => a + b, 0) || 1;
    const cum = [0];
    lens.forEach((l, i) => cum.push(cum[i] + l));
    const marks = exchanges.slice(1).map((e, k) => ({ ...bez(segs[k], 0.5), at: (cum[k] + segLen(segs[k], 0.5)) / total, e }));
    return { pts, d, marks, step, left, right, yOf, bandY };
  }, [w, n, exchanges]);

  const drawSec = reduce ? 0 : 1.2 + n * 0.08;
  const play = inView || reduce;

  // After the trace lands, settle on the first key moment so the chart invites a look.
  useEffect(() => {
    if (!play || !geo || landed) return;
    const t = setTimeout(
      () => {
        setLanded(true);
        const k = exchanges.findIndex((e) => e.keyMoment);
        setSel((s) => (s === null ? (k > 0 ? k : n - 1) : s));
      },
      reduce ? 0 : (drawSec + 0.25) * 1000,
    );
    return () => clearTimeout(t);
  }, [play, geo, landed, exchanges, n, reduce, drawSec]);

  const families = Array.from(new Set(exchanges.filter((e) => e.move).map((e) => MOVE[e.move!].family)));
  const start = exchanges[0];
  const end = exchanges[n - 1];
  const summary = n
    ? `${first} started ${stanceLabel(start.stance, start.value).toLowerCase()} and ended ${stanceLabel(end.stance, end.value).toLowerCase()}, over ${n - 1} ${n - 1 === 1 ? "exchange" : "exchanges"}.`
    : "";
  const s = sel !== null ? exchanges[sel] : null;
  const calloutW = Math.min(340, w);
  const calloutLeft = geo && sel !== null ? Math.min(Math.max(geo.pts[sel].x - calloutW / 2, 0), Math.max(0, w - calloutW)) : 0;

  function onKey(e: React.KeyboardEvent) {
    if (!n) return;
    let i = sel ?? 0;
    if (e.key === "ArrowRight") i = Math.min(n - 1, i + 1);
    else if (e.key === "ArrowLeft") i = Math.max(0, i - 1);
    else if (e.key === "Home") i = 0;
    else if (e.key === "End") i = n - 1;
    else return;
    e.preventDefault();
    setSel(i);
    document.getElementById(`${uid}-x${i}`)?.focus();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[14px] font-semibold text-muted">
          {asList ? "Each exchange, in order." : `How open ${first}, the ${counterpart.toLowerCase()}, was after each of the learner's replies.`}
        </p>
        <button type="button" onClick={() => setAsList((v) => !v)} className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[13px] font-extrabold text-primary hover:bg-soft ${focusRing}`}>
          {asList ? <ChartLine size={16} weight="bold" aria-hidden /> : <ListBullets size={16} weight="bold" aria-hidden />}
          {asList ? "Show as chart" : "Show as list"}
        </button>
      </div>

      {asList ? (
        <ol className="mt-4 grid gap-2">
          {exchanges.map((e) => (
            <li key={e.employee.id} className="rounded-2xl border-2 border-soft px-4 py-3">
              <p className="text-[12px] font-extrabold uppercase tracking-[0.08em] text-muted">
                {e.index === 0 ? "Opening" : `Exchange ${e.index}`} · {stanceLabel(e.stance, e.value)}
              </p>
              {e.learner ? (
                <p className="mt-1 text-[14px] font-semibold text-ink">
                  <span className="font-extrabold">{moveLabel(e.move)}:</span> “{e.learner.text}”
                </p>
              ) : null}
              <p className="mt-1 text-[14px] font-semibold text-ink/75">
                {first}: “{e.employee.text}”
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <div className="relative mt-3" ref={wrap} style={{ height: H + 158 }}>
          <p className="sr-only">{summary} Use the exchange buttons to hear each step.</p>
          {geo ? (
            <>
              <svg width={w} height={H} className="absolute top-0 left-0 overflow-visible" aria-hidden>
                <defs>
                  <clipPath id={`${uid}-plot`}>
                    <rect x={LABEL_W} y={TOP} width={w - LABEL_W} height={PLOT_H} rx={14} />
                  </clipPath>
                </defs>
                <g clipPath={`url(#${uid}-plot)`}>
                  {BANDS.map((b) => (
                    <rect key={b.key} x={LABEL_W} y={geo.bandY(b.from)} width={w - LABEL_W} height={geo.bandY(b.to) - geo.bandY(b.from)} fill={b.fill} />
                  ))}
                </g>
                <rect x={LABEL_W} y={TOP} width={w - LABEL_W} height={PLOT_H} rx={14} fill="none" stroke="var(--line)" strokeWidth={2} />
                {[0.67, -0.67].map((v) => (
                  <line key={v} x1={LABEL_W} x2={w} y1={geo.yOf(v)} y2={geo.yOf(v)} stroke="var(--line)" strokeWidth={1.5} strokeDasharray="4 5" />
                ))}
                {BANDS.map((b) => (
                  <text
                    key={b.key}
                    x={LABEL_W - 12}
                    y={(geo.bandY(b.from) + geo.bandY(b.to)) / 2}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="fill-muted text-[12px] font-extrabold"
                    style={b.key === "hold" ? { fill: "var(--zone-hold-ink)" } : b.key === "change" ? { fill: "var(--primary-shadow)" } : undefined}
                  >
                    {ZONE[b.key].label}
                  </text>
                ))}

                {/* selection guide */}
                {sel !== null ? (
                  <motion.line
                    initial={false}
                    animate={{ x1: geo.pts[sel].x, x2: geo.pts[sel].x }}
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 34 }}
                    y1={TOP + 4}
                    y2={TOP + PLOT_H - 4}
                    stroke="var(--primary)"
                    strokeOpacity={0.35}
                    strokeWidth={2}
                  />
                ) : null}

                <motion.path
                  d={geo.d}
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth={3.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={reduce ? false : { pathLength: 0 }}
                  animate={play ? { pathLength: 1 } : { pathLength: 0 }}
                  transition={{ duration: drawSec, ease: [0.65, 0, 0.35, 1], delay: reduce ? 0 : 0.15 }}
                />

                {geo.pts.map((p, i) => (
                  <motion.circle
                    key={`p${i}`}
                    cx={p.x}
                    cy={p.y}
                    r={sel === i ? 7 : 5}
                    fill="white"
                    stroke="var(--primary)"
                    strokeWidth={3}
                    initial={reduce ? false : { opacity: 0 }}
                    animate={play ? { opacity: 1 } : { opacity: 0 }}
                    transition={{ delay: reduce ? 0 : 0.15 + (n > 1 ? i / (n - 1) : 0) * drawSec, duration: 0.2 }}
                  />
                ))}

                {geo.marks.map((m, k) => {
                  const fam = m.e.move ? MOVE[m.e.move].family : "neutral";
                  return (
                    <motion.g
                      key={`m${k}`}
                      style={{ transformOrigin: `${m.x}px ${m.y}px`, transformBox: "view-box" }}
                      initial={reduce ? false : { scale: 0, opacity: 0 }}
                      animate={play ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
                      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 18, delay: 0.15 + m.at * drawSec }}
                    >
                      {m.e.keyMoment ? <circle cx={m.x} cy={m.y} r={14} fill="var(--gold-tint)" stroke="var(--gold)" strokeWidth={2} /> : null}
                      <MoveShape family={fam} x={m.x} y={m.y} />
                    </motion.g>
                  );
                })}

                {geo.pts.map((p, i) => (
                  <text key={`a${i}`} x={p.x} y={TOP + PLOT_H + 20} textAnchor="middle" className="fill-muted text-[12px] font-extrabold">
                    {i === 0 ? "Open" : i}
                  </text>
                ))}
              </svg>

              {/* Focusable exchange targets (one per point), full plot height */}
              <div role="group" aria-label={`${counterpart} ${first}'s openness, exchange by exchange`} onKeyDown={onKey} className="absolute top-0 left-0" style={{ width: w, height: H }}>
                {geo.pts.map((p, i) => {
                  const e = exchanges[i];
                  const half = n > 1 ? geo.step / 2 : 40;
                  return (
                    <button
                      key={i}
                      id={`${uid}-x${i}`}
                      type="button"
                      tabIndex={sel === i || (sel === null && i === 0) ? 0 : -1}
                      aria-pressed={sel === i}
                      aria-label={`${e.index === 0 ? "Opening line" : `Exchange ${e.index}`}${e.move ? `, learner used ${moveLabel(e.move).toLowerCase()}` : ""}; ${first} ${stanceLabel(e.stance, e.value).toLowerCase()}${e.keyMoment ? ". Key moment" : ""}`}
                      onMouseEnter={() => setSel(i)}
                      onFocus={() => setSel(i)}
                      onClick={() => setSel(i)}
                      className="absolute rounded-xl focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/40"
                      style={{ left: p.x - half, width: half * 2, top: TOP, height: PLOT_H }}
                    />
                  );
                })}
              </div>

              {/* Callout */}
              <AnimatePresence mode="wait">
                {s && geo && sel !== null ? (
                  <motion.div
                    key={sel}
                    initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: { duration: 0.08 } }}
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    className="absolute rounded-2xl border-2 border-line bg-white px-4 py-3 shadow-[0_4px_0_var(--shadow)]"
                    style={{ top: H + 4, left: calloutLeft, width: calloutW }}
                    aria-live="polite"
                  >
                    <span
                      aria-hidden
                      className="absolute -top-[7px] h-3 w-3 rotate-45 border-t-2 border-l-2 border-line bg-white"
                      style={{ left: Math.max(14, Math.min(calloutW - 26, geo.pts[sel].x - calloutLeft - 6)) }}
                    />
                    <p className="flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-[0.08em] text-muted">
                      {s.index === 0 ? "Opening" : `Exchange ${s.index}`}
                      {s.keyMoment ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-gold-tint px-2 py-0.5 text-gold-ink normal-case tracking-normal">
                          <Star size={11} weight="fill" aria-hidden /> Key moment
                        </span>
                      ) : null}
                    </p>
                    {s.learner ? (
                      <p className="mt-1.5 line-clamp-2 text-[14px] font-semibold leading-snug text-ink">
                        <span className="font-extrabold" style={{ color: s.move ? FAMILY[MOVE[s.move].family].color : undefined }}>
                          {moveLabel(s.move)}
                        </span>{" "}
                        “{s.learner.text}”
                      </p>
                    ) : null}
                    <p className="mt-1.5 line-clamp-2 text-[14px] font-semibold leading-snug text-ink/75">
                      <span className="font-extrabold text-ink">{first}, {stanceLabel(s.stance, s.value).toLowerCase()}:</span> “{s.employee.text}”
                    </p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </>
          ) : null}
        </div>
      )}

      {!asList && families.length ? (
        <ul className="mt-1 flex flex-wrap gap-x-5 gap-y-2" aria-label="Legend">
          {families.map((f) => (
            <li key={f} className="flex items-center gap-2 text-[13px] font-bold text-ink/80">
              <svg width={16} height={16} viewBox="-8 -8 16 16" aria-hidden>
                <MoveShape family={f} size={5.5} stroke="none" />
              </svg>
              {FAMILY[f].label}
            </li>
          ))}
          <li className="flex items-center gap-2 text-[13px] font-bold text-ink/80">
            <svg width={16} height={16} viewBox="0 0 16 16" aria-hidden>
              <path d="M1 11 C5 11 5 4 8 4 S11 8 15 5" fill="none" stroke="var(--primary)" strokeWidth={2.5} strokeLinecap="round" />
            </svg>
            {counterpart}&apos;s openness
          </li>
          {exchanges.some((e) => e.keyMoment) ? (
            <li className="flex items-center gap-2 text-[13px] font-bold text-ink/80">
              <span className="h-3.5 w-3.5 rounded-full border-2 border-gold bg-gold-tint" aria-hidden /> Key moment
            </li>
          ) : null}
        </ul>
      ) : null}
      {summary ? <p className="mt-3 text-[14px] font-bold text-ink">{summary}</p> : null}
    </div>
  );
}

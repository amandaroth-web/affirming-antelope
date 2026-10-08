/**
 * Trail geometry for the Path screen. Pure functions so the layout is
 * deterministic and testable: node positions on a serpentine, a smooth cubic
 * path through them, and a length table for strokeDashoffset reveals.
 */

export interface Pt {
  x: number;
  y: number;
}

export interface TrailLayout {
  width: number;
  height: number;
  nodes: Pt[];
  /** SVG path data for the whole trail, lead-in to finish. */
  d: string;
  /** Total path length. */
  length: number;
  /** Path length at each node. */
  nodeLen: number[];
  /** (y, length) samples, monotonic in y, for mapping scroll to drawn length. */
  ys: number[];
  lens: number[];
  start: Pt;
  finish: Pt;
}

export const STEP = 172;
export const NODE = 72;

export function layoutTrail(width: number, count: number, top: number): TrailLayout {
  const amp = Math.min(width * 0.27, 120);
  const cx = width / 2;
  const nodes: Pt[] = Array.from({ length: count }, (_, i) => ({
    x: cx + amp * Math.sin(i * 0.95 + 0.15),
    y: top + i * STEP,
  }));
  const start = { x: nodes[0].x - amp * 0.35, y: top - 120 };
  const finish = { x: cx, y: nodes[count - 1].y + STEP + 10 };
  const pts = [start, ...nodes, finish];

  // Catmull-Rom to cubic Bezier
  const segs: [Pt, Pt, Pt, Pt][] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const t = 0.5;
    const c1 = { x: p1.x + ((p2.x - p0.x) / 6) * (t * 2), y: p1.y + ((p2.y - p0.y) / 6) * (t * 2) };
    const c2 = { x: p2.x - ((p3.x - p1.x) / 6) * (t * 2), y: p2.y - ((p3.y - p1.y) / 6) * (t * 2) };
    segs.push([p1, c1, c2, p2]);
  }

  let d = `M${start.x.toFixed(1)} ${start.y.toFixed(1)}`;
  for (const [, c1, c2, p2] of segs) {
    d += ` C${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }

  // lengths by sampling
  const at = (s: [Pt, Pt, Pt, Pt], u: number): Pt => {
    const [a, b, c, e] = s;
    const v = 1 - u;
    return {
      x: v * v * v * a.x + 3 * v * v * u * b.x + 3 * v * u * u * c.x + u * u * u * e.x,
      y: v * v * v * a.y + 3 * v * v * u * b.y + 3 * v * u * u * c.y + u * u * u * e.y,
    };
  };
  let length = 0;
  const nodeLen: number[] = [];
  const ys: number[] = [start.y];
  const lens: number[] = [0];
  segs.forEach((s, si) => {
    let prev = s[0];
    for (let k = 1; k <= 24; k++) {
      const p = at(s, k / 24);
      length += Math.hypot(p.x - prev.x, p.y - prev.y);
      prev = p;
      if (p.y > ys[ys.length - 1]) {
        ys.push(p.y);
        lens.push(length);
      }
    }
    if (si < count) nodeLen.push(length); // end of segment si is node si
  });

  return { width, height: finish.y + 220, nodes, d, length, nodeLen, ys, lens, start, finish };
}

/** Landscape bands: wavy ridgelines down the canvas. */
export interface Band {
  y: number;
  d: string;
  fill: string;
  /** Parallax factor: 0 moves with content, higher lags further behind (feels distant). */
  speed: number;
}

export function layoutBands(width: number, height: number, palette: string[]): Band[] {
  const bands: Band[] = [];
  const gap = 300;
  let i = 0;
  for (let y = 210; y < height; y += gap, i++) {
    const h = gap * 2.4;
    const phase = (i * 1.7) % 3;
    const hill = (x: number) => 26 * Math.sin((x / width) * Math.PI * 1.6 + phase) + 14 * Math.sin((x / width) * Math.PI * 3.3 + phase * 2);
    let d = `M0 ${(hill(0)).toFixed(1)}`;
    const steps = 12;
    for (let k = 1; k <= steps; k++) {
      const x0 = ((k - 1) / steps) * width;
      const x1 = (k / steps) * width;
      const xm = (x0 + x1) / 2;
      d += ` Q${xm.toFixed(1)} ${hill(xm).toFixed(1)} ${x1.toFixed(1)} ${hill(x1).toFixed(1)}`;
    }
    d += ` L${width} ${h} L0 ${h} Z`;
    bands.push({ y, d, fill: palette[i % palette.length], speed: i % 2 === 0 ? 0.08 : 0.02 });
  }
  return bands;
}

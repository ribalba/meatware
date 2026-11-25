import * as THREE from 'three';

/** A rectangle on the floor plan. */
export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Axis aligned box on the floor plan. Used for collisions and line of sight. */
export interface AABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  h: number;
  occludes: boolean;
  disabled?: boolean;
  tag?: string;
}

export function aabb(cx: number, cz: number, w: number, d: number, h: number, occludes = true, tag?: string): AABB {
  return { minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, h, occludes, tag };
}

/** Pushes a circle out of a box. Returns true if it moved. */
export function pushOutCircle(p: { x: number; z: number }, r: number, b: AABB): boolean {
  const cx = Math.max(b.minX, Math.min(p.x, b.maxX));
  const cz = Math.max(b.minZ, Math.min(p.z, b.maxZ));
  const dx = p.x - cx;
  const dz = p.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;
  if (d2 > 1e-8) {
    const d = Math.sqrt(d2);
    p.x = cx + (dx / d) * r;
    p.z = cz + (dz / d) * r;
  } else {
    const left = p.x - b.minX;
    const right = b.maxX - p.x;
    const back = p.z - b.minZ;
    const front = b.maxZ - p.z;
    const m = Math.min(left, right, back, front);
    if (m === left) p.x = b.minX - r;
    else if (m === right) p.x = b.maxX + r;
    else if (m === back) p.z = b.minZ - r;
    else p.z = b.maxZ + r;
  }
  return true;
}

/** 2D segment against box test (slab method). */
export function segmentHitsAABB(x0: number, z0: number, x1: number, z1: number, b: AABB): boolean {
  let tmin = 0;
  let tmax = 1;
  const axes: [number, number, number, number][] = [
    [x0, x1 - x0, b.minX, b.maxX],
    [z0, z1 - z0, b.minZ, b.maxZ],
  ];
  for (const [p, d, mn, mx] of axes) {
    if (Math.abs(d) < 1e-9) {
      if (p < mn || p > mx) return false;
    } else {
      let t1 = (mn - p) / d;
      let t2 = (mx - p) / d;
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return false;
    }
  }
  return true;
}

export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
export function fill(template: string, vars: Record<string, string> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
}

export interface TextTexOpts {
  w?: number;
  h?: number;
  bg?: string;
  fg?: string;
  border?: string;
  font?: string;
}

/** Draws centered lines of text on a canvas. The first line is bigger. */
export function textTexture(lines: string[], o: TextTexOpts = {}): THREE.CanvasTexture {
  const w = o.w ?? 512;
  const h = o.h ?? 256;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  if (o.bg !== 'transparent') {
    g.fillStyle = o.bg ?? '#ffffff';
    g.fillRect(0, 0, w, h);
  }
  if (o.border) {
    const lw = Math.max(4, Math.round(Math.min(w, h) / 24));
    g.strokeStyle = o.border;
    g.lineWidth = lw;
    g.strokeRect(lw, lw, w - lw * 2, h - lw * 2);
  }
  g.fillStyle = o.fg ?? '#111111';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const font = o.font ?? 'Impact, "Arial Black", "Helvetica Neue", sans-serif';
  const n = Math.max(1, lines.length);
  const lineH = h / (n + 0.4);
  lines.forEach((line, i) => {
    let size = Math.floor(lineH * (i === 0 ? 0.8 : 0.55));
    g.font = `bold ${size}px ${font}`;
    while (g.measureText(line).width > w * 0.86 && size > 8) {
      size -= 2;
      g.font = `bold ${size}px ${font}`;
    }
    g.fillText(line, w / 2, lineH * (i + 0.7));
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Speech bubble texture with word wrapping. */
export function bubbleTexture(text: string): THREE.CanvasTexture {
  const w = 512;
  const h = 170;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.font = 'bold 26px "Helvetica Neue", Arial, sans-serif';
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const word of words) {
    const test = cur ? `${cur} ${word}` : word;
    if (g.measureText(test).width > w - 50 && cur) {
      lines.push(cur);
      cur = word;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  const shown = lines.slice(0, 4);
  const boxH = shown.length * 32 + 24;
  const y0 = h - boxH - 8;
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.strokeStyle = '#222';
  g.lineWidth = 4;
  g.beginPath();
  g.roundRect(6, y0, w - 12, boxH, 18);
  g.fill();
  g.stroke();
  g.fillStyle = '#111';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  shown.forEach((l, i) => g.fillText(l, w / 2, y0 + 28 + i * 32));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * A flat irregular blob lying on the floor (y = 0), for puddles and stains.
 * Several overlapping waves on the radius, stretched in one direction.
 */
export function blobGeometry(r: number, segments = 30): THREE.ShapeGeometry {
  const p1 = Math.random() * Math.PI * 2;
  const p2 = Math.random() * Math.PI * 2;
  const p3 = Math.random() * Math.PI * 2;
  const stretch = 1 + Math.random() * 0.6;
  const shape = new THREE.Shape();
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const k = 0.78 + 0.16 * Math.sin(2 * a + p1) + 0.11 * Math.sin(5 * a + p2) + 0.07 * Math.sin(9 * a + p3);
    const x = Math.cos(a) * r * k * stretch;
    const y = Math.sin(a) * r * k;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

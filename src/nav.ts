import * as THREE from 'three';
import type { AABB } from './util';
import type { Rect } from './util';

/**
 * Walkable grid over the store floor with A* pathfinding.
 * Built once from the static colliders, every obstacle grown by the robots' radius.
 */
export class NavGrid {
  readonly cell = 0.5;
  private readonly w: number;
  private readonly h: number;
  private blocked: Uint8Array;

  private bounds: Rect;

  /**
   * @param bounds the room the robots walk in
   * @param noGo areas robots never enter (like the staff toilet)
   */
  constructor(colliders: AABB[], bounds: Rect, noGo: Rect[] = [], inflate = 0.45) {
    this.bounds = bounds;
    const ROOM = bounds;
    this.w = Math.round((ROOM.maxX - ROOM.minX) / this.cell);
    this.h = Math.round((ROOM.maxZ - ROOM.minZ) / this.cell);
    this.blocked = new Uint8Array(this.w * this.h);
    for (let iz = 0; iz < this.h; iz++) {
      for (let ix = 0; ix < this.w; ix++) {
        const x = ROOM.minX + (ix + 0.5) * this.cell;
        const z = ROOM.minZ + (iz + 0.5) * this.cell;
        let b = x < ROOM.minX + inflate || x > ROOM.maxX - inflate || z < ROOM.minZ + inflate || z > ROOM.maxZ - inflate;
        for (const n of noGo) if (x > n.minX - inflate && x < n.maxX + inflate && z > n.minZ - inflate && z < n.maxZ + inflate) b = true;
        if (!b) {
          for (const c of colliders) {
            if (x > c.minX - inflate && x < c.maxX + inflate && z > c.minZ - inflate && z < c.maxZ + inflate) {
              b = true;
              break;
            }
          }
        }
        this.blocked[iz * this.w + ix] = b ? 1 : 0;
      }
    }
  }

  private ix(x: number): number {
    return Math.max(0, Math.min(this.w - 1, Math.floor((x - this.bounds.minX) / this.cell)));
  }
  private iz(z: number): number {
    return Math.max(0, Math.min(this.h - 1, Math.floor((z - this.bounds.minZ) / this.cell)));
  }
  private center(i: number): THREE.Vector3 {
    const ix = i % this.w;
    const iz = Math.floor(i / this.w);
    return new THREE.Vector3(this.bounds.minX + (ix + 0.5) * this.cell, 0, this.bounds.minZ + (iz + 0.5) * this.cell);
  }

  /** Marks a box as blocked, for things placed after the grid was built. */
  block(c: AABB, inflate = 0.45): void {
    for (let iz = 0; iz < this.h; iz++) {
      for (let ix = 0; ix < this.w; ix++) {
        const x = this.bounds.minX + (ix + 0.5) * this.cell;
        const z = this.bounds.minZ + (iz + 0.5) * this.cell;
        if (x > c.minX - inflate && x < c.maxX + inflate && z > c.minZ - inflate && z < c.maxZ + inflate) this.blocked[iz * this.w + ix] = 1;
      }
    }
  }

  isFree(x: number, z: number): boolean {
    return this.blocked[this.iz(z) * this.w + this.ix(x)] === 0;
  }

  /** The nearest walkable cell, searched in growing rings. */
  private nearestFree(x: number, z: number): number {
    const cx = this.ix(x);
    const cz = this.iz(z);
    if (!this.blocked[cz * this.w + cx]) return cz * this.w + cx;
    for (let r = 1; r < 20; r++) {
      let best = -1;
      let bestD = Infinity;
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const ix = cx + dx;
          const iz = cz + dz;
          if (ix < 0 || iz < 0 || ix >= this.w || iz >= this.h) continue;
          const i = iz * this.w + ix;
          if (this.blocked[i]) continue;
          const d = dx * dx + dz * dz;
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
      }
      if (best >= 0) return best;
    }
    return cz * this.w + cx;
  }

  /** A point on the walkable floor close to the given one. */
  snap(p: THREE.Vector3): THREE.Vector3 {
    if (this.isFree(p.x, p.z)) return p.clone();
    return this.center(this.nearestFree(p.x, p.z));
  }

  /** Straight walk possible? Samples the grid along the segment. */
  clear(a: THREE.Vector3, b: THREE.Vector3): boolean {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.ceil(d / (this.cell * 0.4));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      if (!this.isFree(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
    }
    return true;
  }

  /** Waypoints from a to b around all obstacles. The last point is b (or its snapped version). */
  route(a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3[] {
    const goal = this.snap(b);
    if (this.isFree(a.x, a.z) && this.clear(a, goal)) return [goal];
    const start = this.nearestFree(a.x, a.z);
    const end = this.nearestFree(goal.x, goal.z);
    const cells = this.astar(start, end);
    if (!cells) return [goal];
    // String pulling: keep only the corners that are needed.
    const pts = cells.map((i) => this.center(i));
    pts[pts.length - 1] = goal;
    const out: THREE.Vector3[] = [];
    let from = a.clone();
    let i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !this.clear(from, pts[j])) j--;
      out.push(pts[j]);
      from = pts[j];
      i = j + 1;
    }
    return out;
  }

  private astar(start: number, end: number): number[] | null {
    const n = this.w * this.h;
    const g = new Float32Array(n).fill(Infinity);
    const came = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);
    const heap = new MinHeap();
    const ex = end % this.w;
    const ez = Math.floor(end / this.w);
    const hcost = (i: number) => {
      const dx = Math.abs((i % this.w) - ex);
      const dz = Math.abs(Math.floor(i / this.w) - ez);
      return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
    };
    g[start] = 0;
    heap.push(start, hcost(start));
    while (heap.size) {
      const cur = heap.pop();
      if (cur === end) {
        const path: number[] = [];
        for (let c = end; c !== -1; c = came[c]) path.push(c);
        return path.reverse();
      }
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cx = cur % this.w;
      const cz = Math.floor(cur / this.w);
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dz) continue;
          const nx = cx + dx;
          const nz = cz + dz;
          if (nx < 0 || nz < 0 || nx >= this.w || nz >= this.h) continue;
          const ni = nz * this.w + nx;
          if (this.blocked[ni] || closed[ni]) continue;
          // No cutting corners past obstacles.
          if (dx && dz && (this.blocked[cz * this.w + nx] || this.blocked[nz * this.w + cx])) continue;
          const ng = g[cur] + (dx && dz ? 1.414 : 1);
          if (ng < g[ni]) {
            g[ni] = ng;
            came[ni] = cur;
            heap.push(ni, ng + hcost(ni));
          }
        }
      }
    }
    return null;
  }
}

class MinHeap {
  private items: number[] = [];
  private prio: number[] = [];
  get size(): number {
    return this.items.length;
  }
  push(item: number, p: number): void {
    this.items.push(item);
    this.prio.push(p);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.prio[parent] <= this.prio[i]) break;
      this.swap(i, parent);
      i = parent;
    }
  }
  pop(): number {
    const top = this.items[0];
    const lastItem = this.items.pop()!;
    const lastP = this.prio.pop()!;
    if (this.items.length) {
      this.items[0] = lastItem;
      this.prio[0] = lastP;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < this.items.length && this.prio[l] < this.prio[m]) m = l;
        if (r < this.items.length && this.prio[r] < this.prio[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }
  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
    [this.prio[a], this.prio[b]] = [this.prio[b], this.prio[a]];
  }
}

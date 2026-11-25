import * as THREE from 'three';
import { AABB, clamp, pushOutCircle, Rect } from './util';

export class Player {
  pos = new THREE.Vector3(-13.5, 0, -10.5);
  yaw = -2.4;
  pitch = -0.05;
  vel = new THREE.Vector3();
  keys = new Set<string>();
  speed = 0;
  speedMul = 1;
  frozen = false;
  radius = 0.35;
  /** The room the player is in, set by the job. */
  bounds: Rect = { minX: -20, maxX: 20, minZ: -15, maxZ: 15 };
  private bob = 0;
  private camera: THREE.PerspectiveCamera;
  private dom: HTMLElement;

  constructor(camera: THREE.PerspectiveCamera, dom: HTMLElement) {
    this.camera = camera;
    this.dom = dom;
    camera.rotation.order = 'YXZ';
    addEventListener('keydown', (e) => this.keys.add(e.code));
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== this.dom) return;
      this.yaw -= e.movementX * 0.0022;
      this.pitch = clamp(this.pitch - e.movementY * 0.0022, -1.45, 1.45);
    });
  }

  forward(): THREE.Vector3 {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  update(dt: number, colliders: AABB[], circles: { x: number; z: number; r: number }[], wobble: number, t: number): void {
    let mx = 0;
    let mz = 0;
    if (!this.frozen) {
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) mz -= 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) mz += 1;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) mx -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) mx += 1;
    }
    const len = Math.hypot(mx, mz);
    const run = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const base = (run ? 5.2 : 3.2) * this.speedMul;
    let tx = 0;
    let tz = 0;
    if (len > 0) {
      mx /= len;
      mz /= len;
      const s = Math.sin(this.yaw);
      const c = Math.cos(this.yaw);
      tx = (mx * c + mz * s) * base;
      tz = (-mx * s + mz * c) * base;
    }
    const a = Math.min(1, dt * 12);
    this.vel.x += (tx - this.vel.x) * a;
    this.vel.z += (tz - this.vel.z) * a;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;

    for (const b of colliders) if (!b.disabled) pushOutCircle(this.pos, this.radius, b);
    for (const c of circles) {
      const dx = this.pos.x - c.x;
      const dz = this.pos.z - c.z;
      const d = Math.hypot(dx, dz);
      const min = c.r + this.radius;
      if (d < min && d > 1e-4) {
        this.pos.x = c.x + (dx / d) * min;
        this.pos.z = c.z + (dz / d) * min;
      }
    }
    this.pos.x = clamp(this.pos.x, this.bounds.minX + this.radius, this.bounds.maxX - this.radius);
    this.pos.z = clamp(this.pos.z, this.bounds.minZ + this.radius, this.bounds.maxZ - this.radius);

    this.speed = Math.hypot(this.vel.x, this.vel.z);
    this.bob += this.speed * dt * 2.4;
    const bobAmt = Math.min(this.speed / 3, 1) * 0.045;
    this.camera.position.set(this.pos.x, 1.65 + Math.sin(this.bob * 2) * bobAmt + wobble * 0.05 * Math.sin(t * 7), this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw + wobble * 0.05 * Math.sin(t * 3.1), wobble * 0.07 * Math.sin(t * 2.3));
  }
}

import * as THREE from 'three';
import { instantiate } from '../../assets';
import { bubbles } from '../../bubbles';
import { Anim, buildCustomerVisual, CustomerKind, CustomerVisual } from '../../customerModels';
import type { Interact } from '../../level';

/**
 * A robot in the checkout area: a visual, a position, a path to walk and a speech bubble.
 * The job decides what it does. The group's local +z is its front.
 */
export class Bot {
  group = new THREE.Group();
  visual: CustomerVisual;
  pos: THREE.Vector3;
  yaw = 0;
  radius = 0.38;
  name: string;
  kind: CustomerKind;
  path: THREE.Vector3[] = [];
  speed = 1.3;
  /** Lying on the floor (slipped or hit) for this many seconds. */
  stun = 0;
  cart: THREE.Object3D | null = null;
  cartLoad: THREE.Object3D[] = [];
  /** Small patience bar over the head, shown while waiting. */
  private bar: THREE.Group | null = null;
  private barFill: THREE.Mesh | null = null;
  private barMat: THREE.MeshBasicMaterial | null = null;
  private anim: Anim | null = null;
  private targetYaw = 0;
  private actT = 0;

  constructor(scene: THREE.Scene, kind: CustomerKind, name: string, pos: THREE.Vector3, opts: { tint?: string; cart?: boolean; load?: number; interact?: Interact } = {}) {
    this.kind = kind;
    this.name = name;
    this.pos = pos.clone();
    this.visual = buildCustomerVisual(kind, opts.tint ?? '#5dade2');
    if (opts.tint) tintVisual(this.visual.root, opts.tint);
    this.group.add(this.visual.root);
    if (opts.cart) this.addCart(opts.load ?? 0);
    this.group.position.copy(this.pos);
    this.group.userData.interact = opts.interact ?? ({ kind: 'bot', bot: this } satisfies Interact);
    scene.add(this.group);
    this.play('idle');
  }

  get height(): number {
    return this.visual.height;
  }

  private addCart(load: number): void {
    const inst = instantiate('cart');
    const c = new THREE.Group();
    if (inst) c.add(inst.object);
    else {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.5, 0.8), new THREE.MeshStandardMaterial({ color: '#9aa3ab', metalness: 0.6, roughness: 0.4 }));
      m.position.y = 0.7;
      c.add(m);
    }
    c.position.set(0, 0, 0.78);
    this.group.add(c);
    this.cart = c;
    const colors = ['#e67e22', '#2e86c1', '#c0392b', '#f4d03f', '#27ae60', '#8e44ad', '#ecf0f1'];
    for (let i = 0; i < load; i++) {
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(0.14 + Math.random() * 0.1, 0.12 + Math.random() * 0.14, 0.12 + Math.random() * 0.08),
        new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.7 }),
      );
      b.position.set(-0.14 + (i % 3) * 0.14, 0.62 + Math.floor(i / 6) * 0.15, -0.2 + (Math.floor(i / 3) % 2) * 0.3);
      b.rotation.y = Math.random() - 0.5;
      c.add(b);
      this.cartLoad.push(b);
    }
  }

  /** Takes one thing out of the cart (when it goes on the belt). */
  unloadOne(): void {
    const b = this.cartLoad.pop();
    b?.parent?.remove(b);
  }

  play(a: Anim): void {
    if (this.anim === a) return;
    this.anim = a;
    this.visual.play?.(a);
    if (!this.visual.play) this.visual.setFace(a === 'dead' ? 'dead' : 'normal');
  }

  say(text: string, seconds = 3.5): void {
    bubbles.say(this.group, this.visual.height + 0.45, text, seconds, this.name);
  }

  walk(points: THREE.Vector3[]): void {
    this.path = points.map((p) => p.clone());
  }

  get moving(): boolean {
    return this.path.length > 0;
  }

  faceTo(x: number, z: number): void {
    this.targetYaw = Math.atan2(x - this.pos.x, z - this.pos.z);
  }

  fall(seconds: number): void {
    this.stun = seconds;
    this.play('dead');
    if (!this.visual.hasDeath) this.visual.root.rotation.x = -Math.PI / 2.2;
  }

  /** A short "doing something" animation (scanning, unloading). */
  act(): void {
    this.actT = 1.2;
    this.anim = null;
    this.play('act');
  }

  setPatience(frac: number | null, camera: THREE.Camera): void {
    if (frac === null) {
      if (this.bar) this.bar.visible = false;
      return;
    }
    if (!this.bar) {
      this.bar = new THREE.Group();
      const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.07), new THREE.MeshBasicMaterial({ color: '#1a120c' }));
      this.bar.add(bg);
      this.barMat = new THREE.MeshBasicMaterial({ color: '#7cc44a' });
      this.barFill = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.04), this.barMat);
      this.barFill.position.z = 0.002;
      this.bar.add(this.barFill);
      this.bar.position.y = this.visual.height + 0.22;
      this.group.add(this.bar);
    }
    this.bar.visible = true;
    const f = Math.max(0.02, Math.min(1, frac));
    this.barFill!.scale.x = f;
    this.barFill!.position.x = -0.23 * (1 - f);
    this.barMat!.color.set(f < 0.3 ? '#e8604a' : f < 0.6 ? '#f0c23c' : '#7cc44a');
    this.bar.quaternion.copy(camera.quaternion);
    // keep the group's own rotation from turning the bar
    const inv = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, this.yaw, 0)).invert();
    this.bar.quaternion.premultiply(inv);
  }

  update(dt: number): void {
    this.visual.update?.(dt);
    if (this.stun > 0) {
      this.stun -= dt;
      if (this.stun <= 0) {
        this.visual.root.rotation.x = 0;
        this.anim = null;
        this.play('idle');
      }
      return;
    }
    if (this.actT > 0) {
      this.actT -= dt;
      if (this.actT <= 0 && !this.path.length) {
        this.anim = null;
        this.play('idle');
      }
    }
    if (this.path.length) {
      const t = this.path[0];
      const dx = t.x - this.pos.x;
      const dz = t.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      const step = this.speed * dt;
      if (d <= step) {
        this.pos.x = t.x;
        this.pos.z = t.z;
        this.path.shift();
        if (!this.path.length) this.play('idle');
      } else {
        this.pos.x += (dx / d) * step;
        this.pos.z += (dz / d) * step;
        this.targetYaw = Math.atan2(dx, dz);
        this.play('walk');
      }
    }
    let dy = this.targetYaw - this.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    this.yaw += dy * Math.min(1, dt * 8);
    this.group.position.x = this.pos.x;
    this.group.position.z = this.pos.z;
    this.group.rotation.y = this.yaw;
  }

  remove(): void {
    this.group.parent?.remove(this.group);
  }
}

/** Gives a robot its own colour by tinting copies of its materials. */
function tintVisual(root: THREE.Object3D, color: string): void {
  const c = new THREE.Color(color);
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const fix = (mat: THREE.Material) => {
      const cl = mat.clone() as THREE.MeshStandardMaterial;
      if (cl.color && !(cl as unknown as THREE.MeshBasicMaterial).isMeshBasicMaterial) cl.color.lerp(c, 0.45);
      return cl;
    };
    m.material = Array.isArray(m.material) ? m.material.map(fix) : fix(m.material);
  });
}

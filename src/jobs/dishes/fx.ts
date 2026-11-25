import * as THREE from 'three';
import type { Sfx } from '../../audio';
import { steamPuffTex } from './textures';

/**
 * Small particle effects for the kitchen: steam clouds, water spray, flying shards and food bits.
 * Everything is pooled, nothing is allocated per frame.
 */

interface Puff {
  sprite: THREE.Sprite;
  vel: THREE.Vector3;
  life: number;
  max: number;
  grow: number;
}

interface Bit {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
  spin: number;
}

export class Fx {
  private scene: THREE.Scene;
  private puffs: Puff[] = [];
  private bits: Bit[] = [];
  private puffMat: THREE.SpriteMaterial;
  private bitGeo = new THREE.BoxGeometry(1, 1, 1);
  private shardGeo = new THREE.TetrahedronGeometry(1, 0);
  private bitMats = new Map<string, THREE.MeshBasicMaterial>();

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.puffMat = new THREE.SpriteMaterial({ map: steamPuffTex(), color: '#e6e2da', transparent: true, depthWrite: false, opacity: 0.4 });
  }

  /** A cloud of steam at a point. */
  steam(p: THREE.Vector3, n: number, spread = 0.3, up = 0.8, size = 0.5): void {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(this.puffMat.clone());
      s.position.set(p.x + (Math.random() - 0.5) * spread, p.y + Math.random() * 0.2, p.z + (Math.random() - 0.5) * spread);
      const sc = size * (0.6 + Math.random() * 0.6);
      s.scale.set(sc, sc, sc);
      this.scene.add(s);
      const max = 1.4 + Math.random() * 1.2;
      this.puffs.push({ sprite: s, vel: new THREE.Vector3((Math.random() - 0.5) * 0.35, up * (0.6 + Math.random() * 0.6), (Math.random() - 0.5) * 0.35), life: max, max, grow: 0.5 + Math.random() * 0.6 });
    }
    if (this.puffs.length > 140) {
      for (const old of this.puffs.splice(0, this.puffs.length - 140)) this.dropPuff(old);
    }
  }

  private mat(color: string): THREE.MeshBasicMaterial {
    let m = this.bitMats.get(color);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color });
      this.bitMats.set(color, m);
    }
    return m;
  }

  /** Little flying pieces (water drops, shards, food). */
  burst(p: THREE.Vector3, n: number, color: string, speed: number, size: number, shard = false, dir?: THREE.Vector3): void {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(shard ? this.shardGeo : this.bitGeo, this.mat(color));
      const s = size * (0.5 + Math.random());
      m.scale.set(s, shard ? s * 0.4 : s, s);
      m.position.copy(p);
      this.scene.add(m);
      const v = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.2 + 0.3, (Math.random() - 0.5) * 2).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8));
      if (dir) v.add(dir);
      this.bits.push({ mesh: m, vel: v, life: 0.6 + Math.random() * 0.7, spin: (Math.random() - 0.5) * 20 });
    }
    if (this.bits.length > 260) {
      for (const old of this.bits.splice(0, this.bits.length - 260)) this.scene.remove(old.mesh);
    }
  }

  private dropPuff(p: Puff): void {
    this.scene.remove(p.sprite);
    p.sprite.material.dispose();
  }

  update(dt: number): void {
    this.puffs = this.puffs.filter((p) => {
      p.life -= dt;
      if (p.life <= 0) {
        this.dropPuff(p);
        return false;
      }
      p.sprite.position.addScaledVector(p.vel, dt);
      p.vel.multiplyScalar(1 - dt * 0.6);
      const sc = p.sprite.scale.x + p.grow * dt;
      p.sprite.scale.set(sc, sc, sc);
      p.sprite.material.opacity = 0.38 * Math.min(1, (p.life / p.max) * 1.6) * Math.min(1, (p.max - p.life) * 5);
      return true;
    });
    this.bits = this.bits.filter((b) => {
      b.life -= dt;
      b.vel.y -= 9.8 * dt;
      b.mesh.position.addScaledVector(b.vel, dt);
      b.mesh.rotation.x += b.spin * dt;
      b.mesh.rotation.z += b.spin * 0.7 * dt;
      if (b.mesh.position.y < 0.01) {
        b.mesh.position.y = 0.01;
        b.vel.set(b.vel.x * 0.3, Math.abs(b.vel.y) * 0.2, b.vel.z * 0.3);
      }
      if (b.life <= 0) {
        this.scene.remove(b.mesh);
        return false;
      }
      return true;
    });
  }
}

/** Kitchen sounds made from the shared synth. */
export const sounds = {
  smash(sfx: Sfx): void {
    sfx.noise(0.35, 0.5, 3200, 0, 1.5, 'highpass');
    sfx.noise(0.12, 0.6, 900, 0, 1);
    [2600, 3300, 2100, 3900].forEach((f, i) => sfx.tone(f, 0.06, 'triangle', 0.05, f * 0.8, 0.04 + i * 0.05));
  },
  clang(sfx: Sfx): void {
    sfx.tone(520, 0.4, 'triangle', 0.12, 480);
    sfx.tone(1310, 0.25, 'sine', 0.06, 1250, 0.01);
  },
  scrape(sfx: Sfx): void {
    sfx.noise(0.25, 0.25, 1400, 0, 2, 'bandpass');
    sfx.tone(180, 0.12, 'sine', 0.2, 80, 0.2);
  },
  spray(sfx: Sfx): void {
    sfx.noise(0.22, 0.08, 4200, 0, 0.6, 'highpass');
  },
  scrub(sfx: Sfx): void {
    sfx.noise(0.09, 0.22, 2400, 0, 3, 'bandpass');
  },
  rumble(sfx: Sfx): void {
    sfx.noise(0.5, 0.12, 160, 0, 1);
  },
  hiss(sfx: Sfx): void {
    sfx.noise(1.4, 0.2, 5000, 0, 0.5, 'highpass');
  },
  rack(sfx: Sfx): void {
    sfx.tone(900, 0.05, 'square', 0.04);
    sfx.tone(1200, 0.05, 'square', 0.03, undefined, 0.05);
  },
  doors(sfx: Sfx): void {
    sfx.noise(0.15, 0.18, 400, 0, 1);
  },
};

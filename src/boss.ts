import * as THREE from 'three';
import { AABB, pick, rand, segmentHitsAABB, textTexture } from './util';
import type { Rect } from './util';

export type BossState = 'patrol' | 'confront' | 'micromanage' | 'overheated' | 'rebooting';

export interface BossHooks {
  say(k: string, force?: boolean): void;
  beep(): void;
}

const CRUISE_Y = 2.8;

export class Boss {
  group = new THREE.Group();
  conePivot = new THREE.Group();
  pos = new THREE.Vector3(-1, CRUISE_Y, 6);
  yaw = 0;
  targetYaw = 0;
  state: BossState = 'patrol';
  target = new THREE.Vector3();
  frustration = 0;
  range = 12;
  halfAngle = 0.75;

  private coneMat: THREE.MeshBasicMaterial;
  private eyeMat: THREE.MeshStandardMaterial;
  private tipMat: THREE.MeshStandardMaterial;
  private props: THREE.Object3D[] = [];
  private wait = 0;
  private stateTimer = 0;
  private microCooldown = 30;
  private beepTimer = 0;
  private saidMid = false;
  private tilt = 0;
  private smoke: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];
  private smokeTimer = 0;
  private smokeGeo = new THREE.SphereGeometry(0.15, 8, 6);
  private waypoints: THREE.Vector3[] = [];
  private scene: THREE.Scene;
  private hooks: BossHooks;

  private booth: Rect | null;
  private doorFront: THREE.Vector3;

  /**
   * @param waypoints where Brad patrols (y is ignored, he flies at cruise height)
   * @param booth the staff toilet, Brad waits outside its door
   */
  constructor(scene: THREE.Scene, hooks: BossHooks, waypoints: THREE.Vector3[] = [], booth: Rect | null = null, doorFront = new THREE.Vector3()) {
    this.booth = booth;
    this.doorFront = doorFront.clone().setY(2.2);
    this.scene = scene;
    this.hooks = hooks;
    const metal = new THREE.MeshStandardMaterial({ color: '#9aa5b1', metalness: 0.6, roughness: 0.35 });
    const dark = new THREE.MeshStandardMaterial({ color: '#222222', roughness: 0.3 });
    const g = this.group;
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 16), metal));
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.2, 0.2), dark);
    visor.position.set(0, 0.05, -0.33);
    g.add(visor);
    this.eyeMat = new THREE.MeshStandardMaterial({ color: '#ff2020', emissive: '#ff2020', emissiveIntensity: 2 });
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), this.eyeMat);
    eye.position.set(0, 0.05, -0.44);
    g.add(eye);

    const tieMat = new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.6 });
    const knot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.05), tieMat);
    knot.position.set(0, -0.34, -0.25);
    g.add(knot);
    const tie = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.42, 4), tieMat);
    tie.position.set(0, -0.58, -0.25);
    tie.rotation.x = Math.PI;
    g.add(tie);

    for (let i = 0; i < 4; i++) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.5), metal);
      arm.position.set(Math.sin(a) * 0.45, 0.28, Math.cos(a) * 0.45);
      arm.rotation.y = a;
      g.add(arm);
      const prop = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.01, 0.05), dark);
      prop.position.set(Math.sin(a) * 0.7, 0.33, Math.cos(a) * 0.7);
      g.add(prop);
      this.props.push(prop);
    }
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.3), dark);
    antenna.position.y = 0.55;
    g.add(antenna);
    this.tipMat = new THREE.MeshStandardMaterial({ color: '#ff2020', emissive: '#ff2020', emissiveIntensity: 1.5 });
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), this.tipMat);
    tip.position.y = 0.72;
    g.add(tip);
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: textTexture(['BRAD', 'SUPERVISOR'], { w: 256, h: 128, bg: '#ffffff', fg: '#c0392b', border: '#c0392b' }) }));
    tag.position.y = 0.98;
    tag.scale.set(0.6, 0.3, 1);
    g.add(tag);
    scene.add(g);

    this.coneMat = new THREE.MeshBasicMaterial({ color: '#ff3b30', transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide });
    const cone = new THREE.Mesh(new THREE.CircleGeometry(this.range, 32, Math.PI / 2 - this.halfAngle, this.halfAngle * 2), this.coneMat);
    cone.rotation.x = -Math.PI / 2;
    this.conePivot.add(cone);
    scene.add(this.conePivot);

    this.waypoints = waypoints.length ? waypoints.map((w) => new THREE.Vector3(w.x, CRUISE_Y, w.z)) : [new THREE.Vector3(0, CRUISE_Y, 0)];
    this.target.copy(pick(this.waypoints));
  }

  get offline(): boolean {
    return this.state === 'overheated' || this.state === 'rebooting';
  }

  micromanage(): void {
    if (this.offline) return;
    this.state = 'micromanage';
    this.stateTimer = 10;
    this.saidMid = false;
    this.hooks.say('micromanage', true);
  }

  confront(): void {
    if (this.offline) return;
    this.state = 'confront';
    this.stateTimer = 4;
  }

  overheat(): void {
    this.state = 'overheated';
    this.stateTimer = 25;
    this.frustration = 100;
    this.hooks.say('overheat', true);
  }

  /** Brad hovers in place, offline, for a while. */
  firmwareUpdate(seconds: number): void {
    this.state = 'rebooting';
    this.stateTimer = seconds;
    this.hooks.say('firmware', true);
  }

  horizontalDist(p: THREE.Vector3): number {
    return Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
  }

  canSee(p: THREE.Vector3, colliders: AABB[]): boolean {
    if (this.offline) return false;
    const dx = p.x - this.pos.x;
    const dz = p.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > this.range) return false;
    if (dist > 2.2) {
      const dot = (-Math.sin(this.yaw) * dx - Math.cos(this.yaw) * dz) / dist;
      if (dot < Math.cos(this.halfAngle)) return false;
    }
    for (const b of colliders) {
      if (!b.occludes || b.disabled) continue;
      if (segmentHitsAABB(this.pos.x, this.pos.z, p.x, p.z, b)) return false;
    }
    return true;
  }

  setSeen(seen: boolean): void {
    this.coneMat.opacity = seen ? 0.24 : 0.1;
    this.coneMat.color.setHSL(Math.min(this.frustration, 100) / 100 * 0.1, 1, 0.55);
  }

  private moveTo(target: THREE.Vector3, speed: number, dt: number, face = true): boolean {
    const dx = target.x - this.pos.x;
    const dy = target.y - this.pos.y;
    const dz = target.z - this.pos.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 0.05) return true;
    const step = Math.min(dist, speed * dt);
    this.pos.x += (dx / dist) * step;
    this.pos.y += (dy / dist) * step;
    this.pos.z += (dz / dist) * step;
    if (face && Math.hypot(dx, dz) > 0.3) this.targetYaw = Math.atan2(-dx, -dz);
    return dist < 0.3;
  }

  update(dt: number, t: number, playerPos: THREE.Vector3, playerFwd: THREE.Vector3): void {
    switch (this.state) {
      case 'patrol': {
        if (this.wait > 0) {
          this.wait -= dt;
          this.targetYaw += dt * 1.2;
        } else if (this.moveTo(this.target, 2.4, dt)) {
          this.wait = rand(1.5, 3.5);
          this.target.copy(pick(this.waypoints));
          if (Math.random() < 0.3) this.hooks.say('patrol');
        }
        this.microCooldown -= dt;
        if (this.microCooldown <= 0) {
          this.microCooldown = rand(35, 60);
          if (Math.random() < 0.6) this.micromanage();
        }
        break;
      }
      case 'micromanage':
      case 'confront': {
        this.stateTimer -= dt;
        const b = this.booth;
        const inBooth = !!b && playerPos.x > b.minX && playerPos.x < b.maxX && playerPos.z > b.minZ && playerPos.z < b.maxZ;
        const off = this.state === 'micromanage' ? -1.3 : 2.0;
        const tgt = inBooth
          ? this.doorFront.clone()
          : new THREE.Vector3(playerPos.x + playerFwd.x * off, 2.2, playerPos.z + playerFwd.z * off);
        this.moveTo(tgt, 4.5, dt, false);
        this.targetYaw = Math.atan2(-(playerPos.x - this.pos.x), -(playerPos.z - this.pos.z));
        if (this.state === 'micromanage') {
          this.beepTimer -= dt;
          if (this.beepTimer <= 0) {
            this.beepTimer = 1.4;
            this.hooks.beep();
          }
          if (!this.saidMid && this.stateTimer < 5) {
            this.saidMid = true;
            this.hooks.say('micromanage', true);
          }
        }
        if (this.stateTimer <= 0) {
          this.state = 'patrol';
          this.target.copy(pick(this.waypoints));
        }
        break;
      }
      case 'overheated': {
        this.stateTimer -= dt;
        this.pos.y += (0.45 - this.pos.y) * Math.min(1, dt * 3);
        this.smokeTimer -= dt;
        if (this.smokeTimer <= 0) {
          this.smokeTimer = 0.1;
          this.spawnSmoke();
        }
        if (this.stateTimer <= 0) {
          this.state = 'rebooting';
          this.stateTimer = 4;
          this.hooks.say('reboot', true);
        }
        break;
      }
      case 'rebooting': {
        this.stateTimer -= dt;
        this.pos.y += (CRUISE_Y - this.pos.y) * Math.min(1, dt * 1.5);
        if (this.stateTimer <= 0) {
          this.state = 'patrol';
          this.frustration = 0;
          this.target.copy(pick(this.waypoints));
        }
        break;
      }
    }

    this.animate(dt, t);
  }

  /** Turning, hovering, propellers and lights. No decisions. Also used by the intro. */
  animate(dt: number, t: number): void {
    let d = this.targetYaw - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * 4);

    const down = this.state === 'overheated';
    const bob = down ? 0 : Math.sin(t * 2.2) * 0.08;
    this.group.position.set(this.pos.x, this.pos.y + bob, this.pos.z);
    this.tilt += ((down ? 0.6 : 0) - this.tilt) * Math.min(1, dt * 3);
    this.group.rotation.set(0, this.yaw, this.tilt);
    if (!down) for (const p of this.props) p.rotation.y += dt * 40;
    this.eyeMat.emissiveIntensity = down ? 0.05 : this.state === 'rebooting' ? (Math.sin(t * 25) > 0 ? 2 : 0.05) : 2;
    this.tipMat.emissiveIntensity = Math.sin(t * 6) > 0 ? 1.5 : 0.2;
    this.conePivot.position.set(this.pos.x, 0.03, this.pos.z);
    this.conePivot.rotation.y = this.yaw;
    this.conePivot.visible = !this.offline;
    this.updateSmoke(dt);
  }

  private spawnSmoke(): void {
    if (this.smoke.length > 60) return;
    const m = new THREE.Mesh(this.smokeGeo, new THREE.MeshBasicMaterial({ color: '#555555', transparent: true, opacity: 0.6, depthWrite: false }));
    m.position.set(this.pos.x + rand(-0.2, 0.2), this.pos.y + 0.3, this.pos.z + rand(-0.2, 0.2));
    this.scene.add(m);
    this.smoke.push({ mesh: m, vel: new THREE.Vector3(rand(-0.2, 0.2), rand(0.8, 1.4), rand(-0.2, 0.2)), life: 2.5 });
  }

  private updateSmoke(dt: number): void {
    this.smoke = this.smoke.filter((s) => {
      s.life -= dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      s.mesh.scale.multiplyScalar(1 + dt * 0.8);
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, s.life / 2.5) * 0.6;
      if (s.life <= 0) {
        this.scene.remove(s.mesh);
        (s.mesh.material as THREE.Material).dispose();
        return false;
      }
      return true;
    });
  }
}

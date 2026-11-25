import * as THREE from 'three';
import { bubbles } from '../../bubbles';
import { buildCustomerVisual, CustomerVisual } from '../../customerModels';
import { pick, rand } from '../../util';
import { islandX } from './layout';
import { PAINTER } from './texts';

/**
 * Line-Painter 6: a robot maintenance worker who repaints a lane line, very slowly.
 * He paints a fresh line behind him, takes union breaks, and paints wobbly lines
 * for a while after somebody hits him.
 */

type State = 'paint' | 'walkBack' | 'break' | 'fallen';

const Z_START = -22;
const Z_END = -9.8;
const SEG = 0.25;

const segGeo = new THREE.PlaneGeometry(0.17, SEG + 0.02);
segGeo.rotateX(-Math.PI / 2);
const wetPaint = new THREE.MeshBasicMaterial({ color: '#f4f1e6', polygonOffset: true, polygonOffsetFactor: -3 });

export class Painter {
  group = new THREE.Group();
  visual: CustomerVisual;
  state: State = 'paint';
  x: number;
  z = Z_START + 3.5;
  radius = 0.45;
  name = PAINTER.name;
  private lineIdx = 4;
  private timer = rand(18, 30);
  private talkT = rand(6, 12);
  private wobble = 0;
  private painted = 0;
  private segs: THREE.Mesh[] = [];
  private cart = new THREE.Group();
  private scene: THREE.Scene;
  private fallT = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.x = islandX(this.lineIdx);
    this.visual = buildCustomerVisual('shopper', '#e07b16');
    this.group.add(this.visual.root);
    // hard hat and safety vest
    const hat = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#f1c40f', roughness: 0.5 }));
    hat.position.y = this.visual.height + 0.02;
    hat.scale.set(1.1, 0.7, 1.1);
    this.group.add(hat);
    const vest = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.3, 0.42, 8, 1, true), new THREE.MeshStandardMaterial({ color: '#ff7a1a', emissive: '#ff5a00', emissiveIntensity: 0.25, side: THREE.DoubleSide }));
    vest.position.y = this.visual.height * 0.55;
    this.group.add(vest);
    // the line painting cart, pushed in front of him
    const yellow = new THREE.MeshStandardMaterial({ color: '#d6a91c', roughness: 0.6 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.7), yellow);
    body.position.y = 0.35;
    this.cart.add(body);
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.4, 8), new THREE.MeshStandardMaterial({ color: '#f4f1e6' }));
    tank.position.set(0, 0.7, 0.05);
    this.cart.add(tank);
    for (const sx of [-0.27, 0.27]) {
      for (const sz of [-0.25, 0.25]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 8), new THREE.MeshStandardMaterial({ color: '#222222' }));
        w.rotation.z = Math.PI / 2;
        w.position.set(sx, 0.1, sz);
        this.cart.add(w);
      }
    }
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.04), new THREE.MeshStandardMaterial({ color: '#333333' }));
    handle.position.set(0, 0.95, -0.45);
    this.cart.add(handle);
    this.cart.position.set(0, 0, 0.75);
    this.group.add(this.cart);
    // a cone behind him, which he carries along. It does not help.
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.55, 8), new THREE.MeshStandardMaterial({ color: '#ff6a1a' }));
    cone.position.set(0, 0.28, -0.9);
    this.group.add(cone);
    this.group.userData.interact = { kind: 'painter' };
    this.group.position.set(this.x, 0, this.z);
    scene.add(this.group);
    this.visual.play?.('walk');
  }

  get height(): number {
    return this.visual.height;
  }

  say(text: string, seconds = 3.5): void {
    bubbles.say(this.group, this.visual.height + 0.45, text, seconds, this.name);
  }

  talk(): void {
    if (this.state === 'fallen') {
      this.say('I am horizontal. Please hold.', 2.5);
      return;
    }
    this.say(pick(PAINTER.talk), 4);
  }

  hit(): void {
    this.state = 'fallen';
    this.fallT = 3;
    this.wobble = 1;
    this.visual.play?.('dead');
    if (!this.visual.hasDeath) this.visual.root.rotation.x = -Math.PI / 2;
    this.say(pick(PAINTER.hit), 3);
  }

  update(dt: number): void {
    this.visual.update?.(dt);
    this.talkT -= dt;
    if (this.talkT <= 0 && this.state !== 'fallen') {
      this.talkT = rand(14, 24);
      this.say(pick(this.state === 'break' ? PAINTER.break : PAINTER.idle));
    }
    switch (this.state) {
      case 'paint': {
        this.visual.play?.('walk');
        this.z += dt * 0.16;
        this.painted += dt * 0.16;
        this.wobble = Math.max(0, this.wobble - dt * 0.05);
        const x = this.x + Math.sin(this.z * 2.2) * 0.45 * this.wobble;
        this.group.position.set(x, 0, this.z);
        this.group.rotation.y = Math.cos(this.z * 2.2) * this.wobble * 0.6;
        if (this.painted >= SEG) {
          this.painted = 0;
          this.addSeg(x, this.z + 0.2);
        }
        this.timer -= dt;
        if (this.timer <= 0) {
          this.state = 'break';
          this.timer = rand(7, 11);
          this.visual.play?.('idle');
          this.say(pick(PAINTER.break));
        }
        if (this.z >= Z_END) {
          this.state = 'walkBack';
          this.group.rotation.y = Math.PI;
          this.lineIdx = this.lineIdx === 4 ? 5 : 4;
        }
        break;
      }
      case 'break':
        this.visual.play?.('idle');
        this.timer -= dt;
        if (this.timer <= 0) {
          this.state = 'paint';
          this.timer = rand(20, 32);
        }
        break;
      case 'walkBack': {
        this.visual.play?.('walk');
        const tx = islandX(this.lineIdx);
        const dx = tx - this.group.position.x;
        this.group.position.x += Math.sign(dx) * Math.min(Math.abs(dx), dt * 0.5);
        this.z -= dt * 0.55;
        this.group.position.z = this.z;
        if (this.z <= Z_START) {
          this.x = tx;
          this.group.position.x = tx;
          this.state = 'paint';
          this.group.rotation.y = 0;
          // He repaints from scratch. The old line was not perfect.
          for (const s of this.segs.splice(0, this.segs.length)) this.scene.remove(s);
        }
        break;
      }
      case 'fallen':
        this.fallT -= dt;
        if (this.fallT <= 0) {
          this.state = 'paint';
          this.visual.play?.('walk');
          this.visual.root.rotation.x = 0;
          this.say('Back to work. The line will be wobbly. That is on you.', 3);
        }
        break;
    }
  }

  private addSeg(x: number, z: number): void {
    const m = new THREE.Mesh(segGeo, wetPaint);
    m.position.set(x, 0.02, z - 0.6);
    this.scene.add(m);
    this.segs.push(m);
  }
}

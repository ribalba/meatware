import * as THREE from 'three';
import { tvStatic } from '../../textures';
import { AABB, segmentHitsAABB } from '../../util';
import type { CamDef } from './building';
import { screensaver } from './textures';

/**
 * The CCTV system. Twelve cameras in the plant render the real scene into small render
 * targets, a few per frame in rotation. The monitor screens show them through a CRT shader
 * with night vision gain, scanlines, noise and a label overlay. Monitor 13 shows static,
 * monitor 14 a screensaver.
 */

const W = 160;
const HH = 120;
const PX = '"Press Start 2P", monospace';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const FRAG = /* glsl */ `
uniform sampler2D tFeed; uniform sampler2D tLabel; uniform float time; uniform float seed;
uniform vec3 tint; uniform float gain; uniform float live; uniform float glitch;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 c = vUv - 0.5;
  vec2 uv = 0.5 + c * (1.0 + 0.14 * dot(c, c));
  float line = floor(uv.y * 96.0);
  float jit = (hash(vec2(line, floor(time * 14.0) + seed)) - 0.5) * (0.006 + glitch * 0.08);
  vec3 col = texture2D(tFeed, vec2(uv.x + jit * live, uv.y)).rgb;
  if (live > 0.5) {
    col *= gain;
    col = col / (1.0 + col * 0.45);
    float l = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(l), col, 0.6) * tint;
  }
  col *= 0.86 + 0.14 * sin(uv.y * 120.0 * 3.14159);
  col += (hash(uv * 211.0 + time) - 0.5) * (0.035 + glitch * 0.4) * (0.4 + live * 0.6);
  float bar = fract(uv.y * 0.7 - time * 0.11 + seed);
  col *= 0.88 + 0.12 * smoothstep(0.0, 0.08, bar);
  col *= smoothstep(0.78, 0.32, length(c));
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) col = vec3(0.0);
  vec4 lab = texture2D(tLabel, vUv);
  col = mix(col, lab.rgb, lab.a);
  gl_FragColor = vec4(col, 1.0);
}`;

export interface Feed {
  def: CamDef;
  cam: THREE.PerspectiveCamera;
  rt: THREE.WebGLRenderTarget;
  mat: THREE.ShaderMaterial;
  frustum: THREE.Frustum;
  g: CanvasRenderingContext2D;
  labelTex: THREE.CanvasTexture;
  motion: boolean;
  /** Last frame time it was rendered. */
  rendered: number;
}

function labelCanvas(): { g: CanvasRenderingContext2D; tex: THREE.CanvasTexture } {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = HH;
  const g = c.getContext('2d')!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return { g, tex };
}

export class Cctv {
  feeds: Feed[] = [];
  renderer: THREE.WebGLRenderer | null = null;
  /** Hidden while a feed renders (the monitors themselves, to avoid feedback). */
  hideInFeeds: THREE.Object3D[] = [];
  /** Only visible in feeds (the guard's body). */
  onlyInFeeds: THREE.Object3D[] = [];
  /** Extra glitch on a monitor, 0..1 (set by the job, e.g. after a false report). */
  glitch: number[] = [];
  /** Cameras that were broken (kicked or hit). Their monitor shows static. */
  dead = new Set<number>();
  /** True for a moment when the screensaver logo hits the corner. */
  saverCorner: () => boolean = () => false;
  private screens: THREE.Mesh[];
  private next = 0;
  private scene: THREE.Scene;
  private occluders: AABB[];
  private extra: { mat: THREE.ShaderMaterial; update: (t: number) => void }[] = [];
  private lastLabel = -1;

  constructor(scene: THREE.Scene, defs: CamDef[], screens: THREE.Mesh[], colliders: AABB[]) {
    this.scene = scene;
    this.screens = screens;
    this.occluders = colliders.filter((c) => c.occludes && c.h >= 2.5);
    defs.forEach((def, i) => {
      const cam = new THREE.PerspectiveCamera(def.id === 1 ? 72 : 64, W / HH, 0.1, 34);
      cam.position.copy(def.pos);
      cam.lookAt(def.look);
      cam.updateMatrixWorld(true);
      cam.updateProjectionMatrix();
      const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
      const rt = new THREE.WebGLRenderTarget(W, HH, { magFilter: THREE.NearestFilter, minFilter: THREE.LinearFilter, depthBuffer: true });
      const { g, tex } = labelCanvas();
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          tFeed: { value: rt.texture },
          tLabel: { value: tex },
          time: { value: 0 },
          seed: { value: Math.random() * 10 },
          tint: { value: new THREE.Color(i % 3 === 1 ? '#c8ffd8' : i % 3 === 2 ? '#d8e8ff' : '#e8ffe0') },
          gain: { value: def.id === 1 ? 2.0 : 3.0 },
          live: { value: 1 },
          glitch: { value: 0 },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
      });
      screens[i].material = mat;
      this.feeds.push({ def, cam, rt, mat, frustum, g, labelTex: tex, motion: false, rendered: -1 });
      this.glitch.push(0);
    });
    // Monitor 13: static since 2064. Monitor 14: the screensaver.
    const st = tvStatic();
    const sv = screensaver();
    const staticMat = this.extraMat(st.texture, 'CAM 13', 'NO SIGNAL');
    const saverMat = this.extraMat(sv.texture, 'CAM 14', '');
    screens[12].material = staticMat;
    screens[13].material = saverMat;
    let tick = 0;
    this.extra.push({ mat: staticMat, update: () => (++tick % 3 === 0 ? st.update() : undefined) });
    this.extra.push({ mat: saverMat, update: (t) => sv.update(t) });
    this.saverCorner = sv.cornerFlash;
    // Grab the renderer the first time the scene is drawn.
    const prev = scene.onBeforeRender;
    scene.onBeforeRender = (...args: Parameters<THREE.Scene['onBeforeRender']>) => {
      this.renderer = args[0] as THREE.WebGLRenderer;
      prev.apply(scene, args);
    };
  }

  private extraMat(tex: THREE.Texture, title: string, sub: string): THREE.ShaderMaterial {
    const { g, tex: lab } = labelCanvas();
    g.clearRect(0, 0, W, HH);
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(2, 2, 52, 12);
    g.fillStyle = '#e8ffe0';
    g.font = `8px ${PX}`;
    g.fillText(title, 5, 12);
    if (sub) {
      g.fillStyle = 'rgba(0,0,0,0.7)';
      g.fillRect(24, 40, 80, 16);
      g.fillStyle = '#ffffff';
      g.fillText(sub, 30, 52);
    }
    lab.needsUpdate = true;
    return new THREE.ShaderMaterial({
      uniforms: {
        tFeed: { value: tex },
        tLabel: { value: lab },
        time: { value: 0 },
        seed: { value: Math.random() * 10 },
        tint: { value: new THREE.Color('#ffffff') },
        gain: { value: 1 },
        live: { value: 0 },
        glitch: { value: 0 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
    });
  }

  /** A camera was broken: its monitor shows static from now on and it sees nothing. */
  kill(i: number): void {
    if (this.dead.has(i) || !this.feeds[i]) return;
    this.dead.add(i);
    const st = tvStatic();
    const mat = this.extraMat(st.texture, `CAM ${String(this.feeds[i].def.id).padStart(2, '0')}`, 'NO SIGNAL');
    this.screens[i].material = mat;
    let tick = 0;
    this.extra.push({ mat, update: () => (++tick % 3 === 0 ? st.update() : undefined) });
  }

  /** Renders `budget` feeds into their targets. Call once per frame before the main render. */
  render(t: number, budget: number): void {
    const r = this.renderer;
    for (const f of this.feeds) f.mat.uniforms.time.value = t;
    this.feeds.forEach((f, i) => {
      this.glitch[i] = Math.max(0, this.glitch[i] - 0.016);
      f.mat.uniforms.glitch.value = this.glitch[i];
    });
    for (const e of this.extra) {
      e.mat.uniforms.time.value = t;
      e.update(t);
    }
    if (!r || budget <= 0) return;
    const prevRT = r.getRenderTarget();
    const hidden = this.hideInFeeds.map((o) => o.visible);
    const shown = this.onlyInFeeds.map((o) => o.visible);
    for (const o of this.hideInFeeds) o.visible = false;
    for (const o of this.onlyInFeeds) o.visible = true;
    for (let k = 0; k < budget && this.dead.size < this.feeds.length; k++) {
      const f = this.feeds[this.next % this.feeds.length];
      this.next++;
      if (this.dead.has(this.feeds.indexOf(f))) {
        k--;
        continue;
      }
      r.setRenderTarget(f.rt);
      r.render(this.scene, f.cam);
      f.rendered = t;
    }
    this.hideInFeeds.forEach((o, i) => (o.visible = hidden[i]));
    this.onlyInFeeds.forEach((o, i) => (o.visible = shown[i]));
    r.setRenderTarget(prevRT);
  }

  /** Redraws the label overlays (camera name, REC, clock, motion). Cheap, twice a second. */
  labels(t: number, clock: string): void {
    const slot = Math.floor(t * 2);
    if (slot === this.lastLabel) return;
    this.lastLabel = slot;
    const blink = slot % 2 === 0;
    for (const f of this.feeds) {
      const g = f.g;
      g.clearRect(0, 0, W, HH);
      g.font = `8px ${PX}`;
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.fillRect(2, 2, 52, 12);
      g.fillStyle = '#f2ffe8';
      g.fillText(`CAM ${String(f.def.id).padStart(2, '0')}`, 5, 12);
      if (blink) {
        g.fillStyle = '#ff3030';
        g.beginPath();
        g.arc(W - 30, 8, 3, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#f2ffe8';
        g.font = `6px ${PX}`;
        g.fillText('REC', W - 24, 11);
      }
      g.font = `6px ${PX}`;
      g.fillStyle = 'rgba(0,0,0,0.55)';
      g.fillRect(2, HH - 12, W - 4, 10);
      g.fillStyle = '#d8f0d0';
      g.fillText(f.def.name, 4, HH - 4);
      g.fillText(clock, W - 34, HH - 4);
      if (f.motion && blink) {
        g.fillStyle = 'rgba(160,0,0,0.75)';
        g.fillRect(W - 50, 18, 46, 11);
        g.fillStyle = '#ffffff';
        g.fillText('MOTION', W - 47, 26);
      }
      f.labelTex.needsUpdate = true;
    }
  }

  /** Does camera i see the point (inside its view and not behind a tall wall)? */
  sees(i: number, p: THREE.Vector3): boolean {
    const f = this.feeds[i];
    if (this.dead.has(i)) return false;
    if (!f.frustum.containsPoint(p)) return false;
    if (p.distanceTo(f.def.pos) > 30) return false;
    for (const b of this.occluders) {
      if (b.disabled) continue;
      if (segmentHitsAABB(f.def.pos.x, f.def.pos.z, p.x, p.z, b)) return false;
    }
    return true;
  }

  /** Indices of all cameras that see the point. */
  whoSees(p: THREE.Vector3): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.feeds.length; i++) if (this.sees(i, p)) out.push(i);
    return out;
  }
}

/** The night guard as the cameras see them. Only drawn into the feeds. */
export class GuardDouble {
  group = new THREE.Group();
  private torso: THREE.Group;
  private head: THREE.Group;
  private beam: THREE.Mesh;
  private legs: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene) {
    const navy = new THREE.MeshStandardMaterial({ color: '#2b3a5c', roughness: 0.8 });
    const shirt = new THREE.MeshStandardMaterial({ color: '#7d8fb0', roughness: 0.8 });
    const skin = new THREE.MeshStandardMaterial({ color: '#d9a27a', roughness: 0.7 });
    const black = new THREE.MeshStandardMaterial({ color: '#141414' });
    for (const s of [-1, 1]) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.85, 0.18), navy);
      l.geometry.translate(0, -0.42, 0);
      l.position.set(s * 0.11, 0.86, 0);
      this.group.add(l);
      this.legs.push(l);
    }
    this.torso = new THREE.Group();
    this.torso.position.y = 0.86;
    this.group.add(this.torso);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.26), shirt);
    body.position.y = 0.33;
    this.torso.add(body);
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.07, 0.28), black);
    belt.position.y = 0.04;
    this.torso.add(belt);
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, 0.02), new THREE.MeshStandardMaterial({ color: '#d4a62a', metalness: 0.8 }));
    badge.position.set(-0.12, 0.5, -0.14);
    this.torso.add(badge);
    for (const s of [-1, 1]) {
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.6, 0.15), shirt);
      a.position.set(s * 0.3, 0.33, 0);
      this.torso.add(a);
    }
    this.head = new THREE.Group();
    this.head.position.y = 0.78;
    this.torso.add(this.head);
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.28, 0.24), skin);
    h.position.y = 0.12;
    this.head.add(h);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.14, 0.1, 10), navy);
    cap.position.y = 0.3;
    this.head.add(cap);
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.12), black);
    visor.position.set(0, 0.26, -0.15);
    this.head.add(visor);
    this.beam = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.2, 10, 1, true), new THREE.MeshBasicMaterial({ color: '#fff2c0', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
    this.beam.geometry.rotateX(Math.PI / 2);
    this.beam.position.set(0.3, 0.3, -1.2);
    this.torso.add(this.beam);
    this.group.visible = false;
    scene.add(this.group);
  }

  update(x: number, z: number, yaw: number, pose: 'stand' | 'walk' | 'sit' | 'sleep', t: number, flashlight: boolean): void {
    this.group.position.set(x, 0, z);
    this.group.rotation.y = yaw;
    const swing = pose === 'walk' ? Math.sin(t * 9) * 0.5 : 0;
    this.legs[0].rotation.x = swing;
    this.legs[1].rotation.x = -swing;
    const sit = pose === 'sit' || pose === 'sleep';
    this.torso.position.y = sit ? 0.5 : 0.86;
    for (const l of this.legs) {
      l.position.y = sit ? 0.5 : 0.86;
      if (sit) l.rotation.x = Math.PI / 2;
    }
    this.head.rotation.x = pose === 'sleep' ? 0.9 : 0;
    this.head.rotation.z = pose === 'sleep' ? 0.3 : 0;
    this.beam.visible = flashlight;
  }
}

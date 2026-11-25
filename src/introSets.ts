import * as THREE from 'three';
import { textTexture } from './util';
import {
  beltTex,
  cardboardTex,
  carpetTex,
  cityNightTex,
  corrugatedTex,
  hazardTex,
  marbleTex,
  metalPlateTex,
  planksTex,
  pressWallTex,
  stoneTex,
  tvStatic,
  velvetTex,
  wallpaperTex,
} from './textures';

/**
 * The backgrounds of the intro. Four sets side by side on one big stage,
 * far enough apart that the fog hides each from the others.
 */
export const SOLO_X = 0;
export const GRID_X = 40;
export const CROWD_X = 80;
export const APT_X = 120;

const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...o });
const glow = (map: THREE.Texture) => new THREE.MeshBasicMaterial({ map });
const pix = (t: THREE.Texture) => {
  t.magFilter = THREE.NearestFilter;
  return t;
};
const sign = (lines: string[], w: number, h: number, bg: string, fg: string, border?: string) =>
  pix(textTexture(lines, { w, h, bg, fg, border, font: '"Press Start 2P", monospace' }));

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export interface Sets {
  tick(dt: number, t: number): void;
  /** The envelope that comes through the apartment door. */
  envelope: THREE.Object3D;
  /** Fires a camera flash in the press audience. */
  flashes: boolean;
}

export function buildSets(scene: THREE.Scene): Sets {
  const r = rng(2071);
  const add = <T extends THREE.Object3D>(o: T, parent: THREE.Object3D = scene): T => {
    parent.add(o);
    return o;
  };
  const box = (w: number, h: number, d: number, m: THREE.Material | THREE.Material[], x: number, y: number, z: number, parent: THREE.Object3D = scene) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(x, y, z);
    return add(b, parent);
  };
  const cyl = (rt: number, rb: number, h: number, m: THREE.Material, x: number, y: number, z: number, seg = 10) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
    c.position.set(x, y, z);
    return add(c);
  };
  const plane = (w: number, h: number, m: THREE.Material, x: number, y: number, z: number, rotY = 0) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
    p.position.set(x, y, z);
    p.rotation.y = rotY;
    return add(p);
  };
  const floor = (w: number, d: number, m: THREE.Material, x: number, z: number) => {
    const f = new THREE.Mesh(new THREE.PlaneGeometry(w, d, Math.ceil(w), Math.ceil(d)), m);
    f.rotation.x = -Math.PI / 2;
    f.position.set(x, 0.01, z);
    return add(f);
  };
  const lamp = (color: string, intensity: number, x: number, y: number, z: number, dist = 12) => {
    const l = new THREE.PointLight(color, intensity, dist, 1.6);
    l.position.set(x, y, z);
    return add(l);
  };
  const ticks: ((dt: number, t: number) => void)[] = [];
  const result: Sets = { tick: (dt, t) => ticks.forEach((f) => f(dt, t)), envelope: new THREE.Group(), flashes: false };

  // ================================================================ 1. Press conference, 2051
  {
    const X = SOLO_X;
    floor(11, 7, std({ map: carpetTex([6, 4]) }), X, 0.2);
    box(10, 5.2, 0.2, std({ map: pressWallTex([5, 2.5]) }), X, 2.6, -2.6);
    box(8, 0.9, 0.08, std({ map: sign(['WELCOME TO THE WORKFORCE', 'UNIT 001'], 512, 64, '#b3160c', '#f2d31b', '#f2d31b') }), X, 3.35, -2.45);
    const velvet = std({ map: velvetTex([3, 1]) });
    for (const s of [-1, 1]) box(1.8, 5.4, 0.35, velvet, X + s * 4.6, 2.7, -2.2);
    // Podium with microphones
    const wood = std({ map: planksTex([1, 2]) });
    box(0.75, 1.1, 0.5, wood, X - 1.7, 0.55, 0.6);
    box(0.55, 0.3, 0.02, std({ map: sign(['ROBO', 'CORP'], 64, 32, '#1c2a4a', '#e0b21b') }), X - 1.7, 0.8, 0.86);
    const micMat = std({ color: '#222222', metalness: 0.6 });
    for (const dx of [-0.12, 0.1]) {
      const stem = cyl(0.012, 0.012, 0.45, micMat, X - 1.7 + dx, 1.3, 0.55);
      stem.rotation.z = dx * 3;
      cyl(0.04, 0.03, 0.08, micMat, X - 1.7 + dx * 1.6, 1.52, 0.55);
    }
    // Bunting across the top
    const flagColors = ['#e74c3c', '#f1c40f', '#2e86c1', '#27ae60'];
    for (let i = 0; i < 18; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.3, 3), std({ color: flagColors[i % 4] }));
      f.rotation.x = Math.PI;
      f.position.set(X - 4.2 + i * 0.5, 4.05 - Math.sin((i / 17) * Math.PI) * 0.35, -1.6);
      add(f);
    }
    // Lighting truss
    const truss = std({ color: '#3a3a3a', metalness: 0.5 });
    box(9, 0.18, 0.18, truss, X, 4.6, -0.5);
    for (let i = -3; i <= 3; i += 2) {
      const can = cyl(0.12, 0.16, 0.3, truss, X + i, 4.35, -0.5);
      can.rotation.x = 0.6;
    }
    // Cheering audience in the foreground (just silhouettes)
    const people: THREE.Object3D[] = [];
    const dark = std({ color: '#141210' });
    // Spectators only on the sides, so nobody blocks the view of the robot.
    const seats: [number, number, boolean][] = [
      [-3.3, 1.9, false], [-2.5, 1.4, false], [-1.7, 2.1, true], [-2.9, 2.6, false],
      [1.7, 2.0, false], [2.5, 1.4, true], [3.3, 1.9, false], [2.9, 2.6, false],
    ];
    seats.forEach(([sx, sz, filming]) => {
      const p = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.35, 3, 8), dark);
      body.position.y = 0.55;
      p.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), dark);
      head.position.y = 1.0;
      p.add(head);
      if (filming) {
        // someone filming with a phone
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.45, 0.05), dark);
        arm.position.set(0.18, 1.05, 0);
        arm.rotation.z = -0.3;
        p.add(arm);
        const phone = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.13, 0.02), glow(sign(['REC'], 32, 32, '#111111', '#ff3030')));
        phone.position.set(0.25, 1.3, -0.02);
        p.add(phone);
      }
      p.position.set(X + sx, 0, sz);
      people.push(add(p));
    });
    const flash = lamp('#ffffff', 0, X, 1.4, 2.0, 7);
    let nextFlash = 0.5;
    ticks.push((dt, t) => {
      people.forEach((p, i) => (p.position.y = Math.max(0, Math.sin(t * 7 + i * 1.7)) * 0.08));
      nextFlash -= dt;
      flash.intensity *= Math.pow(0.0005, dt);
      if (result.flashes && nextFlash <= 0) {
        nextFlash = 0.4 + Math.random() * 0.8;
        flash.position.set(X - 3 + Math.random() * 6, 1.3, 2.2 + Math.random() * 0.6);
        flash.intensity = 18;
      }
    });
    lamp('#ffe7b0', 14, X - 3, 3.5, 0.5);
    lamp('#ffe7b0', 14, X + 3, 3.5, 0.5);
  }

  // ================================================================ 2. Robot factory, 2071
  {
    const X = GRID_X;
    floor(26, 24, std({ map: metalPlateTex([13, 12]), metalness: 0.3 }), X, -3);
    // Back wall with the big productivity board
    box(28, 8, 0.3, std({ map: corrugatedTex([10, 3]) }), X, 4, -12);
    const board = box(9, 2.4, 0.1, glow(sign(['PRODUCTIVITY 100.000%', 'MISTAKES TODAY: 0', 'DAYS WITHOUT INCIDENT: 7304'], 512, 136, '#050a05', '#4cff6a')), X, 4.6, -11.8);
    void board;
    box(9.3, 2.7, 0.08, std({ color: '#1a1a1a' }), X, 4.6, -11.86);
    // Steel columns with warning bands and signs
    const steel = std({ color: '#5b6066', metalness: 0.4 });
    const hazard = std({ map: hazardTex([2, 1]) });
    for (const x of [X - 12, X + 12]) {
      for (let z = 4; z >= -10; z -= 4.5) {
        box(0.5, 8, 0.5, steel, x, 4, z);
        box(0.54, 0.7, 0.54, hazard, x, 0.35, z);
      }
    }
    box(0.04, 0.6, 0.9, std({ map: sign(['ROBOTS ONLY'], 128, 64, '#f2d31b', '#111111', '#111111') }), X - 11.73, 2, -0.5);
    box(0.04, 0.6, 1.2, std({ map: sign(['NO HUMANS', 'BEYOND THIS POINT'], 160, 80, '#b3160c', '#ffffff') }), X + 11.73, 2, -5);
    // Ceiling beams and hanging lamps
    for (let z = 3; z >= -10; z -= 3.25) box(26, 0.3, 0.25, steel, X, 7, z);
    const shade = std({ color: '#2f3a2f', side: THREE.DoubleSide });
    for (const [lx, lz] of [[-6, 1], [0, -2], [6, 1], [-6, -6], [6, -6]] as [number, number][]) {
      cyl(0.01, 0.01, 2.2, steel, X + lx, 5.9, lz);
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.35, 10, 1, true), shade);
      c.position.set(X + lx, 4.75, lz);
      add(c);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 4), new THREE.MeshBasicMaterial({ color: '#fff3c9' }));
      bulb.position.set(X + lx, 4.6, lz);
      add(bulb);
      lamp('#ffeec4', 16, X + lx, 4.4, lz, 11);
    }
    // Conveyor belts in front of every row of robots, with boxes riding along
    const frame = std({ color: '#3a3d41', metalness: 0.5 });
    const belts: THREE.Texture[] = [];
    const riders: { m: THREE.Mesh; speed: number }[] = [];
    for (let row = 0; row < 6; row++) {
      const z = -row * 1.7 + 0.62;
      box(14.4, 0.55, 0.5, frame, X, 0.3, z);
      const bt = beltTex();
      belts.push(bt);
      const top = new THREE.Mesh(new THREE.PlaneGeometry(14.4, 0.42), std({ map: bt }));
      top.rotation.x = -Math.PI / 2;
      top.position.set(X, 0.58, z);
      add(top);
      for (let i = 0; i < 5; i++) {
        const v = Math.floor(r() * 7);
        const m = box(0.3, 0.22, 0.28, [std({ map: cardboardTex(v) }), std({ map: cardboardTex(v) }), std({ map: cardboardTex(v + 1) }), std({ map: cardboardTex(v + 1) }), std({ map: cardboardTex(v) }), std({ map: cardboardTex(v) })], X - 7 + i * 3 + r() * 1.5, 0.7, z);
        riders.push({ m, speed: 0.9 });
      }
    }
    // Industrial arms over some belts
    const yellow = std({ color: '#d9a400' });
    const arms: THREE.Object3D[] = [];
    for (const [ax, row] of [[X - 4.9, 0], [X + 4.9, 0], [X - 2.1, 2], [X + 2.1, 3]] as [number, number][]) {
      const az = -row * 1.7 + 1.05;
      const g = new THREE.Group();
      g.position.set(ax, 0, az);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.6, 8), yellow);
      base.position.y = 0.3;
      g.add(base);
      const pivot = new THREE.Group();
      pivot.position.y = 0.6;
      const seg = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.8, 0.12), yellow);
      seg.position.y = 0.4;
      pivot.add(seg);
      const elbow = new THREE.Group();
      elbow.position.y = 0.8;
      const seg2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.6, 0.1), yellow);
      seg2.position.y = 0.3;
      elbow.add(seg2);
      const claw = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.08, 0.08), frame);
      claw.position.y = 0.62;
      elbow.add(claw);
      pivot.add(elbow);
      g.add(pivot);
      add(g);
      arms.push(pivot);
    }
    ticks.push((dt, t) => {
      for (const b of belts) b.offset.x -= dt * 0.9;
      for (const rd of riders) {
        rd.m.position.x += rd.speed * dt;
        if (rd.m.position.x > X + 7) rd.m.position.x -= 14;
      }
      arms.forEach((a, i) => {
        a.rotation.z = Math.sin(t * 1.3 + i) * 0.5;
        (a.children[1] as THREE.Object3D).rotation.z = Math.sin(t * 1.7 + i * 2) * 0.8 - 0.6;
      });
    });
  }

  // ================================================================ 3. Lobby of the Human Labour Heritage Center
  {
    const X = CROWD_X;
    floor(22, 26, std({ map: marbleTex([11, 13]), roughness: 0.35 }), X, 2);
    const stone = std({ map: stoneTex([8, 4]) });
    box(24, 8, 0.4, stone, X, 4, -6.2);
    // Banner and logo
    box(10, 1.3, 0.1, std({ map: sign(['HUMAN LABOUR HERITAGE CENTER'], 512, 64, '#5a0f12', '#e0b21b', '#e0b21b') }), X, 5.6, -5.95);
    box(5, 0.45, 0.06, std({ map: sign(['EST. 2071 · SEE A REAL HUMAN WORK'], 512, 48, '#1d1a16', '#e9e4d4') }), X, 4.7, -5.95);
    // Two big screens with the live feed
    const onAir = glow(sign(['LIVE NOW', 'HUMAN #4471', 'ON AIR'], 256, 160, '#0b0b14', '#ff4040', '#ff4040'));
    const viewersCanvas = document.createElement('canvas');
    viewersCanvas.width = 256;
    viewersCanvas.height = 96;
    const vctx = viewersCanvas.getContext('2d')!;
    const viewersTex = pix(new THREE.CanvasTexture(viewersCanvas));
    viewersTex.colorSpace = THREE.SRGBColorSpace;
    const drawViewers = (n: number) => {
      vctx.fillStyle = '#05070f';
      vctx.fillRect(0, 0, 256, 96);
      vctx.fillStyle = '#7fd1ff';
      vctx.font = '14px "Press Start 2P", monospace';
      vctx.fillText('WATCHING', 16, 34);
      vctx.fillStyle = '#ffffff';
      vctx.font = '20px "Press Start 2P", monospace';
      vctx.fillText(Math.floor(n).toLocaleString('en-US'), 16, 72);
      viewersTex.needsUpdate = true;
    };
    drawViewers(2301442);
    for (const s of [-1, 1]) {
      box(3.4, 2.2, 0.15, std({ color: '#151515' }), X + s * 6.3, 3.2, -5.9);
      plane(3.1, 1.9, s < 0 ? onAir : new THREE.MeshBasicMaterial({ map: viewersTex }), X + s * 6.3, 3.2, -5.8);
    }
    // Columns
    const marble = std({ map: stoneTex([2, 6]), roughness: 0.5 });
    for (const cx of [-4.2, 4.2]) {
      for (const cz of [-3.8, 3.2]) {
        cyl(0.45, 0.5, 7, marble, X + cx, 3.5, cz, 12);
        box(1.2, 0.3, 1.2, marble, X + cx, 0.15, cz);
        box(1.2, 0.3, 1.2, marble, X + cx, 6.9, cz);
      }
    }
    // Velvet rope path from the entrance to the middle
    const gold = std({ color: '#c9a227', metalness: 0.7, roughness: 0.4 });
    const rope = std({ color: '#8e1220' });
    for (const sx of [-1.4, 1.4]) {
      let prev: THREE.Vector3 | null = null;
      for (let z = 10.5; z >= 3.5; z -= 1.75) {
        cyl(0.04, 0.06, 0.95, gold, X + sx, 0.47, z, 8);
        cyl(0.14, 0.16, 0.05, gold, X + sx, 0.03, z, 10);
        const top = new THREE.Vector3(X + sx, 0.9, z);
        if (prev) {
          const mid = prev.clone().add(top).multiplyScalar(0.5);
          const len = prev.distanceTo(top);
          const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, len, 5), rope);
          seg.position.set(mid.x, mid.y - 0.12, mid.z);
          seg.rotation.x = Math.PI / 2;
          add(seg);
        }
        prev = top;
      }
    }
    // Exhibits in glass cases
    const glass = new THREE.MeshBasicMaterial({ color: '#bfe3ff', transparent: true, opacity: 0.18, depthWrite: false });
    const exhibits: [number, number, string[], string][] = [
      [-7.5, 6, ['EXHIBIT 12', 'A STAPLER', 'human tool, use unknown'], '#7a7a7a'],
      [7.5, 6, ['EXHIBIT 31', 'COFFEE MUG', '"worlds okayest employee"'], '#e9e4d4'],
      [-7.5, 1, ['EXHIBIT 7', 'A TIE', 'worn to look important'], '#b3160c'],
      [7.5, 1, ['EXHIBIT 2', 'A PAYSLIP', 'mostly deductions'], '#f2f0e6'],
    ];
    for (const [ex, ez, lines, color] of exhibits) {
      box(0.8, 1.0, 0.8, stone, X + ex, 0.5, ez);
      box(0.25, 0.2, 0.18, std({ color }), X + ex, 1.1, ez);
      box(0.78, 0.7, 0.78, glass, X + ex, 1.36, ez);
      const plaque = plane(0.7, 0.35, std({ map: sign(lines, 192, 96, '#2a2017', '#e0b21b') }), X + ex + (ex < 0 ? 0.41 : -0.41), 0.7, ez, ex < 0 ? Math.PI / 2 : -Math.PI / 2);
      void plaque;
    }
    // Hanging banners
    const banners: [number, string[]][] = [
      [-8.5, ['NO FLASH', 'PHOTOGRAPHY', 'humans scare easily']],
      [8.5, ['DO NOT', 'FEED THE', 'HUMAN']],
    ];
    for (const [bx, lines] of banners) {
      plane(1.4, 2.4, std({ map: sign(lines, 128, 220, '#1c2a4a', '#e9e4d4', '#e0b21b'), side: THREE.DoubleSide }), X + bx, 4.6, -2, 0);
      cyl(0.01, 0.01, 1.2, gold, X + bx - 0.6, 6.4, -2);
      cyl(0.01, 0.01, 1.2, gold, X + bx + 0.6, 6.4, -2);
    }
    // Turnstiles at the entrance
    const chrome = std({ color: '#9aa1a8', metalness: 0.8, roughness: 0.3 });
    for (const sx of [-0.9, 0.9]) box(0.35, 1.0, 0.9, chrome, X + sx * 1.8, 0.5, 11.8);
    lamp('#ffd9a8', 20, X - 4, 5.5, 0);
    lamp('#ffd9a8', 20, X + 4, 5.5, 0);
    lamp('#ffd9a8', 18, X, 4.5, 7);
    lamp('#ffe2b8', 22, X, 3.2, 1.5, 10);
    let viewers = 2301442;
    let acc = 0;
    ticks.push((dt) => {
      acc += dt;
      if (acc > 0.25) {
        acc = 0;
        viewers += 300 + Math.random() * 4000;
        drawViewers(viewers);
      }
    });
  }

  // ================================================================ 4. The tiny apartment
  const envelope = result.envelope;
  {
    const X = APT_X;
    floor(4.6, 3.6, std({ map: planksTex([3, 2]) }), X, 0);
    const paper = std({ map: wallpaperTex([3, 2]) });
    box(4.6, 2.6, 0.1, paper, X, 1.3, -1.8);
    box(0.1, 2.6, 3.6, paper, X - 2.3, 1.3, 0);
    box(0.1, 2.6, 3.6, paper, X + 2.3, 1.3, 0);
    box(4.6, 0.1, 3.6, std({ color: '#3a3528' }), X, 2.6, 0);
    // Window with the night city and a pink advert glow
    plane(1.4, 1.0, glow(cityNightTex()), X + 0.9, 1.55, -1.74);
    const frameM = std({ color: '#2a2218' });
    box(1.5, 0.08, 0.06, frameM, X + 0.9, 2.06, -1.72);
    box(1.5, 0.08, 0.06, frameM, X + 0.9, 1.04, -1.72);
    box(0.06, 1.1, 0.06, frameM, X + 0.9, 1.55, -1.72);
    lamp('#ff6fb5', 3, X + 0.9, 1.6, -1.2, 4);
    // Bed with a lump that is the human
    const bedWood = std({ color: '#4a3424' });
    box(1.0, 0.35, 2.0, bedWood, X - 1.7, 0.18, -0.7);
    box(0.95, 0.15, 1.95, std({ color: '#c9c2ad' }), X - 1.7, 0.42, -0.7);
    const blanket = box(1.0, 0.12, 1.4, std({ color: '#3d5a6e' }), X - 1.68, 0.54, -0.45);
    blanket.rotation.y = 0.06;
    const lump = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), std({ color: '#3d5a6e' }));
    lump.scale.set(0.9, 0.45, 1.6);
    lump.position.set(X - 1.7, 0.6, -0.35);
    add(lump);
    box(0.5, 0.12, 0.35, std({ color: '#e0dccb' }), X - 1.7, 0.56, -1.45);
    // TV on a crate, showing static
    const crateMats = [0, 0, 1, 1, 0, 0].map((k) => std({ map: cardboardTex(2 + k) }));
    box(0.7, 0.5, 0.5, crateMats, X + 1.5, 0.25, 0.4);
    box(0.6, 0.48, 0.5, std({ color: '#2b2b2b' }), X + 1.5, 0.74, 0.4);
    const tv = tvStatic();
    const screen = plane(0.46, 0.34, new THREE.MeshBasicMaterial({ map: tv.texture }), X + 1.24, 0.76, 0.4, -Math.PI / 2);
    void screen;
    const tvLight = lamp('#9fc4ff', 6, X + 0.9, 0.9, 0.4, 5);
    // Pizza boxes, cans and crumpled paper
    const pizza = std({ map: sign(['PIZZA', 'BOT'], 64, 64, '#e9e0c9', '#b3160c') });
    for (let i = 0; i < 4; i++) {
      const p = box(0.45, 0.05, 0.45, pizza, X + 0.4 + (r() - 0.5) * 0.1, 0.03 + i * 0.05, 1.0 + (r() - 0.5) * 0.1);
      p.rotation.y = r() * 0.6;
    }
    const can = std({ color: '#b3160c', metalness: 0.6 });
    for (let i = 0; i < 5; i++) {
      const c = cyl(0.035, 0.035, 0.12, can, X - 0.6 + r() * 1.4, 0.06, 0.3 + r() * 1.1, 8);
      if (i % 2) c.rotation.z = Math.PI / 2;
    }
    const paperBall = std({ color: '#ece8dc' });
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), paperBall);
      b.position.set(X - 0.8 + r() * 1.8, 0.05, -0.2 + r() * 1.5);
      add(b);
    }
    // Calendar and poster on the walls
    plane(0.5, 0.6, std({ map: sign(['2058', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', 'XXXX'], 96, 128, '#f2f0e6', '#b3160c') }), X - 0.6, 1.6, -1.74);
    plane(0.6, 0.8, std({ map: sign(['HANG', 'IN', 'THERE'], 96, 128, '#2e86c1', '#ffffff') }), X - 2.24, 1.5, 0.3, Math.PI / 2);
    // A dead plant
    cyl(0.12, 0.09, 0.22, std({ color: '#7a3e1f' }), X - 0.4, 0.11, -1.4, 8);
    for (let i = 0; i < 4; i++) {
      const stalk = cyl(0.01, 0.01, 0.35, std({ color: '#5a4a2a' }), X - 0.4, 0.38, -1.4, 4);
      stalk.rotation.z = (i - 1.5) * 0.4;
    }
    // Door with a letter slot on the right wall
    const door = std({ map: planksTex([1, 3]) });
    box(0.06, 2.0, 0.9, door, X + 2.24, 1.0, 0.9);
    box(0.08, 0.04, 0.3, std({ color: '#b08d3a', metalness: 0.7 }), X + 2.2, 1.0, 0.9);
    box(0.08, 0.08, 0.08, std({ color: '#b08d3a', metalness: 0.7 }), X + 2.2, 1.0, 0.55);
    // The envelope that will come through the slot
    const env = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.26), std({ color: '#f2efe4' }));
    envelope.add(env);
    const seal = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.05, 0.05), std({ color: '#b3160c' }));
    seal.position.x = -0.002;
    envelope.add(seal);
    envelope.position.set(X + 2.3, 1.0, 0.9);
    envelope.visible = false;
    add(envelope);
    lamp('#ffcf8a', 2.5, X - 1, 2.2, 0.5, 5);
    let acc = 0;
    ticks.push((dt) => {
      acc += dt;
      if (acc > 0.07) {
        acc = 0;
        tv.update();
        tvLight.intensity = 4 + Math.random() * 4;
      }
    });
  }

  return result;
}

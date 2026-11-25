import * as THREE from 'three';
import { AABB, aabb, blobGeometry, textTexture } from './util';
import { SHELF_ZS } from './world';
import {
  cardboardTex,
  concreteTex,
  ductTex,
  hazardTex,
  rackTex,
  wetFloorTex,
} from './textures';

/**
 * Clutter and atmosphere for the store: lamps, pillars, racking, boxes, ducts,
 * cameras and stains. Pure decoration plus colliders, no game rules.
 */

interface Host {
  scene: THREE.Scene;
  colliders: AABB[];
  interactables: THREE.Object3D[];
}

const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...o });

/** Seeded random so the clutter is the same every game. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const boxMats = new Map<number, THREE.Material[]>();
/** Materials for a cardboard box (7 variants), usable by any job. */
export function boxMaterials(variant: number): THREE.Material[] {
  let m = boxMats.get(variant);
  if (!m) {
    const side = std({ map: cardboardTex(variant) });
    const side2 = std({ map: cardboardTex(variant + 3) });
    const top = std({ map: cardboardTex(variant + 1) });
    m = [side, side, top, top, side2, side2];
    boxMats.set(variant, m);
  }
  return m;
}

export interface Details {
  tick(t: number): void;
  /** The ceiling lamps, for the disco button. */
  lamps: THREE.PointLight[];
  /** Security cameras. The last one hangs low by the toilet. */
  cams: THREE.Group[];
  /** Loose props the job turns into movables (no colliders here). */
  wetSign: THREE.Group;
  bins: THREE.Group[];
  mop: THREE.Group;
  /** Turns the lamps into a disco for a while. */
  disco(seconds: number): void;
}

export function addDetails(h: Host): Details {
  const { scene, colliders } = h;
  const r = rng(4471);
  const add = <T extends THREE.Object3D>(o: T): T => {
    scene.add(o);
    return o;
  };
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], x: number, y: number, z: number) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    return add(m);
  };

  // ------------------------------------------------------------ lamps
  const lamps: THREE.PointLight[] = [];
  const lampSpots: [number, number, string][] = [
    [-11, -6, '#ffe6b8'],
    [-11, 6, '#ffe6b8'],
    [0, -8, '#fff1d6'],
    [0, 8, '#fff1d6'],
    [11, -6, '#ffe6b8'],
    [11, 6, '#ffe6b8'],
    [15, -9, '#cfe8ff'],
    [-16, 11, '#ffd9a0'],
  ];
  for (const [x, z, color] of lampSpots) {
    const l = new THREE.PointLight(color, 22, 15, 1.6);
    l.position.set(x, 4.5, z);
    lamps.push(add(l));
  }
  const flicker = lamps[6];
  flicker.distance = 7;

  // ------------------------------------------------------------ pillars
  const pillarMat = std({ map: concreteTex([1, 6]) });
  const hazardMat = std({ map: hazardTex([2, 1]) });
  for (const [x, z] of [[3.5, -3.2], [3.5, 6.8], [11.5, -3.2], [11.5, 6.8]] as [number, number][]) {
    mesh(new THREE.BoxGeometry(0.7, 5, 0.7), pillarMat, x, 2.5, z);
    mesh(new THREE.BoxGeometry(0.74, 0.6, 0.74), hazardMat, x, 0.3, z);
    colliders.push(aabb(x, z, 0.74, 0.74, 5, true, 'pillar'));
  }

  // ------------------------------------------------------------ boxes
  /** A small pile of cardboard boxes in a footprint, with a collider around it. */
  const pile = (cx: number, cz: number, w: number, d: number, maxLevels: number, seed: number) => {
    const pr = rng(seed);
    const cols = Math.max(1, Math.round(w / 0.62));
    const rows = Math.max(1, Math.round(d / 0.62));
    let top = 0;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const levels = 1 + Math.floor(pr() * maxLevels);
        let y = 0;
        for (let k = 0; k < levels; k++) {
          const bw = 0.45 + pr() * 0.15;
          const bh = 0.32 + pr() * 0.22;
          const bd = 0.45 + pr() * 0.15;
          const b = mesh(
            new THREE.BoxGeometry(bw, bh, bd),
            boxMaterials(Math.floor(pr() * 7)),
            cx - w / 2 + (i + 0.5) * (w / cols) + (pr() - 0.5) * 0.06,
            y + bh / 2,
            cz - d / 2 + (j + 0.5) * (d / rows) + (pr() - 0.5) * 0.06,
          );
          b.rotation.y = (pr() - 0.5) * 0.35;
          y += bh;
        }
        top = Math.max(top, y);
      }
    }
    colliders.push(aabb(cx, cz, w, d, top, true, 'boxes'));
  };
  pile(-19.0, -4.5, 1.4, 3.0, 3, 11);
  pile(-19.0, 9.4, 1.4, 1.8, 3, 12);
  pile(18.6, 13.4, 2.4, 2.0, 3, 13);
  pile(13.4, -14.4, 1.3, 0.9, 2, 14);
  pile(19.0, -6.5, 1.2, 2.4, 3, 15);
  // Little end caps at the corridor end of every shelf
  SHELF_ZS.forEach((z, i) => pile(-1.65, z, 0.5, 0.7, 2, 20 + i));

  // ------------------------------------------------------------ promo islands in the open floor
  const plank = std({ color: '#8a6a43' });
  const promo = (cx: number, cz: number, lines: string[], seed: number) => {
    const pr = rng(seed);
    mesh(new THREE.BoxGeometry(1.5, 0.14, 1.3), plank, cx, 0.07, cz);
    let y = 0.14;
    for (const n of [3, 2, 1]) {
      const size = 0.42;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const b = mesh(
            new THREE.BoxGeometry(size, 0.34, size),
            boxMaterials(Math.floor(pr() * 7)),
            cx + (i - (n - 1) / 2) * (size + 0.02),
            y + 0.17,
            cz + (j - (n - 1) / 2) * (size + 0.02),
          );
          b.rotation.y = (pr() - 0.5) * 0.15;
        }
      }
      y += 0.34;
    }
    const pole = std({ color: '#5a5a5a', metalness: 0.5 });
    mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.4, 6), pole, cx, y + 0.7, cz);
    const signMat = std({ map: textTexture(lines, { w: 128, h: 80, bg: '#f2d31b', fg: '#b3160c', border: '#b3160c' }) });
    (signMat.map as THREE.Texture).magFilter = THREE.NearestFilter;
    const sg = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.62, 0.04), signMat);
    sg.position.set(cx, y + 1.45, cz);
    sg.rotation.y = Math.PI / 4;
    add(sg);
    colliders.push(aabb(cx, cz, 1.5, 1.3, y, true, 'promo'));
  };
  promo(7.5, 1.8, ['BUY 3', 'PAY 4'], 31);
  promo(7.5, -8.2, ['SALE!', 'everything must', 'stay'], 32);
  promo(-15.5, 1.5, ['NEW!', 'same as old'], 33);

  // ------------------------------------------------------------ racking along the back wall
  const rackMat = std({ map: rackTex([1, 4]) });
  const beamMat = std({ map: rackTex([8, 1]) });
  const rx0 = -12.6;
  const rx1 = -1.2;
  const rz = -14.25;
  for (let x = rx0; x <= rx1 + 0.01; x += (rx1 - rx0) / 4) {
    mesh(new THREE.BoxGeometry(0.08, 2.0, 0.08), rackMat, x, 1.0, rz - 0.32);
    mesh(new THREE.BoxGeometry(0.08, 2.0, 0.08), rackMat, x, 1.0, rz + 0.32);
  }
  for (const y of [0.12, 0.78, 1.44]) {
    for (const dz of [-0.32, 0.32]) mesh(new THREE.BoxGeometry(rx1 - rx0, 0.08, 0.06), beamMat, (rx0 + rx1) / 2, y, rz + dz);
    mesh(new THREE.BoxGeometry(rx1 - rx0, 0.02, 0.7), std({ color: '#6b6258' }), (rx0 + rx1) / 2, y + 0.05, rz);
    // boxes on the level
    let x = rx0 + 0.3;
    while (x < rx1 - 0.3) {
      const bw = 0.45 + r() * 0.3;
      const bh = 0.3 + r() * 0.25;
      if (r() > 0.18) {
        const b = mesh(new THREE.BoxGeometry(bw, bh, 0.55), boxMaterials(Math.floor(r() * 7)), x + bw / 2, y + 0.06 + bh / 2, rz);
        b.rotation.y = (r() - 0.5) * 0.12;
      }
      x += bw + 0.08;
    }
  }
  colliders.push(aabb((rx0 + rx1) / 2, rz, rx1 - rx0 + 0.1, 0.8, 2.0, true, 'rack'));

  // ------------------------------------------------------------ ceiling: ducts, pipes, sign chains
  const duct = std({ map: ductTex([20, 1]), metalness: 0.3 });
  for (const z of [-6.5, 6.5]) {
    const d = mesh(new THREE.CylinderGeometry(0.28, 0.28, 40, 10), duct, 0, 4.55, z);
    d.rotation.z = Math.PI / 2;
    for (let x = -18; x <= 18; x += 4) mesh(new THREE.BoxGeometry(0.06, 0.25, 0.7), duct, x, 4.85, z);
  }
  const redPipe = std({ color: '#9e2a1e' });
  const pipe = mesh(new THREE.CylinderGeometry(0.06, 0.06, 40, 6), redPipe, 0, 4.75, -12);
  pipe.rotation.z = Math.PI / 2;
  const pipe2 = mesh(new THREE.CylinderGeometry(0.05, 0.05, 30, 6), std({ color: '#70757b' }), 17, 4.7, 0);
  pipe2.rotation.x = Math.PI / 2;
  const chain = std({ color: '#3a3a3a', metalness: 0.6 });
  for (const z of SHELF_ZS) {
    for (const x of [-7.3, -4.7]) mesh(new THREE.CylinderGeometry(0.012, 0.012, 2.1, 4), chain, x, 3.93, z);
  }

  // ------------------------------------------------------------ security cameras (Brad has friends)
  const camBody = std({ color: '#d8d8d2' });
  const camDark = std({ color: '#1a1a1a' });
  const led = new THREE.MeshStandardMaterial({ color: '#ff2020', emissive: '#ff2020', emissiveIntensity: 2 });
  const cams: [number, number, number, number][] = [
    [-19.6, 4.3, -14.6, Math.PI * 0.25],
    [19.6, 4.3, 14.6, -Math.PI * 0.75],
    [-19.6, 4.3, 14.6, Math.PI * 0.75],
    [19.6, 4.3, -10.6, -Math.PI * 0.35],
    [14.75, 2.35, -10.8, -Math.PI / 2],
  ];
  const leds: THREE.Mesh[] = [];
  const camGroups: THREE.Group[] = [];
  for (const [x, y, z, yaw] of cams) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = yaw;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.06), camDark);
    arm.position.y = 0.12;
    g.add(arm);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.38), camBody);
    body.rotation.x = 0.35;
    g.add(body);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 8), camDark);
    lens.rotation.x = Math.PI / 2 + 0.35;
    lens.position.set(0, -0.07, 0.2);
    g.add(lens);
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), led);
    l.position.set(0.06, 0.06, 0.18);
    g.add(l);
    leds.push(l);
    add(g);
    camGroups.push(g);
  }

  // ------------------------------------------------------------ small props
  // Wet floor sign
  const wet = new THREE.Group();
  wet.position.set(2.3, 0, 11.4);
  wet.rotation.y = 0.6;
  const wetMat = std({ map: wetFloorTex(), side: THREE.DoubleSide });
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.6), wetMat);
    p.position.set(0, 0.29, s * 0.1);
    p.rotation.x = s * 0.33;
    wet.add(p);
  }
  // The job turns it into something you can carry (and put in silly places).
  add(wet);

  // Mop bucket by the toilet (movable, so it has no collider)
  const yellow = std({ color: '#d9a400' });
  const mop = add(new THREE.Group());
  mop.position.set(13.6, 0, -10.5);
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.38, 10), yellow);
  bucket.position.y = 0.19;
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.2, 10), std({ color: '#6d6a3c' }));
  water.position.y = 0.36;
  water.rotation.x = -Math.PI / 2;
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 5), std({ color: '#8a6b45' }));
  stick.position.set(0.1, 0.85, 0.05);
  stick.rotation.z = 0.25;
  mop.add(bucket, water, stick);

  // Trash cans (movable too)
  const binMat = std({ color: '#3f4a3c' });
  const bins: THREE.Group[] = [];
  for (const [x, z] of [[5.6, 14.3], [-13.4, -14.4]] as [number, number][]) {
    const g = add(new THREE.Group());
    g.position.set(x, 0, z);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.22, 0.75, 10), binMat);
    body.position.y = 0.375;
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.05, 10), std({ color: '#2b3329' }));
    lid.position.y = 0.77;
    g.add(body, lid);
    bins.push(g);
  }

  // Fire extinguishers on the walls
  const red = std({ color: '#b3160c' });
  for (const [x, z, yaw] of [[-19.85, -10, 0], [19.85, 3, 0], [-6, 14.85, 0]] as [number, number, number][]) {
    const e = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.45, 8), red, x, 0.75, z);
    e.rotation.y = yaw;
    mesh(new THREE.BoxGeometry(0.06, 0.08, 0.04), camDark, x, 1.02, z);
  }

  // Stains and old spills on the floor
  const stainMat = new THREE.MeshBasicMaterial({ color: '#5a4a32', transparent: true, opacity: 0.22, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  const stainSpots: [number, number, number][] = [[-3, -11.5, 0.6], [6.5, 2.1, 0.45], [1.2, -4.5, 0.35], [-14, 3.5, 0.7], [9, 11.5, 0.5], [-7, 7, 0.3], [16, -2, 0.55], [-17, -9, 0.4], [-1, 5.8, 0.3], [12.8, 9.8, 0.4]];
  for (const [x, z, s] of stainSpots) {
    const m = mesh(blobGeometry(s), stainMat, x, 0.006, z);
    m.rotation.y = r() * Math.PI * 2;
  }

  const baseColors = lamps.map((l) => l.color.clone());
  const baseIntensity = lamps.map((l) => l.intensity);
  let discoUntil = -1;
  let discoStart = 0;
  let lastT = 0;
  return {
    lamps,
    cams: camGroups,
    wetSign: wet,
    bins,
    mop,
    disco(seconds: number) {
      discoStart = lastT;
      discoUntil = lastT + seconds;
    },
    tick(t: number) {
      lastT = t;
      // One fluorescent tube by the toilet is dying: steady most of the time,
      // with a short stutter every few seconds.
      const phase = t % 7.3;
      const stutter = phase > 6.6 && Math.sin(t * 40) > 0.2;
      flicker.intensity = stutter ? 6 : 14;
      const on = Math.sin(t * 3) > 0;
      for (const l of leds) l.visible = on;
      if (discoUntil > 0) {
        if (t > discoUntil || t < discoStart) {
          discoUntil = -1;
          lamps.forEach((l, i) => {
            l.color.copy(baseColors[i]);
            l.intensity = baseIntensity[i];
          });
          flicker.distance = 7;
        } else {
          const beat = Math.floor(t * 4);
          lamps.forEach((l, i) => {
            l.color.setHSL(((beat + i * 3) % 8) / 8, 1, 0.55);
            l.intensity = (beat + i) % 2 ? 40 : 10;
          });
        }
      }
    },
  };
}

import * as THREE from 'three';
import { boxMaterials } from '../../details';
import type { Interact, LevelKit } from '../../level';
import { concreteTex, hazardTex } from '../../textures';
import { aabb, blobGeometry, TextTexOpts, textTexture } from '../../util';
import { BOOTH_X0, BOOTH_Z0, HOPPER, JACK_POS, ROOF_Y, ROOM, rng, SPAWN } from './layout';
import { cautionTex, palletTex, plasticTex, plywoodTex, sheetWallTex, shrinkTex, vendingTex } from './textures';
import { Batch, mergeAll } from './geom';

/**
 * Everything that makes the fulfillment center look lived in: lamps, the overhead conveyors,
 * the TIME OFF TASK boards, banners, floor paint, the break room that is never finished,
 * bulk storage, docks, the vending machine next to the toilet and a lot of clutter.
 */

export interface BoardData {
  tot: number;
  steps: number;
  rate: number;
  robots: number;
  shipped: number;
}

export interface Decor {
  tick(t: number): void;
  board(d: BoardData): void;
  /** The vending machine (interactable). */
  vending: THREE.Object3D;
  /** The motivational posters on the lower walls. */
  posters: THREE.Mesh[];
  /** The wrapped snack machine in the break room and its collider. */
  snack: { group: THREE.Group; collider: ReturnType<typeof aabb> };
  /** The warning traffic light by the forklift chargers. */
  traffic: THREE.Object3D | null;
  /** Speed of the overhead conveyors (0 stops them, 1 is normal). */
  setConveyor(k: number): void;
}

const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...o });
const PX = '"Press Start 2P", monospace';
const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function addDecor(kit: LevelKit): Decor {
  const { scene, colliders, interactables } = kit;
  const r = rng(7713);
  const unit = new THREE.BoxGeometry(1, 1, 1);
  const add = <T extends THREE.Object3D>(o: T, parent: THREE.Object3D = scene): T => {
    parent.add(o);
    return o;
  };
  const box = (w: number, h: number, d: number, m: THREE.Material | THREE.Material[], x: number, y: number, z: number, parent: THREE.Object3D = scene) => {
    const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    o.position.set(x, y, z);
    return add(o, parent);
  };
  const cyl = (rt: number, rb: number, h: number, m: THREE.Material, x: number, y: number, z: number, seg = 10) => {
    const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m);
    o.position.set(x, y, z);
    return add(o);
  };
  const readable = (o: THREE.Object3D, text: string) => {
    o.userData.interact = { kind: 'sign', text } satisfies Interact;
    interactables.push(o);
  };
  const signStyle: TextTexOpts = { bg: '#f2ead2', fg: '#2c3e50', border: '#c0392b', font: PX };
  const steel = std({ color: '#5d6b74', metalness: 0.5, roughness: 0.5 });
  const dark = std({ color: '#2a2724' });
  const yellow = std({ color: '#d9a400' });
  const hazard = std({ map: hazardTex([2, 1]) });
  const tickers: ((t: number, dt: number) => void)[] = [];

  // ================================================================ lights
  const lightSpots: [number, number, number, string, number][] = [
    [0, 6.5, 9, '#ffe2b0', 1.2],
    [-12, 7, 2.4, '#ffe8c0', 1],
    [12, 7, 2.4, '#ffe8c0', 1],
    [-21, 7.2, -4, '#fff0d0', 1],
    [-9, 7.2, -4, '#fff0d0', 1],
    [3, 7.2, -4, '#fff0d0', 1],
    [-15, 7.2, -14.5, '#fff0d0', 1],
    [-3, 7.2, -14.5, '#fff0d0', 1],
    [15, 7, -9, '#ffe8c0', 1],
    [27.5, 2.4, -18, '#cfe8ff', 0.5],
    [-25.5, 2.8, 15.5, '#ffd9a0', 0.55],
    [-13, 6.5, 15, '#ffe2b0', 0.9],
    [18, 6.5, 14, '#ffe2b0', 0.9],
  ];
  const lights: THREE.PointLight[] = [];
  for (const [x, y, z, c, k] of lightSpots) {
    const l = new THREE.PointLight(c, 70 * k, 24 * Math.max(0.6, k), 1.5);
    l.position.set(x, y, z);
    lights.push(add(l));
  }
  const toiletLamp = lights[9];
  const breakLamp = lights[10];

  // high bay lamp fixtures: dark shades with glowing lenses, on cords from the roof
  const shades = new Batch();
  const lenses = new Batch();
  const cords = new Batch();
  const lampAt = (x: number, z: number, y = 7.4) => {
    shades.add(x, y, z);
    lenses.add(x, y - 0.21, z);
    cords.add(x, (y + ROOF_Y) / 2, z, 0.02, ROOF_Y - y, 0.02);
  };
  for (let i = 0; i < 8; i++) for (const z of [-15, -4.5]) lampAt(-25 + 4 * i, z);
  for (const x of [-24, -16, -8, 0, 8, 16, 24]) {
    lampAt(x, 2.4);
    lampAt(x, 9.5, x === 0 ? 6.8 : 7.4);
    lampAt(x, 16);
  }
  for (const x of [11.5, 16.5, 22]) for (const z of [-15, -5]) lampAt(x, z);
  shades.build(scene, new THREE.CylinderGeometry(0.22, 0.55, 0.42, 10, 1, true), std({ color: '#2f4a3a', side: THREE.DoubleSide, metalness: 0.4 }));
  lenses.build(scene, new THREE.CircleGeometry(0.5, 10).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#fff4d6', side: THREE.DoubleSide }));
  cords.build(scene, unit, dark);

  // skylights
  const sky = new THREE.MeshBasicMaterial({ color: '#9fb3bb' });
  for (const x of [-21, -9, 3, 15]) {
    for (const z of [-12, 0, 12]) {
      const p = add(new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), sky));
      p.rotation.x = Math.PI / 2;
      p.position.set(x, ROOF_Y - 0.02, z);
    }
  }

  // ================================================================ floor paint
  const quads: THREE.BufferGeometry[] = [];
  const line = (x0: number, z0: number, x1: number, z1: number, w = 0.1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const p = new THREE.PlaneGeometry(len, w);
    p.rotateX(-Math.PI / 2);
    p.rotateY(-Math.atan2(z1 - z0, x1 - x0));
    p.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    quads.push(p);
  };
  line(-29.6, 0.75, 29.6, 0.75);
  line(-29.6, 4.25, 29.6, 4.25);
  line(-29.6, -8.1, 23, -8.1);
  line(-29.6, -10.5, 23, -10.5);
  // packing area box
  line(-6.3, 7.3, 4, 7.3);
  line(-6.3, 11.6, -2, 11.6);
  line(-6.3, 7.3, -6.3, 11.6);
  // toilet route
  line(21.2, 0.75, 21.2, -19.6);
  line(24.6, 0.75, 24.6, -15.8);
  // spawn and time clock box
  line(-15, 13, -10, 13);
  line(-15, 13, -15, 19.6);
  line(-10, 13, -10, 19.6);
  const paint = new THREE.Mesh(mergeAll(quads), std({ color: '#e0b21b', roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1 }));
  paint.position.y = 0.006;
  add(paint);
  // white dashes in the forklift lane and a crosswalk to the packing station
  const white: THREE.BufferGeometry[] = [];
  for (let x = -28; x < 28; x += 2.5) {
    const p = new THREE.PlaneGeometry(1.2, 0.1).rotateX(-Math.PI / 2).translate(x, 0, 2.5);
    white.push(p);
  }
  for (let i = 0; i < 7; i++) white.push(new THREE.PlaneGeometry(2.2, 0.3).rotateX(-Math.PI / 2).translate(0, 0, 1.0 + i * 0.5));
  const whitePaint = new THREE.Mesh(mergeAll(white), std({ color: '#e8e2d2', roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -1 }));
  whitePaint.position.y = 0.007;
  add(whitePaint);
  // hatched no-go zones
  const hatch = (x: number, z: number, w: number, d: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), std({ map: hazardTex([w * 1.5, d * 1.5]), polygonOffset: true, polygonOffsetFactor: -1 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.008, z);
    add(m);
  };
  hatch(HOPPER.x, HOPPER.z, 3, 2.4);
  hatch(27.8, -2.8, 3.6, 4.6);
  // painted floor text
  const floorText = (lines: string[], x: number, z: number, w: number, h: number, rot = 0, color = '#e8e2d2') => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = Math.round((256 * h) / w);
    const g = c.getContext('2d')!;
    g.fillStyle = color;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    lines.forEach((l, i) => {
      g.font = `${i === 0 ? 22 : 12}px ${PX}`;
      g.fillText(l, 128, (c.height / (lines.length + 0.3)) * (i + 0.65));
    });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    const m = add(new THREE.Mesh(new THREE.PlaneGeometry(w, h), std({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })));
    m.rotation.set(-Math.PI / 2, 0, rot);
    m.position.set(x, 0.01, z);
  };
  floorText(['LOOK BOTH WAYS', 'forklifts will not'], -11, 3.4, 3.2, 0.9);
  floorText(['LOOK BOTH WAYS', 'forklifts will not'], 9, 3.4, 3.2, 0.9);
  floorText(['PACK HERE', 'smile optional (tracked)'], -1.2, 7.9, 3.4, 0.8, 0, '#e0b21b');
  floorText(['TOILET', '>>>>>>>>>'], 23, -3, 3.2, 1.0, Math.PI / 2, '#e0b21b');
  floorText(['STAND HERE', 'to be counted'], -12.5, 16.6, 2.8, 0.8, 0, '#e0b21b');

  // ================================================================ overhead conveyors with boxes
  const ovY = 6.9;
  const ovZ = 5.3;
  const ovX0 = -28;
  const ovX1 = 26;
  const conveyorMat = std({ color: '#3d4a52', metalness: 0.4 });
  box(ovX1 - ovX0, 0.12, 0.9, conveyorMat, (ovX0 + ovX1) / 2, ovY, ovZ);
  box(ovX1 - ovX0, 0.18, 0.05, yellow, (ovX0 + ovX1) / 2, ovY + 0.1, ovZ - 0.47);
  box(ovX1 - ovX0, 0.18, 0.05, yellow, (ovX0 + ovX1) / 2, ovY + 0.1, ovZ + 0.47);
  const hangers = new Batch();
  for (let x = ovX0 + 1; x < ovX1; x += 4) {
    hangers.add(x, (ovY + ROOF_Y) / 2, ovZ - 0.45, 0.04, ROOF_Y - ovY, 0.04);
    hangers.add(x, (ovY + ROOF_Y) / 2, ovZ + 0.45, 0.04, ROOF_Y - ovY, 0.04);
  }
  // a second line goes north along the east side of the racks
  const nx = 6.9;
  const nY = 7.3;
  box(0.9, 0.12, 24, conveyorMat, nx, nY, -7);
  box(0.05, 0.18, 24, yellow, nx - 0.47, nY + 0.1, -7);
  box(0.05, 0.18, 24, yellow, nx + 0.47, nY + 0.1, -7);
  for (let z = -18; z < 5; z += 4) {
    hangers.add(nx - 0.45, (nY + ROOF_Y) / 2, z, 0.04, ROOF_Y - nY, 0.04);
    hangers.add(nx + 0.45, (nY + ROOF_Y) / 2, z, 0.04, ROOF_Y - nY, 0.04);
  }
  hangers.build(scene, unit, steel);
  // the lift from the robot induct up to the overhead line
  box(0.8, ovY - 2.4, 0.8, std({ color: '#3d4a52', metalness: 0.4 }), HOPPER.x + 1.4, 2.4 + (ovY - 2.4) / 2, ovZ);
  box(0.82, 0.3, 0.82, hazard, HOPPER.x + 1.4, 0.15, ovZ);
  colliders.push(aabb(HOPPER.x + 1.4, ovZ, 0.8, 0.8, ovY, false, 'lift'));

  const movers: { mesh: THREE.InstancedMesh; n: number; speed: number; path: (s: number) => [number, number, number] }[] = [];
  const moving = (n: number, speed: number, len: number, path: (s: number) => [number, number, number], variant: number) => {
    const im = new THREE.InstancedMesh(unit, boxMaterials(variant), n);
    im.frustumCulled = false;
    add(im);
    movers.push({ mesh: im, n, speed, path: (s) => path(((s % len) + len) % len) });
  };
  moving(16, 1.6, ovX1 - ovX0, (s) => [ovX0 + s, ovY + 0.3, ovZ], 1);
  moving(14, 1.6, ovX1 - ovX0, (s) => [ovX0 + s, ovY + 0.25, ovZ], 4);
  moving(12, 1.4, 24, (s) => [nx, nY + 0.28, 5 - s], 2);
  const mtx = new THREE.Matrix4();
  const sizes = Array.from({ length: 40 }, () => [0.4 + r() * 0.3, 0.3 + r() * 0.25, 0.35 + r() * 0.25]);
  // conveyor time runs on its own clock, so the emergency stop can halt it
  let conveyorK = 1;
  let ct = 0;
  tickers.push((_t, dt) => {
    ct += dt * conveyorK;
    const t = ct;
    for (const mv of movers) {
      const spacing = 1 / mv.n;
      for (let i = 0; i < mv.n; i++) {
        const [x, y, z] = mv.path(t * mv.speed + i * spacing * 54 + (mv.speed > 1.5 ? 1.7 : 0));
        const [sx, sy, sz] = sizes[(i * 3 + mv.n) % sizes.length];
        mtx.makeScale(sx, sy, sz).setPosition(x, y + sy / 2 - 0.15, z);
        mv.mesh.setMatrixAt(i, mtx);
      }
      mv.mesh.instanceMatrix.needsUpdate = true;
    }
  });

  // ================================================================ TIME OFF TASK boards
  const bc = document.createElement('canvas');
  bc.width = 384;
  bc.height = 160;
  const bg = bc.getContext('2d')!;
  const btex = new THREE.CanvasTexture(bc);
  btex.colorSpace = THREE.SRGBColorSpace;
  btex.magFilter = THREE.NearestFilter;
  const boardMat = new THREE.MeshBasicMaterial({ map: btex });
  const boardAt = (x: number, y: number, z: number, rotY: number, w: number) => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = rotY;
    const h = (w * 160) / 384;
    box(w + 0.3, h + 0.3, 0.2, dark, 0, 0, -0.12, g);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), boardMat);
    g.add(p);
    add(g);
    return g;
  };
  boardAt(0, 5.0, ROOM.maxZ - 0.35, Math.PI, 7.2);
  const hanging = boardAt(-8, 5.2, 4.5, 0, 5.2);
  const back = boardAt(-8, 5.2, 4.24, Math.PI, 5.2);
  void back;
  for (const dx of [-2.4, 2.4]) box(0.03, ROOF_Y - 6.4, 0.03, dark, -8 + dx, (ROOF_Y + 6.4) / 2, 4.37);
  void hanging;
  let blink = 0;
  const drawBoard = (d: BoardData) => {
    blink++;
    bg.fillStyle = '#0a0604';
    bg.fillRect(0, 0, 384, 160);
    bg.fillStyle = '#7a1408';
    bg.fillRect(0, 0, 384, 30);
    bg.fillStyle = '#ffd2a0';
    bg.font = `16px ${PX}`;
    bg.textAlign = 'center';
    bg.textBaseline = 'middle';
    bg.fillText('TIME OFF TASK', 192, 16);
    bg.textAlign = 'left';
    bg.fillStyle = d.tot > 30 && blink % 2 ? '#ff2a10' : '#ff6a3a';
    bg.font = `12px ${PX}`;
    bg.fillText('HUMAN #4471', 12, 52);
    bg.font = `26px ${PX}`;
    bg.fillText(mmss(d.tot), 210, 54);
    bg.font = `11px ${PX}`;
    bg.fillStyle = '#f0b43c';
    bg.fillText(`STEPS ${d.steps.toLocaleString('en-US')}`, 12, 88);
    bg.fillText(`RATE ${Math.round(d.rate)}/h  (TARGET 300)`, 12, 110);
    bg.fillStyle = '#7cc44a';
    bg.fillText(`ROBOT PICKS TODAY ${d.robots.toLocaleString('en-US')}`, 12, 134);
    bg.fillStyle = '#5a4a3a';
    bg.fillText(`SHIPPED BY HUMAN: ${d.shipped}`, 12, 152);
    btex.needsUpdate = true;
  };
  drawBoard({ tot: 0, steps: 0, rate: 0, robots: 48213, shipped: 0 });

  // ================================================================ banners
  const banner = (lines: string[], x: number, y: number, z: number, rotY: number, w = 6, h = 1.2, bgc = '#8c2a1c') => {
    const s = kit.sign(lines, w, h, x, y, z, rotY, { bg: bgc, fg: '#f3e6c8', border: '#f0c419', font: PX });
    const back = kit.sign(lines, w, h, x, y, z - Math.sin(rotY + Math.PI / 2) * 0.01, rotY + Math.PI, { bg: bgc, fg: '#f3e6c8', border: '#f0c419', font: PX });
    void back;
    for (const dx of [-w / 2 + 0.2, w / 2 - 0.2]) {
      const cx = x + Math.cos(rotY) * dx;
      const cz = z - Math.sin(rotY) * dx;
      box(0.02, ROOF_Y - y - h / 2, 0.02, dark, cx, (ROOF_Y + y + h / 2) / 2, cz);
    }
    return s;
  };
  banner(['YOUR STEPS ARE A GIFT', 'to our shareholders'], -18, 6.2, 8, 0);
  banner(['PICK. PACK. SMILE. REPEAT.'], 12, 6.2, 12, 0, 6, 1.0, '#1f3f6e');
  banner(['300 UNITS PER HOUR', 'is a mindset'], -2, 7.2, 14, Math.PI);
  banner(['WE DELIVER EVERYTHING', 'except breaks'], 16, 6.4, -9.3, Math.PI / 2, 5, 1.1, '#1f3f6e');
  banner(['THE ALGORITHM LOVES YOU', '(conditionally)'], -16, 7.6, -9.3, 0, 6, 1.0, '#3a6a2a');
  kit.sign(['EVERY STEP COUNTS', 'we count them'], 12, 2.2, -11, 7.4, ROOM.minZ + 0.32, 0, { bg: '#8c2a1c', fg: '#f3e6c8', border: '#f0c419', font: PX });
  kit.sign(['EVERYTHING DEPOT', 'Fulfillment Center 4'], 14, 2.6, 0, 7.2, ROOM.maxZ - 0.32, Math.PI, { bg: '#c46a1c', fg: '#fff3d6', border: '#fff3d6', font: PX });
  kit.sign(['NOW HIRING', 'robots (humans: do not apply)'], 8, 1.4, ROOM.maxX - 0.32, 6.4, 8, -Math.PI / 2, { bg: '#1f3f6e', fg: '#f3e6c8', border: '#f0c419', font: PX });

  // posters on the lower walls
  const posterText = 'A motivational poster. Your rate dropped while you read it.';
  const posters: [string[], number, number, number][] = [
    [['BREAKS ARE', 'a state of mind'], -4, ROOM.maxZ - 0.32, Math.PI],
    [['YOUR RATE IS', 'your personality'], 4, ROOM.maxZ - 0.32, Math.PI],
    [['WE ARE A FAMILY', 'families have quotas'], -23, ROOM.maxZ - 0.32, Math.PI],
    [['IF YOU CAN READ THIS', 'you are not picking'], ROOM.minX + 0.32, 4, Math.PI / 2],
    [['HYDRATE RESPONSIBLY', 'the toilet is 61 m away'], ROOM.minX + 0.32, -6, Math.PI / 2],
    [['SAFETY FIRST*', '*after rate'], ROOM.maxX - 0.32, 3, -Math.PI / 2],
    [['TIME OFF TASK', 'is time off life'], ROOM.minX + 0.32, -15, Math.PI / 2],
    [['SMILE', 'you are on 14 cameras'], 18, ROOM.minZ + 0.32, 0],
  ];
  const posterMeshes: THREE.Mesh[] = [];
  for (const [lines, x, z, rot] of posters) {
    posterMeshes.push(kit.sign(lines, 2.4, 1.3, x, 2.0, z, rot, signStyle, posterText));
  }

  // ================================================================ break room (under construction since 2061)
  const ply = std({ map: plywoodTex([3, 2]) });
  const plastic = std({ map: plasticTex([2, 2]), roughness: 0.3, transparent: true, opacity: 0.9 });
  const stud = std({ color: '#c49a5e' });
  const BR = { x0: ROOM.minX, x1: -21, z0: 11, z1: ROOM.maxZ };
  const wallH = 3.0;
  // north wall: plywood, doorway with caution tape, plastic sheeting
  box(4.2, wallH, 0.12, ply, BR.x0 + 2.1, wallH / 2, BR.z0);
  colliders.push(aabb(BR.x0 + 2.1, BR.z0, 4.2, 0.12, wallH, true, 'breakroom'));
  box(2.8, wallH, 0.05, plastic, -22.4, wallH / 2, BR.z0);
  colliders.push(aabb(-22.4, BR.z0, 2.8, 0.12, wallH, true, 'breakroom'));
  for (let x = BR.x0 + 0.3; x < BR.x0 + 4.2; x += 0.6) box(0.06, wallH, 0.1, stud, x, wallH / 2, BR.z0 + 0.09);
  for (let x = -23.7; x < -21; x += 0.6) box(0.06, wallH, 0.1, stud, x, wallH / 2, BR.z0 + 0.06);
  box(2.2, 0.12, 0.12, stud, -24.8, wallH - 0.06, BR.z0);
  const caution = std({ map: cautionTex(), side: THREE.DoubleSide });
  for (const [y, rz] of [[1.0, 0.35], [1.0, -0.35], [1.6, 0.05]] as [number, number][]) {
    const tape = box(2.4, 0.09, 0.01, caution, -24.8, y, BR.z0 + 0.03);
    tape.rotation.z = rz;
  }
  // east wall: studs, plastic and an empty window frame
  box(0.12, wallH, 9, ply, BR.x1, wallH / 2, (BR.z0 + BR.z1) / 2 + 2.25 - 2.25);
  colliders.push(aabb(BR.x1, (BR.z0 + BR.z1) / 2, 0.12, BR.z1 - BR.z0, wallH, true, 'breakroom'));
  for (let z = BR.z0 + 0.3; z < BR.z1; z += 0.6) box(0.1, wallH, 0.06, stud, BR.x1 + 0.1, wallH / 2, z);
  box(0.05, 1.6, 3.5, plastic, BR.x1 + 0.17, 1.5, 15.2);
  kit.sign(['BREAK ROOM', 'under construction since 2061'], 3.6, 1.0, -24.8, 3.6, BR.z0 - 0.08, Math.PI, { bg: '#f0c419', fg: '#1a1410', border: '#1a1410', font: PX }, 'BREAK ROOM: under construction since 2061. Breaks are also under construction.');
  kit.sign(['ESTIMATED COMPLETION', 'Q3 2089'], 2.2, 0.7, BR.x1 + 0.2, 2.0, 13.0, Math.PI / 2, signStyle, 'The estimated completion date moves back one quarter every quarter.');
  // inside: scaffolding, wrapped couch, ladder, buckets, sawhorses
  kit.prop('pkScaffold', -28.4, 0, 12.6, 0);
  colliders.push(aabb(-28.4, 12.6, 2.2, 1.4, 3, false, 'decor'));
  const couch = new THREE.Group();
  couch.position.set(-29.2, 0, 17.6);
  const fabric = std({ color: '#6b3a2a' });
  box(0.9, 0.45, 2.2, fabric, 0, 0.32, 0, couch);
  box(0.25, 0.7, 2.2, fabric, -0.33, 0.7, 0, couch);
  box(0.95, 0.8, 2.3, plastic, 0, 0.5, 0, couch);
  add(couch);
  readable(couch, 'A couch, still in its plastic. Sitting on it would count as a break. There are no breaks.');
  colliders.push(aabb(-29.2, 17.6, 1.0, 2.3, 0.9, false, 'decor'));
  // A-frame ladder
  const ladder = new THREE.Group();
  ladder.position.set(-23.0, 0, 18.4);
  for (const s of [-1, 1]) {
    const leg = box(0.05, 2.0, 0.05, std({ color: '#c0392b' }), s * 0.22, 0.95, 0.25, ladder);
    leg.rotation.x = -0.25;
    const leg2 = box(0.05, 2.0, 0.05, std({ color: '#c0392b' }), s * 0.22, 0.95, -0.25, ladder);
    leg2.rotation.x = 0.25;
  }
  for (let y = 0.4; y < 1.8; y += 0.4) box(0.44, 0.04, 0.06, steel, 0, y, 0.25 - y * 0.12, ladder);
  add(ladder);
  colliders.push(aabb(-23.0, 18.4, 0.6, 0.9, 2, false, 'decor'));
  // paint buckets and a sawhorse table
  for (const [x, z, c] of [[-22.3, 12.2, '#e8e2d2'], [-22.0, 12.6, '#e8e2d2'], [-27.6, 19.3, '#2e6f9e']] as [number, number, string][]) {
    cyl(0.16, 0.14, 0.34, std({ color: c }), x, 0.17, z);
  }
  for (const x of [-27.8, -26.0]) {
    const sh = new THREE.Group();
    sh.position.set(x, 0, 19.1);
    box(0.1, 0.08, 0.9, std({ color: '#b88a4a' }), 0, 0.75, 0, sh);
    for (const s of [-1, 1]) {
      const l = box(0.06, 0.8, 0.06, std({ color: '#b88a4a' }), s * 0.18, 0.38, 0.35, sh);
      l.rotation.z = s * 0.25;
      const l2 = box(0.06, 0.8, 0.06, std({ color: '#b88a4a' }), s * 0.18, 0.38, -0.35, sh);
      l2.rotation.z = s * 0.25;
    }
    add(sh);
  }
  kit.prop('pkPlanks', -26.9, 0.8, 19.1, 0);
  colliders.push(aabb(-26.9, 19.1, 2.4, 1.0, 0.9, false, 'decor'));
  // boxed appliances that were never unpacked
  const appliance = (lines: string[], x: number, z: number, w: number, h: number, d: number, text: string) => {
    const b = box(w, h, d, boxMaterials(Math.floor(r() * 7)), x, h / 2, z);
    const l = kit.sign(lines, w * 0.8, h * 0.35, x, h * 0.6, z - d / 2 - 0.01, Math.PI, signStyle);
    void l;
    readable(b, text);
    colliders.push(aabb(x, z, w, d, h, false, 'decor'));
  };
  appliance(['FRIDGE', 'coming soon'], -29.3, 13.6, 0.8, 1.8, 0.8, 'A fridge, still in its box. The box says "coming soon". The box is from 2061.');
  appliance(['MICROWAVE', 'q3 2089'], -24.2, 19.4, 0.6, 0.4, 0.45, 'A microwave in a box. Lunch will be warm in 2089.');
  appliance(['CHAIRS x12', 'for breaks'], -21.9, 19.3, 0.8, 1.1, 0.7, 'Twelve chairs for the break room. They are on a break.');
  kit.sign(['TOILET KEY', 'please return the jack'], 1.6, 0.7, ROOM.minX + 0.32, 1.8, JACK_POS.z, Math.PI / 2, { bg: '#ffffff', fg: '#c0392b', border: '#c0392b', font: PX }, 'The toilet key lives here. On a pallet jack. The toilet lives in the opposite corner.');
  // the floor of the break room is bare concrete with plaster dust
  const dust = new THREE.MeshBasicMaterial({ color: '#d8d2c4', transparent: true, opacity: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  for (const [x, z, s] of [[-27, 14, 1.2], [-23.5, 16.5, 0.9], [-25, 18.8, 0.7]] as [number, number, number][]) {
    const m = add(new THREE.Mesh(blobGeometry(s), dust));
    m.position.set(x, 0.005, z);
  }
  // more construction mess: drywall, cement, a toolbox, cords, a stopped clock and the rules
  const drywall = std({ color: '#d8d4c8' });
  for (let i = 0; i < 5; i++) {
    const s = box(0.03, 2.4, 1.2, drywall, BR.x0 + 0.35 + i * 0.05, 1.18, 16.4);
    s.rotation.z = -0.12;
  }
  colliders.push(aabb(BR.x0 + 0.45, 16.4, 0.5, 1.3, 2.4, false, 'decor'));
  const cement = std({ color: '#9a958a' });
  for (let i = 0; i < 6; i++) box(0.6, 0.16, 0.4, cement, -26.6 + (i % 2) * 0.62, 0.08 + Math.floor(i / 2) * 0.16, 12.2);
  colliders.push(aabb(-26.3, 12.2, 1.3, 0.5, 0.5, false, 'decor'));
  box(0.5, 0.22, 0.25, std({ color: '#b3160c', metalness: 0.4 }), -24.0, 0.11, 16.9).rotation.y = 0.4;
  const cord = std({ color: '#e07a1c' });
  for (let i = 0; i < 3; i++) {
    const t = add(new THREE.Mesh(new THREE.TorusGeometry(0.25 + i * 0.04, 0.015, 4, 16), cord));
    t.rotation.x = Math.PI / 2;
    t.position.set(-25.3 + i * 0.05, 0.02 + i * 0.02, 13.4);
  }
  const clock = add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 16), [std({ color: '#222222' }), std({ map: textTexture(['12:00', 'stopped'], { w: 128, h: 128, bg: '#f2ead2', fg: '#7a1f14', font: PX }) }), std({ color: '#222222' })]));
  clock.rotation.x = -Math.PI / 2;
  clock.position.set(-25.5, 2.5, BR.z1 - 0.33);
  readable(clock, 'The break room clock. It stopped at the start of the last break. That was in 2061.');
  kit.sign(['BREAK ROOM RULES', '1. no breaks', '2. see rule 1'], 1.6, 1.1, -27.8, 1.8, BR.z1 - 0.32, Math.PI, signStyle, 'BREAK ROOM RULES. 1: No breaks. 2: See rule 1. 3: Rule 3 is under construction.');
  // a snack machine wrapped in plastic
  const snackGroup = add(new THREE.Group());
  snackGroup.position.set(-21.8, 0, 15.6);
  box(0.9, 1.8, 0.7, std({ color: '#2c4f7c' }), 0, 0.9, 0, snackGroup);
  box(0.95, 1.85, 0.75, plastic, 0, 0.92, 0, snackGroup);
  readable(snackGroup, 'SNACKS. Sold out since 2066. Also wrapped in plastic. Also unplugged.');
  const snackCollider = aabb(-21.8, 15.6, 0.95, 0.75, 1.9, false, 'decor');
  colliders.push(snackCollider);
  kit.prop('pkBarrier', -24.8, 0, 10.2, 0);
  kit.prop('pkCone', -26.6, 0, 10.4, 0);
  kit.prop('pkCone', -22.9, 0, 10.5, 0.4);

  // ================================================================ spawn: time clock, lockers, HR kiosk
  const tcg = new THREE.Group();
  tcg.position.set(SPAWN.x, 0, ROOM.maxZ - 0.3);
  box(0.6, 0.8, 0.25, std({ color: '#5b5650', metalness: 0.4 }), 0, 1.45, 0, tcg);
  const tcScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.2), new THREE.MeshBasicMaterial({ color: '#7cc44a' }));
  tcScreen.position.set(0, 1.6, -0.13);
  tcScreen.rotation.y = Math.PI;
  tcg.add(tcScreen);
  add(tcg);
  readable(tcg, 'TIME CLOCK. You are clocked in. Clocking out is only possible at 17:00. Or by being fired.');
  kit.sign(['TIME CLOCK', 'clock in. clock out.', 'nothing in between.'], 1.8, 0.9, SPAWN.x, 2.5, ROOM.maxZ - 0.32, Math.PI, signStyle);
  // lockers
  const lockerMat = std({ color: '#4f6a7a', metalness: 0.4 });
  for (let i = 0; i < 8; i++) {
    const x = -20.6 + i * 0.5;
    box(0.48, 1.9, 0.5, lockerMat, x, 0.95, ROOM.maxZ - 0.3);
    box(0.3, 0.04, 0.01, dark, x, 1.7, ROOM.maxZ - 0.56);
    box(0.3, 0.04, 0.01, dark, x, 1.6, ROOM.maxZ - 0.56);
  }
  colliders.push(aabb(-18.85, ROOM.maxZ - 0.3, 4.0, 0.55, 1.9, false, 'decor'));
  box(3.6, 0.08, 0.4, std({ color: '#8a6a43' }), -18.8, 0.45, ROOM.maxZ - 1.2);
  for (const x of [-20.4, -17.2]) box(0.08, 0.45, 0.35, steel, x, 0.22, ROOM.maxZ - 1.2);
  colliders.push(aabb(-18.8, ROOM.maxZ - 1.2, 3.6, 0.4, 0.5, false, 'decor'));
  // HR kiosk
  const kiosk = new THREE.Group();
  kiosk.position.set(-8.2, 0, ROOM.maxZ - 0.7);
  box(0.6, 1.2, 0.4, std({ color: '#d8d2c4' }), 0, 0.6, 0, kiosk);
  const kscreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.4),
    new THREE.MeshBasicMaterial({ map: textTexture(['HOW ARE YOU', 'FEELING?', '[GREAT] [FANTASTIC]'], { w: 256, h: 200, bg: '#1f3f6e', fg: '#f3e6c8', font: PX }) }),
  );
  kscreen.position.set(0, 1.45, -0.05);
  kscreen.rotation.set(-0.3, Math.PI, 0);
  kiosk.add(kscreen);
  box(0.6, 0.5, 0.1, std({ color: '#d8d2c4' }), 0, 1.45, 0.04, kiosk);
  add(kiosk);
  kiosk.userData.interact = { kind: 'kiosk' } satisfies Interact;
  interactables.push(kiosk);
  colliders.push(aabb(-8.2, ROOM.maxZ - 0.7, 0.7, 0.5, 1.6, false, 'decor'));
  // water cooler (empty)
  box(0.35, 1.0, 0.35, std({ color: '#e8e2d2' }), -6.6, 0.5, ROOM.maxZ - 0.5);
  const jug = cyl(0.15, 0.15, 0.4, new THREE.MeshStandardMaterial({ color: '#9fc3d8', transparent: true, opacity: 0.5, roughness: 0.1 }), -6.6, 1.2, ROOM.maxZ - 0.5);
  readable(jug, 'The water cooler. It has been empty since the toilet was moved to the other corner. Coincidence.');
  colliders.push(aabb(-6.6, ROOM.maxZ - 0.5, 0.4, 0.4, 1.4, false, 'decor'));
  // notice board
  const cork = std({ color: '#a57b4a' });
  box(2.4, 1.0, 0.05, cork, -18.8, 2.45, ROOM.maxZ - 0.32);
  for (let i = 0; i < 7; i++) {
    const memo = box(0.3, 0.38, 0.01, std({ color: ['#f2ead2', '#f7e48a', '#f2ead2', '#e8b0b0'][i % 4] }), -19.8 + i * 0.32, 2.45 + (r() - 0.5) * 0.4, ROOM.maxZ - 0.35);
    memo.rotation.z = (r() - 0.5) * 0.2;
  }
  readable(box(2.4, 0.2, 0.02, std({ color: '#7a2416' }), -18.8, 3.0, ROOM.maxZ - 0.36), 'MEMOS: "Smiling is now mandatory." "Smiling is now metered." "Smiling has been outsourced."');
  // safety vests on hooks
  for (let i = 0; i < 5; i++) box(0.36, 0.55, 0.05, std({ color: i === 3 ? '#e74c3c' : '#e0d21b' }), -14.9 + i * 0.42, 1.5, ROOM.maxZ - 0.36);

  // ================================================================ docks (south east)
  const doorTex = sheetWallTex([1, 4]);
  for (let i = 0; i < 4; i++) {
    const x = 9 + i * 5.5;
    const z = ROOM.maxZ - 0.1;
    const open = i === 1 ? 1.4 : i === 3 ? 0.5 : 0;
    // dark trailer opening behind half open doors
    box(3.0, 3.4, 0.05, std({ color: '#0d0b09' }), x, 1.7, z + 0.01);
    box(3.0, 3.4 - open, 0.08, std({ map: doorTex, color: '#c9c3b5' }), x, open + (3.4 - open) / 2, z - 0.05);
    box(0.3, 3.6, 0.35, std({ color: '#222222' }), x - 1.65, 1.8, z - 0.15);
    box(0.3, 3.6, 0.35, std({ color: '#222222' }), x + 1.65, 1.8, z - 0.15);
    box(3.6, 0.3, 0.35, hazard, x, 3.6, z - 0.15);
    for (const dx of [-1.2, 1.2]) box(0.3, 0.45, 0.3, std({ color: '#1a1a1a' }), x + dx, 0.5, z - 0.3);
    const lev = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.0), std({ map: concreteTex([2, 2]), color: '#8a8f95', metalness: 0.5 }));
    lev.rotation.x = -Math.PI / 2;
    lev.position.set(x, 0.012, z - 1.2);
    add(lev);
    hatch(x, z - 2.4, 2.6, 0.4);
    kit.sign([`DOCK ${i + 1}`], 1.4, 0.6, x, 4.2, z - 0.25, Math.PI, { bg: '#1f3f6e', fg: '#f3e6c8', font: PX });
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshStandardMaterial({ color: i === 1 ? '#40ff40' : '#ff3020', emissive: i === 1 ? '#40ff40' : '#ff3020', emissiveIntensity: 1.5 }));
    l.position.set(x + 1.9, 2.4, z - 0.2);
    add(l);
  }
  // outgoing pallets waiting at the docks
  const shrink = std({ map: shrinkTex(), roughness: 0.3 });
  const palletMat = std({ map: palletTex() });
  const stack = (x: number, z: number, h: number, wrap: boolean, rot = 0) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    box(1.2, 0.14, 1.0, palletMat, 0, 0.07, 0, g);
    if (wrap) box(1.15, h, 0.98, shrink, 0, 0.14 + h / 2, 0, g);
    else {
      let y = 0.14;
      while (y < h) {
        const bh = 0.3 + r() * 0.2;
        for (const dx of [-0.29, 0.29]) for (const dz of [-0.24, 0.24]) box(0.56, bh, 0.46, boxMaterials(Math.floor(r() * 7)), dx, y + bh / 2, dz, g).rotation.y = (r() - 0.5) * 0.1;
        y += bh;
      }
    }
    add(g);
    colliders.push(aabb(x, z, 1.3, 1.3, h + 0.15, true, 'pallet'));
  };
  stack(9, 16.8, 1.5, true);
  stack(10.6, 16.9, 1.1, false, 0.1);
  stack(14.5, 16.4, 1.7, true, -0.05);
  stack(20, 17.2, 0.9, false);
  stack(25.5, 16.6, 1.6, true);
  stack(27.2, 16.8, 1.2, true, 0.15);
  // empty pallets stacked up
  for (const [x, z, n] of [[5.5, 18.6, 9], [22.5, 12.8, 6], [-4.5, 18.8, 5], [28.6, -11.5, 12]] as [number, number, number][]) {
    for (let k = 0; k < n; k++) {
      const p = box(1.2, 0.14, 1.0, palletMat, x + (r() - 0.5) * 0.06, 0.07 + k * 0.145, z + (r() - 0.5) * 0.06);
      p.rotation.y = (r() - 0.5) * 0.08;
    }
    colliders.push(aabb(x, z, 1.3, 1.1, n * 0.145, false, 'pallets'));
  }
  kit.prop('pkHandTruck', 7.2, 0, 18.8, 0.6);
  kit.prop('pkHandTruck', -5.8, 0, 18.9, -0.4);

  // ================================================================ bulk storage (north east)
  const bulkWrap = new Batch();
  const bulkPallets = new Batch();
  const bulkBoxes = [new Batch(), new Batch()];
  for (const bx of [9.0, 14.0, 19.0]) {
    for (const [z0, z1] of [[-18.8, -11.0], [-7.6, -1.2]]) {
      for (let z = z0 + 0.55; z < z1 - 0.4; z += 1.1) {
        let y = 0;
        const levels = 1 + Math.floor(r() * 3);
        for (let k = 0; k < levels; k++) {
          bulkPallets.add(bx, y + 0.07, z, 1.2, 0.14, 1.0);
          const h = 0.7 + r() * 0.7;
          if (r() < 0.55) bulkWrap.add(bx, y + 0.14 + h / 2, z, 1.15, h, 0.98, (r() - 0.5) * 0.05);
          else bulkBoxes[k % 2].add(bx, y + 0.14 + h / 2, z, 1.1, h, 0.95, (r() - 0.5) * 0.08);
          y += 0.14 + h;
        }
      }
      colliders.push(aabb(bx, (z0 + z1) / 2, 1.3, z1 - z0, 4, true, 'bulk'));
    }
  }
  bulkPallets.build(scene, unit, palletMat);
  bulkWrap.build(scene, unit, shrink);
  bulkBoxes[0].build(scene, unit, boxMaterials(3));
  bulkBoxes[1].build(scene, unit, boxMaterials(5));
  kit.sign(['BULK', 'do not climb'], 1.6, 0.6, 14, 4.6, -1.0, 0, { bg: '#1f3f6e', fg: '#f3e6c8', font: PX });

  // forklift charging along the east wall
  for (const z of [-4.2, -1.5]) {
    const c = box(0.5, 1.4, 0.6, std({ color: '#3a6a2a', metalness: 0.3 }), ROOM.maxX - 0.4, 0.7, z);
    readable(c, 'FORKLIFT CHARGER. Forklifts charge for 20 minutes every hour. Humans charge at home.');
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.08, 0.2), new THREE.MeshStandardMaterial({ color: '#40ff40', emissive: '#40ff40', emissiveIntensity: 1.5 }));
    led.position.set(ROOM.maxX - 0.66, 1.2, z);
    add(led);
  }
  colliders.push(aabb(ROOM.maxX - 0.4, -2.85, 0.6, 3.4, 1.4, false, 'decor'));
  kit.sign(['FORKLIFT CHARGING', 'humans charge at home'], 2.6, 0.7, ROOM.maxX - 0.32, 2.6, -2.85, -Math.PI / 2, signStyle);
  const traffic = kit.prop('pkTraffic', ROOM.maxX - 0.6, 0, -0.4, -Math.PI / 2);

  // returns cage
  const cage = std({ color: '#8a9096', metalness: 0.6, wireframe: true });
  box(2.4, 2.2, 3.2, cage, 27.6, 1.1, -8.4);
  for (let i = 0; i < 9; i++) {
    const b = box(0.4 + r() * 0.3, 0.3 + r() * 0.3, 0.4 + r() * 0.3, boxMaterials(Math.floor(r() * 7)), 26.9 + r() * 1.5, 0.2 + (i % 3) * 0.35, -9.6 + r() * 2.4);
    b.rotation.y = r() * 2;
  }
  colliders.push(aabb(27.6, -8.4, 2.4, 3.2, 2.2, false, 'decor'));
  kit.sign(['RETURNS', 'everything is left-handed'], 2.4, 0.7, 26.36, 1.8, -8.4, -Math.PI / 2, signStyle, 'RETURNS. 94 percent of returns say "item was left-handed". The other 6 percent are left-handed people.');

  // ================================================================ the toilet corner
  // vending machine for approved relief bottles, right next to the toilet
  const vend = new THREE.Group();
  vend.position.set(BOOTH_X0 + 2.6, 0, BOOTH_Z0 + 4.55);
  const vendFront = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.85), std({ map: vendingTex(), emissive: '#ffffff', emissiveMap: vendingTex(), emissiveIntensity: 0.25 }));
  vendFront.position.set(0, 1.0, 0.36);
  vend.add(vendFront);
  box(1.0, 1.95, 0.7, std({ color: '#5e1810' }), 0, 0.98, 0, vend);
  add(vend);
  vend.userData.interact = { kind: 'vending' } satisfies Interact;
  interactables.push(vend);
  colliders.push(aabb(vend.position.x, vend.position.z, 1.05, 0.75, 2, false, 'vending'));
  kit.sign(['APPROVED RELIEF BOTTLES', 'EUR 4.99 at machine B7', 'for when the toilet is too far'], 1.7, 0.8, BOOTH_X0 + 0.95, 1.7, BOOTH_Z0 + 4.1, 0, { bg: '#f0c419', fg: '#1a1410', border: '#1a1410', font: PX }, 'Approved relief bottles are sold at machine B7. Machine B7 is next to this toilet. Please do not ask why.');
  kit.sign(['MACHINE B7'], 1.0, 0.3, vend.position.x, 2.15, vend.position.z + 0.36, 0, { bg: '#111111', fg: '#f0b43c', font: PX });
  // mop bucket and a sad chair for the queue that never forms
  const bucket = std({ color: '#d9a400' });
  cyl(0.22, 0.18, 0.38, bucket, BOOTH_X0 - 0.6, 0.19, BOOTH_Z0 + 0.6);
  const mopStick = box(0.03, 1.5, 0.03, std({ color: '#8a6b45' }), BOOTH_X0 - 0.5, 0.85, BOOTH_Z0 + 0.65);
  mopStick.rotation.z = 0.25;
  colliders.push(aabb(BOOTH_X0 - 0.6, BOOTH_Z0 + 0.6, 0.5, 0.5, 0.5, false, 'decor'));
  kit.sign(['WC QUEUE', 'average wait: your rate'], 1.4, 0.5, BOOTH_X0 - 2.0, 2.4, BOOTH_Z0 + 0.32, 0, signStyle, 'There is never a queue. Nobody makes it this far.');
  // the toilet is far away, and the signs say so
  kit.sign(['TOILET >', '312 steps'], 1.6, 0.7, 6.3, 2.4, 4.3, -Math.PI / 2, { bg: '#2e86c1', fg: '#ffffff', border: '#ffffff', font: PX }, 'The toilet is in the far north-east corner. The key is in the far south-west corner. This is called a journey.');
  kit.sign(['TOILET ^', 'still 140 steps', 'you can do it'], 1.6, 0.8, 22.9, 2.4, 0.4, 0, { bg: '#2e86c1', fg: '#ffffff', border: '#ffffff', font: PX });
  kit.sign(['TOILET ^', 'almost', '(not really)'], 1.4, 0.8, 22.9, 2.4, -11.5, 0, { bg: '#2e86c1', fg: '#ffffff', border: '#ffffff', font: PX });
  kit.sign(['TOILET KEY', '< break room', 'far south-west'], 1.6, 0.8, -6.4, 2.4, 4.3, Math.PI / 2, { bg: '#ffffff', fg: '#c0392b', border: '#c0392b', font: PX });
  for (const [x, z] of [[6.3, 4.3], [22.9, 0.4], [22.9, -11.5], [-6.4, 4.3]] as [number, number][]) box(0.05, 2.0, 0.05, steel, x + (x === 6.3 ? 0.05 : x === -6.4 ? -0.05 : 0), 1.0, z + (z === 0.4 || z === -11.5 ? 0.05 : 0));

  // ================================================================ robot induct and robot arm
  if (!kit.prop('pkHopper', HOPPER.x, 0, HOPPER.z, 0)) {
    box(1.6, 1.4, 1.6, std({ color: '#3d4a52', metalness: 0.4 }), HOPPER.x, 0.7, HOPPER.z);
    box(1.9, 0.6, 1.9, std({ color: '#566570' }), HOPPER.x, 1.6, HOPPER.z);
  }
  colliders.push(aabb(HOPPER.x, HOPPER.z, 1.8, 1.8, 2.2, false, 'hopper'));
  kit.sign(['ROBOT INDUCT', 'human picks not accepted'], 2.0, 0.6, HOPPER.x, 2.9, HOPPER.z - 1.0, Math.PI, { bg: '#2c3e50', fg: '#7cc44a', font: PX }, 'ROBOT INDUCT. The picker robots drop their picks here. 41,000 an hour. They want you to know.');
  kit.sign(['ROBOT INDUCT', 'human picks not accepted'], 2.0, 0.6, HOPPER.x, 2.9, HOPPER.z - 0.98, 0, { bg: '#2c3e50', fg: '#7cc44a', font: PX });
  box(0.05, 0.6, 0.05, steel, HOPPER.x - 0.7, 3.3, HOPPER.z - 1.0);
  box(0.05, 0.6, 0.05, steel, HOPPER.x + 0.7, 3.3, HOPPER.z - 1.0);
  const arm = kit.prop('pkRobotArm', 11.6, 0, 6.6, -1.2);
  if (arm) {
    colliders.push(aabb(11.6, 6.6, 1.2, 1.2, 2, false, 'arm'));
    tickers.push((t) => {
      arm.rotation.y = -1.2 + Math.sin(t * 0.9) * 0.9;
    });
  }
  kit.prop('pkScreen', HOPPER.x + 1.4, 4.2, ovZ - 0.5, Math.PI);

  // ================================================================ columns, cameras, extinguishers, bins, stains
  const colMat = std({ color: '#5d6b74', metalness: 0.4 });
  for (const [x, z] of [[-22, 7], [-12, 7.5], [14, 7.5], [24, 7.5], [-17, 13.2], [24, 13.2], [-2, 16.6]] as [number, number][]) {
    box(0.35, ROOF_Y, 0.35, colMat, x, ROOF_Y / 2, z);
    box(0.5, 1.0, 0.5, hazard, x, 0.5, z);
    colliders.push(aabb(x, z, 0.5, 0.5, ROOF_Y, true, 'column'));
    box(0.12, 0.42, 0.12, std({ color: '#b3160c' }), x + 0.31, 1.0, z);
  }
  const camBody = std({ color: '#d8d8d2' });
  const ledMat = new THREE.MeshStandardMaterial({ color: '#ff2020', emissive: '#ff2020', emissiveIntensity: 2 });
  const leds: THREE.Mesh[] = [];
  for (const [x, y, z, yaw] of [
    [-29.6, 6.5, -19.6, Math.PI * 0.25],
    [29.6, 6.5, 19.6, -Math.PI * 0.75],
    [-29.6, 6.5, 19.6, Math.PI * 0.75],
    [29.6, 6.5, -19.6, -Math.PI * 0.25],
    [-12, 4.5, 7.3, Math.PI],
    [14, 4.5, 7.3, Math.PI],
    [24.6, 2.4, -16.5, -Math.PI / 2],
    [0, 6.0, -19.6, 0],
    [-25.5, 2.8, 11.2, Math.PI],
  ] as [number, number, number, number][]) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    g.rotation.y = yaw;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.2, 0.45), camBody);
    body.rotation.x = 0.35;
    g.add(body);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 8), dark);
    lens.rotation.x = Math.PI / 2 + 0.35;
    lens.position.set(0, -0.08, 0.24);
    g.add(lens);
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), ledMat);
    l.position.set(0.07, 0.07, 0.2);
    g.add(l);
    leds.push(l);
    add(g);
  }
  // trash and cardboard bales
  const binMat = std({ color: '#3f4a3c' });
  for (const [x, z] of [[-3.8, 11.9], [3.9, 7.0], [-21.5, 4.9], [21.6, -16.5], [6.2, -1.0]] as [number, number][]) {
    cyl(0.3, 0.26, 0.85, binMat, x, 0.425, z);
    cyl(0.32, 0.32, 0.05, std({ color: '#2b3329' }), x, 0.86, z);
    colliders.push(aabb(x, z, 0.62, 0.62, 0.9, false, 'decor'));
  }
  const bale = std({ map: boxMaterials(2)[0] instanceof THREE.MeshStandardMaterial ? (boxMaterials(2)[0] as THREE.MeshStandardMaterial).map : null, color: '#c8a070' });
  for (const [x, z, n] of [[2.0, 18.5, 2], [27.8, 12.5, 3]] as [number, number, number][]) {
    for (let k = 0; k < n; k++) box(1.2, 0.8, 0.9, bale, x, 0.4 + k * 0.8, z).rotation.y = (r() - 0.5) * 0.2;
    for (let k = 0; k < n; k++) for (const dz of [-0.25, 0.25]) box(1.22, 0.03, 0.03, dark, x, 0.2 + k * 0.8 + 0.3, z + dz);
    colliders.push(aabb(x, z, 1.3, 1.0, n * 0.8, false, 'decor'));
  }
  // cones around a mystery spill
  for (const [x, z] of [[17.8, 3.6], [19.2, 4.0], [18.4, 4.9]] as [number, number][]) {
    const cone = kit.prop('pkCone', x, 0, z, r() * 3);
    if (cone) kit.movable(cone, 'Traffic Cone', { holdPos: [0.3, -0.45, -0.75], pickupLine: 'You take the traffic cone. The spill is now unsupervised.' });
  }
  const stainMat = new THREE.MeshBasicMaterial({ color: '#3a3024', transparent: true, opacity: 0.25, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  for (const [x, z, s] of [[18.5, 4.3, 0.7], [-6, 2.0, 0.5], [3.5, -3, 0.4], [-17, -9.3, 0.6], [12, -9, 0.5], [-20, 14, 0.6], [26, 4, 0.8], [-27.8, 1.5, 0.5], [0.5, 12.2, 0.4], [-9, -15, 0.5]] as [number, number, number][]) {
    const m = add(new THREE.Mesh(blobGeometry(s), stainMat));
    m.position.set(x, 0.009, z);
    m.rotation.y = r() * 6;
  }
  // a lost scanner gun and some packing peanuts in the corridor
  box(0.08, 0.12, 0.2, std({ color: '#f0b43c' }), -14.3, 0.06, 3.7).rotation.y = 0.7;
  const peanut = std({ color: '#efe9da' });
  for (let i = 0; i < 25; i++) box(0.05, 0.02, 0.03, peanut, 0.8 + (r() - 0.5) * 2, 0.01, 12.1 + (r() - 0.5) * 0.8).rotation.y = r() * 3;

  // ================================================================ plants (valid toilets in an emergency)
  kit.plant(-10.6, ROOM.maxZ - 0.6);
  kit.plant(-20.3, 11.8);
  kit.plant(BOOTH_X0 - 1.8, BOOTH_Z0 + 5.3);
  kit.plant(5.0, 12.0);

  let last = 0;
  return {
    vending: vend,
    posters: posterMeshes,
    snack: { group: snackGroup, collider: snackCollider },
    traffic,
    setConveyor: (k: number) => (conveyorK = k),
    board: drawBoard,
    tick(t: number) {
      const dt = Math.min(0.05, Math.max(0, t - last));
      last = t;
      for (const f of tickers) f(t, dt);
      // the toilet lamp is dying, the break room lamp is dying slower
      const ph = t % 5.1;
      toiletLamp.intensity = ph > 4.4 && Math.sin(t * 45) > 0 ? 6 : 35;
      breakLamp.intensity = Math.sin(t * 1.3) > 0.92 ? 4 : 38;
      const on = Math.sin(t * 3) > 0;
      for (const l of leds) l.visible = on;
    },
  };
}

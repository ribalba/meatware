import * as THREE from 'three';
import { Item } from '../../items';
import { Interact, LevelKit } from '../../level';
import { boxMaterials } from '../../details';
import { hazardTex, rackTex } from '../../textures';
import { aabb } from '../../util';
import { JACK_DEF, PRODUCTS, Product } from './catalog';
import { addDecor, Decor } from './decor';
import {
  AISLE_X,
  BAY_W,
  BAYS_PER_SEG,
  bayNumber,
  bayZ,
  BIN_Y,
  BOOTH_X0,
  BOOTH_Z0,
  CAP_Y,
  CROSS_Z,
  JACK_POS,
  LETTERS,
  OVER_Y,
  RACK_DEPTH,
  RACK_H,
  RACK_X,
  rng,
  ROOF_Y,
  ROOM,
  SEGS,
  SPAWN,
  TOTE_H,
} from './layout';
import { blockWallTex, floorTex, roofTex, sheetWallTex, shrinkTex, toteSideTex, toteTex, palletTex } from './textures';
import { buildStation, Station } from './station';
import { Batch, mergeAll } from './geom';
import { PickerFun } from './mischief';

export interface Bin {
  aisle: number;
  side: 'W' | 'E';
  /** Bay index along the aisle, 0..11. */
  bay: number;
  /** 1..3 from the floor up. */
  bin: number;
  product: Product;
  /** Center of the tote opening, on the aisle side. */
  pos: THREE.Vector3;
}

export const binLabel = (b: Bin) => `${LETTERS[b.aisle]}-${bayNumber(b.bay, b.side)}-${b.bin}`;

const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.8, ...o });

/** The fulfillment center. Racks, bins, packing station, toilet and everything in between. */
export class Warehouse extends LevelKit {
  bins: Bin[] = [];
  /** Bins by `${aisle}${side}${bay}-${bin}`. */
  private binMap = new Map<string, Bin>();
  station: Station;
  decor: Decor;
  /** Breakables, hiding places and secrets. */
  fun: PickerFun;

  constructor(scene: THREE.Scene) {
    super(scene);
    this.bounds = ROOM;
    this.ceiling = 8;
    this.spawn = { pos: SPAWN.clone(), yaw: -0.55 };
    this.bossWaypoints = [
      // main corridor and the aisle mouths
      ...AISLE_X.filter((_, i) => i % 2 === 0).map((x) => new THREE.Vector3(x + 2, 0, 2.4)),
      new THREE.Vector3(14, 0, 2.4),
      new THREE.Vector3(24, 0, 2.4),
      // packing area, robot induct, spawn and docks
      new THREE.Vector3(0, 0, 6.5),
      new THREE.Vector3(-3, 0, 7.2),
      new THREE.Vector3(3.5, 0, 6.2),
      new THREE.Vector3(-12, 0, 12),
      new THREE.Vector3(-18, 0, 8),
      new THREE.Vector3(12, 0, 13),
      new THREE.Vector3(22, 0, 12),
    ];
    this.lights();
    this.room();
    this.racks();
    this.station = buildStation(this);
    this.toilet();
    this.jack();
    this.decor = addDecor(this);
    this.fun = new PickerFun(this, this.decor);
    this.onTick((t) => {
      this.decor.tick(t);
      this.station.tick(t);
    });
  }

  binAt(aisle: number, side: 'W' | 'E', bay: number, bin: number): Bin | undefined {
    return this.binMap.get(`${aisle}${side}${bay}-${bin}`);
  }

  private lights(): void {
    this.scene.background = new THREE.Color('#1c1814');
    this.scene.add(new THREE.HemisphereLight('#fff0d8', '#5a5040', 2.1));
    const d = new THREE.DirectionalLight('#ffe8c8', 0.7);
    d.position.set(8, 14, 6);
    this.scene.add(d);
  }

  private room(): void {
    const W = ROOM.maxX - ROOM.minX;
    const D = ROOM.maxZ - ROOM.minZ;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D, W, D), std({ map: floorTex([W / 2, D / 2]), roughness: 0.55 }));
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);

    const roof = new THREE.Mesh(new THREE.PlaneGeometry(W, D, 30, 20), std({ map: roofTex([W / 2, D / 4]), roughness: 0.95 }));
    roof.rotation.x = Math.PI / 2;
    roof.position.y = ROOF_Y;
    this.scene.add(roof);

    // walls: concrete blocks below, corrugated sheet above, a red band in between
    const lowH = 3;
    const blockL = std({ map: blockWallTex([W / 2, lowH / 2]) });
    const blockS = std({ map: blockWallTex([D / 2, lowH / 2]) });
    const sheetL = std({ map: sheetWallTex([W, 3]) });
    const sheetS = std({ map: sheetWallTex([D, 3]) });
    const band = std({ color: '#8e2a1f' });
    const upH = ROOF_Y - lowH;
    for (const s of [-1, 1]) {
      this.box(W + 0.4, lowH, 0.3, blockL, 0, lowH / 2, s * (D / 2 + 0.15));
      this.box(W + 0.4, upH, 0.3, sheetL, 0, lowH + upH / 2, s * (D / 2 + 0.15));
      this.box(W, 0.35, 0.06, band, 0, lowH, s * (D / 2 - 0.02));
      this.box(0.3, lowH, D, blockS, s * (W / 2 + 0.15), lowH / 2, 0);
      this.box(0.3, upH, D, sheetS, s * (W / 2 + 0.15), lowH + upH / 2, 0);
      this.box(0.06, 0.35, D, band, s * (W / 2 - 0.02), lowH, 0);
    }
    this.colliders.push(
      aabb(0, ROOM.minZ - 0.15, W + 0.4, 0.3, ROOF_Y, false),
      aabb(0, ROOM.maxZ + 0.15, W + 0.4, 0.3, ROOF_Y, false),
      aabb(ROOM.minX - 0.15, 0, 0.3, D, ROOF_Y, false),
      aabb(ROOM.maxX + 0.15, 0, 0.3, D, ROOF_Y, false),
    );

    // steel wall columns and roof trusses
    const steel = std({ color: '#5d6b74', metalness: 0.4, roughness: 0.6 });
    const cols = new Batch();
    for (let x = ROOM.minX + 6; x < ROOM.maxX; x += 6) {
      cols.add(x, ROOF_Y / 2, ROOM.minZ + 0.15, 0.35, ROOF_Y, 0.3);
      cols.add(x, ROOF_Y / 2, ROOM.maxZ - 0.15, 0.35, ROOF_Y, 0.3);
    }
    for (let z = ROOM.minZ + 8; z < ROOM.maxZ; z += 8) {
      cols.add(ROOM.minX + 0.15, ROOF_Y / 2, z, 0.3, ROOF_Y, 0.35);
      cols.add(ROOM.maxX - 0.15, ROOF_Y / 2, z, 0.3, ROOF_Y, 0.35);
    }
    cols.build(this.scene, new THREE.BoxGeometry(1, 1, 1), steel);

    const chords = new Batch();
    const webs = new Batch();
    for (let x = ROOM.minX + 6; x < ROOM.maxX; x += 6) {
      chords.add(x, 8.25, 0, 0.14, 0.14, D);
      chords.add(x, 8.9, 0, 0.14, 0.14, D);
      for (let z = ROOM.minZ + 1; z < ROOM.maxZ; z += 4) {
        webs.add(x, 8.575, z + 1, 0.06, 0.06, 2.1, 0, undefined, 0.31);
        webs.add(x, 8.575, z, 0.06, 0.65, 0.06);
      }
    }
    // purlins across
    for (let z = ROOM.minZ + 4; z < ROOM.maxZ; z += 4) chords.add(0, 8.95, z, W, 0.1, 0.1);
    const trussMat = std({ color: '#6e6a5e', metalness: 0.3 });
    chords.build(this.scene, new THREE.BoxGeometry(1, 1, 1), trussMat);
    webs.build(this.scene, new THREE.BoxGeometry(1, 1, 1), trussMat);
  }

  // ---------------------------------------------------------------- racks and bins

  private racks(): void {
    const r = rng(9041);
    const unit = new THREE.BoxGeometry(1, 1, 1);
    const orange = std({ map: rackTex([1, 8]), roughness: 0.6 });
    const beamMat = std({ map: rackTex([10, 1]), roughness: 0.6 });
    const capMat = std({ map: hazardTex([24, 1]) });
    const deckMat = std({ color: '#7d7a72', metalness: 0.3 });
    const uprights = new Batch();
    const beams = new Batch();
    const caps = new Batch();
    const decks = new Batch();
    const segLen = BAY_W * BAYS_PER_SEG;

    for (const rx of RACK_X) {
      for (const seg of SEGS) {
        const zc = (seg.z0 + seg.z1) / 2;
        for (let k = 0; k <= BAYS_PER_SEG; k++) {
          const z = seg.z0 - k * BAY_W;
          for (const dx of [-0.56, 0.56]) uprights.add(rx + dx, RACK_H / 2, z, 0.08, RACK_H, 0.1);
          // diagonal bracing on the rack ends
          if (k === 0 || k === BAYS_PER_SEG) {
            for (let y = 0.6; y < RACK_H - 0.5; y += 1.2) beams.add(rx, y, z, 1.05, 0.04, 0.04, 0, undefined, 0, (Math.floor(y) % 2 ? 1 : -1) * 0.75);
          }
        }
        for (const dx of [-0.56, 0.56]) {
          for (const y of BIN_Y) beams.add(rx + dx, y - 0.03, zc, 0.06, 0.1, segLen);
          caps.add(rx + dx, CAP_Y, zc, 0.07, 0.14, segLen);
          for (const y of OVER_Y) beams.add(rx + dx, y - 0.05, zc, 0.06, 0.12, segLen);
        }
        for (const y of [...BIN_Y, ...OVER_Y]) decks.add(rx, y + 0.01, zc, 1.12, 0.025, segLen);
        this.colliders.push(aabb(rx, zc, RACK_DEPTH, segLen, RACK_H, true, 'rack'));
      }
    }
    uprights.build(this.scene, unit, orange);
    beams.build(this.scene, unit, beamMat);
    caps.build(this.scene, unit, capMat);
    decks.build(this.scene, unit, deckMat);

    // ---------------- bins: totes facing every aisle, with stock inside
    const weights = PRODUCTS.map((p) => (p.def.id === 'pk-anvil' ? 1.2 : p.stock === null ? 1.5 : 5));
    const total = weights.reduce((a, b) => a + b, 0);
    const pickProduct = () => {
      let v = r() * total;
      for (let i = 0; i < PRODUCTS.length; i++) {
        v -= weights[i];
        if (v <= 0) return PRODUCTS[i];
      }
      return PRODUCTS[0];
    };
    const totes = [new Batch(), new Batch(), new Batch()];
    const stock = new Map<string, Batch>();
    for (let a = 0; a < AISLE_X.length; a++) {
      for (const side of ['W', 'E'] as const) {
        // the totes of this face sit in the half of the rack next to the aisle
        const rx = side === 'W' ? RACK_X[a] + 0.3 : RACK_X[a + 1] - 0.3;
        const dir = side === 'W' ? 1 : -1;
        for (let j = 0; j < BAYS_PER_SEG * SEGS.length; j++) {
          const z = bayZ(j);
          for (let b = 1; b <= 3; b++) {
            const y = BIN_Y[b - 1] + 0.02;
            totes[b - 1].add(rx, y + TOTE_H / 2, z);
            const product = pickProduct();
            const bin: Bin = { aisle: a, side, bay: j, bin: b, product, pos: new THREE.Vector3(rx + dir * 0.28, y + TOTE_H, z) };
            this.bins.push(bin);
            this.binMap.set(`${a}${side}${j}-${b}`, bin);
            if (product.stock) {
              // a heap of stock that pokes out of the tote
              let sb = stock.get(product.stock);
              if (!sb) stock.set(product.stock, (sb = new Batch()));
              for (let i = 0; i < 2; i++) {
                const s = 0.24 + r() * 0.1;
                const sh = 0.3 + r() * 0.14;
                sb.add(rx + (r() - 0.5) * 0.12, y + sh / 2, z - 0.25 + i * 0.5 + (r() - 0.5) * 0.1, s, sh, s * 1.2, r() * 0.6);
              }
            }
          }
        }
      }
    }
    const toteGeo = new THREE.BoxGeometry(0.56, TOTE_H, 1.26);
    const inside = std({ color: '#1d1a17' });
    for (let b = 1; b <= 3; b++) {
      const front = std({ map: toteTex(b), roughness: 0.5 });
      const sideM = std({ map: toteSideTex(b), roughness: 0.5 });
      totes[b - 1].build(this.scene, toteGeo, [front, front, inside, sideM, sideM, sideM]);
    }
    for (const [color, b] of stock) b.build(this.scene, unit, std({ color, roughness: 0.6 }));

    // ---------------- overstock up high: pallets with boxes and shrink wrap
    const pallets = new Batch();
    const loads = [new Batch(), new Batch(), new Batch()];
    const wraps = new Batch();
    for (const rx of RACK_X) {
      for (let j = 0; j < BAYS_PER_SEG * SEGS.length; j++) {
        for (const y of OVER_Y) {
          if (r() < 0.2) continue;
          const z = bayZ(j) + (r() - 0.5) * 0.1;
          pallets.add(rx, y + 0.09, z, 1.0, 0.13, 1.2);
          const h = 0.45 + r() * 0.5;
          if (r() < 0.45) wraps.add(rx, y + 0.155 + h / 2, z, 0.95, h, 1.12, (r() - 0.5) * 0.05);
          else {
            const lv = Math.floor(r() * 3);
            const rows = r() < 0.5 ? 2 : 1;
            for (let i = 0; i < 2; i++) {
              for (let k = 0; k < rows; k++) {
                const bh = h / rows;
                loads[lv].add(rx + (i - 0.5) * 0.47, y + 0.155 + bh * (k + 0.5), z + (r() - 0.5) * 0.1, 0.44, bh * 0.97, 1.0 - r() * 0.2, (r() - 0.5) * 0.12);
              }
            }
          }
        }
      }
    }
    pallets.build(this.scene, unit, std({ map: palletTex() }));
    loads.forEach((l, i) => l.build(this.scene, unit, boxMaterials(i * 2)));
    wraps.build(this.scene, unit, std({ map: shrinkTex(), roughness: 0.3 }));

    // ---------------- rack labels and invisible pick faces
    const ghost = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    for (let a = 0; a < AISLE_X.length; a++) {
      const ax = AISLE_X[a];
      this.bayLabels(a);
      for (const side of ['W', 'E'] as const) {
        const fx = side === 'W' ? ax - 1.38 : ax + 1.38;
        for (let s = 0; s < SEGS.length; s++) {
          const seg = SEGS[s];
          const face = new THREE.Mesh(new THREE.BoxGeometry(0.04, CAP_Y, segLen), ghost);
          face.position.set(fx, CAP_Y / 2, (seg.z0 + seg.z1) / 2);
          face.userData.interact = { kind: 'bin', aisle: a, side } satisfies Interact;
          this.scene.add(face);
          this.interactables.push(face);
        }
      }
      // hanging aisle signs at the corridor end and in the cross aisle
      const letter = LETTERS[a];
      const style = { bg: '#1f3f6e', fg: '#f3e6c8', border: '#f0c419', font: '"Press Start 2P", monospace' };
      this.sign([`AISLE ${letter}`, 'BAYS 1-12'], 2.2, 1.1, ax, 4.4, 0.6, 0, style, `Aisle ${letter}. Odd bay numbers on the left, even on the right. Bin 1 is the bottom tote, bin 3 the top one.`);
      this.sign([`AISLE ${letter}`, 'BAYS 1-12'], 2.2, 1.1, ax, 4.4, 0.58, Math.PI, style);
      this.sign([`AISLE ${letter}`, 'BAYS 13-24'], 2.2, 1.1, ax, 4.4, SEGS[1].z0 + 0.1, 0, style);
      this.sign([`AISLE ${letter}`, 'BAYS 1-12'], 2.2, 1.1, ax, 4.4, SEGS[0].z1 - 0.1, Math.PI, style);
      // chains
      for (const z of [0.6, SEGS[1].z0 + 0.1, SEGS[0].z1 - 0.1]) {
        for (const dx of [-0.9, 0.9]) this.box(0.02, ROOF_Y - 4.95, 0.02, std({ color: '#333333' }), ax + dx, (ROOF_Y + 4.95) / 2, z);
      }
    }
    // the drone lane joke on the rack ends
    for (const rx of RACK_X) {
      this.sign(['DRONE LANE', '1.9 - 3.4 m'], 1.1, 0.42, rx, 2.6, SEGS[0].z0 + 0.06, 0, { bg: '#f0c419', fg: '#1a1410', border: '#1a1410', font: '"Press Start 2P", monospace' }, 'Brad flies through the racks at head height plus one metre. Do not jump.');
    }
    // column guards at the rack ends facing the corridor and the cross aisle
    const guards = new Batch();
    for (const rx of RACK_X) {
      for (const z of [SEGS[0].z0 + 0.12, SEGS[0].z1 - 0.12, SEGS[1].z0 + 0.12]) {
        guards.add(rx, 0.3, z, 1.26, 0.6, 0.1);
      }
    }
    guards.build(this.scene, unit, std({ map: hazardTex([4, 1]) }));
    // floor letters at the aisle mouths
    for (let a = 0; a < AISLE_X.length; a++) {
      const t = this.floorLetter(LETTERS[a]);
      t.position.set(AISLE_X[a], 0.012, -0.6);
      const t2 = this.floorLetter(LETTERS[a]);
      t2.position.set(AISLE_X[a], 0.012, CROSS_Z);
    }
  }

  /** All bay numbers of one aisle as one mesh with one texture. */
  private bayLabels(a: number): void {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 512;
    const g = c.getContext('2d')!;
    const cw = 128;
    const ch = 512 / 6;
    for (let i = 0; i < 24; i++) {
      const side = i < 12 ? 'W' : 'E';
      const j = i % 12;
      const x = (i % 4) * cw;
      const y = Math.floor(i / 4) * ch;
      g.fillStyle = '#f0c419';
      g.fillRect(x, y, cw, ch);
      g.fillStyle = '#1a1410';
      g.fillRect(x, y, cw, 4);
      g.fillRect(x, y + ch - 4, cw, 4);
      g.font = '30px "Press Start 2P", monospace';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(`${LETTERS[a]}${bayNumber(j, side)}`, x + cw / 2, y + ch / 2 + 2);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    const geos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 24; i++) {
      const side = i < 12 ? 'W' : 'E';
      const j = i % 12;
      const p = new THREE.PlaneGeometry(0.95, 0.32);
      const col = i % 4;
      const row = Math.floor(i / 4);
      const uv = p.attributes.uv as THREE.BufferAttribute;
      for (let k = 0; k < uv.count; k++) {
        const u = uv.getX(k);
        const v = uv.getY(k);
        uv.setXY(k, (col + u) / 4, 1 - (row + 1 - v) / 6);
      }
      p.rotateY(side === 'W' ? Math.PI / 2 : -Math.PI / 2);
      const fx = side === 'W' ? AISLE_X[a] - 1.375 : AISLE_X[a] + 1.375;
      p.translate(fx, CAP_Y, bayZ(j));
      geos.push(p);
    }
    const merged = mergeAll(geos);
    const mesh = new THREE.Mesh(merged, new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.35, roughness: 0.8 }));
    this.scene.add(mesh);
  }

  private floorLetter(letter: string): THREE.Mesh {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const g = c.getContext('2d')!;
    g.fillStyle = 'rgba(230,180,20,0.85)';
    g.font = '44px "Press Start 2P", monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(letter, 32, 36);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 1.6),
      new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, roughness: 0.6 }),
    );
    m.rotation.x = -Math.PI / 2;
    this.scene.add(m);
    return m;
  }

  // ---------------------------------------------------------------- toilet and key

  private toilet(): void {
    this.toiletBooth(BOOTH_X0, BOOTH_Z0, ['KEY: BREAK ROOM', 'on the pallet jack', 'far south-west']);
  }

  private jack(): void {
    const jack = new Item(JACK_DEF);
    jack.state = 'fixed';
    jack.mesh.position.set(JACK_POS.x, jack.baseOffset, JACK_POS.z);
    jack.mesh.rotation.y = 0.5;
    this.scene.add(jack.mesh);
    this.initialItems.push(jack);
  }
}

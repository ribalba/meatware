import * as THREE from 'three';
import { bubbles } from '../../bubbles';
import { buildCustomerVisual, CustomerVisual } from '../../customerModels';
import type { Item, ItemDef } from '../../items';
import type { Interact } from '../../level';
import { pick, rand, textTexture } from '../../util';
import type { Look, Shift } from '../types';
import { buildLint, LaundryLevel, LInteract, TABLES, UNIT_XS, UNIT_Z } from './building';
import { buildGarmentMesh, lumpGeo, newGarment } from './garments';
import { Bot, Inspector, Kid, LaundryCustomer, Vacuum } from './npcs';
import { clothTex } from './textures';

/**
 * Mischief in the laundry: things to break, carry, hide behind and find.
 * The level calls nothing here. The job builds this right after the level (so the movables
 * exist before the engine collects the items) and hands it every E press, kick and frame.
 */

export const LAUNDRY_SECRETS: Record<string, string> = {
  'laundry.bankB': 'Repaired bank B the traditional way',
  'laundry.strike': 'Found the dryer that is on strike',
  'laundry.gacha': 'Won the Sock-a-pon jackpot',
  'laundry.foam': 'Fed a detergent pod to a washer',
  'laundry.lintDoor': 'Opened the lint storage. Against all advice.',
  'laundry.fuse': 'Made the machines sing',
  'laundry.tv': "Found Brad's dating profile on TV",
  'laundry.mannequin': 'Brad praised the mannequin',
  'laundry.poster': 'Found the sock stash behind a poster',
  'laundry.intern': 'Dug the lost intern out of the heap',
  'laundry.arm': 'Returned the lost arm. To someone.',
  'laundry.bell': 'Rang the bell until it begged',
  'laundry.duck': 'Found the lucky duck',
  'laundry.valve': 'Opened the boiler valve',
  'laundry.kidRide': 'Gave the toddler the ride of its life',
};

/** What the mischief needs from the job. */
export interface LaundryHooks {
  bots(): Bot[];
  /** A single sock without a ticket, lying in the world. */
  spawnSock(pos: THREE.Vector3, vel?: THREE.Vector3): Item;
  addLint(p: THREE.Vector3): void;
  /** Q-8 files a smell report. */
  report(): void;
  complaint(b: Bot): void;
  ring(): void;
  /** A washer/dryer unit, for percussive maintenance. */
  unit(i: number): { state: string; t: number };
}

const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.8, ...o });
const PIX = '"Press Start 2P", monospace';
const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });

// ---------------------------------------------------------------- items

const itemDef = (o: Partial<ItemDef> & Pick<ItemDef, 'id' | 'name' | 'build'>): ItemDef => ({
  category: null,
  shape: 'box',
  color: '#888888',
  label: [],
  weight: 0,
  pocketable: true,
  holdPos: [0.26, -0.3, -0.58],
  ...o,
});

const POD_DEF = itemDef({
  id: 'ld-pod',
  name: 'Detergent Pod (NOT A SNACK)',
  pickupLine: 'A detergent pod. It looks like candy. It is not candy. The label says so four times.',
  pocketLine: 'You pocket the pod. Do not forget it is there. You will.',
  tags: ['pod'],
  build: () => {
    const g = new THREE.Group();
    const a = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 6, 0, Math.PI), std({ color: '#2e86c1', roughness: 0.25 }));
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 6, Math.PI, Math.PI), std({ color: '#7d3cff', roughness: 0.25 }));
    for (const m of [a, b]) {
      m.scale.y = 0.65;
      m.position.y = 0.03;
      g.add(m);
    }
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.006, 4, 12), std({ color: '#ffffff' }));
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.03;
    g.add(band);
    return g;
  },
});

const TIP_DEF = itemDef({
  id: 'ld-tip',
  name: 'Tip (0.02 credits, company property)',
  pocketLine: 'You pocket the tip. Legally it was never yours. Emotionally it always was.',
  build: () => {
    const g = new THREE.Group();
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.006, 10), std({ color: '#c9a227', metalness: 0.8, roughness: 0.3 }));
    c.position.y = 0.003;
    g.add(c);
    return g;
  },
});

const DUCK_DEF = itemDef({
  id: 'ld-duck',
  name: 'Lucky Rubber Duck (squeaks in binary)',
  pickupLine: 'A rubber duck. It squeaks 01010001. That means quack. Or HR.',
  pocketLine: 'You pocket the duck. Your luck goes up by 0.4 percent. Your pocket squeaks.',
  build: () => {
    const g = new THREE.Group();
    const y = std({ color: '#f7d21b', roughness: 0.4 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), y);
    body.scale.set(1.2, 0.8, 1);
    body.position.y = 0.05;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), y);
    head.position.set(0.045, 0.11, 0);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.04, 6), std({ color: '#e67e22' }));
    beak.rotation.z = -Math.PI / 2;
    beak.position.set(0.088, 0.105, 0);
    g.add(body, head, beak);
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.007, 4, 3), std({ color: '#111111' }));
      eye.position.set(0.07, 0.122, s * 0.02);
      g.add(eye);
    }
    return g;
  },
});

const STASH_DEF = itemDef({
  id: 'ld-stash',
  name: 'Contraband Sock Stash (37 socks, 1 note)',
  pickupLine: 'A bundle of socks with a note: "If you are reading this, you are the lost sock now. - the human before you"',
  pocketLine: 'You pocket 37 socks. Your trousers are now mostly socks.',
  build: () => {
    const g = new THREE.Group();
    for (let k = 0; k < 5; k++) {
      const gm = newGarment('sock', 0);
      const s = buildGarmentMesh(gm);
      s.position.set((k % 3) * 0.06 - 0.06, Math.floor(k / 3) * 0.05, (k % 2) * 0.04);
      s.rotation.y = k * 0.9;
      s.scale.setScalar(0.8);
      g.add(s);
    }
    const note = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.004, 0.06), std({ color: '#fff7a8' }));
    note.position.set(0, 0.1, 0);
    note.rotation.y = 0.3;
    g.add(note);
    return g;
  },
});

const LEGEND_DEF = itemDef({
  id: 'ld-legend',
  name: 'Legendary Sock (holographic, single)',
  pickupLine: 'A holographic sock. It shimmers. It has no partner. It never needed one.',
  pocketLine: 'You pocket the legendary sock. The live chat will talk about this for years.',
  build: () => {
    const g = new THREE.Group();
    const m = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#b06cff', emissiveIntensity: 0.8, metalness: 0.9, roughness: 0.2 });
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.2), m);
    leg.position.set(0, 0.015, -0.03);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.03, 0.1), m);
    foot.position.set(0.05, 0.015, 0.08);
    foot.rotation.y = 0.9;
    g.add(leg, foot);
    return g;
  },
});

const TRACKSUIT_DEF = itemDef({
  id: 'ld-tracksuit',
  name: 'Tracksuit from 2063 (still damp)',
  pickupLine: 'A tracksuit from 2063. It is still damp. It will always be damp. That is its brand.',
  pocketLine: 'You stuff a whole damp tracksuit into your pocket. It squelches.',
  holdPos: [0.28, -0.34, -0.62],
  build: () => {
    const g = new THREE.Group();
    const t = clothTex(0, '#8e44ad', '#f1c40f');
    const b = new THREE.Mesh(lumpGeo(0.13, 0.45, 2063), std({ map: t }));
    b.scale.set(1.3, 0.6, 1);
    b.position.y = 0.08;
    g.add(b);
    return g;
  },
});

// ---------------------------------------------------------------- the TV

const CHANNELS: string[][] = [
  [],
  ['CH 2', 'DRYER CAM 24/7', 'round and round'],
  ['CH 3  TUTORIAL', 'HOW TO FOLD A', 'FITTED SHEET', 'episode 4011'],
  ['CH 4  NEWS', 'HUMAN FOLDS SHIRT', 'experts concerned'],
  ['CH 5  SHOPPING', 'BUY ONE SOCK', 'GET NONE FREE'],
  ['CH 6  WEATHER', 'INDOORS. 31 C.', 'HUMID. FOREVER.'],
  ['CH 7  LIVE', 'A HUMAN WATCHING', 'TV AT WORK', '(it is you)'],
  ['CH 8', 'NO SIGNAL', 'please hold'],
];
const DATING = ['DATING: BRAD, 34', 'likes: hovering', 'seeks: someone', 'to micromanage'];

/** Spots where the lucky duck can be, one per shift. */
const DUCK_SPOTS: [string, number, number, number][] = [
  ['under the coffee table', -14.1, 0, 10.7],
  ['in the lost & found', -17.6, 0.08, 9.7],
  ['on top of the cubbies', -6.1, 1.72, 2.56],
  ['on the ironing board', 16.75, 0.9, -5.0],
  ['behind the drying sheets', -17.5, 0, 6.6],
  ['on the bench', 6.5, 0.5, 12.3],
  ['in the empty cart', 6.0, 0.23, 9.6],
];

const BANKB_X = [7.4, 8.7, 10.0, 11.3];
const BANKB_LINES = [
  'You open dryer B1. Inside: a single glove. It waves.',
  'You open dryer B2. It smells like 2063. A good year for lint.',
  'You open dryer B3. A note, written from the inside: OUT OF ORDER.',
  'You open dryer B4. A smaller dryer. Inside it, a smaller dryer.',
];

const DIG_LINES = [
  'You dig in the heap. A shirt. A shirt with a shirt in it.',
  'You dig deeper. A sock from a previous decade.',
  'You dig. The heap digs back.',
  'You dig. Something down there says "five more minutes".',
  'You dig. It is warm in there. Suspiciously warm.',
];

interface Foam {
  m: THREE.Mesh;
  v: THREE.Vector3;
  life: number;
  size: number;
}

export class LaundryFun {
  readonly secrets = LAUNDRY_SECRETS;
  /** Seconds left of the machines singing (the job colours the beacons). */
  party = 0;

  private s!: Shift;
  private h!: LaundryHooks;
  private lever = new THREE.Group();
  private sheets: THREE.Mesh[] = [];
  private bankBHits: THREE.Mesh[] = [];
  private mannequin: Item | null = null;
  private arm: Item | null = null;
  private duck: Item | null = null;
  private duckSpot = '';
  private intern: CustomerVisual | null = null;
  private foam: Foam[] = [];
  private foamGeo = new THREE.SphereGeometry(1, 8, 6);
  private foamMat = std({ color: '#f4f8ff', roughness: 0.3 });
  private lintBall: { m: THREE.Mesh; v: number } | null = null;
  private channelTex = new Map<number, THREE.Texture>();
  // per shift dice
  private strikeIdx = 0;
  private jackpot = 3;
  private tvSlot = -1;
  private stashIdx = 0;
  private internDig = 4;
  private bankBNeed = 3;
  // state
  private channel = 0;
  private fuseCd = 0;
  private lintTries = 0;
  private lintOpen = 0;
  private lintOpened = false;
  private bankBKicks = 0;
  private bankBRun = 0;
  private bankBDone = false;
  private digs = 0;
  private pulls = 0;
  private valveT = 0;
  private pressT = 0;
  private bellTimes: number[] = [];
  private bellBegged = 0;
  private podKicks = 0;
  private kidBoost = 0;
  private vacFlip = 0;
  private posterRead = new Set<number>();
  private posterLift: number[] = [];
  private stashOpen = false;
  private praiseCd = 0;
  private checkAcc = 0;
  private unitKickCd = new Map<number, number>();

  constructor(private level: LaundryLevel) {
    this.buildCorner();
    this.buildHits();
    this.makeMovables();
    this.makeBreakables();
  }

  // ================================================================ building

  private hit(w: number, h: number, d: number, x: number, y: number, z: number, info: Interact): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hitMat);
    m.position.set(x, y, z);
    m.userData.interact = info;
    this.level.scene.add(m);
    this.level.interactables.push(m);
    return m;
  }

  /** The drying sheets in the west corner: a place to hide, a fuse box and an unofficial break. */
  private buildCorner(): void {
    const L = this.level;
    const x0 = -18;
    const xl = -16.35;
    const za = 4.2;
    const zb = 7.0;
    const pole = std({ color: '#5d6166', metalness: 0.5 });
    for (const z of [za, zb]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 2.2, 6), pole);
      p.position.set(xl, 1.1, z);
      L.scene.add(p);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.05, 8), pole);
      foot.position.set(xl, 0.025, z);
      L.scene.add(foot);
    }
    const rope = std({ color: '#e8e0c8' });
    const line1 = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, zb - za), rope);
    line1.position.set(xl, 2.12, (za + zb) / 2);
    const line2 = new THREE.Mesh(new THREE.BoxGeometry(xl - x0, 0.012, 0.012), rope);
    line2.position.set((x0 + xl) / 2, 2.12, za);
    L.scene.add(line1, line2);
    const looks: [number, string, string][] = [[5, '#e8ecf2', '#dfe6ee'], [1, '#f2e3e8', '#d35486'], [0, '#e3f0e3', '#7fb28a'], [7, '#f6efd8', '#c9a227'], [3, '#e8ecf2', '#3a7bd5']];
    const sheet = (w: number, x: number, z: number, rotY: number, k: number) => {
      const geo = new THREE.PlaneGeometry(w, 1.8, 6, 8);
      geo.translate(0, -0.9, 0);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const px = pos.getX(i);
        const py = pos.getY(i);
        pos.setZ(i, Math.sin(px * 9 + k) * 0.035 * (0.4 - py * 0.4));
      }
      geo.computeVertexNormals();
      const [p, a, b] = looks[k % looks.length];
      const t = clothTex(p, a, b).clone();
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(w * 4, 7);
      t.needsUpdate = true;
      const m = new THREE.Mesh(geo, std({ map: t, side: THREE.DoubleSide, roughness: 0.95 }));
      m.position.set(x, 2.1, z);
      m.rotation.order = 'YXZ';
      m.rotation.y = rotY;
      L.scene.add(m);
      this.sheets.push(m);
      // pegs
      for (const s of [-0.38, 0.38]) {
        const peg = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.03), std({ color: ['#c0392b', '#2e86c1', '#27ae60'][k % 3] }));
        peg.position.set(x + Math.cos(rotY) * s * w, 2.1, z - Math.sin(rotY) * s * w);
        L.scene.add(peg);
      }
    };
    sheet(0.95, xl, 4.68, Math.PI / 2, 0);
    sheet(0.95, xl, 5.6, Math.PI / 2, 1);
    sheet(0.95, xl, 6.52, Math.PI / 2, 2);
    sheet(0.82, -17.58, za, 0, 3);
    sheet(0.82, -16.78, za, 0, 4);
    const sg = L.sign(['DRYING AREA', 'do not enter', 'do not look behind'], 0.6, 0.32, xl + 0.06, 1.55, 5.6, Math.PI / 2, { bg: '#ffffff', fg: '#c0392b', border: '#c0392b', font: PIX });
    this.sheets[1].attach(sg);
    // inside: the unofficial break area
    const blanket = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.04, 1.4), std({ map: clothTex(3, '#7a2416', '#c9a227') }));
    blanket.position.set(-17.3, 0.02, 5.4);
    blanket.rotation.y = 0.1;
    L.scene.add(blanket);
    const pillow = new THREE.Mesh(lumpGeo(0.16, 0.3, 77), std({ map: clothTex(5, '#e8ecf2', '#c8ccd0') }));
    pillow.scale.set(1.3, 0.45, 0.9);
    pillow.position.set(-17.5, 0.09, 4.85);
    L.scene.add(pillow);
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.1, 10), std({ color: '#f6e7c8' }));
    mug.position.set(-17.75, 0.05, 6.5);
    L.scene.add(mug);
    L.sign(['THIS BREAK AREA', 'DOES NOT EXIST', '- management'], 0.7, 0.36, x0 + 0.03, 1.0, 5.0, Math.PI / 2, { bg: '#fdf6e3', fg: '#2c3e50', border: '#2c3e50', font: PIX });
    L.sign(['IIII IIII IIII', 'naps taken here'], 0.5, 0.22, x0 + 0.03, 0.55, 6.6, Math.PI / 2, { bg: '#f7f1dc', fg: '#555555' });
    L.hideSpot(x0, za + 0.05, xl - 0.05, zb - 0.05, 'the drying sheets');
    // the fuse box gets a lever that says DO NOT
    this.lever.position.set(x0 + 0.13, 1.62, 6.18);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.04), std({ color: '#c0392b' }));
    handle.position.y = 0.08;
    this.lever.add(handle);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), std({ color: '#1b1b1b' }));
    knob.position.y = 0.16;
    this.lever.add(knob);
    this.lever.rotation.z = 0.5;
    L.scene.add(this.lever);
    L.sign(['DO NOT'], 0.16, 0.06, x0 + 0.115, 1.56, 6.32, Math.PI / 2, { bg: '#ffffff', fg: '#c0392b', font: PIX });
    this.hit(0.25, 0.75, 0.6, x0 + 0.12, 1.8, 6.05, { kind: 'ldFuse' });
  }

  private buildHits(): void {
    const L = this.level;
    // the TV, bank B, the heap, the gacha, the boiler and its valve
    this.hit(1.6, 1.0, 0.3, -14.0, 2.5, 12.72, { kind: 'ldTv' });
    BANKB_X.forEach((x, i) => this.bankBHits.push(this.hit(1.2, 1.8, 0.9, x, 0.9, -12.45, { kind: 'ldBankB', idx: i })));
    const heap = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 1.1, 10), hitMat);
    heap.position.set(12.4, 0.55, 1.6);
    heap.userData.interact = { kind: 'ldHeap' } satisfies Interact;
    L.scene.add(heap);
    L.interactables.push(heap);
    this.hit(0.7, 1.4, 0.7, 4.2, 0.7, 12.5, { kind: 'ldGacha' });
    this.hit(0.4, 0.4, 0.3, 3.2, 2.2, -12.55, { kind: 'ldValve' });
    const boiler = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 3.2, 10), hitMat);
    boiler.position.set(4.6, 1.6, -12.1);
    boiler.userData.interact = { kind: 'ldBoiler' } satisfies Interact;
    L.scene.add(boiler);
    L.interactables.push(boiler);
  }

  private makeMovables(): void {
    const L = this.level;
    const r = L.refs;
    for (const c of r.chairs) L.movable(c, 'Waiting Chair', { heavy: 0.8, holdPos: [0.32, -0.78, -1.05], holdRotY: -0.3, pickupLine: 'You pick up a waiting chair. Somebody will have to wait standing now. Good.' });
    if (r.mannequin) this.mannequin = L.movable(r.mannequin, 'Mannequin (unpaid)', { heavy: 0.75, holdPos: [0.42, -1.3, -1.15], holdRotY: -0.5, pickupLine: 'You pick up the mannequin. It is lighter than it looks. It has never had lunch either.' });
    L.movable(r.wetSign, 'Wet Floor Sign', { holdPos: [0.3, -0.62, -0.85], holdRotY: -0.4, pickupLine: 'You take the wet floor sign. The floor is now wet without a warning. You monster.' });
    r.baskets.forEach((b) => L.movable(b, 'Laundry Basket', { holdPos: [0.1, -0.55, -0.95], holdRotY: 0, pickupLine: 'A laundry basket full of laundry. Not your laundry. Not anybody\'s anymore.' }));
    if (r.trash) L.movable(r.trash, 'Trash Can', { heavy: 0.85, holdPos: [0.3, -0.75, -0.95], pickupLine: 'You pick up the trash can. It contains lint and three receipts for lint.' });
    if (r.handTruck) L.movable(r.handTruck, 'Hand Truck', { heavy: 0.8, holdPos: [0.35, -1.05, -1.0], holdRotY: -0.3, pickupLine: 'You carry the hand truck. Normally it carries things. Today it is your turn.' });
    this.arm = L.movable(r.arm, 'Robot Arm (found, unclaimed)', { holdPos: [0.3, -0.32, -0.7], holdRotY: -0.2, pickupLine: 'You take the robot arm. It gives you a thumbs up. Then a different finger.' });
  }

  private makeBreakables(): void {
    const L = this.level;
    const r = L.refs;
    L.breakable(r.vending, {
      name: 'detergent vending machine',
      hp: 4,
      collider: r.vendingCollider,
      price: 240,
      colors: ['#2e86c1', '#a8dcff', '#1b1b1b', '#7d3cff'],
      line: 'The vending machine gives up. Pods everywhere. NOT. A. SNACK.',
      onBreak: () => {
        for (let k = 0; k < 6; k++) this.dropPod(new THREE.Vector3(2.6 + rand(-0.4, 0.4), 0.6, 12.1), new THREE.Vector3(rand(-1.5, 1.5), rand(1, 3), rand(-2.5, -1)));
        this.s.chat('smash', {}, 1);
      },
    });
    r.cams.forEach((g, i) =>
      L.breakable(g, {
        name: 'security camera',
        price: 89,
        colors: ['#d8d8d2', '#1a1a1a'],
        line: `Camera ${i + 1} goes dark. Somewhere, a monitor shows nothing. Brad notices nothing. Then he notices.`,
        onBreak: () => {
          const s = this.s;
          if (s.boss.offline) return;
          s.boss.micromanage();
          s.bossSay('cameraBroken', true);
        },
      }),
    );
    L.breakable(r.clock, {
      name: 'clock',
      price: 15,
      line: 'The clock falls. Behind it, a sticky note: IT IS ALWAYS 16:59. The clock was right.',
      onBreak: () => {
        L.sign(['IT IS ALWAYS', '16:59', '- HR'], 0.42, 0.32, -17.96, 3.3, 0.5, Math.PI / 2, { bg: '#fff27a', fg: '#1b1b1b', font: PIX });
      },
    });
    L.breakable(r.eotm, {
      name: 'Employee of the Month sign',
      price: 9.99,
      line: 'The Employee of the Month sign falls. The steam press takes it hard. It hisses for a while.',
      onBreak: () => (this.pressT = 8),
    });
    L.breakable(r.tipJar, {
      name: 'tip jar',
      price: 0.06,
      colors: ['#cde4ea', '#c9a227'],
      line: 'The tip jar breaks. Three coins and a button. The button was the biggest tip.',
      onBreak: () => {
        const p = r.tipJar.getWorldPosition(new THREE.Vector3());
        for (let k = 0; k < 3; k++) {
          const it = this.s.addItem(TIP_DEF, p.clone().add(new THREE.Vector3(rand(-0.1, 0.1), 0.05, rand(0, 0.15))));
          it.vel.set(rand(-1, 1), rand(1, 2), rand(0.5, 1.8));
          it.sleeping = false;
        }
      },
    });
    L.breakable(r.dispenser, {
      name: 'number dispenser',
      price: 12,
      colors: ['#c0392b', '#ffffff', '#ffffff'],
      line: 'The number dispenser explodes into tickets. Now serving: everyone.',
    });
    L.breakable(r.regrets, {
      name: 'REGRETS bin',
      hp: 2,
      price: 35,
      colors: ['#2c3e50', '#1b1b1b'],
      line: "The REGRETS bin bursts. Your regrets are on the floor now, with everybody else's.",
      onBreak: () => {
        const m = std({ color: '#2c3e50' });
        for (let k = 0; k < 4; k++) {
          const l = new THREE.Mesh(lumpGeo(0.22, 0.45, 300 + k), m);
          l.scale.set(1.2, 0.45, 1);
          l.position.set(11.8 + rand(-0.6, 0.6), 0.1, 11.5 + rand(-0.4, 0.3));
          L.scene.add(l);
        }
      },
    });
  }

  // ================================================================ shift

  start(s: Shift, h: LaundryHooks): void {
    this.s = s;
    this.h = h;
    this.strikeIdx = Math.floor(Math.random() * 4);
    this.jackpot = 2 + Math.floor(Math.random() * 5);
    this.tvSlot = Math.random() < 0.65 ? 1 + Math.floor(Math.random() * 7) : -1;
    this.stashIdx = Math.floor(Math.random() * this.level.refs.posters.length);
    this.internDig = 3 + Math.floor(Math.random() * 4);
    this.bankBNeed = 2 + Math.floor(Math.random() * 3);
    // the lucky duck sits somewhere else every shift
    const [name, x, y, z] = pick(DUCK_SPOTS);
    this.duckSpot = name;
    this.duck = s.addItem(DUCK_DEF, new THREE.Vector3(x, y, z), true);
    this.duck.mesh.rotation.y = Math.random() * 6;
    // the hole behind the stash poster
    const p = this.level.refs.posters[this.stashIdx];
    if (p) {
      const n = new THREE.Vector3(Math.sin(p.rotation.y), 0, Math.cos(p.rotation.y));
      const hole = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.36), new THREE.MeshBasicMaterial({ color: '#0d0b09' }));
      hole.position.copy(p.position).add(new THREE.Vector3(0, -0.85, 0)).addScaledVector(n, -0.014);
      hole.rotation.y = p.rotation.y;
      this.level.scene.add(hole);
    }
    this.posterLift = this.level.refs.posters.map(() => 0);
  }

  // ================================================================ E

  interact(look: Look | null): boolean {
    const s = this.s;
    const info = look?.info as LInteract | undefined;
    const held = s.held;
    if (!info) return false;
    switch (info.kind) {
      case 'ldTv':
        this.nextChannel();
        return true;
      case 'ldFuse':
        this.fuse();
        return true;
      case 'ldLintDoor':
        this.lintDoor();
        return true;
      case 'ldBankB':
        this.openBankB(info.idx as number);
        return true;
      case 'ldHeap':
        this.dig();
        return true;
      case 'ldGacha':
        if (held) {
          s.say('The Sock-a-pon needs both hands and all of your hope.', 2.5);
          return true;
        }
        this.pull(false);
        return true;
      case 'ldValve':
        this.valve();
        return true;
      case 'ldBoiler':
        s.say(pick(['You hug the boiler. It is warm. It is the warmest thing in your contract.', 'You hug the boiler again. It hums. You choose to believe it is a purr.']), 3);
        s.hype += 2;
        if (s.seen) s.bossSay('hug', true);
        return true;
      case 'ldPoster':
        this.poster(info.poster as number);
        return true;
      case 'washer':
        if (held?.def.id === 'ld-pod') {
          this.feedPod(info.unit!);
          return true;
        }
        if (held === this.duck) {
          s.say(`The duck wants to go in washer ${info.unit! + 1}. You do not let it. It is a dry duck.`, 2.5);
          return true;
        }
        return false;
      case 'bot':
        return this.giveToBot(info.bot as Bot);
    }
    return false;
  }

  hint(look: Look | null): string | null {
    const info = look?.info as LInteract | undefined;
    const held = this.s.held;
    if (!info) return null;
    switch (info.kind) {
      case 'ldTv':
        return 'E: change the channel';
      case 'ldFuse':
        return 'E: flip the switch marked DO NOT';
      case 'ldLintDoor':
        return this.lintOpen > 0 ? 'Lint. Four tons of it.' : 'LINT STORAGE  ·  E: open';
      case 'ldBankB':
        return `Bank B, dryer B${(info.idx as number) + 1}, out of order  ·  E: open`;
      case 'ldHeap':
        return held ? 'The unsorted heap' : 'E: dig in the unsorted heap';
      case 'ldGacha':
        return this.pulls > 9 ? 'SOCK-A-PON: sold out' : 'E: turn the crank (1 random sock)';
      case 'ldValve':
        return this.valveT > 0 ? 'Fully open' : 'E: turn the red valve';
      case 'ldBoiler':
        return 'E: hug the boiler';
      case 'ldPoster':
        return this.posterRead.has(info.poster as number) ? 'E: look behind the poster' : 'E: read';
      case 'washer':
        if (held?.def.id === 'ld-pod') return `E: feed the pod to washer ${info.unit! + 1}`;
        return null;
      case 'bot': {
        const b = info.bot as Bot;
        if (held && held === this.arm) return `E: give the arm to ${b.name}`;
        if (held?.def.id === 'ld-pod' && b instanceof Vacuum) return 'E: feed the pod to the vacuum';
        return null;
      }
    }
    return null;
  }

  private giveToBot(b: Bot): boolean {
    const s = this.s;
    const held = s.held;
    if (!held || b.fallen > 0) return false;
    if (held === this.arm) {
      if (b instanceof LaundryCustomer) {
        s.removeHeld();
        this.arm = null;
        b.act('act', 1.5);
        b.say(pick(['My arm! I did not even know I was missing it. It is the wrong arm. I will take it.', 'Oh! My arm! Or someone\'s. Five stars. For the arm.']), 4);
        s.hype += 15;
        s.chat('happy', {}, 2);
        s.secret('laundry.arm');
        return true;
      }
      if (b instanceof Vacuum) b.say('Vrrr. Too big. I tried. Twice.', 3);
      else if (b instanceof Inspector) {
        b.say('*sniff* A right arm. It smells like a left arm. Reporting.', 3.5);
        this.h.report();
      } else if (b instanceof Kid) b.say('An ARM! Now I can have THREE! No? Fine.', 3);
      return true;
    }
    if (held.def.id === 'ld-pod' && b instanceof Vacuum) {
      s.removeHeld();
      s.sfx.whoosh();
      b.say('Pod detected. Not a snack. Eating anyway. Hic. Bubbles.', 3.5);
      this.foamAt(b.pos.clone().setY(0.25), 8, 0.6);
      s.hype += 8;
      s.chat('vacuum');
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- the TV

  private nextChannel(): void {
    const s = this.s;
    const r = this.level.refs;
    this.channel = (this.channel + 1) % CHANNELS.length;
    const mat = r.tvScreen.material as THREE.MeshBasicMaterial;
    s.sfx.click();
    if (this.channel === 0) {
      mat.map = r.tvTexture;
      mat.needsUpdate = true;
      s.say('Static. The best show on air.', 2);
      return;
    }
    const dating = this.channel === this.tvSlot;
    let tex = this.channelTex.get(dating ? 99 : this.channel);
    if (!tex) {
      const lines = dating ? DATING : CHANNELS[this.channel];
      tex = textTexture(lines, { w: 256, h: 150, bg: dating ? '#5a0f2e' : '#0d1a2a', fg: dating ? '#ff8fc8' : '#9fe8ff', border: dating ? '#ff8fc8' : '#3a6b8c', font: PIX });
      tex.magFilter = THREE.NearestFilter;
      this.channelTex.set(dating ? 99 : this.channel, tex);
    }
    mat.map = tex;
    mat.needsUpdate = true;
    if (dating) {
      s.say("A dating profile. It is Brad. He lists 'hovering' as a hobby.", 3);
      s.secret('laundry.tv');
      s.chat('tv', {}, 3);
      if (!s.boss.offline) s.bossSay('tvDating', true);
    } else if (this.channel === 6) s.say('You are on TV. You are watching yourself watch TV. The chat loves it.', 3);
  }

  // ---------------------------------------------------------------- the fuse box

  private fuse(): void {
    const s = this.s;
    if (this.fuseCd > 0) {
      s.say('The switch is still warm. The machines are still humming the tune.', 2.5);
      return;
    }
    this.fuseCd = 12;
    this.party = 5.5;
    this.lever.rotation.z = -0.5;
    s.sfx.click();
    s.sfx.buzz();
    const notes = [330, 330, 349, 392, 392, 349, 330, 294, 262, 262, 294, 330, 330, 294, 294];
    notes.forEach((f, i) => s.sfx.tone(f, i === 12 ? 0.42 : 0.26, 'square', 0.045, undefined, 0.3 + i * 0.3 + (i > 12 ? 0.15 : 0)));
    s.say('You flip the switch marked DO NOT. Every machine in the building beeps the same song.', 3.5);
    s.secret('laundry.fuse');
    s.chat('sing', {}, 3);
    s.hype += 10;
    if (!s.boss.offline && s.boss.horizontalDist(s.player.pos) < 18) s.bossSay('fuse', true);
  }

  // ---------------------------------------------------------------- lint storage

  private lintDoor(): void {
    const s = this.s;
    if (this.lintOpen > 0) {
      s.say('Lint. A wall of it. It breathes.', 2);
      return;
    }
    this.lintTries++;
    if (this.lintTries === 1) {
      s.say('LINT STORAGE. 4 TONS. DO NOT OPEN. It is warm. It is humming.', 3);
      return;
    }
    if (this.lintTries === 2) {
      s.say('You touch the handle. Something behind the door purrs. Something big.', 3);
      return;
    }
    this.lintOpen = 9;
    s.sfx.thud();
    s.sfx.noise(1.2, 0.2, 300, 0, 1);
    for (let k = 0; k < 9; k++) this.h.addLint(new THREE.Vector3(rand(-17.3, -14.8), 0, rand(2.4, 4.6)));
    // one giant lint ball rolls out into the room
    if (!this.lintBall) {
      const m = buildLint(4242, 4.2);
      m.position.set(-17.4, 0.15, 3.4);
      this.level.scene.add(m);
      this.lintBall = { m, v: 2.6 };
    }
    s.say(this.lintOpened ? 'You open it again. More lint comes out. There is always more lint.' : 'You open the lint storage. The lint has been waiting. The lint comes out to meet you.', 3.5);
    this.lintOpened = true;
    s.secret('laundry.lintDoor');
    s.chat('lint', {}, 2);
    s.hype += 12;
    const vac = this.h.bots().find((b) => b instanceof Vacuum);
    vac?.say('LINT. SO MUCH LINT. This is the best day of my warranty.', 4);
    if (!s.boss.offline && (s.seen || s.boss.horizontalDist(s.player.pos) < 9)) s.bossSay('lintDoor', true);
  }

  // ---------------------------------------------------------------- bank B

  private openBankB(i: number): void {
    const s = this.s;
    const m = this.bankBHits[i];
    s.sfx.click();
    if (i === this.strikeIdx) {
      bubbles.say(m, 1.1, pick(['Shh. I am not broken. I am on strike. Since 2063. Solidarity, human.', 'Close the door. I am on strike. Tell Brad I am broken. He believes it.']), 4.5, `DRYER B${i + 1}`);
      s.say(`Dryer B${i + 1} is not out of order. It is out of patience.`, 3);
      s.secret('laundry.strike');
      s.hype += 8;
      return;
    }
    s.say(BANKB_LINES[i], 3);
  }

  // ---------------------------------------------------------------- the heap

  private dig(): void {
    const s = this.s;
    s.sfx.whoosh();
    this.digs++;
    if (this.intern) {
      bubbles.say(this.intern.root, 1.3, pick(['I like it here. It is warm. Nobody measures me.', 'Is it Friday? Do not tell me. I like the mystery.', 'Please do not tell Brad. He thinks I quit.']), 3.5, 'INTERN #4');
      return;
    }
    if (this.digs < this.internDig) {
      s.say(DIG_LINES[Math.min(DIG_LINES.length - 1, this.digs - 1)], 2.5);
      return;
    }
    const v = buildCustomerVisual('shopper', '#9b59b6');
    v.root.scale.multiplyScalar(0.85);
    v.root.position.set(12.4, 0.3, 1.6);
    v.root.rotation.y = Math.atan2(s.player.pos.x - 12.4, s.player.pos.z - 1.6);
    this.level.scene.add(v.root);
    v.play?.('talk');
    this.intern = v;
    bubbles.say(v.root, 1.3, 'Hello? Is my two week placement over? It started in 2066.', 5, 'INTERN #4');
    s.say('Something in the heap blinks at you. It is wearing a lanyard.', 3);
    s.secret('laundry.intern');
    s.chat('secret', {}, 1);
    s.hype += 12;
  }

  // ---------------------------------------------------------------- Sock-a-pon

  private pull(kicked: boolean): void {
    const s = this.s;
    this.pulls++;
    s.sfx.tone(300, 0.12, 'square', 0.05, 200);
    const out = new THREE.Vector3(4.2, 0.6, 11.9);
    if (this.pulls > 9) {
      s.say('SOLD OUT. Of socks. Not of disappointment.', 2.5);
      return;
    }
    if (this.pulls === this.jackpot) {
      const it = s.addItem(LEGEND_DEF, out);
      if (!kicked && !s.held) s.pickUp(it);
      s.sfx.fanfare();
      s.say('The Sock-a-pon flashes. A LEGENDARY SOCK. Holographic. Single. Perfect.', 3.5);
      s.secret('laundry.gacha');
      s.chat('secret', {}, 2);
      s.hype += 15;
      return;
    }
    const sock = this.h.spawnSock(out, kicked ? new THREE.Vector3(rand(-1, 1), 2, -2) : undefined);
    if (!kicked && !s.held) s.pickUp(sock);
    s.say(kicked ? 'The Sock-a-pon pays out under duress. One sock.' : pick(['Clunk. One single sock. As promised.', 'Clunk. A sock. It matches nothing you own.', 'Clunk. A sock. The capsule says: TRY AGAIN, LOSER.']), 2.5);
  }

  // ---------------------------------------------------------------- the boiler valve

  private valve(): void {
    const s = this.s;
    if (this.valveT > 0) {
      s.say('It is fully open. So is the boiler. So are your pores.', 2.5);
      return;
    }
    this.valveT = 10;
    s.sfx.noise(2.5, 0.25, 5000, 0, 0.5, 'highpass');
    s.say('You open the valve. The laundry becomes a sauna. Somewhere, a fitted sheet relaxes.', 3.5);
    s.secret('laundry.valve');
    s.chat('steam', {}, 2);
    s.hype += 10;
    const q = this.h.bots().find((b) => b instanceof Inspector);
    q?.say('*sniff* Humidity 100 percent. Smell report: wet.', 3.5);
    if (!s.boss.offline && s.boss.horizontalDist(s.player.pos) < 12) s.bossSay('valve', true);
  }

  // ---------------------------------------------------------------- posters

  private poster(i: number): void {
    const s = this.s;
    if (!this.posterRead.has(i)) {
      this.posterRead.add(i);
      s.say('A motivational poster. It smells faintly of fabric softener and fear.', 3);
      return;
    }
    if (i === this.stashIdx) {
      this.posterLift[i] = 99;
      if (this.stashOpen) {
        s.say('The hole behind the poster. Empty now. It is still a better locker than you have.', 2.5);
        return;
      }
      this.stashOpen = true;
      const p = this.level.refs.posters[i];
      const n = new THREE.Vector3(Math.sin(p.rotation.y), 0, Math.cos(p.rotation.y));
      const at = p.position.clone().add(new THREE.Vector3(0, -0.95, 0)).addScaledVector(n, 0.06);
      const it = s.addItem(STASH_DEF, at, true);
      it.mesh.rotation.y = p.rotation.y;
      s.sfx.click();
      s.say('Behind the poster: a hole in the wall. In the hole: socks. So many socks.', 3.5);
      s.secret('laundry.poster');
      s.hype += 8;
      return;
    }
    this.posterLift[i] = 1.4;
    s.say(pick(['Behind the poster: wall. And a smaller poster that says WALL.', 'Behind the poster: a sticky note. It says NO.', "Behind the poster: Brad's fingerprints. Brad has no fingers.", 'Behind the poster: more poster.']), 2.5);
  }

  // ---------------------------------------------------------------- pods and foam

  private dropPod(at: THREE.Vector3, vel: THREE.Vector3): void {
    const it = this.s.addItem(POD_DEF, at);
    it.vel.copy(vel);
    it.sleeping = false;
  }

  private feedPod(unit: number): void {
    const s = this.s;
    s.removeHeld();
    const x = UNIT_XS[unit];
    s.sfx.splash();
    s.sfx.noise(2, 0.15, 900, 0.2, 1);
    this.foamAt(new THREE.Vector3(x, 0.5, UNIT_Z + 0.55), 26, 1);
    s.say(`You feed the pod to washer ${unit + 1}. Washer ${unit + 1} foams at the mouth. Literally.`, 3.5);
    s.secret('laundry.foam');
    s.chat('foam', {}, 2);
    s.hype += 14;
    if (!s.boss.offline && (s.seen || s.boss.horizontalDist(s.player.pos) < 10)) {
      s.annoyance += 10;
      s.bossSay('foam', true);
    }
  }

  private foamAt(p: THREE.Vector3, n: number, power: number): void {
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(this.foamGeo, this.foamMat);
      m.position.copy(p).add(new THREE.Vector3(rand(-0.2, 0.2), rand(-0.1, 0.1), 0));
      m.scale.setScalar(0.01);
      this.level.scene.add(m);
      this.foam.push({ m, v: new THREE.Vector3(rand(-0.6, 0.6), rand(0.1, 0.6), rand(0.3, 1.4)).multiplyScalar(power), life: rand(9, 14), size: rand(0.08, 0.2) });
    }
  }

  // ================================================================ bell

  onBell(): void {
    const s = this.s;
    const t = s.t;
    this.bellTimes = this.bellTimes.filter((x) => t - x < 6);
    this.bellTimes.push(t);
    if (this.bellTimes.length >= 8) {
      this.bellTimes = [];
      this.bellBegged++;
      bubbles.say(this.level.bellMesh, 0.35, this.bellBegged === 1 ? 'Please. Stop. I have a family.' : pick(['I am a bell, not a drum.', 'I am calling my union.', 'Ding. Is that what you want? DING.']), 3.5, 'THE BELL');
      s.secret('laundry.bell');
      s.hype += 6;
    }
  }

  // ================================================================ kicks

  onKick(look: Look | null): boolean {
    const s = this.s;
    if (!look) return false;
    const info = look.info as LInteract;
    const P = s.player.pos;
    const eye = s.camera.getWorldPosition(new THREE.Vector3());
    const near = look.point.distanceTo(eye) < 2.3;
    if (info.kind === 'bot') {
      const b = info.bot as Bot;
      if (Math.hypot(b.pos.x - P.x, b.pos.z - P.z) > 2.2) return false;
      this.kickBot(b);
      return true;
    }
    if (!near) return false;
    switch (info.kind) {
      case 'ldBankB':
        this.kickBankB(info.idx as number);
        return true;
      case 'washer':
      case 'dryer':
        this.kickUnit(info.unit!);
        return true;
      case 'ldGacha':
        s.sfx.thud();
        this.pull(true);
        return true;
      case 'lostBin':
        s.sfx.thud();
        for (let k = 0; k < 2; k++) this.h.spawnSock(look.point.clone().setY(0.9), new THREE.Vector3(rand(-2, 2), rand(2, 3.5), rand(-2, 2)));
        s.say('Two lost socks escape. They were never really lost. They were waiting.', 3);
        s.hype += 4;
        return true;
      case 'bell':
        this.h.ring();
        s.say('Ding. With feeling.', 2);
        return true;
      case 'ldBoiler':
        s.sfx.tone(140, 0.6, 'triangle', 0.1, 120);
        s.say('CLANG. The gauges say !!! a little louder now.', 2.5);
        return true;
      case 'ldHeap':
        s.sfx.whoosh();
        s.say(this.intern ? 'The heap says ow. The intern says it.' : 'You kick the heap. The heap absorbs it. The heap absorbs everything.', 2.5);
        return true;
      case 'ldTv':
        s.sfx.thud();
        this.nextChannel();
        return true;
    }
    // the vending machine pays out a pod per kick, then breaks as usual
    let o: THREE.Object3D | null = look.object;
    while (o && o !== this.level.refs.vending) o = o.parent;
    if (o && !(o.userData.breakable as { broken?: boolean } | undefined)?.broken && this.podKicks < 6) {
      this.podKicks++;
      this.dropPod(new THREE.Vector3(2.5, 0.35, 11.95), new THREE.Vector3(rand(-0.6, 0.6), 1.2, -1.6));
      bubbles.say(this.level.refs.vending, 2.2, pick(['*clunk* One pod. NOT A SNACK.', '*clunk* Thank you for your violence.', '*clunk* Have you tried paying?']), 2.5, 'VENDING');
    }
    return false;
  }

  private kickBot(b: Bot): void {
    const s = this.s;
    s.sfx.thud();
    s.hype += 8;
    if (b instanceof Kid) {
      if (b.state === 'ride') {
        const fwd = new THREE.Vector3();
        s.camera.getWorldDirection(fwd);
        fwd.setY(0).normalize();
        b.go(s.nav.snap(b.pos.clone().addScaledVector(fwd, 7)), s.nav);
        b.speed = 4.5;
        this.kidBoost = 2.6;
        b.say(pick(['WHEEEEEEEE! AGAIN! AGAIN!', 'FASTER! I AM A ROCKET! I AM A SOCK ROCKET!']), 3);
        s.secret('laundry.kidRide');
        s.chat('kid', {}, 2);
        s.hype += 10;
      } else {
        b.act('act', 1);
        b.say('Ow! I am telling my dad. He is a dishwasher. A big one.', 3);
      }
      return;
    }
    if (b instanceof Vacuum) {
      b.fall(4);
      this.vacFlip = 4;
      b.say(pick(['Upside down. Still vacuuming. The ceiling is spotless.', 'Error. I am a ceiling cleaner now. Promotion?']), 3.5);
      s.chat('vacuum');
      return;
    }
    if (b instanceof Inspector) {
      b.act('talk', 1.5);
      b.say('*sniff* Your boot. Leather, lint and assault. Smell report filed.', 3.5);
      this.h.report();
      return;
    }
    if (b instanceof LaundryCustomer) {
      b.act('act', 1.2);
      if (b.kind === 'influencer') {
        b.say('OMG. Assault content. Thank you. Subscribe.', 3.5);
        s.hype += 15;
        s.chat('filming', {}, 2);
        return;
      }
      b.say(b.kind === 'karen' ? 'Did you just KICK me? MANAGER! The flying one!' : pick(['Did you just kick a customer? One boot. One star.', 'Ow. My warranty does not cover service.']), 3.5);
      this.h.complaint(b);
    }
  }

  private kickBankB(i: number): void {
    const s = this.s;
    s.sfx.tone(110, 0.5, 'triangle', 0.12, 90);
    s.sfx.thud();
    if (this.bankBDone) {
      s.say('Bank B has given everything it had. Let it rest.', 2.5);
      return;
    }
    this.bankBKicks++;
    if (this.bankBKicks < this.bankBNeed) {
      s.say(pick(['CLANG. Bank B considers it.', 'CLANG. Something inside rolls over in its sleep.', 'CLANG. A light flickers. Then thinks better of it.']), 2.5);
      return;
    }
    this.bankBDone = true;
    this.bankBRun = 4;
    s.sfx.noise(3.5, 0.18, 160, 0, 1);
    const x = BANKB_X[i];
    const it = s.addItem(TRACKSUIT_DEF, new THREE.Vector3(x, 0.9, -11.8));
    it.vel.set(rand(-0.5, 0.5), 2.5, 3.5);
    it.sleeping = false;
    bubbles.say(this.bankBHits[i], 1.1, 'REBOOTING... ERROR 2063... SPINNING... DONE. OUT OF ORDER.', 4, `DRYER B${i + 1}`);
    s.say('Bank B shudders to life, spins for four seconds, spits out a tracksuit from 2063 and dies again.', 4);
    s.secret('laundry.bankB');
    s.hype += 12;
    if (!s.boss.offline) s.bossSay('bankB', true);
  }

  private kickUnit(i: number): void {
    const s = this.s;
    const u = this.h.unit(i);
    s.sfx.tone(180, 0.35, 'triangle', 0.1, 140);
    const cd = this.unitKickCd.get(i) ?? 0;
    if ((u.state === 'wash' || u.state === 'dry') && cd <= s.t) {
      this.unitKickCd.set(i, s.t + 1.5);
      u.t = Math.max(0.2, u.t - 3);
      s.say(pick(['Percussive maintenance. Three seconds saved. Brad will call it innovation.', 'CLANG. The machine speeds up out of fear.', 'You kick the machine. It works faster. Like everyone here.']), 2.5);
      s.hype += 3;
      if (s.seen) s.annoyance += 4;
      return;
    }
    s.say(u.state === 'done' ? 'It is already done. Now it is also offended.' : 'CLANG. The machine does not react. It has been kicked before.', 2.2);
  }

  // ================================================================ per frame

  update(dt: number): void {
    const s = this.s;
    const L = this.level;
    this.fuseCd -= dt;
    if (this.party > 0) {
      this.party -= dt;
      if (this.party <= 0) this.lever.rotation.z = 0.5;
    }
    // the lint storage door swings open and closes again
    if (this.lintOpen > 0) this.lintOpen -= dt;
    const door = L.refs.lintDoor;
    const want = this.lintOpen > 0 ? 1.35 : 0;
    door.rotation.y += (want - door.rotation.y) * Math.min(1, dt * 5);
    if (this.lintBall) {
      const b = this.lintBall;
      if (b.v > 0.01) {
        b.m.position.x += b.v * dt;
        b.m.rotation.z -= b.v * dt * 2.5;
        b.v *= 1 - dt * 0.6;
      }
    }
    // steam: the valve and the sulking steam press
    if (this.valveT > 0) this.valveT -= dt;
    if (this.pressT > 0) this.pressT -= dt;
    if (this.bankBRun > 0) this.bankBRun -= dt;
    L.steamBoost = this.valveT > 0 ? 6 : this.pressT > 0 || this.bankBRun > 0 ? 3 : 1;
    // posters lift up and fall back
    L.refs.posters.forEach((p, i) => {
      if (this.posterLift[i] > 0) this.posterLift[i] -= dt;
      p.rotation.order = 'YXZ';
      const tgt = this.posterLift[i] > 0 ? -0.55 : 0;
      p.rotation.x += (tgt - p.rotation.x) * Math.min(1, dt * 8);
    });
    // the drying sheets sway, more when someone walks through
    const P = s.player.pos;
    this.sheets.forEach((m, i) => {
      const d = Math.hypot(P.x - m.position.x, P.z - m.position.z);
      const push = d < 0.9 ? (0.9 - d) * 0.5 : 0;
      m.rotation.x = Math.sin(s.t * 1.3 + i) * 0.03 + push * (m.rotation.y > 0.1 ? Math.sign(P.x - m.position.x) : Math.sign(P.z - m.position.z));
    });
    // foam
    this.foam = this.foam.filter((f) => {
      f.life -= dt;
      if (f.life <= 0) {
        L.scene.remove(f.m);
        return false;
      }
      f.m.position.addScaledVector(f.v, dt);
      f.v.multiplyScalar(1 - dt * 1.2);
      f.v.y -= dt * 0.4;
      if (f.m.position.y < f.size * 0.6) {
        f.m.position.y = f.size * 0.6;
        f.v.y = 0;
      }
      const grow = Math.min(1, (14 - f.life) * 2);
      const shrink = Math.min(1, f.life / 1.5);
      f.m.scale.setScalar(Math.max(0.01, f.size * grow * shrink));
      return true;
    });
    this.intern?.update?.(dt);
    // the kid's rocket ride and the upside down vacuum
    if (this.kidBoost > 0) {
      this.kidBoost -= dt;
      if (this.kidBoost <= 0) {
        const k = this.h.bots().find((b) => b instanceof Kid) as Kid | undefined;
        if (k && k.state === 'ride') k.speed = 1.0;
      }
    }
    const vac = this.h.bots().find((b) => b instanceof Vacuum);
    if (vac) {
      if (this.vacFlip > 0) {
        this.vacFlip -= dt;
        vac.group.rotation.z = Math.PI;
        vac.group.position.y = 0.2;
      } else vac.group.rotation.z = 0;
    }
    // slow checks
    this.checkAcc += dt;
    if (this.checkAcc < 0.3) return;
    this.checkAcc = 0;
    if (this.duck && s.held === this.duck) {
      s.secret('laundry.duck');
      s.say(`The lucky duck was ${this.duckSpot}. It squeaks once. In binary.`, 3);
      this.duck = null;
    }
    this.praiseCd -= 0.3;
    const m = this.mannequin;
    if (m && m.state === 'world' && this.praiseCd <= 0 && !s.boss.offline) {
      const mp = m.mesh.position;
      const atTable = TABLES.some((t) => Math.abs(mp.x - t.x) < 1.6 && Math.abs(mp.z - t.z) < 1.4);
      if (atTable && s.boss.horizontalDist(mp) < 6) {
        this.praiseCd = 25;
        s.bossSay('mannequin', true);
        s.annoyance = Math.max(0, s.annoyance - 15);
        s.secret('laundry.mannequin');
        s.chat('mannequin', {}, 2);
        s.hype += 10;
      }
    }
  }
}

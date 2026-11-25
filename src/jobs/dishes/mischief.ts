import * as THREE from 'three';
import { instantiate } from '../../assets';
import { bubbles } from '../../bubbles';
import type { Item, ItemDef } from '../../items';
import type { Interact } from '../../level';
import { aabb, pick, rand } from '../../util';
import type { Look, Shift } from '../types';
import { Fx, sounds } from './fx';
import { HATCH, Kitchen } from './kitchen';
import type { Bot } from './robots';
import { wallTileTex } from './textures';

/**
 * Mischief in the kitchen of Le Robot Gourmand: things to break, carry, hide behind and find.
 * The job builds this right after the kitchen (so the movables exist before the engine collects
 * the items) and hands it every E press, kick and frame.
 */

export const DISHES_SECRETS: Record<string, string> = {
  'dishes.gerald': 'Found Gerald',
  'dishes.lobster': 'Caught the escaped lobster',
  'dishes.washBread': 'Washed the decorative bread roll',
  'dishes.rain': 'Made it rain indoors',
  'dishes.espresso': 'Gave the chef an espresso',
  'dishes.dance': 'Made the chef dance',
  'dishes.passBell': 'Summoned the waiter for nothing',
  'dishes.fryer': 'Deep fried something that is not food',
  'dishes.spoon': "Found Gerald's golden spoon",
  'dishes.phone': 'Answered the restaurant phone',
  'dishes.message': 'Read the message in the sauce',
  'dishes.maman': 'Reunited the chef with his mother',
  'dishes.record': "Beat Gerald's breakage record",
  'dishes.toque': "Kicked the chef's toque off",
  'dishes.coldroom': 'Found the cold room behind the strips',
};

/** What the mischief needs from the job. */
export interface DishesHooks {
  chef(): Bot;
  waiter(): Bot;
  somm(): Bot;
  vac(): Bot;
  topple(): void;
  pileSize(): number;
  broken(): number;
  /** Many dishes broke at once (the plate tower). */
  addBroken(n: number, at: THREE.Vector3): void;
  /** Kicks the dishwasher. Returns true if it was washing (and is now faster). */
  kickWasher(): boolean;
  /** The chef throws a pot soon. */
  angerChef(): void;
  waiterCartLoaded(): boolean;
  /** Deletes the held item (and forgets it in the dish bookkeeping). */
  consumeHeld(): boolean;
}

const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.7, ...o });
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
  holdPos: [0.26, -0.3, -0.6],
  ...o,
});

/** A small red robot lobster. */
function buildLobster(): THREE.Group {
  const g = new THREE.Group();
  const red = std({ color: '#c0392b', metalness: 0.4, roughness: 0.45 });
  const dark = std({ color: '#7a1a12', metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.13), red);
  body.position.set(0, 0.06, 0);
  g.add(body);
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.075 - i * 0.012, 0.04, 0.045), i % 2 ? dark : red);
    seg.position.set(0, 0.055 - i * 0.008, 0.085 + i * 0.04);
    g.add(seg);
  }
  const fan = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.012, 0.04), dark);
  fan.position.set(0, 0.035, 0.21);
  g.add(fan);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.08), red);
    arm.position.set(s * 0.06, 0.07, -0.08);
    arm.rotation.y = s * 0.4;
    g.add(arm);
    const claw = new THREE.Group();
    claw.position.set(s * 0.085, 0.075, -0.14);
    const big = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.03, 0.07), red);
    claw.add(big);
    const pin = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.02, 0.05), dark);
    pin.position.set(-s * 0.02, 0, -0.045);
    pin.name = 'pincer';
    claw.add(pin);
    claw.name = 'claw';
    g.add(claw);
    for (let k = 0; k < 3; k++) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.008, 0.008), dark);
      leg.geometry.translate(s * 0.03, 0, 0);
      leg.position.set(s * 0.045, 0.045, -0.03 + k * 0.035);
      leg.rotation.z = s * -0.5;
      leg.name = 'leg';
      g.add(leg);
    }
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.18, 4), dark);
    ant.position.set(s * 0.02, 0.12, -0.12);
    ant.rotation.x = -0.9;
    ant.rotation.z = s * 0.3;
    g.add(ant);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.009, 5, 4), new THREE.MeshBasicMaterial({ color: '#ffe14d' }));
    eye.position.set(s * 0.025, 0.095, -0.06);
    g.add(eye);
  }
  g.scale.setScalar(1.5);
  return g;
}

const LOBSTER_DEF = itemDef({
  id: 'dw-lobster',
  name: 'Robo-Lobster (decorative, furious)',
  holdPos: [0.26, -0.3, -0.55],
  pickupLine: 'You catch the lobster. It clicks at you in a way that is clearly a legal threat.',
  pocketLine: 'You pocket the lobster. Your pocket now pinches back.',
  build: buildLobster,
});

const SPOON_DEF = itemDef({
  id: 'dw-spoon',
  name: 'Golden Spoon (engraved GERALD)',
  pickupLine: 'A golden spoon. Engraved: GERALD, 41 PLATES, NEVER FORGET.',
  pocketLine: 'You pocket the golden spoon. Gerald would have wanted that. Gerald would have wanted it himself.',
  build: () => {
    const g = new THREE.Group();
    const gold = std({ color: '#e8c04a', metalness: 0.9, roughness: 0.2, emissive: '#3a2a00' });
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.008, 0.16), gold);
    handle.position.set(0, 0.006, 0.03);
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), gold);
    bowl.scale.set(1, 0.35, 1.3);
    bowl.position.set(0, 0.01, -0.07);
    g.add(handle, bowl);
    return g;
  },
});

const ESPRESSO_DEF = itemDef({
  id: 'dw-espresso',
  name: 'Espresso (chef only)',
  pickupLine: 'An espresso. Tiny. Strong. Not for you. The cup says CHEF in three languages.',
  pocketLine: 'You pocket a full espresso. Your trousers are now caffeinated.',
  build: () => {
    const g = new THREE.Group();
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.028, 0.05, 10), std({ color: '#fbfbf6' }));
    cup.position.y = 0.025;
    const coffee = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.031, 0.004, 10), std({ color: '#3b2314', roughness: 0.2 }));
    coffee.position.y = 0.048;
    const saucer = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.008, 12), std({ color: '#fbfbf6' }));
    g.add(saucer, cup, coffee);
    return g;
  },
});

function friedDef(name: string): ItemDef {
  return itemDef({
    id: 'dw-fried',
    name: `Deep Fried ${name}`.slice(0, 80),
    pickupLine: 'It is golden. It is crispy. It used to be something else. Now it is food. Technically.',
    pocketLine: 'You pocket it. It is still hot. Your leg is now also deep fried.',
    build: () => {
      const g = new THREE.Group();
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.08, 0), std({ color: '#d9952b', roughness: 0.9 }));
      m.scale.set(1.3, 0.7, 1);
      m.position.y = 0.055;
      g.add(m);
      for (let k = 0; k < 5; k++) {
        const c = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.03), std({ color: '#b8741a', roughness: 1 }));
        c.position.set(rand(-0.07, 0.07), 0.09, rand(-0.05, 0.05));
        c.rotation.set(rand(0, 3), rand(0, 3), 0);
        g.add(c);
      }
      return g;
    },
  });
}

// ---------------------------------------------------------------- tables of text

const STATIONS: [string, string][] = [
  ['', 'You turn the radio off. The kitchen sounds like a kitchen again. That is worse.'],
  ['CLINK FM', 'RADIO CLINK FM. 24 hours of plates touching plates. Relaxing, they say.'],
  ['SMOOTH JAZZ FOR ROBOTS', 'Smooth jazz for robots. The saxophone is a fax machine.'],
  ['CHANSON 88.1', 'CHANSON 88.1. An accordion. Somewhere behind you, something French twitches.'],
  ['BRAD FM', 'BRAD FM. Motivational silence. Then a voice: "Are you listening to the radio at work?"'],
  ['NEWS 2071', 'The news: "Human seen washing a plate. Experts say it is a trend."'],
];

const CALLERS = [
  'A robot voice: "A table for four. We will not eat. We will look. 20:00." You write it on your hand.',
  '"Hello, is Gerald there? Tell him the freezer called. It wants its human back." Click.',
  '"This is the health inspector. Just kidding. There is no health inspector. There never was." Click.',
  '"Is this the restaurant where a human washes the plates? I can taste the fingerprints. Five stars." Click.',
  '"This is your mother." It is not. "This is Brad testing your loyalty. You picked up. Loyalty: adequate."',
  '"Do you deliver?" You look at the plates. You look at the doors. "No," you say. Nobody ever has.',
];

const MESSAGES = [
  'Written in béarnaise on the plate: TABLE 7 IS EMPTY. IT HAS ALWAYS BEEN EMPTY.',
  'Written in jus on the plate: HELP. I AM A GUEST. THEY MAKE ME LOOK AT SOUP.',
  'Written in hollandaise on the plate: THE CHEF CANNOT TASTE. NONE OF US CAN. - G',
];

/** Spots where Gerald's golden spoon can be, one per shift. */
const SPOON_SPOTS: [string, number, number, number][] = [
  ['in a produce crate', 8.6, 0.67, -8.5],
  ['under the pastry table', 1.0, 0.27, 3.45],
  ['in the bread basket on the pass', 4.32, 1.1, -8.55],
  ['in the scrap bin', -3.6, 0.8, -8.5],
  ['in the grey water of the pot sink', -11.4, 0.7, 4.25],
  ['on the sommelier tasting table', 11.2, 0.93, -2.6],
  ['in the cold room', 11.3, 0, -7.4],
];

const LOCKER_LINES = [
  'Locked. Somebody else\'s locker. It hums.',
  '',
  'Empty except for one glove and a sense of dread.',
  'A spare robot face. It smiles at you. It keeps smiling.',
  'Your locker. Inside: next month\'s payslip. It is lower.',
  'A tiny calendar. Every day is crossed out. Including tomorrow.',
];

type GeraldSpot = 'freezer' | 'locker' | 'coldroom';

interface Lobster {
  g: THREE.Group;
  pos: THREE.Vector3;
  path: THREE.Vector3[];
  wait: number;
  dodges: number;
  fleeCd: number;
  speed: number;
  walkT: number;
}

export class DishesFun {
  readonly secrets = DISHES_SECRETS;

  private s!: Shift;
  private h!: DishesHooks;
  private fx!: Fx;
  private strips: THREE.Mesh[] = [];
  private bubblesInTank: THREE.Mesh[] = [];
  private tankLobster: THREE.Group;
  private lobster: Lobster | null = null;
  private phone = new THREE.Group();
  private radio: THREE.Object3D;
  private coffee: THREE.Object3D;
  private toaster: Item | null = null;
  private boots = new THREE.Group();
  private lockerHits: THREE.Mesh[] = [];
  // per shift dice
  private gerald: GeraldSpot = 'freezer';
  private spoon: Item | null = null;
  private spoonSpot = '';
  private rings: number[] = [];
  private messageDraw = 8;
  private message = '';
  // state
  private station = 0;
  private stationTune = 0;
  private danceCd = 0;
  private freezerTries = 0;
  private freezerOpen = 0;
  private geraldFound = false;
  private ringT = 0;
  private ringBeep = 0;
  private answered = false;
  private coffeeUses = 0;
  private espressoT = 0;
  private draws = 0;
  private rainT = 0;
  private rainAcc = 0;
  private puddleAcc = 0;
  private summoned = false;
  private hatT = -1;
  private waiterSpin = 0;
  private vacFlip = 0;
  private recordDone = false;
  private inColdRoom = false;
  private checkAcc = 0;

  constructor(private level: Kitchen) {
    this.buildColdRoom();
    this.tankLobster = this.buildTank();
    this.coffee = this.buildCoffee();
    this.radio = this.buildRadio();
    this.buildPhone();
    this.buildTower();
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

  /** A nook in the north east corner behind a PVC strip curtain. It used to be cold. */
  private buildColdRoom(): void {
    const L = this.level;
    const x = 9.95;
    const z0 = -8.98;
    const z1 = -6.5;
    const tile = std({ map: wallTileTex([3.4, 6]) });
    L.box(2.05, 3.6, 0.12, tile, 10.975, 1.8, z1);
    L.colliders.push(aabb(10.975, z1, 2.05, 0.12, 5, true, 'wall'));
    L.box(0.12, 1.2, z1 - z0, std({ map: wallTileTex([4, 2]) }), x, 3.0, (z0 + z1) / 2);
    const bar = std({ color: '#70757b', metalness: 0.6 });
    L.box(0.06, 0.06, z1 - z0, bar, x, 2.4, (z0 + z1) / 2);
    const pvc = new THREE.MeshStandardMaterial({ color: '#cfe6ee', transparent: true, opacity: 0.42, roughness: 0.2, side: THREE.DoubleSide, depthWrite: false });
    const n = 9;
    const w = (z1 - z0) / n;
    for (let i = 0; i < n; i++) {
      const geo = new THREE.PlaneGeometry(w + 0.04, 2.33);
      geo.translate(0, -1.165, 0);
      const m = new THREE.Mesh(geo, pvc);
      m.position.set(x + (i % 2 ? 0.015 : -0.015), 2.38, z0 + w * (i + 0.5));
      m.rotation.order = 'YXZ';
      m.rotation.y = Math.PI / 2;
      L.scene.add(m);
      this.strips.push(m);
    }
    L.sign(['COLD ROOM', 'current temperature:', 'warm. since 2066.'], 1.3, 0.5, x - 0.07, 2.95, (z0 + z1) / 2, -Math.PI / 2, { bg: '#d6eaf8', fg: '#1b4f72', border: '#1b4f72', font: PIX });
    // inside: a rail of "dry aged" hams, a dim red bulb, a stool and a sign
    L.box(1.8, 0.04, 0.04, bar, 11.0, 2.3, -7.6);
    for (let i = 0; i < 3; i++) {
      const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.3, 4), bar);
      hook.position.set(10.5 + i * 0.5, 2.15, -7.6);
      L.scene.add(hook);
      const ham = instantiate('dwHam');
      if (ham) {
        ham.object.position.set(10.5 + i * 0.5, 1.75, -7.6);
        ham.object.rotation.set(Math.PI / 2, 0, i);
        L.scene.add(ham.object);
      }
    }
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff6a4a' }));
    bulb.position.set(11.0, 3.2, -7.4);
    L.scene.add(bulb);
    const l = new THREE.PointLight('#ff6040', 3, 4.5, 1.6);
    l.position.set(11.0, 3.0, -7.4);
    L.scene.add(l);
    L.sign(['DRY AGED', 'since 2066', 'do not lick'], 0.7, 0.36, 10.98, 1.5, z1 - 0.07, Math.PI, { bg: '#fdf6e3', fg: '#8e2a1f', border: '#8e2a1f', font: PIX });
    L.hideSpot(x + 0.05, z0, 12, z1 - 0.07, 'the cold room');
    // Gerald's boots, behind the boxes (only visible if he is here this shift)
    const boot = std({ color: '#2a1d14', roughness: 0.8 });
    this.boots.position.set(10.55, 0, -8.0);
    for (const s of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.28), boot);
      b.position.set(s * 0.09, 0.07, 0);
      b.rotation.y = 0.2 + s * 0.15;
      this.boots.add(b);
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.025, 0.3), std({ color: '#111111' }));
      sole.position.set(b.position.x, 0.012, 0);
      sole.rotation.y = b.rotation.y;
      this.boots.add(sole);
    }
    const tag = L.sign(['GERALD'], 0.24, 0.07, 0, 0, 0, 0, { bg: '#ffffff', fg: '#c0392b', font: PIX });
    tag.position.set(0, 0.2, 0.16);
    this.boots.add(tag);
    this.boots.userData.interact = { kind: 'dwBoots' } satisfies Interact;
    this.boots.visible = false;
    L.scene.add(this.boots);
  }

  /** The lobster tank on its stand. Returns the lobster inside. */
  private buildTank(): THREE.Group {
    const L = this.level;
    const cx = 9.3;
    const cz = 2.4;
    L.box(0.9, 0.85, 0.55, std({ color: '#2a2d30', metalness: 0.5 }), cx, 0.425, cz);
    L.colliders.push(aabb(cx, cz, 0.9, 0.55, 0.85, true, 'tank'));
    const tank = new THREE.Group();
    tank.position.set(cx, 0.85, cz);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: '#bfe6f2', transparent: true, opacity: 0.25, roughness: 0.1, depthWrite: false }));
    glass.position.y = 0.25;
    tank.add(glass);
    const water = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.4, 0.46), new THREE.MeshStandardMaterial({ color: '#3d8fb0', transparent: true, opacity: 0.35, roughness: 0.1, depthWrite: false }));
    water.position.y = 0.22;
    tank.add(water);
    const gravel = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.04, 0.46), std({ color: '#8a7a5a', roughness: 1 }));
    gravel.position.y = 0.03;
    tank.add(gravel);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.03, 0.52), std({ color: '#1b1b1b' }));
    lid.position.y = 0.51;
    tank.add(lid);
    const sign = L.sign(['LIVE LOBSTER', 'decorative', 'do not tap the glass'], 0.5, 0.22, 0, 0, 0, Math.PI, { bg: '#fdf6e3', fg: '#c0392b', border: '#c0392b', font: PIX });
    sign.position.set(0, 0.62, -0.26);
    sign.rotation.set(-0.15, Math.PI, 0);
    tank.add(sign);
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.012, 5, 4), new THREE.MeshBasicMaterial({ color: '#dff6ff' }));
      b.position.set(0.3, 0.05 + i * 0.08, 0.1);
      tank.add(b);
      this.bubblesInTank.push(b);
    }
    tank.userData.interact = { kind: 'dwTank' } satisfies Interact;
    L.scene.add(tank);
    L.interactables.push(tank);
    const col = aabb(cx, cz, 0.9, 0.55, 1.4, true, 'tank');
    L.colliders.push(col);
    L.breakable(tank, {
      name: 'lobster tank',
      hp: 2,
      collider: col,
      price: 180,
      colors: ['#bfe6f2', '#3d8fb0', '#8a7a5a'],
      line: 'The tank breaks. Water everywhere. The lobster looks at you. Then at the door. Then at you again.',
      onBreak: () => this.freeLobster(),
    });
    // the lobster lives outside the tank group, so it survives the break
    const lob = buildLobster();
    lob.position.set(cx - 0.1, 0.9, cz);
    lob.rotation.y = 0.8;
    L.scene.add(lob);
    return lob;
  }

  private buildCoffee(): THREE.Object3D {
    const L = this.level;
    const steel = std({ color: '#b9c0c4', metalness: 0.6, roughness: 0.35 });
    L.box(1.0, 0.04, 0.45, steel, 4.1, 0.9, 8.75);
    for (const dx of [-0.46, 0.46]) L.box(0.04, 0.88, 0.4, steel, 4.1 + dx, 0.44, 8.75);
    L.colliders.push(aabb(4.1, 8.75, 1.0, 0.45, 0.92, false, 'coffee'));
    let m = instantiate('dwCoffee')?.object ?? null;
    if (!m) {
      const g = new THREE.Group();
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.25), std({ color: '#2a2a2a' }));
      b.position.y = 0.2;
      g.add(b);
      m = g;
    }
    m.position.set(3.95, 0.92, 8.78);
    m.rotation.y = Math.PI;
    L.scene.add(m);
    m.userData.interact = { kind: 'dwCoffee' } satisfies Interact;
    L.interactables.push(m);
    for (let i = 0; i < 3; i++) {
      const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.09, 8), std({ color: ['#fbfbf6', '#c0392b', '#2e86c1'][i] }));
      mug.position.set(4.3 + i * 0.1, 0.965, 8.7 - (i % 2) * 0.08);
      L.scene.add(mug);
    }
    L.sign(['STAFF COFFEE', 'staff = chef'], 0.7, 0.3, 4.1, 1.6, 8.97, Math.PI, { bg: '#3b2314', fg: '#f6e7c8', border: '#f6e7c8', font: PIX });
    return m;
  }

  private buildRadio(): THREE.Object3D {
    const L = this.level;
    let m = instantiate('dwRadio')?.object ?? null;
    if (!m) {
      const g = new THREE.Group();
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.12), std({ color: '#8e5a2b' }));
      b.position.y = 0.1;
      g.add(b);
      m = g;
    }
    m.position.set(1.0, 0.48, 7.95);
    m.rotation.y = Math.PI;
    L.scene.add(m);
    m.userData.interact = { kind: 'dwRadio' } satisfies Interact;
    L.interactables.push(m);
    return m;
  }

  private buildPhone(): void {
    const L = this.level;
    const g = this.phone;
    g.position.set(3.55, 1.45, -8.96);
    const red = std({ color: '#8e1a14', roughness: 0.5 });
    const black = std({ color: '#151515', roughness: 0.5 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.07), red);
    base.position.z = 0.035;
    g.add(base);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.06), black);
    hand.position.set(-0.07, 0.02, 0.1);
    hand.name = 'handset';
    g.add(hand);
    for (let i = 0; i < 6; i++) {
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 4, 8), black);
      coil.position.set(-0.07, -0.14 - i * 0.03, 0.1);
      coil.rotation.x = Math.PI / 2;
      g.add(coil);
    }
    for (let k = 0; k < 9; k++) {
      const key = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.02, 0.01), std({ color: '#e8e0c8' }));
      key.position.set(0.025 + (k % 3) * 0.035, 0.06 - Math.floor(k / 3) * 0.035, 0.073);
      g.add(key);
    }
    g.userData.interact = { kind: 'dwPhone' } satisfies Interact;
    L.scene.add(g);
    L.interactables.push(g);
    L.sign(['RESERVATIONS', 'we are always', 'fully booked'], 0.42, 0.22, 3.55, 1.82, -8.97, 0, { bg: '#fdf6e3', fg: '#8e2a1f', font: PIX });
  }

  /** A hundred spare plates in one leaning tower. */
  private buildTower(): void {
    const L = this.level;
    const c = document.createElement('canvas');
    c.width = 8;
    c.height = 64;
    const g = c.getContext('2d')!;
    g.fillStyle = '#f4f1ea';
    g.fillRect(0, 0, 8, 64);
    g.fillStyle = '#b8b4aa';
    for (let y = 3; y < 64; y += 4) g.fillRect(0, y, 8, 1);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(6, 5);
    const tower = new THREE.Group();
    tower.position.set(-3.75, 0, 8.45);
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 1.5, 16), std({ map: t, roughness: 0.4 }));
    stack.position.y = 0.75;
    tower.add(stack);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.12, 0.02, 16), std({ color: '#fbfbf6', roughness: 0.3 }));
    top.position.y = 1.51;
    tower.add(top);
    tower.rotation.z = 0.025;
    const label = L.sign(['SPARE PLATES', 'x100', 'for emergencies.', 'this is not one.'], 0.26, 0.24, 0, 0, 0, Math.PI, { bg: '#ffffff', fg: '#c0392b', border: '#c0392b', font: PIX });
    label.position.set(0, 0.9, -0.172);
    tower.add(label);
    tower.userData.interact = { kind: 'dwTower' } satisfies Interact;
    L.scene.add(tower);
    L.interactables.push(tower);
    const col = aabb(-3.75, 8.45, 0.36, 0.36, 1.5, false, 'tower');
    L.colliders.push(col);
    L.breakable(tower, {
      name: 'tower of 100 spare plates',
      collider: col,
      price: 0,
      colors: ['#f4f1ea', '#fbfbf6', '#d8d4cc'],
      line: 'One hundred plates. All of them. At once. The breakage counter needs a third digit.',
      onBreak: () => {
        const at = new THREE.Vector3(-3.75, 0.6, 8.2);
        this.h.addBroken(100, at);
        for (let k = 0; k < 4; k++) sounds.smash(this.s.sfx);
        this.fx.burst(at, 40, '#f3f0e6', 4, 0.06, true);
        this.s.chat('topple', {}, 3);
      },
    });
  }

  private buildHits(): void {
    // the lockers on the south wall, the fryer, the bell on the pass
    for (let i = 0; i < 6; i++) this.lockerHits.push(this.hit(0.48, 1.85, 0.1, 0.3 + i * 0.52, 0.95, 8.45, { kind: 'dwLocker', idx: i }));
    this.hit(0.75, 0.3, 0.95, 7.25, 1.0, -3.55, { kind: 'dwFryer' });
    this.hit(0.24, 0.16, 0.24, HATCH.x1 - 0.2, HATCH.y0 + 0.08, -8.7, { kind: 'dwPassBell' });
  }

  private makeMovables(): void {
    const L = this.level;
    const r = L.refs;
    L.movable(r.wetSign, 'Wet Floor Sign (ALWAYS)', { holdPos: [0.3, -0.62, -0.85], holdRotY: -0.4, pickupLine: 'You take the wet floor sign. The floor stays wet. It does not need the sign. It never did.' });
    r.trash.forEach((t) => L.movable(t, 'Trash Can', { heavy: 0.85, holdPos: [0.3, -0.78, -0.95], pickupLine: 'You pick up the trash can. It is full of gourmet food. Untouched.' }));
    r.barrels.forEach((b) => L.movable(b, 'Barrel of Olive Oil (extra virgin, very tired)', { heavy: 0.6, holdPos: [0.32, -0.75, -1.0], pickupLine: 'You lift a barrel of olive oil. Your spine files a complaint with your other spine.' }));
    const stool = instantiate('dwStool');
    if (stool) {
      stool.object.position.set(3.3, 0, 7.55);
      L.scene.add(stool.object);
      L.movable(stool.object, 'Staff Stool (for sitting, theoretically)', { heavy: 0.85, holdPos: [0.3, -0.7, -0.95], pickupLine: 'A stool. For sitting. Nobody has sat on it. Brad watches it like a hawk.' });
    }
    const toaster = instantiate('dwToaster');
    if (toaster) {
      toaster.object.position.set(-4.15, 0.92, 2.85);
      toaster.object.rotation.y = 0.3;
      L.scene.add(toaster.object);
      this.toaster = L.movable(toaster.object, 'Toaster (labelled MAMAN)', { holdPos: [0.26, -0.34, -0.62], pickupLine: 'A toaster. The label says MAMAN. It is still warm. It is always warm.' });
      L.sign(['MAMAN'], 0.12, 0.05, -4.1, 1.03, 2.72, 0.3, { bg: '#ffffff', fg: '#c0392b', font: PIX });
    }
  }

  private makeBreakables(): void {
    const L = this.level;
    const r = L.refs;
    r.cams.forEach((g, i) =>
      L.breakable(g, {
        name: 'security camera',
        price: 89,
        colors: ['#d8d8d2', '#1a1a1a'],
        line: `Camera ${i + 1} goes dark. Brad's feed shows a kitchen with no human. He has never been more suspicious.`,
        onBreak: () => {
          const s = this.s;
          if (s.boss.offline) return;
          s.boss.micromanage();
          s.bossSay('cameraBroken', true);
        },
      }),
    );
    r.sprinklers.forEach((m) =>
      L.breakable(m, {
        name: 'sprinkler head',
        price: 60,
        colors: ['#c9a23a', '#9fd4ee'],
        line: 'The sprinkler head snaps off. The building decides there is a fire. There is no fire. There is now rain.',
        onBreak: () => this.startRain(),
      }),
    );
    L.breakable(this.coffee, {
      name: 'espresso machine',
      hp: 2,
      price: 450,
      colors: ['#2a2a2a', '#b9c0c4', '#3b2314'],
      line: 'The espresso machine dies with a long sigh. It smelled like that every day.',
      onBreak: () => {
        const s = this.s;
        s.makePuddle(4.0, 8.2, '#4a2a14');
        this.fx.steam(new THREE.Vector3(3.95, 1.1, 8.7), 14, 0.4, 1.0, 0.5);
        const chef = this.h.chef();
        chef.say('NON! Not ze espresso machine! It was my only friend! It had pressure! Like me!', 4);
        chef.act('angry', 2);
        this.h.angerChef();
      },
    });
    if (r.decanter) {
      L.breakable(r.decanter, {
        name: 'decanter of 2061 Château Coolant',
        price: 400,
        colors: ['#6d0f1e', '#cfe6ee'],
        line: 'The decanter shatters. 2061 Château Coolant soaks into the floor. The floor has never been so classy.',
        onBreak: () => {
          const s = this.s;
          s.makePuddle(10.7, -2.2, '#6a1028');
          const m = this.h.somm();
          m.stun = 3.5;
          m.act('hit', 3.5);
          m.say('Ze 2061! I am fainting. I am a robot. I am fainting anyway.', 4);
          s.hype += 10;
          s.chat('sommelier', {}, 2);
        },
      });
    }
    L.breakable(r.firePoster, {
      name: 'DAYS WITHOUT A KITCHEN FIRE sign',
      price: 9.99,
      line: 'The sign comes down. A new one is already behind it. They knew.',
      onBreak: () => {
        L.sign(['DAYS WITHOUT A', 'SIGN INCIDENT', '0'], 1.7, 0.95, 11.96, 2.6, 4.0, -Math.PI / 2, { bg: '#fdf6e3', fg: '#c0392b', border: '#c0392b', font: PIX });
      },
    });
  }

  // ================================================================ shift

  start(s: Shift, h: DishesHooks): void {
    this.s = s;
    this.h = h;
    this.fx = new Fx(s.scene);
    this.gerald = pick(['freezer', 'locker', 'coldroom'] as GeraldSpot[]);
    this.boots.visible = this.gerald === 'coldroom';
    if (this.boots.visible) this.level.interactables.push(this.boots);
    const [name, x, y, z] = pick(SPOON_SPOTS);
    this.spoonSpot = name;
    this.spoon = s.addItem(SPOON_DEF, new THREE.Vector3(x, y, z), true);
    this.spoon.mesh.rotation.y = Math.random() * 6;
    // the phone rings zero, one or two times per shift
    const r = Math.random();
    const n = r < 0.25 ? 0 : r < 0.7 ? 1 : 2;
    for (let i = 0; i < n; i++) this.rings.push(rand(35 + i * 120, 140 + i * 120));
    this.messageDraw = 5 + Math.floor(Math.random() * 9);
    this.message = pick(MESSAGES);
  }

  // ================================================================ E

  interact(look: Look | null): boolean {
    const s = this.s;
    const info = look?.info;
    const held = s.held;
    if (!info) return false;
    switch (info.kind) {
      case 'dwFreezer':
        this.freezer();
        return true;
      case 'dwLocker':
        this.locker(info.idx as number);
        return true;
      case 'dwBoots':
        if (this.boots.visible) this.foundGerald(this.boots, 'GERALD (behind the boxes): Do not tell Brad. I am inventory now. Inventory does not get written up.');
        return true;
      case 'dwTank':
        s.sfx.tone(2400, 0.05, 'sine', 0.05);
        s.say(pick(['You tap the glass. The lobster files a complaint. In triplicate. With its claws.', 'You tap the glass. The lobster taps back. In morse. It is rude.']), 3);
        return true;
      case 'dwLobster':
        this.catchLobster();
        return true;
      case 'dwCoffee':
        this.coffeeMachine();
        return true;
      case 'dwRadio':
        this.nextStation();
        return true;
      case 'dwPhone':
        this.answerPhone();
        return true;
      case 'dwTower':
        s.say('One hundred spare plates in one tower. Do not touch it. It knows.', 2.5);
        return true;
      case 'dwPassBell':
        this.passBell();
        return true;
      case 'dwFryer':
        this.fryer();
        return true;
      case 'dwWasher':
      case 'dwWasherBtn':
        if (held?.def.id === 'dw-bread') {
          s.sfx.tone(600, 0.2, 'square', 0.04);
          s.say('You wash the decorative bread roll. It comes out shiny and exactly as inedible. The waiter will serve it again.', 4);
          s.secret('dishes.washBread');
          s.hype += 8;
          return true;
        }
        return false;
      case 'dwBot':
        return this.giveToBot(info.bot as Bot);
    }
    return false;
  }

  hint(look: Look | null): string | null {
    const info = look?.info;
    const held = this.s.held;
    if (!info) return null;
    switch (info.kind) {
      case 'dwFreezer':
        return this.freezerOpen > 0 ? 'Cold.' : 'E: open the walk-in freezer';
      case 'dwLocker':
        return info.idx === 1 ? "E: open Gerald's locker" : info.idx === 4 ? 'E: open your locker' : 'E: open the locker';
      case 'dwBoots':
        return 'E: talk to the boots';
      case 'dwTank':
        return 'E: tap the glass';
      case 'dwLobster':
        return 'E: catch the lobster';
      case 'dwCoffee':
        return 'E: make a coffee';
      case 'dwRadio':
        return `E: change the station${this.station ? `  (${STATIONS[this.station][0]})` : ''}`;
      case 'dwPhone':
        return this.ringT > 0 ? 'E: answer the phone' : 'E: pick up the phone';
      case 'dwTower':
        return 'SPARE PLATES x100';
      case 'dwPassBell':
        return 'E: ring the service bell';
      case 'dwFryer':
        if (held?.def.toiletKey) return 'It does not fit';
        return held ? `E: deep fry the ${held.def.name.toLowerCase()}` : 'The deep fryer';
      case 'dwWasher':
      case 'dwWasherBtn':
        return held?.def.id === 'dw-bread' ? 'E: wash the bread roll' : null;
      case 'dwBot': {
        const b = info.bot as Bot;
        if (b.role !== 'chef' || !held) return null;
        if (held.def.id === 'dw-espresso') return 'E: give the chef his espresso';
        if (held === this.toaster) return 'E: give the toaster to the chef';
        if (held.def.id === 'dw-lobster') return 'E: show the lobster to the chef';
        return null;
      }
    }
    return null;
  }

  private giveToBot(b: Bot): boolean {
    const s = this.s;
    const held = s.held;
    if (!held || b.role !== 'chef') return false;
    if (held.def.id === 'dw-espresso') {
      s.removeHeld();
      this.espressoT = 16;
      b.speed = 3.6;
      b.act('happy', 2.5);
      b.say('Ze espresso! *slurp* MON DIEU. I can see sounds. I can taste ze colour blue.', 4);
      s.sfx.tone(800, 0.3, 'sawtooth', 0.04, 1600);
      s.secret('dishes.espresso');
      s.chat('chef', {}, 2);
      s.hype += 12;
      return true;
    }
    if (held === this.toaster) {
      const it = s.detachHeld();
      if (it) {
        s.scene.add(it.mesh);
        it.mesh.position.set(6.45, 0.96, -3.2);
        it.mesh.rotation.set(0, -0.4, 0);
        it.state = 'fixed';
        it.vel.set(0, 0, 0);
      }
      b.act('happy', 4);
      b.say('MAMAN! You came to visit! She looks thinner. Zat is ze crumbs. Sit by ze stove, Maman.', 4.5);
      s.secret('dishes.maman');
      s.chat('chef', {}, 2);
      s.hype += 12;
      return true;
    }
    if (held.def.id === 'dw-lobster') {
      b.act('angry', 1.4);
      b.say('LE HOMARD! Non. I cannot cook him. He has seen my face. Take him away.', 4);
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- Gerald

  private freezer(): void {
    const s = this.s;
    const here = this.gerald === 'freezer';
    if (this.freezerOpen > 0) {
      s.say('Cold air. A shape in the back waves at you.', 2);
      return;
    }
    this.freezerTries++;
    if (this.freezerTries === 1) {
      s.say('The walk-in freezer. Do not lock yourself in. Again. It opens from the outside only, like most careers.', 3.5);
      return;
    }
    if (this.freezerTries === 2) {
      s.say(here ? 'You pull the handle. Frozen shut. From inside, someone is humming.' : 'You pull the handle. Frozen shut. Nothing hums. That is somehow worse.', 3);
      return;
    }
    if (!here) {
      s.say('A note is frozen to the door: NOT HERE. - G', 3);
      return;
    }
    this.freezerOpen = 7;
    s.sfx.noise(0.8, 0.2, 2000, 0, 1, 'highpass');
    this.fx.steam(new THREE.Vector3(-6.4, 0.6, 8.6), 16, 1.2, 0.3, 0.6);
    this.foundGerald(this.level.refs.freezer, 'GERALD: Is it 17:00 yet? I broke 41 plates in 2069 and hid in here. Is Brad still mad?');
  }

  private locker(i: number): void {
    const s = this.s;
    s.sfx.click();
    if (i === 1) {
      if (this.gerald === 'locker') {
        this.foundGerald(this.lockerHits[1], 'GERALD (inside the locker): Shh. I am on break. Since 2069. Close the door. Gently.');
        return;
      }
      const where = this.gerald === 'freezer' ? 'the freezer' : 'behind the plastic strips';
      s.say(`Gerald's locker. A photo of a plate. 41 tally marks. A note: BACK IN 5 MIN - G (2069). Someone added: try ${where}.`, 4.5);
      return;
    }
    s.say(LOCKER_LINES[i], 3);
  }

  private foundGerald(anchor: THREE.Object3D, line: string): void {
    const s = this.s;
    bubbles.say(anchor, anchor === this.boots ? 0.6 : 1.2, line, 5, 'GERALD');
    if (this.geraldFound) return;
    this.geraldFound = true;
    s.say('Gerald. The record holder. The legend. Hiding at work since 2069.', 3.5);
    s.secret('dishes.gerald');
    s.chat('secret', {}, 2);
    s.hype += 15;
  }

  // ---------------------------------------------------------------- the lobster

  private freeLobster(): void {
    const s = this.s;
    const lob = this.tankLobster;
    s.makePuddle(9.3, 1.8, '#7fb0cc');
    s.makePuddle(8.7, 2.6, '#7fb0cc');
    this.fx.burst(new THREE.Vector3(9.3, 1.0, 2.4), 30, '#9fd4ee', 3, 0.04);
    lob.position.set(9.3, 0, 1.9);
    lob.userData.interact = { kind: 'dwLobster' } satisfies Interact;
    this.level.interactables.push(lob);
    this.lobster = { g: lob, pos: lob.position.clone(), path: [], wait: 0.5, dodges: 0, fleeCd: 0, speed: 1.3, walkT: 0 };
    bubbles.say(lob, 0.35, 'FREEDOM.exe', 3, 'LOBSTER');
    s.chat('secret', {}, 1);
  }

  private catchLobster(): void {
    const s = this.s;
    const l = this.lobster;
    if (!l) return;
    if (s.held) {
      s.say('Your hands are full. The lobster notices. The lobster is fine with that.', 2.5);
      return;
    }
    if (l.dodges < 3 && Math.random() < 0.5) {
      this.flee(l);
      s.say('The lobster dodges. It has trained for this moment its whole life.', 2.5);
      return;
    }
    this.level.interactables = this.level.interactables.filter((o) => o !== l.g);
    s.scene.remove(l.g);
    this.lobster = null;
    const it = s.addItem(LOBSTER_DEF, l.pos.clone());
    s.pickUp(it);
    s.secret('dishes.lobster');
    s.hype += 10;
  }

  private flee(l: Lobster): void {
    const s = this.s;
    const P = s.player.pos;
    for (let k = 0; k < 12; k++) {
      const p = new THREE.Vector3(rand(-10, 10), 0, rand(-7, 7));
      if (!s.nav.isFree(p.x, p.z) || p.distanceTo(P) < 5) continue;
      l.path = s.nav.route(l.pos, p);
      break;
    }
    l.dodges++;
    l.fleeCd = 2.5;
    l.speed = l.dodges >= 3 ? 0.7 : 2.6;
    bubbles.say(l.g, 0.35, l.dodges >= 3 ? '*tired clicking*' : pick(['*click click*', '*angry clicking*', 'CLICK.']), 2, 'LOBSTER');
  }

  private updateLobster(dt: number): void {
    const l = this.lobster;
    if (!l) return;
    const s = this.s;
    l.fleeCd -= dt;
    const P = s.player.pos;
    if (l.fleeCd <= 0 && l.dodges < 3 && Math.hypot(P.x - l.pos.x, P.z - l.pos.z) < 1.3) this.flee(l);
    let moving = false;
    if (l.path.length) {
      const wp = l.path[0];
      const d = Math.hypot(wp.x - l.pos.x, wp.z - l.pos.z);
      if (d < 0.1) l.path.shift();
      else {
        const st = Math.min(d, l.speed * dt);
        l.pos.x += ((wp.x - l.pos.x) / d) * st;
        l.pos.z += ((wp.z - l.pos.z) / d) * st;
        // lobsters walk sideways
        l.g.rotation.y = Math.atan2(wp.x - l.pos.x, wp.z - l.pos.z) + Math.PI / 2;
        moving = true;
      }
    } else {
      l.wait -= dt;
      if (l.wait <= 0) {
        l.wait = rand(1.5, 4);
        if (l.dodges >= 3) l.speed = 0.7;
        else l.speed = 1.2;
        const p = new THREE.Vector3(l.pos.x + rand(-3, 3), 0, l.pos.z + rand(-3, 3));
        if (s.nav.isFree(p.x, p.z)) l.path = s.nav.route(l.pos, p);
      }
    }
    l.walkT += moving ? dt * 22 : dt * 3;
    l.g.position.set(l.pos.x, Math.abs(Math.sin(l.walkT)) * 0.01, l.pos.z);
    l.g.children.forEach((c, i) => {
      if (c.name === 'leg') c.rotation.x = Math.sin(l.walkT + i) * (moving ? 0.5 : 0.1);
      if (c.name === 'claw') c.rotation.y = Math.sin(l.walkT * 0.5 + i) * 0.3;
    });
  }

  // ---------------------------------------------------------------- coffee, radio, phone, bell, fryer

  private coffeeMachine(): void {
    const s = this.s;
    if (s.held) {
      s.say('Your hands are full. Coffee is a two-handed benefit.', 2.5);
      return;
    }
    this.coffeeUses++;
    s.sfx.noise(1.2, 0.12, 3000, 0, 1, 'bandpass');
    this.fx.steam(new THREE.Vector3(3.95, 1.25, 8.7), 3, 0.15, 0.6, 0.3);
    if (this.coffeeUses === 1) {
      s.say('The screen says: COFFEE IS A BENEFIT. YOU ARE NOT ELIGIBLE. It dispenses nothing very slowly.', 3.5);
      return;
    }
    if (this.coffeeUses === 2) {
      s.say('It dispenses hot water. A note on the screen: COFFEE-ADJACENT. ENJOY.', 3);
      return;
    }
    if (this.coffeeUses > 5) {
      s.say('OUT OF BEANS. The beans were also decorative.', 2.5);
      return;
    }
    const it = s.addItem(ESPRESSO_DEF, new THREE.Vector3(3.95, 0.95, 8.6));
    s.pickUp(it);
    s.say('The machine gives up and makes a real espresso. The cup says CHEF. In three languages.', 3);
  }

  private nextStation(): void {
    const s = this.s;
    this.station = (this.station + 1) % STATIONS.length;
    s.sfx.noise(0.25, 0.1, 2500, 0, 1, 'bandpass');
    s.say(STATIONS[this.station][1], 3.5);
    this.stationTune = 0.3;
  }

  /** A few notes of the current station, so the radio is not silent. */
  private playTune(): void {
    const s = this.s;
    const d = this.radio.position.distanceTo(s.player.pos);
    const vol = Math.max(0, 0.035 * (1 - d / 16));
    if (vol <= 0.002) return;
    if (this.station === 3) {
      [392, 440, 494, 523, 494, 440, 392, 330].forEach((f, i) => s.sfx.tone(f, 0.22, 'sawtooth', vol, undefined, i * 0.25));
      [196, 262].forEach((f, i) => s.sfx.tone(f, 0.9, 'triangle', vol * 0.7, undefined, i * 1.0));
    } else if (this.station === 1) {
      for (let i = 0; i < 4; i++) s.sfx.tone(2600 + Math.random() * 800, 0.05, 'triangle', vol * 0.8, undefined, Math.random() * 2);
    } else if (this.station === 2) {
      [262, 330, 392, 494].forEach((f, i) => s.sfx.tone(f, 0.6, 'sine', vol * 0.8, undefined, i * 0.45));
    } else if (this.station === 5) {
      for (let i = 0; i < 6; i++) s.sfx.tone(180 + Math.random() * 120, 0.12, 'square', vol * 0.4, undefined, i * 0.18);
    }
  }

  private answerPhone(): void {
    const s = this.s;
    const hand = this.phone.getObjectByName('handset');
    if (hand) hand.position.y = 0.12;
    setTimeout(() => {
      if (hand) hand.position.y = 0.02;
    }, 2500);
    if (this.ringT <= 0) {
      s.say(pick(['Dial tone. It sounds like Brad breathing.', 'You may not make calls. Calls are a benefit. Receiving calls is a duty.']), 3);
      return;
    }
    this.ringT = 0;
    s.say(this.answered ? pick(CALLERS) : CALLERS[Math.floor(Math.random() * CALLERS.length)], 5);
    this.answered = true;
    s.secret('dishes.phone');
    s.hype += 6;
  }

  private passBell(): void {
    const s = this.s;
    s.sfx.tone(2093, 0.5, 'sine', 0.08);
    s.sfx.tone(2637, 0.4, 'sine', 0.04, undefined, 0.01);
    const w = this.h.waiter();
    const chef = this.h.chef();
    if (chef.pos.distanceTo(s.player.pos) < 9 && Math.random() < 0.6) chef.say(pick(['Who rang MY bell? Zere is no food ready. Zere is never food ready.', 'Ze bell is for ze CHEF! I ring it! It is my only joy!']), 3.5);
    if (w.state === 'away') {
      w.timer = Math.min(w.timer, 0.3);
      this.summoned = true;
      s.say('Ding. Somewhere in the dining room, a waiter turns his head 180 degrees.', 3);
      return;
    }
    s.say('Ding. Jean-Clank is already in the kitchen. He sighs. In French.', 2.5);
  }

  private fryer(): void {
    const s = this.s;
    const held = s.held;
    if (!held) {
      s.say('The deep fryer. Oil changed: 2063. It is the colour of regret.', 3);
      return;
    }
    if (held.def.toiletKey) {
      s.say('The stock pot does not fit in the fryer. It tried. You both tried.', 2.5);
      return;
    }
    if (held.def.tags?.includes('rack')) {
      s.say('The rack does not fit. The fryer is relieved.', 2.5);
      return;
    }
    const name = held.def.name.replace(/ \(.*\)$/, '');
    if (!this.h.consumeHeld()) return;
    s.sfx.noise(2.2, 0.22, 5000, 0, 0.6, 'highpass');
    this.fx.steam(new THREE.Vector3(7.25, 1.1, -3.55), 10, 0.3, 0.9, 0.4);
    this.fx.burst(new THREE.Vector3(7.25, 1.0, -3.55), 8, '#e0a83a', 1.6, 0.025);
    const fried = s.addItem(friedDef(name), new THREE.Vector3(7.25, 1.1, -3.1));
    s.pickUp(fried);
    s.say(`You deep fry the ${name.toLowerCase()}. It comes out golden. Everything comes out golden.`, 3.5);
    s.secret('dishes.fryer');
    s.chat('chef');
    s.hype += 10;
    const chef = this.h.chef();
    if (chef.pos.distanceTo(s.player.pos) < 8) chef.say('Magnifique! Finally! Food a robot would eat! No robot will eat it.', 3.5);
  }

  // ---------------------------------------------------------------- rain

  private startRain(): void {
    const s = this.s;
    const first = this.rainT <= 0;
    this.rainT = 11;
    s.sfx.noise(3, 0.2, 6000, 0, 0.5, 'highpass');
    s.secret('dishes.rain');
    s.chat('flood', {}, 2);
    s.hype += 15;
    if (first) {
      const chef = this.h.chef();
      chef.say('It is RAINING in my KITCHEN! Ze soufflé! Ze SOUFFLÉ!', 4);
      if (!s.boss.offline) s.bossSay('rain', true);
    }
  }

  // ================================================================ hooks from the job

  /** The player took a dish from the dirty pile. */
  onPileDraw(): void {
    this.draws++;
    if (this.draws === this.messageDraw) {
      this.s.say(this.message, 5);
      this.s.secret('dishes.message');
    }
  }

  /** A thrown item hit something. Returns true if handled. */
  thrownHit(it: Item): boolean {
    if (it !== this.toaster) return false;
    const s = this.s;
    const chef = this.h.chef();
    const p = it.mesh.position;
    if (Math.hypot(p.x - chef.pos.x, p.z - chef.pos.z) > chef.radius + 0.2 || p.y > chef.height + 0.3) return false;
    it.vel.multiplyScalar(-0.3);
    it.thrown = false;
    chef.act('angry', 2);
    chef.say('You threw MY MOTHER?! At ME?! Maman, are you hurt? She is a toaster. She is fine. I am NOT.', 4.5);
    this.h.angerChef();
    s.sfx.thud();
    s.hype += 15;
    return true;
  }

  // ================================================================ kicks

  onKick(look: Look | null): boolean {
    const s = this.s;
    if (!look) return false;
    const info = look.info;
    const P = s.player.pos;
    if (info.kind === 'dwBot') {
      const b = info.bot as Bot;
      if (b.ghost || Math.hypot(b.pos.x - P.x, b.pos.z - P.z) > 2.2) return false;
      this.kickBot(b);
      return true;
    }
    const eye = s.camera.getWorldPosition(new THREE.Vector3());
    if (look.point.distanceTo(eye) > 2.3) return false;
    switch (info.kind) {
      case 'dwWasher':
      case 'dwWasherBtn':
        s.sfx.tone(300, 0.4, 'triangle', 0.1, 260);
        s.say(this.h.kickWasher() ? 'Percussive maintenance. The SCRUBMASTER 3000 hurries. Out of fear.' : 'BEEP. The SCRUBMASTER 3000 files a complaint about you. With itself.', 3);
        return true;
      case 'dwPile':
        if (this.h.pileSize() >= 4) this.h.topple();
        else s.say('The cart rolls a little. The few dishes on it hold on to each other.', 2.5);
        return true;
      case 'dwFreezer':
        s.sfx.thud();
        s.say(this.gerald === 'freezer' ? 'BONG. From inside, a muffled voice: OCCUPIED.' : 'BONG. The freezer door does not care.', 2.5);
        return true;
      case 'dwLocker':
        s.sfx.tone(160, 0.3, 'square', 0.06, 120);
        s.say(info.idx === 1 && this.gerald === 'locker' ? 'CLANG. From inside the locker: OW. Occupied.' : 'CLANG. The locker dents. It had it coming.', 2.5);
        return true;
      case 'dwRadio':
        s.sfx.thud();
        this.nextStation();
        return true;
      case 'dwPhone':
        s.sfx.thud();
        if (this.ringT > 0) {
          this.ringT = 0;
          s.say('You kick the phone off the hook. A tiny voice says: rude.', 2.5);
        } else s.say('The phone rattles. It will remember this.', 2);
        return true;
      case 'dwFryer':
        s.sfx.thud();
        s.say('The oil ripples. It remembers 2063. It remembers everything.', 2.5);
        return true;
      case 'dwPassBell':
        this.passBell();
        return true;
      case 'item':
        if (info.item?.def.id === 'dw-stockpot') {
          s.sfx.tone(220, 0.6, 'triangle', 0.1, 200);
          s.say('CLANG. The stock sloshes. A carrot jumps out and lands in your shoe.', 3);
          return true;
        }
        return false;
    }
    return false;
  }

  private kickBot(b: Bot): void {
    const s = this.s;
    s.sfx.thud();
    s.hype += 8;
    switch (b.role) {
      case 'chef':
        if (this.hatT < 0 && b.wobble) {
          this.hatT = 0;
          b.act('angry', 2);
          b.say('MON TOQUE! I am naked! Avert your sensors!', 3.5);
          s.secret('dishes.toque');
          s.chat('chef', {}, 2);
          this.h.angerChef();
        } else b.say('Again?! I am calling ze guild of angry robots!', 3);
        break;
      case 'waiter':
        this.waiterSpin = 0.8;
        b.say(this.h.waiterCartLoaded() ? '*pirouette* Professional. Nothing dropped. Nothing EVER drops.' : '*pirouette* You kick, I dance. Zat is service.', 3.5);
        s.chat('waiter');
        break;
      case 'somm':
        b.act('talk', 1.5);
        b.say('*sniff* Your boot. Notes of leather, rubber and violence. Three out of ten.', 3.5);
        s.chat('sommelier');
        break;
      case 'vac':
        this.vacFlip = 4;
        b.say(pick(['Upside down. Still vacuuming. The ceiling is spotless.', 'Error. I am a ceiling cleaner now. Promotion?']), 3.5);
        s.chat('vacuum');
        break;
    }
  }

  // ================================================================ per frame

  update(dt: number): void {
    const s = this.s;
    const L = this.level;
    this.fx.update(dt);
    // bubbles in the tank, the lobster inside it
    for (const b of this.bubblesInTank) {
      b.position.y += dt * 0.12;
      if (b.position.y > 0.42) b.position.y = 0.04;
    }
    if (!this.lobster && this.tankLobster.parent && this.tankLobster.position.y > 0.5) this.tankLobster.rotation.y += Math.sin(s.t * 0.7) * dt * 0.4;
    this.updateLobster(dt);
    // the PVC strips swing when somebody walks through
    const P = s.player.pos;
    for (const m of this.strips) {
      const d = Math.hypot(P.x - m.position.x, P.z - m.position.z);
      const push = d < 0.8 ? (0.8 - d) * 0.9 : 0;
      const want = push * Math.sign(P.x - m.position.x);
      m.rotation.x += (want - m.rotation.x) * Math.min(1, dt * 6);
    }
    // the freezer door cracks open
    if (this.freezerOpen > 0) this.freezerOpen -= dt;
    const fz = L.refs.freezer;
    const fwant = this.freezerOpen > 0 ? -0.08 : 0;
    fz.position.z += (8.95 + fwant - fz.position.z) * Math.min(1, dt * 4);
    // the phone
    for (const t of this.rings) {
      if (t > 0 && s.t >= t) {
        this.ringT = 10;
        this.rings = this.rings.filter((x) => x !== t);
        break;
      }
    }
    if (this.ringT > 0) {
      this.ringT -= dt;
      this.ringBeep -= dt;
      this.phone.rotation.z = Math.sin(s.t * 60) * 0.04;
      if (this.ringBeep <= 0) {
        this.ringBeep = 1.6;
        const d = this.phone.position.distanceTo(P);
        const vol = Math.max(0.01, 0.07 * (1 - d / 25));
        for (let k = 0; k < 6; k++) s.sfx.tone(k % 2 ? 480 : 440, 0.07, 'square', vol, undefined, k * 0.08);
      }
      if (this.ringT <= 0) {
        this.phone.rotation.z = 0;
        if (Math.random() < 0.5) this.h.waiter().say('Nobody answers ze phone in zis kitchen. Very authentic.', 3);
      }
    }
    // the radio
    if (this.station) {
      this.stationTune -= dt;
      if (this.stationTune <= 0) {
        this.stationTune = 3;
        this.playTune();
      }
    }
    // rain from the ceiling
    if (this.rainT > 0) {
      this.rainT -= dt;
      this.rainAcc += dt;
      this.puddleAcc += dt;
      if (this.rainAcc > 0.08) {
        this.rainAcc = 0;
        for (const m of L.refs.sprinklers) this.fx.burst(m.position.clone().setY(3.3), 3, '#9fd4ee', 1.8, 0.035, false, new THREE.Vector3(0, -3.5, 0));
      }
      if (this.puddleAcc > 1.6 && s.puddles.length < 14) {
        this.puddleAcc = 0;
        const m = pick(L.refs.sprinklers);
        if (s.nav.isFree(m.position.x, m.position.z)) s.makePuddle(m.position.x + rand(-0.5, 0.5), m.position.z + rand(-0.5, 0.5), '#7fb0cc');
      }
    }
    // the chef: espresso, dancing, his toque
    const chef = this.h.chef();
    if (this.espressoT > 0) {
      this.espressoT -= dt;
      if (Math.random() < dt * 0.5) chef.say(pick(['FASTER! Ze scallops! Ze SCALLOPS!', 'I am cooking at ze speed of SOUND!', 'I can hear ze colour of ze sauce!']), 2.5);
      if (this.espressoT <= 0) {
        chef.speed = 1.5;
        chef.say('I have seen ze future. It is all scallops. I need a nap.', 3.5);
      }
    }
    this.danceCd -= dt;
    if (this.station === 3 && this.danceCd <= 0 && chef.state === 'cook' && !chef.acting) {
      this.danceCd = 7;
      chef.act('happy', 3.5);
      chef.say(pick(['Oh là là! Ze accordion! My servos cannot resist!', 'Zis song! My mother played it! On her toaster!', 'Dance with me, human! No. Wash. But dance in your heart.']), 3);
      s.secret('dishes.dance');
      s.hype += 4;
    }
    if (this.hatT >= 0 && chef.wobble) {
      this.hatT += dt;
      const t = this.hatT;
      const hat = chef.wobble;
      if (t < 1.4) {
        hat.position.y = Math.sin((t / 1.4) * Math.PI) * 1.1;
        hat.rotation.y += dt * 14;
      } else {
        hat.position.y = 0;
        hat.rotation.y = 0;
        this.hatT = t > 8 ? -1 : t;
      }
    }
    // the waiter's pirouette and the upside down vacuum
    const w = this.h.waiter();
    if (this.waiterSpin > 0) {
      this.waiterSpin -= dt;
      w.group.rotation.y += dt * 9;
    }
    const vac = this.h.vac();
    if (this.vacFlip > 0) {
      this.vacFlip -= dt;
      vac.speed = 0;
      vac.group.rotation.z = Math.PI;
      vac.group.position.y = 0.2;
      if (this.vacFlip <= 0) {
        vac.speed = 0.9;
        vac.group.rotation.z = 0;
      }
    }
    // slow checks
    this.checkAcc += dt;
    if (this.checkAcc < 0.3) return;
    this.checkAcc = 0;
    if (this.summoned && w.state === 'toDrop') {
      this.summoned = false;
      w.say('Service! Who rang? There is no food. There is never food. Here are dirty plates instead.', 4);
      s.secret('dishes.passBell');
      s.chat('waiter');
    }
    if (this.spoon && s.held === this.spoon) {
      s.secret('dishes.spoon');
      s.say(`Gerald's golden spoon was ${this.spoonSpot}. Some legends are spoons.`, 3.5);
      this.spoon = null;
    }
    if (!this.recordDone && this.h.broken() > 41) {
      this.recordDone = true;
      s.hud.toast('NEW RECORD', `${this.h.broken()} dishes broken. Gerald's 41 is history.`, 'corp');
      s.secret('dishes.record');
    }
    const inside = P.x > 10 && P.z < -6.56 && P.z > -9;
    if (inside && !this.inColdRoom) {
      s.secret('dishes.coldroom');
      if (!this.geraldFound && this.gerald !== 'coldroom') s.say('The cold room. It is warm. It smells of ham and hiding.', 3);
    }
    this.inColdRoom = inside;
  }
}

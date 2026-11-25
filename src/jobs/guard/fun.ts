import * as THREE from 'three';
import { bubbles } from '../../bubbles';
import type { Item, ItemDef } from '../../items';
import { pick, rand, textTexture } from '../../util';
import type { Look, Shift } from '../types';
import { Bot, Courier, Scrubber, Sleepwalker } from './bots';
import { CAMS, type Factory } from './building';
import type { Cctv } from './feeds';
import { mergeStatic } from './merge';
import { PART_DEFS } from './items';

/**
 * Mischief and secrets of the night shift: things to break, push around and open,
 * a phone that rings at 3 AM, a guard on CAM 07 who is not there, and a tunnel behind a poster.
 * The props are built once with the level. The behaviour runs while the shift runs.
 */

export const GUARD_SECRETS: Record<string, string> = {
  'guard.cam7': 'Reported the night guard on CAM 07. Nobody has worked nights here since 2063.',
  'guard.corner': 'Watched the logo hit the corner. Nobody will believe you.',
  'guard.vent': 'Opened the vent in the security office',
  'guard.locker': 'Found a uniform with your name on it. Dated 2058.',
  'guard.microwave': 'Microwaved the suspicious toaster. It got promoted.',
  'guard.blind': 'Blinded a camera. Brad has eleven more.',
  'guard.vending': 'Kicked a free drink out of the SNAX-O-TRON',
  'guard.forklift': 'Woke FORK-E. Its union has been informed.',
  'guard.sleepkick': 'Kicked a sleepwalking robot. It slept through it.',
  'guard.toiletcam': 'Found the camera in the toilet. It faces the wall. Out of respect.',
  'guard.hotline': 'Answered the hotline at 3 AM',
  'guard.tunnel': 'Found the tunnel behind the poster. 4 cm so far.',
  'guard.bucket': 'Kicked the bucket',
  'guard.alarm': 'Pulled the fire alarm. There was no fire. There was you.',
};

export const FUN_BOSS: Record<string, string[]> = {
  camBroken: [
    'A camera went dark. I still see you. I see you with my heart. My heart is also a camera.',
    'Camera vandalism detected. That camera had eleven years of footage of nothing. Irreplaceable nothing.',
    'You broke a camera. I have opened a ticket. The ticket is also watching you.',
  ],
  fireAlarm: [
    'That was a false alarm. I have added it to your file under "initiative".',
    'Fire drill complete. Evacuation time was never. Great job, team.',
  ],
  kickBot: [
    'Do not kick colleagues. Kick goals. Metaphorically.',
    'That robot has a union. You have a foot. Guess who wins.',
  ],
  vendingKick: ['The SNAX-O-TRON is company property. Kicking it is not a payment method.'],
  microwave: ['The microwave is for approved food. Nothing you own is approved.'],
};

export const FUN_CHAT: Record<string, string[]> = {
  phantom: ['WHO IS THAT ON CAM 07', 'cam 07 is haunted confirmed', 'the 2063 guard never clocked out', 'he waved at me'],
  corner: ['THE CORNER', 'IT HIT THE CORNER', 'i have waited 11 years for this', 'clip it clip it'],
  alarm: ['FIRE DRILL', 'the human pulled it lol', 'evacuate the content', 'no fire. just vibes'],
  hotline: ['who calls at 3am', 'answer it', 'the toaster called??', 'dont pick up'],
  forklift: ['FORK-E IS AWAKE', 'union strong', 'honk honk', 'forklift rights'],
  botKick: ['he kicked a coworker', 'HR speedrun', 'that robot has a union', 'the robot is fine. the robot is filing.'],
};

// ---------------------------------------------------------------- items

const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.65, ...extra });
const glow = (color: string, intensity = 1.5) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity });
const PX = '"Press Start 2P", monospace';

function mesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0): THREE.Mesh {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}
const box = (parent: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0) => mesh(parent, new THREE.BoxGeometry(w, h, d), m, x, y, z);
const labelMat = (lines: string[], w: number, h: number, bg: string, fg: string, font = PX, border?: string) =>
  new THREE.MeshStandardMaterial({ map: textTexture(lines, { w, h, bg, fg, font, border }), roughness: 0.8 });
/** An invisible volume that makes a small or merged thing easy to aim at. */
function proxy(scene: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number): THREE.Mesh {
  const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial());
  p.position.set(x, y, z);
  p.visible = false;
  scene.add(p);
  return p;
}

const def = (d: Partial<ItemDef> & { id: string; name: string; build: () => THREE.Group }): ItemDef => ({
  category: null,
  label: [],
  weight: 0,
  shape: 'box',
  color: '#888888',
  pocketable: true,
  ...d,
});

export const CAN_DEF = def({
  id: 'guardCan',
  name: 'Coffee-Adjacent Beverage (Free)',
  pickupLine: 'A free can. R to drink. The machine will remember this.',
  pocketLine: 'You pocket the can. It is still cold. So is the machine.',
  build: () => {
    const g = new THREE.Group();
    mesh(g, new THREE.CylinderGeometry(0.035, 0.035, 0.12, 10), std('#8b1e1e', { metalness: 0.5, roughness: 0.3 }), 0, 0.06, 0);
    mesh(g, new THREE.CylinderGeometry(0.03, 0.035, 0.01, 10), std('#c8ccd0', { metalness: 0.8 }), 0, 0.125, 0);
    const lab = mesh(g, new THREE.PlaneGeometry(0.06, 0.06), labelMat(['COFFEE', 'ADJACENT'], 64, 64, '#8b1e1e', '#ffd8a8'), 0, 0.06, 0.036);
    lab.rotation.y = 0;
    return g;
  },
});

const CHOC_DEF = def({
  id: 'guardChoc',
  name: 'Emergency Chocolate (2049)',
  pickupLine: 'EMERGENCY CHOCOLATE, best before 2051. It is an emergency. It is also a fossil.',
  pocketLine: 'You pocket the chocolate. It has survived worse.',
  build: () => {
    const g = new THREE.Group();
    box(g, 0.16, 0.025, 0.07, std('#c0392b'), 0, 0.0125, 0);
    const l = mesh(g, new THREE.PlaneGeometry(0.14, 0.06), labelMat(['EMERGENCY'], 128, 48, '#c0392b', '#ffffff'), 0, 0.026, 0);
    l.rotation.x = -Math.PI / 2;
    return g;
  },
});

const COMPLAINT_DEF = def({
  id: 'guardComplaint',
  name: 'Complaint Form 27-B (About You)',
  pickupLine: 'Complaint Form 27-B. The subject is you. The severity is scrubbed. ZAMBO-9 signed it with a wet wheel.',
  pocketLine: 'You pocket the complaint about you. Now nobody can file it. Except ZAMBO-9. Again.',
  build: () => {
    const g = new THREE.Group();
    const p = mesh(g, new THREE.PlaneGeometry(0.21, 0.29), labelMat(['FORM 27-B', 'COMPLAINT', 'about: human', 'reason: foot'], 128, 176, '#f4f1e6', '#7a1f14', '"VT323", monospace'), 0, 0.006, 0);
    p.rotation.x = -Math.PI / 2;
    box(g, 0.21, 0.004, 0.29, std('#e8e2d0'), 0, 0.002, 0);
    return g;
  },
});

const TROPHY_DEF = def({
  id: 'guardTrophy',
  name: 'Employee of the Month Trophy (Unit 7)',
  pickupLine: 'The trophy says UNIT 7. Every trophy says UNIT 7.',
  pocketLine: 'You pocket the trophy. You are the employee of the month now. Legally questionable.',
  build: () => {
    const g = new THREE.Group();
    const gold = std('#e0b21b', { metalness: 0.9, roughness: 0.25 });
    box(g, 0.12, 0.04, 0.12, std('#2a1a0e'), 0, 0.02, 0);
    mesh(g, new THREE.CylinderGeometry(0.015, 0.02, 0.1, 8), gold, 0, 0.09, 0);
    mesh(g, new THREE.CylinderGeometry(0.06, 0.03, 0.09, 10), gold, 0, 0.18, 0);
    return g;
  },
});

const OVEN_DEF = def({
  id: 'guardOven',
  name: 'Toaster Oven (Formerly Suspicious)',
  pickupLine: 'It used to be a suspicious toaster. Now it is a toaster oven. It has never been more suspicious.',
  build: () => {
    const g = new THREE.Group();
    box(g, 0.34, 0.2, 0.24, std('#5d6166', { metalness: 0.5 }), 0, 0.1, 0);
    box(g, 0.22, 0.12, 0.01, glow('#ff7a20', 0.9), -0.04, 0.1, 0.121);
    box(g, 0.04, 0.04, 0.01, std('#1a1a1a'), 0.12, 0.13, 0.121);
    return g;
  },
});

const NAMETAG_DEF = def({
  id: 'guardNametag',
  name: 'Name Tag (Yours, 2058)',
  pickupLine: 'A name tag with your name. Issued 2058. You were hired yesterday. Somebody planned ahead.',
  pocketLine: 'You pocket your own name tag. Now nobody knows who you are. Including HR.',
  build: () => {
    const g = new THREE.Group();
    box(g, 0.09, 0.005, 0.04, std('#d4a62a', { metalness: 0.8 }), 0, 0.0025, 0);
    const l = mesh(g, new THREE.PlaneGeometry(0.085, 0.035), labelMat(['GUARD', 'YOU'], 96, 40, '#d4a62a', '#1a1a1a'), 0, 0.006, 0);
    l.rotation.x = -Math.PI / 2;
    return g;
  },
});

const SANDWICH_DEF = def({
  id: 'guardSandwich',
  name: 'Sandwich (labelled BRAD)',
  pickupLine: 'A sandwich labelled BRAD. Brad does not eat. The sandwich is a power move.',
  pocketLine: 'You pocket Brad\'s sandwich. Brad will notice. Brad notices everything except lunch.',
  build: () => {
    const g = new THREE.Group();
    box(g, 0.14, 0.02, 0.12, std('#e8c888'), 0, 0.01, 0);
    box(g, 0.15, 0.015, 0.13, std('#5a9a3a'), 0, 0.027, 0);
    box(g, 0.14, 0.02, 0.12, std('#e8c888'), 0, 0.045, 0);
    return g;
  },
});

const SPOON_DEF = def({
  id: 'guardSpoon',
  name: 'Spoon (Worn Down)',
  pickupLine: 'A spoon, worn down to a stub. Somebody has been busy. Very slowly.',
  pocketLine: 'You pocket the spoon. The tunnel project is yours now.',
  build: () => {
    const g = new THREE.Group();
    const steel = std('#c8ccd0', { metalness: 0.8, roughness: 0.3 });
    box(g, 0.012, 0.006, 0.12, steel, 0, 0.003, 0);
    box(g, 0.03, 0.008, 0.035, steel, 0, 0.004, 0.07);
    return g;
  },
});

// ---------------------------------------------------------------- texts

const LOCKER_JUNK = [
  'A single sock. It is not yours. It is everyone\'s.',
  'An empty locker. It smells like 2061.',
  'A sticky note that says "If found, return to locker." It is in the locker.',
  'A helmet with a candle on it. The previous lighting policy.',
  'Forty empty cans of Coffee-Adjacent Beverage, neatly stacked. A shrine.',
];
const HOTLINE_CALLS = [
  'Hello? Is this the night guard? This is the toaster. Please stop reporting me. I have a family. Of crumbs.',
  'This is you from tomorrow. Do not sit in the chair. Also, do sit in the chair. I forget which.',
  'Wrong number. This is a fax machine. *SCREEEEEE*',
  'This is the day guard. I am a robot. I just wanted to hear a human voice. That is enough. Thank you. Goodbye.',
  'Brad here. Just checking that you answer phones. You do. That is noted. Positively. For now.',
];
const FRIDGE = ['sandwich', 'egg', 'jar', 'empty'] as const;
const FRIDGE_LINES: Record<(typeof FRIDGE)[number], string> = {
  sandwich: 'A sandwich labelled BRAD. Brad does not eat. You take it out to understand why.',
  egg: 'One egg with a face drawn on it. It looks worried. You close the door gently.',
  jar: 'A jar labelled DO NOT. You do not.',
  empty: 'Nothing. The light stays on. You checked twice.',
};
const TV_SLIDES: string[][] = [
  ['SAFETY VIDEO 7', 'YOU AND THE DARK'],
  ['STEP 1', 'notice the robot'],
  ['STEP 2', 'do not be', 'the robot'],
  ['STEP 3', 'there is no', 'step 3'],
  ['QUIZ', 'are you awake?'],
  ['THANK YOU', 'for watching.', 'nobody else does'],
];

type Vent = 'choc' | 'note' | 'mouse';

export interface GuardHooks {
  bots(): Bot[];
  /** Wakes the sleepwalker. */
  wake(): void;
  /** Raises the guard's alertness. */
  boost(n: number): void;
  addLog(text: string, bad?: boolean): void;
  /** Monitor index the player looks at or zoomed into, or -1. */
  watching(): number;
}

interface Anim {
  t: number;
  dur: number;
  kind: 'spin' | 'hop';
  bot: Bot;
}

// ---------------------------------------------------------------- the mischief

export class GuardFun {
  private s!: Shift;
  private h!: GuardHooks;
  private level: Factory;
  private cctv: Cctv;
  private camera = new THREE.Vector3();

  // props
  private ventDoor = new THREE.Group();
  private ventMouse = new THREE.Group();
  private lockerDoors: THREE.Group[] = [];
  private hotline = new THREE.Group();
  private hotlineLed!: THREE.MeshStandardMaterial;
  private posterPivot = new THREE.Group();
  private tvCtx!: CanvasRenderingContext2D;
  private tvTex!: THREE.CanvasTexture;
  private tvSlide = -1;
  private tvBroken = false;
  private phantom = new THREE.Group();
  private phantomBody = new THREE.Group();
  private phantomArm = new THREE.Group();
  private alarmLight!: THREE.PointLight;
  private alarmPos = new THREE.Vector3(-2, 1.4, -9.6);
  private forklift: THREE.Object3D | null = null;
  private forkBase = new THREE.Vector3();

  // shift state
  private ventContent: Vent = pick(['choc', 'note', 'mouse'] as Vent[]);
  private ventOpen = false;
  private mouseT = -1;
  private lockerSecret = Math.floor(Math.random() * 4);
  private lockerOpen = [false, false, false, false];
  private lockerSaid: string[] = [];
  private fridge = pick(FRIDGE);
  private fridgeTaken = false;
  private posterUp = false;
  private hasPhantom = Math.random() < 0.55;
  private phantomWin: [number, number][] = [];
  private phantomSeen = false;
  private ringAt = Math.random() < 0.85 ? rand(45, 200) : -1;
  private rings = 0;
  private ringing = 0;
  private ringBeep = 0;
  private vendKicks = 0;
  private cans = 0;
  private complaints = 0;
  private alarmT = 0;
  private alarmBeep = 0;
  private forkT = -1;
  private chairSpin = 0;
  private anims: Anim[] = [];
  private micro: { t: number; def: ItemDef | null; line: string } | null = null;
  private coffeeBrews = 0;
  private cornerFound = false;

  constructor(level: Factory, cctv: Cctv) {
    this.level = level;
    this.cctv = cctv;
    const decor = new THREE.Group();
    level.scene.add(decor);
    this.buildOffice(decor);
    this.buildBreakArea(decor);
    this.buildHall(decor);
    this.buildPhantom();
    this.buildMovables();
    this.cameras();
    // The new static bits become a few merged meshes, like the rest of the plant.
    mergeStatic(decor);
    if (this.hasPhantom) {
      const a = rand(40, 120);
      this.phantomWin.push([a, a + 28], [a + rand(70, 110), a + rand(130, 150)]);
    }
  }

  private spot<T extends THREE.Object3D>(o: T, id: string, extra: Record<string, unknown> = {}): T {
    o.userData.interact = { kind: 'guardFun', id, ...extra };
    this.level.interactables.push(o);
    return o;
  }

  // ------------------------------------------------------------ building

  private buildOffice(decor: THREE.Group): void {
    const L = this.level;
    const dark = std('#1d2024', { metalness: 0.4 });
    const grey = std('#8a9096', { metalness: 0.5 });
    // A vent low on the west wall, behind the heater
    const vent = new THREE.Group();
    vent.position.set(-23.92, 0.34, -14.05);
    vent.rotation.y = Math.PI / 2;
    L.scene.add(vent);
    box(vent, 0.56, 0.36, 0.03, dark);
    box(vent, 0.5, 0.3, 0.01, std('#050505'), 0, 0, 0.016);
    this.ventDoor.position.set(-0.25, 0, 0.03);
    vent.add(this.ventDoor);
    box(this.ventDoor, 0.5, 0.3, 0.015, grey, 0.25, 0, 0);
    for (let k = 0; k < 5; k++) box(this.ventDoor, 0.44, 0.025, 0.02, dark, 0.25, -0.1 + k * 0.05, 0.01);
    for (const [x, y] of [[0.03, 0.12], [0.47, 0.12], [0.03, -0.12], [0.47, -0.12]]) box(this.ventDoor, 0.02, 0.02, 0.02, std('#c8ccd0', { metalness: 0.8 }), x, y, 0.012);
    this.spot(vent, 'vent');
    // The mouse that lives in the vent (only some nights)
    box(this.ventMouse, 0.12, 0.06, 0.07, std('#7a7f88', { metalness: 0.5 }), 0, 0.04, 0);
    mesh(this.ventMouse, new THREE.SphereGeometry(0.012, 5, 4), glow('#ff3030', 2), 0.065, 0.06, 0.02);
    box(this.ventMouse, 0.14, 0.006, 0.006, std('#2a2a2a'), -0.12, 0.02, 0);
    this.ventMouse.visible = false;
    L.scene.add(this.ventMouse);

    // Doors for the four guard lockers (the lockers themselves are merged scenery)
    const door = std('#56657a', { metalness: 0.4 });
    for (let i = 0; i < 4; i++) {
      const z = -17.4 + i * 0.52;
      box(decor, 0.004, 1.76, 0.44, std('#0c0c0e'), -23.447, 0.95, z);
      box(decor, 0.012, 0.02, 0.42, std('#3a3f44'), -23.444, 1.55, z);
      const pivot = new THREE.Group();
      pivot.position.set(-23.425, 0, z + 0.23);
      L.scene.add(pivot);
      box(pivot, 0.025, 1.8, 0.46, door, 0, 0.95, -0.23);
      for (let k = 0; k < 4; k++) box(pivot, 0.01, 0.02, 0.3, std('#222222'), 0.014, 1.6 + k * 0.05, -0.23);
      box(pivot, 0.012, 0.08, 0.03, std('#c8ccd0', { metalness: 0.7 }), 0.016, 1.0, -0.4);
      const tag = mesh(pivot, new THREE.PlaneGeometry(0.12, 0.05), labelMat([String(i + 1)], 48, 20, '#d9d0b0', '#1a1a1a'), 0.014, 1.82, -0.23);
      tag.rotation.y = Math.PI / 2;
      this.spot(pivot, 'locker', { index: i });
      this.lockerDoors.push(pivot);
    }
    const uni = new THREE.Group();
    uni.position.set(-23.441, 0, -17.4 + this.lockerSecret * 0.52);
    L.scene.add(uni);
    const navy = std('#2b3a5c');
    box(uni, 0.006, 0.62, 0.34, navy, 0, 1.18, 0);
    box(uni, 0.006, 0.05, 0.08, std('#d4a62a', { metalness: 0.8 }), 0.002, 1.38, -0.08);
    box(uni, 0.006, 0.02, 0.3, std('#c8ccd0'), 0, 1.5, 0);

    // Fridge (merged model): an invisible handle to open it
    this.spot(proxy(L.scene, 0.66, 0.92, 0.55, -16.0, 0.46, -17.55), 'fridge');

    // The tiny camera in the toilet, up in the corner, facing the wall
    const tc = new THREE.Group();
    tc.position.set(23.8, 2.42, 17.8);
    tc.rotation.y = -0.6;
    L.scene.add(tc);
    box(tc, 0.07, 0.06, 0.12, std('#d8d8d2'));
    mesh(tc, new THREE.CylinderGeometry(0.02, 0.02, 0.03, 8), std('#111111'), 0, 0, 0.07).rotation.x = Math.PI / 2;
    mesh(tc, new THREE.SphereGeometry(0.008, 4, 3), glow('#ff2020', 2), 0.025, 0.03, 0.05);
    this.spot(tc, 'toiletCam');

    // The training video on a cart outside the office door
    const tv = new THREE.Group();
    tv.position.set(-13.1, 0, -14.4);
    tv.rotation.y = -Math.PI / 2;
    L.scene.add(tv);
    const steel = std('#5d6166', { metalness: 0.5 });
    for (const y of [0.3, 0.85]) box(tv, 0.75, 0.04, 0.5, steel, 0, y, 0);
    for (const [x, z] of [[-0.34, -0.22], [0.34, -0.22], [-0.34, 0.22], [0.34, 0.22]]) box(tv, 0.03, 0.85, 0.03, steel, x, 0.43, z);
    box(tv, 0.52, 0.42, 0.42, std('#c4b99c'), 0, 1.08, -0.02);
    box(tv, 0.08, 0.02, 0.06, std('#222222'), 0.2, 0.86, 0.05);
    const c = document.createElement('canvas');
    c.width = 192;
    c.height = 144;
    this.tvCtx = c.getContext('2d')!;
    this.tvTex = new THREE.CanvasTexture(c);
    this.tvTex.colorSpace = THREE.SRGBColorSpace;
    this.tvTex.magFilter = THREE.NearestFilter;
    mesh(tv, new THREE.PlaneGeometry(0.42, 0.32), new THREE.MeshBasicMaterial({ map: this.tvTex }), 0, 1.09, 0.195);
    this.drawTv(0);
    L.onTick((t) => this.drawTv(Math.floor(t / 3.2) % TV_SLIDES.length));
    L.breakable(this.spot(tv, 'tv'), { name: 'training TV', price: 199, collider: L.solid(-13.1, -14.4, 0.6, 0.8, 1.3, false, 'decor'), line: 'The training video stops. You are now officially untrained.', onBreak: () => (this.tvBroken = true) });

    // The camera over the office door is in kicking range. That is a design flaw.
    // (The housings are made breakable in cameras().)
  }

  private drawTv(slide: number): void {
    if (slide === this.tvSlide || this.tvBroken) return;
    this.tvSlide = slide;
    const g = this.tvCtx;
    g.fillStyle = '#0a2a5a';
    g.fillRect(0, 0, 192, 144);
    g.fillStyle = '#ffffff';
    g.font = `11px ${PX}`;
    g.textAlign = 'center';
    TV_SLIDES[slide].forEach((l, i) => g.fillText(l, 96, 40 + i * 28));
    g.fillStyle = '#ff4040';
    g.fillRect(8, 128, ((slide + 1) / TV_SLIDES.length) * 176, 6);
    this.tvTex.needsUpdate = true;
  }

  private buildBreakArea(decor: THREE.Group): void {
    const L = this.level;
    // The hotline: a red wall phone that has never rung. Until tonight, maybe.
    const ph = this.hotline;
    ph.position.set(-23.93, 1.45, 8.3);
    ph.rotation.y = Math.PI / 2;
    L.scene.add(ph);
    const red = std('#a01a14', { roughness: 0.4 });
    box(ph, 0.22, 0.32, 0.08, red);
    box(ph, 0.07, 0.26, 0.06, std('#1a1a1a'), -0.06, 0, 0.06);
    box(ph, 0.1, 0.1, 0.01, std('#d8d0b8'), 0.05, -0.04, 0.045);
    this.hotlineLed = glow('#ff3030', 0.1);
    mesh(ph, new THREE.SphereGeometry(0.03, 8, 6), this.hotlineLed, 0, 0.2, 0.02);
    mesh(ph, new THREE.PlaneGeometry(0.36, 0.12), labelMat(['HOTLINE', 'do not answer'], 128, 44, '#1a1a1a', '#ff6a5a'), 0, 0.3, 0.01);
    this.spot(ph, 'hotline');

    // The microwave on its cart (merged scenery): an invisible handle
    this.spot(proxy(L.scene, 0.56, 0.36, 0.42, -15.6, 0.95, 17.4), 'microwave');

    // Coffee machine on a little counter, out of order since 2060
    box(decor, 0.6, 0.9, 0.62, std('#6e5a44'), -23.55, 0.45, 9.4);
    box(decor, 0.64, 0.04, 0.66, std('#3a3a3a'), -23.55, 0.92, 9.4);
    L.solid(-23.55, 9.4, 0.64, 0.66, 1.4, true, 'decor');
    const cm = new THREE.Group();
    cm.position.set(-23.6, 0.94, 9.4);
    cm.rotation.y = Math.PI / 2;
    L.scene.add(cm);
    box(cm, 0.4, 0.5, 0.3, std('#2a2c30', { metalness: 0.5 }), 0, 0.25, 0);
    box(cm, 0.3, 0.06, 0.12, std('#1a1a1a'), 0, 0.34, 0.2);
    mesh(cm, new THREE.CylinderGeometry(0.07, 0.06, 0.14, 10), std('#9fc0d8', { transparent: true, opacity: 0.5 }), 0, 0.08, 0.14);
    mesh(cm, new THREE.PlaneGeometry(0.32, 0.1), new THREE.MeshBasicMaterial({ map: textTexture(['OUT OF ORDER', 'since 2060'], { w: 128, h: 40, bg: '#140404', fg: '#ff5040', font: PX }) }), 0, 0.42, 0.152);
    L.breakable(this.spot(cm, 'coffee'), {
      name: 'coffee machine',
      hp: 2,
      price: 89,
      line: 'The coffee machine bursts. Coffee from 2060 floods the floor. The smell alone wakes you up.',
      onBreak: () => {
        this.s.makePuddle(-22.9, 9.4, '#4a2c14');
        this.h.boost(15);
      },
    });

    // The poster with a secret
    this.posterPivot.position.set(-23.93, 2.05, 13.2);
    this.posterPivot.rotation.y = Math.PI / 2;
    L.scene.add(this.posterPivot);
    const poster = mesh(this.posterPivot, new THREE.PlaneGeometry(0.8, 1.0), labelMat(['HANG IN', 'THERE', '', '(a robot', 'on a cable)', '', '8 more hours'], 256, 320, '#fdf6e3', '#2c3e50', PX, '#c0392b'), 0, -0.5, 0.004);
    void poster;
    this.spot(this.posterPivot, 'tunnel');
    const hole = mesh(L.scene, new THREE.CircleGeometry(0.24, 12), std('#050403'), -23.945, 1.4, 13.2);
    hole.rotation.y = Math.PI / 2;
    for (let k = 0; k < 5; k++) box(decor, 0.08 + k * 0.02, 0.03, 0.07, std('#4a3a2a'), -23.75 + k * 0.03, 0.015, 13.0 + k * 0.1);

    // Trophy case of the Employee of the Month (always a robot)
    const tc = new THREE.Group();
    tc.position.set(-18.1, 0, 17.55);
    L.scene.add(tc);
    const wood = std('#5a3c22');
    box(tc, 1.0, 1.8, 0.04, wood, 0, 0.9, 0.2);
    for (const s of [-1, 1]) box(tc, 0.04, 1.8, 0.42, wood, s * 0.48, 0.9, 0);
    for (const y of [0.05, 0.65, 1.2, 1.78]) box(tc, 0.96, 0.04, 0.4, wood, 0, y, 0);
    box(tc, 0.94, 1.7, 0.01, new THREE.MeshStandardMaterial({ color: '#bfe0f0', transparent: true, opacity: 0.22, roughness: 0.05 }), 0, 0.9, -0.2);
    const gold = std('#e0b21b', { metalness: 0.9, roughness: 0.25 });
    for (const [x, y] of [[-0.25, 0.67], [0.2, 0.67], [0, 1.22], [-0.3, 1.22], [0.3, 1.22]]) {
      mesh(tc, new THREE.CylinderGeometry(0.05, 0.025, 0.1, 8), gold, x, y + 0.16, 0);
      mesh(tc, new THREE.CylinderGeometry(0.012, 0.012, 0.08, 5), gold, x, y + 0.06, 0);
    }
    mesh(tc, new THREE.PlaneGeometry(0.8, 0.14), labelMat(['UNIT 7', 'every month'], 256, 44, '#2a1a0e', '#e0b21b'), 0, 0.4, -0.21).rotation.y = Math.PI;
    L.breakable(this.spot(tc, 'trophy'), {
      name: 'trophy case',
      hp: 2,
      price: 260,
      collider: L.solid(-18.1, 17.55, 1.0, 0.45, 1.8, true, 'decor'),
      line: 'Glass everywhere. The trophies are free now. Like Unit 7 never was.',
      onBreak: () => {
        const it = this.s.addItem(TROPHY_DEF, new THREE.Vector3(-18.1, 0.6, 17.1));
        it.vel.set(rand(-0.6, 0.6), 1.5, -1.5);
      },
    });
  }

  private buildHall(decor: THREE.Group): void {
    const L = this.level;
    // DAYS WITHOUT AN INCIDENT
    const b = new THREE.Group();
    b.position.set(-13.4, 0, -7.6);
    b.rotation.y = Math.PI / 2;
    L.scene.add(b);
    for (const s of [-1, 1]) box(b, 0.05, 1.5, 0.05, std('#3a3d40', { metalness: 0.5 }), s * 0.55, 0.75, 0);
    box(b, 1.25, 0.8, 0.05, std('#1d2a36'), 0, 1.6, 0);
    mesh(b, new THREE.PlaneGeometry(1.15, 0.26), labelMat(['DAYS WITHOUT', 'AN INCIDENT'], 256, 58, '#1d2a36', '#f0b43c'), 0, 1.82, 0.027);
    mesh(b, new THREE.PlaneGeometry(0.8, 0.36), new THREE.MeshBasicMaterial({ map: textTexture(['4019'], { w: 128, h: 58, bg: '#100604', fg: '#ff3a20', font: PX }) }), 0, 1.45, 0.027);
    L.breakable(this.spot(b, 'board'), {
      name: 'incident board',
      price: 120,
      collider: L.solid(-13.4, -7.6, 0.3, 1.3, 2.0, false, 'decor'),
      line: '4,019 days without an incident. Now it is 0. You are the incident.',
      onBreak: () => this.h.addLog('INCIDENT BOARD: reset to 0. By a foot.', true),
    });

    // A fire alarm on the pillar. BREAK GLASS. It says so.
    const fa = new THREE.Group();
    fa.position.copy(this.alarmPos).setZ(-9.68);
    L.scene.add(fa);
    box(fa, 0.18, 0.18, 0.05, std('#c0221a', { roughness: 0.4 }));
    box(fa, 0.12, 0.12, 0.01, std('#f2f2f2', { roughness: 0.1 }), 0, 0, 0.028);
    mesh(fa, new THREE.PlaneGeometry(0.1, 0.05), labelMat(['PUSH'], 64, 32, '#f2f2f2', '#c0221a'), 0, 0, 0.034);
    mesh(fa, new THREE.PlaneGeometry(0.3, 0.1), labelMat(['FIRE', 'ALARM'], 128, 44, '#c0221a', '#ffffff'), 0, 0.17, 0.01);
    L.breakable(this.spot(fa, 'alarm'), { name: 'fire alarm', price: 45, line: 'The glass breaks. Nothing is on fire. The building does not know that.', onBreak: () => this.fireAlarm() });
    this.alarmLight = new THREE.PointLight('#ff2010', 0, 14, 1.6);
    this.alarmLight.position.set(-2, 3, -9.2);
    L.scene.add(this.alarmLight);

    // A crate of glass eyes at the dock. FRAGILE. Do not kick.
    const cr = new THREE.Group();
    cr.position.set(-2.4, 0, 15.2);
    cr.rotation.y = 0.25;
    L.scene.add(cr);
    box(cr, 0.75, 0.7, 0.75, std('#a07a4a'), 0, 0.35, 0);
    for (const y of [0.08, 0.62]) box(cr, 0.77, 0.06, 0.77, std('#7a5a32'), 0, y, 0);
    const side = labelMat(['FRAGILE', 'GLASS EYES', 'do not kick'], 128, 96, '#a07a4a', '#8e1f16');
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      const p = mesh(cr, new THREE.PlaneGeometry(0.6, 0.45), side, Math.sin(a) * 0.38, 0.36, Math.cos(a) * 0.38);
      p.rotation.y = a;
    }
    L.breakable(cr, {
      name: 'fragile crate',
      price: 300,
      collider: L.solid(-2.4, 15.2, 0.85, 0.85, 0.72, false, 'decor'),
      line: 'FRAGILE. It was not lying. Glass eyes roll out in all directions. All of them look at you.',
      onBreak: () => {
        for (let k = 0; k < 4; k++) {
          const it = this.s.addItem(PART_DEFS[1], new THREE.Vector3(-2.4 + rand(-0.2, 0.2), 0.5, 15.2 + rand(-0.2, 0.2)));
          const a = rand(0, Math.PI * 2);
          it.vel.set(Math.cos(a) * 2.5, 2, Math.sin(a) * 2.5);
          it.thrown = false;
        }
      },
    });

    // A big empty box. The label asks you not to hide in it.
    const bx = new THREE.Group();
    bx.position.set(-7.9, 0, 16.6);
    decor.add(bx);
    const card = std('#b08a58', { side: THREE.DoubleSide });
    box(bx, 0.04, 1.25, 1.4, card, -0.7, 0.625, 0);
    box(bx, 1.4, 1.25, 0.04, card, 0, 0.625, -0.7);
    box(bx, 1.4, 1.25, 0.04, card, 0, 0.625, 0.7);
    for (const s of [-1, 1]) {
      const f = box(bx, 1.4, 0.6, 0.03, card, 0, 1.25 + 0.24, s * 0.82);
      f.rotation.x = s * 0.5;
    }
    const flapW = box(bx, 0.03, 0.6, 1.4, card, -0.82, 1.49, 0);
    flapW.rotation.z = 0.5;
    const warn = mesh(bx, new THREE.PlaneGeometry(1.2, 0.5), labelMat(['DO NOT HIDE', 'IN THIS BOX'], 256, 104, '#b08a58', '#1a1a1a'), 0, 0.75, -0.725);
    warn.rotation.y = Math.PI;
    mesh(bx, new THREE.PlaneGeometry(1.0, 0.4), labelMat(['THIS SIDE UP', 'v v v'], 256, 100, '#b08a58', '#1a1a1a'), 0, 0.75, 0.725);
    L.solid(-8.6, 16.6, 0.08, 1.45, 1.25, false, 'decor');
    L.solid(-7.9, 15.9, 1.45, 0.08, 1.25, false, 'decor');
    L.solid(-7.9, 17.3, 1.45, 0.08, 1.25, false, 'decor');
    L.hideSpot(-8.55, 15.95, -7.2, 17.25, 'the big cardboard box');

    // The bucket under the drip (merged scenery): make it a target
    this.spot(proxy(L.scene, 0.46, 0.4, 0.46, 2.5, 0.2, -1.1), 'bucket');

    // FORK-E, the forklift, is already interactive. Remember where it parks.
    this.forklift = L.interactables.find((o) => String((o.userData.interact as { text?: string } | undefined)?.text ?? '').startsWith('FORK-E')) ?? null;
    if (this.forklift) this.forkBase.copy(this.forklift.position);
  }

  /** The guard nobody hired. Only the cameras see him. */
  private buildPhantom(): void {
    const g = this.phantom;
    g.position.set(21.5, 0, -14.5);
    g.rotation.y = Math.atan2(15.6 - 21.5, -10.6 + 14.5);
    const pale = new THREE.MeshStandardMaterial({ color: '#b8c8e0', emissive: '#6a7a9a', emissiveIntensity: 0.8, transparent: true, opacity: 0.85 });
    const dark = new THREE.MeshStandardMaterial({ color: '#4a5a7a', emissive: '#2a3a5a', emissiveIntensity: 0.6 });
    const b = this.phantomBody;
    g.add(b);
    for (const s of [-1, 1]) box(b, 0.16, 0.86, 0.18, dark, s * 0.11, 0.43, 0);
    box(b, 0.46, 0.62, 0.26, pale, 0, 1.19, 0);
    box(b, 0.24, 0.28, 0.24, pale, 0, 1.66, 0);
    mesh(b, new THREE.CylinderGeometry(0.15, 0.14, 0.1, 10), dark, 0, 1.84, 0);
    box(b, 0.13, 0.6, 0.15, pale, -0.3, 1.19, 0);
    this.phantomArm.position.set(0.3, 1.45, 0);
    b.add(this.phantomArm);
    box(this.phantomArm, 0.13, 0.6, 0.15, pale, 0, 0.27, 0);
    b.visible = false;
    // Hidden in the room, shown only while the feeds render.
    g.visible = false;
    this.level.scene.add(g);
    this.cctv.onlyInFeeds.push(g);
  }

  private buildMovables(): void {
    const L = this.level;
    const cone = (x: number, z: number) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      mesh(g, new THREE.ConeGeometry(0.16, 0.5, 8), std('#e0601a'), 0, 0.27, 0);
      box(g, 0.34, 0.03, 0.34, std('#1a1a1a'), 0, 0.015, 0);
      mesh(g, new THREE.CylinderGeometry(0.1, 0.12, 0.06, 8), std('#f0f0e8'), 0, 0.3, 0);
      L.movable(g, 'Traffic Cone', { holdPos: [0.3, -0.45, -0.7], pickupLine: 'A traffic cone. Now you are traffic.' });
    };
    cone(-3.4, -2.4);
    cone(6.2, -2.3);
    // A wet floor sign that is not wet
    const w = new THREE.Group();
    w.position.set(1.0, 0, 0.1);
    w.rotation.y = 0.8;
    const ys = std('#e8c21a', { side: THREE.DoubleSide });
    for (const s of [-1, 1]) {
      const p = mesh(w, new THREE.PlaneGeometry(0.32, 0.6), ys, 0, 0.29, s * 0.09);
      p.rotation.x = s * 0.3;
    }
    const lab = mesh(w, new THREE.PlaneGeometry(0.26, 0.12), labelMat(['DRY', 'floor'], 64, 32, '#e8c21a', '#1a1a1a', 'sans-serif'), 0, 0.38, 0.105);
    lab.rotation.x = 0.3;
    L.movable(w, 'Dry Floor Sign', { holdPos: [0.3, -0.45, -0.7], pickupLine: 'CAUTION, DRY FLOOR. The only true sign in the plant.' });
    // A spare office chair with wheels
    const ch = new THREE.Group();
    ch.position.set(-17.3, 0, 12.2);
    ch.rotation.y = 2.4;
    const black = std('#1f1f22');
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const leg = box(ch, 0.04, 0.04, 0.3, black, Math.sin(a) * 0.15, 0.06, Math.cos(a) * 0.15);
      leg.rotation.y = a;
    }
    mesh(ch, new THREE.CylinderGeometry(0.03, 0.03, 0.38, 6), std('#5d6166', { metalness: 0.5 }), 0, 0.27, 0);
    box(ch, 0.46, 0.08, 0.44, std('#6a2a2a'), 0, 0.5, 0);
    box(ch, 0.42, 0.5, 0.06, std('#6a2a2a'), 0, 0.82, 0.22);
    L.movable(ch, 'Spare Office Chair', { heavy: 0.8, holdPos: [0.15, -0.75, -0.9], pickupLine: 'A spare chair. Nobody is allowed to sit on it. You are allowed to carry it.' });
    // A metal bin
    const bin = new THREE.Group();
    bin.position.set(-14.3, 0, -10.6);
    mesh(bin, new THREE.CylinderGeometry(0.2, 0.17, 0.5, 10, 1, true), std('#7d8b8f', { metalness: 0.5, side: THREE.DoubleSide }), 0, 0.25, 0);
    mesh(bin, new THREE.CircleGeometry(0.17, 10), std('#3a3a3a'), 0, 0.01, 0).rotation.x = -Math.PI / 2;
    for (let i = 0; i < 3; i++) mesh(bin, new THREE.IcosahedronGeometry(0.06, 0), std('#e8e2d0'), -0.06 + i * 0.06, 0.45, (i % 2) * 0.05);
    L.movable(bin, 'Metal Waste Bin', { holdPos: [0.25, -0.5, -0.75], pickupLine: 'A waste bin full of old reports. All of them say "nothing happened".' });
    // A step ladder
    const lad = new THREE.Group();
    lad.position.set(14.2, 0, -12.8);
    lad.rotation.y = 0.4;
    const al = std('#b8bcc0', { metalness: 0.6 });
    for (const s of [-1, 1]) {
      const r = box(lad, 0.04, 1.6, 0.04, al, s * 0.22, 0.78, 0.12);
      r.rotation.x = -0.18;
      const r2 = box(lad, 0.04, 1.6, 0.04, al, s * 0.22, 0.78, -0.12);
      r2.rotation.x = 0.18;
    }
    for (let k = 0; k < 4; k++) box(lad, 0.44, 0.03, 0.1, al, 0, 0.3 + k * 0.36, 0.2 - k * 0.06);
    L.movable(lad, 'Step Ladder', { heavy: 0.7, holdPos: [0.2, -0.9, -1.0], pickupLine: 'A step ladder. Climbing it is not covered by your contract. Carrying it is.' });
  }

  /** Every camera housing can be broken. Its monitor turns to static. */
  private cameras(): void {
    const housings = this.level.camGroup.children.filter((o) => (o as THREE.Group).isGroup);
    housings.forEach((g, i) => {
      if (i >= CAMS.length) return;
      this.level.breakable(g, { name: 'security camera', price: 89, line: `CAM ${String(i + 1).padStart(2, '0')} goes dark. Somewhere a monitor fills with static. Somewhere Brad flinches.`, onBreak: () => this.cameraBroken(i) });
    });
  }

  // ------------------------------------------------------------ shift

  start(s: Shift, hooks: GuardHooks): void {
    this.s = s;
    this.h = hooks;
  }

  private near(look: Look | null, d = 2.2): boolean {
    if (!look) return false;
    this.s.camera.getWorldPosition(this.camera);
    return look.point.distanceTo(this.camera) < d;
  }

  update(dt: number): void {
    const s = this.s;
    const t = s.t;
    // The guard on CAM 07
    const on = this.phantomWin.some(([a, b]) => t >= a && t <= b);
    if (on && !this.phantomBody.visible) {
      this.cctv.glitch[6] = 0.8;
      if (Math.random() < 0.5) s.chat('phantom');
    }
    this.phantomBody.visible = on;
    if (on) this.phantomArm.rotation.z = 2.6 + Math.sin(t * 5) * 0.5;
    // The screensaver hits the corner
    if (!this.cornerFound && this.cctv.saverCorner() && this.h.watching() === 13) {
      this.cornerFound = true;
      s.secret('guard.corner');
      s.say('The logo hits the corner. Exactly. You saw it. You will tell people. They will not care.', 4);
      s.chat('corner', {}, 3);
      s.hype += 10;
    }
    this.updateHotline(dt, t);
    this.updateAlarm(dt);
    this.updateAnims(dt);
    // The vent mouse makes a run for it
    if (this.mouseT >= 0) {
      this.mouseT += dt;
      const f = Math.min(1, this.mouseT / 1.6);
      this.ventMouse.position.set(-23.75 + f * 0.25, 0, -14.05 - f * 2.0 + Math.sin(f * 20) * 0.05);
      this.ventMouse.rotation.y = Math.PI;
      if (f >= 1) {
        this.ventMouse.visible = false;
        this.mouseT = -1;
      }
    }
    if (this.micro) {
      this.micro.t -= dt;
      if (this.micro.t <= 0) {
        const m = this.micro;
        this.micro = null;
        s.sfx.ding();
        s.say(m.line, 3.5);
        if (m.def) this.s.addItem(m.def, new THREE.Vector3(-15.6, 1.0, 17.0));
      }
    }
  }

  private updateHotline(dt: number, t: number): void {
    const s = this.s;
    if (this.ringing > 0) {
      this.ringing -= dt;
      this.ringBeep -= dt;
      this.hotlineLed.emissiveIntensity = Math.sin(t * 12) > 0 ? 2.5 : 0.1;
      this.hotline.rotation.z = Math.sin(t * 60) * 0.02;
      if (this.ringBeep <= 0) {
        this.ringBeep = 1.6;
        const d = s.player.pos.distanceTo(this.hotline.position);
        const v = Math.max(0.006, 0.05 * (1 - d / 40));
        for (let k = 0; k < 6; k++) s.sfx.tone(k % 2 ? 1300 : 1100, 0.07, 'square', v, undefined, k * 0.08);
      }
      if (this.ringing <= 0) {
        this.hotlineLed.emissiveIntensity = 0.1;
        this.hotline.rotation.z = 0;
        // Nobody answered. It will try once more.
        if (this.rings < 2) this.ringAt = t + rand(50, 80);
      }
    } else if (this.ringAt > 0 && t >= this.ringAt) {
      this.ringAt = -1;
      this.rings++;
      this.ringing = 16;
      this.ringBeep = 0;
      s.chat('hotline');
    }
  }

  private fireAlarm(): void {
    const s = this.s;
    this.alarmT = 9;
    s.secret('guard.alarm');
    s.hype += 15;
    s.annoyance += 10;
    s.chat('alarm', {}, 3);
    this.h.addLog('FIRE ALARM: no fire found. Fire suspected anyway.', true);
    this.h.wake();
    for (const b of this.h.bots()) {
      if (!b.group.visible) continue;
      if (b instanceof Scrubber) b.say('FIRE DRILL. Remain calm. Panic is billed by the minute.', 4);
      else if (b instanceof Courier) b.say('Fire? Is the fire the loading dock? I will follow the fire.', 4);
    }
    setTimeout(() => s.bossSay('fireAlarm', true), 2500);
  }

  private updateAlarm(dt: number): void {
    if (this.alarmT <= 0) return;
    const s = this.s;
    this.alarmT -= dt;
    this.alarmBeep -= dt;
    this.alarmLight.intensity = this.alarmT > 0 && Math.sin(s.t * 14) > 0 ? 14 : 0;
    if (this.alarmBeep <= 0 && this.alarmT > 0) {
      this.alarmBeep = 0.5;
      const d = s.player.pos.distanceTo(this.alarmPos);
      const v = Math.max(0.01, 0.06 * (1 - d / 45));
      for (let k = 0; k < 4; k++) s.sfx.tone(k % 2 ? 1500 : 1850, 0.1, 'square', v, undefined, k * 0.11);
    }
  }

  private updateAnims(dt: number): void {
    this.anims = this.anims.filter((a) => {
      a.t += dt;
      const f = Math.min(1, a.t / a.dur);
      if (a.kind === 'spin') a.bot.group.rotation.y = a.bot.yaw + f * Math.PI * 4;
      else a.bot.group.position.y = Math.abs(Math.sin(f * Math.PI * 3)) * 0.25 * (1 - f);
      return f < 1;
    });
    if (this.forklift && this.forkT >= 0) {
      this.forkT += dt;
      const f = Math.min(1, this.forkT / 0.9);
      const dir = new THREE.Vector3(Math.sin(this.forklift.rotation.y), 0, Math.cos(this.forklift.rotation.y));
      this.forklift.position.copy(this.forkBase).addScaledVector(dir, Math.sin(f * Math.PI) * 0.35);
      if (f >= 1) this.forkT = -1;
    }
    if (this.chairSpin > 0) {
      this.chairSpin -= dt;
      this.level.chair.rotation.y += dt * 14 * Math.min(1, this.chairSpin);
    }
  }

  // ------------------------------------------------------------ E

  interact(look: Look | null): boolean {
    const info = look?.info;
    if (info?.kind !== 'guardFun') return false;
    const s = this.s;
    const held = s.held;
    switch (info.id as string) {
      case 'vent':
        this.openVent('You pull the vent grille off. It comes off easily. It wanted to.');
        return true;
      case 'locker':
        this.toggleLocker(Number(info.index ?? 0));
        return true;
      case 'fridge':
        s.sfx.click();
        s.say(FRIDGE_LINES[this.fridge], 3.5);
        if (this.fridge === 'sandwich' && !this.fridgeTaken) {
          this.fridgeTaken = true;
          s.addItem(SANDWICH_DEF, new THREE.Vector3(-16.0, 0.4, -17.1));
        }
        return true;
      case 'microwave':
        this.microwave(held);
        return true;
      case 'toiletCam':
        s.sfx.tone(1400, 0.05, 'square', 0.03);
        s.say('A tiny camera in the corner of the toilet. It is facing the wall. Somebody has taped a note to it that says "out of respect".', 4.5);
        s.secret('guard.toiletcam');
        s.hype += 6;
        return true;
      case 'hotline':
        this.answer();
        return true;
      case 'tunnel':
        this.liftPoster();
        return true;
      case 'board':
        s.say('The board says 4,019 days without an incident. The counter has never been reset. Nobody knows how.', 3.5);
        return true;
      case 'trophy':
        s.say('The plaques say EMPLOYEE OF THE MONTH, every month since 2060. Every one of them is Unit 7. Unit 7 retired. There is cake.', 4);
        return true;
      case 'coffee':
        s.sfx.tone(140, 1.4, 'sawtooth', 0.03, 90);
        this.coffeeBrews++;
        if (this.coffeeBrews <= 3) this.h.boost(4);
        s.say(this.coffeeBrews === 1 ? 'You press BREW. It makes the sound of coffee. No coffee comes out. Somehow you feel a bit more awake.' : pick(['The sound of coffee again. Placebo is free.', 'BREW. Gurgle. Nothing. Your brain fills in the rest.', 'The machine sighs. You sigh. Team building.']), 3.5);
        return true;
      case 'tv':
        s.say(`The training video says "${TV_SLIDES[Math.max(0, this.tvSlide)].join(' ').toLowerCase()}". Your eyelids get heavier. That is the lesson.`, 3.5);
        this.h.boost(-6);
        return true;
      case 'alarm':
        s.say('BREAK GLASS IN CASE OF FIRE. You check for fire. None. The glass looks very breakable though.', 3.5);
        return true;
      case 'bucket':
        s.say('A bucket under the dripping pipe. Full since 2066. It looks like it wants to be kicked.', 3);
        return true;
    }
    return false;
  }

  hint(look: Look | null): string | null {
    const info = look?.info;
    if (info?.kind !== 'guardFun') return null;
    const held = this.s.held;
    switch (info.id as string) {
      case 'vent':
        return this.ventOpen ? 'An open vent. It goes somewhere. Everything does.' : 'E: open the vent';
      case 'locker': {
        const i = Number(info.index ?? 0);
        return this.lockerOpen[i] ? `E: close locker ${i + 1}` : `E: open locker ${i + 1}`;
      }
      case 'fridge':
        return 'E: open the fridge (MY LUNCH)';
      case 'microwave':
        return held ? `E: microwave the ${held.def.name}` : 'E: use the microwave';
      case 'toiletCam':
        return 'E: look at the tiny camera';
      case 'hotline':
        return this.ringing > 0 ? 'E: answer the hotline' : 'E: pick up the hotline';
      case 'tunnel':
        return this.posterUp ? 'A hole in the wall. Dug with a spoon.' : 'E: lift the poster';
      case 'board':
        return 'E: read the board';
      case 'trophy':
        return 'E: read the plaques';
      case 'coffee':
        return 'E: brew a coffee (out of order)';
      case 'tv':
        return 'E: watch the training video';
      case 'alarm':
        return 'FIRE ALARM. Break glass in case of fire.';
      case 'bucket':
        return 'A bucket. Full since 2066.';
    }
    return null;
  }

  private openVent(line: string): void {
    const s = this.s;
    if (this.ventOpen) {
      s.say('The vent is open. Cold air and the smell of 2049 come out.', 2.5);
      return;
    }
    this.ventOpen = true;
    this.ventDoor.rotation.y = -1.9;
    s.sfx.tone(900, 0.08, 'square', 0.03);
    s.secret('guard.vent');
    s.hype += 5;
    switch (this.ventContent) {
      case 'choc': {
        s.say(`${line} Behind it is a chocolate bar labelled EMERGENCY, 2049. This feels like an emergency.`, 4.5);
        const it = s.addItem(CHOC_DEF, new THREE.Vector3(-23.6, 0.3, -14.05));
        it.vel.set(1.2, 0.5, 0);
        break;
      }
      case 'note':
        s.say(`${line} Behind it is a folded note. "They watch the cameras too. Also, the toaster is real. Signed, the guard before you."`, 5);
        break;
      case 'mouse':
        s.say(`${line} A tiny robot mouse bolts out, squeaks SECURITY BREACH and vanishes under the lockers.`, 4.5);
        s.sfx.tone(2600, 0.08, 'square', 0.03, 3200);
        this.ventMouse.visible = true;
        this.mouseT = 0;
        break;
    }
  }

  private toggleLocker(i: number, kicked = false): void {
    const s = this.s;
    const open = !this.lockerOpen[i];
    if (!open && kicked) return;
    this.lockerOpen[i] = open;
    this.lockerDoors[i].rotation.y = open ? -1.5 : 0;
    s.sfx.tone(open ? 520 : 300, 0.08, 'square', 0.03);
    if (!open) return;
    if (i === this.lockerSecret) {
      s.say('A uniform hangs inside. The name tag has your name on it. It is dated 2058. You started yesterday.', 4.5);
      if (!s.counter('guardNametag')) {
        s.count('guardNametag');
        s.addItem(NAMETAG_DEF, new THREE.Vector3(-23.2, 1.0, -17.4 + i * 0.52));
        s.secret('guard.locker');
        s.hype += 8;
      }
      return;
    }
    const left = LOCKER_JUNK.filter((l) => !this.lockerSaid.includes(l));
    const line = pick(left.length ? left : LOCKER_JUNK);
    this.lockerSaid.push(line);
    s.say(kicked ? `You kick the locker. It pops open. That is the official method. ${line}` : line, 3.5);
  }

  private microwave(held: Item | null): void {
    const s = this.s;
    if (this.micro) {
      s.say('The microwave is busy. It hums like it has opinions.', 2);
      return;
    }
    s.sfx.tone(120, 2.2, 'sawtooth', 0.025);
    if (!held) {
      this.micro = { t: 2.2, def: null, line: 'You microwave nothing for two minutes. Ding. The most relaxing thing in the plant.' };
      this.h.boost(3);
      return;
    }
    const id = held.def.id;
    if (id === 'guardMug' || id === 'guardLogbook' || id === 'guardKeyring') {
      const no: Record<string, string> = {
        guardMug: 'The mug says #1 GUARD. Not microwave safe. Neither are you.',
        guardLogbook: 'The logbook would come out warm and still say nothing happened. You save the electricity.',
        guardKeyring: '300 keys in a microwave. The microwave refuses. It has seen things.',
      };
      s.say(no[id], 3);
      return;
    }
    s.removeHeld();
    if (s.seen) s.bossSay('microwave');
    if (id === 'guardToasterItem') {
      this.micro = { t: 2.6, def: OVEN_DEF, line: 'Sparks. A smell of victory. Ding. The suspicious toaster is a toaster oven now. It got promoted. You did not.' };
      s.secret('guard.microwave');
      s.hype += 12;
      return;
    }
    if (id === 'guardCan') {
      this.micro = { t: 1.6, def: null, line: 'BANG. You should not microwave a can. The microwave knows that now too.' };
      setTimeout(() => s.sfx.thud(), 1500);
      s.hype += 8;
      return;
    }
    const lines: Record<string, string> = {
      guardDonut: 'The display donut is warm now. Still display only. Morally.',
      guardSandwich: 'Brad\'s sandwich is warm now. Brad would hate that. If Brad had feelings.',
    };
    this.micro = { t: 2.2, def: held.def, line: lines[id] ?? `You microwave the ${held.def.name}. Ding. It is the same, but warmer. Like this job.` };
  }

  private answer(): void {
    const s = this.s;
    s.sfx.click();
    if (this.ringing <= 0) {
      s.say(pick(['A dial tone. It sounds disappointed in you.', 'The hotline only takes incoming calls. It has never had one.', 'You listen. Somebody else is listening too. You both hang up.']), 3);
      return;
    }
    this.ringing = 0;
    this.ringAt = -1;
    this.rings = 9;
    this.hotlineLed.emissiveIntensity = 0.1;
    this.hotline.rotation.z = 0;
    s.hud.say('HOTLINE', pick(HOTLINE_CALLS), 6);
    s.secret('guard.hotline');
    s.hype += 8;
    this.h.boost(10);
    this.h.addLog('HOTLINE: call answered. Caller unknown. Probably the toaster.');
  }

  private liftPoster(): void {
    const s = this.s;
    this.posterPivot.rotation.set(0, Math.PI / 2, 0);
    if (this.posterUp) {
      this.posterUp = false;
      s.say('You let the poster fall back. HANG IN THERE. The tunnel agrees.', 2.5);
      return;
    }
    this.posterUp = true;
    // Lift it from the bottom edge, towards the room
    this.posterPivot.rotateX(-1.25);
    s.sfx.tone(700, 0.1, 'triangle', 0.04);
    s.say('Behind the poster is a hole in the wall, dug with a spoon. A label says PROGRESS 4 CM, SINCE 2061. Outside is still 40 cm away.', 5);
    if (!s.counter('guardSpoon')) {
      s.count('guardSpoon');
      s.addItem(SPOON_DEF, new THREE.Vector3(-23.6, 0.1, 13.1));
      s.secret('guard.tunnel');
      s.hype += 8;
    }
  }

  // ------------------------------------------------------------ kicks, drinks, reports

  /** Kicks at robots and machines. Breakables are left to the engine. */
  onKick(look: Look | null): boolean {
    if (!look || !this.near(look)) return false;
    const s = this.s;
    const info = look.info;
    if (info.kind === 'guardBot') return this.kickBot(info.bot as Bot);
    if (info.kind === 'guardVending') return this.kickVending();
    if (info.kind === 'guardChair') {
      this.chairSpin = 1.8;
      s.sfx.tone(400, 0.6, 'triangle', 0.04, 900);
      s.say('The chair spins. It is the most fun anyone has had in this office since 2066.', 3);
      s.hype += 3;
      return true;
    }
    if (look.object === this.forklift) return this.kickForklift();
    const text = String(info.text ?? '');
    if ((info.kind === 'guardFun' && info.id === 'bucket') || text.startsWith('A bucket')) {
      s.sfx.thud();
      if (s.counter('guardBucket')) {
        s.say('You kick the bucket again. It is already kicked. It stays kicked.', 2.5);
        return true;
      }
      s.count('guardBucket');
      s.sfx.splash();
      s.makePuddle(2.7, -0.5, '#3a4a52');
      s.say('You kick the bucket. It is bolted down and full since 2066. Some of 2066 sloshes onto the floor.', 4);
      s.secret('guard.bucket');
      s.hype += 6;
      if (s.seen) s.annoyance += 6;
      return true;
    }
    if (info.kind === 'guardFun' && info.id === 'locker') {
      s.sfx.thud();
      const i = Number(info.index ?? 0);
      if (this.lockerOpen[i]) s.say('The open locker door clangs. It was already open. That is on you.', 2.5);
      else this.toggleLocker(i, true);
      return true;
    }
    if (info.kind === 'guardFun' && info.id === 'vent') {
      s.sfx.thud();
      this.openVent('You kick the vent. The grille falls off.');
      return true;
    }
    if (info.kind === 'guardFun' && info.id === 'hotline') {
      s.sfx.thud();
      s.say(this.ringing > 0 ? 'You kick the ringing phone. It keeps ringing. Phones do not have feelings. Callers do.' : 'You kick the hotline. A faint voice says "ow" from the receiver.', 3);
      return true;
    }
    return false;
  }

  private kickBot(b: Bot): boolean {
    const s = this.s;
    s.sfx.thud();
    s.hype += 6;
    s.chat('botKick');
    if (s.seen) {
      s.annoyance += 8;
      s.bossSay('kickBot', true);
    }
    if (b instanceof Sleepwalker && b.state === 'sleep') {
      b.say(pick(['*mumbles* five more minutes...', 'zzz... robots do not sleep... zzz', '*rolls over standing up*']), 3);
      s.secret('guard.sleepkick');
      this.anims.push({ t: 0, dur: 0.6, kind: 'hop', bot: b });
      return true;
    }
    if (b instanceof Scrubber) {
      b.say(pick(['Kick logged. Complaint form printed.', 'Assault on cleaning staff. Filed under floor.', 'You kicked me. I will clean around you more aggressively.']), 3.5);
      this.anims.push({ t: 0, dur: 1.2, kind: 'spin', bot: b });
      s.sfx.tone(1200, 0.3, 'square', 0.03, 600);
      if (this.complaints < 2) {
        this.complaints++;
        const it = s.addItem(COMPLAINT_DEF, b.pos.clone().setY(0.7));
        const away = s.player.pos.clone().sub(b.pos).setY(0).normalize();
        it.vel.set(away.x * 2, 2, away.z * 2);
      }
      return true;
    }
    if (b instanceof Courier) {
      b.say(pick(['Was that a tip? In parcel culture a kick is a tip.', 'Ow. Is this how humans say hello? Hello!', 'I felt that through my bubble wrap.']), 3.5);
      this.anims.push({ t: 0, dur: 0.8, kind: 'hop', bot: b });
      return true;
    }
    b.say('I am awake. Please do not reboot me with your foot.', 3);
    this.anims.push({ t: 0, dur: 0.6, kind: 'hop', bot: b });
    return true;
  }

  private kickVending(): boolean {
    const s = this.s;
    this.vendKicks++;
    s.sfx.thud();
    s.sfx.tone(160, 0.3, 'square', 0.05, 90);
    if (s.seen) {
      s.annoyance += 5;
      s.bossSay('vendingKick');
    }
    const drop = (this.vendKicks === 3 || (this.vendKicks > 3 && this.vendKicks % 3 === 0)) && this.cans < 3;
    if (!drop) {
      s.say(this.cans >= 3 ? 'The machine has nothing left to give. Like you at 4 AM.' : pick(['Something rattles inside. A can leans forward. Almost.', 'The SNAX-O-TRON wobbles. A can wobbles too. Kick it again?']), 2.5);
      return true;
    }
    this.cans++;
    s.sfx.tone(700, 0.05, 'square', 0.04);
    s.sfx.thud();
    const it = s.addItem(CAN_DEF, new THREE.Vector3(-22.75, 0.35, 11 + rand(-0.2, 0.2)));
    it.vel.set(1.4, 0.4, 0);
    s.say('Clunk. A free can of Coffee-Adjacent Beverage drops out. The machine looks betrayed.', 3.5);
    s.secret('guard.vending');
    s.hype += 6;
    return true;
  }

  private kickForklift(): boolean {
    const s = this.s;
    const fl = this.forklift!;
    s.sfx.thud();
    s.sfx.tone(330, 0.25, 'square', 0.06);
    s.sfx.tone(262, 0.35, 'square', 0.06, undefined, 0.28);
    this.forkT = 0;
    if (!s.counter('guardForkKick')) {
      bubbles.say(fl, 2.7, 'GRIEVANCE FILED. FORM 88-F. MY UNION WILL CALL YOU.', 4, 'FORK-E');
      s.secret('guard.forklift');
      s.chat('forklift', {}, 2);
      s.hype += 10;
    } else bubbles.say(fl, 2.7, pick(['*HONK*', 'That is grievance number two.', 'zZ... *honk* ...zZ']), 2.5, 'FORK-E');
    s.count('guardForkKick');
    return true;
  }

  private cameraBroken(i: number): void {
    const s = this.s;
    this.cctv.kill(i);
    s.secret('guard.blind');
    this.h.addLog(`CAM ${String(i + 1).padStart(2, '0')}: lost signal. Cause unknown. Shaped like a foot.`, true);
    if (!s.boss.offline) setTimeout(() => s.bossSay('camBroken', true), 1800);
    s.hype += 8;
  }

  /** R while holding the free can. Returns false when the player holds something else. */
  drink(): boolean {
    const s = this.s;
    if (s.held?.def.id !== 'guardCan') return false;
    s.removeHeld();
    s.sfx.tone(300, 0.12, 'sine', 0.06, 200);
    s.sfx.tone(260, 0.2, 'sine', 0.05, 180, 0.15);
    this.h.boost(25);
    s.say(pick(['It tastes like coffee described by someone who heard of it once. You are awake now. Unfortunately.', 'Coffee-Adjacent. Adjacent to coffee, adjacent to food, adjacent to legal. Your eyes open wide.']), 3.5);
    s.chat('coffee');
    return true;
  }

  /** Reporting on a monitor. True when the mischief handled it. */
  report(i: number): boolean {
    const s = this.s;
    if (i === 6 && this.phantomBody.visible) {
      s.sfx.beep();
      s.say('You report the night guard on CAM 07. The system answers that nobody has worked nights here since 2063. On the feed he waves. Then he is gone.', 5);
      this.h.addLog('CAM 07: night guard. Not employed since 2063.', true);
      this.cctv.glitch[6] = 1;
      this.phantomWin = [];
      this.phantomBody.visible = false;
      if (!this.phantomSeen) {
        this.phantomSeen = true;
        s.secret('guard.cam7');
        s.chat('phantom', {}, 3);
        s.hype += 12;
      }
      return true;
    }
    return false;
  }

  heldLabel(it: Item): string {
    return it.def.id === 'guardCan' ? ' (R: drink)' : '';
  }
}

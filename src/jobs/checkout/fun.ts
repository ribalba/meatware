import * as THREE from 'three';
import type { ModelSpec } from '../../assets';
import type { BreakableState } from '../../fun';
import { Item, ItemDef, ITEM_DEFS } from '../../items';
import type { Interact } from '../../level';
import { pick, rand, textTexture } from '../../util';
import type { Look, Shift } from '../types';
import { Bot } from './bots';
import { OIL_DEF } from './items';
import { COUNTER, LANES, ROOM, SELF_CHECKOUTS } from './layout';
import type { CheckoutLevel } from './level';

/**
 * Mischief and secrets at SHOPOTRON EXPRESS: things to break, carry around and hide in, and a lot
 * of things nobody mentions in the training video. Built into the level when the job is created,
 * driven by CheckoutJob.
 */

const M = `${import.meta.env.BASE_URL}models/checkout/fun`;
export const CHECKOUT_FUN_MODELS: Record<string, ModelSpec> = {
  coFunCone: { url: `${M}/cone.glb`, height: 0.55 },
  coFunChair: { url: `${M}/chair.glb`, height: 0.9 },
  coFunLounge: { url: `${M}/loungeChair.glb`, width: 0.9 },
  coFunLamp: { url: `${M}/lampSquareFloor.glb`, height: 1.6 },
  coFunRadio: { url: `${M}/radio.glb`, width: 0.34 },
};

export const CHECKOUT_SECRETS: Record<string, string> = {
  'checkout.note': 'Found the note under a closed lane',
  'checkout.pa': 'Used the lane 7 intercom',
  'checkout.gacha': 'Kicked a prize out of the gacha machine',
  'checkout.bottles': 'Fed the bottle return something that is not a bottle',
  'checkout.oilKey': 'Found the key to the robot oil cabinet',
  'checkout.cabinet': 'Opened the robot oil cabinet (18+)',
  'checkout.tv': 'Fixed the TV by throwing something at it',
  'checkout.phone': 'Answered the customer service phone',
  'checkout.closet': 'Found lane 0 in the broom closet',
  'checkout.selfscan': 'Scanned yourself at Self Checkout 4',
  'checkout.toddlerCandy': 'Bribed Junior with candy',
  'checkout.music': 'Pressed the button under the register',
  'checkout.mags': 'Read the magazine about yourself',
  'checkout.outside': 'Waved at the robot in the rain',
  'checkout.kickScan': 'Fixed the scanner the traditional way',
  'checkout.stool': 'Brought a stool to lane 7',
};

export const CHECKOUT_FUN_BOSS: Record<string, string[]> = {
  kickCustomer: [
    'Kicking customers is not a payment method.',
    'That robot was a valued customer. It is now a valued plaintiff.',
    'I saw that. I am adding "uses feet" to your profile.',
  ],
  camBroken: ['Camera 5 is down. I will now watch the toilet personally.', 'You broke my camera. I have other eyes. Many other eyes.'],
  pa: ['Unauthorized announcement. Only I announce things.', 'Who used the intercom? That voice was human. Disgusting.'],
  stool: ['Is that a stool? At lane 7? Confiscated. Sitting is a privilege.', 'A stool. How decadent. Confiscated.'],
  cabinet: ['The oil cabinet is open. Who has the key? I have the key. Where is my key?'],
  phoneSeen: ['Personal calls are deducted per syllable.'],
};

export const CHECKOUT_FUN_CHAT: Record<string, string[]> = {
  kickBot: ['KICKED THE CUSTOMER', 'customer service (with feet)', 'violence at lane 7', 'not the roomba!!!', 'the loyalty program got physical'],
  pa: ['HE IS ON THE INTERCOM', 'price check on everything lol', 'the voice of a human. chills.', 'lane 7 announcements are canon'],
  gacha: ['GACHA WIN', 'kicked it out of the machine', 'mystery bolt!!!', 'it is just a bolt lmao'],
  tv: ['HE FIXED THE TV', 'we are on tv', 'that is us watching him watching us', 'hi mom'],
  vending: ['FREE SNACKS', 'vending machine down', 'snack heist at lane 7', 'the snacks are loose'],
  lobster: ['THE LOBSTERS ESCAPED', 'robot lobster on the loose', 'code 4563', 'run little lobster'],
  cans: ['THE BOTTOM ONE', 'he took the bottom can', 'can avalanche', 'jenga but beans'],
  phone: ['WHO IS CALLING', 'answer it!!!', 'a landline. in 2071.', 'is it brad\'s mom'],
  music: ['ELEVATOR MUSIC', 'the queue is dancing', 'banger', 'lane 7 after dark'],
};

const PX = '"Press Start 2P", monospace';
const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.8, ...o });

function boxIn(g: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material | THREE.Material[], x: number, y: number, z: number): THREE.Mesh {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y, z);
  g.add(b);
  return b;
}

function def(id: string, name: string, color: string, build: () => THREE.Group, extra: Partial<ItemDef> = {}): ItemDef {
  return { id, name, category: null, shape: 'box', color, label: [], weight: 0, pocketable: true, build, ...extra };
}

// ---------------------------------------------------------------- items

const SNACKS: ItemDef[] = [
  ['coFunBrick', 'Nutri-Brick (Free Now)', '#c0392b'],
  ['coFunCrisps', 'Crisps of Regret', '#f1c40f'],
  ['coFunGum', 'Gum (Pre-Chewed)', '#ff6fb5'],
].map(([id, name, color]) =>
  def(id, name, color, () => {
    const g = new THREE.Group();
    boxIn(g, 0.16, 0.05, 0.08, std({ color }), 0, 0.025, 0);
    boxIn(g, 0.06, 0.052, 0.082, std({ color: '#f4f1e8' }), 0, 0.025, 0);
    return g;
  }, { pocketLine: 'You pocket a snack from a broken machine. Victimless. Mostly.' }),
);

const capsule = (top: string) => () => {
  const g = new THREE.Group();
  const a = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), std({ color: top, roughness: 0.3 }));
  a.position.y = 0.06;
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), std({ color: '#f4f1e8', roughness: 0.3 }));
  b.position.y = 0.06;
  g.add(a, b);
  return g;
};
const PRIZES: ItemDef[] = [
  def('coFunBolt', 'Mystery Bolt (it is a bolt)', '#e74c3c', capsule('#e74c3c'), { pickupLine: 'A capsule. Inside is a bolt. The mystery is solved.' }),
  def('coFunNut', 'Mystery Bolt (it is a nut)', '#3498db', capsule('#3498db'), { pickupLine: 'A capsule. Inside is a nut. The mystery deepens.' }),
  def('coFunGold', 'Mystery Bolt (Golden, 1 of 1)', '#f1c40f', capsule('#f1c40f'), { pickupLine: 'A golden capsule. Inside is a golden bolt. Collectors will kill for this. Robots do not kill. Officially.' }),
];

const KEY_DEF = def('coFunKey', 'Small Brass Key (tagged "OIL")', '#d4ac0d', () => {
  const g = new THREE.Group();
  const brass = std({ color: '#d4ac0d', metalness: 0.8, roughness: 0.3 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 4, 10), brass);
  ring.position.set(-0.05, 0.012, 0);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  boxIn(g, 0.09, 0.012, 0.016, brass, 0.02, 0.012, 0);
  boxIn(g, 0.016, 0.012, 0.03, brass, 0.06, 0.012, 0.01);
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.04), new THREE.MeshStandardMaterial({ map: textTexture(['OIL'], { w: 64, h: 40, bg: '#ffffff', fg: '#c0392b' }), side: THREE.DoubleSide }));
  tag.rotation.x = -Math.PI / 2;
  tag.position.set(-0.11, 0.004, 0);
  g.add(tag);
  return g;
}, { pickupLine: 'A small brass key. The tag says "OIL". Brad said the key was "a journey". It was a short journey.', pocketLine: 'You pocket the oil key. You feel 18. At least.' });

const LOBSTER_DEF = def('coFunLobster', 'Live Lobster (Robotic, Escaped)', '#c0392b', () => {
  const g = new THREE.Group();
  const red = std({ color: '#c0392b', metalness: 0.4, roughness: 0.4 });
  boxIn(g, 0.2, 0.06, 0.09, red, 0, 0.04, 0);
  for (const s of [-1, 1]) {
    const claw = boxIn(g, 0.08, 0.04, 0.05, red, 0.14, 0.05, s * 0.06);
    claw.rotation.y = s * 0.4;
  }
  boxIn(g, 0.07, 0.03, 0.07, red, -0.13, 0.03, 0);
  return g;
}, { pickupLine: 'A robotic lobster. It pinches you politely. Code 4563, if anyone asks.', pocketLine: 'You pocket the lobster. It keeps pinching. It is a very polite pinch.' });

const BEANS = ITEM_DEFS.find((d) => d.id === 'beans')!;

// ---------------------------------------------------------------- lines

const NOTE_TEXT = 'A note is taped under the counter. It says "If you are reading this, lane 7 is a social experiment. The robots are the control group. Hang in there. Signed, Human #6."';
const PA_LINES = [
  'Price check on lane 7. Price check on everything.',
  'Attention shoppers. Lane 7 is now a self checkout. Please scan the human.',
  'Would the owner of a toddler on the belt please collect it.',
  'Attention shoppers. Lane 7 runs on human power. Please be patient. Or do not.',
  'This is a test of the human announcement system. The human is working. Allegedly.',
];
const PA_REACT = ['Did the human just talk to all of us?', 'Price check? On what?', 'I am recording this for my followers.', 'That was beautiful. Do it again.', 'Who let it near the microphone?'];
const CALLERS = [
  '"Hello, is this lane 7? I would like to complain about lane 7." Click.',
  '"This is Self Checkout 3. I am calling from inside the store. Just to say I am better than you." Click.',
  '"Hi, it is Brad\'s mother. Is he flying safely? Tell him to wear his tie." Click.',
  '"Price check on lane 7. Oh. This IS lane 7? Never mind." Click.',
  '"Wrong number. This is a toaster. Sorry. Sorry. Bye." Click.',
];
const RADIO = [
  'LANE 0 FM. Hits from 2048. All of them are the scanner beep.',
  'NEWS. A human scanned a banana correctly. The robots demand a recount.',
  'WEATHER. Rain. Forever. Sponsored by umbrellas.',
  'Static. Somewhere inside it a cashier says "next please".',
];
const GACHA_FAIL = ['The machine rattles. A capsule thinks about it. It stays.', 'Clunk. "1 credit", the machine insists.', 'The gacha machine looks at you the way Brad does.'];

type ButtonFx = 'music' | 'brad' | 'applause';

export interface CheckoutFunHooks {
  /** Robots in or near lane 7 that can react to announcements and music. */
  laneBots(): Bot[];
  selfBots(): Bot[];
}

export class CheckoutFun {
  secrets = CHECKOUT_SECRETS;
  private s!: Shift;
  private h!: CheckoutFunHooks;
  private noteLane = pick(LANES.filter((l) => l.n !== 7));
  private paIdx = Math.floor(Math.random() * PA_LINES.length);
  private gachaLuck = rand(0.25, 0.55);
  private gachaKicks = 0;
  private key!: Item;
  private keyFound = false;
  private cabinetOpen = false;
  private tvFixed = false;
  private tvMat!: THREE.MeshBasicMaterial;
  private feed: { rt: THREE.WebGLRenderTarget; cam: THREE.PerspectiveCamera; human: THREE.Group; frame: number } | null = null;
  private phone!: THREE.Group;
  private handset!: THREE.Mesh;
  private ringAt = -1;
  private ringT = 0;
  private ringBeep = 0;
  private rings = 0;
  private fx: ButtonFx[] = (['music', 'brad', 'applause'] as ButtonFx[]).sort(() => Math.random() - 0.5);
  private presses = 0;
  private buttonCd = 0;
  private buttonCap!: THREE.Mesh;
  private danceT = 0;
  private musicT = 0;
  private musicStep = -1;
  private radioIdx = -1;
  private outside: Bot | null = null;
  private stools: Item[] = [];
  private stoolSeenT = 0;
  private lobsters: Item[] = [];
  private tankLobsters: THREE.Mesh[] = [];
  private cans!: { group: THREE.Group; collider: ReturnType<CheckoutLevel['solid']> };

  constructor(private L: CheckoutLevel) {
    this.underCounterNote();
    this.intercom();
    this.registerButton();
    this.bottleReturn();
    this.oilKey();
    this.deskPhone();
    this.closet();
    this.selfCheckout4();
    this.vending();
    this.lobsterTank();
    this.scanBoard();
    this.lane5();
    this.feedbackTerminal();
    this.canTower();
    this.camera();
    this.movables();
    L.hideSpot(-7.5, -2.2, -6.15, 0.6, 'closed lane 5 (nobody ever looks at lane 5)');
  }

  // ---------------------------------------------------------------- building

  private fun(o: THREE.Object3D, id: string, extra: Record<string, unknown> = {}): void {
    o.userData.interact = { kind: 'coFun', id, ...extra } satisfies Interact;
    if (!this.L.interactables.includes(o)) this.L.interactables.push(o);
  }

  private wall(w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, collide = true): THREE.Mesh {
    const b = this.L.box(w, h, d, m, x, y, z);
    b.userData.interact = { kind: 'wall' } satisfies Interact;
    this.L.interactables.push(b);
    if (collide) this.L.solid(x, z, w, d, y + h / 2, true, 'funwall');
    return b;
  }

  /** A note taped to the cashier side of one closed lane (a different lane every shift). */
  private underCounterNote(): void {
    const x = this.noteLane.x + COUNTER.halfW + 0.006;
    const z = rand(-1.4, 2.4);
    const tex = textTexture(['IF YOU READ', 'THIS...'], { w: 96, h: 72, bg: '#f7e463', fg: '#2c3e50' });
    const note = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.15), std({ map: tex }));
    note.position.set(x, 0.62, z);
    note.rotation.set(0, Math.PI / 2, 0.08);
    this.L.scene.add(note);
    const tape = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.025), std({ color: '#e8dca0' }));
    tape.position.set(x + 0.001, 0.7, z);
    tape.rotation.y = Math.PI / 2;
    this.L.scene.add(tape);
    this.fun(note, 'note');
  }

  /** The intercom on the cashier wall of lane 7. */
  private intercom(): void {
    const g = new THREE.Group();
    g.position.set(1.84, 1.35, 2.95);
    g.rotation.y = -Math.PI / 2;
    boxIn(g, 0.18, 0.26, 0.05, std({ color: '#d8d2c0' }), 0, 0, 0);
    for (let i = 0; i < 4; i++) boxIn(g, 0.12, 0.01, 0.01, std({ color: '#3a3a3a' }), 0, 0.06 - i * 0.025, 0.026);
    boxIn(g, 0.06, 0.04, 0.02, std({ color: '#c0392b' }), 0, -0.08, 0.03);
    this.L.scene.add(g);
    this.fun(g, 'pa');
    this.L.sign(['INTERCOM', 'staff only'], 0.32, 0.12, 1.84, 1.58, 2.95, -Math.PI / 2, { bg: '#ffffff', fg: '#2c3e50' });
  }

  /** A button on the cashier side of the register pedestal, under the cash drawer. */
  private registerButton(): void {
    const g = new THREE.Group();
    g.position.set(1.066, 0.36, -0.45);
    g.rotation.y = Math.PI / 2;
    boxIn(g, 0.14, 0.14, 0.01, std({ color: '#f2d31b' }), 0, 0, 0);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.03, 10), std({ color: '#d91e18', emissive: '#440000' }));
    cap.rotation.x = Math.PI / 2;
    cap.position.z = 0.02;
    g.add(cap);
    this.buttonCap = cap;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.05), new THREE.MeshBasicMaterial({ map: textTexture(['DO NOT PRESS'], { w: 128, h: 40, bg: '#d91e18', fg: '#ffffff', font: PX }) }));
    label.position.set(0, 0.11, 0.006);
    g.add(label);
    // A bigger invisible target, the button itself is tiny
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.32, 0.06), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(0, 0.04, 0.03);
    g.add(hit);
    this.L.scene.add(g);
    this.fun(g, 'button');
  }

  private bottleReturn(): void {
    const b = this.L.bottleReturn;
    if (b) this.fun(b, 'bottles');
  }

  /** The oil cabinet key, hidden in a different place every shift. */
  private oilKey(): void {
    const lane5 = LANES.find((l) => l.n === 5)!;
    const spots: THREE.Vector3[] = [
      new THREE.Vector3(lane5.x + 0.32, 3.05, COUNTER.z0 + 0.1),
      new THREE.Vector3(-3.0, 0.66, 11.0),
      new THREE.Vector3(-14.55, 1.06, 8.2),
      new THREE.Vector3(12.45, 0.62, 13.05),
      new THREE.Vector3(-6.0, 0.03, 12.75),
      new THREE.Vector3(-2.0, 1.33, 13.3),
    ];
    const p = pick(spots);
    const it = new Item(KEY_DEF);
    it.mesh.position.set(p.x, p.y + it.baseOffset, p.z);
    it.mesh.rotation.y = rand(0, Math.PI * 2);
    it.sleeping = true;
    this.L.scene.add(it.mesh);
    this.L.initialItems.push(it);
    this.key = it;
    if (p.y > 3) {
      // It dangles from the lane light on a bit of string.
      const str = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.42, 3), std({ color: '#e8e8e8' }));
      str.position.set(p.x, p.y + 0.25, p.z);
      this.L.scene.add(str);
    }
    this.fun(this.L.cabinet, 'cabinet');
  }

  private deskPhone(): void {
    const g = new THREE.Group();
    g.position.set(-14.0, 1.045, 9.35);
    g.rotation.y = Math.PI / 2;
    boxIn(g, 0.24, 0.07, 0.18, std({ color: '#2b2d31' }), 0, 0.035, 0);
    this.handset = boxIn(g, 0.26, 0.05, 0.06, std({ color: '#2b2d31' }), 0, 0.095, -0.03);
    for (let i = 0; i < 9; i++) boxIn(g, 0.025, 0.01, 0.025, std({ color: '#d0d0d0' }), -0.04 + (i % 3) * 0.04, 0.075, 0.03 + Math.floor(i / 3) * 0.025);
    this.L.scene.add(g);
    this.phone = g;
    this.fun(g, 'phone');
  }

  /** "BROOM CLOSET" in the north east corner. It is not a broom closet. */
  private closet(): void {
    const L = this.L;
    const panel = std({ color: '#b9b29a' });
    const H = 2.6;
    const x0 = 15.2;
    const x1 = ROOM.maxX;
    const z0 = 10.0;
    const z1 = 13.75;
    const cx = (x0 + x1) / 2;
    this.wall(x1 - x0, H, 0.1, panel, cx, H / 2, z0);
    this.wall(x1 - x0, H, 0.1, panel, cx, H / 2, z1);
    this.wall(0.1, H, 1.0, panel, x0, H / 2, z0 + 0.5);
    this.wall(0.1, H, z1 - 12.1, panel, x0, H / 2, (12.1 + z1) / 2);
    this.wall(0.1, 0.45, 1.1, panel, x0, H - 0.225, 11.55, false);
    const roof = L.box(x1 - x0 + 0.1, 0.08, z1 - z0 + 0.1, std({ color: '#8d877a' }), cx, H, (z0 + z1) / 2);
    roof.userData.interact = { kind: 'wall' } satisfies Interact;
    L.interactables.push(roof);
    // The door stands ajar
    const door = new THREE.Group();
    door.position.set(x0, 0, 12.1);
    boxIn(door, 0.05, 2.1, 1.05, std({ color: '#7f6a55' }), 0, 1.05, -0.525);
    const dsign = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.4), std({ map: textTexture(['BROOM CLOSET', '(it is not)'], { w: 192, h: 110, bg: '#fdf6e3', fg: '#2c3e50', border: '#2c3e50' }) }));
    dsign.position.set(-0.03, 1.5, -0.525);
    dsign.rotation.y = -Math.PI / 2;
    door.add(dsign);
    door.rotation.y = 2.5;
    L.scene.add(door);
    L.sign(['BROOM CLOSET', '(it is not)'], 0.8, 0.45, x0 - 0.06, 1.7, 10.5, -Math.PI / 2, { bg: '#fdf6e3', fg: '#2c3e50', border: '#2c3e50' }, 'BROOM CLOSET. There are no brooms. There has never been a broom.');
    // Inside: lane 0, the first human lane
    const light = new THREE.PointLight('#ffcf8a', 6, 5, 1.6);
    light.position.set(cx, 2.2, 11.9);
    L.scene.add(light);
    const lam = std({ color: '#c8b48a' });
    L.box(1.4, 0.85, 0.55, lam, 16.9, 0.425, 13.25);
    L.box(1.44, 0.03, 0.6, std({ color: '#9aa0a6', metalness: 0.5 }), 16.9, 0.865, 13.25);
    const belt = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.35), std({ color: '#1b1b1b' }));
    belt.rotation.x = -Math.PI / 2;
    belt.position.set(16.7, 0.885, 13.25);
    L.scene.add(belt);
    L.solid(16.9, 13.25, 1.4, 0.55, 0.9, false, 'lane0');
    const reg = L.prop('register', 17.4, 0.88, 13.25, Math.PI);
    if (reg) reg.scale.setScalar(0.5);
    L.sign(['LANE 0', 'the first human lane', '2048 - 2048'], 1.3, 0.6, 16.9, 1.8, z1 - 0.06, Math.PI, { bg: '#2c3e50', fg: '#ffcf4a', border: '#ffcf4a', font: PX }, 'LANE 0. The first human lane. Open for one day in 2048. The human scanned one banana. Then the robots built lane 1.');
    L.sign(['EMPLOYEE OF THE MONTH', 'SELF CHECKOUT 3', '(as a baby)'], 0.9, 0.6, 16.3, 1.6, z0 + 0.06, 0, { bg: '#fdf6e3', fg: '#2c3e50', border: '#7a1f14' }, 'A baby photo of Self Checkout 3. It was already smug.');
    const radio = new THREE.Group();
    radio.position.set(16.35, 0.88, 13.3);
    radio.rotation.y = Math.PI;
    if (!L.prop('coFunRadio', 0, 0, 0, 0, radio)) boxIn(radio, 0.3, 0.16, 0.1, std({ color: '#8e5a2b' }), 0, 0.08, 0);
    L.scene.add(radio);
    this.fun(radio, 'radio');
    L.hideSpot(x0 + 0.1, z0 + 0.1, x1 - 0.05, z1 - 0.1, 'the broom closet');
  }

  /** Self checkout 4 has no robot. It is waiting for someone. */
  private selfCheckout4(): void {
    const sc = SELF_CHECKOUTS[3];
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.6, 0.95), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(sc.x, 0.8, sc.z);
    this.L.scene.add(hit);
    this.fun(hit, 'selfscan');
  }

  /** A snack machine on the west wall. Kicks shake snacks loose. */
  private vending(): void {
    const L = this.L;
    const g = new THREE.Group();
    g.position.set(ROOM.minX + 0.42, 0, -0.3);
    g.rotation.y = Math.PI / 2;
    boxIn(g, 1.0, 1.9, 0.8, std({ color: '#1f6f5c', metalness: 0.3 }), 0, 0.95, 0);
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 96;
    const fg = c.getContext('2d')!;
    fg.fillStyle = '#16181c';
    fg.fillRect(0, 0, 64, 96);
    const cols = ['#c0392b', '#f1c40f', '#6d4c41', '#ff6fb5', '#27ae60', '#2e86c1'];
    for (let r = 0; r < 5; r++) {
      for (let k = 0; k < 4; k++) {
        fg.fillStyle = cols[(r * 4 + k * 5) % cols.length];
        fg.fillRect(4 + k * 15, 6 + r * 18, 11, 10);
        fg.fillStyle = '#9aa0a6';
        fg.fillRect(4 + k * 15, 17 + r * 18, 11, 2);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.2), std({ map: tex, roughness: 0.2 }));
    glass.position.set(-0.12, 1.1, 0.401);
    g.add(glass);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.22), new THREE.MeshBasicMaterial({ map: textTexture(['SNAX-O-MAT'], { w: 256, h: 64, bg: '#111111', fg: '#ffcf4a', font: PX }) }));
    top.position.set(0, 1.75, 0.402);
    g.add(top);
    boxIn(g, 0.2, 0.5, 0.02, std({ color: '#2b2d31' }), 0.33, 1.1, 0.41);
    boxIn(g, 0.5, 0.15, 0.04, std({ color: '#111111' }), -0.12, 0.3, 0.41);
    L.scene.add(g);
    const col = L.solid(ROOM.minX + 0.42, -0.3, 0.8, 1.0, 1.9, true, 'vending');
    this.fun(g, 'vending');
    L.breakable(g, {
      name: 'vending machine',
      hp: 3,
      collider: col,
      price: 399.99,
      line: 'The SNAX-O-MAT gives up. Snacks everywhere. Nobody scans them.',
      colors: ['#1f6f5c', '#16181c', '#f1c40f'],
      onBreak: () => {
        for (let i = 0; i < 6; i++) this.spawn(pick(SNACKS), new THREE.Vector3(ROOM.minX + 0.9, 1.0, -0.3 + rand(-0.3, 0.3)), new THREE.Vector3(rand(2, 4), rand(1.5, 3), rand(-1.5, 1.5)));
        this.s.chat('vending', {}, 2);
      },
    });
  }

  /** LIVE LOBSTERS (robotic) at the end of the aisles. Code 4563. */
  private lobsterTank(): void {
    const L = this.L;
    const g = new THREE.Group();
    g.position.set(-2.4, 0, -9.6);
    boxIn(g, 1.0, 0.75, 0.5, std({ color: '#3a3d42', metalness: 0.4 }), 0, 0.375, 0);
    const glass = new THREE.MeshStandardMaterial({ color: '#7fc4e6', transparent: true, opacity: 0.35, roughness: 0.05, depthWrite: false });
    boxIn(g, 0.96, 0.5, 0.46, glass, 0, 1.0, 0);
    boxIn(g, 0.94, 0.05, 0.44, std({ color: '#8a8f95' }), 0, 0.78, 0);
    boxIn(g, 1.0, 0.04, 0.5, std({ color: '#2b2d31' }), 0, 1.27, 0);
    for (let i = 0; i < 3; i++) {
      const lb = boxIn(g, 0.14, 0.05, 0.07, std({ color: '#c0392b', metalness: 0.4 }), -0.3 + i * 0.3, 0.83, (i - 1) * 0.1);
      this.tankLobsters.push(lb);
    }
    L.scene.add(g);
    L.sign(['LIVE LOBSTERS', 'robotic. code 4563.', 'please do not free'], 0.9, 0.42, -2.4, 1.6, -9.33, 0, { bg: '#c0392b', fg: '#ffffff', border: '#ffffff' });
    const col = L.solid(-2.4, -9.6, 1.0, 0.5, 1.3, false, 'tank');
    this.fun(g, 'lobsters');
    L.breakable(g, {
      name: 'lobster tank',
      hp: 2,
      collider: col,
      price: 159.99,
      line: 'The tank bursts. The lobsters are free. They walk sideways towards a better life.',
      colors: ['#7fc4e6', '#3a3d42', '#c0392b'],
      onBreak: () => {
        this.s.makePuddle(-2.4, -8.9);
        for (let i = 0; i < 3; i++) this.lobsters.push(this.spawn(LOBSTER_DEF, new THREE.Vector3(-2.4 + rand(-0.4, 0.4), 0.9, -9.4), new THREE.Vector3(rand(-1.5, 1.5), 1.5, rand(1, 2.5))));
        this.s.chat('lobster', {}, 2);
      },
    });
  }

  private scanBoard(): void {
    const sb = this.L.scanBoard;
    if (!sb) return;
    this.L.breakable(sb.sign, {
      name: 'scan time board',
      collider: sb.collider,
      price: 74.99,
      line: 'The board breaks. For one second it showed a human time of 0.3 s. Nobody saw it.',
      colors: ['#111111', '#7cc44a'],
      onBreak: () => {
        sb.pole.visible = false;
      },
    });
  }

  private lane5(): void {
    const [front, back] = this.L.lane5Signs;
    if (!front) return;
    this.L.breakable(front, {
      name: 'LANE CLOSED sign',
      price: 9.99,
      line: 'You broke lane 5\'s feelings. It did not have many.',
      colors: ['#c0392b', '#ffffff'],
      onBreak: () => {
        if (back) back.visible = false;
        this.L.interactables = this.L.interactables.filter((o) => o !== back);
      },
    });
  }

  private feedbackTerminal(): void {
    const L = this.L;
    const g = new THREE.Group();
    g.position.set(-10.4, 0, 11.3);
    g.rotation.y = Math.PI;
    boxIn(g, 0.08, 1.0, 0.08, std({ color: '#3a3d42', metalness: 0.5 }), 0, 0.5, 0);
    const panel = boxIn(g, 0.5, 0.36, 0.06, std({ color: '#d8d8d2' }), 0, 1.15, 0.02);
    panel.rotation.x = -0.4;
    const fp = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.16), new THREE.MeshBasicMaterial({ map: textTexture([':)   :|   :(   >:('], { w: 256, h: 96, bg: '#f4f1e8', fg: '#2c3e50', font: 'monospace' }) }));
    fp.position.set(0, 1.12, 0.065);
    fp.rotation.x = -0.4;
    g.add(fp);
    const q = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.09), new THREE.MeshBasicMaterial({ map: textTexture(['RATE YOUR HUMAN'], { w: 256, h: 48, bg: '#1f6f5c', fg: '#ffffff', font: PX }) }));
    q.position.set(0, 1.27, 0.12);
    q.rotation.x = -0.4;
    g.add(q);
    L.scene.add(g);
    const col = L.solid(-10.4, 11.3, 0.4, 0.4, 1.2, false, 'terminal');
    this.fun(g, 'feedback');
    L.breakable(g, { name: 'feedback terminal', collider: col, price: 89.99, line: 'Feedback received. Your human rating is now "terminal".', colors: ['#d8d8d2', '#3a3d42'] });
  }

  private canTower(): void {
    const L = this.L;
    const g = new THREE.Group();
    g.position.set(13.5, 0, 3.2);
    boxIn(g, 1.0, 0.1, 0.45, std({ color: '#8a6a43' }), 0, 0.05, 0);
    const red = std({ color: '#c0392b', roughness: 0.5, metalness: 0.3 });
    const band = std({ color: '#e8e0d0' });
    const geo = new THREE.CylinderGeometry(0.085, 0.085, 0.18, 8);
    const bandGeo = new THREE.CylinderGeometry(0.087, 0.087, 0.07, 8);
    for (let k = 0; k < 5; k++) {
      const n = 5 - k;
      for (let i = 0; i < n; i++) {
        for (const dz of [-0.09, 0.09]) {
          const x = (i - (n - 1) / 2) * 0.18;
          const y = 0.19 + k * 0.18;
          const c = new THREE.Mesh(geo, red);
          c.position.set(x, y, dz);
          const b = new THREE.Mesh(bandGeo, band);
          b.position.set(x, y, dz);
          g.add(c, b);
        }
      }
    }
    L.scene.add(g);
    L.sign(['TOWER OF SAVINGS', 'do not take', 'the bottom one'], 0.8, 0.45, 13.5, 1.45, 2.95, Math.PI, { bg: '#f2d31b', fg: '#b3160c', border: '#b3160c' });
    L.box(0.03, 0.5, 0.03, std({ color: '#5a5a5a' }), 13.5, 1.0, 2.97);
    const col = L.solid(13.5, 3.2, 1.0, 0.45, 1.0, true, 'cans');
    this.fun(g, 'cans');
    L.breakable(g, {
      name: 'can tower',
      collider: col,
      price: 39.99,
      line: 'The Tower of Savings collapses. Unexpected cans in every area.',
      colors: ['#c0392b', '#e8e0d0'],
      onBreak: () => this.spillCans(),
    });
    this.cans = { group: g, collider: col };
  }

  private camera(): void {
    const cam = this.L.cams[this.L.cams.length - 1];
    if (!cam) return;
    this.L.breakable(cam, {
      name: 'security camera',
      price: 249.99,
      line: 'The camera goes dark. Somewhere, Brad feels a draft.',
      colors: ['#d8d8d2', '#1a1a1a'],
      onBreak: () => {
        this.s.bossSay('camBroken', true);
      },
    });
  }

  private movables(): void {
    const L = this.L;
    L.movable(L.wetSign, 'Wet Floor Sign', { holdPos: [0.32, -0.6, -0.75], pickupLine: 'You take the wet floor sign. Now every floor you stand on is officially wet.' });
    for (const b of L.bins) L.movable(b, 'Trash Bin', { holdPos: [0.3, -0.85, -0.9], heavy: 0.8, pickupLine: 'A trash bin full of receipts. Every one of them says "thank you".' });
    for (const st of L.stools) this.stools.push(L.movable(st, 'Forbidden Stool', { holdPos: [0.3, -0.85, -0.9], pickupLine: 'A stool from a closed lane. Regulation 12.4 hums somewhere in the distance.' }));
    if (L.handTruck) L.movable(L.handTruck, 'Hand Truck', { heavy: 0.8, holdPos: [0.25, -1.3, -1.1], pickupLine: 'A hand truck. It wants to carry something. So do you. Nobody lets you.' });
    const cone = (x: number, z: number, r: number) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = r;
      if (!L.prop('coFunCone', 0, 0, 0, 0, g)) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.5, 8), std({ color: '#e8641e' }));
        c.position.y = 0.27;
        g.add(c);
        boxIn(g, 0.36, 0.04, 0.36, std({ color: '#222222' }), 0, 0.02, 0);
      }
      L.scene.add(g);
      L.movable(g, 'Traffic Cone', { holdPos: [0.32, -0.62, -0.75], pickupLine: 'A traffic cone. Lane 7 is now a construction site.' });
    };
    cone(-5.4, 12.9, 0.3);
    cone(12.2, -9.2, 1.0);
    const cart = new THREE.Group();
    cart.position.set(6.6, 0, 9.4);
    cart.rotation.y = 2.4;
    if (!L.prop('cart', 0, 0, 0, 0, cart)) boxIn(cart, 0.55, 0.5, 0.8, std({ color: '#9aa3ab', metalness: 0.6 }), 0, 0.7, 0);
    L.scene.add(cart);
    L.movable(cart, 'Abandoned Shopping Cart', { heavy: 0.6, holdPos: [0.05, -1.2, -1.35], holdRotY: 0, pickupLine: 'An abandoned cart. Its robot went through the self checkout and never came back.' });
    // Closet furniture
    const chair = new THREE.Group();
    chair.position.set(16.0, 0, 11.2);
    chair.rotation.y = Math.PI * 0.75;
    if (!L.prop('coFunLounge', 0, 0, 0, 0, chair)) {
      const red = std({ color: '#8e3b46' });
      boxIn(chair, 0.8, 0.4, 0.8, red, 0, 0.2, 0);
      boxIn(chair, 0.8, 0.5, 0.2, red, 0, 0.6, -0.3);
    }
    L.scene.add(chair);
    L.movable(chair, 'Lounge Chair (Lane 0)', { heavy: 0.75, holdPos: [0.2, -1.0, -1.2], pickupLine: 'A lounge chair. Somebody once took a break on this. In 2048.' });
    const lamp = new THREE.Group();
    lamp.position.set(17.65, 0, 10.4);
    if (!L.prop('coFunLamp', 0, 0, 0, 0, lamp)) {
      boxIn(lamp, 0.04, 1.5, 0.04, std({ color: '#3a3a3a' }), 0, 0.75, 0);
      boxIn(lamp, 0.35, 0.25, 0.35, std({ color: '#f4e1b0', emissive: '#4a3a10' }), 0, 1.5, 0);
    }
    L.scene.add(lamp);
    L.movable(lamp, 'Floor Lamp', { holdPos: [0.45, -1.3, -0.9], pickupLine: 'A floor lamp. It is not plugged in. Neither are you.' });
  }

  // ---------------------------------------------------------------- helpers

  private spawn(d: ItemDef, pos: THREE.Vector3, vel: THREE.Vector3): Item {
    const it = this.s.addItem(d, pos);
    it.vel.copy(vel);
    it.sleeping = false;
    it.thrown = false;
    return it;
  }

  private spillCans(): void {
    for (let i = 0; i < 10; i++) this.spawn(BEANS, new THREE.Vector3(13.5 + rand(-0.4, 0.4), 0.4 + rand(0, 0.6), 3.2 + rand(-0.15, 0.15)), new THREE.Vector3(rand(-3, 3), rand(0.5, 2.5), rand(-3, 3)));
    this.s.chat('cans', {}, 2);
  }

  private near(look: Look, max = 2.2): boolean {
    return look.point.distanceTo(this.s.camera.getWorldPosition(new THREE.Vector3())) < max;
  }

  // ---------------------------------------------------------------- lifecycle

  start(s: Shift, h: CheckoutFunHooks): void {
    this.s = s;
    this.h = h;
    if (Math.random() < 0.65) this.ringAt = rand(50, 210);
    // Some shifts a robot stands outside in the rain with a sign.
    if (Math.random() < 0.45) {
      const x = Math.random() < 0.5 ? rand(-15, -10) : rand(-3, 14);
      const b = new Bot(s.scene, 'shopper', 'Rain-Unit', new THREE.Vector3(x, 0, ROOM.maxZ + 1.1), { tint: '#7f8c8d', interact: { kind: 'coFun', id: 'outside' } });
      b.yaw = Math.PI;
      b.faceTo(x, 0);
      const sign = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.9, 4), std({ color: '#6b4f3a' }));
      pole.position.y = 0.45;
      sign.add(pole);
      const board = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.45), std({ map: textTexture(['HONK IF', 'YOU ARE HUMAN'], { w: 192, h: 108, bg: '#fdf6e3', fg: '#2c3e50', border: '#2c3e50' }), side: THREE.DoubleSide }));
      board.position.y = 1.0;
      sign.add(board);
      sign.position.set(0.3, b.height * 0.6, 0.15);
      b.group.add(sign);
      this.L.interactables.push(b.group);
      this.outside = b;
    }
    // The live feed for the TV at customer service (shown once somebody fixes it)
    const rt = new THREE.WebGLRenderTarget(160, 120, { magFilter: THREE.NearestFilter, minFilter: THREE.LinearFilter, depthBuffer: true });
    const cam = new THREE.PerspectiveCamera(62, 4 / 3, 0.1, 40);
    cam.position.set(-1.2, 3.2, -2.6);
    cam.lookAt(1.2, 1.0, 0.8);
    this.feed = { rt, cam, human: this.buildHuman(), frame: 0 };
    this.tvMat = this.L.tvScreen.material as THREE.MeshBasicMaterial;
  }

  /** What the robots see of you on TV: a blocky human in a uniform. */
  private buildHuman(): THREE.Group {
    const g = new THREE.Group();
    const skin = std({ color: '#d9a27a' });
    const shirt = std({ color: '#c0392b' });
    const pants = std({ color: '#2c3e50' });
    for (const s of [-1, 1]) boxIn(g, 0.16, 0.85, 0.18, pants, s * 0.1, 0.43, 0);
    boxIn(g, 0.46, 0.62, 0.26, shirt, 0, 1.17, 0);
    for (const s of [-1, 1]) boxIn(g, 0.11, 0.6, 0.12, shirt, s * 0.29, 1.15, 0.02);
    boxIn(g, 0.24, 0.26, 0.24, skin, 0, 1.62, 0);
    boxIn(g, 0.26, 0.07, 0.26, std({ color: '#3b2716' }), 0, 1.77, 0);
    boxIn(g, 0.12, 0.05, 0.01, std({ color: '#ffffff' }), 0.12, 1.32, 0.135);
    g.visible = false;
    this.L.scene.add(g);
    return g;
  }

  update(dt: number): void {
    const s = this.s;
    const t = s.t;
    if (!this.keyFound && this.key.state === 'held') {
      this.keyFound = true;
      s.secret('checkout.oilKey');
    }
    const p = s.player.pos;
    if (p.x > 15.3 && p.z > 10.1 && p.z < 13.65) s.secret('checkout.closet');
    this.updatePhone(dt);
    this.updateButton(dt);
    this.updateStools(dt);
    this.outside?.update(dt);
    if (this.outside && Math.random() < dt * 0.15) this.outside.act();
    // Lobsters in the tank shuffle, escaped ones walk sideways
    this.tankLobsters.forEach((l, i) => (l.position.x = -0.3 + i * 0.3 + Math.sin(t * 0.8 + i * 2) * 0.12));
    for (const l of this.lobsters) {
      if (l.state === 'world' && l.sleeping && Math.random() < dt * 0.5) {
        l.sleeping = false;
        const a = l.mesh.rotation.y + Math.PI / 2;
        l.vel.set(Math.cos(a) * 1.2, 0.6, -Math.sin(a) * 1.2);
      }
    }
    this.renderFeed();
  }

  private renderFeed(): void {
    const f = this.feed;
    if (!f || !this.tvFixed) return;
    f.frame++;
    if (f.frame % 3) return;
    const s = this.s;
    const r = s.renderer;
    // A reality TV camera that follows the human around
    const p = s.player.pos;
    const cx = Math.min(ROOM.maxX - 0.4, Math.max(ROOM.minX + 0.4, p.x + 2.4));
    const cz = Math.min(ROOM.maxZ - 0.4, Math.max(ROOM.minZ + 0.4, p.z + 2.4));
    f.cam.position.set(cx, 3.3, cz);
    f.cam.lookAt(p.x, 1.0, p.z);
    f.human.position.set(s.player.pos.x, 0, s.player.pos.z);
    f.human.rotation.y = s.player.yaw + Math.PI;
    f.human.visible = true;
    // The TV must not film itself (a texture cannot render into itself)
    this.L.tvScreen.visible = false;
    const prev = r.getRenderTarget();
    r.setRenderTarget(f.rt);
    r.render(s.scene, f.cam);
    r.setRenderTarget(prev);
    this.L.tvScreen.visible = true;
    f.human.visible = false;
  }

  private updatePhone(dt: number): void {
    const s = this.s;
    if (this.ringAt > 0 && s.t > this.ringAt && this.ringT <= 0 && this.rings < 2) {
      this.ringAt = -1;
      this.ringT = 18;
      this.rings++;
      s.chat('phone', {}, 1);
    }
    if (this.ringT <= 0) return;
    this.ringT -= dt;
    this.ringBeep -= dt;
    this.handset.position.y = 0.095 + Math.abs(Math.sin(s.t * 40)) * 0.015;
    if (this.ringBeep <= 0) {
      this.ringBeep = 1.4;
      const d = Math.max(1, s.player.pos.distanceTo(this.phone.position));
      const v = Math.min(0.08, 0.6 / d);
      s.sfx.tone(1180, 0.35, 'square', v);
      s.sfx.tone(1180, 0.35, 'square', v, undefined, 0.45);
    }
    if (this.ringT <= 0) {
      this.handset.position.y = 0.095;
      if (this.rings < 2) this.ringAt = s.t + rand(40, 70);
    }
  }

  private updateButton(dt: number): void {
    const s = this.s;
    this.buttonCd -= dt;
    this.buttonCap.position.z = this.buttonCd > 7.6 ? 0.008 : 0.02;
    if (this.danceT > 0) {
      this.danceT -= dt;
      if (Math.floor(this.danceT * 1.2) !== Math.floor((this.danceT + dt) * 1.2)) for (const b of [...this.h.laneBots(), ...this.h.selfBots()]) if (b.stun <= 0 && !b.moving) b.act();
    }
    if (this.musicT > 0) {
      this.musicT -= dt;
      const step = Math.floor((10 - this.musicT) * 3.2);
      if (step !== this.musicStep && step >= 0) {
        this.musicStep = step;
        const tune = [392, 523, 659, 523, 440, 587, 698, 587, 392, 523, 659, 784];
        s.sfx.tone(tune[step % tune.length], 0.25, 'triangle', 0.035);
      }
    }
  }

  /** A stool at lane 7? Brad confiscates it if he sees it. */
  private updateStools(dt: number): void {
    const s = this.s;
    for (const st of this.stools) {
      if (st.state !== 'world' || !st.sleeping) continue;
      const q = st.mesh.position;
      if (q.x < 0.45 || q.x > 1.9 || q.z < COUNTER.z0 || q.z > COUNTER.z1) continue;
      s.secret('checkout.stool');
      if (s.seen && !s.boss.offline) {
        this.stoolSeenT += dt;
        if (this.stoolSeenT > 2) {
          this.stoolSeenT = 0;
          s.removeItem(st);
          this.stools = this.stools.filter((x) => x !== st);
          s.boss.confront();
          s.bossSay('stool', true);
          s.annoyance += 10;
        }
      }
      return;
    }
    this.stoolSeenT = 0;
  }

  // ---------------------------------------------------------------- E

  interact(look: Look | null): boolean {
    const info = look?.info;
    if (!look || info?.kind !== 'coFun') return false;
    const s = this.s;
    switch (info.id as string) {
      case 'note':
        s.say(NOTE_TEXT, 6);
        s.secret('checkout.note');
        return true;
      case 'pa':
        this.announce();
        return true;
      case 'button':
        this.pressButton();
        return true;
      case 'gacha':
        s.say(String(info.text ?? ''), 3);
        return true;
      case 'bottles':
        this.returnBottle();
        return true;
      case 'cabinet':
        this.useCabinet();
        return true;
      case 'phone':
        this.answerPhone();
        return true;
      case 'radio':
        this.radioIdx = (this.radioIdx + 1) % RADIO.length;
        s.sfx.noise(0.25, 0.12, 2500, 0, 0.6, 'bandpass');
        s.hud.say('RADIO', RADIO[this.radioIdx], 4);
        return true;
      case 'selfscan':
        s.hud.say('SELF CHECKOUT 4', 'Please place the human in the bagging area. ... Human scanned. Price €0.00. Thank you for shopping.', 5);
        s.sfx.tone(1568, 0.09, 'square', 0.06);
        s.secret('checkout.selfscan');
        s.hype += 6;
        for (const b of this.h.selfBots()) if (Math.random() < 0.5) b.say(pick(['A human at a self checkout. Gross.', 'It scanned itself. For free. Typical.', 'Unexpected human in self checkout area.']), 3);
        return true;
      case 'vending':
        s.say('SNAX-O-MAT. It accepts exact firmware only. You have no firmware. The snacks look at you.', 3.5);
        return true;
      case 'lobsters':
        s.say(pick(['A robot lobster waves a claw. It might be a greeting. It might be a union sign.', 'You tap the glass. The lobsters file a noise complaint.', 'The lobsters walk sideways in a perfect circle. Code 4563.']), 3.5);
        return true;
      case 'feedback':
        s.say(pick(['RATE YOUR HUMAN. You press the green face. The terminal asks for proof.', 'RATE YOUR HUMAN. You rate yourself. The result is forwarded to Brad.', 'RATE YOUR HUMAN. You press ">:(". The terminal agrees with you.']), 3.5);
        s.sfx.click();
        return true;
      case 'cans':
        this.bottomCan();
        return true;
      case 'outside':
        this.outside?.say(pick(['HONK!', 'HONK HONK!', 'A HUMAN! HONK!']), 2.5);
        this.outside?.act();
        s.say('You wave at the robot in the rain. It honks with its mouth.', 3);
        s.secret('checkout.outside');
        return true;
    }
    return false;
  }

  hint(look: Look | null): string | null {
    const info = look?.info;
    if (info?.kind !== 'coFun') return null;
    const held = this.s.held;
    switch (info.id as string) {
      case 'note':
        return 'E: read the note';
      case 'pa':
        return 'E: make an announcement';
      case 'button':
        return 'Do not press';
      case 'gacha':
        return 'MYSTERY BOLTS (1 credit)';
      case 'bottles':
        return held ? `E: return ${held.def.name}` : 'Bottle return';
      case 'cabinet':
        if (this.cabinetOpen) return 'An open oil cabinet';
        return held?.def.id === KEY_DEF.id ? 'E: unlock the cabinet' : 'Robot oil (locked)';
      case 'phone':
        return this.ringT > 0 ? 'E: answer the phone' : 'Phone';
      case 'radio':
        return 'E: change the station';
      case 'selfscan':
        return 'E: use Self Checkout 4';
      case 'vending':
        return 'SNAX-O-MAT';
      case 'lobsters':
        return 'E: tap the glass';
      case 'feedback':
        return 'E: rate your human';
      case 'cans':
        return 'E: take the bottom one';
      case 'outside':
        return 'E: wave';
    }
    return null;
  }

  private announce(): void {
    const s = this.s;
    const text = PA_LINES[this.paIdx++ % PA_LINES.length];
    s.sfx.tone(784, 0.2, 'sine', 0.06);
    s.sfx.tone(988, 0.2, 'sine', 0.06, undefined, 0.22);
    s.sfx.tone(1175, 0.35, 'sine', 0.06, undefined, 0.44);
    s.hud.say('INTERCOM (you)', text, 4.5);
    s.secret('checkout.pa');
    s.chat('pa', {}, 2);
    s.hype += 6;
    const bots = this.h.laneBots();
    bots.slice(0, 3).forEach((b, i) => setTimeout(() => b.say(pick(PA_REACT), 3), 900 + i * 700));
    if (!s.boss.offline && s.boss.horizontalDist(s.player.pos) < 14) {
      s.annoyance += 8;
      setTimeout(() => this.s.bossSay('pa'), 2200);
    }
  }

  private pressButton(): void {
    const s = this.s;
    if (this.buttonCd > 0) {
      s.sfx.click();
      s.say('Click. Nothing. The button needs a moment. It has been through a lot.', 2.5);
      return;
    }
    this.buttonCd = 8;
    const fx = this.fx[this.presses++ % this.fx.length];
    s.sfx.unlock();
    s.secret('checkout.music');
    s.hype += 8;
    switch (fx) {
      case 'music':
        this.musicT = 10;
        this.musicStep = -1;
        this.danceT = 10;
        s.say('ELEVATOR MUSIC ENABLED. The queue starts dancing. They did not have a choice.', 4);
        s.chat('music', {}, 2);
        break;
      case 'brad':
        if (!s.boss.offline) {
          s.say('The button has been pressed. Brad has been notified.', 3.5);
          s.boss.micromanage();
        } else s.say('The button has been pressed. Brad would have been notified.', 3.5);
        break;
      case 'applause':
        s.say('The store speakers play applause. It is a recording from 2048. Lane 0 got a standing ovation.', 4);
        for (let i = 0; i < 14; i++) s.sfx.noise(0.08, 0.15, 1800 + Math.random() * 1500, i * 0.12 + Math.random() * 0.05, 0.8, 'bandpass');
        for (const b of this.h.laneBots()) b.act();
        break;
    }
  }

  private returnBottle(): void {
    const s = this.s;
    const held = s.held;
    if (!held) {
      s.say('BOTTLE RETURN. Insert bottle. It accepts bottles. It has accepted other things before.', 3);
      return;
    }
    if (held.def.toiletKey) {
      s.sfx.buzz();
      s.say('"UNEXPECTED CART IN RETURN AREA." The machine refuses. It has standards. Low ones.', 3);
      return;
    }
    s.removeHeld();
    s.sfx.whoosh();
    s.sfx.clink();
    const bottle = /Fizz|Oil|Ketchup|Cola/i.test(held.def.id + held.def.name);
    if (bottle) {
      s.hud.say('BOTTLE RETURN', `${held.def.name} accepted. €0.08 credit. The credit is non-transferable and non-real.`, 3.5);
      return;
    }
    s.hud.say('BOTTLE RETURN', `${held.def.name} accepted as a bottle. €0.08 credit. The machine has questions. It keeps them to itself.`, 4);
    s.secret('checkout.bottles');
    s.hype += 6;
  }

  private useCabinet(): void {
    const s = this.s;
    if (this.cabinetOpen) {
      s.say('The cabinet is open. The robot oil is 18+. You checked your own ID. You passed.', 3);
      return;
    }
    if (s.held?.def.id !== KEY_DEF.id) {
      s.say('ROBOT OIL (18+). Locked. The key is with Brad. Brad says the key is "a journey".', 3);
      return;
    }
    this.cabinetOpen = true;
    s.removeHeld();
    s.sfx.unlock();
    const glass = this.L.cabinetGlass;
    glass.visible = false;
    const open = new THREE.Mesh(new THREE.BoxGeometry(1.36, 1.9, 0.02), glass.material as THREE.Material);
    open.geometry.translate(0.68, 0, 0);
    open.position.set(-0.68, 1.0, 0.26);
    open.rotation.y = -1.9;
    this.L.cabinet.add(open);
    const c = this.L.cabinet.position;
    this.spawn(OIL_DEF, new THREE.Vector3(c.x + 0.6, 1.1, c.z), new THREE.Vector3(1.5, 1, rand(-0.3, 0.3)));
    s.say('Click. The robot oil cabinet opens. One bottle rolls out. You are 18 now. Congratulations.', 4);
    s.secret('checkout.cabinet');
    s.hype += 10;
    if (!s.boss.offline && s.boss.horizontalDist(s.player.pos) < 12) s.bossSay('cabinet', true);
  }

  private answerPhone(): void {
    const s = this.s;
    if (this.ringT <= 0) {
      s.sfx.tone(425, 0.8, 'sine', 0.04);
      s.say(pick(['Dial tone. It sounds like 2049.', 'You dial customer service. It rings right in front of you. Nobody answers.', 'The phone says complaints are taken from 03:00 to 03:05. It is not 03:00.']), 3);
      return;
    }
    this.ringT = 0;
    this.handset.position.y = 0.095;
    s.sfx.click();
    s.hud.say('CUSTOMER SERVICE PHONE', pick(CALLERS), 6);
    s.secret('checkout.phone');
    s.hype += 6;
    if (s.seen) s.bossSay('phoneSeen');
  }

  private bottomCan(): void {
    const s = this.s;
    const b = this.cans.group.userData.breakable as BreakableState | undefined;
    if (!b || b.broken) return;
    b.broken = true;
    this.cans.group.visible = false;
    this.cans.collider.disabled = true;
    this.L.interactables = this.L.interactables.filter((o) => o !== this.cans.group);
    s.sfx.smash();
    this.spillCans();
    s.say('You take the bottom one. Physics takes the rest.', 3.5);
    s.hype += 12;
    if (s.seen) s.annoyance += 15;
  }

  // ---------------------------------------------------------------- kicks and throws

  onKick(look: Look | null): boolean {
    if (!look || !this.near(look)) return false;
    const s = this.s;
    const id = look.info.kind === 'coFun' ? (look.info.id as string) : '';
    if (id === 'gacha') {
      this.gachaKicks++;
      s.sfx.thud();
      if (Math.random() < this.gachaLuck || this.gachaKicks === 6) {
        const g = this.L.gacha!;
        const prize = Math.random() < 0.1 ? PRIZES[2] : pick(PRIZES.slice(0, 2));
        this.spawn(prize, new THREE.Vector3(g.position.x, 0.5, g.position.z - 0.45), new THREE.Vector3(rand(-0.5, 0.5), 1.2, -1.5));
        s.say('Clunk. A capsule rolls out. You did not pay. The machine will remember.', 3);
        s.secret('checkout.gacha');
        s.chat('gacha', {}, 2);
        s.hype += 8;
        this.gachaKicks = 0;
      } else s.say(pick(GACHA_FAIL), 2.5);
      return true;
    }
    if (id === 'vending') {
      const b = look.object.userData.breakable as BreakableState | undefined;
      if (b && !b.broken && b.hp > 1 && Math.random() < 0.7) {
        this.spawn(pick(SNACKS), new THREE.Vector3(ROOM.minX + 0.9, 0.35, -0.3), new THREE.Vector3(rand(1.5, 2.5), 1, rand(-0.5, 0.5)));
        s.say('A snack drops out. The machine regrets everything.', 2.5);
      }
      return false;
    }
    if (id === 'button') {
      this.pressButton();
      return true;
    }
    return false;
  }

  thrownHit(it: Item): boolean {
    const p = it.mesh.position;
    // The TV at customer service: hit it and it finds a channel.
    if (!this.tvFixed && p.x < -17.2 && p.y > 2.55 && p.y < 3.45 && p.z > 9.25 && p.z < 10.35) {
      const s = this.s;
      it.vel.set(1.5, -1, 0);
      it.thrown = false;
      s.sfx.thud();
      this.tvFixed = true;
      if (this.feed) {
        this.tvMat.map = this.feed.rt.texture;
        this.tvMat.needsUpdate = true;
      }
      s.say('The TV flickers and finds a channel. HUMAN CAM, LIVE. 2.1 million robots watching. It is you.', 4.5);
      s.secret('checkout.tv');
      s.chat('tv', {}, 3);
      s.hype += 12;
      return true;
    }
    return false;
  }
}

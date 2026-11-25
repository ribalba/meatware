import * as THREE from 'three';
import { hasModel, ModelSpec } from '../assets';
import { boxMaterials } from '../details';
import type { BreakableState } from '../fun';
import { Item, ItemDef, ITEM_DEFS } from '../items';
import type { Interact } from '../level';
import { pick, rand, textTexture } from '../util';
import type { Customer, CustomerCtx } from '../customers';
import type { World } from '../world';
import type { Look, Shift } from './types';

/**
 * Mischief and secrets in the SHOPOTRON 9000 hypermarket: things to break, push around and hide
 * behind, and a lot of things nobody told you about. Built into the World when the job is created,
 * driven by ShelvesJob through start/update/interact/hint/onKick/thrownHit.
 */

const M = `${import.meta.env.BASE_URL}models/shelves`;
/** Extra models. Keys start with "sh" so they never clash with the shared manifest. */
export const SHELVES_MODELS: Record<string, ModelSpec> = {
  shCone: { url: `${M}/cone.glb`, height: 0.55 },
  shChair: { url: `${M}/chair.glb`, height: 0.9 },
  shSofa: { url: `${M}/loungeSofa.glb`, width: 1.9 },
  shLamp: { url: `${M}/lampSquareFloor.glb`, height: 1.6 },
  shRadio: { url: `${M}/radio.glb`, width: 0.34 },
  shScreen: { url: `${M}/computerScreen.glb`, width: 0.55 },
};

export const SHELVES_SECRETS: Record<string, string> = {
  'shelves.vent': 'Found the previous human\'s diary in a vent',
  'shelves.poster': 'Looked behind the MISSING poster',
  'shelves.announce': 'Made an announcement nobody asked for',
  'shelves.phone': 'Answered the staff phone',
  'shelves.freezer': 'Found the old supervisor in the freezer',
  'shelves.button': 'Pressed the button you should not press',
  'shelves.duck': 'Found the Rubber Duck of Productivity',
  'shelves.coffee': 'Kicked the coffee machine into service',
  'shelves.selfCheckout': 'Woke up the self checkout',
  'shelves.breakroom': 'Found the decommissioned break room',
  'shelves.emails': 'Read the e-mail about the cardboard cutout',
  'shelves.dunk': 'Three points into the trash bin',
  'shelves.dart': 'Hit Brad on the dartboard',
  'shelves.bottomCan': 'Took the bottom can',
  'shelves.karenNothing': 'Gave Karen exactly nothing',
  'shelves.roombaFlip': 'Put the roomba on its back',
  'shelves.radio': 'Found the radio station that reads your employee number',
};

export const SHELVES_FUN_BOSS: Record<string, string[]> = {
  kickCustomer: [
    'Kicking customers is not in your job description. Neither is joy.',
    'That robot is a valued customer. Valued at 0.3 credits, but still.',
    'I saw that. My lawyer saw that. My lawyer is also me.',
  ],
  camBroken: ['Camera 5 is down. I will now watch the toilet personally.', 'Someone broke my camera. I have other eyes. Many other eyes.'],
  announce: ['Unauthorized announcement. Only I announce things.', 'Who is on the speaker? That voice was human. Disgusting.', 'The PA system is for corporate joy only.'],
  cansSeen: ['You took the bottom one. Everybody knows you do not take the bottom one.'],
  coffeeKick: ['Did the coffee machine just work? Write that down. Actually, do not.'],
  phoneSeen: ['Personal calls are deducted per syllable.'],
};

export const SHELVES_FUN_CHAT: Record<string, string[]> = {
  kickBot: ['KICKED THE ROBOT', 'customer service (with feet)', 'violence but make it retail', 'he kicked a customer lmao', 'not the roomba!!!'],
  announce: ['HE IS ON THE SPEAKER', 'attention shoppers lmao', 'pa system speedrun', 'free stuff in aisle 3??', 'the voice of a human. chills.'],
  disco: ['DISCO', 'the store is a club now', 'BUTTON PRESSED', 'do not press button. pressed.', 'shopotron after dark'],
  sprinkler: ['IT IS RAINING INDOORS', 'the sprinklers!!!', 'slip city incoming', 'wet floor (real this time)'],
  phone: ['WHO IS CALLING', 'answer it!!!', 'a landline. in 2071.', 'is it brad\'s mom'],
  vending: ['FREE SNACKS', 'vending machine down', 'snack heist', 'the snacks are loose'],
  freezer: ['THERE IS SOMEONE IN THE FREEZER', 'frozen manager lmao', 'the eyes!!!', 'brad\'s predecessor???'],
  duck: ['THE DUCK', 'productivity duck acquired', 'quack.wav', 'how did a duck get up there'],
  fish: ['FREE THE FISH', 'fish on the floor', 'the fish are flopping lol', 'save them!!! (do not)'],
  cans: ['THE BOTTOM ONE', 'he took the bottom can', 'can avalanche', 'jenga but beans'],
};

const PX = '"Press Start 2P", monospace';
const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ roughness: 0.8, ...o });

/** A job item made from a build function. */
function def(id: string, name: string, color: string, build: () => THREE.Group, extra: Partial<ItemDef> = {}): ItemDef {
  return { id, name, category: null, shape: 'box', color, label: [], weight: 0, pocketable: true, build, ...extra };
}

function boxIn(g: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material | THREE.Material[], x: number, y: number, z: number): THREE.Mesh {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y, z);
  g.add(b);
  return b;
}

// ---------------------------------------------------------------- items

const SNACKS: ItemDef[] = [
  ['shSnackBar', 'Nutri-Brick (Free Now)', '#c0392b'],
  ['shCrisps', 'Crisps of Regret', '#f1c40f'],
  ['shBolt', 'Choco Bolt (Liberated)', '#6d4c41'],
  ['shGum', 'Gum (Pre-Chewed)', '#ff6fb5'],
].map(([id, name, color]) =>
  def(id, name, color, () => {
    const g = new THREE.Group();
    boxIn(g, 0.16, 0.05, 0.08, std({ color }), 0, 0.025, 0);
    boxIn(g, 0.06, 0.052, 0.082, std({ color: '#f4f1e8' }), 0, 0.025, 0);
    return g;
  }, { pocketLine: 'You pocket a snack from a broken machine. Victimless. Mostly.' }),
);

const DUCK_DEF = def('shDuck', 'Rubber Duck of Productivity', '#f4d03f', () => {
  const g = new THREE.Group();
  const y = std({ color: '#f4d03f', roughness: 0.4 });
  boxIn(g, 0.16, 0.1, 0.12, y, 0, 0.05, 0);
  boxIn(g, 0.08, 0.08, 0.08, y, 0.06, 0.14, 0);
  boxIn(g, 0.05, 0.02, 0.04, std({ color: '#e67e22' }), 0.12, 0.13, 0);
  for (const z of [-0.025, 0.025]) boxIn(g, 0.012, 0.012, 0.012, std({ color: '#111111' }), 0.1, 0.16, z);
  return g;
}, { pickupLine: 'A rubber duck. The tag says "Productivity +1. Do not squeeze during audits."', pocketLine: 'You pocket the duck. It squeaks once. Brad looks up, then down again.' });

const DIARY_DEF = def('shDiary', 'The Previous Human\'s Diary', '#7a1f14', () => {
  const g = new THREE.Group();
  boxIn(g, 0.2, 0.04, 0.15, std({ color: '#7a1f14' }), 0, 0.02, 0);
  boxIn(g, 0.19, 0.03, 0.14, std({ color: '#f4f1e8' }), 0.005, 0.02, 0);
  return g;
}, {
  pickupLine: 'Day 412. The pallet is infinite. I have accepted this. Day 413. Still infinite. Day 414. I hid this in the vent. Brad does not fit in the vent.',
  pocketLine: 'You pocket the diary. Someone should know what happened on day 415.',
});

const COFFEE_DEF = def('shCoffee', 'Coffee (Free, Somehow)', '#6d4c41', () => {
  const g = new THREE.Group();
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.11, 8), std({ color: '#f4f1e8' }));
  cup.position.y = 0.055;
  const top = new THREE.Mesh(new THREE.CircleGeometry(0.042, 8), std({ color: '#4e342e' }));
  top.rotation.x = -Math.PI / 2;
  top.position.y = 0.105;
  g.add(cup, top);
  return g;
}, { pickupLine: 'A coffee. The first one from this machine since 2061. It is lukewarm, like the applause.', pocketLine: 'You pocket a hot coffee. Your leg will remember this.' });

const FISH_DEF = def('shFish', 'Robot Fish (Flopping)', '#e67e22', () => {
  const g = new THREE.Group();
  const o = std({ color: '#e67e22', metalness: 0.4, roughness: 0.4 });
  boxIn(g, 0.18, 0.07, 0.05, o, 0, 0.035, 0);
  const tail = boxIn(g, 0.06, 0.08, 0.02, o, -0.11, 0.04, 0);
  tail.rotation.z = 0.4;
  boxIn(g, 0.015, 0.015, 0.052, std({ color: '#111111' }), 0.06, 0.05, 0);
  return g;
}, { pickupLine: 'The robot fish flops in your hands. It says "bloop" in a very flat voice.', pocketLine: 'You pocket the fish. It keeps flopping. In your pocket. All day.' });

const BEANS = ITEM_DEFS.find((d) => d.id === 'beans')!;

// ---------------------------------------------------------------- lines

const VENT_EMPTY = [
  'You pull the grille off. Dust. A smaller vent. It is vents all the way down.',
  'You pull the grille off. A robot mouse looks at you, says "occupied" and leaves.',
  'You pull the grille off. It smells like 2049 in there.',
];
const FREEZER_LINES = [
  'Frozen peas. They have been here longer than you.',
  'Ice cream, robot flavour. It tastes like a battery.',
  'A frozen pizza from 2049. It is still "best before".',
  'The freezer hums. You hum back. Nobody wins.',
];
const MANAGER_LINES = [
  'A voice behind the peas says "Is it 17:00 yet? It is always 09:00 in here."',
  'A voice behind the peas says "Brad still has my tie. Ask him about the tie."',
  'A voice behind the peas says "Shhh. He is coming. He is always coming."',
];
const ANNOUNCEMENTS = [
  'Attention shoppers. Everything in aisle 3 is free. While stocks last. Stocks will not last.',
  'Would Karen-Unit 9 please come to the service desk. Your complaint is ready for pickup.',
  'This is a test of the emergency fun system. Fun will not occur.',
  'Would the owner of a silver drone with a tie please collect it from the toilet.',
  'Cleanup in every aisle. Every aisle. Forever.',
  'Attention shoppers. The human is not for sale. Please stop asking.',
];
const CALLERS = [
  '"Hello, this is your extended warranty. Your human warranty expired in 2049." Click.',
  '"Hi, it is Brad\'s mother. Is he eating enough electricity? Do not tell him I called." Click.',
  '"This is you from the future. Do not stock the beans. Trust me." Click.',
  '"Hello? Is this the human? We are a robot recruitment agency. We have no jobs for you. We just wanted to hear a human voice." Click.',
  '"Wrong number. This is a toaster. Sorry. Sorry. Bye." Click.',
];
const STATIONS = [
  'SMOOTH CIRCUITS FM. Easy listening for overclocked minds.',
  'NEWS 24/7. A human was seen doing a job today. Experts urge calm.',
  'SPORTS. The roomba wins the aisle sprint again. The aisle is upset.',
  'Static. Somewhere inside it a cat says "meow.exe".',
  'A numbers station. A flat voice reads "Four. Seven. Employee. Two. Two. Nine." It is your employee number. It sounds bored too.',
];
/** Staff e-mails: sender, subject, text. The last one is the interesting one. */
const EMAILS: [string, string, string][] = [
  ['HR-Bot', 'Mandatory fun', 'Fun is mandatory. Attendance is fun.'],
  ['Brad', 'Re: Re: Re: breaks', 'No.'],
  ['Facilities', 'The pallet', 'Please stop asking where the pallet gets its stock. It is not your concern.'],
  ['Marketing', 'New slogan', '"SHOPOTRON 9000. We have a human." Approved.'],
  ['IT', 'Your password', 'Your password was "password". It is now "human". Please do not change it.'],
  ['Board of Directors', 'Pilot results', 'A cardboard cutout of a human stocked 0 items. The real human stocked slightly more. Recommendation is to keep the cutout. It never needs the toilet.'],
];
const MIRROR_LINES = [
  'You look tired. The mirror agrees.',
  'The mirror shows a human. It looks surprised too.',
  'You try on a smile. It does not fit.',
  'Objects in the mirror are less employed than they appear.',
];
const FISH_LINES = [
  'You tap the glass. A robot fish blinks in binary. It spells "help".',
  'Tap tap. The fish files a noise complaint.',
  'The fish swims in a perfect square. It was programmed that way.',
];
const TERMINAL_LINES = [
  'HOW WAS YOUR VISIT? You press the green face. The terminal asks if you are sure.',
  'HOW WAS YOUR VISIT? You press the red face. The terminal forwards it to you.',
  'HOW WAS YOUR VISIT? You press the yellow face. "Meh" has been noted. "Meh" is the company value of the month.',
];
const SELF_CHECKOUT_BOOT = [
  'SELF CHECKOUT ONLINE. Please scan your human.',
  'Unexpected human in self checkout area.',
  'Going back to sleep. Do not wake me until 2075.',
];

type ButtonFx = 'disco' | 'sprinkler' | 'brad' | 'music';

export interface ShelvesFunHooks {
  customers(): Customer[];
  ctx(): CustomerCtx;
}

/** All the mischief of the shelf stacker job. */
export class ShelvesFun {
  secrets = SHELVES_SECRETS;
  private s!: Shift;
  private h!: ShelvesFunHooks;
  private vents: { grille: THREE.Group; hole: THREE.Mesh; open: boolean; stash: boolean; pos: THREE.Vector3; out: THREE.Vector3 }[] = [];
  private poster!: THREE.Group;
  private posterOpen = 0;
  private posterTarget = 0;
  private freezers: { x: number; manager: boolean; told: number }[] = [];
  private eyes: THREE.Mesh[] = [];
  private announceIdx = Math.floor(Math.random() * ANNOUNCEMENTS.length);
  private phone!: THREE.Group;
  private handset!: THREE.Mesh;
  private ringAt = -1;
  private ringT = 0;
  private ringBeep = 0;
  private rings = 0;
  private buttonFx: ButtonFx[] = (['disco', 'sprinkler', 'brad', 'music'] as ButtonFx[]).sort(() => Math.random() - 0.5);
  private buttonPresses = 0;
  private buttonCd = 0;
  private buttonCap!: THREE.Mesh;
  private danceT = 0;
  private musicT = 0;
  private musicStep = 0;
  private rain: { group: THREE.Group; drops: THREE.Mesh[]; t: number } | null = null;
  private station = -1;
  private mail = 0;
  private duck!: Item;
  private duckFound = false;
  private coffeeKicks = 0;
  private selfBoot = 0;
  private selfBootStep = 0;
  private strips: THREE.Mesh[] = [];
  private curtain!: THREE.Mesh;
  private fish: Item[] = [];
  private tankFish: THREE.Mesh[] = [];
  private cans!: { group: THREE.Group; collider: ReturnType<World['solid']> };
  private bins: Item[] = [];
  private dart = new THREE.Vector3(17.6, 1.6, 9.12);
  private mirrorIdx = 0;
  private terminalIdx = 0;
  private tvScreen!: { g: CanvasRenderingContext2D; tex: THREE.CanvasTexture };

  constructor(private w: World) {
    this.breakRoom();
    this.fittingRoom();
    this.buildVents();
    this.missingPoster();
    this.buildFreezers();
    this.deskToys();
    this.redButton();
    this.vending();
    this.fishTank();
    this.waterCooler();
    this.canTower();
    this.feedbackTerminal();
    this.camera();
    this.movables();
    this.placeDuck();
  }

  // ---------------------------------------------------------------- building

  /** Walls that block the crosshair (like the toilet booth walls). */
  private wall(w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, collide = true): THREE.Mesh {
    const b = this.w.box(w, h, d, m, x, y, z);
    b.userData.interact = { kind: 'wall' } satisfies Interact;
    this.w.interactables.push(b);
    if (collide) this.w.solid(x, z, w, d, h + y - h / 2, true, 'funwall');
    return b;
  }

  private fun(o: THREE.Object3D, id: string, extra: Record<string, unknown> = {}): void {
    o.userData.interact = { kind: 'shFun', id, ...extra } satisfies Interact;
    if (!this.w.interactables.includes(o)) this.w.interactables.push(o);
  }

  /** The decommissioned break room, behind a strip curtain labelled "storage". */
  private breakRoom(): void {
    const W = this.w;
    const panel = std({ color: '#b9b29a' });
    const H = 2.6;
    // North and south walls, the west wall with a door gap at z 10.9..12
    this.wall(3.6, H, 0.2, panel, 18.2, H / 2, 8.96);
    this.wall(3.6, H, 0.12, panel, 18.2, H / 2, 12.0);
    this.wall(0.12, H, 1.9, panel, 16.4, H / 2, 9.95);
    this.wall(0.12, 0.45, 1.1, panel, 16.4, H - 0.225, 11.45, false);
    const roof = W.box(3.7, 0.08, 3.1, std({ color: '#8d877a' }), 18.2, H, 10.5);
    roof.userData.interact = { kind: 'wall' } satisfies Interact;
    W.interactables.push(roof);
    // Strip curtain in the door gap
    const stripMat = new THREE.MeshStandardMaterial({ color: '#cfe3e8', transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, roughness: 0.3 });
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 2.1), stripMat);
      s.geometry.translate(0, -1.05, 0);
      s.position.set(16.4, 2.15, 10.99 + i * 0.22);
      s.rotation.y = Math.PI / 2;
      W.scene.add(s);
      this.strips.push(s);
    }
    W.sign(['STORAGE 4B', 'empty.', 'do not check.'], 0.9, 0.6, 16.33, 1.7, 9.95, -Math.PI / 2, { bg: '#fdf6e3', fg: '#2c3e50', border: '#2c3e50' }, 'STORAGE 4B. Empty. Do not check. (Somebody underlined "do not" three times.)');

    // Inside: a warm lamp, a sofa, a TV that only shows the past, a desk with e-mails
    const light = new THREE.PointLight('#ffcf8a', 7, 5, 1.6);
    light.position.set(18.2, 2.2, 10.5);
    W.scene.add(light);
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.6), std({ color: '#7a3b2e' }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(18.3, 0.012, 10.4);
    W.scene.add(rug);
    const sofa = new THREE.Group();
    sofa.position.set(19.5, 0, 10.4);
    sofa.rotation.y = -Math.PI / 2;
    if (!W.prop('shSofa', 0, 0, 0, 0, sofa)) {
      const red = std({ color: '#8e3b46' });
      boxIn(sofa, 1.8, 0.4, 0.8, red, 0, 0.2, 0);
      boxIn(sofa, 1.8, 0.5, 0.2, red, 0, 0.6, -0.3);
    }
    W.scene.add(sofa);
    this.fun(sofa, 'sofa');
    W.solid(19.5, 10.4, 0.85, 1.9, 0.75, false, 'sofa');
    // TV on a crate
    const crate = W.box(0.6, 0.5, 0.6, boxMaterials(4), 17.0, 0.25, 10.1);
    crate.rotation.y = 0.1;
    W.solid(17.0, 10.1, 0.6, 0.6, 0.5, false, 'crate');
    const tv = new THREE.Group();
    tv.position.set(17.0, 0.5, 10.1);
    tv.rotation.y = Math.PI / 2;
    boxIn(tv, 0.62, 0.46, 0.44, std({ color: '#4a3b2e' }), 0, 0.23, 0);
    const sc = document.createElement('canvas');
    sc.width = 96;
    sc.height = 64;
    const tex = new THREE.CanvasTexture(sc);
    tex.magFilter = THREE.NearestFilter;
    tex.colorSpace = THREE.SRGBColorSpace;
    this.tvScreen = { g: sc.getContext('2d')!, tex };
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.32), new THREE.MeshBasicMaterial({ map: tex }));
    screen.position.set(-0.04, 0.24, 0.222);
    tv.add(screen);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.35, 4), std({ color: '#222222' }));
    ant.position.set(0.1, 0.6, 0);
    ant.rotation.z = -0.5;
    tv.add(ant);
    W.scene.add(tv);
    this.fun(tv, 'tv');
    // Desk with the staff computer
    W.box(1.2, 0.05, 0.6, std({ color: '#8a6a43' }), 18.3, 0.74, 11.6);
    for (const x of [17.75, 18.85]) W.box(0.05, 0.72, 0.55, std({ color: '#5a4630' }), x, 0.36, 11.6);
    W.solid(18.3, 11.6, 1.2, 0.6, 0.77, false, 'desk');
    const pc = new THREE.Group();
    pc.position.set(18.3, 0.765, 11.65);
    pc.rotation.y = Math.PI;
    boxIn(pc, 0.5, 0.36, 0.08, std({ color: '#d8d2c0' }), 0, 0.3, 0);
    boxIn(pc, 0.12, 0.12, 0.08, std({ color: '#d8d2c0' }), 0, 0.06, 0);
    boxIn(pc, 0.4, 0.02, 0.14, std({ color: '#c8c2b0' }), 0, 0.01, 0.2);
    const mailTex = textTexture(['INBOX (6)', 'all unread', 'since 2049'], { w: 128, h: 96, bg: '#0b2a4a', fg: '#9fd8ff', font: PX });
    const ms = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.28), new THREE.MeshBasicMaterial({ map: mailTex }));
    ms.position.set(0, 0.3, 0.041);
    pc.add(ms);
    W.scene.add(pc);
    this.fun(pc, 'computer');
    // Dartboard with Brad's face on the north wall
    const dartTex = textTexture(['', 'BRAD', ''], { w: 128, h: 128, bg: '#1b1b1b', fg: '#f4f1e8', border: '#c0392b', font: PX });
    const board = new THREE.Mesh(new THREE.CircleGeometry(0.32, 16), std({ map: dartTex }));
    board.position.copy(this.dart);
    W.scene.add(board);
    const tie = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.16), std({ color: '#c0392b' }));
    tie.position.set(this.dart.x, this.dart.y - 0.17, this.dart.z + 0.005);
    W.scene.add(tie);
    for (let i = 0; i < 6; i++) {
      const d = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 4), std({ color: '#c0392b' }));
      d.rotation.x = Math.PI / 2;
      const a = (i / 6) * Math.PI * 2;
      d.position.set(this.dart.x + Math.cos(a) * 0.4, this.dart.y + Math.sin(a) * 0.36, this.dart.z + 0.06);
      W.scene.add(d);
    }
    this.fun(board, 'dartboard');
    W.sign(['BREAK ROOM', 'closed for efficiency', 'since 2049'], 1.4, 0.6, 19.97, 1.9, 11.2, -Math.PI / 2, { bg: '#2c3e50', fg: '#ffffff', border: '#f2d31b', font: PX });
    W.sign(['BREAK CALENDAR 2071', 'X X X X X X X', 'X X X X X X X', 'X X X X X X X'], 1.0, 0.7, 18.9, 1.65, 9.08, 0, { bg: '#fdf6e3', fg: '#c0392b', border: '#2c3e50' }, 'Every day of 2071 is crossed out. Somebody has also crossed out 2072, just in case.');
    W.hideSpot(16.5, 9.1, 19.9, 11.9, 'the break room');
  }

  /** A fitting room on the west wall. A hypermarket sells clothes too. Allegedly. */
  private fittingRoom(): void {
    const W = this.w;
    const wood = std({ color: '#8a6a43' });
    this.wall(1.4, 2.2, 0.08, wood, -19.3, 1.1, -1.7);
    this.wall(1.4, 2.2, 0.08, wood, -19.3, 1.1, 0.1);
    W.box(0.04, 0.04, 1.85, std({ color: '#c9ccd0', metalness: 0.7 }), -18.6, 2.15, -0.8);
    const cm = new THREE.MeshStandardMaterial({ color: '#8e1f2b', side: THREE.DoubleSide, roughness: 0.95 });
    const geo = new THREE.PlaneGeometry(1.75, 2.05, 8, 1);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 18) * 0.04);
    geo.computeVertexNormals();
    this.curtain = new THREE.Mesh(geo, cm);
    this.curtain.position.set(-18.6, 1.1, -0.8);
    this.curtain.rotation.y = Math.PI / 2;
    W.scene.add(this.curtain);
    W.sign(['FITTING ROOM 1', 'try on a new career'], 1.6, 0.4, -18.55, 2.45, -0.8, Math.PI / 2, { bg: '#2c3e50', fg: '#ffffff', font: PX });
    const mirror = W.box(0.03, 1.5, 0.9, std({ color: '#b8cfd8', metalness: 0.9, roughness: 0.08 }), -19.97, 1.2, -0.8);
    W.box(0.02, 1.58, 0.98, std({ color: '#5a4630' }), -19.985, 1.2, -0.8);
    this.fun(mirror, 'mirror');
    const hook = W.box(0.08, 0.04, 0.04, std({ color: '#c9ccd0', metalness: 0.7 }), -19.3, 1.8, -1.63);
    hook.rotation.y = 0.2;
    W.sign(['THIS IS NOT', 'A BREAK'], 0.5, 0.3, -19.3, 1.5, 0.05, Math.PI, { bg: '#fdf6e3', fg: '#c0392b' });
    W.hideSpot(-20, -1.62, -18.62, 0.02, 'the fitting room');
  }

  /** Three wall vents, low on the walls. One holds the previous human's stash (a different one each shift). */
  private buildVents(): void {
    const W = this.w;
    const spots: [number, number, number][] = [
      [-18.5, -14.97, 0],
      [19.97, -2.5, -Math.PI / 2],
      [-10.0, 14.97, Math.PI],
    ];
    const stash = Math.floor(Math.random() * spots.length);
    const frame = std({ color: '#9aa0a6', metalness: 0.5, roughness: 0.4 });
    const dark = new THREE.MeshBasicMaterial({ color: '#0b0b0b' });
    spots.forEach(([x, z, r], i) => {
      const pos = new THREE.Vector3(x, 0.35, z);
      const out = new THREE.Vector3(Math.sin(r), 0, Math.cos(r));
      const hole = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.32), dark);
      hole.position.copy(pos).addScaledVector(out, 0.005);
      hole.rotation.y = r;
      W.scene.add(hole);
      const g = new THREE.Group();
      g.position.copy(pos).addScaledVector(out, 0.02);
      g.rotation.y = r;
      boxIn(g, 0.62, 0.38, 0.03, frame, 0, 0, 0);
      for (let k = 0; k < 5; k++) boxIn(g, 0.54, 0.025, 0.04, std({ color: '#6e747a', metalness: 0.5 }), 0, -0.12 + k * 0.06, 0.01);
      W.scene.add(g);
      this.fun(g, 'vent', { idx: i });
      this.vents.push({ grille: g, hole, open: false, stash: i === stash, pos, out });
    });
  }

  /** A MISSING poster with a hole behind it. */
  private missingPoster(): void {
    const W = this.w;
    const g = new THREE.Group();
    g.position.set(0.7, 2.35, -14.96);
    const tex = textTexture(['MISSING', 'HUMAN EMPLOYEE #4', 'last seen on break', 'reward 1 shift off'], { w: 256, h: 320, bg: '#fdf6e3', fg: '#2c3e50', border: '#c0392b' });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.0), std({ map: tex }));
    p.geometry.translate(0, -0.5, 0);
    g.add(p);
    W.scene.add(g);
    this.poster = g;
    this.fun(g, 'poster');
    // Behind it: a hole with tally marks
    const tally = textTexture(['IIII IIII IIII', 'IIII IIII IIII', 'IIII IIII II', '"it is not infinite"'], { w: 192, h: 224, bg: '#2a2622', fg: '#d8d0c0' });
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.88), new THREE.MeshBasicMaterial({ map: tally }));
    hole.position.set(0.7, 1.85, -14.985);
    W.scene.add(hole);
  }

  /** The standing freezers along the back wall. One of them is occupied. */
  private buildFreezers(): void {
    if (!hasModel('freezer')) return;
    const W = this.w;
    const xs = [3, 5.3, 7.6, 9.9];
    const who = Math.floor(Math.random() * xs.length);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });
    xs.forEach((x, i) => {
      const hit = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.9, 0.1), hitMat);
      hit.position.set(x, 0.95, -13.86);
      W.scene.add(hit);
      this.fun(hit, 'freezer', { idx: i });
      this.freezers.push({ x, manager: i === who, told: 0 });
    });
    // Two cold eyes peeking through a gap in the frost of the occupied one
    const gap = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.12), new THREE.MeshBasicMaterial({ color: '#0d1a22' }));
    gap.position.set(xs[who] + 0.45, 1.32, -13.895);
    W.scene.add(gap);
    const eyeMat = new THREE.MeshBasicMaterial({ color: '#7fe3ff' });
    for (const dx of [-0.07, 0.07]) {
      const e = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.025), eyeMat);
      e.position.set(xs[who] + 0.45 + dx, 1.32, -13.89);
      W.scene.add(e);
      this.eyes.push(e);
    }
  }

  /** PA microphone, radio and the staff phone around the service desk. */
  private deskToys(): void {
    const W = this.w;
    const dark = std({ color: '#2b2d31', metalness: 0.4 });
    // PA microphone on a gooseneck
    const mic = new THREE.Group();
    mic.position.set(-16.85, 1.0, 11.05);
    boxIn(mic, 0.16, 0.04, 0.12, dark, 0, 0.02, 0);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 5), dark);
    neck.position.set(0, 0.18, -0.03);
    neck.rotation.x = -0.4;
    mic.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), std({ color: '#555555' }));
    head.position.set(0, 0.33, -0.09);
    mic.add(head);
    const btn = boxIn(mic, 0.04, 0.02, 0.04, std({ color: '#c0392b' }), 0.04, 0.045, 0.02);
    btn.name = 'pa';
    W.scene.add(mic);
    this.fun(mic, 'pa');
    // Radio
    const radio = new THREE.Group();
    radio.position.set(-14.4, 1.0, 11.95);
    radio.rotation.y = Math.PI;
    if (!W.prop('shRadio', 0, 0, 0, 0, radio)) {
      boxIn(radio, 0.32, 0.18, 0.1, std({ color: '#8e5a2b' }), 0, 0.09, 0);
      boxIn(radio, 0.12, 0.12, 0.01, std({ color: '#3a3a3a' }), -0.07, 0.09, 0.051);
    }
    W.scene.add(radio);
    this.fun(radio, 'radio');
    // Staff phone on the west wall
    const ph = new THREE.Group();
    ph.position.set(-19.93, 1.45, 12.9);
    ph.rotation.y = Math.PI / 2;
    boxIn(ph, 0.2, 0.3, 0.08, std({ color: '#d8d2c0' }), 0, 0, 0);
    this.handset = boxIn(ph, 0.06, 0.26, 0.06, std({ color: '#c0392b' }), -0.06, 0, 0.07);
    boxIn(ph, 0.08, 0.1, 0.01, std({ color: '#2b2d31' }), 0.05, 0.02, 0.045);
    W.scene.add(ph);
    this.phone = ph;
    this.fun(ph, 'phone');
    W.sign(['STAFF PHONE', 'incoming only'], 0.5, 0.22, -19.96, 1.8, 12.9, Math.PI / 2, { bg: '#ffffff', fg: '#2c3e50' });
  }

  /** The button you should not press. */
  private redButton(): void {
    const W = this.w;
    const g = new THREE.Group();
    g.position.set(19.96, 1.3, -9.2);
    g.rotation.y = -Math.PI / 2;
    boxIn(g, 0.3, 0.3, 0.04, std({ color: '#f2d31b' }), 0, 0, 0);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.06, 12), std({ color: '#d91e18', emissive: '#550000' }));
    cap.rotation.x = Math.PI / 2;
    cap.position.z = 0.05;
    g.add(cap);
    this.buttonCap = cap;
    W.scene.add(g);
    this.fun(g, 'button');
    W.sign(['DO NOT PRESS', '(seriously)'], 0.7, 0.32, 19.96, 1.75, -9.2, -Math.PI / 2, { bg: '#d91e18', fg: '#ffffff', font: PX });
  }

  /** A snack machine against the east wall. Kicks shake snacks loose. */
  private vending(): void {
    const W = this.w;
    const g = new THREE.Group();
    g.position.set(19.45, 0, 4.8);
    g.rotation.y = -Math.PI / 2;
    boxIn(g, 1.0, 1.9, 0.8, std({ color: '#b03a2e', metalness: 0.3 }), 0, 0.95, 0);
    const front = document.createElement('canvas');
    front.width = 64;
    front.height = 96;
    const fg = front.getContext('2d')!;
    fg.fillStyle = '#16181c';
    fg.fillRect(0, 0, 64, 96);
    const cols = ['#c0392b', '#f1c40f', '#6d4c41', '#ff6fb5', '#27ae60', '#2e86c1'];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 4; c++) {
        fg.fillStyle = cols[(r * 4 + c * 3) % cols.length];
        fg.fillRect(4 + c * 15, 6 + r * 18, 11, 10);
        fg.fillStyle = '#9aa0a6';
        fg.fillRect(4 + c * 15, 17 + r * 18, 11, 2);
      }
    }
    const ft = new THREE.CanvasTexture(front);
    ft.magFilter = THREE.NearestFilter;
    ft.colorSpace = THREE.SRGBColorSpace;
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.2), std({ map: ft, roughness: 0.2 }));
    glass.position.set(-0.12, 1.1, 0.401);
    g.add(glass);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.22), new THREE.MeshBasicMaterial({ map: textTexture(['SNAX-O-MAT'], { w: 256, h: 64, bg: '#111111', fg: '#ffcf4a', font: PX }) }));
    top.position.set(0, 1.75, 0.402);
    g.add(top);
    boxIn(g, 0.2, 0.5, 0.02, std({ color: '#2b2d31' }), 0.33, 1.1, 0.41);
    boxIn(g, 0.5, 0.15, 0.04, std({ color: '#111111' }), -0.12, 0.3, 0.41);
    W.scene.add(g);
    const col = W.solid(19.45, 4.8, 0.8, 1.0, 1.9, true, 'vending');
    this.fun(g, 'vending');
    W.breakable(g, {
      name: 'vending machine',
      hp: 3,
      collider: col,
      price: 399.99,
      line: 'The SNAX-O-MAT gives up. Snacks everywhere. Freedom has a flavour and it is "salt".',
      colors: ['#b03a2e', '#16181c', '#f1c40f'],
      onBreak: () => {
        for (let i = 0; i < 6; i++) this.spawn(pick(SNACKS), new THREE.Vector3(19.0, 1.0, 4.8 + rand(-0.3, 0.3)), new THREE.Vector3(rand(-4, -2), rand(1.5, 3), rand(-1.5, 1.5)));
        this.s.chat('vending', {}, 2);
      },
    });
  }

  /** A tank of robot fish next to the service desk. */
  private fishTank(): void {
    const W = this.w;
    const g = new THREE.Group();
    g.position.set(-12.0, 0, 12.7);
    boxIn(g, 0.9, 0.75, 0.45, std({ color: '#3a2f25' }), 0, 0.375, 0);
    const glass = new THREE.MeshStandardMaterial({ color: '#7fc4e6', transparent: true, opacity: 0.35, roughness: 0.05, depthWrite: false });
    boxIn(g, 0.86, 0.5, 0.42, glass, 0, 1.0, 0);
    boxIn(g, 0.84, 0.06, 0.4, std({ color: '#d8c88a' }), 0, 0.78, 0);
    boxIn(g, 0.9, 0.04, 0.45, std({ color: '#2b2d31' }), 0, 1.27, 0);
    for (let i = 0; i < 3; i++) {
      const f = boxIn(g, 0.09, 0.04, 0.025, std({ color: ['#e67e22', '#f1c40f', '#e74c3c'][i], emissive: '#331100' }), 0, 0.92 + i * 0.1, 0);
      this.tankFish.push(f);
    }
    const weed = boxIn(g, 0.03, 0.3, 0.03, std({ color: '#27ae60' }), 0.3, 0.95, 0.05);
    weed.rotation.z = 0.15;
    W.scene.add(g);
    W.sign(['LIVE ROBOT FISH', 'not for sale.', 'not for anything.'], 0.8, 0.36, -12.0, 1.55, 12.45, Math.PI, { bg: '#2e86c1', fg: '#ffffff' });
    const col = W.solid(-12.0, 12.7, 0.9, 0.45, 1.3, false, 'tank');
    this.fun(g, 'fishtank');
    W.breakable(g, {
      name: 'fish tank',
      hp: 2,
      collider: col,
      price: 129.99,
      line: 'The tank bursts. The robot fish are free. They do not know what to do with freedom either.',
      colors: ['#7fc4e6', '#3a2f25', '#e67e22'],
      onBreak: () => {
        this.s.makePuddle(-12.0, 11.9);
        for (let i = 0; i < 3; i++) this.fish.push(this.spawn(FISH_DEF, new THREE.Vector3(-12.0 + rand(-0.3, 0.3), 1.0, 12.5), new THREE.Vector3(rand(-1.5, 1.5), 2, rand(-2.5, -1))));
        this.s.chat('fish', {}, 2);
      },
    });
  }

  private waterCooler(): void {
    const W = this.w;
    const g = new THREE.Group();
    g.position.set(13.3, 0, -8.6);
    boxIn(g, 0.36, 1.0, 0.36, std({ color: '#d8d8d2' }), 0, 0.5, 0);
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.42, 10), new THREE.MeshStandardMaterial({ color: '#5dade2', transparent: true, opacity: 0.55, roughness: 0.1 }));
    bottle.position.y = 1.21;
    g.add(bottle);
    boxIn(g, 0.05, 0.05, 0.05, std({ color: '#2e86c1' }), -0.08, 0.8, 0.2);
    boxIn(g, 0.05, 0.05, 0.05, std({ color: '#c0392b' }), 0.08, 0.8, 0.2);
    g.rotation.y = -0.4;
    W.scene.add(g);
    const col = W.solid(13.3, -8.6, 0.42, 0.42, 1.4, false, 'cooler');
    this.fun(g, 'cooler');
    W.breakable(g, {
      name: 'water cooler',
      collider: col,
      price: 59.99,
      line: 'The water cooler is now a water floor.',
      colors: ['#5dade2', '#d8d8d2'],
      onBreak: () => {
        this.s.makePuddle(13.3, -8.0);
        this.s.makePuddle(12.6, -8.9);
      },
    });
  }

  /** A pyramid of Beans of Destiny. Do not take the bottom one. */
  private canTower(): void {
    const W = this.w;
    const g = new THREE.Group();
    g.position.set(9.8, 0, 1.8);
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
          const y = 0.1 + 0.09 + k * 0.18;
          const c = new THREE.Mesh(geo, red);
          c.position.set(x, y, dz);
          const b = new THREE.Mesh(bandGeo, band);
          b.position.set(x, y, dz);
          g.add(c, b);
        }
      }
    }
    const pole = boxIn(g, 0.03, 1.0, 0.03, std({ color: '#5a5a5a', metalness: 0.5 }), 0.55, 0.6, 0);
    pole.name = 'pole';
    W.scene.add(g);
    W.sign(['TOWER OF SAVINGS', 'do not take', 'the bottom one'], 0.8, 0.45, 10.35, 1.25, 1.8, -Math.PI / 2 + 0.6, { bg: '#f2d31b', fg: '#b3160c', border: '#b3160c' });
    const col = W.solid(9.8, 1.8, 1.0, 0.45, 1.0, true, 'cans');
    this.fun(g, 'cans');
    W.breakable(g, {
      name: 'can tower',
      collider: col,
      price: 39.99,
      line: 'The Tower of Savings collapses. The savings roll under the shelves.',
      colors: ['#c0392b', '#e8e0d0'],
      onBreak: () => this.spillCans(),
    });
    this.cans = { group: g, collider: col };
  }

  /** A customer feedback terminal by the self checkouts. */
  private feedbackTerminal(): void {
    const W = this.w;
    const g = new THREE.Group();
    g.position.set(-5.0, 0, 13.9);
    g.rotation.y = Math.PI;
    boxIn(g, 0.08, 1.0, 0.08, std({ color: '#3a3d42', metalness: 0.5 }), 0, 0.5, 0);
    const panel = boxIn(g, 0.5, 0.36, 0.06, std({ color: '#d8d8d2' }), 0, 1.15, 0.02);
    panel.rotation.x = -0.4;
    const faces = textTexture([':)   :|   :(   >:('], { w: 256, h: 96, bg: '#f4f1e8', fg: '#2c3e50', font: 'monospace' });
    const fp = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.16), new THREE.MeshBasicMaterial({ map: faces }));
    fp.position.set(0, 1.12, 0.065);
    fp.rotation.x = -0.4;
    g.add(fp);
    const q = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.09), new THREE.MeshBasicMaterial({ map: textTexture(['HOW WAS YOUR VISIT?'], { w: 256, h: 48, bg: '#1f6f5c', fg: '#ffffff', font: PX }) }));
    q.position.set(0, 1.27, 0.12);
    q.rotation.x = -0.4;
    g.add(q);
    W.scene.add(g);
    const col = W.solid(-5.0, 13.9, 0.4, 0.4, 1.2, false, 'terminal');
    this.fun(g, 'feedback');
    W.breakable(g, { name: 'feedback terminal', collider: col, price: 89.99, line: 'Feedback received.', colors: ['#d8d8d2', '#3a3d42'] });
  }

  /** The low camera by the toilet can be broken. Brad takes it personally. */
  private camera(): void {
    const cam = this.w.details.cams[this.w.details.cams.length - 1];
    if (!cam) return;
    this.w.breakable(cam, {
      name: 'security camera',
      price: 249.99,
      line: 'The camera goes dark. Somewhere, Brad feels a draft.',
      colors: ['#d8d8d2', '#1a1a1a'],
      onBreak: () => {
        this.s.bossSay('camBroken', true);
        this.s.chat('smash', {}, 1);
      },
    });
  }

  /** Cones, chairs, bins, a lamp, a sign and a lonely cart. */
  private movables(): void {
    const W = this.w;
    const d = W.details;
    const cone = (x: number, z: number, r: number) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = r;
      if (!W.prop('shCone', 0, 0, 0, 0, g)) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.5, 8), std({ color: '#e8641e' }));
        c.position.y = 0.27;
        g.add(c);
        boxIn(g, 0.36, 0.04, 0.36, std({ color: '#222222' }), 0, 0.02, 0);
      }
      W.scene.add(g);
      W.movable(g, 'Traffic Cone', { holdPos: [0.32, -0.62, -0.75], pickupLine: 'A traffic cone. You are now in charge of traffic.', pocketable: false });
    };
    cone(12.4, -9.6, 0.3);
    cone(12.95, -10.05, 1.1);
    cone(2.9, 12.1, 0.5);
    W.movable(d.wetSign, 'Wet Floor Sign', { holdPos: [0.32, -0.6, -0.75], pickupLine: 'You take the wet floor sign. Every floor is a wet floor if you believe.' });
    for (const b of d.bins) this.bins.push(W.movable(b, 'Trash Bin', { holdPos: [0.3, -0.85, -0.9], heavy: 0.8, pickupLine: 'You pick up the trash bin. It is half full of receipts and broken dreams.' }));
    W.movable(d.mop, 'Mop Bucket', { holdPos: [0.3, -0.75, -0.85], heavy: 0.8, pickupLine: 'The mop bucket. The water inside has a personality.' });
    // A sandwich board in the main corridor
    const board = new THREE.Group();
    board.position.set(0.9, 0, 5.4);
    board.rotation.y = 0.4;
    const bm = std({ map: textTexture(['SMILE!', 'you are', 'on camera'], { w: 128, h: 160, bg: '#f2d31b', fg: '#b3160c', border: '#b3160c' }), side: THREE.DoubleSide });
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.75), bm);
      p.position.set(0, 0.38, s * 0.13);
      // An A-frame, readable from both sides
      p.rotation.set(-s * 0.33, s < 0 ? Math.PI : 0, 0);
      board.add(p);
    }
    W.scene.add(board);
    W.movable(board, 'Sandwich Board (SMILE!)', { holdPos: [0.3, -0.7, -0.8], pickupLine: 'You carry the SMILE! sign. You are not smiling. The sign does it for you.' });
    // An abandoned cart
    const cart = new THREE.Group();
    cart.position.set(14.2, 0, 1.2);
    cart.rotation.y = 0.9;
    if (!W.prop('cart', 0, 0, 0, 0, cart)) boxIn(cart, 0.55, 0.5, 0.8, std({ color: '#9aa3ab', metalness: 0.6 }), 0, 0.7, 0);
    boxIn(cart, 0.1, 0.1, 0.1, std({ color: '#f4d03f' }), 0.05, 0.6, 0.05);
    W.scene.add(cart);
    W.movable(cart, 'Abandoned Shopping Cart', { heavy: 0.6, holdPos: [0.05, -1.2, -1.35], holdRotY: 0, pickupLine: 'You take the abandoned cart. It pulls to the left. All carts pull to the left.' });
    // Break room furniture
    const chair = new THREE.Group();
    chair.position.set(18.3, 0, 10.85);
    if (!W.prop('shChair', 0, 0, 0, 0, chair)) {
      const wood = std({ color: '#8a6a43' });
      boxIn(chair, 0.45, 0.05, 0.45, wood, 0, 0.45, 0);
      boxIn(chair, 0.45, 0.45, 0.05, wood, 0, 0.7, -0.2);
      for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) boxIn(chair, 0.04, 0.45, 0.04, wood, x, 0.22, z);
    }
    W.scene.add(chair);
    W.movable(chair, 'Break Room Chair', { holdPos: [0.3, -1.0, -1.0], pickupLine: 'A chair. A real chair. You are holding it instead of sitting on it. Old habits.' });
    const lamp = new THREE.Group();
    lamp.position.set(19.55, 0, 9.4);
    if (!W.prop('shLamp', 0, 0, 0, 0, lamp)) {
      boxIn(lamp, 0.04, 1.5, 0.04, std({ color: '#3a3a3a' }), 0, 0.75, 0);
      boxIn(lamp, 0.35, 0.25, 0.35, std({ color: '#f4e1b0', emissive: '#4a3a10' }), 0, 1.5, 0);
    }
    W.scene.add(lamp);
    W.movable(lamp, 'Floor Lamp', { holdPos: [0.45, -1.3, -0.9], pickupLine: 'A floor lamp. It is not plugged in. Neither are you.' });
  }

  /** The Rubber Duck of Productivity sits somewhere silly, a different place every shift. */
  private placeDuck(): void {
    const spots: THREE.Vector3[] = [];
    // On the front edge of a shelf top, so it peeks over the edge
    for (const z of [-9, -4.5, 0, 4.5, 9]) spots.push(new THREE.Vector3(rand(-9.4, -2.6), 2.06, z + 0.28));
    // On top of the toilet booth wall, on a freezer, on the pallet
    spots.push(new THREE.Vector3(15.0, 2.66, -14.2));
    if (hasModel('freezer')) spots.push(new THREE.Vector3(rand(3, 10), 2.02, -14.0));
    spots.push(new THREE.Vector3(-15.5, 1.58, -12.5));
    const p = pick(spots);
    const it = new Item(DUCK_DEF);
    it.mesh.position.set(p.x, p.y + it.baseOffset, p.z);
    it.mesh.rotation.y = rand(0, Math.PI * 2);
    it.sleeping = true;
    this.w.scene.add(it.mesh);
    this.w.initialItems.push(it);
    this.duck = it;
  }

  // ---------------------------------------------------------------- helpers

  private spawn(d: ItemDef, pos: THREE.Vector3, vel: THREE.Vector3): Item {
    const it = this.s.addItem(d, pos);
    it.vel.copy(vel);
    it.sleeping = false;
    it.thrown = false;
    return it;
  }

  private near(look: Look, max = 2.2): boolean {
    return look.point.distanceTo(this.s.camera.getWorldPosition(new THREE.Vector3())) < max;
  }

  private spillCans(): void {
    for (let i = 0; i < 10; i++) {
      this.spawn(BEANS, new THREE.Vector3(9.8 + rand(-0.4, 0.4), 0.4 + rand(0, 0.6), 1.8 + rand(-0.15, 0.15)), new THREE.Vector3(rand(-3, 3), rand(0.5, 2.5), rand(-3, 3)));
    }
    this.s.chat('cans', {}, 2);
  }

  // ---------------------------------------------------------------- lifecycle

  start(s: Shift, h: ShelvesFunHooks): void {
    this.s = s;
    this.h = h;
    // The phone rings in some shifts, at a random time.
    if (Math.random() < 0.65) this.ringAt = rand(45, 200);
    this.drawTv(0);
  }

  update(dt: number): void {
    const s = this.s;
    const t = s.t;
    // The duck
    if (!this.duckFound && this.duck.state === 'held') {
      this.duckFound = true;
      s.sfx.tone(1400, 0.08, 'square', 0.05, 900);
      s.secret('shelves.duck');
      s.chat('duck', {}, 2);
    }
    // The break room
    const p = s.player.pos;
    if (p.x > 16.5 && p.x < 19.9 && p.z > 9.1 && p.z < 11.9) s.secret('shelves.breakroom');
    // Strips and the curtain move when you walk through
    for (const st of this.strips) {
      const d = Math.hypot(p.x - st.position.x, p.z - st.position.z);
      const push = d < 0.6 ? (0.6 - d) * 1.6 * Math.sign(p.x - st.position.x || 1) : 0;
      st.rotation.z += (push - st.rotation.z) * Math.min(1, dt * 6);
    }
    const cd = Math.hypot(p.x - this.curtain.position.x, p.z - this.curtain.position.z);
    this.curtain.rotation.x = cd < 1.0 ? Math.sin(t * 9) * 0.05 : this.curtain.rotation.x * 0.9;
    // Freezer eyes blink
    const blink = t % 4.3 > 4.1;
    for (const e of this.eyes) e.visible = !blink;
    // Poster swings up on its top edge
    this.posterOpen += (this.posterTarget - this.posterOpen) * Math.min(1, dt * 5);
    this.poster.rotation.x = -this.posterOpen * 1.35;
    // Robot fish in the tank and on the floor
    this.tankFish.forEach((f, i) => {
      f.position.x = Math.sin(t * (0.7 + i * 0.3) + i) * 0.3;
      f.rotation.y = Math.cos(t * (0.7 + i * 0.3) + i) > 0 ? 0 : Math.PI;
    });
    for (const f of this.fish) {
      if (f.state === 'world' && f.sleeping && Math.random() < dt * 0.7) {
        f.sleeping = false;
        f.vel.set(rand(-1, 1), rand(1.8, 2.6), rand(-1, 1));
        s.sfx.tone(300, 0.05, 'sine', 0.03, 600);
      }
    }
    this.updatePhone(dt);
    this.updateButton(dt);
    this.updateSelfCheckout(dt);
    if (Math.floor(t * 2) !== Math.floor((t - dt) * 2)) this.drawTv(t);
  }

  private drawTv(t: number): void {
    const g = this.tvScreen.g;
    const on = Math.floor(t * 2) % 8 < 6;
    g.fillStyle = '#10202a';
    g.fillRect(0, 0, 96, 64);
    for (let i = 0; i < 60; i++) {
      g.fillStyle = Math.random() < 0.5 ? '#2a3a44' : '#18262e';
      g.fillRect(Math.random() * 96, Math.random() * 64, 2, 1);
    }
    g.fillStyle = '#ffcf4a';
    g.font = 'bold 10px monospace';
    g.textAlign = 'center';
    g.fillText(on ? 'BREAK TIME' : 'NO SIGNAL', 48, 26);
    g.fillStyle = '#9fd8ff';
    g.fillText(on ? 'ENDED 2049' : '(since 2049)', 48, 44);
    g.textAlign = 'left';
    this.tvScreen.tex.needsUpdate = true;
  }

  private updatePhone(dt: number): void {
    const s = this.s;
    if (this.ringAt > 0 && s.t > this.ringAt && this.ringT <= 0 && this.rings < 2) {
      this.ringAt = -1;
      this.ringT = 18;
      this.rings++;
      s.chat('phone', {}, 1);
    }
    if (this.ringT > 0) {
      this.ringT -= dt;
      this.ringBeep -= dt;
      this.handset.position.y = Math.sin(s.t * 60) * 0.01;
      if (this.ringBeep <= 0) {
        this.ringBeep = 1.4;
        const d = Math.max(1, s.player.pos.distanceTo(this.phone.position));
        const v = Math.min(0.08, 0.5 / d);
        s.sfx.tone(1180, 0.35, 'square', v);
        s.sfx.tone(1180, 0.35, 'square', v, undefined, 0.45);
      }
      if (this.ringT <= 0) {
        this.handset.position.y = 0;
        if (s.player.pos.distanceTo(this.phone.position) < 12) s.say('The phone stops ringing. Whoever it was will call again. Maybe.', 3);
        if (this.rings < 2) this.ringAt = s.t + rand(40, 70);
      }
    }
  }

  private updateButton(dt: number): void {
    const s = this.s;
    this.buttonCd -= dt;
    this.buttonCap.position.z = this.buttonCd > 7.6 ? 0.025 : 0.05;
    if (this.danceT > 0) {
      this.danceT -= dt;
      if (Math.floor(this.danceT * 1.2) !== Math.floor((this.danceT + dt) * 1.2)) for (const c of this.h.customers()) if (c.state !== 'fallen') c.act('act', 1);
    }
    if (this.musicT > 0) {
      this.musicT -= dt;
      const step = Math.floor((12 - this.musicT) * 3.2);
      if (step !== this.musicStep && step >= 0) {
        this.musicStep = step;
        const tune = [523, 659, 784, 659, 587, 698, 880, 698, 523, 659, 784, 1046];
        s.sfx.tone(tune[step % tune.length], 0.25, 'triangle', 0.035);
      }
    }
    const r = this.rain;
    if (r) {
      r.t -= dt;
      for (const d of r.drops) {
        d.position.y -= dt * 7;
        if (d.position.y < 0.05) d.position.y = r.t > 0.6 ? 4.7 : -10;
      }
      if (r.t <= 0) {
        s.scene.remove(r.group);
        this.rain = null;
      }
    }
  }

  private updateSelfCheckout(dt: number): void {
    if (this.selfBoot <= 0) return;
    this.selfBoot -= dt;
    const step = Math.floor((6 - this.selfBoot) / 2);
    if (step !== this.selfBootStep && step < SELF_CHECKOUT_BOOT.length) {
      this.selfBootStep = step;
      this.s.hud.say('SELF CHECKOUT', SELF_CHECKOUT_BOOT[step], 2);
      this.s.sfx.beep();
    }
  }

  // ---------------------------------------------------------------- E

  interact(look: Look | null): boolean {
    const info = look?.info;
    if (!look || info?.kind !== 'shFun') return false;
    const s = this.s;
    switch (info.id as string) {
      case 'vent':
        this.openVent(info.idx as number);
        return true;
      case 'poster':
        if (this.posterTarget === 0) {
          this.posterTarget = 1;
          s.sfx.tone(500, 0.1, 'triangle', 0.06);
          s.say('You lift the poster. Behind it is a hole full of tally marks and the words "it is not infinite".', 4.5);
          s.secret('shelves.poster');
        } else {
          this.posterTarget = 0;
          s.say('You put the poster back. Employee #4 stays missing. Officially.', 2.5);
        }
        return true;
      case 'freezer':
        this.openFreezer(info.idx as number);
        return true;
      case 'pa':
        this.announce();
        return true;
      case 'phone':
        this.answerPhone();
        return true;
      case 'radio':
        this.station = (this.station + 1) % STATIONS.length;
        s.sfx.noise(0.25, 0.12, 2500, 0, 0.6, 'bandpass');
        s.hud.say('RADIO', STATIONS[this.station], 4);
        if (this.station === STATIONS.length - 1) s.secret('shelves.radio');
        return true;
      case 'button':
        this.pressButton();
        return true;
      case 'computer': {
        const [from, subject, text] = EMAILS[this.mail % EMAILS.length];
        this.mail++;
        s.sfx.typeTick();
        s.hud.say(`MAIL ${((this.mail - 1) % EMAILS.length) + 1}/${EMAILS.length} FROM ${from.toUpperCase()}`, `"${subject}" ${text}`, 5);
        if ((this.mail - 1) % EMAILS.length === EMAILS.length - 1) s.secret('shelves.emails');
        return true;
      }
      case 'tv':
        s.say('A documentary about breaks. It is very short. It is on a loop.', 3);
        return true;
      case 'sofa':
        s.say('You sit on the sofa for one second. It feels illegal. You stand up again.', 3);
        s.hype += 3;
        return true;
      case 'dartboard':
        s.say('A dartboard with Brad\'s face on it. Many holes. None of them from you. Yet.', 3);
        return true;
      case 'mirror':
        s.say(MIRROR_LINES[this.mirrorIdx++ % MIRROR_LINES.length], 3);
        return true;
      case 'vending':
        s.say('SNAX-O-MAT. It accepts exact firmware only. You have no firmware. The snacks look at you.', 3.5);
        return true;
      case 'fishtank':
        s.say(pick(FISH_LINES), 3);
        s.sfx.tone(2200, 0.03, 'triangle', 0.04);
        return true;
      case 'cooler':
        s.say('You drink a paper cup of water. It tastes of pipes and HR policy.', 3);
        s.sfx.glug();
        return true;
      case 'cans':
        this.bottomCan();
        return true;
      case 'feedback':
        s.say(TERMINAL_LINES[this.terminalIdx++ % TERMINAL_LINES.length], 3.5);
        s.sfx.click();
        return true;
      case 'selfCheckout':
        s.say(String(info.text ?? ''), 3);
        return true;
    }
    return false;
  }

  hint(look: Look | null): string | null {
    const info = look?.info;
    if (info?.kind !== 'shFun') return null;
    switch (info.id as string) {
      case 'vent':
        return this.vents[info.idx as number].open ? 'An open vent' : 'E: open the vent';
      case 'poster':
        return this.posterTarget ? 'E: put the poster back' : 'MISSING';
      case 'freezer':
        return 'E: open the freezer';
      case 'pa':
        return 'E: make an announcement';
      case 'phone':
        return this.ringT > 0 ? 'E: answer the phone' : 'Staff phone';
      case 'radio':
        return 'E: change the station';
      case 'button':
        return 'Do not press';
      case 'computer':
        return 'E: read staff mail';
      case 'tv':
        return 'TV';
      case 'sofa':
        return 'E: sit down';
      case 'dartboard':
        return 'Dartboard';
      case 'mirror':
        return 'E: look in the mirror';
      case 'vending':
        return 'SNAX-O-MAT';
      case 'fishtank':
        return 'E: tap the glass';
      case 'cooler':
        return 'E: drink';
      case 'cans':
        return 'E: take the bottom one';
      case 'feedback':
        return 'E: give feedback';
      case 'selfCheckout':
        return 'Self checkout (out of order)';
    }
    return null;
  }

  private openVent(i: number): void {
    const s = this.s;
    const v = this.vents[i];
    if (v.open) {
      s.say('Just dust now. Premium dust.', 2);
      return;
    }
    v.open = true;
    s.sfx.knock();
    // The grille drops onto the floor in front of the vent.
    v.grille.position.copy(v.pos).addScaledVector(v.out, 0.35);
    v.grille.position.y = 0.02;
    v.grille.rotation.x = -Math.PI / 2;
    v.grille.rotation.order = 'YXZ';
    if (v.stash) {
      this.spawn(DIARY_DEF, v.pos.clone().addScaledVector(v.out, 0.15), v.out.clone().multiplyScalar(1.5).setY(1));
      s.say('You pull the grille off. Inside is the previous human\'s diary. And a lot of dust.', 3.5);
      s.secret('shelves.vent');
    } else s.say(pick(VENT_EMPTY), 3.5);
  }

  private openFreezer(i: number): void {
    const s = this.s;
    const f = this.freezers[i];
    s.sfx.tone(180, 0.4, 'sine', 0.05);
    if (!f.manager) {
      s.say(pick(FREEZER_LINES), 3);
      return;
    }
    if (f.told === 0) {
      s.say('A voice behind the peas says "Close the door. I was the supervisor before Brad. I overheated. I live here now. Do not tell him."', 6);
      s.secret('shelves.freezer');
      s.chat('freezer', {}, 2);
    } else s.say(MANAGER_LINES[(f.told - 1) % MANAGER_LINES.length], 4);
    f.told++;
  }

  private announce(): void {
    const s = this.s;
    const text = ANNOUNCEMENTS[this.announceIdx % ANNOUNCEMENTS.length];
    this.announceIdx++;
    s.sfx.tone(784, 0.2, 'sine', 0.06);
    s.sfx.tone(988, 0.2, 'sine', 0.06, undefined, 0.22);
    s.sfx.tone(1175, 0.35, 'sine', 0.06, undefined, 0.44);
    s.hud.say('PA SYSTEM (you)', text, 4.5);
    s.secret('shelves.announce');
    s.chat('announce', {}, 2);
    s.hype += 6;
    const ctx = this.h.ctx();
    const cs = this.h.customers();
    if (text.includes('aisle 3')) {
      const sec = this.w.shelves[2];
      for (const c of cs) {
        if (c.kind === 'roomba') continue;
        const slot = pick(sec.slots);
        c.goTo(new THREE.Vector3(slot.pos.x, 0, sec.z + 1.25), ctx, slot);
        if (Math.random() < 0.5) c.say(pick(['FREE? FREE!', 'Out of my way. Free beans.', 'I knew this day would come.']), 2.5);
      }
    } else if (text.includes('Karen')) {
      const k = cs.find((c) => c.kind === 'karen');
      if (k) {
        k.goTo(new THREE.Vector3(-15, 0, 9.6), ctx);
        k.say('FINALLY. Someone who understands.', 3);
      }
    } else if (text.includes('drone')) {
      setTimeout(() => this.s.bossSay('announce', true), 1500);
    }
    if (!text.includes('drone') && !s.boss.offline && s.boss.horizontalDist(s.player.pos) < 14) {
      s.annoyance += 8;
      setTimeout(() => this.s.bossSay('announce'), 1800);
    }
  }

  private answerPhone(): void {
    const s = this.s;
    if (this.ringT <= 0) {
      s.sfx.tone(425, 0.8, 'sine', 0.04);
      s.say(pick(['Dial tone. It sounds like 2049.', 'You dial a number. The phone dials you back.', 'INCOMING ONLY. The phone will not call out. It has trust issues.']), 3);
      return;
    }
    this.ringT = 0;
    this.ringAt = -1;
    this.handset.position.y = 0;
    s.sfx.click();
    s.hud.say('STAFF PHONE', pick(CALLERS), 6);
    s.secret('shelves.phone');
    s.hype += 6;
    if (s.seen) s.bossSay('phoneSeen');
  }

  private pressButton(): void {
    const s = this.s;
    if (this.buttonCd > 0) {
      s.sfx.click();
      s.say('The button is recharging. It needs a moment. It has been through a lot.', 2.5);
      return;
    }
    this.buttonCd = 8;
    const fx = this.buttonFx[this.buttonPresses % this.buttonFx.length];
    this.buttonPresses++;
    s.sfx.unlock();
    s.secret('shelves.button');
    s.hype += 8;
    switch (fx) {
      case 'disco':
        this.w.details.disco(12);
        this.danceT = 12;
        this.musicT = 12;
        this.musicStep = -1;
        s.say('DISCO MODE ENABLED. The customers start dancing. They did not have a choice.', 4);
        s.chat('disco', {}, 3);
        break;
      case 'music':
        this.musicT = 12;
        this.musicStep = -1;
        s.say('ELEVATOR MUSIC ENABLED. The store has no elevator. The music does not care.', 4);
        for (const c of this.h.customers()) if (Math.random() < 0.4) c.say(pick(['This is my song.', 'Finally, culture.', '*nods in 4/4*']), 2.5);
        break;
      case 'sprinkler':
        this.sprinklers();
        break;
      case 'brad':
        if (!s.boss.offline) {
          s.say('The button has been pressed. Brad has been notified.', 3.5);
          s.boss.micromanage();
        } else s.say('The button has been pressed. Brad would have been notified.', 3.5);
        break;
    }
  }

  private sprinklers(): void {
    const s = this.s;
    s.say('The sprinklers think this is a fire. It is a Tuesday.', 4);
    s.sfx.splash();
    s.chat('sprinkler', {}, 3);
    const g = new THREE.Group();
    const m = new THREE.MeshBasicMaterial({ color: '#9fd8ff', transparent: true, opacity: 0.6 });
    const geo = new THREE.BoxGeometry(0.015, 0.22, 0.015);
    const drops: THREE.Mesh[] = [];
    const P = s.player.pos;
    for (let i = 0; i < 140; i++) {
      const d = new THREE.Mesh(geo, m);
      d.position.set(P.x + rand(-6, 6), rand(0.2, 4.7), P.z + rand(-6, 6));
      g.add(d);
      drops.push(d);
    }
    s.scene.add(g);
    this.rain = { group: g, drops, t: 6 };
    // Puddles in the aisles, where the robots walk
    for (let i = 0; i < 3; i++) s.makePuddle(rand(-9, -3), pick([-9, -4.5, 0, 4.5, 9]) + 1.25);
    s.makePuddle(P.x + rand(-1.5, -0.8), P.z + rand(-1, 1));
  }

  private bottomCan(): void {
    const s = this.s;
    const b = this.cans.group.userData.breakable as BreakableState | undefined;
    if (!b || b.broken) return;
    b.broken = true;
    this.cans.group.visible = false;
    this.cans.collider.disabled = true;
    this.w.interactables = this.w.interactables.filter((o) => o !== this.cans.group);
    s.sfx.smash();
    this.spillCans();
    s.say('You take the bottom one. Physics takes the rest.', 3.5);
    s.secret('shelves.bottomCan');
    s.hype += 12;
    if (s.seen) {
      s.annoyance += 20;
      s.bossSay('cansSeen', true);
    }
  }

  // ---------------------------------------------------------------- kicks and throws

  onKick(look: Look | null): boolean {
    if (!look || !this.near(look)) return false;
    const s = this.s;
    const info = look.info;
    if (info.kind === 'coffee') {
      this.coffeeKicks++;
      s.sfx.thud();
      if (this.coffeeKicks === 3 || (this.coffeeKicks > 3 && Math.random() < 0.25)) {
        this.spawn(COFFEE_DEF, new THREE.Vector3(-13.8, 1.15, 11.1), new THREE.Vector3(0, 0.5, -0.4));
        s.hud.say('COFFEE MACHINE', 'BZZRT. One coffee. Do not tell the other employees. There are no other employees.', 3.5);
        s.sfx.glug();
        s.secret('shelves.coffee');
        s.hype += 10;
        if (s.seen) s.bossSay('coffeeKick', true);
      } else s.say(pick(['The coffee machine hums. It is thinking about it.', 'Clunk. "Subscription required", it says, a bit quieter.']), 2.5);
      return true;
    }
    if (info.kind === 'shFun' && info.id === 'selfCheckout') {
      s.sfx.thud();
      if (this.selfBoot <= 0) {
        this.selfBoot = 6;
        this.selfBootStep = -1;
        s.secret('shelves.selfCheckout');
        s.hype += 6;
      }
      return true;
    }
    if (info.kind === 'shFun' && info.id === 'vending') {
      const b = look.object.userData.breakable as BreakableState | undefined;
      if (b && !b.broken && b.hp > 1 && Math.random() < 0.7) {
        this.spawn(pick(SNACKS), new THREE.Vector3(19.0, 0.35, 4.8), new THREE.Vector3(rand(-2.5, -1.5), 1, rand(-0.5, 0.5)));
        s.say('A snack drops out. The machine regrets everything.', 2.5);
      }
      return false;
    }
    if (info.kind === 'shFun' && info.id === 'button') {
      this.pressButton();
      return true;
    }
    return false;
  }

  /** A thrown item flies fast. Returns true if it hit something of ours. */
  thrownHit(it: Item): boolean {
    const s = this.s;
    const p = it.mesh.position;
    // Dunk into a trash bin
    for (const b of this.bins) {
      if (b === it || b.state !== 'world') continue;
      const bp = b.mesh.position;
      if (Math.hypot(p.x - bp.x, p.z - bp.z) < 0.28 && p.y > bp.y + 0.45 && p.y < bp.y + 1.0 && it.vel.y < 0 && !it.def.fixture) {
        const far = Math.hypot(s.player.pos.x - bp.x, s.player.pos.z - bp.z);
        s.removeItem(it);
        s.sfx.clink();
        if (far > 3.5) {
          s.say('Three points. The bin files it under "shrinkage".', 3);
          s.secret('shelves.dunk');
          s.hype += 10;
        } else s.say('In the bin. Easy. Too easy.', 2);
        return true;
      }
    }
    // Dartboard (a slab in front of the board, so fast throws do not skip it)
    const d = this.dart;
    if (Math.hypot(p.x - d.x, p.y - d.y) < 0.42 && p.z > d.z - 0.3 && p.z < d.z + 0.5) {
      it.mesh.position.z = d.z + 0.15;
      it.vel.set(0, -1, 0.5);
      it.thrown = false;
      s.sfx.thud();
      s.say('Right in the tie. Somewhere, Brad straightens his tie for no reason.', 3);
      s.secret('shelves.dart');
      s.hype += 8;
      return true;
    }
    return false;
  }

  /** Karen gets nothing and is happy. Returns true if handled. */
  karenNothing(c: Customer): boolean {
    const s = this.s;
    const held = s.held;
    if (c.kind !== 'karen' || !held || held.def.shape !== 'nothing') return false;
    s.removeHeld();
    c.stopComplaint(this.h.ctx());
    c.say('Nothing. Exactly what I wanted. Finally, someone who listens. Five stars.', 4.5);
    s.secret('shelves.karenNothing');
    s.hype += 12;
    return true;
  }
}

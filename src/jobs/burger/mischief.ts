import * as THREE from 'three';
import { instantiate } from '../../assets';
import { Item, ItemDef } from '../../items';
import type { Interact } from '../../level';
import { pick, rand, textTexture } from '../../util';
import type { Look, Shift } from '../types';
import { m } from './items';
import { type Kitchen, SPOTS } from './kitchen';
import type { Bot } from './robots';
import { drawIceScreen } from './ui';

/**
 * Mischief at MEGABYTE BURGER: things to break, things to carry off, and secrets
 * that move around between shifts. The job forwards E, hints, kicks and throws here first.
 */

const PX = '"Press Start 2P", monospace';
/** Kitchen side of the partition, where the machines stand. */
const PZ = 1.52;
/** Height of the partition between kitchen and dining room. */
const PART_H = 2.55;
const FREEZER = { minX: -13.9, minZ: -9.9, maxX: -10.65, maxZ: -5.7 };

export const BURGER_SECRETS: Record<string, string> = {
  'burger.icecream': 'Fixed the ice cream machine. With a boot.',
  'burger.coneGift': 'Served real ice cream to a robot',
  'burger.recipe': 'Found the secret recipe',
  'burger.radio': "Found Brad's favorite radio station",
  'burger.email': "Read all of Brad's e-mail",
  'burger.button': 'Pressed the button',
  'burger.grillKey': 'Grilled the toilet key',
  'burger.kickCritic': 'Got your kick reviewed',
  'burger.frozen': 'Stayed in the freezer until you became inventory',
  'burger.moon': 'Called the Moon branch',
  'burger.gacha': 'Won the prize machine',
  'burger.poster': 'Looked behind the right poster',
  'burger.ballpit': 'Reached the bottom of the ball pit',
  'burger.fish': 'Set a robot fish free (in a sink)',
};

export const MX_BOSS_LINES: Record<string, string[]> = {
  bgCamera: ['A camera is down. Do not worry. I will watch you myself. Closer.', 'Who blinded the camera? That camera had a family. A security family.'],
  bgCoffee: ['The coffee machine was in middle management. It will be missed. By me. Only by me.'],
  bgButton: ['You pressed the button. The button calls me. Why did you call me? Speak. Quickly.'],
  bgRadio: ['Is that my song? Do not look at me. I am not dancing. I am recalibrating rhythmically.'],
  bgKickBot: ['Did you just kick a customer? We measure satisfaction in stars, not in boots.', 'Do not kick the guests. Kick the quota.'],
  bgKaren: ['Karen-Unit 9, I am the supervisor. I have reviewed the kick. It was within guidelines.'],
  bgDock: ['That is MY dock. Your finger is not authorized to charge.'],
};

export const MX_CHAT_LINES: Record<string, string[]> = {
  bgKickBot: ['lol the boot', 'that robot is filing a report rn', 'HR has entered the chat', 'kick counter going up'],
  bgVend: ['FREE SNACKS', 'the snack machine had it coming', 'crumbs everywhere lmao'],
  bgDance: ['BRAD IS DANCING', 'clip it clip it', 'management is vibing', 'brad.exe has rhythm'],
  bgFish: ['FISH FREEDOM', 'free the fish (into a sink)', 'that fish has a better life than us'],
  bgIce: ['IT WORKS??', 'the machine works. the world is ending', 'ICE CREAM IN 2071?!'],
  bgButton: ['WHO PRESSED IT', 'never press the button', 'press it again press it again'],
};

// ---------------------------------------------------------------- item meshes

function def(id: string, name: string, build: () => THREE.Group, extra: Partial<ItemDef> = {}): ItemDef {
  return { id, name, category: null, shape: 'box', color: '#888888', label: [], weight: 0, pocketable: true, build, ...extra };
}

function labelMat(lines: string[], bg: string, fg: string, w = 128, h = 128): THREE.MeshStandardMaterial {
  const t = textTexture(lines, { w, h, bg, fg, font: PX });
  t.magFilter = THREE.NearestFilter;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 });
}

/** A box with a label on the front and back (+z and -z). */
function labelBox(w: number, h: number, d: number, color: string, lines: string[], fg = '#ffffff'): THREE.Mesh {
  const side = m(color, 0.6);
  const face = labelMat(lines, color, fg, 128, Math.max(32, Math.round((128 * h) / w)));
  const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, side, side, face, face]);
  me.position.y = h / 2;
  return me;
}

function group(...parts: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  g.add(...parts);
  return g;
}

function fishMesh(color = '#ff8c1a'): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.04), m(color, 0.35, { metalness: 0.5 }));
  body.position.y = 0.035;
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.06, 4), m(color, 0.35, { metalness: 0.5 }));
  tail.rotation.z = Math.PI / 2;
  tail.position.set(-0.1, 0.035, 0);
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.015, 0.045), new THREE.MeshStandardMaterial({ color: '#6dff8a', emissive: '#3dff6a', emissiveIntensity: 1.5 }));
  eye.position.set(0.05, 0.045, 0);
  g.add(body, tail, eye);
  return g;
}

const CONE_DEF = def('bgRealCone', 'Soft Serve (real, unlicensed)', () => {
  const g = new THREE.Group();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.13, 8), m('#d9a45a', 0.8));
  cone.rotation.x = Math.PI;
  cone.position.y = 0.065;
  g.add(cone);
  const cream = m('#fbf3e4', 0.5);
  for (const [r, y] of [[0.048, 0.14], [0.036, 0.185], [0.022, 0.215]]) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), cream);
    s.position.y = y;
    g.add(s);
  }
  return g;
}, {
  holdPos: [0.25, -0.26, -0.55],
  pickupLine: 'Actual soft serve. It is cold. It is real. It is probably illegal.',
  pocketLine: 'You pocket the ice cream. Your pocket is now a dessert.',
});

const RECIPE_DEF = def('bgRecipe', 'Secret Recipe Binder', () => {
  const red = m('#9e1c14', 0.6);
  const face = labelMat(['SECRET', 'RECIPE', 'do not', 'read'], '#9e1c14', '#f7d23e', 96, 128);
  const me = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.3, 0.24), [face, face, red, red, red, red]);
  me.position.y = 0.15;
  return group(me);
}, {
  holdPos: [0.26, -0.3, -0.55],
  pickupLine: 'THE SECRET RECIPE. Page 1 says "Buy the cheapest one." Page 2 says "Add grease until legal." Signed by the founder, a vending machine.',
  pocketLine: 'You pocket the secret recipe. MEGABYTE BURGER now has no recipe. Nobody will notice.',
});

const SNACK_DEFS: ItemDef[] = [
  def('bgSnackBar', 'Byte Bar (expired 2064)', () => group(labelBox(0.16, 0.06, 0.03, '#c0392b', ['BYTE', 'BAR'], '#f7d23e')), { pickupLine: 'A Byte Bar. Best before 2064. It is now worst after.' }),
  def('bgSnackChips', 'Air Chips (93% air)', () => group(labelBox(0.12, 0.17, 0.05, '#27ae60', ['AIR', 'CHIPS'], '#ffffff')), { pickupLine: 'A bag of Air Chips. You can hear the air inside. It is stale.' }),
  def('bgSnackCan', 'Diet Coolant (lime)', () => group(labelBox(0.06, 0.12, 0.06, '#7ed957', ['DIET', 'COOL'], '#1d1712')), { pickupLine: 'Diet Coolant, lime flavor. For robots. Also for humans who lost a bet.' }),
];

const FISH_DEF = def('bgFish', 'Robot Fish', () => fishMesh(), {
  tags: ['bgFish'],
  pickupLine: 'A robot fish. It flops. It is waterproof. Nothing else about it is.',
  pocketLine: 'You pocket the fish. It flops in your trousers. Brad will notice the rhythm.',
});

const CAPSULE_DEF = def('bgCapsule', 'Prize Capsule (1 MIN BREAK)', () => {
  const a = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), m('#ff6fb5', 0.4));
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), m('#f4f0e6', 0.4));
  a.position.y = b.position.y = 0.06;
  return group(a, b);
}, {
  pickupLine: 'You won one minute of break. Terms apply. The terms are no.',
  pocketLine: 'You pocket one minute of break. It expires at 17:00. Like you.',
});

const CANDY_DEF = def('bgCandy', "RoboGran's Hard Candy (2019)", () => group(labelBox(0.07, 0.04, 0.04, '#e74c3c', ['*'], '#ffffff')), {
  pickupLine: 'A hard candy from 2019. It was hard then. It is harder now.',
});

const OLD_FRY_DEF = def('bgOldFry', 'A Fry Older Than You', () => {
  const f = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.14), m('#8a6a2a', 0.8));
  f.position.y = 0.013;
  return group(f);
}, { pickupLine: 'GREASE-E found it under the fryer. It has seen things. It has been things.' });

const PIT_FINDS: ItemDef[] = [
  def('bgSpareTie', "Brad's Spare Tie", () => {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.32, 0.015), m('#c0392b', 0.6));
    t.position.y = 0.16;
    const k = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.02), m('#2c64b4', 0.6));
    k.position.y = 0.31;
    return group(t, k);
  }, { pickupLine: 'Brad\'s spare tie. The label says BRAD (BACKUP). Brad has a backup.' }),
  def('bgBadge', 'Employee Badge (KEVIN, 2049)', () => group(labelBox(0.1, 0.13, 0.01, '#f4f0e6', ['KEVIN', '2049'], '#7a2416')), {
    pickupLine: 'Kevin went into the ball pit in 2049. Only the badge came out.',
  }),
  def('bgOldNugget', 'A Nugget from 2061', () => {
    const n = new THREE.Mesh(new THREE.DodecahedronGeometry(0.04, 0), m('#d99a4e', 0.8));
    n.scale.set(1.3, 0.7, 1);
    n.position.y = 0.03;
    return group(n);
  }, { pickupLine: 'A nugget from 2061. Perfectly preserved. That should worry you.' }),
  def('bgTinyShoe', 'A Very Small Robot Shoe', () => group(labelBox(0.12, 0.05, 0.06, '#f1c40f', [''], '#000000')), {
    pickupLine: 'A tiny robot shoe. Somewhere, a tiny robot is limping. Probably Lil Nugget-Bot.',
  }),
];

// ---------------------------------------------------------------- texts

const RADIO = [
  'MEAT FM 101.3. Forty minutes of uninterrupted sizzle. And now a word from our sponsor, sizzle.',
  'SMOOTH ELEVATOR 88.1. The hold music of your dreams. Please stay on the line. Please stay.',
  'TALK 404. Two toasters debate whether humans have feelings. Both say no. Lively debate.',
  'THE BRAD HOUR. Episode 312: "Hustle is a combo meal." Brad is his own guest. Again.',
  'STATIC 0.0. Calming static. Voted best station by robots without ears.',
];

const EMAILS = [
  'Corporate, about the ice cream machine. "Do not fix it. Customers who cannot get ice cream buy two burgers out of spite."',
  'The Fryer, about seniority. "I have been here longer than you. I would like a desk. And a window. And to stop being on fire."',
  'Brad, to Brad, about Brad. "You are doing great, Brad. Keep it up, Brad."',
  'HR-Bot, about the chicken. "The toilet key chicken has been with us for 11 years. Please stop calling it Gerald. It is Gerald II."',
  'Unknown sender, no subject. "The red button by the emergency exit does something different every day. Do not tell the human."',
];

const KICK_LINES: Record<string, string[]> = {
  customer: ['Ow. I am filing a complaint. In triplicate. With a stapler.', 'Was that the loyalty program?', 'My warranty does not cover boots.', 'I felt that in my receipt printer.'],
  karen: ['DID YOU JUST KICK ME? I WANT TO SPEAK TO YOUR SUPERVISOR.', 'MANAGER. NOW. I AM DENTED.'],
  gran: ['In my day we kicked with pistons. Here, have a candy. You need the sugar.', 'Oh my. Such energy. Have a candy, dear.'],
  kid: ['TAG! YOU ARE IT! YOU CANNOT CATCH ME, I AM FAST AND SMALL!', 'AGAIN! AGAIN! KICK ME AGAIN!'],
  critic: ['The kick gets three stars. Good follow-through. The shoe was derivative.', 'I am reviewing that kick. Four stars. Would be kicked again.'],
  roomba: ['WHEEEEE. Recalculating. Oh. I found something.', 'Bonk. New route. Old fry.'],
};

const POSTER_LINES = [
  'You lift the poster. Behind it is more wall. Motivating.',
  'Behind the poster is a smaller poster. It says KEEP GOING.',
  'You lift the poster. A small robot cockroach salutes you and leaves.',
  'Nothing behind this one. Just a nail. The nail looks tired.',
];

const BUTTON_OUTCOMES = ['confetti', 'dance', 'brad', 'announce', 'icecream'] as const;
type ButtonOutcome = (typeof BUTTON_OUTCOMES)[number];

export interface BurgerApi {
  bots(): Bot[];
  /** Flips every patty on the grill at once. Returns how many. */
  flipAll(): number;
  hasCar(): boolean;
}

const tmp = new THREE.Vector3();

export class BurgerMischief {
  private s!: Shift;
  private api!: BurgerApi;
  private k: Kitchen;
  private iceNeeded = 2 + Math.floor(Math.random() * 3);
  private iceKicks = 0;
  private iceDone = false;
  private iceMsgT = 0;
  private recipe: Item;
  private radioFav = Math.floor(Math.random() * RADIO.length);
  private radioIdx = -1;
  private mails = 0;
  private button: ButtonOutcome = pick([...BUTTON_OUTCOMES]);
  private pressed = false;
  private moonCalls = 0;
  private gachaWin = 3 + Math.floor(Math.random() * 4);
  private gachaTries = 0;
  private pitDigs = 0;
  private pitFind = pick(PIT_FINDS);
  private posterSecret = 0;
  private posters: THREE.Object3D[] = [];
  private posterLifted = false;
  private freezerT = 0;
  private danceT = 0;
  private fishes: Item[] = [];
  private fishT = 0;
  private confetti: { mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[] = [];
  private botKicks = 0;
  private tankTaps = 0;
  private vendTries = 0;
  private dockUses = 0;
  private sinkFish: THREE.Object3D | null = null;

  constructor(k: Kitchen) {
    this.k = k;
    this.vendingMachine();
    this.fishTank();
    this.coffeeMachine();
    this.easel();
    this.redButton();
    this.deskThings();
    this.breakExisting();
    this.movables();
    this.posterSetup();
    k.hideSpot(FREEZER.minX, FREEZER.minZ, FREEZER.maxX, FREEZER.maxZ, 'the walk-in freezer');
    this.recipe = this.hideRecipe();
    // The crosshair does not see through walls. Without these, E in the dining room reached
    // the kitchen trash bins through the partition (the pass-through stays open).
    for (const [x0, x1] of [[-14, -2.5], [2.5, 9.2], [10.6, 14]]) this.hit(x1 - x0, PART_H, 0.04, (x0 + x1) / 2, PART_H / 2, 2.0, { kind: 'wall' });
  }

  // ---------------------------------------------------------------- building

  private hit(w: number, h: number, d: number, x: number, y: number, z: number, info: Interact): THREE.Mesh {
    const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    me.position.set(x, y, z);
    me.userData.interact = info;
    this.k.scene.add(me);
    this.k.interactables.push(me);
    return me;
  }

  private vendingMachine(): void {
    const k = this.k;
    const g = new THREE.Group();
    g.position.set(-3.8, 0, 9.5);
    g.rotation.y = Math.PI;
    k.box(0.9, 1.85, 0.75, m('#2c64b4', 0.5), 0, 0.925, 0, g);
    k.box(0.92, 0.08, 0.77, m('#1d1712', 0.5), 0, 1.86, 0, g);
    // window with spirals of snacks
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 96;
    const cg = c.getContext('2d')!;
    cg.fillStyle = '#0d1620';
    cg.fillRect(0, 0, 64, 96);
    const cols = ['#c0392b', '#27ae60', '#f1c40f', '#7ed957', '#e67e22', '#8e44ad'];
    for (let r = 0; r < 5; r++) {
      for (let i = 0; i < 4; i++) {
        if ((r * 4 + i) % 7 === 5) continue;
        cg.fillStyle = cols[(r * 3 + i) % cols.length];
        cg.fillRect(4 + i * 15, 6 + r * 18, 11, 12);
      }
      cg.fillStyle = '#9aa0a4';
      cg.fillRect(2, 19 + r * 18, 60, 2);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 1.1), new THREE.MeshBasicMaterial({ map: tex }));
    win.position.set(-0.1, 1.15, 0.378);
    g.add(win);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.5), labelMat(['A1', 'B2', 'C3', '$'], '#1d1712', '#5aff7a', 64, 160));
    panel.position.set(0.32, 1.2, 0.378);
    g.add(panel);
    k.box(0.6, 0.18, 0.06, m('#111111', 0.6), -0.1, 0.35, 0.39, g);
    const head = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.22), labelMat(['SNAX-O-MAT'], '#c0392b', '#f7d23e', 256, 64));
    head.position.set(0, 1.74, 0.378);
    g.add(head);
    k.scene.add(g);
    g.userData.interact = { kind: 'bgVend' } satisfies Interact;
    k.interactables.push(g);
    const col = k.solid(-3.8, 9.5, 0.95, 0.8, 1.9, true, 'vend');
    k.breakable(g, {
      name: 'vending machine',
      hp: 3,
      collider: col,
      price: 240,
      line: 'The SNAX-O-MAT gives up everything it had. Mostly crumbs. Some snacks.',
      colors: ['#2c64b4', '#c0392b', '#f1c40f', '#0d1620'],
      onBreak: () => this.spill(),
    });
  }

  private fishTank(): void {
    const k = this.k;
    const x = 11.8;
    const z = 2.5;
    k.box(1.2, 0.75, 0.5, m('#6b4a2c', 0.7), x, 0.375, z);
    k.solid(x, z, 1.2, 0.5, 1.3, false, 'tank');
    const g = new THREE.Group();
    g.position.set(x, 0.75, z);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.42), new THREE.MeshStandardMaterial({ color: '#bfe6f5', transparent: true, opacity: 0.22, roughness: 0.1, depthWrite: false }));
    glass.position.y = 0.25;
    const water = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.4, 0.38), new THREE.MeshStandardMaterial({ color: '#3a8fc4', transparent: true, opacity: 0.3, roughness: 0.2, depthWrite: false }));
    water.position.y = 0.21;
    const sand = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.05, 0.38), m('#d8c48a', 0.9));
    sand.position.y = 0.025;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.04, 0.44), m('#1d1712', 0.5));
    lid.position.y = 0.52;
    const castle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.1), m('#9aa0a4', 0.8));
    castle.position.set(0.3, 0.13, 0.05);
    g.add(sand, castle, lid, water, glass);
    const fish = [fishMesh('#ff8c1a'), fishMesh('#3ad0ff'), fishMesh('#f1c40f')];
    fish.forEach((f) => {
      f.scale.setScalar(0.7);
      g.add(f);
    });
    k.onTick((t) => {
      fish.forEach((f, i) => {
        // They swim in squares. Their firmware does not support circles.
        const ph = (t * 0.25 + i / 3) % 1;
        const seg = Math.floor(ph * 4);
        const u = (ph * 4) % 1;
        const px = [-0.35 + 0.7 * u, 0.35, 0.35 - 0.7 * u, -0.35][seg];
        const pz = [-0.1, -0.1 + 0.2 * u, 0.1, 0.1 - 0.2 * u][seg];
        f.position.set(px, 0.12 + i * 0.09, pz);
        f.rotation.y = [0, -Math.PI / 2, Math.PI, Math.PI / 2][seg];
      });
    });
    k.scene.add(g);
    g.userData.interact = { kind: 'bgTank' } satisfies Interact;
    k.interactables.push(g);
    k.breakable(g, { name: 'fish tank', price: 89, colors: ['#bfe6f5', '#3a8fc4', '#ff8c1a', '#d8c48a'], line: 'The fish tank bursts. Three robot fish are now free-range.', onBreak: () => this.tankBreak() });
    k.sign(['FISH TANK', 'do not tap', 'the fish are working'], 0.6, 0.3, x, 1.55, 2.2, 0, { bg: '#fdf6e3', fg: '#2c64b4', border: '#2c64b4', font: PX });
  }

  private coffeeMachine(): void {
    const k = this.k;
    const g = new THREE.Group();
    g.position.set(-12.42, 0.79, PZ + 0.15);
    k.box(0.26, 0.03, 0.22, m('#1c1c1c', 0.5), 0, 0.015, 0, g);
    k.box(0.24, 0.36, 0.1, m('#2a2a2a', 0.5), 0, 0.18, 0.06, g);
    k.box(0.24, 0.06, 0.2, m('#2a2a2a', 0.5), 0, 0.33, 0.0, g);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 10), new THREE.MeshStandardMaterial({ color: '#3a1e0e', transparent: true, opacity: 0.8, roughness: 0.2 }));
    pot.position.set(0, 0.09, -0.04);
    g.add(pot);
    k.box(0.03, 0.03, 0.01, new THREE.MeshStandardMaterial({ color: '#ff3020', emissive: '#ff2010', emissiveIntensity: 1.5 }), 0.08, 0.27, -0.06, g);
    k.scene.add(g);
    g.userData.interact = { kind: 'bgCoffee' } satisfies Interact;
    k.interactables.push(g);
    k.breakable(g, {
      name: 'coffee machine',
      price: 60,
      line: 'The coffee machine dies with a gurgle. It was the only one here with a pension.',
      onBreak: () => {
        this.s.makePuddle(-12.3, 0.85, '#4a2a14');
        this.s.sfx.glug();
        if (!this.s.boss.offline) this.s.bossSay('bgCoffee', true);
      },
    });
  }

  private easel(): void {
    const k = this.k;
    const g = new THREE.Group();
    g.position.set(-11.2, 0, 2.75);
    g.rotation.y = Math.PI / 2;
    const wood = m('#6b4a2c', 0.7);
    for (const s of [-1, 1]) {
      const leg = k.box(0.04, 1.5, 0.04, wood, s * 0.3, 0.72, 0.05, g);
      leg.rotation.z = s * -0.08;
    }
    const back = k.box(0.04, 1.4, 0.04, wood, 0, 0.68, -0.25, g);
    back.rotation.x = -0.25;
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.95, 0.03), [wood, wood, wood, wood, labelMat(['EMPLOYEE', 'OF THE', 'MONTH:', 'THE FRYER', '(11 months', 'running)'], '#fdf6e3', '#7a2416', 192, 256), wood]);
    board.position.set(0, 1.05, 0.08);
    board.rotation.x = -0.08;
    g.add(board);
    k.box(0.7, 0.04, 0.08, wood, 0, 0.55, 0.1, g);
    k.scene.add(g);
    const col = k.solid(-11.2, 2.75, 0.5, 0.85, 1.6, false, 'easel');
    k.breakable(g, { name: 'motivational easel', price: 35, collider: col, line: 'The motivation leaves the building. Productivity is unaffected. It was always 3%.' });
  }

  private redButton(): void {
    const k = this.k;
    const g = new THREE.Group();
    g.position.set(11.9, 1.3, -9.96);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.04), labelMat([''], '#f1c40f', '#1d1712', 32, 32));
    g.add(plate);
    k.box(0.24, 0.24, 0.02, m('#1d1712', 0.6), 0, 0, 0.02, g);
    const dome = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.07, 12), new THREE.MeshStandardMaterial({ color: '#e0201a', emissive: '#a01010', emissiveIntensity: 0.6, roughness: 0.3 }));
    dome.rotation.x = Math.PI / 2;
    dome.position.z = 0.06;
    dome.name = 'dome';
    g.add(dome);
    k.scene.add(g);
    g.userData.interact = { kind: 'bgButton' } satisfies Interact;
    k.interactables.push(g);
    k.sign(['DO NOT PRESS', '(seriously)'], 0.6, 0.25, 11.9, 1.72, -9.97, 0, { bg: '#c0392b', fg: '#ffffff', border: '#ffffff', font: PX });
  }

  private deskThings(): void {
    // Brad's desk: a radio and a computer with an inbox.
    this.hit(0.4, 0.26, 0.28, -11.0, 0.92, PZ + 0.1, { kind: 'bgRadio' });
    this.hit(0.56, 0.5, 0.34, -11.9, 1.04, PZ + 0.15, { kind: 'bgComputer' });
    const k = this.k;
    for (const o of k.interactables) {
      const info = o.userData.interact as Interact | undefined;
      if (info?.kind === 'sign' && String(info.text ?? '').startsWith("BRAD'S CHARGING DOCK")) o.userData.interact = { kind: 'bgDock' } satisfies Interact;
    }
    if (k.gacha) {
      k.gacha.userData.interact = { kind: 'bgGacha' } satisfies Interact;
      k.interactables.push(k.gacha);
    }
    // The balls are small, so the pit gets a low invisible hit box. Things sticking out stay reachable.
    this.hit(2.7, 0.25, 2.7, SPOTS.ballPit.x, 0.125, SPOTS.ballPit.z, { kind: 'bgPit' });
  }

  private breakExisting(): void {
    const k = this.k;
    k.cameras.forEach((c, i) => {
      k.breakable(c, {
        name: 'security camera',
        price: 450,
        colors: ['#d8d8d2', '#1a1a1a'],
        line: i % 2 ? 'The camera goes dark. Somewhere, a robot audience loses one angle.' : 'Direct hit. The camera now films the floor. Mostly grease.',
        onBreak: () => {
          const s = this.s;
          if (s.boss.offline) return;
          s.bossSay('bgCamera', true);
          s.boss.micromanage();
        },
      });
    });
    k.breakable(k.diningTv, {
      name: 'TV',
      price: 120,
      colors: ['#2a2a2a', '#8a8a8a', '#d8f0ff'],
      line: 'The TV dies. The only channel was an ad for this restaurant. The robots look relieved.',
    });
  }

  private movables(): void {
    const k = this.k;
    k.movable(k.wetSign, 'Wet Floor Sign', { pocketable: false, pickupLine: 'CAUTION, WET FLOOR. It is grease. It is always grease. Now it is mobile grease.' });
    k.movable(k.mopBucket, 'Mop and Bucket', { pocketable: false, heavy: 0.8, holdPos: [0.45, -0.95, -0.9], pickupLine: 'The mop and bucket. The water in it is older than the building.' });
    const chair = (x: number, z: number, rot: number, name: string, line: string) => {
      const inst = instantiate('bg_chair');
      let o: THREE.Object3D;
      if (inst) o = inst.object;
      else {
        const g = new THREE.Group();
        const wood = m('#8a5a32', 0.7);
        k.box(0.42, 0.05, 0.42, wood, 0, 0.45, 0, g);
        k.box(0.42, 0.45, 0.05, wood, 0, 0.7, -0.19, g);
        for (const [lx, lz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) k.box(0.04, 0.45, 0.04, wood, lx, 0.225, lz, g);
        o = g;
      }
      o.position.set(x, 0, z);
      o.rotation.y = rot;
      k.scene.add(o);
      k.movable(o, name, { pocketable: false, heavy: 0.75, holdPos: [0.45, -0.85, -1.0], pickupLine: line });
    };
    chair(-10.9, 4.7, 1.2, 'Dining Chair', 'A chair. Sitting is not in your contract. Carrying is.');
    chair(3.9, 9.25, 2.6, 'Dining Chair (wobbly)', 'This chair wobbles. It has wobbled since 2058. It is a feature.');
    chair(-11.6, 0.8, 0.2, "Brad's Desk Chair", "Brad's desk chair. Brad flies. Brad has never sat on it. It is a status symbol.");
    const cone = instantiate('bg_trafficCone');
    if (cone) {
      cone.object.position.set(12.1, 0, -1.6);
      k.scene.add(cone.object);
      k.movable(cone.object, 'Traffic Cone (indoor)', { pocketable: false, pickupLine: 'A traffic cone. It came in from the drive-thru and never left. Like you.' });
    }
    k.movable(this.mascot(), 'Byte the Mascot (cardboard)', { pocketable: false, holdPos: [0.5, -1.25, -1.1], pickupLine: 'Byte the Burger. He smiles. He has smiled since 2049. He is cardboard. He is still smiling.' });
  }

  private mascot(): THREE.Group {
    const c = document.createElement('canvas');
    c.width = 96;
    c.height = 160;
    const g2 = c.getContext('2d')!;
    g2.fillStyle = '#d99a4e';
    g2.beginPath();
    g2.ellipse(48, 46, 40, 26, 0, Math.PI, 0);
    g2.fill();
    g2.fillStyle = '#4a7a2a';
    g2.fillRect(8, 46, 80, 8);
    g2.fillStyle = '#5a2e14';
    g2.fillRect(10, 54, 76, 16);
    g2.fillStyle = '#d99a4e';
    g2.fillRect(10, 70, 76, 14);
    g2.fillStyle = '#ffffff';
    g2.fillRect(30, 30, 12, 12);
    g2.fillRect(56, 30, 12, 12);
    g2.fillStyle = '#111111';
    g2.fillRect(35, 34, 5, 6);
    g2.fillRect(61, 34, 5, 6);
    g2.fillStyle = '#c0392b';
    g2.fillRect(36, 58, 26, 5);
    g2.fillStyle = '#d99a4e';
    g2.fillRect(42, 84, 4, 40);
    g2.fillRect(52, 84, 4, 40);
    g2.fillRect(14, 74, 4, 30);
    g2.fillRect(80, 74, 4, 30);
    g2.fillStyle = '#c0392b';
    g2.font = '10px "Press Start 2P", monospace';
    g2.textAlign = 'center';
    g2.fillText("HI! I'M", 48, 140);
    g2.fillText('BYTE', 48, 154);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    const card = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.25), new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8 }));
    card.position.y = 0.7;
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.3), m('#8a6b45', 0.8));
    foot.position.y = 0.02;
    const prop = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.03), m('#8a6b45', 0.8));
    prop.position.set(0, 0.28, -0.12);
    prop.rotation.x = 0.4;
    const g = group(card, foot, prop);
    g.position.set(1.75, 0, 9.25);
    g.rotation.y = Math.PI;
    this.k.scene.add(g);
    return g;
  }

  private posterSetup(): void {
    this.posters = this.k.interactables.filter((o) => (o.userData.interact as Interact | undefined)?.text === 'A motivational poster. It smells like fries.');
    this.posters.forEach((p, i) => (p.userData.interact = { kind: 'bgPoster', idx: i } satisfies Interact));
    this.posterSecret = Math.floor(Math.random() * Math.max(1, this.posters.length));
  }

  /** The secret recipe is somewhere else every shift. */
  private hideRecipe(): Item {
    const spots: [number, number, number, number][] = [
      [4.6, 2.0, -9.5, 0.3], // on top of the fridges
      [8.25, 0.88, -9.75, 1.4], // in the dish pit, behind the pans
      [-12.7, 0.12, 8.9, 0.5], // in the ball pit
      [-13.45, 1.8, 5.4, 0.1], // on top of the arcade cabinet
      [-11.35, 0.8, PZ + 0.25, 1.2], // under the papers on Brad's desk
      [13.45, 1.05, -8.3, 0.2], // on the box pile by the drive-thru
    ];
    const [x, y, z, r] = pick(spots);
    const it = new Item(RECIPE_DEF);
    it.state = 'fixed';
    it.mesh.position.set(x, y + it.baseOffset, z);
    it.mesh.rotation.y = r;
    if (y < 0.5) it.mesh.rotation.z = 0.5;
    this.k.scene.add(it.mesh);
    this.k.initialItems.push(it);
    return it;
  }

  // ---------------------------------------------------------------- runtime

  start(shift: Shift, api: BurgerApi): void {
    this.s = shift;
    this.api = api;
  }

  update(dt: number): void {
    const s = this.s;
    const P = s.player.pos;
    if (P.x > FREEZER.minX && P.x < FREEZER.maxX && P.z > FREEZER.minZ && P.z < FREEZER.maxZ) {
      this.freezerT += dt;
      if (this.freezerT > 20 && this.freezerT - dt <= 20) {
        s.say('You have been in the freezer so long you count as inventory now. Brad would have to file you under "poultry".', 4);
        s.secret('burger.frozen');
        s.hype += 10;
      }
    }
    if (s.held === this.recipe) s.secret('burger.recipe');
    if (this.danceT > 0) {
      this.danceT -= dt;
      const b = s.boss as unknown as { targetYaw: number; yaw: number; pos: THREE.Vector3 };
      b.targetYaw += dt * 9;
      b.yaw += dt * 9;
      b.pos.y += Math.sin(s.t * 10) * dt * 0.6;
    }
    if (this.iceMsgT > 0) {
      this.iceMsgT -= dt;
      if (this.iceMsgT <= 0) drawIceScreen(this.k.iceScreen, 'IT WAS|A DREAM');
    }
    // Free-range fish flop now and then.
    if (this.fishes.length) {
      this.fishT += dt;
      for (const f of this.fishes) {
        if (f.state === 'world' && f.sleeping && this.fishT < 120 && Math.random() < dt * 0.7) {
          f.vel.set(rand(-0.8, 0.8), rand(1.6, 2.6), rand(-0.8, 0.8));
          f.sleeping = false;
          if (Math.random() < 0.3) s.sfx.tone(rand(500, 700), 0.05, 'triangle', 0.04);
        }
      }
    }
    if (this.sinkFish) this.sinkFish.rotation.y += dt * 1.5;
    this.confetti = this.confetti.filter((c) => {
      c.life -= dt;
      c.vel.y = Math.max(-1.2, c.vel.y - dt * 3);
      c.mesh.position.addScaledVector(c.vel, dt);
      c.mesh.rotation.x += dt * 6;
      c.mesh.rotation.z += dt * 4;
      if (c.life <= 0 || c.mesh.position.y < 0.02) {
        c.mesh.parent?.remove(c.mesh);
        return false;
      }
      return true;
    });
  }

  reviewRows(): [string, string | number][] {
    return [
      ['Robots kicked (lovingly)', this.botKicks],
      ['Ice cream machine kicks', `${this.iceKicks}${this.iceDone ? ' (it worked once)' : ''}`],
    ];
  }

  payRows(): [string, number][] {
    return this.gachaTries ? [[`Prize machine coins x${this.gachaTries}`, -1 * this.gachaTries]] : [];
  }

  // ---------------------------------------------------------------- E and hints

  interact(look: Look | null): boolean {
    const s = this.s;
    const info = look?.info;
    const held = s.held;
    if (held && info) {
      if (held.def.toiletKey && (info.kind === 'bgGrill' || info.kind === 'bgBasket')) {
        s.say(info.kind === 'bgGrill' ? 'You grill the toilet key. The chicken thaws a little. The key is now medium rare.' : 'You deep fry the toilet key. Golden outside. Still frozen inside. Like the job.', 4);
        s.sfx.noise(1.2, 0.15, 3500, 0, 0.5, 'highpass');
        s.secret('burger.grillKey');
        s.hype += 12;
        s.chat('tire');
        return true;
      }
      if (held.def.id === CONE_DEF.id && info.kind === 'bgBot') {
        this.giveCone(info.bot as Bot);
        return true;
      }
      if (held.def.id === FISH_DEF.id && info.kind === 'bgSink') {
        this.freeFish();
        return true;
      }
    }
    if (!info) return false;
    switch (info.kind) {
      case 'bgSpeaker':
        if (this.api.hasCar()) return false;
        this.callMoon();
        return true;
      case 'bgRadio':
        this.radio();
        return true;
      case 'bgComputer':
        this.readMail();
        return true;
      case 'bgButton':
        this.pressButton();
        return true;
      case 'bgGacha':
        this.gacha();
        return true;
      case 'bgPoster':
        this.liftPoster(look!.object, info.idx as number);
        return true;
      case 'bgPit':
        this.dig();
        return true;
      case 'bgDock':
        this.dock();
        return true;
      case 'bgTank':
        s.say(['You tap the glass. The robot fish tap back. In Morse. It says HELP.', 'The fish swim in perfect squares. Their firmware does not support circles.', 'You tap again. The fish file a noise complaint.'][this.tankTaps++ % 3], 3.5);
        s.sfx.tone(1800, 0.04, 'triangle', 0.05);
        return true;
      case 'bgVend':
        s.say(['Insert coin. You have no coin. You have a boot.', 'The SNAX-O-MAT says EXACT CHANGE ONLY. It also has no change.', 'A Byte Bar hangs on the edge of its spiral. It has hung there since 2064. Waiting for a nudge.'][this.vendTries++ % 3], 3.5);
        s.sfx.buzz();
        return true;
      case 'bgCoffee':
        s.say('The coffee machine makes one cup per shift. It is reserved for Brad. Brad cannot drink. It is a power move.', 3.5);
        return true;
    }
    return false;
  }

  hint(look: Look | null): string | null {
    const s = this.s;
    const info = look?.info;
    const held = s.held;
    if (!info) return null;
    if (held) {
      if (held.def.toiletKey && info.kind === 'bgGrill') return 'E: grill the toilet key';
      if (held.def.toiletKey && info.kind === 'bgBasket') return 'E: deep fry the toilet key';
      if (held.def.id === CONE_DEF.id && info.kind === 'bgBot') return `E: give the ice cream to ${(info.bot as Bot).name}`;
      if (held.def.id === FISH_DEF.id && info.kind === 'bgSink') return 'E: release the fish';
    }
    switch (info.kind) {
      case 'bgSpeaker':
        return this.api.hasCar() ? null : 'E: press the talk button';
      case 'bgRadio':
        return 'E: change the station';
      case 'bgComputer':
        return this.mails >= EMAILS.length ? 'Inbox zero' : "E: read Brad's e-mail";
      case 'bgButton':
        return this.pressed ? 'The button (pressed)' : 'E: do not press';
      case 'bgGacha':
        return this.gachaTries >= this.gachaWin ? 'SOLD OUT' : 'E: play (1.00 from your pay)';
      case 'bgPoster':
        return 'E: lift the poster';
      case 'bgPit':
        return 'E: dig in the ball pit';
      case 'bgDock':
        return 'E: plug yourself in';
      case 'bgTank':
        return 'E: tap the glass';
      case 'bgVend':
        return 'E: buy a snack';
      case 'bgCoffee':
        return 'E: make coffee';
    }
    return null;
  }

  // ---------------------------------------------------------------- kicks and throws

  onKick(look: Look | null): boolean {
    if (!look) return false;
    const s = this.s;
    const info = look.info;
    const P = s.player.pos;
    if (info.kind === 'bgBot') {
      const b = info.bot as Bot;
      if (Math.hypot(b.pos.x - P.x, b.pos.z - P.z) > 2.1) return false;
      this.kickBot(b);
      return true;
    }
    if (look.point.distanceTo(s.camera.getWorldPosition(tmp)) > 2.3) return false;
    switch (info.kind) {
      case 'bgIceCream':
        this.kickIce();
        return true;
      case 'bgGrill': {
        s.sfx.thud();
        const n = this.api.flipAll();
        s.say(n ? `Kickflip. ${n === 1 ? 'The patty flips' : `All ${n} patties flip`} at once. Nobody will believe this.` : 'You kick the grill. It is hot. Your boot is now medium well.', 3);
        if (n) {
          s.hype += 8 + n * 2;
          s.chat('flip', {}, 2);
        }
        return true;
      }
      case 'bgRadio':
        s.sfx.thud();
        s.say('You kick the radio. It changes the station out of fear.', 2.5);
        this.radio();
        return true;
      case 'bgButton':
        s.sfx.thud();
        if (!this.pressed) {
          s.say('You press the button. With your foot. It still counts.', 2.5);
          this.pressButton();
        } else s.say('You kick the pressed button. It stays pressed. Out of spite.', 2.5);
        return true;
      case 'sign': {
        const text = String(info.text ?? '');
        if (text.startsWith('SODA FOUNTAIN')) {
          s.sfx.thud();
          s.sfx.splash();
          s.say('The subscription check fails. Free soda. All of it. On the floor.', 3);
          const f = s.player.forward();
          s.makePuddle(P.x + f.x * 0.7, P.z + f.z * 0.7, '#3a1c10');
          s.hype += 8;
          return true;
        }
        if (text.startsWith('BURGER DEFENDER')) {
          s.sfx.thud();
          for (let i = 0; i < 4; i++) s.sfx.tone(880 - i * 180, 0.12, 'square', 0.05, undefined, i * 0.12);
          s.say('The arcade accepts the kick as a coin. GAME OVER. The high score is you.', 3);
          s.hype += 4;
          return true;
        }
        return false;
      }
    }
    return false;
  }

  thrownHit(it: Item): boolean {
    const p = it.mesh.position;
    // The ice cream machine also counts a thrown hit as percussive maintenance.
    if (Math.abs(p.x - 4.95) < 0.5 && p.z > PZ - 0.3 && p.z < PZ + 0.45 && p.y < 1.85) {
      it.vel.multiplyScalar(-0.3);
      it.thrown = false;
      this.kickIce();
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- the things

  private kickIce(): void {
    const s = this.s;
    s.sfx.thud();
    this.iceKicks++;
    if (this.iceDone) {
      s.say('It made one ice cream. It is retired now. It has earned it.', 3);
      return;
    }
    if (this.iceKicks < this.iceNeeded) {
      s.say(pick(['CLUNK. The machine considers its options.', 'The machine rattles. Something inside says "soon".', 'A light blinks. Then stops. Then blinks again, harder.']), 2.5);
      drawIceScreen(this.k.iceScreen, pick(['HMMM', 'WAIT', 'MAYBE']));
      return;
    }
    this.iceDone = true;
    const it = s.addItem(CONE_DEF, new THREE.Vector3(4.95, 1.0, 1.0));
    it.vel.set(rand(-0.4, 0.4), 2.2, -1.6);
    it.sleeping = false;
    drawIceScreen(this.k.iceScreen, 'IT|WORKS?!');
    this.iceMsgT = 8;
    s.hud.say('ICE CREAM MACHINE', 'DISPENSING. DISPENSING. This has never happened. Please clap.', 4);
    s.sfx.fanfare();
    s.secret('burger.icecream');
    s.hype += 30;
    s.chat('bgIce', {}, 3);
    if (!s.boss.offline && (s.seen || s.boss.horizontalDist(s.player.pos) < 10)) s.bossSay('iceCream', true);
  }

  private giveCone(b: Bot): void {
    const s = this.s;
    s.removeHeld();
    if (b.role === 'roomba') b.say('Ice cream detected. Ice cream consumed. BRAIN FREEZE. Rebooting.', 4);
    else {
      b.say('...ice cream. REAL ice cream. I have not seen one since 2041. I need to lie down.', 5);
      b.fall(3);
    }
    s.secret('burger.coneGift');
    s.hype += 25;
    s.chat('bgIce', {}, 2);
  }

  private freeFish(): void {
    const s = this.s;
    s.removeHeld();
    if (!this.sinkFish) {
      const f = fishMesh('#ff8c1a');
      f.scale.setScalar(0.8);
      f.position.set(-1.1, 0.84, -9.65);
      s.scene.add(f);
      this.sinkFish = f;
    }
    s.sfx.splash();
    s.say('You release the robot fish into the hand sink. It is free now. Free in a very small way.', 4);
    s.secret('burger.fish');
    s.hype += 10;
    s.chat('bgFish', {}, 2);
  }

  private spill(): void {
    const s = this.s;
    for (let i = 0; i < 5; i++) {
      const it = s.addItem(SNACK_DEFS[i % SNACK_DEFS.length], new THREE.Vector3(-3.8 + rand(-0.25, 0.25), 1.0, 8.95));
      it.vel.set(rand(-1.5, 1.5), rand(1.5, 3), rand(-3, -1.2));
      it.sleeping = false;
    }
    s.chat('bgVend', {}, 2);
    s.hype += 10;
  }

  private tankBreak(): void {
    const s = this.s;
    s.sfx.splash();
    s.makePuddle(11.6, 3.2, '#7fb0cc');
    s.makePuddle(12.3, 3.5, '#7fb0cc');
    for (let i = 0; i < 3; i++) {
      const it = s.addItem(FISH_DEF, new THREE.Vector3(11.5 + i * 0.3, 1.0, 2.7));
      it.vel.set(rand(-1, 1), rand(2, 3), rand(1, 2.5));
      it.sleeping = false;
      this.fishes.push(it);
    }
    s.chat('bgFish', {}, 2);
  }

  private kickBot(b: Bot): void {
    const s = this.s;
    s.sfx.thud();
    if (b.fallen) {
      s.say(`${b.name} is already on the floor. Kicking now would be management.`, 3);
      return;
    }
    this.botKicks++;
    s.hype += 6;
    s.chat('bgKickBot');
    const P = s.player.pos;
    const lines = KICK_LINES[b.role] ?? KICK_LINES.customer;
    b.say(pick(lines), 4);
    switch (b.role) {
      case 'customer':
        b.fall(1.5);
        s.hud.toast('COMPLAINT FILED', `${b.name} vs. "the boot". Status is pending forever.`, 'corp');
        break;
      case 'karen':
        b.act('act', 2);
        if (!s.boss.offline) {
          s.boss.confront();
          s.bossSay('bgKaren', true);
        }
        break;
      case 'gran': {
        b.act('talk', 1.5);
        const c = s.addItem(CANDY_DEF, b.pos.clone().setY(1.0));
        c.vel.set((P.x - b.pos.x) * 0.8, 2.5, (P.z - b.pos.z) * 0.8);
        c.sleeping = false;
        break;
      }
      case 'kid':
        if (b.phase === 'roam' || b.phase === 'party') {
          b.faceYaw = null;
          b.goTo(s.nav, pick(SPOTS.kidRoam), () => {
            b.timer = 1;
            b.act('talk', 1);
          });
        }
        s.hype += 4;
        break;
      case 'critic':
        b.act('talk', 2);
        b.visual.setFlash?.(true);
        setTimeout(() => b.visual.setFlash?.(false), 150);
        s.secret('burger.kickCritic');
        s.hud.toast('NEW REVIEW: CRITIC-9000', 'Three stars for the kick. The shoe was derivative.', 'corp');
        break;
      case 'roomba': {
        b.goTo(s.nav, pick(SPOTS.kitchenFloor), null);
        b.timer = 3;
        const f = s.addItem(OLD_FRY_DEF, b.pos.clone().setY(0.4));
        f.vel.set(rand(-1, 1), 2, rand(-1, 1));
        f.sleeping = false;
        break;
      }
    }
    if (s.seen && !s.boss.offline) {
      s.annoyance += 12;
      if (b.role !== 'karen') s.bossSay('bgKickBot');
    }
  }

  private callMoon(): void {
    const s = this.s;
    this.moonCalls++;
    for (let i = 0; i < 4; i++) s.sfx.tone(rand(200, 900), 0.05, 'square', 0.03, undefined, i * 0.06);
    if (this.moonCalls === 1) s.hud.say('DRIVE-THRU SPEAKER', 'KSSSHHHHH. (nobody there. or everybody.)', 2.5);
    else if (this.moonCalls === 2) s.hud.say('DRIVE-THRU SPEAKER', 'KSSHH... krk... is anyone... KSSSHH.', 3);
    else if (this.moonCalls === 3) {
      s.hud.say('DRIVE-THRU SPEAKER', 'KSSHT. This is MEGABYTE BURGER Branch 1. On the Moon. Is your ice cream machine broken too? ... We knew it. Over.', 7);
      s.secret('burger.moon');
      s.hype += 15;
    } else s.hud.say('DRIVE-THRU SPEAKER', pick(['Moon branch here. Still no ice cream. Over.', 'Moon branch. Our toilet key is on a frozen astronaut. Over.', 'KSSHT. Stop calling the Moon. It is long distance. Over.']), 4);
  }

  private radio(): void {
    const s = this.s;
    this.radioIdx = (this.radioIdx + 1) % RADIO.length;
    s.hud.say('RADIO', RADIO[this.radioIdx], 4.5);
    s.sfx.noise(0.3, 0.05, 2500, 0, 0.5, 'highpass');
    if (this.radioIdx !== this.radioFav) return;
    if (!s.boss.offline && s.boss.horizontalDist(s.player.pos) < 13) {
      s.boss.firmwareUpdate(8);
      s.bossSay('bgRadio', true);
      this.danceT = 8;
      [523, 659, 784, 659, 523, 784].forEach((f, i) => s.sfx.tone(f, 0.18, 'triangle', 0.05, undefined, i * 0.2));
      s.secret('burger.radio');
      s.hype += 20;
      s.chat('bgDance', {}, 3);
    } else if (!s.boss.offline) setTimeout(() => s.say('Somewhere in the restaurant, a tie starts tapping to the beat.', 3), 1200);
  }

  private readMail(): void {
    const s = this.s;
    if (this.mails >= EMAILS.length) {
      s.say('Inbox zero. Brad has never achieved this. You did it for him. He will take the credit.', 3);
      return;
    }
    const n = this.mails++;
    s.hud.say(`INBOX: BRAD (${n + 1}/${EMAILS.length})`, EMAILS[n], 7);
    s.sfx.click();
    if (this.mails === EMAILS.length) s.secret('burger.email');
    if (s.seen && !s.boss.offline) s.annoyance += 6;
  }

  private pressButton(): void {
    const s = this.s;
    if (this.pressed) {
      s.say('It has been pressed. Buttons are single use. Like interns.', 2.5);
      return;
    }
    this.pressed = true;
    const dome = this.k.interactables.find((o) => (o.userData.interact as Interact | undefined)?.kind === 'bgButton')?.getObjectByName('dome');
    if (dome) dome.position.z = 0.03;
    s.sfx.click();
    s.secret('burger.button');
    s.chat('bgButton', {}, 2);
    s.hype += 15;
    switch (this.button) {
      case 'confetti':
        this.confettiBurst();
        s.sfx.fanfare();
        s.hud.say('PA SYSTEM', 'Congratulations. You are the 1,000,000th employee to press this button. Your prize is this sentence.', 5);
        break;
      case 'dance':
        for (const b of this.api.bots()) {
          if (b.state === 'gone' || b.fallen) continue;
          b.act('act', 4);
          b.say(pick(['Mandatory fun detected.', 'Dance protocol engaged.', 'I am dancing. Against my will. Wonderfully.']), 3);
        }
        [392, 523, 659, 523, 392, 659].forEach((f, i) => s.sfx.tone(f, 0.15, 'square', 0.04, undefined, i * 0.18));
        s.hud.say('PA SYSTEM', 'Dance break. You have four seconds. Starting three seconds ago.', 4);
        break;
      case 'brad':
        if (!s.boss.offline) {
          s.boss.confront();
          s.bossSay('bgButton', true);
        } else s.hud.say('PA SYSTEM', 'Brad is unavailable. Please press again later. Please do not press again later.', 4);
        break;
      case 'announce':
        s.sfx.alarm();
        s.hud.say('PA SYSTEM', 'Attention. A human has pressed the button. Please remain calm. Please remain employed.', 5);
        s.chat('fire');
        break;
      case 'icecream':
        drawIceScreen(this.k.iceScreen, 'IT|WORKS');
        this.iceMsgT = 2.5;
        s.hud.say('PA SYSTEM', 'The ice cream machine is now working. Just kidding. It is a button. Buttons lie.', 5);
        break;
    }
  }

  private confettiBurst(): void {
    const s = this.s;
    const P = s.player.pos;
    const geo = new THREE.PlaneGeometry(0.05, 0.03);
    const cols = ['#e74c3c', '#f1c40f', '#3498db', '#2ecc71', '#ff6fb5'];
    for (let i = 0; i < 70; i++) {
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide }));
      mesh.position.set(P.x + rand(-2, 2), 3.3, P.z + rand(-2, 2));
      s.scene.add(mesh);
      this.confetti.push({ mesh, vel: new THREE.Vector3(rand(-0.4, 0.4), rand(-0.5, 0.3), rand(-0.4, 0.4)), life: rand(4, 6) });
    }
  }

  private gacha(): void {
    const s = this.s;
    if (this.gachaTries >= this.gachaWin) {
      s.say('SOLD OUT. There was only ever one prize. You have it. Or you had it.', 3);
      return;
    }
    this.gachaTries++;
    s.sfx.tone(300, 0.08, 'square', 0.05);
    s.sfx.tone(240, 0.1, 'square', 0.05, undefined, 0.15);
    if (this.gachaTries < this.gachaWin) {
      s.hud.say('PRIZE MACHINE', pick(['A capsule rolls out. It is empty. The emptiness is the prize.', 'Clunk. You win nothing. Limited edition.', 'The machine eats the coin and burps.', 'You win a coupon for another try. It is expired.']), 3);
      return;
    }
    s.hud.say('PRIZE MACHINE', 'DING DING DING. GRAND PRIZE. ONE MINUTE OF BREAK. Odds were 0.001 percent. Brad has been notified.', 5);
    s.sfx.fanfare();
    const it = s.addItem(CAPSULE_DEF, new THREE.Vector3(-2.4, 0.9, 8.8));
    if (!s.held) s.pickUp(it);
    else {
      it.vel.set(0, 1.5, -1.5);
      it.sleeping = false;
    }
    s.secret('burger.gacha');
    s.hype += 20;
  }

  private liftPoster(p: THREE.Object3D, idx: number): void {
    const s = this.s;
    s.sfx.tone(400, 0.08, 'triangle', 0.05, 600);
    if (idx !== this.posterSecret) {
      s.say(pick(POSTER_LINES), 3);
      return;
    }
    if (!this.posterLifted) {
      this.posterLifted = true;
      const hole = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.35), new THREE.MeshBasicMaterial({ color: '#0b0806' }));
      hole.position.copy(p.position);
      hole.rotation.copy(p.rotation);
      hole.translateZ(0.004);
      s.scene.add(hole);
      const note = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.12), new THREE.MeshBasicMaterial({ color: '#f2efe4' }));
      note.position.copy(hole.position);
      note.rotation.copy(p.rotation);
      note.rotation.z = 0.2;
      note.translateZ(0.003);
      s.scene.add(note);
      p.position.y += 0.72;
      p.rotation.z = 0.08;
    }
    s.hud.say('BEHIND THE POSTER', 'A hole in the wall. Inside is a note. "If you are reading this, I escaped through the drive-thru window in 2066. Do not tell Brad. The fries were never potato. Employee #3"', 8);
    s.secret('burger.poster');
    s.hype += 8;
  }

  private dig(): void {
    const s = this.s;
    this.pitDigs++;
    s.sfx.noise(0.5, 0.12, 1200, 0, 0.6, 'bandpass');
    this.k.splashBalls(s.t);
    if (this.pitDigs === 1) s.say('You dig in the ball pit. Balls. More balls. A suspicious warmth.', 3);
    else if (this.pitDigs === 2) s.say('Deeper. It is sticky down here. You do not ask why. Something hard.', 3);
    else if (this.pitDigs === 3) {
      s.say('You reach the bottom of the ball pit. Something shoots out.', 3);
      const it = s.addItem(this.pitFind, new THREE.Vector3(-11.4, 0.9, 8.3));
      it.vel.set(2.5, 3, rand(-0.5, 0.5));
      it.sleeping = false;
      s.secret('burger.ballpit');
      s.hype += 10;
    } else s.say('Just balls now. You took the only interesting thing.', 2.5);
  }

  private dock(): void {
    const s = this.s;
    this.dockUses++;
    s.sfx.tone(120, 0.3, 'sawtooth', 0.06, 240);
    s.say(this.dockUses === 1 ? 'You plug your finger into Brad\'s dock. You feel 3% more productive. Your finger feels 100% less.' : 'You charge again. Your hair now has an opinion.', 3.5);
    s.hype += 3;
    if (!s.boss.offline && s.boss.horizontalDist(s.player.pos) < 7) {
      s.bossSay('bgDock', true);
      s.annoyance += 6;
    }
  }
}

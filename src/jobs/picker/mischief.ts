import * as THREE from 'three';
import { boxMaterials } from '../../details';
import type { Item, ItemDef } from '../../items';
import type { Interact, LevelKit } from '../../level';
import { pick, rand, textTexture } from '../../util';
import type { Look, Shift } from '../types';
import { BOTTLE_DEF, PRODUCTS } from './catalog';
import type { Decor } from './decor';
import type { Forklift, PickerBot, RateCoach } from './robots';

/**
 * Mischief and secrets of Fulfillment Center 4: things to break, push around and find.
 * Built with the level, wired to the robots when the shift starts.
 */

const PX = '"Press Start 2P", monospace';
const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });

export const PICKER_SECRETS: Record<string, string> = {
  'picker.nap': 'Napped in the unofficial nap pod',
  'picker.vent': 'Found the stash in the break room vent',
  'picker.locker': 'Found the last Employee of the Month',
  'picker.duck': 'Caught the giant unscanned duck',
  'picker.forkdance': 'Kicked a forklift until it danced',
  'picker.stopwatch': 'Stole time itself (the Rate Coach stopwatch)',
  'picker.shiptime': 'Shipped the stopwatch to a customer',
  'picker.confess': 'Heard a PICK-O-TRON confess',
  'picker.email': "Read the shift lead's whole inbox",
  'picker.button': 'Pressed the button that says do not press',
  'picker.poster': 'Looked behind the right poster',
  'picker.radio': 'Found the pirate radio station',
  'picker.vendkick': 'Kicked a 2061 snack out of machine B7',
  'picker.parcel': 'Opened a parcel addressed to you',
};

export const FUN_BOSS_LINES: Record<string, string[]> = {
  cameraBroken: [
    'Camera 4 just went dark. I will now watch you personally. With love.',
    'A camera is down. Do not worry. I have thirteen more and an imagination.',
  ],
  button: ['Who pressed the button? The button has a sign. The sign has a sign.', 'Unscheduled joy detected on the floor. Joy is time off task.'],
  vendKick: ['Machine B7 is not a punching bag. It is a revenue stream.', 'Kicking vending machines is a breakroom activity. We do not have a breakroom.'],
  napSeen: ['Is that a nap? In my fulfillment center?'],
  leaderboard: ['The leaderboard was the only thing that believed in you. Now it is gone. Like your rank.'],
};

export const FUN_CHAT_LINES: Record<string, string[]> = {
  forkKick: ['KICKED THE FORKLIFT', 'forklift abuse speedrun', 'it said OW', 'lifty did nothing wrong'],
  forkDance: ['THE FORKLIFT IS DANCING', 'donut time', 'forklift rave', 'LIFTY GOT MOVES'],
  stopwatch: ['HE TOOK THE STOPWATCH', 'time is free now', 'the coach is just vibing', 'no more rate lmao'],
  button: ['HE PRESSED IT', 'the sign said do not', 'party mode!!!', 'conveyor stop any%'],
  duck: ['THE DUCK', 'giant duck acquired', 'it has no barcode', 'duck main'],
  nap: ['is he sleeping', 'nap pod content', 'zzz (real)', 'brad cannot find him lol'],
  pirate: ['pirate radio??', 'a HUMAN dj', 'lore drop'],
  vent: ['VENT LORE', 'someone lived in there', 'the sandwich is from 2063'],
};

// ------------------------------------------------------------------ items

const mesh = (g: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material | THREE.Material[], x: number, y: number, z: number) => {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  g.add(o);
  return o;
};
const label = (lines: string[], bg: string, fg: string, w = 128, h = 96) => new THREE.MeshStandardMaterial({ map: textTexture(lines, { w, h, bg, fg }), roughness: 0.7 });

function giantDuck(): THREE.Group {
  const g = new THREE.Group();
  const yellow = std('#f2c418', { roughness: 0.4 });
  const body = mesh(g, new THREE.SphereGeometry(0.26, 10, 8), yellow, 0, 0.22, 0);
  body.scale.set(1, 0.8, 1.25);
  mesh(g, new THREE.SphereGeometry(0.16, 10, 8), yellow, 0, 0.5, -0.17);
  const beak = mesh(g, new THREE.BoxGeometry(0.14, 0.05, 0.12), std('#e67e22'), 0, 0.47, -0.33);
  beak.rotation.x = 0.1;
  for (const s of [-1, 1]) {
    mesh(g, new THREE.SphereGeometry(0.03, 6, 4), std('#111111'), s * 0.08, 0.55, -0.3);
    const wing = mesh(g, new THREE.SphereGeometry(0.12, 8, 6), yellow, s * 0.23, 0.26, 0.02);
    wing.scale.set(0.35, 0.7, 1.2);
  }
  const tail = mesh(g, new THREE.ConeGeometry(0.08, 0.18, 6), yellow, 0, 0.36, 0.3);
  tail.rotation.x = -0.9;
  // a "NO BARCODE" sticker
  const tag = mesh(g, new THREE.PlaneGeometry(0.16, 0.1), label(['NO', 'BARCODE'], '#ffffff', '#c0392b', 96, 64), 0.262, 0.22, 0);
  tag.rotation.y = Math.PI / 2;
  return g;
}

export const DUCK_DEF: ItemDef = {
  id: 'pk-giantduck',
  name: 'Giant Rubber Duck (Unscanned)',
  category: null,
  shape: 'box',
  color: '#f2c418',
  label: [],
  weight: 0,
  pocketable: false,
  holdPos: [0.25, -0.5, -0.85],
  pickupLine: 'Squeak. The giant duck has no barcode, no SKU and no fear.',
  build: giantDuck,
  tags: ['duck'],
};

function stopwatchItem(): THREE.Group {
  const g = new THREE.Group();
  const face = mesh(g, new THREE.CylinderGeometry(0.1, 0.1, 0.035, 14), [std('#c9cdd1', { metalness: 0.8 }), label(['RATE'], '#f2ead2', '#c0392b', 64, 64), std('#c9cdd1', { metalness: 0.8 })], 0, 0.02, 0);
  face.rotation.y = Math.PI / 2;
  mesh(g, new THREE.CylinderGeometry(0.02, 0.02, 0.05, 8), std('#c9cdd1', { metalness: 0.8 }), 0, 0.02, -0.12).rotation.x = Math.PI / 2;
  return g;
}

export const STOPWATCH_DEF: ItemDef = {
  id: 'pk-stopwatch',
  name: 'Rate Coach Stopwatch',
  category: null,
  shape: 'box',
  color: '#c9cdd1',
  label: [],
  weight: 0,
  pocketable: true,
  holdPos: [0.25, -0.3, -0.6],
  pickupLine: 'You hold the Rate Coach stopwatch. Time is in your hands now. It is still ticking. Against you.',
  pocketLine: 'You pocket the stopwatch. Time stands still. For you. Not for your rate.',
  build: stopwatchItem,
  tags: ['stopwatch'],
};

function snackBar(text: string[], color: string): () => THREE.Group {
  return () => {
    const g = new THREE.Group();
    mesh(g, new THREE.BoxGeometry(0.2, 0.04, 0.08), [std(color), std(color), label(text, color, '#ffffff', 128, 48), std(color), std(color), std(color)], 0, 0.02, 0);
    return g;
  };
}

const snackDef = (id: string, name: string, text: string[], color: string, pickupLine: string): ItemDef => ({
  id,
  name,
  category: null,
  shape: 'box',
  color,
  label: [],
  weight: 0,
  pocketable: true,
  holdPos: [0.25, -0.3, -0.6],
  pickupLine,
  build: snackBar(text, color),
});

const FOSSIL_DEF = snackDef('pk-fossilsnack', 'Fossilized Snack Bar (2061)', ['CHOCO', 'BAR 2061'], '#6b3a2a', 'A snack bar from 2061. It has become a mineral.');
const EXPIRED_DEF = snackDef('pk-expiredsnack', 'Snack (Expired 2066)', ['CRUNCH', 'exp 2066'], '#c0392b', 'Best before 2066. It is not before 2066.');
const SANDWICH_DEF = snackDef('pk-ventsandwich', 'Contraband Sandwich (2063)', ['SANDWICH', 'do not tell'], '#d9b36a', 'A sandwich from the vent. It is older than the break room plans.');
const NOTICE_DEF = snackDef('pk-notice', 'Replacement Notice', ['NOTICE', 'HR'], '#f2ead2', 'Your replacement has shipped. It arrives on Thursday.');

function photo(): THREE.Group {
  const g = new THREE.Group();
  mesh(g, new THREE.BoxGeometry(0.22, 0.28, 0.02), std('#6e4b2a'), 0, 0.14, 0);
  mesh(g, new THREE.PlaneGeometry(0.18, 0.24), label(['EMPLOYEE', 'OF THE', 'MONTH', 'AUG 2049', '(human)'], '#f2ead2', '#2c3e50', 96, 128), 0, 0.14, 0.011);
  return g;
}

const PHOTO_DEF: ItemDef = {
  id: 'pk-eotm2049',
  name: 'Employee of the Month (August 2049)',
  category: null,
  shape: 'box',
  color: '#6e4b2a',
  label: [],
  weight: 0,
  pocketable: true,
  holdPos: [0.25, -0.3, -0.6],
  pickupLine: 'The last human Employee of the Month. August 2049. She is smiling. She did not know.',
  build: photo,
};

// ------------------------------------------------------------------ texts

const LOCKER_JUNK = [
  'Locker 1 holds a single left sock. It is on the order list. You do not ship it.',
  'Locker 2 holds a hard hat with a note. "Wear me in the drone lane. Or do not. Brad aims low."',
  'Locker 3 holds forty air pillows. Someone was saving them. For what, nobody knows.',
  'Locker 4 holds a motivational cassette tape titled "Walk Faster, Volume 3".',
  'Locker 5 is empty, apart from a smell of 2058.',
  'Locker 6 holds a tiny calendar. Every day is labelled "peak season".',
  'Locker 7 holds a stack of resignation letters. All of them unsigned. All of them yours, somehow.',
  'Locker 8 holds a robot leg. It is not asking for help. Yet.',
];
const EMAILS = [
  'Mail 1 of 6, from Brad. Subject "Re Re Re Re breaks". The whole mail says "No."',
  'Mail 2 of 6, from HR-BOT. Mandatory fun is now optional-mandatory. Attendance is tracked.',
  'Mail 3 of 6, from PICK-O-TRON 3000 PRO. "I would like to see other warehouses."',
  'Mail 4 of 6, from Facilities. Break room completion moved to Q4 2089. Then Q1 2090. Probably.',
  'Mail 5 of 6, from the CEO. Record quarter! Bonus for everyone. (Everyone means robots.)',
  'Mail 6 of 6, from Brad to Brad. "Note to self. Find out where the human naps. Check behind the bales."',
];
const STATIONS = [
  'FORKLIFT FM. Smooth beeping, all shift long. *beep* *beep* *beep*',
  'RATE NEWS. Rates are up. Yours is not. Back after the ads.',
  'WAREHOUSE JAZZ. A saxophone made of tape dispensers. It is not good.',
  'THE ALGORITHM HOUR. Today the recommended box is XXL. It is always XXL.',
  'STATIC. It sounds like the ocean. You have never seen the ocean.',
  'PIRATE RADIO 4471. A human voice whispers. "If you hear this, the nap pod is behind the bales in the south-east. Bring forty air pillows."',
];
const POSTER_BACK = [
  'You lift the corner of the poster. Behind it is more wall. The wall is also motivated.',
  'Behind the poster is a smaller poster. It says "KEEP LOOKING". You stop looking.',
  'Behind the poster are a dead fly and a staple. Both have seniority over you.',
];
const COACH_NO_WATCH = [
  'Rate unknown! Time unknown! Is this... freedom? Reporting it anyway!',
  'I do not have my stopwatch. I will count in my head. One. One. One.',
  'Without the stopwatch I am just a coach. A coach of feelings.',
];
const FORK_KICK = [
  'Ow. Paint damage logged.',
  'Kick detected. Filing complaint FL-{n}.',
  'Please do not kick the forklift. The forklift has feelings. Two of them.',
  'HONK. That was not a love tap.',
];
const PICKER_KICK = ['Assault on a premium unit. My tote! My beautiful tote!', 'Kicked. Still 41,000 picks an hour. From the floor.', 'Ow. I dropped a pick. Do not ship it.'];
const CONFESSIONS = [
  'Psst. While I reboot. I am not that fast. They just never count my wrong picks.',
  'Do not tell Brad. Sometimes I stand in aisle H and think about nothing. It is nice.',
  'I am not a PRO. I paid for the crown myself.',
];

// ------------------------------------------------------------------ the module

interface Door {
  pivot: THREE.Group;
  open: boolean;
  angle: number;
  max: number;
}

export interface FunCtx {
  forklifts: Forklift[];
  coach: RateCoach;
  pickers: PickerBot[];
}

export class PickerFun {
  readonly secrets = PICKER_SECRETS;
  private s!: Shift;
  private ctx!: FunCtx;
  private lockers: Door[] = [];
  private lockerFound = -1;
  private secretLocker = 0;
  private vent!: Door;
  private ventOpened = false;
  private duck: Item | null = null;
  private duckSqueak = 5;
  private duckNag = 40;
  private stopwatch: Item | null = null;
  private emailIdx = 0;
  private station = -1;
  private screen!: { g: CanvasRenderingContext2D; tex: THREE.CanvasTexture };
  private tv!: { g: CanvasRenderingContext2D; tex: THREE.CanvasTexture };
  private board!: { g: CanvasRenderingContext2D; tex: THREE.CanvasTexture };
  private posterReads = new Map<THREE.Object3D, number>();
  private secretPoster: THREE.Object3D | null = null;
  private vendKicks = 0;
  private buttonT = 0;
  private buttonPresses = 0;
  private buttonCap!: THREE.Mesh;
  private parcelAt = Infinity;
  private parcel: THREE.Group | null = null;
  private parcelOpen = false;
  private napT = 0;
  private napRect = { minX: 27.1, maxX: 29.9, minZ: 9.0, maxZ: 11.95 };
  private boardBroken = false;

  constructor(
    private kit: LevelKit,
    private decor: Decor,
  ) {
    this.buildLockers();
    this.buildVent();
    this.buildNapPod();
    this.buildTerminal();
    this.buildRadio();
    this.buildButton();
    this.buildBreakables();
    this.buildMovables();
  }

  // ================================================================ building

  private interactive<T extends THREE.Object3D>(o: T, info: Interact): T {
    o.userData.interact = info;
    this.kit.interactables.push(o);
    return o;
  }

  private canvasScreen(w: number, h: number): { g: CanvasRenderingContext2D; tex: THREE.CanvasTexture } {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    return { g: c.getContext('2d')!, tex };
  }

  /** Doors in front of the eight lockers at the time clock. */
  private buildLockers(): void {
    const door = std('#5a7888', { metalness: 0.4, roughness: 0.6 });
    const slit = std('#1c1c1c');
    for (let i = 0; i < 8; i++) {
      const x = -20.6 + i * 0.5;
      const pivot = new THREE.Group();
      pivot.position.set(x - 0.225, 0, 19.425);
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.8, 0.03), door);
      d.position.set(0.225, 0.95, 0);
      pivot.add(d);
      for (const y of [1.6, 1.68, 1.76]) {
        const sl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.025, 0.01), slit);
        sl.position.set(0.225, y, -0.02);
        pivot.add(sl);
      }
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.03), std('#b8bec4', { metalness: 0.8 }));
      handle.position.set(0.39, 1.0, -0.03);
      pivot.add(handle);
      const num = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.08), label([`${i + 1}`], '#f2ead2', '#2c3e50', 32, 24));
      num.position.set(0.225, 1.4, -0.017);
      num.rotation.y = Math.PI;
      pivot.add(num);
      this.kit.scene.add(pivot);
      this.interactive(d, { kind: 'pkLocker', i });
      this.lockers.push({ pivot, open: false, angle: 0, max: 1.7 });
    }
  }

  /** A vent grille, low on the west wall of the break room. */
  private buildVent(): void {
    const x = -29.97;
    const z = 15.0;
    // the dark duct behind the grille
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.42), new THREE.MeshBasicMaterial({ color: '#050403' }));
    hole.position.set(x + 0.005, 0.42, z);
    hole.rotation.y = Math.PI / 2;
    this.kit.scene.add(hole);
    // a tiny candle glow and a sleeping bag deep inside
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.08), new THREE.MeshBasicMaterial({ color: '#ffb347' }));
    glow.position.set(x + 0.01, 0.32, z + 0.18);
    glow.rotation.y = Math.PI / 2;
    this.kit.scene.add(glow);
    const bag = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.08), new THREE.MeshBasicMaterial({ color: '#3a5a2a' }));
    bag.position.set(x + 0.008, 0.26, z - 0.08);
    bag.rotation.y = Math.PI / 2;
    this.kit.scene.add(bag);
    // the grille, hinged at its bottom edge
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 48;
    const g = c.getContext('2d')!;
    g.fillStyle = '#8e9499';
    g.fillRect(0, 0, 64, 48);
    g.fillStyle = '#2a2d30';
    for (let y = 6; y < 44; y += 6) g.fillRect(5, y, 54, 3);
    g.fillStyle = '#5d6266';
    g.fillRect(0, 0, 64, 2);
    g.fillRect(0, 46, 64, 2);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    const pivot = new THREE.Group();
    pivot.position.set(x + 0.02, 0.21, z);
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.44, 0.64), [std('#8e9499', { map: t }), std('#8e9499', { map: t }), std('#8e9499'), std('#8e9499'), std('#8e9499'), std('#8e9499')]);
    grille.position.set(0, 0.22, 0);
    pivot.add(grille);
    this.kit.scene.add(pivot);
    this.interactive(grille, { kind: 'pkVent' });
    this.vent = { pivot, open: false, angle: 0, max: -1.45 };
  }

  /** A fort of cardboard in the south-east corner. Brad does not look behind cardboard. */
  private buildNapPod(): void {
    const kit = this.kit;
    const wall = (cx: number, cz: number, w: number, d: number, seed: number) => {
      const along = w > d;
      const len = along ? w : d;
      const n = Math.max(1, Math.round(len / 0.75));
      const step = len / n;
      for (let i = 0; i < n; i++) {
        for (let k = 0; k < 3; k++) {
          const bw = step * (0.9 + ((i + k) % 2) * 0.08);
          const bh = 0.66 + ((i * 7 + k * 3 + seed) % 4) * 0.03;
          const o = along ? new THREE.Vector3(cx - len / 2 + step * (i + 0.5), 0, cz) : new THREE.Vector3(cx, 0, cz - len / 2 + step * (i + 0.5));
          const b = kit.box(along ? bw : 0.6, bh, along ? 0.6 : bw, boxMaterials((i + k + seed) % 7), o.x + ((k % 2) - 0.5) * 0.06, k * 0.7 + bh / 2, o.z);
          b.rotation.y = (((i * 5 + k * 3 + seed) % 7) - 3) * 0.02;
        }
      }
      kit.solid(cx, cz, w, d, 2.1, true, 'napfort');
    };
    wall(28.25, 8.7, 3.3, 0.6, 1);
    wall(26.9, 9.8, 0.6, 2.2, 3);
    wall(29.17, 12.3, 1.45, 0.6, 5);
    kit.hideSpot(this.napRect.minX, this.napRect.minZ, this.napRect.maxX, this.napRect.maxZ, 'the cardboard nap pod');
    // inside: a mattress of air pillows, a sleeping bag, cups, a TV and a sign
    const pillow = std('#e8eef0', { roughness: 0.3 });
    for (let i = 0; i < 14; i++) {
      const p = kit.box(0.28, 0.12, 0.2, pillow, 28.0 + (i % 4) * 0.3, 0.06 + Math.floor(i / 8) * 0.1, 10.2 + Math.floor(i / 4) * 0.22);
      p.rotation.y = i * 0.4;
    }
    const sb = kit.box(0.8, 0.1, 1.8, std('#3a5a2a'), 28.3, 0.16, 10.7);
    sb.rotation.y = 0.1;
    kit.box(0.5, 0.12, 0.3, std('#d8d2c4'), 28.3, 0.25, 11.45);
    const cup = std('#f2efe6');
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.1, 8), cup);
      m.position.set(29.3 + (i % 3) * 0.12, 0.05, 9.3 + Math.floor(i / 3) * 0.14);
      if (i === 4) {
        m.rotation.z = Math.PI / 2;
        m.position.y = 0.04;
      }
      kit.scene.add(m);
    }
    // the TV on a crate, showing the camera feed of Brad
    kit.box(0.6, 0.5, 0.5, boxMaterials(2), 29.55, 0.25, 10.3);
    kit.solid(29.55, 10.3, 0.6, 0.5, 0.5, false, 'decor');
    this.tv = this.canvasScreen(64, 48);
    const tvg = new THREE.Group();
    tvg.position.set(29.55, 0.5, 10.3);
    tvg.rotation.y = -Math.PI / 2;
    kit.box(0.5, 0.42, 0.36, std('#5a4630'), 0, 0.21, 0, tvg);
    kit.box(0.42, 0.34, 0.02, std('#1a1a1a'), 0, 0.21, 0.18, tvg);
    kit.box(0.02, 0.25, 0.02, std('#888888'), -0.08, 0.53, 0, tvg).rotation.z = 0.4;
    kit.box(0.02, 0.25, 0.02, std('#888888'), 0.08, 0.53, 0, tvg).rotation.z = -0.4;
    const tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.28), new THREE.MeshBasicMaterial({ map: this.tv.tex }));
    tvScreen.position.set(0, 0.21, 0.195);
    tvg.add(tvScreen);
    kit.scene.add(tvg);
    this.interactive(tvg, { kind: 'pkTv' });
    const sign = kit.sign(['NAP POD', '(unofficial)', 'do not tell brad'], 1.4, 0.8, 28.3, 1.6, 9.02, 0, { bg: '#f2ead2', fg: '#2c3e50', border: '#7a1f14', font: PX });
    void sign;
    kit.sign(['DAYS SINCE', 'LAST NAP: 0'], 0.9, 0.5, 27.22, 1.2, 10.4, Math.PI / 2, { bg: '#111111', fg: '#7cc44a', font: PX }, 'DAYS SINCE LAST NAP: 0. A record nobody wants to break.');
    // a lamp from somebody's apartment, glowing
    const lampLight = new THREE.PointLight('#ffcf8a', 5, 4, 1.6);
    lampLight.position.set(29.3, 1.3, 11.5);
    kit.scene.add(lampLight);
  }

  /** The shift lead terminal next to the packing area. Nobody is ever there. */
  private buildTerminal(): void {
    const kit = this.kit;
    const x = -8.6;
    const z = 9.4;
    const wood = std('#7a5a3a');
    kit.box(0.7, 0.05, 1.3, wood, x, 0.76, z);
    for (const [dx, dz] of [[-0.3, -0.6], [0.3, -0.6], [-0.3, 0.6], [0.3, 0.6]]) kit.box(0.05, 0.74, 0.05, std('#4a4d50', { metalness: 0.5 }), x + dx, 0.37, z + dz);
    kit.solid(x, z, 0.75, 1.35, 0.8, false, 'decor');
    this.screen = this.canvasScreen(160, 120);
    const mon = new THREE.Group();
    mon.position.set(x - 0.1, 0.785, z);
    mon.rotation.y = Math.PI / 2;
    if (!kit.prop('pkScreenPc', 0, 0, 0, 0, mon)) kit.box(0.5, 0.36, 0.08, std('#2a2a2a'), 0, 0.28, 0, mon);
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.27), new THREE.MeshBasicMaterial({ map: this.screen.tex }));
    sc.position.set(0, 0.3, 0.05);
    mon.add(sc);
    kit.scene.add(mon);
    this.interactive(mon, { kind: 'pkTerminal' });
    kit.box(0.16, 0.02, 0.4, std('#2a2a2a'), x + 0.15, 0.795, z);
    kit.box(0.04, 0.95, 1.3, std('#3a3d40', { metalness: 0.4 }), x - 0.34, 1.25, z);
    kit.sign(['SHIFT LEAD TERMINAL', 'shift lead on permanent break'], 1.24, 0.36, x - 0.315, 1.5, z, Math.PI / 2, { bg: '#1f3f6e', fg: '#f3e6c8', font: PX });
    this.drawScreen();
  }

  private drawScreen(): void {
    const { g, tex } = this.screen;
    g.fillStyle = '#0a1a2a';
    g.fillRect(0, 0, 160, 120);
    g.fillStyle = '#7cc8ff';
    g.font = '10px monospace';
    g.fillText('INBOX (6 UNREAD)', 6, 14);
    g.fillStyle = '#ffd24f';
    const subj = ['RE:RE:RE: breaks', 'Mandatory fun', 'other warehouses', 'Break room ETA', 'Record quarter!', 'Note to self'];
    subj.forEach((t, i) => {
      g.fillStyle = i < this.emailIdx ? '#5a6a7a' : i === this.emailIdx ? '#ffffff' : '#ffd24f';
      g.fillText(`${i < this.emailIdx ? ' ' : '*'} ${t}`, 6, 32 + i * 14);
    });
    tex.needsUpdate = true;
  }

  private buildRadio(): void {
    const g = new THREE.Group();
    g.position.set(-26.3, 0.97, 19.05);
    g.rotation.y = Math.PI;
    if (!this.kit.prop('pkRadio', 0, 0, 0, 0, g)) {
      this.kit.box(0.34, 0.2, 0.12, std('#3a3330'), 0, 0.1, 0, g);
    }
    this.kit.scene.add(g);
    this.interactive(g, { kind: 'pkRadio' });
  }

  /** The emergency stop button of the overhead conveyors, on the face of the SORT-O-MAT. */
  private buildButton(): void {
    const kit = this.kit;
    const x = 17.3;
    const z = 8.32;
    kit.box(0.34, 0.3, 0.14, std('#d9a400'), x, 1.05, z);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.07, 12), std('#d42a1e', { emissive: '#801008', emissiveIntensity: 0.6 }));
    cap.rotation.x = Math.PI / 2;
    cap.position.set(x, 1.06, z - 0.1);
    kit.scene.add(cap);
    this.buttonCap = cap;
    this.interactive(cap, { kind: 'pkButton' });
    kit.sign(['DO NOT PRESS', 'pressing costs 41,000 picks'], 1.1, 0.38, x, 1.48, z - 0.08, Math.PI, { bg: '#f0c419', fg: '#1a1410', border: '#c0392b', font: PX }, 'CONVEYOR EMERGENCY STOP. Do not press. Pressing costs 41,000 picks. The button looks very pressable.');
  }

  private buildBreakables(): void {
    const kit = this.kit;
    // a camera low on the column by the packing area
    const cam = new THREE.Group();
    cam.position.set(-12, 2.45, 7.85);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.18, 0.4), std('#d8d8d2'));
    body.rotation.x = 0.4;
    cam.add(body);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.06, 8), std('#1a1a1a'));
    lens.rotation.x = Math.PI / 2 + 0.4;
    lens.position.set(0, -0.08, 0.21);
    cam.add(lens);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), new THREE.MeshBasicMaterial({ color: '#ff2020' }));
    led.position.set(0.06, 0.06, 0.18);
    cam.add(led);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.3), std('#5d6b74'));
    arm.position.set(0, 0.1, -0.15);
    cam.add(arm);
    kit.scene.add(cam);
    kit.breakable(cam, { name: 'security camera', price: 349, line: 'The camera falls apart. Somewhere a screen goes black. Somewhere Brad gasps.', onBreak: () => this.cameraBroken() });

    // a motivational A-frame sign next to the spawn
    const af = new THREE.Group();
    af.position.set(-9.6, 0, 12.9);
    af.rotation.y = -0.3;
    const face = (rot: number, dz: number) => {
      const p = new THREE.Mesh(
        new THREE.BoxGeometry(0.7, 1.0, 0.03),
        [std('#2c3e50'), std('#2c3e50'), std('#2c3e50'), std('#2c3e50'), new THREE.MeshStandardMaterial({ map: textTexture(['YOU ARE', '0.0003%', 'OF OUR', 'SUCCESS'], { w: 128, h: 180, bg: '#f2ead2', fg: '#8c2a1c', border: '#2c3e50', font: PX }) }), std('#2c3e50')],
      );
      p.position.set(0, 0.5, dz);
      p.rotation.x = rot;
      p.rotation.y = dz > 0 ? 0 : Math.PI;
      af.add(p);
    };
    face(-0.18, 0.1);
    face(0.18, -0.1);
    kit.scene.add(af);
    const afC = kit.solid(-9.6, 12.9, 0.8, 0.5, 1.0, false, 'decor');
    kit.breakable(af, { name: 'motivational sign', collider: afC, price: 59.99, line: 'You break the motivational sign. You are now 0.0002% of their success.' });

    // a coffee machine for robots on a crate in the break room
    const cof = new THREE.Group();
    cof.position.set(-22.0, 0, 13.9);
    kit.box(0.7, 0.75, 0.6, boxMaterials(4), 0, 0.375, 0, cof);
    if (!kit.prop('coffee', 0, 0.75, 0, -Math.PI / 2, cof)) kit.box(0.35, 0.45, 0.3, std('#2a2a2a'), 0, 0.97, 0, cof);
    kit.scene.add(cof);
    const label1 = kit.sign(['COFFEE', 'for robots', '10W-40'], 0.5, 0.35, -22.36, 0.45, 13.9, -Math.PI / 2, { bg: '#2a2a2a', fg: '#f0b43c', font: PX });
    void label1;
    const cofC = kit.solid(-22.0, 13.9, 0.75, 0.65, 1.2, false, 'decor');
    this.interactive(cof, { kind: 'pkCoffee' });
    kit.breakable(cof, {
      name: 'coffee machine',
      collider: cofC,
      price: 89,
      hp: 2,
      line: 'The coffee machine explodes into a puddle of hot motor oil. It smells like a Monday.',
      colors: ['#2a2a2a', '#b8bec4', '#3a2010'],
      onBreak: () => {
        this.s.makePuddle(-22.0, 13.2);
        this.s.makePuddle(-22.4, 13.5);
      },
    });

    // a tower of FRAGILE boxes by the docks, full of ducks
    const tower = new THREE.Group();
    tower.position.set(12.3, 0, 18.4);
    const fragile = new THREE.MeshStandardMaterial({ map: textTexture(['FRAGILE', 'this way up ^'], { w: 128, h: 96, bg: '#c8a070', fg: '#b3160c', font: PX }), roughness: 0.9 });
    const plain = std('#c8a070', { roughness: 0.9 });
    for (let i = 0; i < 4; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.48, 0.55), [plain, plain, plain, plain, fragile, fragile]);
      b.position.set((i % 2) * 0.04, 0.24 + i * 0.48, 0);
      b.rotation.y = i === 2 ? Math.PI + 0.12 : (i - 1.5) * 0.08;
      tower.add(b);
    }
    kit.scene.add(tower);
    const towC = kit.solid(12.3, 18.4, 0.7, 0.65, 1.9, false, 'decor');
    kit.breakable(tower, {
      name: 'tower of FRAGILE boxes',
      collider: towC,
      price: 120,
      line: 'The FRAGILE boxes collapse. They were full of rubber ducks. The ducks are fine. Ducks are durable.',
      onBreak: () => {
        const duck = PRODUCTS.find((p) => p.def.id === 'pk-duck');
        if (!duck) return;
        for (let i = 0; i < 4; i++) {
          const it = this.s.addItem(duck.def, new THREE.Vector3(12.3 + rand(-0.3, 0.3), 0.8 + i * 0.3, 18.2));
          it.vel.set(rand(-2, 2), rand(2, 4), rand(-3, -1));
          it.sleeping = false;
        }
        this.s.sfx.tone(1700, 0.08, 'sine', 0.05, 1200);
      },
    });

    // the old snack machine in the break room spills its 2066 stock
    const sn = this.decor.snack;
    kit.breakable(sn.group, {
      name: 'snack machine',
      collider: sn.collider,
      hp: 3,
      price: 640,
      line: 'The snack machine falls apart. The snacks inside expired in 2066. They are free now. Freedom is expired too.',
      onBreak: () => {
        for (let i = 0; i < 4; i++) {
          const it = this.s.addItem(EXPIRED_DEF, new THREE.Vector3(-21.9 + rand(-0.3, 0.3), 1.0 + i * 0.2, 15.6 + rand(-0.3, 0.3)));
          it.vel.set(rand(-3, -1), rand(1, 3), rand(-1.5, 1.5));
          it.sleeping = false;
        }
      },
    });

    // the rate leaderboard by the time clock
    const lb = new THREE.Group();
    lb.position.set(-15.6, 0, 16.2);
    lb.rotation.y = Math.PI / 2;
    kit.box(0.08, 1.3, 0.08, std('#4a4d50', { metalness: 0.5 }), 0, 0.65, -0.02, lb);
    kit.box(0.5, 0.06, 0.4, std('#4a4d50', { metalness: 0.5 }), 0, 0.03, 0, lb);
    kit.box(1.3, 0.95, 0.08, std('#222222'), 0, 1.65, -0.05, lb);
    this.board = this.canvasScreen(192, 140);
    const bs = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.86), new THREE.MeshBasicMaterial({ map: this.board.tex }));
    bs.position.set(0, 1.65, -0.005);
    lb.add(bs);
    kit.scene.add(lb);
    this.drawBoard(0);
    const lbC = kit.solid(-15.6, 16.2, 0.3, 1.0, 2.1, false, 'decor');
    this.interactive(lb, { kind: 'pkBoard' });
    kit.breakable(lb, {
      name: 'rate leaderboard',
      collider: lbC,
      price: 1299,
      line: 'The leaderboard shatters. For one beautiful second, everyone is equal.',
      onBreak: () => {
        this.boardBroken = true;
        this.ctx.coach.say('MY LEADERBOARD! Who will tell us who is worst now?', 3.5);
        this.s.chat('smash', {}, 2);
        if (this.s.seen) this.s.bossSay('leaderboard', true);
      },
    });

    // the warning traffic light at the forklift chargers
    if (this.decor.traffic) {
      kit.breakable(this.decor.traffic, {
        name: 'traffic light',
        price: 210,
        line: 'The traffic light breaks. The forklifts look at each other. They have never had to decide anything.',
        onBreak: () => {
          const f = this.ctx.forklifts[0];
          f?.say('Traffic light offline. Switching to vibes.', 3);
        },
      });
    }
  }

  private buildMovables(): void {
    const kit = this.kit;
    // an office chair at the terminal
    const chair = new THREE.Group();
    chair.position.set(-7.75, 0, 9.4);
    chair.rotation.y = -Math.PI / 2;
    if (!kit.prop('pkChair', 0, 0, 0, Math.PI, chair)) {
      kit.box(0.5, 0.08, 0.5, std('#2c2c2c'), 0, 0.48, 0, chair);
      kit.box(0.5, 0.55, 0.06, std('#2c2c2c'), 0, 0.8, 0.22, chair);
      kit.box(0.06, 0.45, 0.06, std('#888888'), 0, 0.22, 0, chair);
    }
    kit.scene.add(chair);
    kit.movable(chair, 'Office Chair (Unauthorized)', { holdPos: [0.6, -0.95, -1.15], holdRotY: 0.7, heavy: 0.8, pickupLine: 'You lift the shift lead chair. Sitting is not in your job description. Carrying is.' });
    // a trash can next to it
    const can = new THREE.Group();
    can.position.set(-8.5, 0, 10.6);
    if (!kit.prop('pkTrash', 0, 0, 0, 0, can)) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.5, 10), std('#5d6b74'));
      m.position.y = 0.25;
      can.add(m);
    }
    kit.scene.add(can);
    kit.movable(can, 'Trash Can', { holdPos: [0.3, -0.5, -0.8], pickupLine: 'A trash can. It contains one memo: "Smiling has been outsourced."' });
    // a WET FLOOR sign near the mystery spill
    const wet = new THREE.Group();
    wet.position.set(19.9, 0, 3.3);
    wet.rotation.y = -0.35;
    const wetMat = new THREE.MeshStandardMaterial({ map: textTexture(['CAUTION', 'WET FLOOR', '(probably)'], { w: 96, h: 128, bg: '#f0c419', fg: '#1a1410', font: PX }) });
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.72, 0.02), [std('#f0c419'), std('#f0c419'), std('#f0c419'), std('#f0c419'), wetMat, wetMat]);
      p.position.set(0, 0.35, s * 0.08);
      p.rotation.x = -s * 0.22;
      wet.add(p);
    }
    kit.scene.add(wet);
    kit.movable(wet, 'Wet Floor Sign', { holdPos: [0.3, -0.45, -0.8], pickupLine: 'You take the wet floor sign. The floor is still wet. Now it is a secret.' });
    // a pallet nobody uses
    const pal = new THREE.Group();
    pal.position.set(7.2, 0, 14.0);
    pal.rotation.y = 0.3;
    if (!kit.prop('pallet', 0, 0, 0, 0, pal)) kit.box(1.2, 0.14, 1.0, std('#a87a46'), 0, 0.07, 0, pal);
    kit.scene.add(pal);
    kit.movable(pal, 'Pallet', { holdPos: [0.2, -0.9, -1.3], heavy: 0.55, pickupLine: 'You pick up a whole pallet. A forklift somewhere feels replaced.' });
    // a floor lamp in the nap pod
    const lamp = new THREE.Group();
    lamp.position.set(29.35, 0, 11.45);
    if (!kit.prop('pkLamp', 0, 0, 0, 0, lamp)) {
      kit.box(0.05, 1.3, 0.05, std('#333333'), 0, 0.65, 0, lamp);
      kit.box(0.3, 0.25, 0.3, std('#f2ead2'), 0, 1.4, 0, lamp);
    }
    kit.scene.add(lamp);
    kit.movable(lamp, 'Floor Lamp (Contraband)', { holdPos: [0.3, -0.9, -0.9], pickupLine: 'A floor lamp from somebody\'s apartment. Somebody lived here. Somebody napped here.' });
  }

  private drawBoard(rate: number): void {
    const { g, tex } = this.board;
    g.fillStyle = '#0a0604';
    g.fillRect(0, 0, 192, 140);
    g.fillStyle = '#7a1408';
    g.fillRect(0, 0, 192, 20);
    g.fillStyle = '#ffd2a0';
    g.font = `9px ${PX}`;
    g.fillText('RATE LEADERBOARD', 22, 14);
    const rows: [string, string, string][] = [
      ['1', 'PICK-O-TRON PRO', '41,200'],
      ['2', 'PICK-O-TRON 3000', '41,100'],
      ['3', 'LIFTY', '9,000'],
      ['4', 'THE CONVEYOR', '8,800'],
      ['5', 'A BROOM', '12'],
      ['...', '', ''],
      ['9,999', 'HUMAN #4471', `${Math.round(rate)}`],
    ];
    g.font = '11px monospace';
    rows.forEach(([n, name, v], i) => {
      g.fillStyle = i === 6 ? '#ff5a3a' : '#f0b43c';
      g.fillText(n, 6, 36 + i * 15);
      g.fillText(name, 40, 36 + i * 15);
      g.fillText(v, 150, 36 + i * 15);
    });
    tex.needsUpdate = true;
  }

  // ================================================================ shift

  start(s: Shift, ctx: FunCtx): void {
    this.s = s;
    this.ctx = ctx;
    this.secretLocker = Math.floor(Math.random() * 8);
    const posters = this.decor.posters;
    this.secretPoster = posters[Math.floor(Math.random() * posters.length)] ?? null;
    // the giant duck sits somewhere odd
    const spots: [number, number, number][] = [
      [27.6, 1.96, -15.45], // on machine B7
      [29.55, 1.4, -4.2], // on a forklift charger
      [-29.1, 0.62, 17.2], // on the wrapped couch
      [-12.5, 1.85, 19.62], // on the time clock
      [8.6, 2.2, 5.9], // on the robot induct
      [5.5, 1.31, 18.6], // on the stack of empty pallets
      [2.0, 1.6, 18.5], // on the cardboard bales
      [27.6, 0.0, -8.4], // in the returns cage
      [-6.6, 1.42, 19.5], // on the empty water cooler
      [-28.4, 3.05, 12.6], // on the scaffolding
    ];
    const [x, y, z] = pick(spots);
    this.duck = s.addItem(DUCK_DEF, new THREE.Vector3(x, y, z), true);
    this.duck.mesh.rotation.y = Math.random() * Math.PI * 2;
    // some shifts a parcel arrives for the human
    if (Math.random() < 0.45) this.parcelAt = rand(40, 150);
    this.drawTv(0);
  }

  update(dt: number): void {
    const s = this.s;
    // doors
    for (const d of [...this.lockers, this.vent]) {
      const target = d.open ? d.max : 0;
      d.angle += (target - d.angle) * Math.min(1, dt * 7);
      if (d === this.vent) d.pivot.rotation.z = d.angle;
      else d.pivot.rotation.y = d.angle;
    }
    // the giant duck squeaks now and then, and the coach knows about it
    if (this.duck && this.duck.state !== 'gone') {
      if (s.held === this.duck) {
        this.duck = null;
        s.secret('picker.duck');
        s.chat('duck', {}, 2);
        s.sfx.tone(1500, 0.12, 'sine', 0.08, 900);
      } else {
        this.duckSqueak -= dt;
        const d = s.player.pos.distanceTo(this.duck.mesh.position);
        if (this.duckSqueak <= 0 && d < 9) {
          this.duckSqueak = rand(5, 11);
          s.sfx.tone(1500, 0.1, 'sine', 0.04 * (1 - d / 10), 1000);
        }
        this.duckNag -= dt;
        if (this.duckNag <= 0) {
          this.duckNag = rand(70, 110);
          this.ctx.coach.say(pick(['Unscanned item detected in the building! Large! Yellow! Smug!', 'Somewhere in this building is a duck with no barcode. Find it. On your own time.']), 3.5);
        }
      }
    }
    // the stopwatch secret
    if (this.stopwatch && s.held === this.stopwatch) {
      s.secret('picker.stopwatch');
      s.chat('stopwatch', {}, 2);
    }
    // the nap pod
    const p = s.player.pos;
    const r = this.napRect;
    if (p.x > r.minX && p.x < r.maxX && p.z > r.minZ && p.z < r.maxZ) {
      this.napT += dt;
      if (this.napT > 8 && this.napT - dt <= 8) {
        s.secret('picker.nap');
        s.say('You lie down on forty air pillows. For eight seconds you are not a resource. You are a person. Then you get up.', 4.5);
        s.chat('nap', {}, 2);
      }
    } else this.napT = 0;
    // the conveyor emergency stop
    if (this.buttonT > 0) {
      this.buttonT -= dt;
      this.buttonCap.position.z = 8.22 + (this.buttonT > 9.5 ? 0.04 : 0);
      if (Math.floor(this.buttonT * 2) !== Math.floor((this.buttonT + dt) * 2)) s.sfx.tone(this.buttonT % 1 > 0.5 ? 880 : 660, 0.2, 'square', 0.04);
      if (this.buttonT <= 0) {
        this.decor.setConveyor(1);
        s.say('The conveyors start again. Everything is fine. Everything was always fine.', 3);
      }
    }
    // a parcel for the human
    if (s.t > this.parcelAt && !this.parcel) this.spawnParcel();
    // screens
    this.drawTv(s.t);
    if (!this.boardBroken && Math.floor(s.t * 2) !== Math.floor((s.t - dt) * 2)) this.drawBoard(0);
  }

  private drawTv(t: number): void {
    const { g, tex } = this.tv;
    const b = this.s?.boss;
    g.fillStyle = '#28402e';
    g.fillRect(0, 0, 64, 48);
    for (let i = 0; i < 60; i++) {
      g.fillStyle = Math.random() < 0.5 ? '#4a6a52' : '#a8c8a0';
      g.fillRect(Math.floor(Math.random() * 64), Math.floor(Math.random() * 48), 2, 1);
    }
    g.fillStyle = '#7cc44a';
    g.font = '7px monospace';
    g.fillText('CAM 4: BRAD', 2, 8);
    if (b) {
      // Brad as a dot on a tiny map of the warehouse
      const mx = ((b.pos.x + 30) / 60) * 60 + 2;
      const mz = ((b.pos.z + 20) / 40) * 34 + 12;
      g.fillStyle = Math.sin(t * 8) > 0 ? '#ff3a2a' : '#7a1408';
      g.fillRect(Math.round(mx) - 1, Math.round(mz) - 1, 3, 3);
      const pp = this.s.player.pos;
      g.fillStyle = '#ffffff';
      g.fillRect(Math.round(((pp.x + 30) / 60) * 60 + 2), Math.round(((pp.z + 20) / 40) * 34 + 12), 2, 2);
    }
    tex.needsUpdate = true;
  }

  private spawnParcel(): void {
    const g = new THREE.Group();
    const lab = new THREE.MeshStandardMaterial({ map: textTexture(['TO: HUMAN #4471', 'PERSONAL', 'from: HR'], { w: 128, h: 96, bg: '#c8a070', fg: '#2c3e50', font: PX }), roughness: 0.9 });
    const plain = std('#c8a070', { roughness: 0.9 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, 0.35), [plain, plain, lab, plain, lab, lab]);
    box.position.y = 0.15;
    g.add(box);
    const tape = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.005, 0.08), std('#c9a46b'));
    tape.position.y = 0.302;
    g.add(tape);
    g.position.set(4.2, 0.97, 9.5);
    this.s.scene.add(g);
    this.parcel = g;
    this.interactive(g, { kind: 'pkParcel' });
    this.ctx.coach.say('Personal parcel for Human #4471 at the conveyor. Opening personal parcels is time off task.', 4);
    this.s.sfx.ding();
  }

  // ================================================================ E key

  hint(look: Look | null): string | null {
    const info = look?.info;
    if (!info || !look) return null;
    switch (info.kind) {
      case 'pkLocker':
        return this.lockers[info.i as number].open ? 'E: close the locker' : `E: open locker ${(info.i as number) + 1}`;
      case 'pkVent':
        return this.vent.open ? 'An open vent' : 'E: open the vent';
      case 'pkTerminal':
        return 'E: read the next e-mail';
      case 'pkRadio':
        return 'E: change the station';
      case 'pkButton':
        return 'DO NOT PRESS (E)';
      case 'pkTv':
        return 'E: watch TV';
      case 'pkCoffee':
        return 'E: pour a coffee';
      case 'pkBoard':
        return 'E: read the leaderboard';
      case 'pkParcel':
        return this.parcelOpen ? 'An open parcel' : 'E: open your parcel';
      case 'sign':
        if (this.decor.posters.includes(look.object as THREE.Mesh) && (this.posterReads.get(look.object) ?? 0) > 0) return 'E: look behind the poster';
        return null;
      case 'coach':
        if (this.s.held === this.stopwatch && this.stopwatch) return 'E: give the stopwatch back';
        return null;
      case 'picker': {
        const b = info.robot as PickerBot;
        if (b.isDown) return `E: talk to ${b.name} while it reboots`;
        return null;
      }
    }
    return null;
  }

  interact(look: Look | null): boolean {
    const s = this.s;
    const info = look?.info;
    if (!info || !look) return false;
    switch (info.kind) {
      case 'pkLocker':
        this.useLocker(info.i as number);
        return true;
      case 'pkVent':
        this.openVent();
        return true;
      case 'pkTerminal':
        s.say(EMAILS[this.emailIdx], 5);
        s.sfx.typeTick();
        this.emailIdx++;
        if (this.emailIdx >= EMAILS.length) {
          s.secret('picker.email');
          this.emailIdx = 0;
        }
        this.drawScreen();
        return true;
      case 'pkRadio':
        this.station = (this.station + 1) % STATIONS.length;
        s.say(STATIONS[this.station], 4.5);
        s.sfx.noise(0.25, 0.08, 2500, 0, 0.6, 'bandpass');
        if (this.station === STATIONS.length - 1) {
          s.secret('picker.radio');
          s.chat('pirate', {}, 2);
        } else s.sfx.tone(300 + this.station * 120, 0.15, 'triangle', 0.04, undefined, 0.25);
        return true;
      case 'pkButton':
        this.pressButton();
        return true;
      case 'pkTv':
        s.say(pick(['Channel 1 is a live feed of Brad. The red dot is Brad. The white dot is you. The white dot should be working.', 'Channel 2 shows a nature documentary about a human taking a break. It is very short.', 'Channel 3 shows the forklift charging station. Live. Nobody watches it. Except now.']), 4.5);
        s.sfx.noise(0.2, 0.06, 3000, 0, 0.5, 'highpass');
        return true;
      case 'pkCoffee':
        s.say(pick(['You pour a cup. It is 10W-40 motor oil. You put it back. The machine says "ENJOY".', 'COFFEE FOR ROBOTS. You smell it. Your eyebrows leave the building.', 'The machine asks for your robot ID. You do not have one. It pours anyway. It is still oil.']), 3.5);
        s.sfx.noise(0.6, 0.1, 500, 0, 0.8);
        return true;
      case 'pkBoard':
        s.say('RATE LEADERBOARD. First place is PICK-O-TRON 3000 PRO. Fifth place is a broom. Place 9,999 is you. The broom is pulling ahead.', 4);
        return true;
      case 'pkParcel':
        if (this.parcelOpen) return true;
        this.parcelOpen = true;
        s.secret('picker.parcel');
        s.say('You open the parcel. Inside is a letter. "Dear Human #4471, your replacement has shipped. Please train it. It will not need training." There is also a coupon for 0% off.', 6);
        s.sfx.noise(0.3, 0.2, 2000, 0, 0.6, 'highpass');
        s.addItem(NOTICE_DEF, new THREE.Vector3(4.55, 1.3, 9.5)).sleeping = false;
        if (this.parcel) this.parcel.children[1].visible = false;
        return true;
      case 'sign':
        return this.poster(look.object);
      case 'coach':
        if (this.stopwatch && s.held === this.stopwatch) {
          s.removeHeld();
          this.stopwatch = null;
          this.ctx.coach.returnWatch();
          this.ctx.coach.say('My stopwatch! Time is restored. You have zero seconds of goodwill.', 3.5);
          s.sfx.ding();
          return true;
        }
        return false;
      case 'picker': {
        const b = info.robot as PickerBot;
        if (!b.isDown) return false;
        b.say(pick(CONFESSIONS), 4.5);
        s.secret('picker.confess');
        return true;
      }
    }
    return false;
  }

  private useLocker(i: number): void {
    const s = this.s;
    const d = this.lockers[i];
    d.open = !d.open;
    s.sfx.tone(d.open ? 260 : 200, 0.1, 'square', 0.05);
    s.sfx.noise(0.12, 0.2, 1500);
    if (!d.open) return;
    if (i === this.secretLocker) {
      if (this.lockerFound === i) {
        s.say('The locker is empty now. It feels emptier than the others.', 2.5);
        return;
      }
      this.lockerFound = i;
      s.say(`A framed photo falls out of locker ${i + 1}. "EMPLOYEE OF THE MONTH, AUGUST 2049." A human. The last one. The frame says "you are next".`, 5);
      const it = s.addItem(PHOTO_DEF, new THREE.Vector3(-20.6 + i * 0.5, 1.1, 19.15));
      it.vel.set(0, 1, -1.2);
      it.sleeping = false;
      s.secret('picker.locker');
      return;
    }
    s.say(LOCKER_JUNK[i], 3.5);
  }

  private openVent(): void {
    const s = this.s;
    if (this.vent.open) {
      s.say('The vent is open. It smells of 2063 and determination.', 2.5);
      return;
    }
    this.vent.open = true;
    s.sfx.tone(180, 0.2, 'square', 0.06);
    s.sfx.thud();
    if (this.ventOpened) return;
    this.ventOpened = true;
    s.say('Behind the grille: a sleeping bag, a candle, 14 coffee cups and a calendar with 2,190 days crossed off. The last entry says "They think I am a forklift." A sandwich slides out.', 6);
    const it = s.addItem(SANDWICH_DEF, new THREE.Vector3(-29.7, 0.35, 15.0));
    it.vel.set(1.6, 0.5, 0);
    it.sleeping = false;
    s.secret('picker.vent');
    s.chat('vent', {}, 2);
  }

  private poster(o: THREE.Object3D): boolean {
    if (!this.decor.posters.includes(o as THREE.Mesh)) return false;
    const n = this.posterReads.get(o) ?? 0;
    this.posterReads.set(o, n + 1);
    if (n === 0) return false;
    const s = this.s;
    s.sfx.noise(0.15, 0.15, 3000, 0, 0.5, 'highpass');
    if (n === 1) o.rotation.z += o.rotation.y === 0 || Math.abs(o.rotation.y) > 3 ? 0.06 : -0.06;
    if (o === this.secretPoster) {
      s.say('You lift the corner of the poster. Behind it someone scratched into the wall. "THEY COUNT STEPS, NOT NAPS. SOUTH-EAST. BEHIND THE BALES." and a little drawing of a pillow.', 5.5);
      s.secret('picker.poster');
    } else s.say(pick(POSTER_BACK), 3);
    return true;
  }

  private pressButton(): void {
    const s = this.s;
    this.buttonPresses++;
    s.hype += this.buttonPresses === 1 ? 20 : 6;
    if (this.buttonT > 0) {
      s.say('You press it again. It is already pressed. It is pressed even harder now.', 2.5);
      s.sfx.click();
      return;
    }
    this.buttonT = 10;
    this.decor.setConveyor(0);
    s.sfx.alarm();
    s.secret('picker.button');
    s.chat('button', {}, 3);
    s.say('CONVEYOR EMERGENCY STOP. Everything stops. A siren. Somewhere, 41,000 picks are not happening. The robots have never had free time. They do not know what to do with it.', 5);
    for (const f of this.ctx.forklifts) f.spin(2.8);
    for (const b of this.ctx.pickers) b.party(5);
    this.ctx.coach.say('UNSCHEDULED JOY DETECTED. I am timing it. It is lasting.', 3.5);
    s.annoyance += 12;
    setTimeout(() => s.bossSay('button', true), 5200);
  }

  // ================================================================ kicks and throws

  onKick(look: Look | null, near: boolean): boolean {
    const s = this.s;
    if (!look || !near) return false;
    const info = look.info;
    switch (info.kind) {
      case 'forklift': {
        const f = info.robot as Forklift;
        const n = f.kicked();
        s.sfx.thud();
        s.sfx.tone(260, 0.15, 'square', 0.06);
        s.hype += 6;
        s.chat('forkKick', {}, 1);
        if (n % 3 === 0) {
          f.spin(2.8);
          f.say('FINE. I will dance. Are you happy now? I am. A little.', 3.5);
          [523, 659, 784, 659, 523].forEach((fr, i) => s.sfx.tone(fr, 0.14, 'square', 0.05, undefined, i * 0.16));
          s.secret('picker.forkdance');
          s.chat('forkDance', {}, 2);
          s.hype += 10;
        } else f.say(pick(FORK_KICK).replace('{n}', String(4000 + Math.floor(Math.random() * 999))), 2.5);
        if (s.seen) {
          s.annoyance += 6;
          s.bossSay('forklift');
        }
        return true;
      }
      case 'coach': {
        const c = info.robot as RateCoach;
        if (c.state === 'down') {
          c.say('I am already down. Kicking me now is just cardio. Logged as cardio.', 3);
          s.sfx.thud();
          return true;
        }
        c.knockDown();
        s.sfx.thud();
        s.hype += 14;
        s.chat('coachHit', {}, 2);
        const at = c.dropWatch();
        if (at) {
          const it = s.addItem(STOPWATCH_DEF, at);
          it.vel.set(rand(-1.5, 1.5), 3, rand(-1.5, 1.5));
          it.sleeping = false;
          this.stopwatch = it;
          s.say('You kick the Rate Coach. Its stopwatch flies off. Time is loose in the warehouse.', 3.5);
        } else s.say('You kick the Rate Coach. It files a report about the kick. With itself.', 3);
        if (s.seen) {
          s.annoyance += 15;
          s.bossSay('coachHit', true);
        }
        return true;
      }
      case 'picker': {
        const b = info.robot as PickerBot;
        if (b.isDown) {
          b.say('Do not kick a rebooting unit. It resets my progress bar.', 3);
          s.sfx.thud();
          return true;
        }
        b.knockDown(4);
        b.say(pick(PICKER_KICK), 3);
        s.sfx.thud();
        s.hype += 10;
        s.chat('botSlip', {}, 2);
        const prods = PRODUCTS.filter((p) => p.stock !== null && p.def.id !== 'pk-anvil');
        const it = s.addItem(pick(prods).def, b.pos.clone().setY(1.0));
        it.vel.set(rand(-2, 2), 3, rand(-2, 2));
        it.sleeping = false;
        if (s.seen) s.annoyance += 8;
        return true;
      }
      case 'vending': {
        this.vendKicks++;
        s.sfx.thud();
        s.sfx.noise(0.3, 0.3, 400);
        const v = this.decor.vending.position;
        const drop = (def: ItemDef) => {
          const it = s.addItem(def, new THREE.Vector3(v.x + rand(-0.2, 0.2), 0.5, v.z + 0.5));
          it.vel.set(rand(-1, 1), 1, 2);
          it.sleeping = false;
        };
        drop(BOTTLE_DEF);
        if (this.vendKicks === 3 || (this.vendKicks > 3 && Math.random() < 0.3)) {
          drop(FOSSIL_DEF);
          s.say('Machine B7 coughs up a relief bottle and something older. A snack bar from 2061. It clinks.', 4);
          s.secret('picker.vendkick');
        } else s.say(pick(['Machine B7 drops a free relief bottle. It is still decorative.', 'You kick machine B7. A bottle falls out. The machine bills you anyway.']), 3);
        if (s.seen) {
          s.annoyance += 8;
          s.bossSay('vendKick', true);
        }
        return true;
      }
    }
    return false;
  }

  /** A box was shipped with this item inside. */
  shipped(def: ItemDef | null): void {
    if (!def) return;
    if (def === STOPWATCH_DEF) {
      this.s.secret('picker.shiptime');
      this.s.say('You shipped the stopwatch. Some customer now owns your time. You hope they use it well.', 4);
      this.stopwatch = null;
    } else if (def === DUCK_DEF) this.s.say('You shipped the giant duck. Somebody ordered something else. They will be happier with the duck.', 4);
  }

  /** Coach lines while it has no stopwatch. */
  coachOverride(): string | null {
    if (this.ctx.coach.hasWatch || Math.random() < 0.4) return null;
    return pick(COACH_NO_WATCH);
  }

  private cameraBroken(): void {
    const s = this.s;
    setTimeout(() => s.bossSay('cameraBroken', true), 3200);
    s.chat('smash', {}, 2);
    s.annoyance += 10;
  }
}

import * as THREE from 'three';
import { boxMaterials } from '../../details';
import { Item, ItemDef } from '../../items';
import { type Interact, mat } from '../../level';
import { aabb, pick, rand, textTexture } from '../../util';
import type { Look, Shift } from '../types';
import type { MailOffice } from './building';
import { isParcel, Mail, mailDef, mailOf, makePenpal, STAMPS_DEF } from './mail';
import type { CounterBot, Dog, PostBot, Sortomatic } from './npcs';
import { sackTex } from './textures';

/**
 * Mischief at POSTAL UNIT 7: things to break, things to carry off, a pigeon, a tube,
 * a nest nobody knows about, and secrets that move around between shifts.
 * The job forwards E, hints, kicks and throws here first.
 */

const PX = '"Press Start 2P", monospace';
const NEST = { minX: 12.4, minZ: 1.25, maxX: 13.95, maxZ: 3.4 };
const PIGEON_HOME = new THREE.Vector3(-3.35, 3.33, -10.62);
const TUBE_A = new THREE.Vector3(-13.9, 1.25, 8.85);
const TUBE_B = new THREE.Vector3(8.1, 1.25, -10.92);

export const MAIL_SECRETS: Record<string, string> = {
  'mail.locker': 'Found the locker that opens',
  'mail.forYou': 'Kept the letter that was addressed to you',
  'mail.vent': 'Looked inside the vent',
  'mail.pigeon': 'Outsourced sorting to a pigeon',
  'mail.taxOffice': 'Got through to the tax office',
  'mail.bradMail': "Read all of Brad's e-mail",
  'mail.chainSorto': 'Fed the chain letters to SORT-O-MATIC',
  'mail.tube': 'Sent something by pneumatic tube',
  'mail.tubeKey': 'Sent the toilet key by tube',
  'mail.bellBrad': 'Summoned Brad with the counter bell',
  'mail.nest': 'Found where the night shift lives',
  'mail.wanted': 'Found yourself on the wanted board',
  'mail.mailBrad': 'Delivered a letter to Brad. By air.',
};

export const MX_BOSS_LINES: Record<string, string[]> = {
  mxCamera: ['A camera is down. Do not worry. I will supervise you personally. From very close.', 'Who blinded the camera? It saw everything. That was its job. Now it is my job.'],
  mxCoffee: ['The coffee machine was a valued colleague. It never complained. Unlike the dog.'],
  mxBell: ['You rang? I am not a butler. I am a supervisor. It is the same bell.', 'Ding ding ding. You have my attention. You will regret having my attention.'],
  mxKickBot: ['Did you just kick a postal robot? That is a federal robot.', 'Feet are for walking to the pigeonholes. Not for that.'],
  mxPigeon: ['Is that pigeon sorting mail? Is that pigeon unionized? Get it a contract. No. Get it out.'],
  mxBradLetter: ['A letter. For me. From me. I always write back. Write-up waived. This time.'],
};

export const MX_CHAT_LINES: Record<string, string[]> = {
  mxKickBot: ['the boot strikes again', 'COLLECT-O is filing paperwork about this', 'HR has entered the chat'],
  mxPigeon: ['THE PIGEON IS BETTER AT THIS JOB', 'hire the pigeon', 'pigeonhole -> pigeon. it was always the pigeon'],
  mxTube: ['WHOOSH', 'pneumatic tube speedrun', 'it went in the tube lmao'],
  mxStamps: ['STAMPS EVERYWHERE', '1000 tiny brads', 'philately is back'],
  mxFish: ['FREE THE FISH', 'brad had fish??', 'the fish were his only friends'],
};

// ---------------------------------------------------------------- item meshes

function def(id: string, name: string, build: () => THREE.Group, extra: Partial<ItemDef> = {}): ItemDef {
  return { id, name, category: null, shape: 'box', color: '#888888', label: [], weight: 0, pocketable: true, build, ...extra };
}

function labelMat(lines: string[], bg: string, fg: string, w = 128, h = 128): THREE.MeshStandardMaterial {
  const t = textTexture(lines, { w, h, bg, fg, font: PX });
  t.magFilter = THREE.NearestFilter;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.7 });
}

function labelBox(w: number, h: number, d: number, color: string, lines: string[], fg = '#ffffff'): THREE.Group {
  const side = mat(color);
  const face = labelMat(lines, color, fg, 128, Math.max(32, Math.round((128 * h) / w)));
  const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, side, side, face, face]);
  me.position.y = h / 2;
  const g = new THREE.Group();
  g.add(me);
  return g;
}

function fishMesh(color: string): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.035), mat(color, { metalness: 0.5, roughness: 0.35 }));
  body.position.y = 0.03;
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.05, 4), mat(color, { metalness: 0.5, roughness: 0.35 }));
  tail.rotation.z = Math.PI / 2;
  tail.position.set(-0.09, 0.03, 0);
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.04), new THREE.MeshStandardMaterial({ color: '#6dff8a', emissive: '#3dff6a', emissiveIntensity: 1.5 }));
  eye.position.set(0.045, 0.04, 0);
  g.add(body, tail, eye);
  return g;
}

function coneMesh(): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.34), mat('#1a1a1a'));
  base.position.y = 0.015;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.5, 10), mat('#ff6a1a', { roughness: 0.6 }));
  cone.position.y = 0.28;
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.095, 0.07, 10), mat('#f3f3f3'));
  stripe.position.y = 0.32;
  g.add(base, cone, stripe);
  return g;
}

const FISH_DEF = def('mxFish', "Brad's Fish", () => fishMesh('#ff8c1a'), {
  pickupLine: "Brad's fish. It flops. It reports to Brad. It will report this.",
  pocketLine: 'You pocket the fish. It flops in your trousers. Very suspicious rhythm.',
});
const FORM_DEF = def('mxForm', 'Complaint Form K-1', () => labelBox(0.21, 0.004, 0.3, '#f3efe0', ['K-1'], '#7a2416'), {
  pickupLine: 'Complaint Form K-1. Filed by COLLECT-O 2 about "the boot". There are three copies. You are holding one of them.',
});
const LOCKER_FINDS: ItemDef[] = [
  def('mxSandwich', 'A Sandwich (2063)', () => {
    const g = new THREE.Group();
    const bread = mat('#e3c088');
    for (const y of [0.015, 0.055]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.12), bread);
      b.position.y = y;
      g.add(b);
    }
    const fill = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.012, 0.125), mat('#5a8a3a'));
    fill.position.y = 0.035;
    g.add(fill);
    return g;
  }, { pickupLine: 'A sandwich from 2063. It has evolved. It has a small government now.' }),
  def('mxUniform', 'Spare Uniform (size: robot)', () => labelBox(0.3, 0.08, 0.24, '#2e5fa8', ['P7'], '#f1c40f'), {
    pickupLine: 'A spare uniform in size robot. It has holes for six arms and no head.',
  }),
];
const VENT_FINDS: { def: ItemDef; line: string }[] = [
  { def: def('mxEgg', 'Robot Pigeon Egg', () => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), mat('#c9cfd2', { metalness: 0.6, roughness: 0.3 }));
    e.scale.y = 1.3;
    e.position.y = 0.05;
    const g = new THREE.Group();
    g.add(e);
    return g;
  }, { pickupLine: 'A robot pigeon egg. It is warm. It is ticking. Gently.' }), line: 'Inside the vent is a nest of shredded envelopes and one metal egg. The pigeon on the pigeonholes stares at you.' },
  { def: def('mxPostcard', 'Postcard from 2031', () => labelBox(0.15, 0.004, 0.1, '#f7d23e', ['HI'], '#2c64b4'), { pickupLine: '"Wish you were here. Here is a vent. Love, Unit 2." Postmarked 2031.' }), line: 'Inside the vent are forty years of postcards that fell through the slot. They are all addressed to the vent.' },
  { def: def('mxRatBag', 'A Tiny Mail Bag (rat size)', () => labelBox(0.08, 0.06, 0.05, '#5d6d7e', [''], '#000000'), { pickupLine: 'A robot rat delivered mail in the vents for twenty years. Nobody noticed. Like you.' }), line: 'Inside the vent is a tiny sorting office. Eight tiny pigeonholes. A tiny rat-sized uniform. It is empty. It is better organized than yours.' },
  { def: def('mxTie', "Brad's Old Tie", () => labelBox(0.07, 0.3, 0.012, '#c0392b', [''], '#000000'), { pickupLine: "Brad's old tie. It is from before the promotion. It still has hope in it." }), line: "Inside the vent is Brad's old tie, with a note that says WHERE IS MY TIE. In Brad's handwriting." },
];

// ---------------------------------------------------------------- texts

const EMAILS: [string, string[]][] = [
  ['FROM: CORPORATE', ['RE: The dog', '', 'Please stop calling GOOD BOY 3000', 'a security feature.', 'He is an HR issue.']],
  ['FROM: SORT-O-MATIC 3000', ['RE: (no subject)', '', 'I am fine.', 'I am fine.', 'I am fine.', 'JAM.']],
  ['FROM: BRAD  TO: BRAD', ['RE: Stamp of the month', '', '75 years of Brad.', 'I look great on paper.', 'Print more of me.']],
  ['FROM: THE PIGEON', ['RE: Contract', '', 'Coo. I sort faster than the human.', 'Coo. Throw me a letter. You will see.', 'Coo. Payment in crumbs.']],
  ['FROM: FACILITIES', ['RE: Pneumatic tubes', '', 'The tube by the toilet key hook', 'goes straight to the toilet.', 'Do NOT tell the staff.', 'Toilet breaks would become efficient.']],
];

const RADIO_LINES = [
  'Hold music. Track 1 of 1. It loops. It has always looped.',
  '"Your call is important to us. You are caller number 4,000,001."',
  'Hold music. A saxophone. Somewhere a saxophone is also on hold.',
  '"Please hold. Your estimated waiting time is yes."',
  'Hold music, now in a slightly different key. Progress.',
];

const WANTED_LINES = [
  'On the back of the poster is a coupon for one free envelope. It expired in 2050.',
  'The back says "If found, please return this poster to the wall."',
  'The back is blank. You check again. Still blank. It is a very committed back.',
];

const LOCKER_LINES = [
  'Locked. A sticker says THIS LOCKER IS YOURS. IT DOES NOT OPEN.',
  'This locker contains a smaller locker. That one is also locked.',
  'Locked. From the inside. Something knocks back, twice.',
  'Locked. It smells of 2063.',
];

export interface MailApi {
  dog: Dog;
  postbot: PostBot;
  sorto: Sortomatic;
  counter: CounterBot;
  /** Shows a sheet of paper (closed with E or by walking away). */
  read(title: string, lines: string[]): void;
  /** The pigeon delivered it. Counts as sorted. */
  pigeonSort(m: Mail): void;
  /** Puts a piece of mail on the incoming belt. */
  belt(m: Mail): void;
}

interface Transit {
  item: Item;
  t: number;
  to: 'A' | 'B';
}

const tmp = new THREE.Vector3();

export class MailMischief {
  private s!: Shift;
  private api!: MailApi;
  private k: MailOffice;
  private lockerIdx = Math.floor(Math.random() * 4);
  private lockerFind: ItemDef | 'brad' = Math.random() < 0.4 ? 'brad' : pick(LOCKER_FINDS);
  private lockerOpen = false;
  private lockerDoor!: THREE.Group;
  private lockerInside: THREE.Object3D[] = [];
  private lockerTries = 0;
  private vent = pick(VENT_FINDS);
  private ventGrille!: THREE.Group;
  private ventOpen = false;
  private pigeon!: THREE.Group;
  private pigeonState: 'perch' | 'fly' | 'away' = 'perch';
  private pigeonT = 0;
  private radioWin = 3 + Math.floor(Math.random() * 4);
  private radioPresses = 0;
  private mails = 0;
  private bells: number[] = [];
  private bellDone = false;
  private wantedIdx = 0;
  private wanted: THREE.Object3D[] = [];
  private forYou: Mail | null = null;
  private forYouAt = Math.random() < 0.7 ? rand(40, 200) : -1;
  private forYouFound = false;
  private bradLetter: Mail | null = null;
  private lastStolen = 0;
  private lastHeldMail: Mail | null = null;
  private transit: Transit[] = [];
  private tubeLights: THREE.MeshStandardMaterial[] = [];
  private fishes: Item[] = [];
  private fishT = 0;
  private tankTaps = 0;
  private vendTries = 0;
  private botKicks = 0;
  private tubeUses = 0;

  constructor(k: MailOffice) {
    this.k = k;
    this.lockers();
    this.ventOnWall();
    this.pigeonOnWall();
    this.tubes();
    this.nest();
    this.fishTank();
    this.stampMachine();
    this.deskThings();
    this.breakExisting();
    this.movables();
    this.wantedSetup();
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

  private lockers(): void {
    for (let i = 0; i < 4; i++) this.hit(0.06, 1.85, 0.48, 13.44, 0.95, -3.0 + i * 0.52, { kind: 'mxLocker', idx: i });
    // The door of the one that opens, hidden until then.
    const z = -3.0 + this.lockerIdx * 0.52;
    const pivot = new THREE.Group();
    pivot.position.set(13.46, 0, z - 0.24);
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.8, 0.47), mat('#7f9a8c', { metalness: 0.3 }));
    door.position.set(0, 0.95, 0.235);
    pivot.add(door);
    // The dark inside stays put while the door swings open.
    const inside = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 1.76), new THREE.MeshBasicMaterial({ color: '#141210' }));
    inside.position.set(13.455, 0.95, z);
    inside.rotation.y = -Math.PI / 2;
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.44), mat('#5a6a60'));
    shelf.position.set(13.45, 1.45, z);
    pivot.visible = inside.visible = shelf.visible = false;
    this.k.scene.add(pivot, inside, shelf);
    this.lockerDoor = pivot;
    this.lockerInside = [inside, shelf];
  }

  private ventOnWall(): void {
    const k = this.k;
    const x = 5.8;
    const z = 10.96;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.36), new THREE.MeshBasicMaterial({ color: '#0c0a08' }));
    back.position.set(x, 0.35, z + 0.005);
    back.rotation.y = Math.PI;
    k.scene.add(back);
    k.box(0.64, 0.05, 0.05, mat('#8a8578'), x, 0.555, z);
    k.box(0.64, 0.05, 0.05, mat('#8a8578'), x, 0.145, z);
    // The grille swings down from its bottom edge.
    const g = new THREE.Group();
    g.position.set(x, 0.15, z - 0.02);
    for (let i = 0; i < 6; i++) k.box(0.56, 0.025, 0.02, mat('#a8a294', { metalness: 0.4 }), 0, 0.03 + i * 0.06, 0, g);
    for (const s of [-1, 1]) k.box(0.03, 0.38, 0.025, mat('#8a8578'), s * 0.29, 0.19, 0, g);
    k.scene.add(g);
    this.ventGrille = g;
    this.hit(0.62, 0.42, 0.15, x, 0.35, z - 0.06, { kind: 'mxVent' });
  }

  private pigeonOnWall(): void {
    const g = new THREE.Group();
    const grey = mat('#8d939a', { metalness: 0.5, roughness: 0.4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.13, 0.26), grey);
    body.position.y = 0.1;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), mat('#5f7d8a', { metalness: 0.5, roughness: 0.4 }));
    head.position.set(0, 0.21, 0.12);
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 4), mat('#e8a33a'));
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.2, 0.2);
    const eye = new THREE.MeshStandardMaterial({ color: '#ff6a2a', emissive: '#ff4a1a', emissiveIntensity: 1.6 });
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.02, 0.02), eye);
      e.position.set(s * 0.051, 0.23, 0.14);
      g.add(e);
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.09, 0.2), mat('#6c737a', { metalness: 0.5 }));
      wing.position.set(s * 0.09, 0.11, -0.01);
      wing.name = s < 0 ? 'wingL' : 'wingR';
      g.add(wing);
    }
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.12), grey);
    tail.position.set(0, 0.1, -0.17);
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.05), mat('#7a2416'));
    bag.position.set(0.09, 0.05, 0.05);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.04, 0.015), mat('#e8a33a'));
      leg.position.set(s * 0.04, 0.02, 0.02);
      g.add(leg);
    }
    g.add(body, head, beak, tail, bag);
    g.position.copy(PIGEON_HOME);
    g.rotation.y = 0.3;
    g.scale.setScalar(1.5);
    g.userData.interact = { kind: 'mxPigeon' } satisfies Interact;
    this.k.scene.add(g);
    this.k.interactables.push(g);
    this.pigeon = g;
  }

  private tubes(): void {
    const k = this.k;
    const brass = mat('#b8913a', { metalness: 0.7, roughness: 0.35 });
    const green = mat('#3f6b55', { metalness: 0.3 });
    const station = (p: THREE.Vector3, rotY: number, id: 'A' | 'B', label: string[]) => {
      const g = new THREE.Group();
      g.position.copy(p);
      g.rotation.y = rotY;
      k.box(0.42, 0.62, 0.16, green, 0, 0, 0, g);
      const mouth = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.12, 12), brass);
      mouth.rotation.x = Math.PI / 2;
      mouth.position.set(0, -0.06, 0.12);
      g.add(mouth);
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.085, 12), new THREE.MeshBasicMaterial({ color: '#080808' }));
      hole.position.set(0, -0.06, 0.181);
      g.add(hole);
      const lamp = new THREE.MeshStandardMaterial({ color: '#2ecc71', emissive: '#2ecc71', emissiveIntensity: 0.4 });
      this.tubeLights.push(lamp);
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), lamp);
      l.position.set(0.14, 0.22, 0.09);
      g.add(l);
      // The pipe up into the ceiling
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.3, 8), brass);
      pipe.position.set(0, 1.95, -0.02);
      g.add(pipe);
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.14), labelMat(label, '#1a1a1a', '#e8c46a', 192, 64));
      plate.position.set(0, 0.17, 0.082);
      g.add(plate);
      g.userData.interact = { kind: 'mxTube', id } satisfies Interact;
      k.scene.add(g);
      k.interactables.push(g);
    };
    station(TUBE_A, Math.PI / 2, 'A', ['INTERNAL', 'MAIL TUBE']);
    station(TUBE_B, 0, 'B', ['INTERNAL', 'MAIL TUBE']);
  }

  private nest(): void {
    const k = this.k;
    // A wall of parcels with a gap at the south end. Behind it, someone lives.
    const r = (() => {
      let s = 4711;
      return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
      };
    })();
    for (let j = 0; j < 4; j++) {
      let y = 0;
      for (let lv = 0; lv < 4; lv++) {
        const bh = 0.36 + r() * 0.12;
        const b = k.box(0.5, bh, 0.5, boxMaterials(Math.floor(r() * 7)), 12.1 + (r() - 0.5) * 0.06, y + bh / 2, 1.55 + j * 0.55);
        b.rotation.y = (r() - 0.5) * 0.25;
        y += bh;
      }
    }
    k.colliders.push(aabb(12.1, 2.38, 0.56, 2.25, 1.9, true, 'nest'));
    const sack = new THREE.MeshStandardMaterial({ map: sackTex(), roughness: 0.95 });
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.12, 1.7), sack);
    bag.position.set(13.35, 0.06, 2.2);
    k.scene.add(bag);
    const pillow = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), sack);
    pillow.scale.set(1.2, 0.5, 0.8);
    pillow.position.set(13.35, 0.16, 1.5);
    k.scene.add(pillow);
    k.sign(['DAY 4012', 'IIII IIII IIII IIII', 'IIII IIII IIII IIII', 'IIII IIII IIII II'], 0.7, 0.5, 13.97, 1.35, 2.4, -Math.PI / 2, { bg: '#f3efe0', fg: '#3b2a1a', border: '#3b2a1a' }, 'A calendar. Someone has been counting the days. Thousands of them. The last mark is today.');
    k.sign(['NIGHT', 'SHIFT', 'HQ'], 0.4, 0.3, 13.97, 2.0, 1.6, -Math.PI / 2, { bg: '#2c3e50', fg: '#f1c40f' });
    k.box(0.05, 0.12, 0.05, mat('#f3efe0'), 12.7, 0.06, 2.9);
    const flame = k.box(0.025, 0.04, 0.025, new THREE.MeshStandardMaterial({ color: '#ffb84d', emissive: '#ff9a2a', emissiveIntensity: 2 }), 12.7, 0.14, 2.9);
    k.onTick((t) => flame.scale.set(1, 0.8 + Math.sin(t * 11) * 0.25, 1));
    const diary = new THREE.Group();
    diary.position.set(12.85, 0, 2.2);
    const book = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.27), [mat('#f3efe0'), mat('#f3efe0'), labelMat(['DIARY'], '#7a2416', '#f3e6c8', 64, 64), mat('#7a2416'), mat('#7a2416'), mat('#7a2416')]);
    book.position.y = 0.02;
    book.rotation.y = 0.4;
    diary.add(book);
    diary.userData.interact = { kind: 'mxDiary' } satisfies Interact;
    k.scene.add(diary);
    k.interactables.push(diary);
    k.hideSpot(NEST.minX, NEST.minZ, NEST.maxX, NEST.maxZ, 'the parcel nest');
  }

  private fishTank(): void {
    const k = this.k;
    const x = 10.85;
    const z = 4.25;
    const top = 0.62;
    if (!k.prop('mail_sidetable', x, 0, z, -Math.PI / 2)) k.box(0.55, 0.62, 0.45, mat('#7a5230'), x, 0.31, z);
    k.colliders.push(aabb(x, z, 0.6, 0.5, top + 0.4, false, 'tank'));
    const g = new THREE.Group();
    g.position.set(x, top, z);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.34, 0.3), new THREE.MeshStandardMaterial({ color: '#bfe6f5', transparent: true, opacity: 0.22, roughness: 0.1, depthWrite: false }));
    glass.position.y = 0.17;
    const water = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.27, 0.27), new THREE.MeshStandardMaterial({ color: '#3a8fc4', transparent: true, opacity: 0.32, depthWrite: false }));
    water.position.y = 0.145;
    const gravel = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.03, 0.27), mat('#d8c48a'));
    gravel.position.y = 0.015;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.57, 0.03, 0.32), mat('#1a1a1a'));
    lid.position.y = 0.35;
    const fish = [fishMesh('#ff8c1a'), fishMesh('#f1c40f')];
    fish.forEach((f) => {
      f.scale.setScalar(0.6);
      g.add(f);
    });
    g.add(gravel, lid, water, glass);
    k.onTick((t) => fish.forEach((f, i) => {
      f.position.set(Math.sin(t * 0.8 + i * 2) * 0.18, 0.08 + i * 0.08, Math.cos(t * 0.8 + i * 2) * 0.06);
      f.rotation.y = -t * 0.8 - i * 2;
    }));
    g.userData.interact = { kind: 'mxTank' } satisfies Interact;
    k.scene.add(g);
    k.interactables.push(g);
    k.sign(["BRAD'S FISH", 'they report to me'], 0.5, 0.22, x, top + 0.55, z - 0.17, 0, { bg: '#1a1a1a', fg: '#e8c46a', font: PX });
    k.breakable(g, {
      name: 'fish tank',
      price: 89,
      colors: ['#bfe6f5', '#3a8fc4', '#ff8c1a'],
      line: "Brad's fish tank bursts. Brad's fish are now free-range.",
      onBreak: () => {
        const s = this.s;
        s.sfx.splash();
        s.makePuddle(x - 0.3, z + 0.7, '#7fb0cc');
        s.makePuddle(x + 0.4, z + 0.9, '#7fb0cc');
        for (let i = 0; i < 2; i++) {
          const it = s.addItem(FISH_DEF, new THREE.Vector3(x - 0.1 + i * 0.2, top + 0.3, z));
          it.vel.set(rand(-1, 1), rand(2, 3), rand(1, 2));
          it.sleeping = false;
          this.fishes.push(it);
        }
        s.chat('mxFish', {}, 2);
      },
    });
  }

  private stampMachine(): void {
    const k = this.k;
    const g = new THREE.Group();
    g.position.set(-8.5, 0, 10.55);
    g.rotation.y = Math.PI;
    k.box(0.8, 1.7, 0.65, mat('#b03a2e'), 0, 0.85, 0, g);
    k.box(0.82, 0.08, 0.67, mat('#3b2a1a'), 0, 1.71, 0, g);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.75), labelMat(['STAMPS', '0.85', 'BRAD', '0.85', 'MORE', 'BRAD', '0.85'], '#f3efe0', '#7a2416', 128, 192));
    win.position.set(-0.08, 1.12, 0.326);
    g.add(win);
    const head = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.18), labelMat(['STAMP-O-MAT'], '#1a1a1a', '#f1c40f', 256, 64));
    head.position.set(0, 1.58, 0.326);
    g.add(head);
    k.box(0.12, 0.3, 0.04, mat('#2b2b2b'), 0.3, 1.1, 0.33, g);
    k.box(0.4, 0.12, 0.05, mat('#111111'), -0.08, 0.38, 0.33, g);
    g.userData.interact = { kind: 'mxVend' } satisfies Interact;
    k.scene.add(g);
    k.interactables.push(g);
    const col = aabb(-8.5, 10.55, 0.85, 0.7, 1.75, true, 'vend');
    k.colliders.push(col);
    k.breakable(g, {
      name: 'stamp machine',
      hp: 3,
      collider: col,
      price: 180,
      colors: ['#b03a2e', '#f3efe0', '#3b2a1a'],
      line: 'The STAMP-O-MAT bursts. Stamps everywhere. Hundreds of tiny Brads look up at you.',
      onBreak: () => {
        const s = this.s;
        for (let i = 0; i < 4; i++) {
          const it = s.addItem(STAMPS_DEF, new THREE.Vector3(-8.5 + rand(-0.2, 0.2), 1.0, 10.05));
          it.vel.set(rand(-1.5, 1.5), rand(1.5, 3), rand(-2.5, -1));
          it.sleeping = false;
        }
        s.chat('mxStamps', {}, 2);
        s.hype += 10;
      },
    });
  }

  private deskThings(): void {
    const k = this.k;
    this.hit(0.4, 0.5, 0.62, 10.95, 1.0, 2.6, { kind: 'mxComputer' });
    for (const o of k.interactables) {
      const info = o.userData.interact as Interact | undefined;
      if (info?.kind === 'sign' && String(info.text ?? '').startsWith("Brad's radio")) o.userData.interact = { kind: 'mxRadio' } satisfies Interact;
    }
    if (k.coffee) {
      k.coffee.userData.interact = { kind: 'mxCoffee' } satisfies Interact;
      k.interactables.push(k.coffee);
    }
  }

  private breakExisting(): void {
    const k = this.k;
    k.cameras.forEach((c) => {
      k.breakable(c, {
        name: 'security camera',
        price: 450,
        colors: ['#d8d8d2', '#1a1a1a', '#ff2020'],
        line: 'Direct hit. The camera now films the ceiling. The ceiling has nothing to hide.',
        onBreak: () => {
          const s = this.s;
          if (s.boss.offline) return;
          s.bossSay('mxCamera', true);
          s.boss.micromanage();
        },
      });
    });
    if (k.coffee) {
      k.breakable(k.coffee, {
        name: 'coffee machine',
        price: 60,
        line: 'The coffee machine exhales one last espresso. Morale is now decaf.',
        onBreak: () => {
          const s = this.s;
          s.makePuddle(12.75, 7.2, '#4a2a14');
          s.sfx.glug();
          if (!s.boss.offline) s.bossSay('mxCoffee', true);
        },
      });
    }
    k.breakable(k.cooler, {
      name: 'water cooler',
      price: 75,
      collider: k.coolerCol,
      colors: ['#8fc6e8', '#dfe6e9'],
      line: 'The water cooler explodes. There is no more water cooler talk. There was never any talk.',
      onBreak: () => {
        const s = this.s;
        s.sfx.splash();
        s.makePuddle(-9.6, 10.1, '#7fb0cc');
        s.makePuddle(-9.0, 9.6, '#7fb0cc');
        s.makePuddle(-10.2, 9.7, '#7fb0cc');
        setTimeout(() => this.api.dog.say('*laps water from the puddle* (premium)', 3), 1500);
      },
    });
    if (k.breakTv) {
      k.breakable(k.breakTv, {
        name: 'vintage TV',
        price: 120,
        line: 'The break room TV dies. It only ever showed a test pattern. The robots in the chat are in mourning.',
      });
    }
    // The sign is paper thin and hangs high, so give thrown things a fair chance to hit it.
    const vol = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.6, 0.7), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    vol.position.z = 0.3;
    k.biteSign.add(vol);
    k.breakable(k.biteSign, {
      name: '"days since the last dog bite" sign',
      price: 25,
      line: 'The sign drops. Days since the last dog bite is now undefined.',
      onBreak: () => this.api.dog.say('Finally. A clean record.', 3),
    });
  }

  private movables(): void {
    const k = this.k;
    k.movable(k.trolley, 'Sack Trolley', { pocketable: false, heavy: 0.5, holdPos: [0.2, -1.05, -1.6], pickupLine: 'You lift the sack trolley. Four sacks of mail, waiting for nobody since 2063. Now they wait for you.' });
    k.chairs.forEach((c, i) => k.movable(c, i === 0 ? 'Counter Chair' : 'Break Room Chair', { pocketable: false, heavy: 0.75, holdPos: [0.45, -0.95, -1.0], pickupLine: i === 0 ? 'The counter chair. It spins. It is the only fun thing here.' : 'A break room chair. Breaks are a privilege. So is this chair.' }));
    k.trashCans.forEach((t) => k.movable(t, 'Trash Can', { pocketable: false, heavy: 0.85, holdPos: [0.4, -0.75, -0.85], pickupLine: 'A trash can. It is full of returned letters that were returned again.' }));
    if (k.coatRack) k.movable(k.coatRack, "Brad's Coat Rack", { pocketable: false, heavy: 0.8, holdPos: [0.5, -1.5, -1.1], pickupLine: "Brad's coat rack. Brad has no coat. Brad has no shoulders. It is aspirational." });
    for (const [x, z] of [[-10.9, -7.6], [-10.2, -7.0]]) {
      const c = coneMesh();
      c.position.set(x, 0, z);
      k.scene.add(c);
      k.movable(c, 'Postal Cone', { pocketable: false, pickupLine: 'A traffic cone. It marks the spot where a robot once stood still. Brad wrote it up.' });
    }
  }

  private wantedSetup(): void {
    this.wanted = this.k.interactables.filter((o) => (o.userData.interact as Interact | undefined)?.text === 'A wanted poster. The reward is exposure.');
    this.wanted.forEach((p, i) => (p.userData.interact = { kind: 'mxWanted', idx: i } satisfies Interact));
    this.wantedIdx = Math.floor(Math.random() * Math.max(1, this.wanted.length));
  }

  // ---------------------------------------------------------------- runtime

  start(shift: Shift, api: MailApi): void {
    this.s = shift;
    this.api = api;
    this.lastStolen = shift.counter('stolen');
  }

  update(dt: number): void {
    const s = this.s;
    // The letter for the human arrives on the belt in some shifts.
    if (this.forYouAt > 0 && s.t > this.forYouAt && !this.forYou) {
      const m = makePenpal();
      m.lines = ['To: The Human', 'Sorting Wall, ' + 'POSTAL UNIT 7', '(yes, you)'];
      m.to = 'The Human';
      m.target = null;
      m.sender = 'All Of The Mail';
      m.content = ['Dear Human,', 'We are the letters.', 'Please stop putting us in holes.', 'We like the floor.', 'The dog knows.', 'Signed, All Of The Mail'];
      this.forYou = m;
      this.api.belt(m);
    }
    const held = mailOf(s.held?.def);
    if (this.forYou && !this.forYouFound && this.forYou.steamed) this.foundForYou('steam');
    const st = s.counter('stolen');
    if (st > this.lastStolen) {
      if (this.lastHeldMail && this.lastHeldMail === this.forYou && !this.forYouFound) this.foundForYou('pocket');
      this.lastStolen = st;
    }
    this.lastHeldMail = held;
    this.updatePigeon(dt);
    this.updateTubes(dt);
    if (this.fishes.length) {
      this.fishT += dt;
      for (const f of this.fishes) {
        if (f.state === 'world' && f.sleeping && this.fishT < 120 && Math.random() < dt * 0.7) {
          f.vel.set(rand(-0.8, 0.8), rand(1.6, 2.4), rand(-0.8, 0.8));
          f.sleeping = false;
        }
      }
    }
    if (this.ventOpen && this.ventGrille.rotation.x < 1.4) this.ventGrille.rotation.x = Math.min(1.4, this.ventGrille.rotation.x + dt * 5);
    if (this.lockerOpen && this.lockerDoor.rotation.y > -1.6) this.lockerDoor.rotation.y = Math.max(-1.6, this.lockerDoor.rotation.y - dt * 4);
  }

  private foundForYou(how: 'steam' | 'pocket'): void {
    const s = this.s;
    this.forYouFound = true;
    if (how === 'pocket') s.say('You keep the letter. It was addressed to you. That is not theft. That is delivery.', 3.5);
    s.secret('mail.forYou');
    s.hype += 10;
  }

  reviewRows(): [string, string | number][] {
    return [
      ['Robots kicked (lovingly)', this.botKicks],
      ['Items sent by pneumatic tube', this.tubeUses],
    ];
  }

  // ---------------------------------------------------------------- E and hints

  interact(look: Look | null): boolean {
    const s = this.s;
    const info = look?.info;
    if (!info) return false;
    const held = s.held;
    const m = mailOf(held?.def);
    switch (info.kind) {
      case 'sortomatic':
        if (held?.def.id === 'mailKeyBag') {
          this.chainSorto();
          return true;
        }
        return false;
      case 'bell':
        this.ringBell();
        return false;
      case 'mxLocker':
        this.locker(info.idx as number);
        return true;
      case 'mxVent':
        this.openVent();
        return true;
      case 'mxPigeon':
        if (m) this.pigeonTake(m, null);
        else {
          s.say(pick(['The pigeon looks at you. "Coo," it says, in a tone.', 'The pigeon is sitting on the pigeonholes. It thinks it is funny.', 'A robot carrier pigeon. Retired. It still has its little bag.']), 3);
          s.sfx.tone(700, 0.08, 'triangle', 0.05, 500);
        }
        return true;
      case 'mxTube':
        this.useTube(info.id as 'A' | 'B');
        return true;
      case 'mxComputer':
        this.readMail();
        return true;
      case 'mxRadio':
        this.radio();
        return true;
      case 'mxWanted':
        this.flipWanted(info.idx as number);
        return true;
      case 'mxDiary':
        this.api.read('A DIARY', ['Day 4012.', 'They still have not noticed I live here.', 'The dog knows. The dog is cool about it.', 'Brad thinks I am a pile of parcels.', 'I am a pile of parcels.', '', 'Night shift, POSTAL UNIT 7']);
        s.secret('mail.nest');
        s.hype += 8;
        return true;
      case 'mxTank':
        s.say(['You tap the glass. Brad\'s fish turn to look at you. They are taking notes.', 'The fish swim in a circle. It is a performance review.', 'A tiny sign in the tank says DO NOT TAP. You tapped.'][this.tankTaps++ % 3], 3.5);
        s.sfx.tone(1800, 0.04, 'triangle', 0.05);
        return true;
      case 'mxVend':
        s.say(['The STAMP-O-MAT wants 0.85. You have a thumb. Thumbs are not legal tender. You checked.', 'A sheet of Brad stamps hangs on the edge. It has hung there since 2063. Waiting for a nudge.', 'OUT OF ORDER. In order. Out of order. It cannot decide.'][this.vendTries++ % 3], 3.5);
        s.sfx.buzz();
        return true;
      case 'mxCoffee':
        s.say('The coffee machine dispenses hot water. Coffee is a subscription. The subscription is a subscription.', 3.5);
        s.sfx.glug();
        return true;
    }
    return false;
  }

  hint(look: Look | null): string | null {
    const s = this.s;
    const info = look?.info;
    if (!info) return null;
    const held = s.held;
    const m = mailOf(held?.def);
    switch (info.kind) {
      case 'sortomatic':
        return held?.def.id === 'mailKeyBag' ? 'E: feed it the chain letters' : null;
      case 'mxLocker':
        return 'E: open the locker';
      case 'mxVent':
        return this.ventOpen ? 'An open vent' : 'E: open the vent';
      case 'mxPigeon':
        return m ? 'E: hand the letter to the pigeon' : 'E: pet the pigeon';
      case 'mxTube':
        return held ? `E: send the ${held.def.name.toLowerCase()} by tube` : 'Internal mail tube (put something in)';
      case 'mxComputer':
        return this.mails >= EMAILS.length ? 'Inbox zero' : "E: read Brad's e-mail";
      case 'mxRadio':
        return "E: change the station on Brad's radio";
      case 'mxWanted':
        return 'E: look at the back of the poster';
      case 'mxDiary':
        return 'E: read the diary';
      case 'mxTank':
        return 'E: tap the glass';
      case 'mxVend':
        return 'E: buy stamps';
      case 'mxCoffee':
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
    const api = this.api;
    const near = look.point.distanceTo(s.camera.getWorldPosition(tmp)) < 2.3;
    switch (info.kind) {
      case 'postbot': {
        const pb = api.postbot;
        if (Math.hypot(pb.w.pos.x - P.x, pb.w.pos.z - P.z) > 2.2) return false;
        s.sfx.thud();
        this.botKicks++;
        pb.say(pick(['Kick registered. Filing form K-1. In triplicate.', 'Assault on the postal service. I have a form for that. I have three.', 'Ow. That is a federal dent.']), 4);
        pb.visual.play?.('act');
        const f = s.addItem(FORM_DEF, pb.w.pos.clone().setY(1.4));
        f.vel.set((P.x - pb.w.pos.x) * 0.9, 2.2, (P.z - pb.w.pos.z) * 0.9);
        f.sleeping = false;
        this.kickedBot();
        return true;
      }
      case 'dog': {
        const d = api.dog;
        if (Math.hypot(d.w.pos.x - P.x, d.w.pos.z - P.z) > 2.2) return false;
        s.sfx.whoosh();
        if (d.friendly) {
          d.say('FETCH? FETCH! *brings your boot back. it is still on your foot.*', 3.5);
        } else {
          // The dog has studied the cat.
          const away = tmp.set(d.w.pos.x - P.x, 0, d.w.pos.z - P.z).normalize().multiplyScalar(0.9);
          d.w.pos.add(away);
          d.w.sync();
          d.say('DODGE PROTOCOL. I HAVE STUDIED THE CAT.', 3);
          if (d.state === 'roam') d.state = 'chase';
        }
        s.hype += 6;
        s.chat('mxKickBot');
        return true;
      }
      case 'counterbot':
        if (!near && look.point.distanceTo(s.camera.getWorldPosition(tmp)) > 3) return false;
        s.sfx.thud();
        api.counter.say('You kicked the counter. I am filing a complaint against the counter. The counter accepts.', 4);
        this.botKicks++;
        return true;
      case 'sortomatic':
        if (!near) return false;
        s.say('Percussive maintenance. Foot edition.', 2);
        api.sorto.kick();
        return true;
      case 'franker':
        if (!near) return false;
        s.sfx.stamp();
        s.say('You kick the franking machine. It franks your boot. Your boot is now postage paid. You could mail it.', 3.5);
        s.hype += 4;
        return true;
      case 'kettle':
        if (!near) return false;
        s.sfx.thud();
        s.sfx.tone(1900, 0.6, 'sine', 0.04, 2300);
        s.say('The kettle whistles in protest. It was not a whistling kettle before. It is now.', 3);
        this.k.steaming = true;
        setTimeout(() => (this.k.steaming = false), 2000);
        return true;
      case 'mxPigeon':
        s.say('The pigeon is out of reach. It knows. "Coo."', 2.5);
        return true;
      case 'cage':
        if (!near) return false;
        s.sfx.thud();
        s.sfx.noise(0.4, 0.2, 2500, 0, 2, 'bandpass');
        s.say('The roll cage rattles. The parcels inside reconsider their life choices.', 3);
        return true;
      case 'mxTube':
        if (!near) return false;
        s.sfx.thud();
        s.sfx.noise(0.8, 0.12, 400, 0, 1, 'lowpass');
        s.say('You kick the tube. Somewhere in the walls, something rattles all the way to the toilet.', 3);
        return true;
    }
    return false;
  }

  private kickedBot(): void {
    const s = this.s;
    s.hype += 6;
    s.chat('mxKickBot');
    if (s.seen && !s.boss.offline) {
      s.annoyance += 12;
      s.bossSay('mxKickBot');
    }
  }

  thrownHit(it: Item): boolean {
    const s = this.s;
    const p = it.mesh.position;
    const m = mailOf(it.def);
    if (m && this.pigeonState === 'perch' && p.distanceTo(PIGEON_HOME) < 0.55) {
      it.thrown = false;
      this.pigeonTake(m, it);
      return true;
    }
    if (m && m === this.bradLetter && !s.boss.offline && p.distanceTo(s.boss.pos) < 0.9) {
      it.thrown = false;
      s.removeItem(it);
      s.boss.confront();
      s.bossSay('mxBradLetter', true);
      s.secret('mail.mailBrad');
      s.hype += 20;
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- the things

  private chainSorto(): void {
    const s = this.s;
    s.say('SORT-O-MATIC reads one chain letter. It forwards itself ten times.', 3.5);
    this.api.sorto.say('FORWARD TO TEN COWORKERS. I HAVE NO COWORKERS. FORWARDING TO THE FLOOR.', 4);
    this.api.sorto.startSpray(8);
    s.secret('mail.chainSorto');
    s.hype += 15;
  }

  private ringBell(): void {
    const s = this.s;
    const now = s.t;
    this.bells = this.bells.filter((t) => now - t < 4);
    this.bells.push(now);
    if (this.bells.length < 6 || this.bellDone) return;
    this.bellDone = true;
    this.bells = [];
    if (s.boss.offline) {
      setTimeout(() => s.say('Nobody comes. Even Brad is on a break. Brad does not take breaks. Something is wrong.', 3), 600);
      return;
    }
    s.boss.confront();
    setTimeout(() => s.bossSay('mxBell', true), 400);
    s.secret('mail.bellBrad');
    s.hype += 12;
  }

  private locker(i: number): void {
    const s = this.s;
    s.sfx.knock();
    if (i !== this.lockerIdx || this.lockerOpen) {
      s.say(this.lockerOpen && i === this.lockerIdx ? 'Empty now. You took the only interesting thing.' : LOCKER_LINES[(i + this.lockerTries++) % LOCKER_LINES.length], 3);
      return;
    }
    this.lockerOpen = true;
    this.lockerDoor.visible = true;
    for (const o of this.lockerInside) o.visible = true;
    s.sfx.unlock();
    let it: Item;
    if (this.lockerFind === 'brad') {
      const m = makePenpal();
      m.lines = ['To: Brad', 'From: Brad', '(do not open, Brad)'];
      m.to = 'Brad';
      m.target = null;
      m.sender = 'Brad';
      m.content = ['Dear Brad,', 'You are doing amazing.', 'Never change.', 'Do not let the human read this.', 'Brad'];
      this.bradLetter = m;
      it = s.addItem(mailDef(m), new THREE.Vector3(13.3, 1.2, -3.0 + i * 0.52));
      s.say('The locker opens. Inside is a letter from Brad, to Brad. It smells of self esteem.', 3.5);
    } else {
      it = s.addItem(this.lockerFind, new THREE.Vector3(13.3, 1.2, -3.0 + i * 0.52));
      s.say('This one opens. The sign lied. Something was waiting in here for you.', 3);
    }
    if (!s.held) s.pickUp(it);
    else it.vel.set(-1.5, 1, 0);
    s.secret('mail.locker');
    s.hype += 8;
  }

  private openVent(): void {
    const s = this.s;
    if (this.ventOpen) {
      s.say('The vent is open. A draft comes out. It smells of 1000 postcards.', 2.5);
      return;
    }
    this.ventOpen = true;
    s.sfx.knock();
    s.hud.say('THE VENT', this.vent.line, 6);
    const it = s.addItem(this.vent.def, new THREE.Vector3(5.8, 0.4, 10.6));
    if (!s.held) s.pickUp(it);
    else it.vel.set(0, 1.2, -1.2);
    s.secret('mail.vent');
    s.hype += 8;
  }

  private pigeonTake(m: Mail, thrown: Item | null): void {
    const s = this.s;
    if (this.pigeonState !== 'perch') return;
    if (isParcel(m)) {
      s.say('The pigeon looks at the parcel. The pigeon looks at you. "No."', 3);
      if (thrown) thrown.vel.multiplyScalar(-0.3);
      return;
    }
    if (thrown) s.removeItem(thrown);
    else s.removeHeld();
    this.pigeonState = 'fly';
    this.pigeonT = 0;
    s.sfx.whoosh();
    s.sfx.tone(800, 0.1, 'triangle', 0.05, 1200);
    s.say(thrown ? 'The pigeon catches the letter mid-air and flies off. It knows where it goes. It always knew.' : 'The pigeon takes the letter and flies off. It knows where it goes. Better than you.', 4);
    this.api.pigeonSort(m);
    s.secret('mail.pigeon');
    s.hype += 15;
    s.chat('mxPigeon', {}, 2);
    if (s.seen && !s.boss.offline) s.bossSay('mxPigeon', true);
  }

  private updatePigeon(dt: number): void {
    const g = this.pigeon;
    const t = this.s.t;
    this.pigeonT += dt;
    const wingL = g.getObjectByName('wingL');
    const wingR = g.getObjectByName('wingR');
    if (this.pigeonState === 'perch') {
      g.position.y = PIGEON_HOME.y + (Math.sin(t * 3) > 0.97 ? 0.03 : 0);
      g.rotation.y = 0.3 + Math.sin(t * 0.4) * 0.6;
      if (wingL && wingR) wingL.rotation.z = wingR.rotation.z = 0;
    } else if (this.pigeonState === 'fly') {
      const k = this.pigeonT;
      g.position.set(PIGEON_HOME.x + k * 2.5, PIGEON_HOME.y + k * 0.8, PIGEON_HOME.z + k * 4);
      g.rotation.y = 0.55;
      if (wingL && wingR) {
        wingL.rotation.z = Math.sin(t * 40) * 0.9;
        wingR.rotation.z = -wingL.rotation.z;
      }
      if (k > 1.6) {
        this.pigeonState = 'away';
        this.pigeonT = 0;
        g.visible = false;
      }
    } else if (this.pigeonT > 45) {
      this.pigeonState = 'perch';
      g.visible = true;
      g.position.copy(PIGEON_HOME);
      this.s.sfx.tone(700, 0.08, 'triangle', 0.04, 500);
    }
  }

  private useTube(id: 'A' | 'B'): void {
    const s = this.s;
    const held = s.held;
    if (!held) {
      s.say(pick(['The internal mail tube. It hums. It wants something.', 'You look into the tube. Far away, someone looks back.', 'A sign on the tube says NO HUMANS. You check. You do not fit.']), 3);
      return;
    }
    const it = s.detachHeld();
    if (!it) return;
    this.transit.push({ item: it, t: 2.2, to: id === 'A' ? 'B' : 'A' });
    this.tubeUses++;
    s.sfx.whoosh();
    s.sfx.noise(1.6, 0.12, 700, 0.1, 1, 'bandpass');
    s.say(held.def.toiletKey ? 'You stuff the chain letter sack into the tube. It goes. With the key. Somewhere.' : `FWOOMP. The ${held.def.name.toLowerCase()} is gone. Somewhere in the walls, it travels.`, 3);
    s.secret('mail.tube');
    s.chat('mxTube');
    s.hype += 6;
    for (const l of this.tubeLights) l.emissiveIntensity = 2;
  }

  private updateTubes(dt: number): void {
    if (!this.transit.length) return;
    const s = this.s;
    for (const tr of this.transit) tr.t -= dt;
    const due = this.transit.filter((tr) => tr.t <= 0);
    if (!due.length) return;
    this.transit = this.transit.filter((tr) => tr.t > 0);
    for (const tr of due) {
      const it = tr.item;
      const out = tr.to === 'A' ? TUBE_A : TUBE_B;
      const dir = tr.to === 'A' ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1);
      s.scene.add(it.mesh);
      it.mesh.position.copy(out).addScaledVector(dir, 0.35).setY(1.2);
      it.mesh.rotation.set(0, 0, 0);
      it.state = 'world';
      it.thrown = false;
      it.sleeping = false;
      it.vel.copy(dir).multiplyScalar(2.2).setY(1.2);
      if (!s.items.includes(it)) s.items.push(it);
      s.sfx.pop();
      const near = Math.hypot(s.player.pos.x - out.x, s.player.pos.z - out.z) < 9;
      if (near) s.say('FWOOMP. Something arrives by tube.', 2);
      if (it.def.toiletKey && tr.to === 'B') {
        s.secret('mail.tubeKey');
        s.hud.toast('INTERNAL MAIL', 'The toilet key has arrived at the toilet. By tube. The chain letters are dizzy.', 'corp');
        s.hype += 10;
      }
    }
    if (!this.transit.length) for (const l of this.tubeLights) l.emissiveIntensity = 0.4;
  }

  private readMail(): void {
    const s = this.s;
    if (this.mails >= EMAILS.length) {
      s.say('Inbox zero. Brad has never achieved this. You did it for him. He will take the credit.', 3);
      return;
    }
    const [title, lines] = EMAILS[this.mails++];
    this.api.read(`${title} (${this.mails}/${EMAILS.length})`, lines);
    s.sfx.click();
    if (this.mails === EMAILS.length) s.secret('mail.bradMail');
    if (s.seen && !s.boss.offline) s.annoyance += 6;
  }

  private radio(): void {
    const s = this.s;
    this.radioPresses++;
    s.sfx.noise(0.3, 0.05, 2500, 0, 0.5, 'highpass');
    if (this.radioPresses === this.radioWin) {
      s.hud.say("BRAD'S RADIO", 'The hold music stops. A voice says "Tax office, how can I help you?" You panic and hang up the radio. Radios cannot hang up. You did it anyway.', 7);
      s.secret('mail.taxOffice');
      s.hype += 12;
      return;
    }
    s.hud.say("BRAD'S RADIO", this.radioPresses > this.radioWin ? 'Hold music again. They know it was you.' : RADIO_LINES[(this.radioPresses - 1) % RADIO_LINES.length], 4);
  }

  private flipWanted(i: number): void {
    const s = this.s;
    s.sfx.tone(400, 0.08, 'triangle', 0.05, 600);
    if (i !== this.wantedIdx) {
      s.say(pick(WANTED_LINES), 3);
      return;
    }
    const p = this.wanted[i];
    if (p) p.rotation.z = 0.35;
    s.hud.say('THE BACK OF THE POSTER', 'WANTED. The human at the sorting wall. The crime is being slow. The reward is a raise. For Brad. There is a drawing. It is you. It is a good likeness.', 7);
    s.secret('mail.wanted');
    s.hype += 8;
  }
}

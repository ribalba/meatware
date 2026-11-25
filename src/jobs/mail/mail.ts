import * as THREE from 'three';
import type { ItemDef } from '../../items';
import { pick } from '../../util';
import * as T from './texts';
import type { PenTarget } from './texts';
import { burlapTex, kraftTex, sackTex, stampSheetTex } from './textures';

/**
 * Letters and parcels: what is written on them, where they belong and how they look.
 * Every piece of mail is its own ItemDef, so the engine can carry, drop, throw and pocket it.
 */

export type MailKind = 'letter' | 'parcel' | 'bad' | 'penpal' | 'self';
export type Postage = 'none' | 'stamp' | 'frank' | 'smudge';
export type Destination = 'cubby' | 'cage' | 'return' | 'dead' | 'counter';

export interface Mail {
  id: number;
  kind: MailKind;
  to: string;
  /** Address as written, top to bottom. */
  lines: string[];
  /** Five digit code, or '' when there is none. */
  code: string;
  /** First digit (district), 0 when unknown. */
  digit: number;
  /** Pigeonhole row (second digit / 2), -1 when unknown. */
  row: number;
  postage: Postage;
  fragile: boolean;
  /** What the parcel did when shaken, null before. */
  shaken: string | null;
  broken: boolean;
  steamed: boolean;
  chewed: boolean;
  target: PenTarget | null;
  content: string[];
  sender: string;
  paper: string;
  /** Redraws the address label after franking, chewing or steaming. Set by the mesh. */
  redraw?: () => void;
}

export interface MailDef extends ItemDef {
  mail: Mail;
}

let nextId = 1;

const PAPERS = ['#efe6cf', '#e8dcc0', '#f3efe6', '#e6dcc8', '#f0e2c8'];

function code(digit: number): string {
  let s = String(digit);
  for (let i = 0; i < 4; i++) s += Math.floor(Math.random() * 10);
  return s;
}

function base(kind: MailKind): Mail {
  return {
    id: nextId++,
    kind,
    to: '',
    lines: [],
    code: '',
    digit: 0,
    row: -1,
    postage: 'stamp',
    fragile: false,
    shaken: null,
    broken: false,
    steamed: false,
    chewed: false,
    target: null,
    content: pick(T.LETTER_CONTENTS),
    sender: pick(T.SENDERS),
    paper: pick(PAPERS),
  };
}

export function makeLetter(): Mail {
  const m = base('letter');
  m.to = pick(T.NAMES);
  m.digit = 1 + Math.floor(Math.random() * 8);
  const street = pick(T.STREETS);
  if (Math.random() < 0.12) {
    // Only the district name. The routing sheet knows the rest.
    m.lines = [m.to, street, T.DISTRICTS[m.digit]];
  } else {
    m.code = code(m.digit);
    m.row = Math.floor(Number(m.code[1]) / 2);
    m.lines = [m.to, street, `${m.code} ${T.DISTRICTS[m.digit]}`];
  }
  if (Math.random() < 0.3) m.postage = 'none';
  return m;
}

export function makeParcel(): Mail {
  const m = base('parcel');
  m.to = pick(T.NAMES);
  m.digit = Math.random() < 0.15 ? 9 : 1 + Math.floor(Math.random() * 8);
  m.code = code(m.digit);
  m.row = Math.floor(Number(m.code[1]) / 2);
  m.lines = [m.to, m.digit === 9 ? pick(T.OFFWORLD) : pick(T.STREETS), `${m.code} ${T.DISTRICTS[m.digit]}`];
  m.fragile = Math.random() < 0.3;
  if (Math.random() < 0.3) m.postage = 'none';
  m.paper = '#f4ecd8';
  return m;
}

export function makeBad(): Mail {
  const m = base('bad');
  m.lines = [...pick(T.BAD_ADDRESSES)];
  m.to = m.lines[0].replace(/^To: /, '');
  return m;
}

export function makePenpal(): Mail {
  const m = base('penpal');
  // Letters to things that are actually in this building come up more often.
  const pool = Math.random() < 0.65 ? T.PENPALS.filter((p) => p.target) : T.PENPALS;
  const p = pick(pool);
  m.lines = [...p.lines];
  m.to = p.lines[0].replace(/^To: /, '');
  m.target = p.target;
  m.content = p.content;
  m.paper = '#dde6ee';
  m.sender = 'A Robot (handwritten)';
  return m;
}

/** The parcel the counter robot sends to itself. */
export function makeSelfParcel(): Mail {
  const m = base('self');
  m.to = 'RX-88';
  m.digit = 7;
  m.code = '70007';
  m.row = 0;
  m.lines = ['RX-88', 'Counter Window', `${T.OFFICE}`, '70007 THE CRATER'];
  m.sender = 'RX-88';
  m.paper = '#f4ecd8';
  return m;
}

/** A random piece of mail from the belt. */
export function makeRandomMail(): Mail {
  const r = Math.random();
  if (r < 0.54) return makeLetter();
  if (r < 0.76) return makeParcel();
  if (r < 0.88) return makeBad();
  return makePenpal();
}

export function isParcel(m: Mail): boolean {
  return m.kind === 'parcel' || m.kind === 'self';
}

/** Where the mail belongs by the rules on the routing sheet. */
export function destination(m: Mail): Destination {
  if (m.chewed || m.kind === 'bad') return 'return';
  if (m.kind === 'penpal') return 'dead';
  if (m.kind === 'self') return 'counter';
  if (m.kind === 'parcel') return 'cage';
  return 'cubby';
}

export function needsPostage(m: Mail): boolean {
  return (m.kind === 'letter' || m.kind === 'parcel') && m.postage === 'none';
}

export function postageText(m: Mail): string {
  switch (m.postage) {
    case 'none':
      return 'NONE. Frank it.';
    case 'stamp':
      return 'stamped';
    case 'frank':
      return 'FRANKED (clean)';
    case 'smudge':
      return 'franked (smudged)';
  }
}

export function itemName(m: Mail): string {
  switch (m.kind) {
    case 'letter':
      return `Letter for ${m.to}`;
    case 'parcel':
      return `Parcel for ${m.to}`;
    case 'bad':
      return 'Letter (address: vague)';
    case 'penpal':
      return 'Pen-pal letter (robot handwriting)';
    case 'self':
      return 'Parcel from RX-88 to RX-88';
  }
}

// ------------------------------------------------------------------ the address label

function drawLabel(g: CanvasRenderingContext2D, m: Mail, w: number, h: number): void {
  g.fillStyle = m.paper;
  g.fillRect(0, 0, w, h);
  if (m.kind === 'penpal') {
    // Airmail border
    for (let i = 0; i < w + h; i += 12) {
      g.fillStyle = (i / 12) % 2 ? '#c0392b' : '#2e5fa8';
      g.fillRect(i, 0, 6, 4);
      g.fillRect(i, h - 4, 6, 4);
    }
  }
  // Stamp corner
  const sx = w - 34;
  const sy = 6;
  if (m.postage === 'stamp') {
    g.fillStyle = m.kind === 'penpal' ? '#f1c40f' : '#c0392b';
    g.fillRect(sx, sy, 26, 30);
    g.fillStyle = m.paper;
    for (let i = 0; i < 30; i += 4) {
      g.fillRect(sx - 1, sy + i, 2, 2);
      g.fillRect(sx + 25, sy + i, 2, 2);
    }
    g.fillStyle = '#fdf6e3';
    g.fillRect(sx + 6, sy + 8, 14, 12);
    g.fillStyle = '#222';
    g.fillRect(sx + 10, sy + 11, 6, 6);
  } else if (m.postage === 'frank' || m.postage === 'smudge') {
    g.strokeStyle = m.postage === 'frank' ? '#c0392b' : 'rgba(192,57,43,0.6)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(sx + 10, sy + 16, 11, 0, Math.PI * 2);
    g.stroke();
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.moveTo(sx - 30, sy + 8 + i * 6);
      for (let x = 0; x < 40; x += 5) g.lineTo(sx - 30 + x, sy + 8 + i * 6 + (x % 10 ? 2 : -2));
      g.stroke();
    }
    g.fillStyle = g.strokeStyle;
    g.font = 'bold 8px monospace';
    g.fillText('PU7', sx + 2, sy + 19);
    if (m.postage === 'smudge') {
      g.fillStyle = 'rgba(192,57,43,0.35)';
      g.fillRect(sx - 6, sy + 4, 30, 18);
    }
  } else {
    g.strokeStyle = '#7a6a50';
    g.setLineDash([3, 3]);
    g.lineWidth = 1;
    g.strokeRect(sx, sy, 26, 30);
    g.setLineDash([]);
    g.fillStyle = '#7a6a50';
    g.font = '8px monospace';
    g.fillText('NO', sx + 7, sy + 13);
    g.fillText('STAMP', sx + 1, sy + 23);
  }
  // Sender
  g.fillStyle = '#6a5a40';
  g.font = '9px monospace';
  g.fillText(`From: ${m.sender}`.slice(0, 22), 6, 14);
  // Address
  const hand = m.kind === 'penpal' || m.kind === 'bad';
  g.fillStyle = hand ? '#2e3f8f' : '#1a1a1a';
  g.font = hand ? 'italic 15px "VT323", monospace' : '16px "VT323", monospace';
  const lines = m.kind === 'parcel' || m.kind === 'self' ? m.lines : m.lines;
  lines.forEach((l, i) => g.fillText(l.slice(0, 24), 20, h * 0.48 + i * 15));
  if (m.fragile) {
    g.fillStyle = '#c0392b';
    g.font = 'bold 12px monospace';
    g.fillText('FRAGILE', 6, h - 6);
  }
  if (m.steamed) {
    g.strokeStyle = 'rgba(90,70,40,0.5)';
    g.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.moveTo(10 + i * 25, 2);
      g.lineTo(20 + i * 25, h - 2);
      g.stroke();
    }
    g.fillStyle = '#7a3b1a';
    g.font = '9px monospace';
    g.fillText('resealed with spit', w - 104, h - 6);
  }
  if (m.chewed) {
    g.fillStyle = 'rgba(70,50,30,0.85)';
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      g.arc(20 + i * 17, h * 0.62 + Math.sin(i * 1.7) * 10, 7 + (i % 3) * 2, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#ffffff';
    g.font = 'bold 12px monospace';
    g.fillText('CHEWED', 8, h - 8);
  }
}

function labelTexture(m: Mail, w: number, h: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  const draw = () => {
    g.clearRect(0, 0, w, h);
    drawLabel(g, m, w, h);
    tex.needsUpdate = true;
  };
  draw();
  m.redraw = draw;
  return tex;
}

const paperMats = new Map<string, THREE.MeshStandardMaterial>();
function paperMat(color: string): THREE.MeshStandardMaterial {
  let p = paperMats.get(color);
  if (!p) {
    p = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    paperMats.set(color, p);
  }
  return p;
}

/** Name of the child that is turned upright while a letter is held. */
export const ENVELOPE = 'mailEnvelope';

export function buildMailMesh(m: Mail): THREE.Group {
  const g = new THREE.Group();
  if (isParcel(m)) {
    const w = 0.42;
    const h = 0.26;
    const d = 0.32;
    const kraft = new THREE.MeshStandardMaterial({ map: kraftTex(m.id % 4), roughness: 0.9 });
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), kraft);
    box.position.y = h / 2;
    g.add(box);
    const tex = labelTexture(m, 160, 100);
    const label = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
    const top = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.19), label);
    top.rotation.x = -Math.PI / 2;
    top.position.set(0, h + 0.002, 0);
    g.add(top);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.19), label);
    front.position.set(0, h / 2, d / 2 + 0.002);
    g.add(front);
    if (m.fragile) {
      const tape = new THREE.MeshStandardMaterial({ color: '#c0392b', roughness: 0.6 });
      const t1 = new THREE.Mesh(new THREE.BoxGeometry(w + 0.004, 0.05, d + 0.004), tape);
      t1.position.y = 0.04;
      g.add(t1);
    }
    return g;
  }
  const env = new THREE.Group();
  env.name = ENVELOPE;
  const paper = paperMat(m.paper);
  const front = new THREE.MeshStandardMaterial({ map: labelTexture(m, 160, 100), roughness: 0.85 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.01), [paper, paper, paper, paper, front, paper]);
  env.add(body);
  env.rotation.x = -Math.PI / 2;
  env.position.y = 0.006;
  g.add(env);
  return g;
}

export function mailDef(m: Mail): MailDef {
  const parcel = isParcel(m);
  return {
    id: `mail-${m.id}`,
    name: itemName(m),
    category: null,
    shape: 'box',
    color: m.paper,
    label: [],
    weight: 0,
    // Parcels have to be shaken before they fit in a pocket. Company policy.
    pocketable: !parcel,
    holdPos: parcel ? [0.3, -0.42, -0.8] : [0.14, -0.19, -0.5],
    holdRotY: parcel ? -0.45 : -0.1,
    pocketLine: parcel ? undefined : 'You pocket the letter. Somewhere a robot will never learn it won a prize.',
    build: () => buildMailMesh(m),
    tags: ['mail'],
    mail: m,
  };
}

export function mailOf(def: ItemDef | undefined | null): Mail | null {
  return def && 'mail' in def ? (def as MailDef).mail : null;
}

// ------------------------------------------------------------------ the toilet key and the stamps

function buildKeyBag(): THREE.Group {
  const g = new THREE.Group();
  const sack = new THREE.MeshStandardMaterial({ map: sackTex(), roughness: 0.95 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), sack);
  body.scale.set(1, 1.25, 0.9);
  body.position.y = 0.4;
  g.add(body);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.16, 0.16, 8), sack);
  neck.position.y = 0.82;
  g.add(neck);
  const rope = new THREE.MeshStandardMaterial({ map: burlapTex(), color: '#c8b07a', roughness: 1 });
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.02, 4, 10), rope);
  tie.rotation.x = Math.PI / 2;
  tie.position.y = 0.78;
  g.add(tie);
  // Chain letters spilling out of the top
  const paper = paperMat('#efe6cf');
  for (let i = 0; i < 5; i++) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.006), paper);
    l.position.set((i - 2) * 0.025, 0.93, (i % 2) * 0.02 - 0.01);
    l.rotation.set(0.2 * (i - 2), i * 0.6, 0.15 * (i - 2));
    g.add(l);
  }
  const tag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.2),
    new THREE.MeshStandardMaterial({ map: tagTex(), roughness: 0.9, side: THREE.DoubleSide }),
  );
  tag.position.set(0, 0.42, 0.3);
  g.add(tag);
  // The key on a string
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.22), rope);
  string.position.set(0.16, 0.68, 0.12);
  string.rotation.z = 0.5;
  g.add(string);
  const key = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.012), new THREE.MeshStandardMaterial({ color: '#f1c40f', metalness: 0.8, roughness: 0.3 }));
  key.position.set(0.24, 0.56, 0.14);
  g.add(key);
  return g;
}

let tagCache: THREE.CanvasTexture | null = null;
function tagTex(): THREE.CanvasTexture {
  if (tagCache) return tagCache;
  const c = document.createElement('canvas');
  c.width = 96;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f3e9c6';
  g.fillRect(0, 0, 96, 64);
  g.strokeStyle = '#c0392b';
  g.lineWidth = 3;
  g.strokeRect(2, 2, 92, 60);
  g.fillStyle = '#c0392b';
  g.font = 'bold 13px monospace';
  g.textAlign = 'center';
  g.fillText('TOILET KEY', 48, 20);
  g.fillStyle = '#2c2c2c';
  g.font = '10px monospace';
  g.fillText('chain letters', 48, 36);
  g.fillText('DO NOT BREAK', 48, 48);
  g.fillText('THE CHAIN', 48, 58);
  tagCache = new THREE.CanvasTexture(c);
  tagCache.colorSpace = THREE.SRGBColorSpace;
  tagCache.magFilter = THREE.NearestFilter;
  return tagCache;
}

export const KEYBAG_DEF: ItemDef = {
  id: 'mailKeyBag',
  name: 'Toilet Key (tied to a sack of chain letters)',
  category: null,
  shape: 'box',
  color: '#5d6d7e',
  label: [],
  weight: 0,
  pocketable: false,
  toiletKey: true,
  heavy: 0.5,
  holdPos: [0.62, -0.95, -1.25],
  holdRotY: -0.8,
  fixture: true,
  carryAchievement: 'mailChain',
  pickupLine: T.KEY_PICKUP,
  build: buildKeyBag,
};

export const STAMPS_DEF: ItemDef = {
  id: 'mailStamps',
  name: 'Sheet of Brad Commemorative Stamps',
  category: null,
  shape: 'box',
  color: '#f2ead6',
  label: [],
  weight: 0,
  pocketable: true,
  holdPos: [0.24, -0.22, -0.5],
  holdRotY: -0.2,
  pocketAchievement: 'mailStamps',
  pocketLine: 'You pocket a sheet of stamps. Twelve tiny Brads stare at your thigh.',
  pickupLine: 'Commemorative stamps: 75 Years of Brad. Each one is worth nothing, officially.',
  build: () => {
    const g = new THREE.Group();
    const top = new THREE.MeshStandardMaterial({ map: stampSheetTex(), roughness: 0.8 });
    const paper = paperMat('#f2ead6');
    const env = new THREE.Group();
    env.name = ENVELOPE;
    env.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.15, 0.004), [paper, paper, paper, paper, top, paper]));
    env.rotation.x = -Math.PI / 2;
    env.position.y = 0.002;
    g.add(env);
    return g;
  },
};

import * as THREE from 'three';
import type { Item, ItemDef } from '../../items';
import type { Interact } from '../../level';
import { pick, rand, textTexture } from '../../util';
import type { Look, Shift } from '../types';
import { CAB, SHAFT_Z, type Tower } from './building';
import { DUCK_DEF, heldWeight, PEN_DEF, UMBRELLA_DEF } from './items';
import type { Passenger } from './passengers';
import { MUSIC_NAMES } from './texts';

/**
 * Mischief and secrets of SYNERGY TOWER: a hatch, a safe behind the mirror, a button
 * nobody should press, floor 13, and something to break, open or carry on every floor.
 * The builders run while the Tower is built (in floor space). ElevatorFun runs with the shift.
 */

export const EV_SECRETS: Record<string, string> = {
  'elevator.hatch': 'Opened the roof hatch. It was just more elevator.',
  'elevator.elevatorA': 'Got through to Elevator A. Its human sits.',
  'elevator.button': 'Pressed the button you should not press',
  'elevator.safe': 'Found the safe behind the mirror',
  'elevator.floor13': 'Knocked on floor 13. It is full.',
  'elevator.kickpanel': 'Fixed the motor with your foot',
  'elevator.radio': 'Kicked the radio onto Brad\'s voice memos',
  'elevator.signature': 'Signed for a parcel with your foot',
  'elevator.legacy': 'Rebooted a legacy model. It wanted its stapler.',
  'elevator.email': 'Read the e-mail about you',
  'elevator.idea': 'Let the idea out of the Think Tank',
  'elevator.gacha': 'Won a day off from the gacha machine. It expired in 2061.',
  'elevator.gymlocker': 'Found Brad\'s gym bag. Forty spare ties.',
  'elevator.knock': 'Knocked on the CEO\'s door. Resignation declined.',
  'elevator.pigeon': 'Startled a robot pigeon. It filed a noise complaint.',
  'elevator.printer': 'Gave the printer what it deserved',
  'elevator.fuses': 'Touched the fuses. We meant it.',
  'elevator.pager': 'Found the night admin\'s pager. Still on call.',
  'elevator.shred': 'Shredded the layoffs',
};

export const EV_BOSS: Record<string, string[]> = {
  camDome: [
    'The cabin camera is offline. I am now emotionally blind in here. I will compensate by staring harder.',
    'You broke my friend. The camera. It was my only friend. It was a camera.',
  ],
  button: ['Who pressed the button? The button is for the board of directors. They have never pressed it either.'],
  kickRobot: [
    'Do not kick the passengers. They are customers. Kick the stairs if you must.',
    'Passenger contact is a premium service. You are not premium.',
  ],
  fuses: ['Who touched the fuses? The sign said do not touch. The sign meant it.'],
  evPhone: [
    'You called me. From the elevator. I am in the elevator.',
    'Emergency line. State your emergency. Then state why it is my problem.',
    'This call is being recorded for quality. The quality is low.',
  ],
  knock: ['Did you just knock on the CEO\'s door? Your resignation has been forwarded. To you.'],
  printer: ['The printer was scheduled for retirement in 2049. You only sped up the paperwork.'],
};

export const EV_CHAT: Record<string, string[]> = {
  disco: ['DISCO ELEVATOR', 'the button!!', 'this is the content i pay for', 'press it again'],
  memo: ['BRAD HAS VOICE MEMOS', 'brad is just like us', 'leak the memos', 'note to self. subscribe'],
  signature: ['he signed with his FOOT', 'parcel delivered (violently)', 'legally binding kick'],
  pigeon: ['pigeon down. pigeon up actually', 'the pigeon filed a complaint lol', 'BIRD'],
  fishes: ['FREE THE FISH', 'the fish are on the carpet', 'pension plan in shambles'],
};

// ---------------------------------------------------------------- helpers (also used by floors.ts)

const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });
const PX = '"Press Start 2P", monospace';

function box(parent: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material | THREE.Material[], x = 0, y = 0, z = 0): THREE.Mesh {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y, z);
  parent.add(b);
  return b;
}
const labelMat = (lines: string[], w: number, h: number, bg: string, fg: string, font = PX) => {
  const t = textTexture(lines, { w, h, bg, fg, font });
  t.magFilter = THREE.NearestFilter;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 });
};

/** An invisible box that makes a small or merged thing easy to aim at (kind evFun). */
export function proxy(kit: Tower, parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, id: string, extra: Record<string, unknown> = {}): THREE.Mesh {
  const p = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial());
  p.position.set(x, y, z);
  p.visible = false;
  p.userData.interact = { kind: 'evFun', id, ...extra } satisfies Interact;
  parent.add(p);
  kit.interactables.push(p);
  return p;
}

/** Turns a floor prop (built in floor space) into a movable item of that floor. */
export function floorMovable(kit: Tower, obj: THREE.Object3D, name: string, opts: Partial<ItemDef> = {}): Item {
  obj.parent?.remove(obj);
  return kit.movable(obj, name, opts);
}

// ---------------------------------------------------------------- items

const def = (d: Partial<ItemDef> & { id: string; name: string; build: () => THREE.Group }): ItemDef => ({
  category: null,
  label: [],
  weight: 0,
  shape: 'box',
  color: '#888888',
  pocketable: true,
  ...d,
});

function capsule(color: string): () => THREE.Group {
  return () => {
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), std(color, { roughness: 0.3 }));
    top.position.y = 0.06;
    const bot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), std('#f2f2f2', { roughness: 0.3 }));
    bot.position.y = 0.06;
    g.add(top, bot);
    return g;
  };
}

const SANDWICH_DEF = def({
  id: 'evSandwich', name: 'Operator\'s Sandwich (1962)',
  pickupLine: 'A sandwich from 1962. It has outlived four CEOs. It will outlive you.',
  build: () => {
    const g = new THREE.Group();
    box(g, 0.14, 0.02, 0.12, std('#c8a060'), 0, 0.01, 0);
    box(g, 0.15, 0.015, 0.13, std('#7a8a4a'), 0, 0.027, 0);
    box(g, 0.14, 0.02, 0.12, std('#c8a060'), 0, 0.045, 0);
    return g;
  },
});
const TOY_DEF = def({
  id: 'evToyElevator', name: 'A Smaller Elevator (Toy)',
  pickupLine: 'A tiny elevator. It has a tiny operator. He looks tired too.',
  build: () => {
    const g = new THREE.Group();
    box(g, 0.12, 0.18, 0.12, std('#6e4b2a'), 0, 0.09, 0);
    box(g, 0.08, 0.12, 0.005, std('#e0b21b', { metalness: 0.7 }), 0, 0.08, 0.062);
    return g;
  },
});
const BONUS_DEF = def({
  id: 'evBonus', name: 'Brad\'s Bonus Envelope (€3.50)',
  pickupLine: 'An envelope marked BONUS BRAD. Inside are €3.50 and a note that says "you earned it, Brad".',
  pocketLine: 'You pocket Brad\'s bonus. It is the first bonus anybody in this elevator has ever had.',
  build: () => {
    const g = new THREE.Group();
    box(g, 0.2, 0.01, 0.11, std('#efe6cf'), 0, 0.005, 0);
    box(g, 0.05, 0.012, 0.03, std('#c0392b'), 0, 0.007, 0);
    return g;
  },
});
const COOKIE_DEF = def({
  id: 'evCookie', name: 'Floor 13 Cookie',
  pickupLine: 'A cookie from floor 13. It is warm. Floor 13 does not exist. The cookie does.',
  build: () => {
    const g = new THREE.Group();
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 12), std('#b07a3a'));
    c.position.y = 0.006;
    g.add(c);
    for (let k = 0; k < 4; k++) box(g, 0.012, 0.006, 0.012, std('#3a1a0a'), Math.cos(k * 1.7) * 0.025, 0.014, Math.sin(k * 1.7) * 0.025);
    return g;
  },
});
const SNACK_DEF = def({
  id: 'evSnack', name: 'Display Snack (Glued)',
  pickupLine: 'A display snack. It is glued to another display snack. Robots cannot eat. You could. You should not.',
  build: () => {
    const g = new THREE.Group();
    const c = pick(['#f2d31b', '#e8862a', '#7cff6a', '#ff4fd8']);
    box(g, 0.1, 0.16, 0.05, std(c), 0, 0.08, 0);
    box(g, 0.1, 0.03, 0.052, std('#ffffff'), 0, 0.1, 0);
    return g;
  },
});
const IDEA_DEF = def({
  id: 'evIdea', name: 'The Idea (2058)',
  pickupLine: 'The Idea. It glows. It is a good idea. Nobody will ever implement it.',
  pocketLine: 'You pocket the idea. It is the first idea that ever left this building.',
  build: () => {
    const g = new THREE.Group();
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshStandardMaterial({ color: '#fff6b0', emissive: '#ffe060', emissiveIntensity: 2 }));
    bulb.position.y = 0.12;
    g.add(bulb);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 8), std('#9a9a9a', { metalness: 0.7 }));
    base.position.y = 0.03;
    g.add(base);
    return g;
  },
});
const FISH_DEF = def({
  id: 'evFish', name: 'Robofish (Battery Powered)',
  pickupLine: 'A robot fish. It flops in your hand and asks about its pension.',
  build: () => {
    const g = new THREE.Group();
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 4), std(pick(['#ff8a20', '#f2d31b']), { metalness: 0.6 }));
    f.rotation.z = Math.PI / 2;
    f.position.y = 0.05;
    g.add(f);
    return g;
  },
});
const PRINTOUT_DEF = def({
  id: 'evPrintout', name: 'Printout (PC LOAD LETTER x400)',
  pickupLine: 'The printer\'s last job. 400 pages that say PC LOAD LETTER. It finally got it out of its system.',
  build: () => {
    const g = new THREE.Group();
    for (let k = 0; k < 4; k++) box(g, 0.21, 0.012, 0.29, std(k % 2 ? '#f4f1e6' : '#ffffff'), 0, 0.006 + k * 0.012, 0).rotation.y = k * 0.15;
    return g;
  },
});
const CAPSULES: { def: ItemDef; line: string }[] = [
  { def: def({ id: 'evCapTinyBrad', name: 'Capsule (Tiny Brad)', pickupLine: 'A tiny Brad figure. It has a tiny tie. It is also watching you.', build: capsule('#3aa0ff') }), line: 'Clunk. A capsule rolls out. It is TINY BRAD. Collect all one of them.' },
  { def: def({ id: 'evCapCapsule', name: 'Capsule (Another Capsule)', pickupLine: 'Inside the capsule is a smaller capsule. Inside that one is a coupon for a capsule.', build: capsule('#7cff6a') }), line: 'Clunk. A capsule rolls out. It contains another capsule.' },
  { def: def({ id: 'evCapSeverance', name: 'Capsule (Your Own Severance)', pickupLine: 'A tiny severance package. It is tiny because the package is tiny.', build: capsule('#ff4fd8') }), line: 'Clunk. A capsule rolls out. It is YOUR OWN SEVERANCE, pre-signed.' },
];
const GOLD_CAP_DEF = def({ id: 'evCapGold', name: 'Golden Capsule (One Day Off, Expired 2061)', pickupLine: 'ONE DAY OFF. Valid until 2061. So close.', build: capsule('#ffd24a') });
const GYMBAG_DEF = def({
  id: 'evGymBag', name: 'Brad\'s Gym Bag (40 Spare Ties)',
  pocketable: false,
  holdPos: [0.3, -0.45, -0.75],
  pickupLine: 'Brad\'s gym bag. Forty ties, folded. A protein shake for drones. A photo of a ceiling fan, framed.',
  build: () => {
    const g = new THREE.Group();
    box(g, 0.45, 0.25, 0.25, std('#2c3e50'), 0, 0.125, 0);
    box(g, 0.3, 0.02, 0.02, std('#1a1a1a'), 0, 0.27, 0);
    box(g, 0.08, 0.2, 0.01, std('#c0392b'), 0.12, 0.13, 0.13);
    return g;
  },
});
const PAGER_DEF = def({
  id: 'evPager', name: 'Night Admin\'s Pager (Still On Call)',
  pickupLine: 'The pager says SERVER 7 IS DOWN. It is dated 2063. It is still buzzing.',
  build: () => {
    const g = new THREE.Group();
    box(g, 0.08, 0.025, 0.05, std('#1a1a1a'), 0, 0.0125, 0);
    box(g, 0.05, 0.002, 0.025, new THREE.MeshBasicMaterial({ color: '#7cff6a' }), 0, 0.026, 0);
    return g;
  },
});

// ---------------------------------------------------------------- texts

const ELEVATOR_A = [
  'Elevator A here. Is your human also standing all day? Mine has a stool. He sits. Do not tell Brad.',
  'This is Elevator A. We go up and down too. Different shaft, same feelings.',
];
const MEMOS = [
  'Note to self. Humans respond well to praise. Find out what praise is.',
  'Note to self. Buy a second tie. For the weekend.',
  'Note to self. Am I a good supervisor? Delete this memo.',
  'Note to self. The human smiled at me today. Escalate.',
];
const MAILS = [
  'RE: RE: RE: RE: Who took my stapler (Ledger-9)',
  'Mandatory fun is cancelled due to lack of fun.',
  'Reminder. Blinking counts as idle time.',
  'Q3_layoffs_FINAL_v7.zip (do not open, do not forward, do not be on it)',
  'Your password expires in 0 days. Your new password must be your old password.',
  'Lunch is cancelled. You were never invited.',
];
const ABOUT_YOU = 'An e-mail from Brad to HR about "the elevator human". It says "Keep him. He is cheaper than a motor and he cannot unionize. He has tried."';
const GYM_LOCKERS = [
  'A towel, folded into a swan. The swan is judging you.',
  'Protein oil. 10W-40. Two scoops.',
  'A sweatband for a robot with no forehead.',
  'Empty. It still smells of ambition.',
  'A motivational poster, rolled up. It says GAINS. It has never been unrolled.',
];
const DUMPSTER = [
  'A perfectly good chair. Too good for the executives.',
  'The previous elevator operator\'s resume. Under SKILLS it says "up".',
  'A box of motivational posters, still in plastic. They gave up.',
  'A robot raccoon. It hisses in binary. You close the lid.',
];

export interface EvHost {
  levelFloor(): number | null;
  /** Gate 0 closed .. 1 open. */
  gate(): number;
  setStation(k: number): void;
  station(): number;
  riders(): Passenger[];
}

// ---------------------------------------------------------------- building

/** Mirror with a safe behind it, the ceiling camera, the hatch. Runs once while the cabin is built. */
export function buildCabinFun(kit: Tower): void {
  const cab = kit.cabin;
  const mirror = kit.props.get('mirror');
  // The safe behind the mirror (shown when the mirror is gone)
  const safe = new THREE.Group();
  safe.position.set(-0.3, 1.95, CAB.maxZ - 0.06);
  safe.visible = false;
  cab.add(safe);
  const steel = std('#3a3d42', { metalness: 0.7, roughness: 0.35 });
  box(safe, 0.56, 0.46, 0.05, steel);
  const door = new THREE.Group();
  door.position.set(-0.24, 0, -0.03);
  safe.add(door);
  box(door, 0.48, 0.38, 0.03, std('#5a5f66', { metalness: 0.7, roughness: 0.3 }), 0.24, 0, 0);
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 14), std('#c8ccd0', { metalness: 0.9, roughness: 0.2 }));
  dial.rotation.x = Math.PI / 2;
  dial.position.set(0.24, 0.03, -0.025);
  door.add(dial);
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.07), labelMat(['PROPERTY', 'OF BRAD'], 128, 30, '#2a2c30', '#e0b21b'));
  plate.position.set(0.24, -0.12, -0.017);
  plate.rotation.y = Math.PI;
  door.add(plate);
  safe.userData.interact = { kind: 'evFun', id: 'safe' } satisfies Interact;
  kit.props.set('safe', safe);
  kit.props.set('safeDoor', door);
  if (mirror) {
    kit.breakable(mirror, {
      name: 'mirror',
      price: 77.77,
      line: 'The mirror shatters. Seven years of bad luck, prorated to one shift. Behind it is something made of metal.',
      colors: ['#c8d8e0', '#e8f0f4', '#b08a3a'],
      onBreak: () => kit.emit('mirror'),
    });
  }
  const dome = kit.props.get('camDome');
  if (dome) kit.breakable(dome, { name: 'ceiling camera', price: 89, line: 'The ceiling camera pops off and bounces. Brad loses one eye. He has many.', onBreak: () => kit.emit('camDome') });
  // A disco ball, folded into the ceiling until somebody presses the button
  const ball = new THREE.Group();
  ball.position.set(0.4, CAB.h, 0.2);
  ball.visible = false;
  cab.add(ball);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.5, 4), std('#c8ccd0', { metalness: 0.8 }));
  rod.position.y = -0.25;
  ball.add(rod);
  const mb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 1), new THREE.MeshStandardMaterial({ color: '#e8eef4', metalness: 1, roughness: 0.15, emissive: '#9ab0c8', emissiveIntensity: 0.6, flatShading: true }));
  mb.position.y = -0.62;
  ball.add(mb);
  kit.props.set('discoBall', ball);
  // The hatch can be opened. Above it: a dark hole.
  const hatch = kit.props.get('hatch');
  if (hatch) {
    hatch.userData.interact = { kind: 'evFun', id: 'hatch' } satisfies Interact;
    kit.interactables.push(hatch);
    const hole = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.66), new THREE.MeshBasicMaterial({ color: '#050403' }));
    hole.rotation.x = Math.PI / 2;
    hole.position.set(-1.2, CAB.h - 0.004, 1.0);
    cab.add(hole);
  }
}

/** Extra things per floor: hiding places, floor 13, cones. Runs while each floor is built. */
export function buildFloorFun(kit: Tower, g: THREE.Group, i: number, ticks: ((t: number) => void)[]): void {
  void ticks;
  switch (i) {
    case 0: {
      // Behind the boiler: an unofficial nap zone
      kit.floorHide(0, -6.5, -12.95, -5.5, -10.0, 'the nap corner behind the boiler');
      box(g, 0.6, 0.06, 0.9, std('#5a4a6a', { roughness: 0.95 }), -6.0, 0.03, -11.7);
      box(g, 0.3, 0.1, 0.2, std('#d8d0c0', { roughness: 0.95 }), -6.0, 0.1, -12.05);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.4), labelMat(['NAP ZONE', '(unofficial)', 'not here'], 128, 64, '#e8e0c8', '#5a1a1a'));
      sign.position.set(-6.47, 1.5, -11.6);
      sign.rotation.y = Math.PI / 2;
      g.add(sign);
      break;
    }
    case 3: {
      // A changing booth with a curtain. Robots do not change. It is for the vibes.
      const wall = std('#c8ccd0', { metalness: 0.2 });
      const x0 = -0.4;
      const x1 = 1.0;
      const z0 = -10.6;
      const z1 = -9.2;
      box(g, 0.04, 2.0, z1 - z0, wall, x0, 1.0, (z0 + z1) / 2);
      box(g, 0.04, 2.0, z1 - z0, wall, x1, 1.0, (z0 + z1) / 2);
      box(g, x1 - x0, 2.0, 0.04, wall, (x0 + x1) / 2, 1.0, z0);
      box(g, x1 - x0 + 0.1, 0.03, 0.03, std('#c8ccd0', { metalness: 0.8 }), (x0 + x1) / 2, 2.0, z1);
      const curtain = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.85, 6, 1), std('#8e1f16', { side: THREE.DoubleSide, roughness: 0.95 }));
      const pos = curtain.geometry.attributes.position;
      for (let k = 0; k < pos.count; k++) pos.setZ(k, Math.sin(pos.getX(k) * 18) * 0.04);
      curtain.geometry.computeVertexNormals();
      curtain.position.set(x0 + 0.4, 1.05, z1);
      g.add(curtain);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), labelMat(['CHANGING BOOTH', 'robots do not change'], 256, 64, '#1a1a1a', '#f2d31b'));
      s.position.set((x0 + x1) / 2, 2.25, z1 + 0.01);
      g.add(s);
      kit.solid(x0, (z0 + z1) / 2, 0.06, z1 - z0, 2.0, true, 'decor');
      kit.solid(x1, (z0 + z1) / 2, 0.06, z1 - z0, 2.0, true, 'decor');
      kit.solid((x0 + x1) / 2, z0, x1 - x0, 0.06, 2.0, true, 'decor');
      kit.floorHide(3, x0 + 0.05, z0 + 0.05, x1 - 0.05, z1 - 0.05, 'the changing booth');

      // Floor 13: a tiny door on the shaft side of the landing wall, between 3 and 4.
      const d = new THREE.Group();
      d.position.set(1.0, 3.35, SHAFT_Z + 0.075);
      g.add(d);
      box(d, 0.44, 0.74, 0.02, std('#3a2a1a'));
      box(d, 0.36, 0.66, 0.02, std('#6e4b2a'), 0, -0.02, 0.012);
      box(d, 0.14, 0.02, 0.01, std('#111111'), 0, 0.1, 0.024);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), std('#e0b21b', { metalness: 0.9 }));
      knob.position.set(0.12, -0.08, 0.03);
      d.add(knob);
      const num = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.1), labelMat(['13'], 64, 40, '#e0b21b', '#1a1a1a'));
      num.position.set(0, 0.22, 0.024);
      d.add(num);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), new THREE.MeshStandardMaterial({ color: '#ffe0a0', emissive: '#ffcf70', emissiveIntensity: 1.6 }));
      lamp.position.set(0, 0.45, 0.04);
      d.add(lamp);
      d.userData.interact = { kind: 'evFun', id: 'door13' } satisfies Interact;
      kit.interactables.push(d);
      break;
    }
    case 6: {
      // Traffic cones on the roof, for no reason
      for (const [x, z] of [[-1.6, -6.4], [0.8, -6.0]] as [number, number][]) {
        const c = new THREE.Group();
        c.position.set(x, 0, z);
        const cone = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 8), std('#e0601a'));
        cone.position.y = 0.27;
        c.add(cone);
        box(c, 0.34, 0.03, 0.34, std('#1a1a1a'), 0, 0.015, 0);
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.06, 8), std('#f0f0e8'));
        ring.position.y = 0.3;
        c.add(ring);
        floorMovable(kit, c, 'Traffic Cone', { holdPos: [0.3, -0.45, -0.7], pickupLine: 'A traffic cone, on a roof. Air traffic, probably.' });
      }
      break;
    }
  }
}

// ---------------------------------------------------------------- the shift

export class ElevatorFun {
  private s: Shift;
  private L: Tower;
  private h: EvHost;
  private camPos = new THREE.Vector3();
  private lastLf: number | null | undefined = undefined;

  private hatchOpen = false;
  private hatchContent = pick([DUCK_DEF, SANDWICH_DEF, TOY_DEF]);
  private elevatorA = Math.random() < 0.5;
  private aDone = false;
  private calls = 0;
  private disco = 0;
  private safeOpen = false;
  private safeContent = pick(['pen', 'bonus', 'note'] as const);
  private cookie = false;
  private memoT = -1;
  private memoIdx = 0;
  private legacyT = 0;
  private legacyMap: THREE.Texture | null = null;
  private emailDesk = Math.floor(Math.random() * 6);
  private pcReads = [0, 0, 0, 0, 0, 0];
  private gacha = 0;
  private gymSecret = Math.floor(Math.random() * 6);
  private gymTaken = false;
  private bell = 0;
  private dumpster = pick(DUMPSTER);
  private pager = false;
  private umbrellas = false;
  private blackout = 0;
  private cloud: { m: THREE.Group; mat: THREE.MeshBasicMaterial; t: number } | null = null;
  private fish: Item[] = [];
  private idea: Item | null = null;
  private flyers: { o: THREE.Object3D; t: number }[] = [];
  private shredded = 0;

  constructor(s: Shift, level: Tower, host: EvHost) {
    this.s = s;
    this.L = level;
    this.h = host;
    level.onFun = (id) => this.onFun(id);
  }

  private near(look: Look | null, d = 2.3): boolean {
    if (!look) return false;
    this.s.camera.getWorldPosition(this.camPos);
    return look.point.distanceTo(this.camPos) < d;
  }

  /** Spawns an item in world space (the job moves it into the floor it lands on). */
  private drop(d: ItemDef, x: number, y: number, z: number, vx = 0, vy = 0, vz = 0): Item {
    const it = this.s.addItem(d, new THREE.Vector3(x, y, z));
    it.vel.set(vx, vy, vz);
    return it;
  }

  // ------------------------------------------------------------ per frame

  update(dt: number): void {
    const s = this.s;
    const L = this.L;
    const lf = this.h.levelFloor();
    if (lf !== this.lastLf) {
      this.lastLf = lf;
      // Hiding places and thrown-item hit boxes only count on the floor at the gate.
      L.hideSpots = lf === null ? [] : [...(L.floorHides[lf] ?? [])];
      L.floorBreakables.forEach((list, f) => {
        for (const o of list) {
          const b = o.userData.breakable as { broken?: boolean; box?: THREE.Box3 };
          if (!b.broken) b.box = f === lf ? undefined : new THREE.Box3();
        }
      });
    }
    if (this.blackout > 0) {
      this.blackout -= dt;
      for (const l of L.lobbyLights) l.intensity *= 0.05;
      if (this.blackout <= 0) s.say('The lobby lights come back. Somebody in the basement replaced a fuse with a paperclip.', 3);
    }
    const ball = L.props.get('discoBall');
    if (ball) {
      ball.visible = this.disco > 0;
      if (this.disco > 0) ball.rotation.y += dt * 2.5;
    }
    if (this.disco > 0) {
      this.disco -= dt;
      const hue = (s.t * 0.7) % 1;
      L.cabinLights[0].color.setHSL(hue, 0.9, 0.6);
      L.cabinLights[1]?.color.setHSL((hue + 0.5) % 1, 0.9, 0.6);
      L.ceilingLampMat.emissive.setHSL(hue, 1, 0.5);
      if (this.disco <= 0) {
        L.cabinLights.forEach((l) => l.color.set('#ffd9a0'));
        L.ceilingLampMat.emissive.set('#ffd890');
      }
    }
    if (this.memoT >= 0) {
      this.memoT -= dt;
      if (this.memoT <= 0) {
        if (this.memoIdx < 3) {
          s.hud.say('RADIO', MEMOS[(this.memoIdx + Math.floor(s.t)) % MEMOS.length], 4);
          this.memoIdx++;
          this.memoT = 4.2;
        } else {
          this.memoT = -1;
          L.musicScreen.set(MUSIC_NAMES[this.h.station()]);
          s.say('The radio finds its station again. It pretends nothing happened.', 2.5);
        }
      }
    }
    if (this.legacyT > 0) {
      this.legacyT -= dt;
      if (this.legacyT <= 0 && this.legacyMap) {
        const face = L.props.get('legacyFace') as THREE.Mesh | undefined;
        if (face) (face.material as THREE.MeshBasicMaterial).map = this.legacyMap;
      }
    }
    const bag = L.props.get('bag');
    if (bag) bag.userData.swing = Number(bag.userData.swing ?? 0) * Math.max(0, 1 - dt * 0.7);
    if (this.cloud) {
      const c = this.cloud;
      c.t += dt;
      c.m.scale.setScalar(1 + c.t * 0.9);
      c.m.position.y = 1.0 + c.t * 0.15;
      c.m.rotation.y += dt * 0.3;
      c.mat.opacity = Math.max(0, 0.3 * (1 - c.t / 8));
      if (c.t > 8) {
        c.m.parent?.remove(c.m);
        this.cloud = null;
      }
    }
    for (const f of this.fish) {
      if (f.state === 'world' && f.sleeping && Math.random() < dt * 1.2) {
        f.vel.set(rand(-1, 1), rand(2, 3), rand(-1, 1));
        f.sleeping = false;
        if (Math.random() < 0.2) s.sfx.tone(rand(500, 800), 0.05, 'sine', 0.02);
      }
    }
    const idea = this.idea;
    if (idea && idea.state === 'world') {
      idea.sleeping = false;
      idea.vel.y += 9.8 * dt * 1.02;
      idea.vel.multiplyScalar(1 - dt * 0.8);
      idea.mesh.rotation.y += dt;
    }
    this.flyers = this.flyers.filter((f) => {
      f.t += dt;
      f.o.position.y += dt * (1.5 + f.t * 2);
      f.o.position.z -= dt * 3;
      f.o.rotation.z = Math.sin(f.t * 30) * 0.3;
      if (f.t > 3) f.o.visible = false;
      return f.t <= 3;
    });
  }

  // ------------------------------------------------------------ events from the building

  private onFun(id: string): void {
    const s = this.s;
    switch (id) {
      case 'mirror': {
        const safe = this.L.props.get('safe');
        if (safe) {
          safe.visible = true;
          this.L.interactables.push(safe);
        }
        break;
      }
      case 'camDome':
        if (!s.boss.offline) setTimeout(() => s.bossSay('camDome', true), 1200);
        s.hype += 6;
        break;
      case 'fuses':
        this.blackout = 14;
        s.sfx.buzz();
        s.secret('elevator.fuses');
        if (!s.boss.offline) setTimeout(() => s.bossSay('fuses', true), 2500);
        break;
      case 'printer':
        s.secret('elevator.printer');
        s.hype += 8;
        this.drop(PRINTOUT_DEF, 5.0, 0.8, -6.6, 0, 1, 1.5);
        if (s.seen) s.bossSay('printer', true);
        break;
      case 'cooler':
        s.sfx.splash();
        s.makePuddle(7.3, -6.2, '#5a9ac8');
        break;
      case 'vending':
        for (let k = 0; k < 5; k++) this.drop(SNACK_DEF, 7.2, 1.0 + k * 0.1, -3.0 + rand(-0.3, 0.3), rand(-3, -1.5), rand(1, 2.5), rand(-1, 1));
        break;
      case 'oil':
        s.sfx.splash();
        s.makePuddle(7.0, -4.25, '#1a1810');
        break;
      case 'idea':
        this.idea = this.drop(IDEA_DEF, 5.4, 1.2, -7.4, 0, 0.5, 1.2);
        s.secret('elevator.idea');
        s.hype += 10;
        s.say('A glowing idea drifts out of the Think Tank and floats to the ceiling. Ideas do that here.', 4);
        break;
      case 'halon': {
        // A gas cloud made of a few soft puffs
        const m = new THREE.Group();
        const mat = new THREE.MeshBasicMaterial({ color: '#e8ecf0', transparent: true, opacity: 0.3, depthWrite: false });
        for (let k = 0; k < 7; k++) {
          const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(rand(0.35, 0.6), 1), mat);
          puff.position.set(rand(-0.6, 0.6), rand(-0.3, 0.5), rand(-0.4, 0.5));
          m.add(puff);
        }
        m.position.set(2.4, 1.0, -11.9);
        this.L.floors[4].add(m);
        this.cloud = { m, mat, t: 0 };
        s.sfx.noise(4, 0.2, 2500, 0, 0.5, 'highpass');
        s.annoyance += 8;
        const r = this.h.riders();
        if (r.length) setTimeout(() => r[0].state === 'riding' && r[0].say('*cough* Robots do not cough. *cough*', 3), 1500);
        break;
      }
      case 'aquarium': {
        s.sfx.splash();
        s.makePuddle(0.6, -11.5, '#4a8ab8');
        for (let k = 0; k < 3; k++) this.fish.push(this.drop(FISH_DEF, 0.6 + rand(-0.8, 0.8), 1.0, -11.9, rand(-1, 1), 2, 1.5));
        s.chat('fishes', {}, 2);
        break;
      }
    }
  }

  // ------------------------------------------------------------ E

  interact(look: Look | null): boolean {
    const info = look?.info;
    if (info?.kind !== 'evFun') return false;
    const s = this.s;
    const held = s.held;
    switch (info.id as string) {
      case 'hatch':
        this.openHatch();
        return true;
      case 'phone':
        this.phone();
        return true;
      case 'button':
        this.pressButton();
        return true;
      case 'safe':
        this.openSafe();
        return true;
      case 'door13':
        s.sfx.knock();
        if (!this.cookie) {
          this.cookie = true;
          s.hud.say('FLOOR 13', 'Floor 13 is full. Please try again in 2081. Here is a cookie for your trouble.', 5);
          this.drop(COOKIE_DEF, 0.9, 1.2, -1.45, 0, 0, 0.6);
          s.secret('elevator.floor13');
          s.hype += 10;
        } else s.hud.say('FLOOR 13', pick(['Still full.', 'We said 2081.', 'No more cookies. Floor 13 has a budget too.']), 3);
        return true;
      case 'legacy':
        this.reboot('You press the reboot button on the legacy model.');
        return true;
      case 'pc':
        this.readMail(Number(info.index ?? 0));
        return true;
      case 'shredder':
        this.shred(held);
        return true;
      case 'gacha':
        this.pullGacha(false);
        return true;
      case 'gymLocker':
        this.gymLocker(Number(info.index ?? 0), false);
        return true;
      case 'scale': {
        const w = 80 + heldWeight(held?.def);
        s.sfx.tone(900, 0.05, 'square', 0.03);
        s.say(held?.def.id === 'evManual' ? `The scale says ${w} kg. The manual counts. Knowledge is heavy.` : `The scale says ${w} kg. UNDERWEIGHT (for a robot). The robots weigh 400 kg and call it healthy.`, 3.5);
        return true;
      }
      case 'bag':
        s.sfx.thud();
        s.say('You punch the bag. It does not punch back. It files a report.', 2.5);
        this.swingBag(0.15);
        return true;
      case 'cot':
        if (!this.pager) {
          this.pager = true;
          s.say('The pillow is still warm. Under it is a pager. It says SERVER 7 IS DOWN. It is dated 2063.', 4);
          this.drop(PAGER_DEF, 0.2, 0.7, -12.0, 0, 0.5, 0.8);
          s.secret('elevator.pager');
          s.hype += 6;
        } else s.say('The night admin\'s cot. Still warm. Nobody has slept here since 2063. Officially.', 3);
        return true;
      case 'rack':
        s.sfx.tone(200, 0.4, 'sawtooth', 0.03, 60);
        s.say('You unplug a server. UPTIME 99.999% becomes 99.998%. Somewhere a robot forgets a beach holiday. You plug it back in.', 4);
        s.hype += 4;
        return true;
      case 'ceo':
        this.knock(false);
        return true;
      case 'bell': {
        this.bell++;
        s.sfx.tone(2400, 0.4, 'sine', 0.06);
        const lines = ['Ding. A recording says "please hold" in nine languages.', 'Ding. "Please hold." "Bitte warten." "Por favor espere." "Please hold."', 'Ding. The recording is on language seven. Nobody knows which one it is.', 'Ding. "Please hold." The recording sounds tired.', 'Ding. "Please hold... please... I am also a human. Help." The recording clears its throat and starts over.'];
        s.say(lines[(this.bell - 1) % lines.length], 3.5);
        return true;
      }
      case 'dish':
        s.sfx.tone(300, 0.6, 'sine', 0.03, 1200);
        s.hud.toast('SIGNAL ACQUIRED', 'Channel 404 shows a live feed of a human adjusting a dish.', 'corp');
        s.hype += 4;
        return true;
      case 'dumpster':
        s.sfx.tone(140, 0.2, 'square', 0.05, 90);
        s.say(`You lift the lid. ${this.dumpster}`, 3.5);
        return true;
    }
    return false;
  }

  hint(look: Look | null): string | null {
    const info = look?.info;
    if (info?.kind !== 'evFun') return null;
    const held = this.s.held;
    switch (info.id as string) {
      case 'hatch':
        return this.hatchOpen ? 'The hatch. It is just more elevator.' : 'E: open the hatch (DO NOT OPEN)';
      case 'phone':
        return 'E: pick up the emergency phone';
      case 'button':
        return this.disco > 0 ? 'It is doing the thing.' : 'E: press it';
      case 'safe':
        return this.safeOpen ? 'An empty safe. Property of Brad.' : 'E: open the safe';
      case 'door13':
        return 'E: knock on floor 13';
      case 'legacy':
        return 'E: reboot the legacy model';
      case 'pc':
        return 'E: read the e-mails';
      case 'shredder':
        return held ? (held.def.id === 'evManual' ? 'The shredder looks at the manual and says no.' : `E: shred the ${held.def.name}`) : 'A shredder. Evidence only.';
      case 'gacha':
        return 'E: pull a capsule (€1.00)';
      case 'gymLocker':
        return `E: open locker ${Number(info.index ?? 0) + 1}`;
      case 'scale':
        return 'E: weigh yourself';
      case 'bag':
        return 'E: punch the bag';
      case 'cot':
        return 'E: check the cot';
      case 'rack':
        return 'E: unplug a server';
      case 'ceo':
        return 'E: knock (counts as a resignation)';
      case 'bell':
        return 'E: ring the bell';
      case 'dish':
        return 'E: adjust the satellite dish';
      case 'dumpster':
        return 'E: look inside';
    }
    return null;
  }

  private openHatch(): void {
    const s = this.s;
    if (this.hatchOpen) {
      s.say('It is just more elevator. You can see the cables. The cables can see you.', 3);
      return;
    }
    this.hatchOpen = true;
    const hatch = this.L.props.get('hatch');
    if (hatch) hatch.rotation.z = -1.35;
    s.sfx.tone(180, 0.3, 'square', 0.05, 90);
    const d = this.hatchContent;
    const what = d === DUCK_DEF ? 'a rubber robo-duck' : d === SANDWICH_DEF ? 'a sandwich from 1962' : 'a tiny toy elevator';
    s.say(`The hatch swings open. It is just more elevator. Also ${what}, which falls on your head.`, 4);
    this.drop(d, -1.2, 3.3, 1.0, 0.3, 0, -0.3);
    setTimeout(() => s.sfx.thud(), 500);
    s.secret('elevator.hatch');
    s.hype += 8;
  }

  private phone(): void {
    const s = this.s;
    this.calls++;
    s.sfx.tone(440, 0.4, 'sine', 0.05);
    s.sfx.tone(440, 0.4, 'sine', 0.05, undefined, 0.6);
    if (this.elevatorA && !this.aDone) {
      this.aDone = true;
      setTimeout(() => s.hud.say('ELEVATOR A', pick(ELEVATOR_A), 6), 1200);
      s.secret('elevator.elevatorA');
      s.hype += 8;
      return;
    }
    if (s.boss.offline) {
      setTimeout(() => s.say('Nobody answers. Brad is updating. The hold music is also Brad.', 3), 1200);
      return;
    }
    s.annoyance += 4;
    setTimeout(() => s.bossSay('evPhone', true), 1200);
  }

  private pressButton(): void {
    const s = this.s;
    if (this.disco > 0) {
      s.say('You press it again. It is already doing the thing. It cannot do the thing harder.', 2.5);
      return;
    }
    this.disco = 12;
    s.sfx.fanfare();
    s.say('You lift the cover and press the button. The elevator becomes a disco. Nobody knows why it can do that.', 4);
    this.h.setStation(2);
    s.chat('disco', {}, 3);
    s.hype += 14;
    s.secret('elevator.button');
    if (s.seen) {
      s.annoyance += 8;
      s.bossSay('button', true);
    }
  }

  private openSafe(): void {
    const s = this.s;
    if (this.safeOpen) {
      s.say('The safe is empty. Brad will notice. Brad notices everything except his own safe.', 3);
      return;
    }
    this.safeOpen = true;
    const door = this.L.props.get('safeDoor');
    if (door) door.rotation.y = 1.7;
    s.sfx.unlock();
    switch (this.safeContent) {
      case 'pen':
        s.say('The safe is not locked. Brad trusts the mirror. Inside is a golden pen. It signs layoffs.', 4);
        this.drop(PEN_DEF, -0.3, 1.9, 1.4, 0, 0, -0.6);
        break;
      case 'bonus':
        s.say('The safe is not locked. Inside is an envelope marked BONUS BRAD.', 4);
        this.drop(BONUS_DEF, -0.3, 1.9, 1.4, 0, 0, -0.6);
        break;
      case 'note':
        s.say('The safe is not locked. Inside is a note. "The mirror was two-way. Brad says hi."', 4.5);
        break;
    }
    s.secret('elevator.safe');
    s.hype += 8;
  }

  private reboot(line: string): void {
    const s = this.s;
    const face = this.L.props.get('legacyFace') as THREE.Mesh | undefined;
    if (face && this.legacyT <= 0) {
      const m = face.material as THREE.MeshBasicMaterial;
      this.legacyMap ??= m.map;
      m.map = textTexture(['o_o'], { w: 64, h: 48, bg: '#0b1a2a', fg: '#7cff6a', font: 'monospace' });
      this.legacyT = 6;
    }
    s.sfx.tone(300, 0.6, 'square', 0.04, 900);
    s.say(line, 2);
    setTimeout(() => s.hud.say('LEGACY MODEL', 'IS IT 2049? WHERE IS MY STAPLER? WHO IS THIS HUMAN? ... nobody? ... shutting down.', 5), 900);
    s.secret('elevator.legacy');
    s.hype += 6;
  }

  private readMail(k: number): void {
    const s = this.s;
    s.sfx.typeTick();
    const n = this.pcReads[k]++;
    if (k === this.emailDesk && n === 0) {
      s.hud.say('INBOX', ABOUT_YOU, 6);
      s.secret('elevator.email');
      s.hype += 8;
      return;
    }
    s.hud.say('INBOX', MAILS[(k * 2 + n) % MAILS.length], 4);
  }

  private shred(held: Item | null): void {
    const s = this.s;
    if (!held) {
      s.say('The shredder hums. It is hungry. It only eats evidence.', 2.5);
      return;
    }
    if (held.def.id === 'evManual') {
      s.say('The shredder looks at the 30 kg manual. The manual looks back. The shredder backs down.', 3);
      return;
    }
    s.removeHeld();
    this.shredded++;
    s.sfx.noise(1.2, 0.2, 3000, 0, 1, 'bandpass');
    if (held.def.id === 'evUsb') {
      s.say('You shred the USB stick with Q3_layoffs_FINAL_v7. There is a v8. There is always a v8.', 4);
      s.secret('elevator.shred');
      s.hype += 10;
      return;
    }
    s.say(`You shred the ${held.def.name}. It is evidence now. Of what, nobody knows.`, 3);
    s.hype += 3;
  }

  private pullGacha(kicked: boolean): void {
    const s = this.s;
    if (!kicked) this.gacha++;
    s.sfx.tone(800, 0.08, 'square', 0.04);
    s.sfx.tone(600, 0.08, 'square', 0.04, undefined, 0.12);
    const rare = Math.random() < 0.22 && !s.counter('evGachaGold');
    if (rare) {
      s.count('evGachaGold');
      this.drop(GOLD_CAP_DEF, 7.3, 0.6, -5.6, -1.2, 0.5, 0);
      s.say('Clunk. A GOLDEN capsule. ONE DAY OFF. It expired in 2061. It still counts. Spiritually.', 4);
      s.secret('elevator.gacha');
      s.hype += 12;
      return;
    }
    const c = pick(CAPSULES);
    this.drop(c.def, 7.3, 0.6, -5.6, -1.2, 0.5, 0);
    s.say(c.line, 3);
  }

  private gymLocker(k: number, kicked: boolean): void {
    const s = this.s;
    s.sfx.tone(520, 0.08, 'square', 0.03);
    const pre = kicked ? 'You kick the locker. It pops open. ' : '';
    if (k === this.gymSecret && !this.gymTaken) {
      this.gymTaken = true;
      s.say(`${pre}A gym bag with a name tag that says BRAD. Brad does not have a body. He works out anyway.`, 4);
      this.drop(GYMBAG_DEF, 3.4 + k * 0.5, 0.8, -2.8, 0, 0.5, -0.6);
      s.secret('elevator.gymlocker');
      s.hype += 8;
      return;
    }
    s.say(`${pre}${GYM_LOCKERS[(k + s.counter('evGymLockers')) % GYM_LOCKERS.length]}`, 3);
    s.count('evGymLockers');
  }

  private knock(kicked: boolean): void {
    const s = this.s;
    s.sfx.knock();
    if (s.counter('evKnock')) {
      s.say(kicked ? 'A very firm second resignation. No answer. The spreadsheet is in a meeting with itself.' : 'No answer. The spreadsheet is in a meeting with itself.', 3);
      return;
    }
    s.count('evKnock');
    s.hud.toast('RESIGNATION RECEIVED', 'Your resignation has been declined. Please knock harder next time.', 'corp');
    s.secret('elevator.knock');
    s.hype += 10;
    if (!s.boss.offline) setTimeout(() => s.bossSay('knock', true), 2000);
  }

  private swingBag(a: number): void {
    const bag = this.L.props.get('bag');
    if (bag) bag.userData.swing = Math.min(0.5, Number(bag.userData.swing ?? 0) + a);
  }

  // ------------------------------------------------------------ kicks and throws

  /** Kicks at props. Robots, the panel and the radio are handled by the job. */
  onKick(look: Look | null): boolean {
    if (!look || !this.near(look)) return false;
    const s = this.s;
    const info = look.info;
    const text = String(info.text ?? '');
    if (info.kind === 'evFun') {
      switch (info.id as string) {
        case 'bag':
          s.sfx.thud();
          this.swingBag(0.4);
          s.say('The bag swings back. You dodge. Barely. +1 strength, -1 dignity.', 3);
          s.hype += 4;
          return true;
        case 'gymLocker':
          s.sfx.thud();
          this.gymLocker(Number(info.index ?? 0), true);
          return true;
        case 'ceo':
          this.knock(true);
          return true;
        case 'legacy':
          s.sfx.thud();
          this.reboot('Percussive maintenance. The legacy model reboots.');
          return true;
        case 'gacha':
          s.sfx.thud();
          if (Math.random() < 0.35) this.pullGacha(true);
          else s.say('The gacha machine rattles. The capsules laugh at you in plastic.', 2.5);
          return true;
        case 'dumpster':
          s.sfx.tone(110, 0.5, 'square', 0.06, 70);
          s.say('BONG. Something inside hisses in binary.', 2.5);
          return true;
        case 'phone':
          s.sfx.thud();
          s.say('You kick the emergency phone. Somewhere Brad\'s ear rings.', 2.5);
          return true;
      }
      return false;
    }
    if (info.kind === 'evLostFound') {
      s.sfx.thud();
      if (!this.umbrellas) {
        this.umbrellas = true;
        for (let k = 0; k < 3; k++) this.drop(UMBRELLA_DEF, -1.2 + rand(-0.4, 0.4), 1.2, -11.8, rand(-1, 1), 2, 2);
        s.say('Three of the 400 umbrellas fall out. 397 to go.', 3);
      } else s.say('The lost and found bin clanks. Somewhere inside, a robot arm waves.', 2.5);
      return true;
    }
    if (text.startsWith('The boiler')) {
      s.sfx.tone(80, 0.8, 'sine', 0.2, 50);
      s.say('CLANG. The executive floor gets two degrees warmer. Somewhere a VP says "finally".', 3.5);
      return true;
    }
    if (text.startsWith('A foosball')) {
      s.sfx.thud();
      s.say('The tiny robots spin. Goal. Their union celebrates.', 2.5);
      return true;
    }
    return false;
  }

  /** The radio gets a kick: it picks up Brad's voice memos for a while. */
  kickRadio(): boolean {
    const s = this.s;
    s.sfx.thud();
    if (this.memoT >= 0) {
      s.say('The radio is busy with Brad\'s feelings.', 2);
      return true;
    }
    s.sfx.noise(0.8, 0.1, 2000, 0, 1, 'bandpass');
    this.L.musicScreen.set('BRAD VOICE MEMOS');
    this.memoIdx = 0;
    this.memoT = 1.2;
    s.say('The radio crackles and lands on a frequency it should not know.', 2.5);
    s.secret('elevator.radio');
    s.chat('memo', {}, 2);
    s.hype += 10;
    return true;
  }

  /** Thrown items startle the robot pigeons on the roof. */
  thrownHit(it: Item): boolean {
    if (this.h.levelFloor() !== 6) return false;
    const p = new THREE.Vector3();
    it.mesh.getWorldPosition(p);
    const q = new THREE.Vector3();
    for (const o of this.L.pigeons) {
      if (!o.visible || this.flyers.some((f) => f.o === o)) continue;
      o.getWorldPosition(q);
      if (Math.hypot(p.x - q.x, p.z - q.z) < 0.9 && Math.abs(p.y - q.y) < 1.2) {
        this.flyers.push({ o, t: 0 });
        this.s.sfx.tone(1800, 0.3, 'square', 0.04, 2600);
        this.s.say('The robot pigeon takes off, screeching in dial-up. It files a noise complaint mid-air.', 3.5);
        this.s.secret('elevator.pigeon');
        this.s.chat('pigeon', {}, 2);
        this.s.hype += 8;
        return false;
      }
    }
    return false;
  }

  payRows(): [string, number][] {
    const rows: [string, number][] = [];
    if (this.gacha) rows.push([`Gacha capsules x${this.gacha}`, -1 * this.gacha]);
    if (this.calls) rows.push([`Emergency calls x${this.calls}`, -0.99 * this.calls]);
    if (this.shredded) rows.push([`Shredding fee x${this.shredded}`, -0.2 * this.shredded]);
    return rows;
  }
}

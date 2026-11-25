import * as THREE from 'three';
import { bubbles } from '../../bubbles';
import type { Item, ItemDef } from '../../items';
import type { Interact } from '../../level';
import { pick, rand, textTexture } from '../../util';
import type { Look, Shift } from '../types';
import type { Car } from './cars';
import { COIN_DEF } from './items';
import { BARRIER_Z, BOUNDS, CABIN_W, islandX, MY_ISLAND, MY_LANE, ROAD_X0, TOILET, YARD } from './layout';
import type { Painter } from './painter';
import type { TollPlaza } from './plaza';

/**
 * Mischief and secrets of the AUTOBAHN 2071 toll plaza: things to break, push around and find.
 * Built with the plaza, wired to the traffic when the shift starts.
 */

const PX = '"Press Start 2P", monospace';
const std = (color: string, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });

export const TOLL_SECRETS: Record<string, string> = {
  'toll.radio': 'Found the pirate station on the booth radio',
  'toll.horn': 'Honked back at the traffic',
  'toll.allstop': 'Closed all six lanes at once',
  'toll.sos': 'Called Brad on the emergency phone',
  'toll.lounge': 'Found the lounge in the shipping container',
  'toll.shrine': 'Found the shrine behind the toilet',
  'toll.locker': "Opened the last operator's locker",
  'toll.ceo': 'Charged the CEO a toll',
  'toll.conehat': 'Gave a robot car a cone hat',
  'toll.hope': 'Got HOPE out of the vending machine',
  'toll.porta': 'Kicked open the executive toilet',
  'toll.lucky': 'Found the lucky 1987 coin',
  'toll.ufo': 'Saw the UFO over the fields',
  'toll.kickpolice': 'Kicked a police car',
};

export const FUN_BOSS_LINES: Record<string, string[]> = {
  cameraBroken: ['Camera 9 is offline. I will now watch you with my own lens. It is a very good lens.', 'Who broke the camera? Do not answer. The other cameras saw it.'],
  sosCall: ['Brad here. What is your emergency? Is it a toilet? It is always a toilet.', 'This is Brad. This line is for robot emergencies. Are you a robot? Then hang up.'],
  allStop: ['WHO CLOSED ALL SIX LANES? Five robot arms are on the autobahn. They had families.', 'The master switch has a cover. The cover has a sign. The sign has me. I am disappointed.'],
  ceo: ['Did you just charge the CEO? I have never been this scared and this proud.'],
  kickCar: ['Kicking customers is not in your job description. Neither is fun.'],
};

export const FUN_CHAT_LINES: Record<string, string[]> = {
  kickCar: ['HE KICKED A CAR', 'bumper abuse', 'that car has a lawyer', 'dent speedrun'],
  conehat: ['CONE HAT', 'the car is a wizard now', 'fashion', 'traffic management promotion'],
  allStop: ['ALL LANES CLOSED', 'every arm snapped lmao', 'robot lane chaos', 'he pressed the button. the BUTTON'],
  horn: ['HONK BACK', 'the booth honked', 'the cars are confused', 'honk war'],
  ufo: ['did anyone else see that', 'UFO??', 'over the field!!', 'chat is that real'],
  ceo: ['THE CEO', 'he charged the ceo', 'legend behaviour', 'this human is unhinged'],
  lounge: ['secret lounge', 'he found the container', 'chill zone'],
  hope: ['HOPE', 'hope was in stock after all', 'the machine gave up hope'],
};

const RADIO = [
  'AUTOBAHN FM. The traffic report says there is traffic. It is you.',
  'SMOOTH JAZZ FOR CARS. A saxophone made of turn signals.',
  'ROBOT TALK RADIO. Today we ask if humans are real. A caller from lane 5 says no.',
  'NUMBERS STATION. Two. Point. Zero. Zero. Exact change. Two. Point. Zero. Zero.',
  'STATIC. It sounds like the sea. Or like lane 4 at rush hour.',
  'PIRATE RADIO MOTEL 2071. A human voice. "If you hear this, the container in the parts yard has a door. And the vending machine takes kicks. Stay human."',
];
const LOCKER_JUNK = [
  'An empty locker. Someone engraved "4 SECONDS" on the inside of the door.',
  'A reflective vest, size robot. It does not fit any human. It was not meant to.',
  'A bag of five cent coins with a note. "For RoboGran, so she never runs out".',
  'A framed sticker that says "I SURVIVED LANE 3 (2069)". The frame is scratched. The sticker is not.',
];
const CAR_KICK = ['Dent detected. Complaint filed.', 'Ow. My paint is a subscription.', 'Did a human just kick me? Logging it as weather.', 'HONK. That was assault on a vehicle.', 'My insurance will hear about this. My insurance is also a car.'];

// ------------------------------------------------------------------ items

const mesh = (g: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material | THREE.Material[], x: number, y: number, z: number) => {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  g.add(o);
  return o;
};

const LUCKY_DEF: ItemDef = {
  id: 'luckyCoin',
  name: 'Lucky Toll Coin (1987)',
  category: null,
  shape: 'box',
  color: '#ffd24f',
  label: [],
  weight: 0,
  pocketable: true,
  holdPos: [0.22, -0.2, -0.45],
  pickupLine: 'A coin from 1987. Back when tolls were paid by humans to humans. It is worth nothing. It is the most valuable thing on the plaza.',
  pocketLine: 'You pocket the lucky coin. You feel 2 percent luckier. Brad feels nothing.',
  build: () => {
    const g = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({ color: '#ffd24f', emissive: '#8a5a00', emissiveIntensity: 0.8, metalness: 0.8, roughness: 0.25 });
    mesh(g, new THREE.CylinderGeometry(0.08, 0.08, 0.02, 14), gold, 0, 0.01, 0);
    const star = mesh(g, new THREE.BoxGeometry(0.05, 0.005, 0.05), std('#fff2a0', { metalness: 0.9 }), 0, 0.022, 0);
    star.rotation.y = Math.PI / 4;
    // easier to aim at
    mesh(g, new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), 0, 0.15, 0);
    return g;
  },
};

const canDef = (id: string, name: string, lines: string[], color: string, pickupLine: string): ItemDef => ({
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
  build: () => {
    const g = new THREE.Group();
    const side = new THREE.MeshStandardMaterial({ map: textTexture(lines, { w: 96, h: 64, bg: color, fg: '#ffffff' }) });
    const top = std('#b8bec4', { metalness: 0.7 });
    mesh(g, new THREE.CylinderGeometry(0.045, 0.045, 0.13, 10), [side, top, top], 0, 0.065, 0).rotation.y = -Math.PI / 2;
    return g;
  },
});

const OIL_DEF = canDef('oilCan', 'Can of Oil (for robots)', ['OIL', '10W-40'], '#2a2a2a', 'A can of motor oil from the robot vending machine. The label says "refreshing".');
const HOPE_DEF = canDef('hopeCan', 'HOPE (Limited Edition)', ['HOPE', 'exp. 2066'], '#2e86c1', 'A can of HOPE. It expired in 2066. You keep it anyway.');

// ------------------------------------------------------------------ the module

interface Door {
  pivot: THREE.Group;
  open: boolean;
  angle: number;
  max: number;
  axis: 'y' | 'z';
}

export interface FunCtx {
  cars(): Car[];
  painter: Painter;
  /** Adds a fine to the payslip. */
  fine(n: number): void;
  /** A car honks (sound and bubble). */
  honk(c: Car): void;
}

export class TollFun {
  readonly secrets = TOLL_SECRETS;
  private s!: Shift;
  private ctx!: FunCtx;
  private station = -1;
  private lockers: Door[] = [];
  private secretLocker = 0;
  private lockerFound = false;
  private container!: Door;
  private porta!: Door;
  private portaKicks = 0;
  private portaLight!: THREE.PointLight;
  private vendKicks = 0;
  private sosCalls = 0;
  private coverOpen = false;
  private cover!: THREE.Group;
  private allStopT = 0;
  private repairT = 0;
  private snapped = 0;
  private lucky: Item | null = null;
  private ufo!: THREE.Group;
  private ufoLights: THREE.MeshBasicMaterial[] = [];
  private ufoAt = Infinity;
  private ufoT = -1;
  private ufoSeen = 0;
  private ufoGone = false;
  private loungeRect = { minX: -25.0, maxX: -22.85, minZ: -4.4, maxZ: -1.4 };
  private inLounge = false;
  private tv!: { g: CanvasRenderingContext2D; tex: THREE.CanvasTexture };
  private dir = new THREE.Vector3();
  private cam = new THREE.Vector3();

  constructor(private kit: TollPlaza) {
    this.boothGadgets();
    this.staffRoom();
    this.lounge();
    this.shrine();
    this.buildBreakables();
    this.buildUfo();
    this.executiveToilet();
    // interactables that the plaza already built
    this.interactive(kit.radio, { kind: 'tlRadio' });
    this.interactive(kit.sos, { kind: 'tlSos' });
    this.container = { pivot: kit.container.door, open: false, angle: 0, max: 1.65, axis: 'y' };
    this.porta = { pivot: kit.porta.door, open: false, angle: 0, max: 1.5, axis: 'y' };
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

  /** A honk button on the desk and the master switch behind the operator. */
  private boothGadgets(): void {
    const kit = this.kit;
    const x1 = islandX(MY_ISLAND) + CABIN_W / 2;
    const x0 = islandX(MY_ISLAND) - CABIN_W / 2;
    const y0 = 0.22;
    // the honk button: a little black box with a yellow button
    const horn = new THREE.Group();
    horn.position.set(x1 - 0.3, y0 + 0.975, -0.85);
    kit.box(0.14, 0.06, 0.14, std('#1c1c1c'), 0, 0.03, 0, horn);
    const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.035, 10), std('#f1c40f', { emissive: '#6a5000', emissiveIntensity: 0.5 }));
    hb.position.y = 0.075;
    horn.add(hb);
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.05), new THREE.MeshStandardMaterial({ map: textTexture(['HONK BACK', '(never)'], { w: 96, h: 40, bg: '#ffffff', fg: '#c0392b' }) }));
    tag.rotation.x = -Math.PI / 2;
    tag.rotation.z = Math.PI / 2;
    tag.position.set(-0.11, 0.005, 0);
    horn.add(tag);
    kit.scene.add(horn);
    this.interactive(horn, { kind: 'tlHorn' });
    // the master switch on the west wall, under a red flip cover
    const sw = new THREE.Group();
    sw.position.set(x0 + 0.13, y0 + 0.85, 1.0);
    sw.rotation.y = Math.PI / 2;
    kit.box(0.26, 0.3, 0.06, std('#6b737a', { metalness: 0.5 }), 0, 0, 0, sw);
    const toggle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.05), std('#d42a1e'));
    toggle.position.set(0, 0, 0.05);
    sw.add(toggle);
    const cover = new THREE.Group();
    cover.position.set(0, 0.1, 0.06);
    const cv = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.05), new THREE.MeshStandardMaterial({ color: '#ff3a2a', transparent: true, opacity: 0.75, roughness: 0.2 }));
    cv.position.set(0, -0.1, 0.03);
    cover.add(cv);
    sw.add(cover);
    this.cover = cover;
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.16), new THREE.MeshStandardMaterial({ map: textTexture(['ALL LANES CLOSE', 'DO NOT PRESS.', 'SERIOUSLY. -MGMT'], { w: 160, h: 76, bg: '#f1c40f', fg: '#111111' }) }));
    lab.position.set(0, 0.25, 0.032);
    sw.add(lab);
    kit.scene.add(sw);
    this.interactive(sw, { kind: 'tlSwitch' });
  }

  /** Lockers, a swivel chair, a coffee machine and a mirror in the staff room. */
  private staffRoom(): void {
    const kit = this.kit;
    const by = TOILET.z0 + 4.2;
    const doorMat = std('#7a8a9a', { metalness: 0.4, roughness: 0.6 });
    for (let i = 0; i < 4; i++) {
      const x = TOILET.x0 + 0.1 + i * 0.52;
      const pivot = new THREE.Group();
      pivot.position.set(x - 0.24, 0, by + 0.47);
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.47, 1.82, 0.03), doorMat);
      d.position.set(0.235, 0.95, 0);
      pivot.add(d);
      for (const y of [1.55, 1.63, 1.71]) kit.box(0.28, 0.022, 0.01, std('#1c1c1c'), 0.235, y, 0.02, pivot);
      kit.box(0.03, 0.12, 0.03, std('#b8bec4', { metalness: 0.8 }), 0.4, 1.0, 0.03, pivot);
      const num = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.08), new THREE.MeshStandardMaterial({ map: textTexture([`${i + 1}`], { w: 32, h: 24, bg: '#f2ead2', fg: '#2c3e50' }) }));
      num.position.set(0.235, 1.4, 0.018);
      pivot.add(num);
      kit.scene.add(pivot);
      this.interactive(d, { kind: 'tlLocker', i });
      this.lockers.push({ pivot, open: false, angle: 0, max: -1.7, axis: 'y' });
    }
    // a swivel chair
    const chair = new THREE.Group();
    chair.position.set(26.4, 0, 9.2);
    chair.rotation.y = 0.6;
    if (!kit.prop('tlChair', 0, 0, 0, 0, chair)) {
      kit.box(0.5, 0.08, 0.5, std('#2c2c2c'), 0, 0.48, 0, chair);
      kit.box(0.5, 0.55, 0.06, std('#2c2c2c'), 0, 0.8, 0.22, chair);
    }
    kit.scene.add(chair);
    kit.movable(chair, 'Swivel Chair', { holdPos: [0.6, -0.95, -1.15], holdRotY: 0.7, heavy: 0.8, pickupLine: 'The only chair on the plaza. It swivels. You do not have time to swivel.' });
    // a trash can full of receipts
    const can = new THREE.Group();
    can.position.set(22.2, 0, 9.0);
    if (!kit.prop('tlTrash', 0, 0, 0, 0, can)) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.5, 10), std('#5d6b74'));
      m.position.y = 0.25;
      can.add(m);
    }
    kit.scene.add(can);
    kit.movable(can, 'Trash Can', { holdPos: [0.3, -0.5, -0.8], pickupLine: 'A trash can. It is full of receipts nobody wanted. Executive Unit 5 would weep.' });
    // a counter with a coffee machine for humans
    const cof = new THREE.Group();
    cof.position.set(28.4, 0, 11.75);
    kit.box(1.0, 0.9, 0.6, std('#8a7a60'), 0, 0.45, 0, cof);
    if (!kit.prop('coffee', 0, 0.9, 0, Math.PI, cof)) kit.box(0.35, 0.45, 0.3, std('#2a2a2a'), 0, 1.12, 0, cof);
    const cl = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshStandardMaterial({ map: textTexture(['COFFEE', 'for humans', '(decaf. no cups.)'], { w: 128, h: 64, bg: '#3a2a20', fg: '#f0b43c' }) }));
    cl.position.set(0, 0.55, -0.305);
    cl.rotation.y = Math.PI;
    cof.add(cl);
    kit.scene.add(cof);
    const cofC = kit.solid(28.4, 11.75, 1.0, 0.6, 1.3, false, 'decor');
    this.interactive(cof, { kind: 'tlCoffee' });
    kit.breakable(cof, {
      name: 'coffee machine',
      collider: cofC,
      hp: 2,
      price: 79,
      line: 'The coffee machine bursts. It was full of decaf. Nobody notices the difference.',
      colors: ['#2a2a2a', '#8a7a60', '#3a2010'],
      onBreak: () => {
        this.s.makePuddle(28.2, 11.0);
        this.s.makePuddle(27.6, 11.3);
      },
    });
    // a "motivational" mirror on the north wall
    const mir = new THREE.Group();
    mir.position.set(26.9, 1.55, TOILET.z0 + 9.37);
    mir.rotation.y = Math.PI;
    kit.box(0.7, 0.9, 0.04, std('#4a3a2a'), 0, 0, 0, mir);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.62), new THREE.MeshStandardMaterial({ color: '#9fb8c8', metalness: 0.9, roughness: 0.1 }));
    glass.position.set(0, 0.08, 0.025);
    mir.add(glass);
    const ml = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.12), new THREE.MeshStandardMaterial({ map: textTexture(['YOU ARE DOING GREAT', '(results may vary)'], { w: 192, h: 40, bg: '#111111', fg: '#7dff9a' }) }));
    ml.position.set(0, -0.33, 0.025);
    mir.add(ml);
    kit.scene.add(mir);
    this.interactive(mir, { kind: 'tlMirror' });
    kit.breakable(mir, { name: 'motivational mirror', price: 45, line: 'The mirror shatters. Seven years of bad performance reviews. You already had those.' });
  }

  /** The hollow half of the shipping container: a lounge somebody built in secret. */
  private lounge(): void {
    const kit = this.kit;
    const r = this.loungeRect;
    const cx = (r.minX + r.maxX) / 2;
    // a rug, a lamp, a chair, a TV, a mini fridge and posters
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.2), new THREE.MeshStandardMaterial({ map: textTexture(['~ ~ ~', 'WELCOME', '~ ~ ~'], { w: 96, h: 128, bg: '#7a2a4a', fg: '#e8b04a' }) }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(cx, 0.05, -2.9);
    kit.scene.add(rug);
    const chair = kit.prop('tlLounge', cx - 0.3, 0.04, -2.3, Math.PI * 0.85);
    if (!chair) {
      kit.box(0.7, 0.4, 0.8, std('#4a6a8a'), cx - 0.3, 0.24, -2.3);
      kit.box(0.7, 0.6, 0.15, std('#4a6a8a'), cx - 0.3, 0.6, -1.95);
    }
    this.interactive(kit.box(0.8, 0.9, 0.9, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), cx - 0.3, 0.45, -2.3), { kind: 'tlLoungeChair' });
    // TV on a crate facing the chair
    kit.box(0.6, 0.5, 0.45, std('#6a4a2a'), cx - 0.2, 0.29, -4.05);
    const tvg = new THREE.Group();
    tvg.position.set(cx - 0.2, 0.54, -4.05);
    kit.box(0.5, 0.42, 0.36, std('#5a4630'), 0, 0.21, 0, tvg);
    kit.box(0.42, 0.34, 0.02, std('#1a1a1a'), 0, 0.21, 0.18, tvg);
    kit.box(0.02, 0.25, 0.02, std('#888888'), -0.08, 0.53, 0, tvg).rotation.z = 0.4;
    kit.box(0.02, 0.25, 0.02, std('#888888'), 0.08, 0.53, 0, tvg).rotation.z = -0.4;
    this.tv = this.canvasScreen(64, 48);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.28), new THREE.MeshBasicMaterial({ map: this.tv.tex }));
    scr.position.set(0, 0.21, 0.195);
    tvg.add(scr);
    kit.scene.add(tvg);
    this.interactive(tvg, { kind: 'tlTv' });
    // mini fridge
    kit.box(0.45, 0.6, 0.45, std('#d8d2c4'), r.minX + 0.3, 0.34, -1.75);
    kit.box(0.02, 0.2, 0.02, std('#888888'), r.minX + 0.45, 0.45, -1.98);
    // posters and a string of lights
    kit.sign(['THE REAL', 'BREAK ROOM', 'members: 1'], 0.9, 0.7, r.minX + 0.03, 1.5, -2.9, Math.PI / 2, { bg: '#1d3f8a', fg: '#f2d31b', font: PX }, 'THE REAL BREAK ROOM. Members: 1. The member stopped coming in 2069. The membership is open.');
    kit.sign(['DO NOT TELL', 'BRAD'], 0.8, 0.4, cx, 1.7, -4.36, 0, { bg: '#f2ead2', fg: '#c0392b', border: '#c0392b' });
    const bulbs = [new THREE.MeshBasicMaterial({ color: '#ff5050' }), new THREE.MeshBasicMaterial({ color: '#50ff70' }), new THREE.MeshBasicMaterial({ color: '#5090ff' }), new THREE.MeshBasicMaterial({ color: '#ffd24f' })];
    for (let i = 0; i < 12; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 4), bulbs[i % 4]);
      b.position.set(r.minX + 0.08 + (i / 11) * 1.95, 2.3 - Math.sin((i / 11) * Math.PI) * 0.15, -4.35);
      kit.scene.add(b);
    }
    const l = new THREE.PointLight('#ffb070', 6, 5, 1.6);
    l.position.set(cx, 2.0, -2.9);
    kit.scene.add(l);
    // a floor lamp you can take
    const lamp = new THREE.Group();
    lamp.position.set(r.maxX - 0.3, 0.04, -1.7);
    if (!kit.prop('tlLamp', 0, 0, 0, 0, lamp)) {
      kit.box(0.05, 1.3, 0.05, std('#333333'), 0, 0.65, 0, lamp);
      kit.box(0.3, 0.25, 0.3, std('#f2ead2'), 0, 1.4, 0, lamp);
    }
    kit.scene.add(lamp);
    kit.movable(lamp, 'Floor Lamp (Lounge)', { holdPos: [0.3, -0.9, -0.9], pickupLine: 'A floor lamp from the secret lounge. It is warm. Somebody left it on since 2069.' });
    kit.hideSpot(r.minX, r.minZ, r.maxX, r.maxZ, 'the shipping container');
  }

  /** Behind the toilet booth, in the gap nobody walks into: a shrine for the human booths. */
  private shrine(): void {
    const kit = this.kit;
    const x = TOILET.x0 + 4.8;
    const z = TOILET.z0 - 0.55;
    kit.box(0.5, 0.6, 0.35, std('#5a4a3a'), x, 0.3, z);
    const flame = new THREE.MeshBasicMaterial({ color: '#ffb347' });
    for (let i = 0; i < 5; i++) {
      kit.box(0.04, 0.1 + (i % 3) * 0.04, 0.04, std('#f2ead2'), x - 0.18 + i * 0.09, 0.66 + (i % 3) * 0.02, z + 0.05);
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.018, 5, 4), flame);
      f.position.set(x - 0.18 + i * 0.09, 0.74 + (i % 3) * 0.04, z + 0.05);
      kit.scene.add(f);
    }
    const names = ['BOOTH 1', 'BOOTH 2', 'BOOTH 4', 'BOOTH 5', 'BOOTH 6'];
    names.forEach((n, i) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.4), new THREE.MeshStandardMaterial({ map: textTexture([n, ':)', 'automated', `${2061 + i}`], { w: 64, h: 80, bg: '#f2ead2', fg: '#2c3e50', border: '#6e4b2a' }) }));
      p.position.set(x - 2.0 + i * 0.55, 1.3 + (i % 2) * 0.12, TOILET.z0 - 0.09);
      p.rotation.y = Math.PI;
      kit.scene.add(p);
    });
    const l = new THREE.PointLight('#ffa050', 3, 3.5, 1.8);
    l.position.set(x, 0.9, z);
    kit.scene.add(l);
    this.interactive(kit.box(0.6, 1.0, 0.45, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), x, 0.5, z), { kind: 'tlShrine' });
    kit.solid(x, z, 0.5, 0.35, 0.8, false, 'decor');
    kit.hideSpot(TOILET.x0 + 0.6, TOILET.z0 - 1.05, TOILET.x0 + 5.45, TOILET.z0 - 0.1, 'the gap behind the toilet');
  }

  private buildBreakables(): void {
    const kit = this.kit;
    // a camera on the staff building, over the door
    const cam = new THREE.Group();
    cam.position.set(TOILET.x0 - 2.35, 2.6, TOILET.z0 + 3.5);
    cam.rotation.y = -Math.PI / 2;
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
    kit.scene.add(cam);
    kit.breakable(cam, { name: 'security camera', price: 349, line: 'The camera breaks. Somewhere in a server farm, Brad blinks.', onBreak: () => this.cameraBroken() });

    // the staff crossing light by the zebra
    const cl = new THREE.Group();
    cl.position.set(18.6, 0, 10.9);
    kit.box(0.1, 2.6, 0.1, std('#5c6166', { metalness: 0.5 }), 0, 1.3, 0, cl);
    kit.box(0.28, 0.6, 0.22, std('#222222'), 0, 2.4, 0, cl);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.02), new THREE.MeshBasicMaterial({ color: '#ff3030' }));
    red.position.set(-0.12, 2.55, 0);
    red.rotation.y = Math.PI / 2;
    cl.add(red);
    const grn = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.02), new THREE.MeshBasicMaterial({ color: '#1a3a1a' }));
    grn.position.set(-0.12, 2.3, 0);
    grn.rotation.y = Math.PI / 2;
    cl.add(grn);
    kit.box(0.2, 0.16, 0.14, std('#f1c40f'), -0.03, 1.1, 0, cl);
    kit.scene.add(cl);
    const clc = kit.solid(18.6, 10.9, 0.25, 0.25, 2.6, false, 'decor');
    this.interactive(cl, { kind: 'tlCrossing' });
    kit.breakable(cl, { name: 'crossing light', collider: clc, price: 260, line: 'The crossing light falls over. It was red for eleven years. Nobody ever stopped for it.' });

    // the card reader of booth 4 spits out its savings
    const rd = kit.reader4;
    if (rd) {
      kit.breakable(rd.group, {
        name: 'card reader',
        collider: rd.collider,
        hp: 2,
        price: 410,
        line: 'The card reader coughs up its savings. Coins everywhere. Robots never pay with coins. Except to the human.',
        onBreak: () => {
          const p = rd.group.position;
          for (let i = 0; i < 4; i++) {
            const it = this.s.addItem(COIN_DEF, new THREE.Vector3(p.x, 1.4, p.z));
            it.vel.set(rand(-2.5, 2.5), rand(2, 4), rand(-2, 2));
            it.sleeping = false;
          }
        },
      });
    }

    // an A-frame sign on the island of booth 3
    const af = new THREE.Group();
    af.position.set(islandX(MY_ISLAND) + 0.2, 0.22, 5.0);
    af.rotation.y = Math.PI / 2;
    const afMat = new THREE.MeshStandardMaterial({ map: textTexture(['SLOW', 'HUMAN', 'AT WORK', '(very slow)'], { w: 128, h: 180, bg: '#f1c40f', fg: '#111111', border: '#111111', font: PX }) });
    for (const sd of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.9, 0.03), [std('#222222'), std('#222222'), std('#222222'), std('#222222'), afMat, afMat]);
      p.position.set(0, 0.45, sd * 0.1);
      p.rotation.x = -sd * 0.18;
      af.add(p);
    }
    kit.scene.add(af);
    const afc = kit.solid(af.position.x, 5.0, 0.4, 0.7, 1.1, false, 'decor');
    kit.breakable(af, { name: 'SLOW HUMAN sign', collider: afc, price: 39.99, line: 'You break the SLOW HUMAN AT WORK sign. You are still a slow human at work.' });

    // the price board on the nose of the island
    const pb = new THREE.Group();
    pb.position.set(islandX(MY_ISLAND), 0.22, -7.7);
    pb.rotation.y = Math.PI;
    kit.box(0.08, 1.4, 0.08, std('#5c6166', { metalness: 0.5 }), -0.5, 0.7, 0, pb);
    kit.box(0.08, 1.4, 0.08, std('#5c6166', { metalness: 0.5 }), 0.5, 0.7, 0, pb);
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 0.05), [std('#1f6b3a'), std('#1f6b3a'), std('#1f6b3a'), std('#1f6b3a'), new THREE.MeshStandardMaterial({ map: textTexture(['TOLL 2.00 CR', 'exact change', 'no change', 'no mercy'], { w: 192, h: 120, bg: '#1f6b3a', fg: '#ffffff', border: '#ffffff', font: PX }) }), std('#1f6b3a')]);
    board.position.y = 1.35;
    pb.add(board);
    kit.scene.add(pb);
    const pbc = kit.solid(islandX(MY_ISLAND), -7.7, 1.2, 0.2, 1.8, false, 'decor');
    kit.breakable(pb, { name: 'price board', collider: pbc, price: 180, line: 'The price board shatters. For one second, tolls are free. Then they are not.' });
  }

  /** What the portable toilet in the yard hides. */
  private executiveToilet(): void {
    const kit = this.kit;
    const px = BOUNDS.minX + 1.1;
    const pz = YARD.z - 4.6;
    const gold = (o: THREE.Object3D) =>
      o.traverse((c) => {
        const m = c as THREE.Mesh;
        if (!m.isMesh) return;
        const f = (mat: THREE.Material) => {
          const g = (mat as THREE.MeshStandardMaterial).clone();
          g.color.set('#ffd24f');
          g.metalness = 0.9;
          g.roughness = 0.25;
          return g;
        };
        m.material = Array.isArray(m.material) ? m.material.map(f) : f(m.material);
      });
    const t = kit.prop('toilet', px - 0.2, 0.06, pz, Math.PI / 2);
    if (t) gold(t);
    else {
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.42, 12), std('#ffd24f', { metalness: 0.9, roughness: 0.25 }));
      bowl.position.set(px - 0.2, 0.27, pz);
      kit.scene.add(bowl);
    }
    const goldMat = std('#ffd24f', { metalness: 0.9, roughness: 0.25 });
    for (const dz of [-0.38, 0.38]) kit.box(0.04, 0.8, 0.04, goldMat, px + 0.3, 0.46, pz + dz);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.76, 6), std('#a0101a'));
    rope.rotation.x = Math.PI / 2;
    rope.position.set(px + 0.3, 0.75, pz);
    kit.scene.add(rope);
    kit.sign(['EXECUTIVE', 'RELIEF STATION', 'CEO ONLY'], 0.8, 0.5, px - 0.52, 1.6, pz, Math.PI / 2, { bg: '#1a0f18', fg: '#ffd24f', border: '#ffd24f', font: PX });
    this.portaLight = new THREE.PointLight('#ffd27a', 0, 3, 1.6);
    this.portaLight.position.set(px, 1.9, pz);
    kit.scene.add(this.portaLight);
  }

  private buildUfo(): void {
    const g = new THREE.Group();
    const hull = new THREE.MeshBasicMaterial({ color: '#8a9aa8', fog: false });
    const dome = new THREE.MeshBasicMaterial({ color: '#7dffd0', fog: false, transparent: true, opacity: 0.85 });
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(4, 1.6, 1.0, 16), hull);
    g.add(disc);
    const under = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 2.4, 0.6, 16), new THREE.MeshBasicMaterial({ color: '#4a5a68', fog: false }));
    under.position.y = -0.8;
    g.add(under);
    const top = new THREE.Mesh(new THREE.SphereGeometry(1.6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), dome);
    top.position.y = 0.45;
    g.add(top);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.MeshBasicMaterial({ color: '#ff5050', fog: false });
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 4), m);
      const a = (i / 8) * Math.PI * 2;
      b.position.set(Math.cos(a) * 3.6, -0.1, Math.sin(a) * 3.6);
      g.add(b);
      this.ufoLights.push(m);
    }
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 4.5, 18, 12, 1, true), new THREE.MeshBasicMaterial({ color: '#c8ffe0', fog: false, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }));
    beam.position.y = -9.5;
    g.add(beam);
    g.position.set(-48, 18, -34);
    g.scale.setScalar(1.5);
    g.visible = false;
    this.kit.scene.add(g);
    this.ufo = g;
  }

  // ================================================================ shift

  start(s: Shift, ctx: FunCtx): void {
    this.s = s;
    this.ctx = ctx;
    this.secretLocker = Math.floor(Math.random() * 4);
    // the lucky coin is somewhere odd
    const spots: [number, number, number][] = [
      [ROAD_X0 - 2.4, 1.41, -16], // on the SOS pillar
      [28.5, 1.91, TOILET.z0 + 6.6], // on the staff vending machine
      [islandX(1) + 0.75, 1.76, -2.6], // on the card reader of booth 2
      [YARD.x - 1.3, 1.21, YARD.z + 0.9], // on the yard crates
      [islandX(0) + 0.58, 1.33, BARRIER_Z], // on the barrier housing of lane 1
      [TOILET.x0 + 0.8, 1.91, TOILET.z0 + 4.4], // on the staff lockers
      [islandX(4) + 0.6, 0.96, -9.5], // on a crash cushion of island 4
      [-24.7, 0.65, -1.75], // on the mini fridge in the container
    ];
    const [x, y, z] = pick(spots);
    this.lucky = s.addItem(LUCKY_DEF, new THREE.Vector3(x, y, z), true);
    // the UFO shows up in some shifts only
    if (Math.random() < 0.35) this.ufoAt = rand(35, 200);
    this.drawTv(0);
  }

  update(dt: number): void {
    const s = this.s;
    for (const d of [...this.lockers, this.container, this.porta]) {
      const target = d.open ? d.max : 0;
      d.angle += (target - d.angle) * Math.min(1, dt * 6);
      d.pivot.rotation.y = d.angle;
    }
    this.kit.container.collider.disabled = this.container.angle > 0.6;
    this.cover.rotation.x = this.coverOpen ? -1.9 : 0;
    // the lucky coin
    if (this.lucky && s.held === this.lucky) {
      this.lucky = null;
      s.secret('toll.lucky');
    }
    if (this.lucky) this.lucky.mesh.rotation.y += dt * 1.5;
    // the lounge
    const p = s.player.pos;
    const r = this.loungeRect;
    const inside = p.x > r.minX && p.x < r.maxX && p.z > r.minZ && p.z < r.maxZ;
    if (inside && !this.inLounge) {
      s.secret('toll.lounge');
      s.chat('lounge', {}, 2);
    }
    this.inLounge = inside;
    if (Math.floor(s.t * 3) !== Math.floor((s.t - dt) * 3)) this.drawTv(s.t);
    this.updateAllStop(dt);
    this.updateUfo(dt);
  }

  private drawTv(t: number): void {
    const { g, tex } = this.tv;
    g.fillStyle = '#20304a';
    g.fillRect(0, 0, 64, 48);
    g.fillStyle = '#f2d31b';
    g.font = '7px monospace';
    g.fillText('HUMANS:', 4, 12);
    g.fillText('A DOCUMENTARY', 4, 22);
    // a little human walking across the screen
    const x = Math.floor((t * 6) % 70) - 4;
    g.fillStyle = '#ffd2a0';
    g.fillRect(x, 30, 3, 3);
    g.fillStyle = '#2e86c1';
    g.fillRect(x, 33, 3, 5);
    g.fillStyle = '#ffffff';
    g.fillRect(x + (Math.floor(t * 4) % 2), 38, 1, 3);
    g.fillRect(x + 2 - (Math.floor(t * 4) % 2), 38, 1, 3);
    tex.needsUpdate = true;
  }

  private updateAllStop(dt: number): void {
    const s = this.s;
    const myLaneBarrier = (lane: number) => this.kit.barriers.find((b) => b.lane === lane);
    if (this.allStopT > 0) {
      this.allStopT -= dt;
      for (const b of this.kit.barriers) b.target = 0;
      for (const c of this.ctx.cars()) {
        if (c.lane === MY_LANE || c.offroad || c.lane < 1) continue;
        const front = c.z + c.len / 2;
        const prev = c.data.pf ?? front;
        c.data.pf = front;
        const b = myLaneBarrier(c.lane);
        if (!b || b.broken || prev >= BARRIER_Z - 0.05 || front < BARRIER_Z - 0.05 || b.angle > 1.0) continue;
        b.broken = true;
        this.snapped++;
        s.sfx.thud();
        s.sfx.noise(0.3, 0.2, 1800);
        bubbles.say(c.head, 0.8, pick(['I do not stop. You know I do not stop.', 'An arm? Down? In a ROBOT lane?', 'Collision logged. Blame assigned. To the human.']), 2.5, c.name);
        s.hype += 6;
      }
      if (this.allStopT <= 0) {
        this.repairT = 6;
        if (this.snapped) s.say(`The master switch flips back. ${this.snapped} robot arms are lying on the autobahn. Repair drones are on their way. Your arm is not on their list.`, 5);
      }
    } else {
      for (const c of this.ctx.cars()) c.data.pf = c.z + c.len / 2;
    }
    if (this.repairT > 0) {
      this.repairT -= dt;
      if (this.repairT <= 0) {
        let n = 0;
        for (const b of this.kit.barriers) {
          if (b.lane === MY_LANE || !b.broken) continue;
          b.broken = false;
          b.length = 1;
          n++;
        }
        if (n) s.say('Repair drones replace the robot arms in 0.4 seconds. They wave at you. It is not a friendly wave.', 4);
      }
    }
  }

  private updateUfo(dt: number): void {
    const s = this.s;
    const u = this.ufo;
    if (this.ufoGone) {
      if (u.visible) {
        u.position.y += dt * 30;
        u.position.x -= dt * 25;
        if (u.position.y > 90) u.visible = false;
      }
      return;
    }
    if (this.ufoT < 0) {
      if (s.t > this.ufoAt) {
        this.ufoT = 0;
        u.visible = true;
      }
      return;
    }
    this.ufoT += dt;
    u.position.set(-48 + Math.sin(this.ufoT * 0.3) * 8, 18 + Math.sin(this.ufoT * 1.3) * 0.8, -34 + Math.cos(this.ufoT * 0.3) * 5);
    u.rotation.y += dt * 0.8;
    this.ufoLights.forEach((m, i) => m.color.set((Math.floor(this.ufoT * 6) + i) % 2 ? '#ff5050' : '#ffd24f'));
    // are you looking right at it?
    s.camera.getWorldPosition(this.cam);
    s.camera.getWorldDirection(this.dir);
    const to = u.position.clone().sub(this.cam).normalize();
    if (to.dot(this.dir) > 0.996) this.ufoSeen += dt;
    else this.ufoSeen = Math.max(0, this.ufoSeen - dt * 0.5);
    if (this.ufoSeen > 0.9) {
      this.ufoGone = true;
      s.secret('toll.ufo');
      s.chat('ufo', {}, 3);
      s.say('The thing over the field notices you noticing it. It leaves. Very fast. Nobody will believe you. You do not believe you.', 5);
      s.sfx.tone(900, 0.8, 'sine', 0.06, 2400);
    }
    // it only stays for a while
    if (this.ufoT > 50) {
      this.ufoGone = true;
      s.chat('ufo', {}, 1);
    }
  }

  // ================================================================ E key

  hint(look: Look | null): string | null {
    const info = look?.info;
    if (!info || !look) return null;
    switch (info.kind) {
      case 'tlRadio':
        return 'E: change the station';
      case 'tlHorn':
        return 'E: honk';
      case 'tlSwitch':
        return this.coverOpen ? 'E: press it. Do it.' : 'E: lift the cover';
      case 'tlSos':
        return 'E: pick up the emergency phone';
      case 'tlLocker':
        return this.lockers[info.i as number].open ? 'E: close the locker' : `E: open locker ${(info.i as number) + 1}`;
      case 'tlContainer':
        return this.container.open ? 'E: close the container' : 'E: open the container';
      case 'tlPorta':
        return this.porta.open ? 'The executive toilet' : 'E: read the note';
      case 'tlTv':
        return 'E: change the channel';
      case 'tlLoungeChair':
        return 'E: sit for a second';
      case 'tlShrine':
        return 'E: look at the shrine';
      case 'tlCoffee':
        return 'E: get a coffee';
      case 'tlMirror':
        return 'E: look at yourself';
      case 'tlCrossing':
        return 'E: press the crossing button';
    }
    return null;
  }

  interact(look: Look | null): boolean {
    const s = this.s;
    const info = look?.info;
    if (!info || !look) return false;
    switch (info.kind) {
      case 'tlRadio':
        this.station = (this.station + 1) % RADIO.length;
        s.say(RADIO[this.station], 4.5);
        s.sfx.noise(0.25, 0.08, 2500, 0, 0.6, 'bandpass');
        if (this.station === RADIO.length - 1) s.secret('toll.radio');
        else s.sfx.tone(300 + this.station * 110, 0.15, 'triangle', 0.04, undefined, 0.25);
        return true;
      case 'tlHorn':
        this.honkBack();
        return true;
      case 'tlSwitch':
        if (!this.coverOpen) {
          this.coverOpen = true;
          s.sfx.click();
          s.say('You lift the red cover. Underneath is a switch. It says ALL LANES. It is begging.', 3);
        } else this.pressAllStop();
        return true;
      case 'tlSos':
        this.sosCalls++;
        s.sfx.tone(440, 0.4, 'sine', 0.05);
        s.sfx.tone(480, 0.4, 'sine', 0.05, undefined, 0.5);
        if (this.sosCalls === 1) {
          s.secret('toll.sos');
          setTimeout(() => s.bossSay('sosCall', true), 1100);
          s.annoyance += 4;
        } else s.say(pick(['The line is busy. Brad is on the phone with himself.', 'An automated voice. "Your emergency is important to us. You are number 41,000 in the queue."', 'You hear breathing. It is the wind. It is probably the wind.']), 3.5);
        return true;
      case 'tlLocker':
        this.useLocker(info.i as number);
        return true;
      case 'tlContainer':
        this.container.open = !this.container.open;
        s.sfx.tone(this.container.open ? 120 : 90, 0.4, 'sawtooth', 0.04, this.container.open ? 160 : 70);
        s.sfx.noise(0.3, 0.2, 600);
        if (this.container.open) s.say('The container door creaks open. It was not locked. Nobody ever tried.', 3);
        return true;
      case 'tlPorta':
        if (this.porta.open) s.say('A golden toilet. The sign says "EXECUTIVE RELIEF STATION. CEO ONLY. The CEO is a robot and does not need it. That is the point."', 5);
        else s.say('A portable toilet. Locked since 2069. A note says "Reserved for the CEO. He is a robot. He does not need it." The door rattles a little.', 4);
        return true;
      case 'tlTv':
        s.say(pick(['HUMANS, A DOCUMENTARY. Episode 3 is "The Lunch Break". A narrator robot whispers "Look how it chews."', 'A nature channel. A human sits in a booth for eight hours. The robots in the audience cry.', 'Channel 4 shows the lane 3 camera. You see yourself watching TV. You look busy.']), 4.5);
        s.sfx.noise(0.2, 0.06, 3000, 0, 0.5, 'highpass');
        return true;
      case 'tlLoungeChair':
        s.say('You sit down in the lounge chair. For two seconds nothing is counted. A note in the cushion says "If you found this, you are the new member. Welcome. Bring snacks."', 4.5);
        s.sfx.tone(200, 0.3, 'sine', 0.05, 120);
        return true;
      case 'tlShrine':
        s.say('A shrine. Five photos of toll booths and five candles. "Booth 1, Booth 2, Booth 4, Booth 5, Booth 6. Automated 2061 to 2065. Booth 3 is next. Light a candle."', 5);
        s.secret('toll.shrine');
        return true;
      case 'tlCoffee':
        s.say(pick(['COFFEE FOR HUMANS. Decaf. No cups. You hold your hands under it. It is warm water. It is the best part of your shift.', 'The machine says "Brewing." It has been brewing since 2068.']), 4);
        s.sfx.noise(0.6, 0.1, 500, 0, 0.8);
        return true;
      case 'tlMirror':
        s.say(pick(['YOU ARE DOING GREAT, says the mirror. The mirror is a screen. It says this to everybody.', 'You look tired. The mirror shows a small advert for ROBO-UPGRADE under your face.']), 3.5);
        return true;
      case 'tlCrossing':
        s.sfx.beep();
        s.say(pick(['You press the button. WAIT, says the light. It has said WAIT since 2060.', 'BEEP. The light stays red. A robot car honks at the idea of you crossing.']), 3);
        return true;
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
    if (i === this.secretLocker && !this.lockerFound) {
      this.lockerFound = true;
      s.say(`Locker ${i + 1} holds a name badge "HUMAN #2, BOOTH 3", a coin album with one empty slot and a note. "The lucky 1987 coin is still out there. It is worth nothing. That is the point."`, 6);
      s.secret('toll.locker');
      return;
    }
    s.say(LOCKER_JUNK[i], 3.5);
  }

  private honkBack(): void {
    const s = this.s;
    s.sfx.tone(392, 0.5, 'square', 0.1);
    s.sfx.tone(494, 0.5, 'square', 0.08);
    const near = this.ctx.cars().filter((c) => c.lane === MY_LANE && !c.passed && c.z > -40 && c.z < 2);
    near.forEach((c, i) => {
      setTimeout(() => {
        if (c.dead) return;
        bubbles.say(c.head, 0.8, pick(['HONK?', 'Did the booth just honk?', 'HONK HONK (confused)', '...honk.']), 2, c.name);
        s.sfx.tone(300 + Math.random() * 200, 0.25, 'square', 0.04);
      }, 400 + i * 250);
    });
    s.hype += near.length ? 8 : 3;
    s.chat('horn', {}, 2);
    s.say(near.length ? 'You honk at the traffic. The traffic honks back. You are in a conversation now.' : 'You honk at the empty lane. The fog honks back. Probably.', 3);
    s.secret('toll.horn');
  }

  private pressAllStop(): void {
    const s = this.s;
    if (this.allStopT > 0) {
      s.say('It is already down. You press it harder. Nothing changes. It feels great.', 2.5);
      return;
    }
    this.allStopT = 6;
    this.snapped = 0;
    s.sfx.alarm();
    s.secret('toll.allstop');
    s.chat('allStop', {}, 3);
    s.hype += 25;
    s.annoyance += 15;
    s.say('ALL LANES CLOSED. Six arms come down at once. The robot lanes have never seen a closed arm. They do not know how to stop. They never learned.', 5);
    setTimeout(() => s.bossSay('allStop', true), 5500);
  }

  // ================================================================ kicks

  onKick(look: Look | null): boolean {
    const s = this.s;
    const info = look?.info;
    if (!info) return false;
    switch (info.kind) {
      case 'vending': {
        this.vendKicks++;
        s.sfx.thud();
        s.sfx.noise(0.3, 0.3, 400);
        const v = new THREE.Vector3(28.5 - 0.6, 0.6, TOILET.z0 + 6.6);
        const drop = (def: ItemDef) => {
          const it = s.addItem(def, v.clone().add(new THREE.Vector3(0, 0, rand(-0.2, 0.2))));
          it.vel.set(-2, 1, rand(-0.5, 0.5));
          it.sleeping = false;
        };
        if (this.vendKicks === 3) {
          drop(HOPE_DEF);
          s.say('The machine shudders and drops a can of HOPE. It was in stock the whole time. It was just stuck.', 4);
          s.secret('toll.hope');
          s.chat('hope', {}, 2);
        } else if (this.vendKicks < 3 || Math.random() < 0.5) {
          drop(OIL_DEF);
          s.say(pick(['The machine drops a can of oil. For robots. You are holding robot food now.', 'Clunk. A can of oil. The machine says "Thank you for your custom."']), 3);
        } else s.say('The machine is empty. It sighs. Machines can sigh now.', 2.5);
        if (s.seen) s.annoyance += 6;
        return true;
      }
      case 'tlPorta': {
        if (this.porta.open) return false;
        this.portaKicks++;
        s.sfx.thud();
        s.sfx.noise(0.2, 0.3, 500);
        if (this.portaKicks >= 3) {
          this.porta.open = true;
          this.portaLight.intensity = 6;
          s.say('The door of the portable toilet gives up. Inside are a golden toilet, a velvet rope and a sign that says "EXECUTIVE RELIEF STATION. CEO ONLY."', 5);
          s.secret('toll.porta');
          s.hype += 12;
        } else s.say(this.portaKicks === 1 ? 'You kick the portable toilet. Something inside clinks. Something golden.' : 'The door bends a little. The OUT OF ORDER sign falls a little more out of order.', 3);
        return true;
      }
    }
    return false;
  }

  /** The player kicked a car. */
  kickCar(c: Car): void {
    const s = this.s;
    const say = (t: string, sec = 3) => bubbles.say(c.head, 0.8, t, sec, c.name);
    s.sfx.thud();
    s.hype += 6;
    s.chat('kickCar', {}, 1);
    if (c.role === 'police') {
      this.ctx.fine(5);
      say('Assault on a police bumper. That is a 5 credit fine. Also a 5 credit fine for the paperwork.', 4.5);
      s.secret('toll.kickpolice');
      s.hype += 8;
      return;
    }
    if (c.role === 'ceo') {
      say('Do you know who I am? I am your boss\'s boss\'s boss\'s server. I will remember this. Forever. I have a lot of storage.', 4.5);
      return;
    }
    if (c.role === 'unpaid' && c.atWindow && !c.paid) {
      c.data.pay = Math.min(c.data.pay ?? 1, 0.05);
      say('OW. Fine. FINE. I will pay. You did not have to do that.', 3);
      return;
    }
    this.ctx.honk(c);
    say(pick(CAR_KICK), 2.6);
    if (s.seen) {
      s.annoyance += 5;
      s.bossSay('kickCar');
    }
  }

  /** A thrown cone landed on a car. */
  coneHat(c: Car, it: Item): void {
    const s = this.s;
    s.removeItem(it);
    it.mesh.position.set(0, 0.4, 0);
    it.mesh.rotation.set(0, 0, 0);
    it.mesh.scale.setScalar(0.65);
    c.head.add(it.mesh);
    c.data.hat = 1;
    bubbles.say(c.head, 1.2, pick(['I have been promoted to traffic management.', 'Is this... a hat? I feel important.', 'New firmware installed. HAT 1.0.']), 3, c.name);
    s.secret('toll.conehat');
    s.chat('conehat', {}, 2);
    s.hype += 12;
    s.sfx.tone(700, 0.15, 'square', 0.05, 1000);
  }

  private cameraBroken(): void {
    const s = this.s;
    setTimeout(() => s.bossSay('cameraBroken', true), 3000);
    s.annoyance += 10;
  }
}

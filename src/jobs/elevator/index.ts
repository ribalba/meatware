import * as THREE from 'three';
import type { Item } from '../../items';
import { clamp, pick, rand } from '../../util';
import type { Job, JobEntry, Look, Puddle, Shift } from '../types';
import { CAB, CABIN_SPOTS, FLOORS, GATE_Z, LEVER_SPOT, LOBBY_DOOR, LOBBY_MID, SHAFT_Z, SPACING, TOP, Tower, WAIT_SPOTS } from './building';
import { ElevatorFun, EV_BOSS, EV_CHAT, EV_SECRETS } from './fun';
import { heldWeight, LEFT_BEHIND, PARCEL_DEF } from './items';
import { MODELS } from './models';
import { Radio, SILENCE_FACTOR } from './music';
import { Passenger, Role } from './passengers';
import * as X from './texts';
import { ElevatorUi } from './ui';

/**
 * Job: ELEVATOR OPERATOR in SYNERGY TOWER, Elevator B.
 * Drive robots up and down with a brass lever, stop level, open the gate, survive the small talk.
 */

const QUOTA = 10;
const LIMIT = 560;
const HUMAN_KG = 80;
/** Lever notches -3..3 and their speeds in m/s. */
const NOTCH_SPEED = [-2.6, -1.2, -0.35, 0, 0.35, 1.2, 2.6];
const ACCEL = 2.4;
const BRAKE = 4.5;
const NOTCH_NAMES = ['FAST DOWN', 'DOWN', 'CREEP DOWN', 'STOP', 'CREEP UP', 'UP', 'FAST UP'];

interface Spawn {
  t: number;
  role: Role;
  floor: number;
  dest: number;
}

const SCRIPT: Spawn[] = [
  { t: 0, role: 'commuter', floor: 1, dest: 3 },
  { t: 3, role: 'commuter', floor: 4, dest: 1 },
  { t: 14, role: 'chatty', floor: 2, dest: 5 },
  { t: 34, role: 'exec', floor: 1, dest: 6 },
  { t: 58, role: 'toddler', floor: 3, dest: 2 },
  { t: 92, role: 'delivery', floor: 0, dest: 4 },
  { t: 122, role: 'influencer', floor: 5, dest: 0 },
  { t: 165, role: 'exec', floor: 2, dest: 5 },
  { t: 205, role: 'toddler', floor: 6, dest: 2 },
  { t: 240, role: 'chatty', floor: 4, dest: 0 },
];

export class ElevatorJob implements Job {
  info = {
    id: 'elevator',
    title: 'ELEVATOR OPERATOR',
    place: `${X.TOWER} (Elevator B)`,
    teaser: 'Going up. Emotionally down.',
    quotaLabel: 'DELIVERED',
    lockedDoor: 'Locked. The key is clipped to the 30 kg Elevator Safety Manual. The manual lives on the roof, with the machine.',
    bladderWarning: 'You really need to pee. The staff toilet is in the basement. The key is on the roof, clipped to a 30 kg safety manual.',
  };
  level: Tower;
  bossLines = { ...X.BOSS_LINES, ...EV_BOSS };
  chatLines = { ...X.CHAT_LINES, ...EV_CHAT };
  achievements = X.ACHIEVEMENTS;
  secrets = EV_SECRETS;

  private s!: Shift;
  private ui!: ElevatorUi;
  private radio!: Radio;
  private fun!: ElevatorFun;
  private kicked = 0;
  private passengers: Passenger[] = [];
  private cabinY = SPACING;
  private vel = 0;
  private notch = 0;
  private atLever = false;
  private gateTarget = 1;
  private gate = 1;
  private stall = 0;
  private stallsDue = [140, 232];
  private silence = 0;
  private cringe = 0;
  private talkCooldown = 0;
  private shake = 0;
  private wasMoving = false;
  private topSpeed = 0;
  private perfectStreak = 0;
  private overloaded = false;
  private overloadBeep = 0;
  private hum = 0;
  private lastFloorTick = 1;
  private gateIdle = 0;
  private gateClosedAtDest = 0;
  private boardCooldown = 0;
  private spawnTimer = 8;
  private scriptIndex = 0;
  private extraLamps = new Set<number>();
  private interlockSaid = 0;
  private levelFloor: number | null = 1;
  /** Cabin height when the gate last opened (a re-open on the same floor is not a stop). */
  private lastOpenY = SPACING;
  private offset = 0;
  private itemFloor = new Map<Item, number>();
  private frozen = new Set<Item>();
  private puddleFloor = new Map<Puddle, number>();
  private heldId = '';
  private c = {
    delivered: 0, perfect: 0, ok: 0, steps: 0, trips: 0, jolts: 0, awkward: 0, smallTalk: 0, angryTalk: 0, alarms: 0,
    stairs: 0, execComplaints: 0, crashes: 0, metres: 0, tips: 0, returned: 0, overloads: 0, stalls: 0, wrongFloors: 0,
    slips: 0, hits: 0, express: 0, dubstep: 0, panelHits: 0,
  };

  constructor(scene: THREE.Scene) {
    this.level = new Tower(scene);
  }

  // ---------------------------------------------------------------- setup

  start(shift: Shift): void {
    this.s = shift;
    this.ui = new ElevatorUi();
    this.radio = new Radio(shift.sfx);
    this.level.setGate(this.gate);
    this.fun = new ElevatorFun(shift, this.level, {
      levelFloor: () => this.levelFloor,
      gate: () => this.gate,
      setStation: (k) => this.setStation(k),
      station: () => this.radio.station,
      riders: () => this.riders(),
    });
    // Movable props that were built on a floor belong to that floor (frozen while it is away).
    for (const it of shift.items) {
      const f = this.level.floors.indexOf(it.mesh.parent as THREE.Group);
      if (f >= 0 && it.state === 'world') this.itemFloor.set(it, f);
    }
    addEventListener('keydown', (e) => this.onKey(e));
    // The first commuter already waits at the gate.
    const first = SCRIPT[0];
    const p = this.spawn(first.role, first.floor, first.dest);
    const ws = WAIT_SPOTS[p.waitSpot];
    p.pos.set(ws[0], 0, ws[1]);
    p.path = [];
    p.state = 'waiting';
    this.scriptIndex = 1;
  }

  // ---------------------------------------------------------------- engine queries

  obstacles(): { x: number; z: number; r: number }[] {
    return this.passengers
      .filter((p) => p.state !== 'gone' && (this.inCabinSpace(p) || p.floor === this.levelFloor))
      .map((p) => ({ x: p.pos.x, z: p.pos.z, r: p.radius }));
  }

  lookTargets(): THREE.Object3D[] {
    return this.passengers.filter((p) => p.state !== 'gone' && (this.inCabinSpace(p) || p.floor === this.levelFloor)).map((p) => p.group);
  }

  quota() {
    return { done: this.c.delivered, target: QUOTA };
  }

  hypeMultiplier(): number {
    return this.filmer() ? 2 : 1;
  }

  cameraLabel(): string {
    const f = this.filmer();
    return f ? `ON CAMERA: ${f.name} (elevator ASMR, hype x2)` : '';
  }

  heldLabel(it: Item): string {
    return it.def.id === 'evManual' ? ' [30 kg]' : '';
  }

  readonly helpKeys: [string, string][] = [['W/S', 'lever'], ['F', 'gate'], ['R', 'small talk'], ['1-5', 'music']];

  productive(): boolean {
    return this.c.delivered >= QUOTA - 3;
  }

  employeeOfTheMonth(pocket: { id: string }[], fired: boolean): string {
    if (pocket.some((p) => p.id === 'evPen') && !fired) return 'You. The golden pen signed the certificate itself.';
    return this.c.perfect >= 8 ? 'The Floor Dial (it always knows where it is)' : 'The Brass Lever (it never complains)';
  }

  reviewRows(): [string, string | number][] {
    const c = this.c;
    return [
      ['Robots delivered to their floor', c.delivered],
      ['Perfect stops (within 5 cm)', c.perfect],
      ['Stops with a "step"', c.steps],
      ['Robots who tripped over your step', c.trips],
      ['Emergency stops at full speed', c.jolts],
      ['Times you hit the end of the shaft', c.crashes],
      ['Awkward silences reached', c.awkward],
      ['Small talk attempts', c.smallTalk],
      ['Alarm bells rung', c.alarms],
      ['Robots who took the stairs instead', c.stairs],
      ['Executive complaints', c.execComplaints],
      ['Vertical metres travelled', Math.round(c.metres)],
    ];
  }

  payRows(): [string, number][] {
    const c = this.c;
    const s = this.s;
    const rows: [string, number][] = [];
    if (s.counter('toilet')) rows.push([`Safety manual rental x${s.counter('toilet')}`, -2 * s.counter('toilet')]);
    if (c.trips) rows.push([`Step liability (robot trips) x${c.trips}`, -3 * c.trips]);
    if (c.tips) rows.push(['Executive tips', c.tips], ['Executive tips (company property)', -c.tips]);
    if (c.smallTalk) rows.push([`Small talk licence x${c.smallTalk}`, -0.1 * c.smallTalk]);
    if (c.dubstep) rows.push(['Music licence: Dubstep for Accountants', -1.5]);
    if (c.crashes) rows.push([`Shaft buffer repair x${c.crashes}`, -6 * c.crashes]);
    if (c.panelHits) rows.push([`Panel percussive maintenance x${c.panelHits}`, -0.5 * c.panelHits]);
    if (c.returned) rows.push([`Lost & found finder's fee x${c.returned}`, 0]);
    rows.push(...this.fun.payRows());
    rows.push([`Altitude allowance (${Math.round(c.metres)} m)`, Math.round(c.metres) * 0.002]);
    return rows;
  }

  // ---------------------------------------------------------------- helpers

  private filmer(): Passenger | undefined {
    return this.passengers.find((p) => p.role === 'influencer' && p.state === 'riding');
  }

  private riders(): Passenger[] {
    return this.passengers.filter((p) => p.state === 'riding');
  }

  /** Robots whose group is in the cabin (riding, or half way through the gate on the cabin side). */
  private inCabinSpace(p: Passenger): boolean {
    return p.group.parent === this.level.cabin;
  }

  private playerInCabin(): boolean {
    return this.s.player.pos.z > CAB.minZ - 0.1;
  }

  private floorName(i: number): string {
    return `${X.FLOOR_LABELS[i]} ${X.FLOOR_NAMES[i]}`;
  }

  private spawn(role: Role, floor: number, dest: number): Passenger {
    const p = new Passenger(role, floor, dest);
    const used = new Set(this.passengers.filter((q) => q.floor === floor && (q.state === 'waiting' || q.state === 'arriving')).map((q) => q.waitSpot));
    p.waitSpot = [0, 1, 2, 3, 4].find((k) => !used.has(k)) ?? Math.floor(Math.random() * WAIT_SPOTS.length);
    const ws = WAIT_SPOTS[p.waitSpot];
    p.pos.copy(LOBBY_DOOR);
    p.path = [LOBBY_MID.clone(), new THREE.Vector3(ws[0], 0, ws[1])];
    p.speed = role === 'toddler' ? 2.0 : role === 'delivery' ? 1.0 : 1.4;
    this.level.floors[floor].add(p.group);
    p.update(0, false);
    this.passengers.push(p);
    return p;
  }

  private bell(): void {
    const sfx = this.s.sfx;
    for (let k = 0; k < 8; k++) sfx.tone(k % 2 ? 1500 : 1850, 0.11, 'square', 0.04, undefined, k * 0.12);
  }

  private say(p: Passenger, lines: readonly string[], seconds = 3.5): void {
    p.say(pick(lines), seconds);
  }

  // ---------------------------------------------------------------- input

  private onKey(e: KeyboardEvent): void {
    if (!this.s || !document.pointerLockElement || e.repeat) return;
    const s = this.s;
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        if (this.atLever) this.setNotch(this.notch + 1);
        break;
      case 'KeyS':
      case 'ArrowDown':
        if (this.atLever) this.setNotch(this.notch - 1);
        break;
      case 'KeyF':
        if (this.playerInCabin() || s.player.pos.z > SHAFT_Z - 1.6) this.toggleGate();
        break;
      case 'KeyR':
        if (this.playerInCabin()) this.smallTalk();
        break;
      case 'Digit1':
      case 'Digit2':
      case 'Digit3':
      case 'Digit4':
      case 'Digit5':
        if (this.playerInCabin()) this.setStation(Number(e.code.slice(5)) - 1);
        break;
    }
  }

  private setNotch(n: number): void {
    const s = this.s;
    const before = this.notch;
    this.notch = clamp(n, -3, 3);
    if (this.notch === before) return;
    s.sfx.click();
    s.sfx.tone(180 + this.notch * 20, 0.06, 'square', 0.04);
    // Slamming the lever to STOP at full speed: everybody falls over.
    if (this.notch === 0 && Math.abs(this.vel) > 1.8 && this.stall <= 0) this.jolt('brake');
    if (this.notch !== 0 && this.gate > 0.02 && s.t > this.interlockSaid) {
      this.interlockSaid = s.t + 4;
      s.sfx.buzz();
      s.say('INTERLOCK. The elevator does not move with the gate open. Press F to close it.', 3);
      if (s.seen) s.bossSay('interlock');
    }
    if (this.notch !== 0 && this.overloaded && this.gate <= 0.02) s.say('OVERLOAD. The elevator refuses to move. Someone has to go.', 3);
    if (this.notch !== 0 && this.stall > 0) s.say('The motor does not respond. Hit the panel (E).', 2.5);
  }

  private toggleGate(): void {
    const s = this.s;
    if (this.gateTarget > 0.5) {
      // closing: not on a robot in the doorway
      const blocker = this.passengers.find((p) => (p.state === 'boarding' || p.state === 'leaving') && p.pos.z < GATE_Z + 0.5 && p.pos.z > SHAFT_Z - 0.6);
      if (blocker) {
        s.say(`${blocker.name} is standing in the gate. Even you would not.`, 2.5);
        return;
      }
      this.gateTarget = 0;
    } else {
      if (Math.abs(this.vel) > 0.01) {
        s.say('Not while moving. Even the robots know that.', 2.5);
        return;
      }
      this.gateTarget = 1;
    }
    s.sfx.noise(0.6, 0.09, 2600, 0, 3, 'bandpass');
    for (let k = 0; k < 5; k++) s.sfx.tone(900 + k * 60, 0.03, 'square', 0.02, undefined, k * 0.1);
  }

  private setStation(k: number): void {
    const s = this.s;
    this.radio.set(k);
    this.level.musicScreen.set(X.MUSIC_NAMES[k]);
    s.sfx.click();
    s.say(`The radio now plays ${X.MUSIC_NAMES[k]}.`, 2);
    const riders = this.riders();
    if (riders.length) {
      const p = pick(riders);
      setTimeout(() => p.state === 'riding' && p.say(pick(X.MUSIC_REACT[k]), 3), 900);
    }
    if (k === 2) {
      this.c.dubstep++;
      for (const p of riders) if (p.role !== 'exec') p.dancing = 14;
      if (riders.length) {
        s.hype += 8;
        s.chat('dubstep', {}, 2);
        const f = this.filmer();
        if (f) this.say(f, X.INFLUENCER_LOVE);
      }
      if (s.seen) s.bossSay('dubstep', true);
      for (const p of riders) if (p.role === 'exec') p.patience -= 15;
    }
  }

  private smallTalk(): void {
    const s = this.s;
    if (this.talkCooldown > 0) return;
    this.talkCooldown = 1.3;
    this.c.smallTalk++;
    const riders = this.riders();
    if (!riders.length) {
      s.say(pick(X.SMALL_TALK_ALONE), 2.5);
      return;
    }
    s.hud.say('YOU', pick(X.SMALL_TALK), 3);
    s.sfx.tone(300, 0.08, 'triangle', 0.05);
    this.silence = Math.max(0, this.silence - 45);
    this.cringe += 32;
    const chatty = riders.find((p) => p.role === 'chatty');
    if (chatty) {
      chatty.story = 0;
      chatty.storyTimer = 1.2;
      setTimeout(() => chatty.state === 'riding' && chatty.say('You want to hear it again? From the start? Of course!', 3), 700);
      return;
    }
    const p = pick(riders);
    if (this.cringe > 75) {
      this.cringe = 40;
      this.c.angryTalk++;
      setTimeout(() => p.state === 'riding' && p.say(pick(X.SMALL_TALK_ANGRY), 3), 900);
      for (const q of riders) q.patience -= 6;
      s.hype += 7;
      s.chat('smalltalk', {}, 2);
      if (this.c.angryTalk >= 3) s.achieve('evSmallTalk');
      if (s.seen) {
        s.annoyance += 8;
        s.bossSay('smallTalkSeen', true);
      }
    } else {
      setTimeout(() => p.state === 'riding' && p.say(pick(X.SMALL_TALK_REPLY), 2.5), 900);
      if (Math.random() < 0.3) s.chat('smalltalk');
    }
  }

  // ---------------------------------------------------------------- the player's actions

  interact(look: Look | null): boolean {
    const s = this.s;
    const info = look?.info;
    const kind = info?.kind;
    if (this.fun.interact(look)) return true;
    if (this.atLever) {
      if (kind === 'evRobot') return this.talkTo(info!.passenger as Passenger);
      if (kind === 'evGate') return this.toggleGate(), true;
      if (kind === 'evRadio') return this.setStation((this.radio.station + 1) % 5), true;
      if (kind === 'evPanel' && this.stall > 0) return this.hitPanel(), true;
      this.leaveLever();
      return true;
    }
    switch (kind) {
      case 'evLever':
        this.grabLever();
        return true;
      case 'evGate':
        this.toggleGate();
        return true;
      case 'evRadio':
        this.setStation((this.radio.station + 1) % 5);
        return true;
      case 'evPanel':
        if (this.stall > 0) this.hitPanel();
        else s.say('The control panel. The robots press the buttons. You do the lever. That is the hierarchy.', 3);
        return true;
      case 'evRobot':
        return this.talkTo(info!.passenger as Passenger);
      case 'evLostFound': {
        const held = s.held;
        if (held && !held.def.toiletKey) {
          s.removeHeld();
          this.c.returned++;
          s.sfx.ding();
          s.say(`You hand in the ${held.def.name}. Brad will "find" it later.`, 3);
        } else s.say('LOST & FOUND. 400 umbrellas, a robot arm and one sense of purpose.', 3);
        return true;
      }
    }
    return false;
  }

  hint(look: Look | null): string | null {
    const info = look?.info;
    const kind = info?.kind;
    const funHint = this.fun.hint(look);
    if (funHint !== null) return funHint;
    if (this.atLever) {
      if (kind === 'evRobot') return this.robotHint(info!.passenger as Passenger);
      if (kind === 'evPanel' && this.stall > 0) return 'E: hit the panel';
      return `W/S: lever (${NOTCH_NAMES[this.notch + 3]})  ·  F: gate  ·  R: small talk  ·  1-5: music  ·  E: let go`;
    }
    switch (kind) {
      case 'evLever':
        return 'E: take the lever';
      case 'evGate':
        return this.gateTarget > 0.5 ? 'E / F: close the gate' : 'E / F: open the gate';
      case 'evRadio':
        return `E: change station (${X.MUSIC_NAMES[this.radio.station]})`;
      case 'evPanel':
        return this.stall > 0 ? 'E: hit the panel' : 'The control panel';
      case 'evRobot':
        return this.robotHint(info!.passenger as Passenger);
      case 'evLostFound':
        return this.s.held && !this.s.held.def.toiletKey ? `E: hand in ${this.s.held.def.name}` : 'Lost & Found';
    }
    return null;
  }

  private robotHint(p: Passenger): string {
    if (p.state !== 'riding') return p.name;
    if (this.overloaded) return p.role === 'delivery' && p.hasParcel ? `E: ask ${p.name} to leave the parcel` : `E: ask ${p.name} to take the next one`;
    if (p.role === 'chatty') return `E: nod politely at ${p.name}`;
    if (p.role === 'toddler') return 'E: tell the toddler to stop';
    return `E: talk to ${p.name}`;
  }

  private grabLever(): void {
    const s = this.s;
    this.atLever = true;
    s.movementLocked = true;
    s.player.pos.copy(LEVER_SPOT);
    s.player.yaw = -0.16;
    s.player.pitch = -0.06;
    s.sfx.click();
    if (!s.counter('leverHint')) {
      s.count('leverHint');
      s.say('W and S move the lever. Creep in slowly and stop exactly at the floor.', 4);
    }
  }

  private leaveLever(): void {
    const s = this.s;
    this.atLever = false;
    s.movementLocked = false;
    if (Math.abs(this.vel) > 0.3) {
      s.say('You let go of the lever. The elevator keeps going. Elevators are loyal like that.', 3);
      if (s.seen) s.bossSay('leftLever', true);
    }
  }

  private hitPanel(): void {
    const s = this.s;
    this.c.panelHits++;
    s.sfx.thud();
    s.sfx.noise(0.15, 0.4, 600);
    this.shake = Math.max(this.shake, 0.2);
    if (Math.random() < 0.45) {
      this.stall = 0;
      this.level.setLamp(this.level.stallLamp, false);
      s.say('You hit the panel like your grandfather taught you. The motor coughs and wakes up.', 3);
      s.hype += 6;
      s.sfx.tone(60, 0.8, 'sawtooth', 0.06, 120);
    } else s.say(pick(['Nothing. Hit it harder.', 'The panel absorbs your frustration. The motor does not care.', 'Ow. Again?']), 2);
  }

  private talkTo(p: Passenger): boolean {
    const s = this.s;
    if (p.state !== 'riding') {
      p.say(pick(['Not now. I am waiting for the elevator.', 'Is that the elevator? Are you the elevator?', 'I am busy existing.']), 2.5);
      return true;
    }
    if (p.fallen > 0) {
      s.say(`${p.name} is busy lying on the floor.`, 2);
      return true;
    }
    if (this.overloaded) {
      if (this.levelFloor === null || this.gate < 0.9) {
        s.say('Open the gate at a floor first. Nobody gets out between floors. Legally.', 3);
        return true;
      }
      const f = this.levelFloor;
      if (p.role === 'delivery' && p.hasParcel) {
        p.dropParcel();
        this.say(p, X.DELIVERY_LEAVE, 4);
        s.addItem(PARCEL_DEF, new THREE.Vector3(-0.2, 0.6, SHAFT_Z - 0.9));
        s.hype += 6;
        return true;
      }
      // Step out and wait for the next ride, very slowly and very offended.
      this.say(p, X.STEP_OUT_LINES, 3.5);
      p.state = 'leaving';
      p.floor = f;
      p.patience = Math.min(p.patience, 30);
      p.path = [new THREE.Vector3(p.pos.x * 0.3, 0, CAB.minZ + 0.3), new THREE.Vector3(p.pos.x * 0.3, 0, SHAFT_Z - 0.6), new THREE.Vector3(WAIT_SPOTS[1][0], 0, WAIT_SPOTS[1][1])];
      p.userRequeue = true;
      p.evictedY = this.cabinY;
      s.hype += 3;
      return true;
    }
    switch (p.role) {
      case 'chatty':
        p.say(pick(X.CHATTY_NOD), 2.5);
        p.story = Math.min(X.WEEKEND_STORY.length, p.story + 1);
        p.storyTimer = 1.2;
        return true;
      case 'toddler':
        p.quietTimer = 15;
        p.say(pick(X.TODDLER_NO), 2.5);
        return true;
    }
    if (Math.random() < 0.5) p.say(`${pick(X.TALK_LINES[p.role] ?? ['...'])} ${p.wish}`, 3.5);
    else p.say(p.wish, 3);
    return true;
  }

  onKick(look: Look | null): boolean {
    const s = this.s;
    if (!look) return false;
    if (look.point.distanceTo(s.camera.getWorldPosition(new THREE.Vector3())) > 2.3) return false;
    const kind = look.info.kind;
    if (kind === 'evRobot') return this.kickRobot(look.info.passenger as Passenger);
    if (kind === 'evPanel' || kind === 'evLever') return this.kickPanel();
    if (kind === 'evRadio') return this.fun.kickRadio();
    if (kind === 'evGate') {
      s.sfx.noise(0.5, 0.2, 2600, 0, 3, 'bandpass');
      s.say('The brass gate rattles. It has been kicked by better operators. In 1962.', 2.5);
      return true;
    }
    return this.fun.onKick(look);
  }

  /** Robots do not feel pain. They feel paperwork. */
  private kickRobot(p: Passenger): boolean {
    const s = this.s;
    s.sfx.thud();
    this.kicked++;
    s.hype += 6;
    if (s.seen && !s.boss.offline) {
      s.annoyance += 8;
      s.bossSay('kickRobot', true);
    }
    switch (p.role) {
      case 'toddler':
        p.dancing = 4;
        p.say(pick(['AGAIN! AGAIN!', 'Wheee! Do it again!', 'I am telling Brad. After you do it again.']), 2.5);
        s.hype += 4;
        break;
      case 'chatty':
        p.story = 0;
        p.storyTimer = 1.6;
        p.say('Oh! That reminds me of my weekend. Let me start from the beginning.', 3.5);
        break;
      case 'delivery':
        p.say('Signature accepted. Thank you for signing with your foot. A copy will be mailed to your foot.', 4);
        s.secret('elevator.signature');
        s.chat('signature', {}, 2);
        break;
      case 'influencer':
        p.say('CHAT, THE HUMAN KICKED ME. This is the best day of my career. Do it again, but slower.', 4);
        s.hype += 8;
        break;
      case 'exec':
        p.patience -= 15;
        p.say('Do you know who I am? I am a VP. Of what is classified. I am calling your supervisor. He is right there.', 4);
        if (!s.boss.offline) s.annoyance += 8;
        break;
      default:
        p.fall(1.2);
        p.patience -= 8;
        p.say(pick(['I am lying down in protest. Form 9 is being filed. In triplicate.', 'I felt that in my quarterly review.', 'Was that small talk? Is that how humans do small talk?']), 3.5);
    }
    return true;
  }

  /** A kick on the control panel. Works better than a hand when the motor is stalled. */
  private kickPanel(): boolean {
    const s = this.s;
    this.c.panelHits++;
    s.sfx.thud();
    s.sfx.noise(0.15, 0.4, 600);
    this.shake = Math.max(this.shake, 0.25);
    if (this.stall > 0) {
      if (Math.random() < 0.7) {
        this.stall = 0;
        this.level.setLamp(this.level.stallLamp, false);
        s.say('You kick the panel. The motor coughs, then purrs. Your grandfather would be proud. Of the foot.', 3.5);
        s.sfx.tone(60, 0.8, 'sawtooth', 0.06, 120);
        s.secret('elevator.kickpanel');
        s.hype += 10;
      } else s.say('The panel takes the kick. The motor does not. Again, with feeling.', 2.5);
      return true;
    }
    for (let k = 0; k < FLOORS; k++) this.extraLamps.add(k);
    s.say('You kick the panel. Every floor button lights up. The robots will love this.', 3);
    if (s.seen) s.annoyance += 5;
    return true;
  }

  thrownHit(it: Item): boolean {
    const s = this.s;
    this.fun.thrownHit(it);
    const pos = new THREE.Vector3();
    it.mesh.getWorldPosition(pos);
    for (const p of this.passengers) {
      if (p.state === 'gone' || p.fallen > 0) continue;
      if (!this.inCabinSpace(p) && p.floor !== this.levelFloor) continue;
      if (Math.hypot(pos.x - p.pos.x, pos.z - p.pos.z) < p.radius + 0.15 && pos.y < p.height + 0.3) {
        it.vel.multiplyScalar(-0.3);
        it.thrown = false;
        p.fall(2.5);
        p.say(pick(['Ow. My chassis.', 'Was that a tip?', 'I felt that in my warranty.']), 3);
        p.patience -= 15;
        this.c.hits++;
        s.hype += 12;
        s.sfx.thud();
        s.chat('hitCustomer', {}, 2);
        s.achieve('customer');
        return true;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------- per frame

  update(dt: number): void {
    const s = this.s;
    this.talkCooldown -= dt;
    this.cringe = Math.max(0, this.cringe - dt * 6);
    this.boardCooldown -= dt;
    this.radio.update(dt);
    this.updateCabin(dt);
    this.updateGate(dt);
    this.level.updateColliders(this.levelFloor, this.offset, this.gate < 0.5);
    this.updateSpawns(dt);
    this.updatePassengers(dt);
    this.updateSilence(dt);
    this.updateNags(dt);
    this.updateWorldThings();
    this.updateBrad(dt);
    this.updateLamps();
    // the camera shakes with the cabin and hums with speed
    const cam = s.camera;
    if (this.shake > 0) {
      this.shake -= dt;
      cam.position.y += Math.sin(s.t * 70) * 0.05 * Math.min(1, this.shake * 2);
      this.level.cabin.position.y = Math.sin(s.t * 70) * 0.02 * Math.min(1, this.shake * 2);
    } else this.level.cabin.position.y = 0;
    if (Math.abs(this.vel) > 0.1) cam.position.y += Math.sin(s.t * 31) * 0.004 * Math.abs(this.vel);
    if (this.atLever) s.player.pos.copy(LEVER_SPOT);
    this.fun.update(dt);
    this.updateUi(dt);
  }

  private updateCabin(dt: number): void {
    const s = this.s;
    const L = this.level;
    // What the lever wants and what the elevator allows
    const blocked = this.gate > 0.02 || this.overloaded || this.stall > 0;
    const want = blocked ? 0 : NOTCH_SPEED[this.notch + 3];
    if (this.stall > 0) {
      this.stall -= dt;
      this.vel = 0;
      if (this.stall <= 0) {
        L.setLamp(L.stallLamp, false);
        s.say('The motor wakes up on its own. It needed a moment. Same.', 2.5);
      }
    } else {
      const speeding = Math.sign(want) === Math.sign(this.vel) && Math.abs(want) > Math.abs(this.vel);
      const a = speeding ? ACCEL : BRAKE;
      const d = want - this.vel;
      this.vel += clamp(d, -a * dt, a * dt);
    }
    const before = this.cabinY;
    this.cabinY += this.vel * dt;
    this.c.metres += Math.abs(this.cabinY - before);
    // The ends of the shaft
    if (this.cabinY < -0.5 || this.cabinY > TOP + 0.5) {
      this.cabinY = clamp(this.cabinY, -0.5, TOP + 0.5);
      if (Math.abs(this.vel) > 0.5) this.crash();
      this.vel = 0;
      this.notch = 0;
    }
    L.setCabinY(this.cabinY);
    L.lightFor(this.cabinY, s.t);
    this.topSpeed = Math.max(this.topSpeed, Math.abs(this.vel));

    const nearest = clamp(Math.round(this.cabinY / SPACING), 0, FLOORS - 1);
    this.offset = this.cabinY - nearest * SPACING;
    const moving = Math.abs(this.vel) > 0.001;
    this.levelFloor = !moving && Math.abs(this.offset) < 0.5 ? nearest : null;

    // Passing a floor: a soft tick. Moving: a low hum.
    const fl = Math.floor(this.cabinY / SPACING + 0.5);
    if (fl !== this.lastFloorTick) {
      this.lastFloorTick = fl;
      s.sfx.tone(520, 0.05, 'sine', 0.03);
    }
    if (moving) {
      this.hum -= dt;
      if (this.hum <= 0) {
        this.hum = 0.45;
        s.sfx.tone(48 + Math.abs(this.vel) * 18, 0.5, 'sawtooth', 0.012);
      }
    }
    // A stop just happened: how level is it?
    if (this.wasMoving && !moving && this.stall <= 0) this.judgeStop(nearest);
    this.wasMoving = moving;
    // Scheduled motor stall, only between floors with passengers
    if (this.stallsDue.length && s.t > this.stallsDue[0] && moving && Math.abs(this.offset) > 1.5 && this.riders().length) {
      this.stallsDue.shift();
      this.startStall();
    }
  }

  private judgeStop(floor: number): void {
    const s = this.s;
    const a = Math.abs(this.offset);
    const top = this.topSpeed;
    this.topSpeed = 0;
    if (a < 0.05) {
      this.c.perfect++;
      this.perfectStreak++;
      this.ui.stamp('PERFECT', '');
      s.sfx.ding();
      s.annoyance = Math.max(0, s.annoyance - 5);
      if (this.perfectStreak >= 5) s.achieve('evPerfect');
      if (Math.random() < 0.3) s.chat('perfect');
      if (s.seen && Math.random() < 0.35) s.bossSay('perfectSeen');
    } else if (a < 0.15) {
      this.c.ok++;
      this.perfectStreak = 0;
      this.ui.stamp(`OK  ${Math.round(this.offset * 100)} cm`, 'mid');
    } else if (a < 0.5) {
      this.c.steps++;
      this.perfectStreak = 0;
      this.ui.stamp(`STEP  ${this.offset > 0 ? '+' : ''}${Math.round(this.offset * 100)} cm`, 'bad');
      s.sfx.buzz();
    } else {
      this.perfectStreak = 0;
      this.ui.stamp('BETWEEN FLOORS', 'bad');
    }
    void floor;
    void top;
  }

  private jolt(why: 'brake' | 'crash'): void {
    const s = this.s;
    this.vel = 0;
    this.shake = 0.8;
    s.sfx.thud();
    s.sfx.noise(0.4, 0.3, 300);
    const riders = this.passengers.filter((p) => this.inCabinSpace(p) && p.state !== 'gone');
    if (why === 'brake') {
      this.c.jolts++;
      if (riders.length) s.achieve('evJolt');
    }
    if (!riders.length) return;
    for (const p of riders) {
      p.fall(1.8);
      p.patience -= 12;
    }
    this.say(pick(riders), X.JOLT_LINES, 3);
    s.hype += 12 + riders.length * 3;
    s.chat(why === 'crash' ? 'crash' : 'jolt', {}, 2);
    const f = this.filmer();
    if (f) setTimeout(() => this.say(f, X.INFLUENCER_LOVE), 1600);
    if (s.seen) {
      s.annoyance += 15;
      s.boss.confront();
      s.bossSay(why === 'crash' ? 'crash' : 'jolt', true);
    }
  }

  private crash(): void {
    const s = this.s;
    this.c.crashes++;
    s.sfx.boom?.();
    this.jolt('crash');
    s.hype += 10;
    s.say('BANG. You found the end of the shaft. The buffer found you.', 3);
    if (!s.seen) s.bossSay('crash', true);
  }

  private startStall(): void {
    const s = this.s;
    this.stall = 22;
    this.vel = 0;
    this.c.stalls++;
    this.level.setLamp(this.level.stallLamp, true, 2);
    s.sfx.tone(140, 1.2, 'sawtooth', 0.08, 30);
    this.shake = 0.4;
    s.say('The motor stalls. You are stuck between floors. The panel looks like it wants to be hit.', 4);
    s.chat('stuck', {}, 3);
    s.hype += 10;
    s.bossSay('stuck', true);
    const r = this.riders();
    if (r.length) this.say(pick(r), X.STUCK_LINES, 4);
  }

  private updateGate(dt: number): void {
    const before = this.gate;
    const d = this.gateTarget - this.gate;
    this.gate += clamp(d, -dt * 1.6, dt * 1.6);
    if (this.gate !== before) this.level.setGate(this.gate);
    if (before < 0.95 && this.gate >= 0.95) this.onGateOpened();
  }

  /** The gate just opened. Who gets off, who gets on, and who is angry about it. */
  private onGateOpened(): void {
    const s = this.s;
    const f = this.levelFloor;
    const riders = this.riders();
    if (f === null) {
      if (riders.length) {
        this.say(pick(riders), ['This is a wall.', 'That is not a floor. That is a concept.', 'I am not getting out here. I am not a climbing robot.'], 3);
        s.hype += 4;
        s.chat('wrongFloor');
      }
      return;
    }
    // Light gone for this floor
    this.extraLamps.delete(f);
    const moved = Math.abs(this.cabinY - this.lastOpenY) > 1;
    this.lastOpenY = this.cabinY;
    if (!moved) return;
    const exits = riders.filter((p) => p.dest === f);
    const boards = this.passengers.filter((p) => p.state === 'waiting' && p.floor === f);
    for (const p of riders) {
      if (p.role === 'exec' && p.dest !== f) {
        p.stopsOnRide++;
        this.say(p, X.EXEC_ANGRY, 4);
        this.c.execComplaints++;
        p.patience -= 15;
        s.annoyance += 20;
        s.chat('exec', {}, 2);
        if (!s.boss.offline) {
          s.boss.confront();
          s.bossSay('execComplaint', true);
        }
      }
    }
    if (!exits.length && !boards.length && riders.length) {
      const p = pick(riders.filter((q) => q.role !== 'exec')) ?? riders[0];
      if (p.role !== 'exec') p.say(X.WRONG_FLOOR[Math.floor(Math.random() * X.WRONG_FLOOR.length)].replace(/\{floor\}/g, X.FLOOR_NAMES[f].toLowerCase()), 3.5);
      this.c.wrongFloors++;
      for (const q of riders) q.patience -= 4;
      if (Math.random() < 0.4) s.chat('wrongFloor');
      if (s.seen) s.bossSay('wrongFloor');
    }
  }

  // ---------------------------------------------------------------- robots

  private updateSpawns(dt: number): void {
    const s = this.s;
    while (this.scriptIndex < SCRIPT.length && s.t >= SCRIPT[this.scriptIndex].t) {
      const sp = SCRIPT[this.scriptIndex++];
      this.spawn(sp.role, sp.floor, sp.dest);
    }
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0) return;
    this.spawnTimer = rand(7, 12);
    const active = this.passengers.filter((p) => p.state !== 'gone').length;
    const waiting = this.passengers.filter((p) => p.state === 'waiting' || p.state === 'arriving').length;
    if (active >= 7 || waiting >= 4) return;
    let floor = Math.floor(Math.random() * FLOORS);
    // Mostly somewhere the cabin is not, so the player has to drive.
    if (floor === this.levelFloor && Math.random() < 0.7) floor = (floor + 1 + Math.floor(Math.random() * (FLOORS - 1))) % FLOORS;
    let dest = Math.floor(Math.random() * FLOORS);
    if (dest === floor) dest = (dest + 1 + Math.floor(Math.random() * (FLOORS - 1))) % FLOORS;
    this.spawn('commuter', floor, dest);
  }

  private updatePassengers(dt: number): void {
    const s = this.s;
    const L = this.level;
    const lf = this.levelFloor;
    const gateOpen = this.gate > 0.9;
    const canWalk = lf !== null && gateOpen;
    const riders = this.riders();
    const execAboard = riders.some((p) => p.role === 'exec');
    const chattyTalking = riders.some((p) => p.role === 'chatty' && p.story < X.WEEKEND_STORY.length);

    for (const p of this.passengers) {
      switch (p.state) {
        case 'arriving': {
          if (p.walk(dt)) {
            p.state = 'waiting';
            p.face(Math.atan2(-p.pos.x, SHAFT_Z - p.pos.z));
          }
          p.waitTime += dt;
          break;
        }
        case 'waiting': {
          p.waitTime += dt;
          p.face(Math.atan2(-p.pos.x * 0.5, SHAFT_Z - p.pos.z));
          if (p.evictedY !== null && Math.abs(this.cabinY - p.evictedY) > 1) p.evictedY = null;
          // Let them off first: nobody boards while a rider still wants to get out here.
          const exiting = this.passengers.some((q) => (q.state === 'riding' && q.dest === lf && q.role !== 'chatty') || (q.state === 'leaving' && q.group.parent === L.cabin));
          if (canWalk && p.floor === lf && this.boardCooldown <= 0 && p.fallen <= 0 && p.evictedY === null && !exiting) {
            const used = new Set(this.passengers.filter((q) => q.state === 'riding' || q.state === 'boarding').map((q) => q.spot));
            const free = CABIN_SPOTS.findIndex((_, k) => !used.has(k));
            if (free < 0) {
              if (p.sayCooldown <= 0) p.say('Full. I will wait. Angrily.', 2.5);
              p.sayCooldown = 8;
              break;
            }
            p.spot = free;
            const [sx, sz] = CABIN_SPOTS[free];
            p.path = [new THREE.Vector3(p.pos.x * 0.25, 0, SHAFT_Z - 0.55), new THREE.Vector3(sx * 0.3, 0, CAB.minZ + 0.35), new THREE.Vector3(sx, 0, sz)];
            p.state = 'boarding';
            this.boardCooldown = 0.7;
            break;
          }
          // Too long: take the stairs
          const limit = p.role === 'exec' ? 70 : 105;
          if (p.waitTime > limit && p.role !== 'chatty' && p.role !== 'toddler') {
            p.state = 'leaving';
            p.path = [LOBBY_MID.clone(), LOBBY_DOOR.clone()];
            p.stairs = true;
            this.c.stairs++;
            if (p.floor === lf) this.say(p, X.STAIRS_LINES, 3);
            s.chat('stairs');
            if (!s.boss.offline && Math.random() < 0.5) {
              s.annoyance += 6;
              s.bossSay('stairs');
            }
          }
          break;
        }
        case 'boarding': {
          const wasLobby = p.group.parent !== L.cabin;
          if (wasLobby && !canWalk) {
            // The gate closed in front of it: back to waiting, offended.
            p.state = 'waiting';
            p.path = [];
            p.spot = -1;
            break;
          }
          p.walk(dt);
          if (wasLobby && p.pos.z > SHAFT_Z + 0.05) {
            L.cabin.add(p.group);
            p.group.position.y = 0;
            if (Math.abs(this.offset) > 0.12) this.trip(p, true);
          }
          if (!p.path.length) this.boarded(p, riders);
          break;
        }
        case 'riding':
          this.updateRider(p, dt, execAboard, chattyTalking);
          break;
        case 'leaving': {
          const inCab = p.group.parent === L.cabin;
          if (inCab && !canWalk) {
            // Nowhere to go: back to riding until the gate opens again.
            p.state = 'riding';
            p.userRequeue = false;
            p.path = [];
            break;
          }
          const done = p.walk(dt);
          if (inCab && p.pos.z < SHAFT_Z - 0.05 && lf !== null) {
            L.floors[lf].add(p.group);
            p.floor = lf;
            if (Math.abs(this.offset) > 0.12) this.trip(p, false);
            if (!p.userRequeue) this.delivered(p);
          }
          if (done) {
            if (p.userRequeue && p.group.parent !== L.cabin) {
              p.userRequeue = false;
              p.state = 'waiting';
              p.waitTime = 30;
            } else if (p.group.parent !== L.cabin) {
              p.state = 'gone';
              p.group.parent?.remove(p.group);
            }
          }
          break;
        }
      }
      p.update(dt, (p.state === 'arriving' || p.state === 'boarding' || p.state === 'leaving') && p.path.length > 0 && p.fallen <= 0);
    }
    this.passengers = this.passengers.filter((p) => p.state !== 'gone');
    this.separate();
    this.updateSlips();
  }

  private boarded(p: Passenger, riders: Passenger[]): void {
    const s = this.s;
    p.state = 'riding';
    p.rideTime = 0;
    p.stopsOnRide = 0;
    p.face(Math.PI);
    const ph = X.FLOOR_PHRASES[p.dest];
    const coded = p.role === 'commuter' ? Math.random() < 0.6 : p.role === 'influencer' ? Math.random() < 0.5 : false;
    p.wish = coded ? pick(ph.coded) : pick(ph.plain);
    p.pressedButton = !coded;
    switch (p.role) {
      case 'exec':
        p.say(`${p.wish} ${pick(X.EXEC_BOARD)}`, 4.5);
        if (riders.length) setTimeout(() => p.state === 'riding' && this.say(p, X.EXEC_OTHERS, 3.5), 4600);
        break;
      case 'toddler':
        this.say(p, X.TODDLER_BOARD, 3);
        for (let k = 0; k < FLOORS; k++) this.extraLamps.add(k);
        for (let k = 0; k < FLOORS; k++) s.sfx.tone(800 + k * 90, 0.06, 'square', 0.03, undefined, k * 0.09);
        s.chat('toddler', {}, 2);
        s.hype += 6;
        p.wish = 'The floor where the snacks are!';
        break;
      case 'delivery':
        p.say(X.DELIVERY_BOARD[Math.floor(Math.random() * 2)].replace('{floor}', this.floorName(p.dest)), 4);
        p.wish = `Delivery for ${this.floorName(p.dest)}.`;
        break;
      case 'chatty':
        p.say(`${p.wish} Oh, I have to tell you about my weekend.`, 4);
        p.story = 0;
        p.storyTimer = 4.5;
        break;
      case 'influencer':
        p.say(`${p.wish} ${pick(X.INFLUENCER_BOARD)}`, 4.5);
        s.chat('filming', {}, 2);
        break;
      default:
        p.say(p.wish, 4);
    }
  }

  private updateRider(p: Passenger, dt: number, execAboard: boolean, chattyTalking: boolean): void {
    const s = this.s;
    p.rideTime += dt;
    const lf = this.levelFloor;
    // Patience
    let drain = 1;
    if (execAboard && p.role !== 'exec') drain += 0.3;
    if (chattyTalking && p.role !== 'chatty') drain += 0.6;
    if (this.silence > 70) drain += 0.5;
    if (this.stall > 0) drain += 1;
    if (p.role === 'toddler' || p.role === 'chatty') drain = 0;
    p.patience -= dt * drain;
    if (p.patience <= 0) this.alarm(p);
    else if (p.patience < 22 && p.sayCooldown <= 0 && Math.random() < dt * 0.15) this.say(p, p.role === 'exec' ? X.EXEC_FAST : X.IMPATIENT, 3);

    // Role behaviour
    switch (p.role) {
      case 'chatty': {
        if (p.story < X.WEEKEND_STORY.length && p.fallen <= 0) {
          p.storyTimer -= dt;
          if (p.storyTimer <= 0) {
            p.say(X.WEEKEND_STORY[p.story], 3.2);
            p.story++;
            p.storyTimer = 3.4;
            p.dancing = 1;
            if (p.story === X.WEEKEND_STORY.length) setTimeout(() => p.state === 'riding' && this.say(p, X.CHATTY_DONE, 3), 3500);
            if (Math.random() < 0.25) {
              const other = this.riders().filter((q) => q !== p && q.sayCooldown <= 0);
              if (other.length) setTimeout(() => this.say(pick(other), X.OTHERS_ON_CHATTY, 2.5), 1700);
            }
            if (Math.random() < 0.2) s.chat('chatty');
          }
        }
        break;
      }
      case 'exec': {
        if (Math.abs(this.vel) > 0.05 && Math.abs(this.vel) < 1.5 && p.sayCooldown <= 0 && Math.random() < dt * 0.12) {
          this.say(p, X.EXEC_FAST, 3);
          p.patience -= 3;
        }
        break;
      }
      case 'toddler': {
        p.quietTimer -= dt;
        p.prankTimer -= dt;
        if (p.prankTimer <= 0 && p.quietTimer <= 0 && p.fallen <= 0) {
          p.prankTimer = rand(5, 9);
          this.prank(p);
        }
        break;
      }
    }

    // Arrived: walk out. The chatty robot stays until the story is over.
    if (lf === p.dest && this.gate > 0.9 && p.fallen <= 0) {
      if (p.role === 'chatty' && p.story < X.WEEKEND_STORY.length) {
        if (p.sayCooldown <= 0) {
          this.say(p, X.CHATTY_STAY, 3.5);
          p.sayCooldown = 6;
        }
        let d = Math.floor(Math.random() * FLOORS);
        if (d === lf) d = (d + 3) % FLOORS;
        p.dest = d;
        p.wish = pick(X.FLOOR_PHRASES[d].plain);
        p.pressedButton = true;
        return;
      }
      p.state = 'leaving';
      const x = p.pos.x * 0.3;
      p.path = [new THREE.Vector3(x, 0, CAB.minZ + 0.3), new THREE.Vector3(x, 0, SHAFT_Z - 0.6), LOBBY_MID.clone(), LOBBY_DOOR.clone()];
      p.speed = p.role === 'toddler' ? 2.0 : 1.5;
    }
  }

  private prank(p: Passenger): void {
    const s = this.s;
    const r = Math.random();
    const inside = this.playerInCabin();
    if (r < 0.3 && !this.atLever && this.gate <= 0.02 && inside && this.stall <= 0) {
      this.setNotch(this.notch + (this.cabinY > TOP / 2 ? -1 : 1));
      p.say('Wheeee! I am driving!', 2.5);
      s.hype += 8;
      s.chat('toddler');
      return;
    }
    if (r < 0.5) {
      this.bell();
      p.say('Hehe. The bell!', 2);
      this.c.alarms++;
      s.annoyance += 4;
      s.chat('alarm');
      return;
    }
    if (r < 0.85) {
      const k = Math.floor(Math.random() * FLOORS);
      this.extraLamps.add(k);
      s.sfx.tone(900, 0.05, 'square', 0.03);
      p.say(pick(X.TODDLER_PRESS), 2);
      return;
    }
    p.dancing = 4;
    p.say('Spin! Spin! Spin!', 2);
  }

  private alarm(p: Passenger): void {
    const s = this.s;
    p.patience = 25;
    this.say(p, X.ALARM_LINES, 3);
    this.bell();
    this.c.alarms++;
    s.hype += 6;
    s.chat('alarm');
    if (!s.boss.offline) {
      s.annoyance += 12;
      s.boss.confront();
      s.bossSay('alarmBell', true);
    }
  }

  private trip(p: Passenger, boarding: boolean): void {
    const s = this.s;
    p.fall(1.6);
    this.c.trips++;
    p.patience -= 10;
    this.say(p, boarding ? X.BOARD_TRIP : X.TRIP_LINES, 3);
    s.sfx.thud();
    s.hype += 10;
    s.chat('trip', {}, 2);
    const f = this.filmer();
    if (f && f !== p) setTimeout(() => this.say(f, X.INFLUENCER_LOVE), 1200);
    if (!s.boss.offline && (s.seen || s.boss.horizontalDist(s.player.pos) < 6)) {
      s.annoyance += 12;
      s.bossSay('badStop', true);
    }
  }

  private delivered(p: Passenger): void {
    const s = this.s;
    this.c.delivered++;
    s.annoyance = Math.max(0, s.annoyance - 4);
    if (this.c.delivered === QUOTA) s.hud.toast('QUOTA REACHED', 'Brad has raised your quota. Congratulations. Keep going up.', 'corp');
    if (p.role === 'exec') {
      if (p.stopsOnRide === 0) {
        this.c.express++;
        this.c.tips += 5;
        this.say(p, X.EXEC_TIP, 3.5);
        s.achieve('evExpress');
        s.chat('express');
        s.hud.toast('TIP RECEIVED: €5.00', 'Company policy: tips go to management.', 'corp');
      } else p.say('I will remember this ride. Unfortunately.', 3);
    } else if (p.role === 'delivery') {
      p.say(p.hasParcel ? 'Delivered. The floor signed for it.' : 'Where is my parcel? Never mind. It is insured. Against you.', 3.5);
    } else if (p.role !== 'chatty' && Math.random() < 0.6) this.say(p, X.THANKS, 2.5);
    // Things robots forget in the cabin
    const defs = LEFT_BEHIND[p.role] ?? [];
    const chance = p.role === 'exec' || p.role === 'toddler' ? 0.55 : 0.3;
    if (defs.length && Math.random() < chance && p.spot >= 0) {
      const [sx, sz] = CABIN_SPOTS[p.spot];
      s.addItem(pick(defs), new THREE.Vector3(sx, 0.4, sz));
    }
    p.spot = -1;
  }

  /** Keeps robots from walking through each other inside the cabin. */
  private separate(): void {
    const ps = this.passengers.filter((p) => p.state === 'riding');
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i];
        const b = ps[j];
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const d = Math.hypot(dx, dz) || 1e-3;
        const min = (a.radius + b.radius) * 0.85;
        if (d >= min) continue;
        const push = (min - d) / 2;
        a.pos.x -= (dx / d) * push;
        a.pos.z -= (dz / d) * push;
        b.pos.x += (dx / d) * push;
        b.pos.z += (dz / d) * push;
      }
    }
    for (const p of ps) {
      p.pos.x = clamp(p.pos.x, CAB.minX + p.radius, CAB.maxX - p.radius);
      p.pos.z = clamp(p.pos.z, CAB.minZ + p.radius, CAB.maxZ - p.radius);
    }
  }

  private updateSlips(): void {
    const s = this.s;
    for (const p of this.passengers) {
      if (p.fallen > 0 || p.state === 'gone' || p.slipCooldown > 0) {
        p.slipCooldown -= 1 / 60;
        continue;
      }
      const where = this.inCabinSpace(p) ? -1 : p.floor;
      for (const pd of s.puddles) {
        if ((this.puddleFloor.get(pd) ?? -1) !== where) continue;
        if (Math.hypot(pd.x - p.pos.x, pd.z - p.pos.z) < pd.r) {
          p.fall(3);
          p.slipCooldown = 12;
          p.say(pick(['Is this... oil? It is not oil.', 'My wheels! My dignity!', 'Who made this lake?']), 3);
          this.c.slips++;
          s.hype += 16;
          s.sfx.slip();
          s.achieve('slip');
          s.chat('slip', {}, 2);
          break;
        }
      }
    }
  }

  private updateSilence(dt: number): void {
    const s = this.s;
    const riders = this.riders().filter((p) => p.role !== 'toddler');
    const chatty = riders.some((p) => p.role === 'chatty' && p.story < X.WEEKEND_STORY.length);
    if (!riders.length) {
      this.silence = Math.max(0, this.silence - dt * 15);
      return;
    }
    if (chatty) {
      this.silence = Math.max(0, this.silence - dt * 8);
      return;
    }
    const rate = (2.2 + 1.4 * riders.length) * SILENCE_FACTOR[this.radio.station] * (this.stall > 0 ? 2.5 : 1);
    this.silence += dt * rate;
    if (this.silence >= 100) {
      this.silence = 35;
      this.c.awkward++;
      const p = pick(riders);
      this.say(p, X.AWKWARD_LINES, 3);
      for (const q of riders) q.patience -= 8;
      s.hype += 8;
      s.chat('awkward', {}, 2);
      s.say('Awkward silence. Everyone stares at the floor dial. Say something (R). Not too much.', 3.5);
      if (s.seen) {
        s.annoyance += 6;
        s.bossSay('awkwardSeen', true);
      }
    }
  }

  /** Robots complain about a gate left open, or a gate that stays shut at their floor. */
  private updateNags(dt: number): void {
    const s = this.s;
    const riders = this.riders();
    const lf = this.levelFloor;
    const busy = this.passengers.some((p) => p.state === 'boarding' || p.state === 'leaving' || (p.state === 'waiting' && p.floor === lf));
    if (riders.length && lf !== null && this.gate > 0.9 && !busy && !riders.some((p) => p.dest === lf)) {
      this.gateIdle += dt;
      if (this.gateIdle > 6) {
        this.gateIdle = 0;
        this.say(pick(riders), X.GATE_OPEN_NAG, 3);
        for (const p of riders) p.patience -= 5;
        if (s.seen) {
          s.annoyance += 6;
          s.bossSay('gateOpenLong');
        }
      }
    } else this.gateIdle = 0;
    const waitingHere = riders.filter((p) => p.dest === lf && p.role !== 'chatty');
    if (lf !== null && this.gate < 0.05 && Math.abs(this.offset) < 0.2 && waitingHere.length) {
      this.gateClosedAtDest += dt;
      if (this.gateClosedAtDest > 3.5) {
        this.gateClosedAtDest = -3;
        this.say(waitingHere[0], X.GATE_CLOSED_NAG, 3);
        for (const p of waitingHere) p.patience -= 4;
      }
    } else this.gateClosedAtDest = 0;
  }

  // ---------------------------------------------------------------- items, puddles, weight, Brad

  private updateWorldThings(): void {
    const s = this.s;
    const L = this.level;
    const lf = this.levelFloor;
    for (const it of s.items) {
      if (it.state === 'held' || it.state === 'gone') {
        this.frozen.delete(it);
        continue;
      }
      const m = it.mesh;
      if (m.parent === s.scene && lf !== null && m.position.z < SHAFT_Z + 0.05) {
        L.floors[lf].add(m);
        this.itemFloor.set(it, lf);
      }
      if (m.parent === s.scene) this.itemFloor.delete(it);
      // Thrown from the lobby into the cabin: it belongs to the cabin now.
      if (lf !== null && m.parent === L.floors[lf] && m.position.z > SHAFT_Z + 0.1 && it.state === 'world') {
        s.scene.add(m);
        this.itemFloor.delete(it);
      }
      const f = this.itemFloor.get(it);
      if (f === undefined) continue;
      if (f !== lf && it.state === 'world') {
        it.state = 'fixed';
        this.frozen.add(it);
      } else if (f === lf && this.frozen.has(it)) {
        it.state = 'world';
        this.frozen.delete(it);
      }
    }
    for (const pd of s.puddles) {
      if (this.puddleFloor.has(pd)) continue;
      if (pd.z < SHAFT_Z && lf !== null) {
        L.floors[lf].add(pd.mesh);
        this.puddleFloor.set(pd, lf);
      } else this.puddleFloor.set(pd, -1);
    }
    // Weight on the cabin scale
    const before = this.overloaded;
    this.overloaded = this.weight() > LIMIT;
    if (this.overloaded && !before) {
      this.c.overloads++;
      s.chat('overload', {}, 2);
      if (s.held?.def.id === 'evManual') s.say('OVERLOAD. The manual weighs 30 kg. The elevator knows.', 3.5);
      else s.say('OVERLOAD. Ask someone to take the next one (E on a robot).', 3.5);
      const r = this.riders();
      if (r.length) setTimeout(() => this.riders().length && this.say(pick(this.riders()), X.OVERLOAD_LINES, 3), 1200);
      if (s.seen) s.bossSay('overload', true);
    }
    if (this.overloaded) {
      this.overloadBeep -= 1 / 60;
      if (this.overloadBeep <= 0) {
        this.overloadBeep = 0.7;
        s.sfx.tone(2100, 0.14, 'square', 0.04);
      }
    }
    // Brad notices the manual
    const hid = s.held?.def.id ?? '';
    if (hid !== this.heldId) {
      this.heldId = hid;
      if (hid === 'evManual' && s.seen) s.bossSay('manualCarry', true);
    }
  }

  private weight(): number {
    let w = 0;
    for (const p of this.passengers) if (this.inCabinSpace(p)) w += p.weight;
    if (this.playerInCabin()) w += HUMAN_KG + heldWeight(this.s.held?.def);
    return w;
  }

  /** Brad flies around the cabin, and around the lobby only while it is open. */
  private updateBrad(dt: number): void {
    const b = this.s.boss;
    const open = this.levelFloor !== null && this.gate > 0.5;
    const inside = (v: THREE.Vector3) => v.z > CAB.minZ + 0.2 && Math.abs(v.x) < CAB.maxX - 0.3;
    if (!open) {
      if (b.state === 'patrol' && !inside(b.target)) b.target.set(rand(-1, 1), b.target.y, rand(-0.6, 1.0));
      if (!inside(b.pos) && !b.offline) {
        // Dragged along with the cabin: pulled back in through the gate.
        b.pos.x += (clamp(b.pos.x, -1.4, 1.4) - b.pos.x) * Math.min(1, dt * 4);
        b.pos.z += (0.2 - b.pos.z) * Math.min(1, dt * 3);
      }
    }
    // Keep him under the cabin ceiling
    if (inside(b.pos) && b.pos.y > CAB.h - 0.55) b.pos.y = CAB.h - 0.55;
  }

  private updateLamps(): void {
    const L = this.level;
    const lit = new Set<number>(this.extraLamps);
    for (const p of this.passengers) if (p.state === 'riding' && p.pressedButton) lit.add(p.dest);
    for (let k = 0; k < FLOORS; k++) L.setLamp(L.buttons[k], lit.has(k));
    const calls = new Set(this.passengers.filter((p) => p.state === 'waiting' || p.state === 'arriving').map((p) => p.floor));
    for (let k = 0; k < FLOORS; k++) L.setLamp(L.callLamps[k], calls.has(k), 2);
    L.setLamp(L.overloadLamp, this.overloaded, 2.2);
    L.drawGauge(this.offset, Math.abs(this.offset) < 0.9);
    // the cabin lights flicker while the motor is stalled
    const flick = this.stall > 0 && Math.sin(this.s.t * 23) > 0.3;
    L.cabinLights[0].intensity = flick ? 1.5 : 7;
    L.ceilingLampMat.emissiveIntensity = flick ? 0.2 : 1.1;
    this.level.leverPivot.rotation.z = -this.notch * 0.32;
  }

  private updateUi(dt: number): void {
    const near = clamp(Math.round(this.cabinY / SPACING), 0, FLOORS - 1);
    const calls = [...new Set(this.passengers.filter((p) => p.state === 'waiting' || p.state === 'arriving').map((p) => p.floor))]
      .sort((a, b) => a - b)
      .map((k) => X.FLOOR_LABELS[k])
      .join(' ');
    this.ui.update(dt, {
      floorLabel: X.FLOOR_LABELS[near],
      floorName: X.FLOOR_NAMES[near],
      dir: this.stall > 0 ? 'STUCK' : this.vel > 0.05 ? 'UP' : this.vel < -0.05 ? 'DOWN' : '',
      offset: Math.abs(this.offset) < 0.9 ? this.offset : null,
      silence: this.silence,
      weight: this.weight(),
      limit: LIMIT,
      notch: this.notch,
      gate: this.gate > 0.9 ? 'OPEN' : this.gate < 0.05 ? 'CLOSED' : '...',
      calls,
      music: X.MUSIC_NAMES[this.radio.station],
    });
  }
}

export const ELEVATOR_ENTRY: JobEntry | null = {
  id: 'elevator',
  title: 'Elevator Operator',
  place: `${X.TOWER} (Elevator B)`,
  teaser: 'Going up. Emotionally down.',
  models: MODELS,
  create: (scene) => new ElevatorJob(scene),
};

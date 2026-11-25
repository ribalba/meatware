import * as THREE from 'three';
import { bubbles } from '../../bubbles';
import type { Item, ItemDef } from '../../items';
import type { Interact } from '../../level';
import { clamp, pick, rand } from '../../util';
import type { Job, Look, Shift } from '../types';
import { buildCar, Car, CarRole, disposeCar, setBeacon } from './cars';
import { BROKEN_ARM_DEF, COIN_DEF, RECEIPT_DEF, tinyCoinMesh } from './items';
import {
  BARRIER_Z,
  CABIN_D,
  CABIN_W,
  DESPAWN_Z,
  islandX,
  LANE_W,
  LANES,
  laneX,
  MY_ISLAND,
  MY_LANE,
  MY_LANE_X,
  SEAT,
  SPAWN_Z,
  WINDOW_X,
} from './layout';
import { Painter } from './painter';
import { Barrier, TollPlaza } from './plaza';
import * as TX from './texts';
import { FUN_BOSS_LINES, FUN_CHAT_LINES, TOLL_SECRETS } from './mischief';

/**
 * Toll Booth Operator at the AUTOBAHN 2071 toll plaza.
 *
 * Sit at the window of booth 3 and work the barrier. Cars with a green beacon have paid
 * and never stop: open in time or they snap the arm. Red beacons stop at a closed barrier
 * and throw coins at your window: catch them, then open. Some drivers actually stop and
 * want a human (RoboGran, a robot who needs a receipt, the police, a lost van).
 */
const QUOTA = 20;
const STOP_FRONT = BARRIER_Z - 0.45;
const SPECIALS: CarRole[] = ['gran', 'receipt', 'police', 'directions'];

interface Flyer {
  item: Item;
  vel: THREE.Vector3;
  hover: number;
  rest: number;
}

interface TinyCoin {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  t: number;
}

export class TollJob implements Job {
  info = {
    id: 'toll',
    title: 'TOLL BOOTH OPERATOR',
    place: TX.PLAZA_NAME,
    teaser: 'The cars do not stop. They never stop.',
    quotaLabel: 'CARS',
    lockedDoor: 'Locked. The key is on the spare barrier arm in the parts yard. Far west. Across all six lanes.',
    bladderWarning: 'You really need to pee. The toilet is in the staff building on the far east side. The key is on the spare barrier arm in the parts yard, far west.',
  };
  level: TollPlaza;
  bossLines = { ...TX.BOSS_LINES, ...FUN_BOSS_LINES };
  chatLines = { ...TX.CHAT_LINES, ...FUN_CHAT_LINES };
  achievements = TX.ACHIEVEMENTS;
  secrets = TOLL_SECRETS;

  private s!: Shift;
  private cars: Car[] = [];
  private painter!: Painter;
  private seated = false;
  private stun = 0;
  private knock = new THREE.Vector3();
  private pitchBefore = 0;
  private nextSpawn: number[] = [];
  private nextSpecial = 28;
  /** The CEO drives through lane 3 in some shifts. */
  private ceoAt = Infinity;
  private specialBag: CarRole[] = [];
  private flyers: Flyer[] = [];
  private tiny: TinyCoin[] = [];
  private cash = 0;
  private stolenCash = 0;
  private keyArmOn = false;
  private honkCooldown = 0;
  private consoleT = 0;
  private jamT = 0;
  private laneT = 0;
  private brokenT = 0;
  private sirenT = 0;
  private dir = new THREE.Vector3();
  private cam = new THREE.Vector3();
  private c = {
    correct: 0,
    unpaid: 0,
    crashes: 0,
    caught: 0,
    picked: 0,
    hits: 0,
    maxQueue: 0,
    granRestarts: 0,
    granDone: 0,
    receiptsPrinted: 0,
    receiptsLost: 0,
    receiptsDone: 0,
    fines: 0,
    policeTolled: 0,
    directions: 0,
    wrongWay: 0,
    dreams: 0,
    repairs: 0,
    tips: 0,
    painterHits: 0,
    keyArm: 0,
  };

  constructor(scene: THREE.Scene) {
    this.level = new TollPlaza(scene);
  }

  // ---------------------------------------------------------------- setup

  start(shift: Shift): void {
    this.s = shift;
    this.painter = new Painter(shift.scene);
    for (let lane = 1; lane <= LANES; lane++) this.nextSpawn[lane] = lane === MY_LANE ? 2.5 : rand(0, 3);
    // the road is already busy when the shift starts
    for (let lane = 1; lane <= LANES; lane++) {
      if (lane === MY_LANE) continue;
      for (let z = -85 + rand(0, 20); z < 85; z += rand(18, 34)) this.spawn(lane, 'robot', z);
    }
    this.spawn(MY_LANE, 'paid', -62);
    this.spawn(MY_LANE, 'unpaid', -88);
    addEventListener('keydown', (e) => this.onKey(e));
    if (Math.random() < 0.4) this.ceoAt = rand(70, 220);
    this.level.fun.start(shift, {
      cars: () => this.cars,
      painter: this.painter,
      fine: (n) => (this.c.fines += n),
      honk: (c) => this.honk(c, true),
    });
    this.drawConsole();
  }

  private spawn(lane: number, role: CarRole, z = SPAWN_Z): Car {
    const car = buildCar(role, lane, laneX(lane), z);
    car.cruise = this.cruiseFor(car, z);
    car.speed = car.cruise;
    car.data.v = rand(-1.5, 2);
    this.s.scene.add(car.group);
    this.cars.push(car);
    return car;
  }

  private nextRole(): CarRole {
    if (this.s.t > this.ceoAt) {
      this.ceoAt = Infinity;
      return 'ceo';
    }
    if (this.s.t > this.nextSpecial && !this.cars.some((c) => c.lane === MY_LANE && this.isSpecial(c) && !c.passed)) {
      this.nextSpecial = this.s.t + rand(34, 46);
      if (!this.specialBag.length) this.specialBag = [...SPECIALS].sort(() => Math.random() - 0.5);
      return this.specialBag.pop()!;
    }
    return Math.random() < 0.62 ? 'paid' : 'unpaid';
  }

  private isSpecial(c: Car): boolean {
    return c.role === 'gran' || c.role === 'receipt' || c.role === 'police' || c.role === 'directions' || c.role === 'ceo';
  }

  // ---------------------------------------------------------------- engine hooks

  obstacles() {
    const out: { x: number; z: number; r: number }[] = [];
    const p = this.s?.player.pos;
    for (const c of this.cars) {
      if (c.speed > 3 || c.offroad) continue;
      if (p && Math.abs(c.z - p.z) > 8) continue;
      const r = c.width / 2;
      const n = Math.max(2, Math.round(c.len / (r * 1.6)));
      for (let i = 0; i < n; i++) out.push({ x: c.x, z: c.z - c.len / 2 + r * 0.8 + (i * (c.len - r * 1.6)) / (n - 1), r });
    }
    if (this.painter) out.push({ x: this.painter.group.position.x, z: this.painter.z, r: this.painter.radius });
    return out;
  }

  lookTargets(): THREE.Object3D[] {
    const p = this.s.player.pos;
    const out: THREE.Object3D[] = [this.painter.group];
    for (const c of this.cars) if (Math.abs(c.z - p.z) < 6 && Math.abs(c.x - p.x) < 6) out.push(c.group);
    return out;
  }

  quota() {
    return { done: this.c.correct, target: QUOTA };
  }

  productive(): boolean {
    return this.c.correct >= 15;
  }

  heldLabel(it: Item): string {
    if (it.def.id === 'tollCoin') return ' (put it in the cash box)';
    if (it.def.id === 'brokenArm') return ' (duct tape it back on)';
    return '';
  }

  employeeOfTheMonth(pocket: ItemDef[], fired: boolean): string {
    if (pocket.some((p) => p.id === 'cashBox') && !fired) return 'You. The cash box agrees. Quietly.';
    if (this.keyArmOn) return 'The Toilet Key (it worked as a barrier all day)';
    return 'Barrier Arm 3 (it went up and down all day)';
  }

  reviewRows(): [string, string | number][] {
    // The review is shown now. Speech bubbles of the robots should not float over it.
    bubbles.clear();
    const c = this.c;
    const rows: [string, string | number][] = [
      ['Cars processed correctly', c.correct],
      ['Cars waved through unpaid', c.unpaid],
      ['Barrier arms snapped by customers', c.crashes],
      ['Coins caught in mid-air', c.caught],
      ['Coins picked up from the asphalt', c.picked],
      ['Times hit by a car', c.hits],
      ['Longest traffic jam (cars)', c.maxQueue],
    ];
    if (c.granDone || c.granRestarts) rows.push(['RoboGran recounts caused', c.granRestarts]);
    if (c.receiptsPrinted) rows.push(['Receipts lost to the wind', `${c.receiptsLost} of ${c.receiptsPrinted}`]);
    if (c.directions) rows.push(['Directions given (wrong way / dreams)', `${c.directions} (${c.wrongWay} / ${c.dreams})`]);
    if (c.policeTolled) rows.push(['Police officers charged a toll', c.policeTolled]);
    if (c.painterHits) rows.push(['Line painter knocked over', c.painterHits]);
    return rows;
  }

  payRows(): [string, number][] {
    const c = this.c;
    const rows: [string, number][] = [];
    const t = this.s.counter('toilet');
    if (t) rows.push([`Spare arm key rental x${t}`, -2 * t]);
    if (c.unpaid) rows.push([`Unpaid tolls (deducted from you) x${c.unpaid}`, -1.5 * c.unpaid]);
    if (c.crashes) rows.push([`Barrier arm wear and tear x${c.crashes}`, -4 * c.crashes]);
    if (c.repairs) rows.push([`Duct tape x${c.repairs}`, -0.5 * c.repairs]);
    if (c.hits) rows.push([`Hazard pay (per car impact) x${c.hits}`, 0.01 * c.hits]);
    if (c.tips) rows.push(['Tips caught', c.tips], ['Tips (company property)', -c.tips]);
    if (c.fines) rows.push(['Police fines', -c.fines]);
    if (this.stolenCash) rows.push(['Missing cash box contents', -this.stolenCash]);
    return rows;
  }

  // ---------------------------------------------------------------- input

  private onKey(e: KeyboardEvent): void {
    if (!document.pointerLockElement || e.repeat || !this.s) return;
    if (!this.seated) return;
    switch (e.code) {
      case 'KeyR':
      case 'Space':
        this.toggleBarrier();
        e.preventDefault();
        break;
      case 'KeyF':
      case 'KeyW':
      case 'KeyA':
      case 'KeyS':
      case 'KeyD':
        this.standUp();
        break;
      case 'Digit1':
      case 'Digit2':
      case 'Digit3': {
        const v = this.windowCar();
        if (v && v.role === 'directions' && !v.served) this.answerDirections(v, Number(e.code.slice(5)));
        break;
      }
    }
  }

  private toggleBarrier(): void {
    const b = this.level.myBarrier();
    if (b.broken) {
      this.s.say('You press the button. There is no arm. The motor hums with ambition.', 2.5);
      this.s.sfx.buzz();
      return;
    }
    b.target = b.target > 0.5 ? 0 : Math.PI / 2 - 0.05;
    this.s.sfx.click();
    this.s.sfx.tone(b.target > 0.5 ? 330 : 220, 0.12, 'square', 0.06);
  }

  private sitDown(): void {
    const s = this.s;
    const held = s.held;
    if (held) {
      if (held.def.id === 'tollCoin') {
        s.removeHeld();
        this.deposit();
      } else if (held.def.id !== 'receipt') {
        s.say(`You cannot work the window while holding the ${held.def.name.toLowerCase()}.`, 2.5);
        return;
      }
    }
    this.seated = true;
    s.movementLocked = true;
    s.player.pos.set(SEAT.x, 0, SEAT.z);
    s.player.vel.set(0, 0, 0);
    s.player.yaw = -Math.PI / 2 + 0.25;
    s.player.pitch = -0.08;
    s.sfx.click();
  }

  private standUp(): void {
    this.seated = false;
    this.s.movementLocked = this.stun > 0;
    this.s.player.pos.set(SEAT.x - 0.35, 0, SEAT.z + 0.4);
  }

  // ---------------------------------------------------------------- E key

  interact(look: Look | null): boolean {
    const s = this.s;
    const info = look?.info as (Interact & { car?: Car }) | undefined;
    const held = s.held;
    // catching flying coins works from anywhere, with or without a look
    if (!held || this.seated) {
      if (this.tryCatch()) return true;
    }
    if (this.level.fun.interact(look)) return true;
    const car = info?.car ?? (this.seated ? this.windowCar() : null);
    if (held) {
      if (held.def.id === 'receipt' && car && car.role === 'receipt' && car.atWindow && !car.served) {
        this.giveReceipt(car);
        return true;
      }
      if (held.def.id === 'tollCoin' && info?.kind === 'item' && info.item === this.level.cashBox) {
        s.removeHeld();
        this.deposit();
        return true;
      }
      if ((held.def.id === 'brokenArm' || held.def.id === 'keyArm') && (info?.kind === 'barrier' || this.nearStump())) {
        this.repair(held);
        return true;
      }
      if (held.def.id === 'tollCoin' && this.inBooth()) {
        s.removeHeld();
        this.deposit();
        return true;
      }
      return false;
    }
    if (this.seated) {
      if (car && car.atWindow && !car.served) {
        this.serve(car);
        return true;
      }
      if (info?.kind === 'item') return false;
      if (info?.kind === 'car' && info.car) {
        bubbles.say(info.car.head, 0.8, pick(['Beep.', 'Do not look at me.', 'I am driving.', 'Hello, booth.']), 2, info.car.name);
        return true;
      }
      s.say(pick(['You wave at nobody. Nobody waves back.', 'The console blinks at you. You blink back.', 'R or Space works the barrier. WASD gets you up.']), 2.2);
      return true;
    }
    if (!info) return false;
    switch (info.kind) {
      case 'seat':
      case 'console':
        this.sitDown();
        return true;
      case 'barrier':
        this.barrierHands();
        return true;
      case 'car':
        if (info.car) this.talkToCar(info.car);
        return true;
      case 'painter':
        this.painter.talk();
        if (Math.random() < 0.4) s.chat('painter');
        return true;
      case 'vending':
        s.say(pick(TX.VENDING), 3);
        s.sfx.buzz();
        return true;
    }
    return false;
  }

  hint(look: Look | null): string | null {
    const s = this.s;
    if (this.stun > 0) return 'You are lying on the autobahn.';
    const info = look?.info as (Interact & { car?: Car }) | undefined;
    const held = s.held;
    if (this.seated) {
      const v = this.windowCar();
      const base = 'R/SPACE: barrier  ·  WASD: get up';
      if (this.catchable()) return `E: CATCH THE COIN  ·  ${base}`;
      const fh = this.level.fun.hint(look);
      if (fh !== null && !(v && !v.served)) return `${fh}  ·  ${base}`;
      if (v && !v.served) {
        switch (v.role) {
          case 'ceo':
            return `E: charge the CEO a toll  ·  ${base}`;
          case 'gran':
            return `E: hurry her up  ·  ${base}`;
          case 'receipt':
            return held?.def.id === 'receipt' ? `E: hand over the receipt  ·  ${base}` : `E: print a receipt  ·  ${base}`;
          case 'police':
            return `E: charge the police a toll  ·  ${base}`;
          case 'directions':
            return `${TX.DIRECTIONS.options}`;
        }
      }
      if (info?.kind === 'item' && info.item) return `E: take ${info.item.def.name}  ·  ${base}`;
      return base;
    }
    if (this.catchable() && !held) return 'E: CATCH THE COIN';
    const funHint = this.level.fun.hint(look);
    if (funHint !== null) return funHint;
    if (!info) return null;
    switch (info.kind) {
      case 'seat':
      case 'console':
        return held && held.def.id !== 'tollCoin' && held.def.id !== 'receipt' ? 'Put that down first' : 'E: sit at the window';
      case 'barrier': {
        const b = this.level.myBarrier();
        if (held?.def.id === 'brokenArm') return b.broken ? 'E: duct tape the arm back on' : 'The barrier already has an arm';
        if (held?.def.id === 'keyArm') return b.broken ? 'E: install the spare arm (with the toilet key)' : 'The barrier already has an arm';
        if (this.keyArmOn) return 'E: take the spare arm (toilet key) back';
        return b.broken ? 'The arm is gone. Find it on the road.' : 'Barrier 3. Worked from the booth.';
      }
      case 'car': {
        const car = info.car!;
        if (held?.def.id === 'receipt' && car.role === 'receipt' && car.atWindow && !car.served) return 'E: hand over the receipt';
        return `E: talk to ${car.name}`;
      }
      case 'painter':
        return `E: talk to ${this.painter.name}`;
      case 'vending':
        return 'E: buy a snack';
      case 'item':
        if (held?.def.id === 'tollCoin' && info.item === this.level.cashBox) return 'E: put the coin in the cash box';
        return null;
      case 'island':
        return held ? 'E: drop' : '';
    }
    return null;
  }

  thrownHit(it: Item): boolean {
    const s = this.s;
    const p = it.mesh.position;
    const pt = this.painter;
    if (pt.state !== 'fallen' && Math.hypot(p.x - pt.group.position.x, p.z - pt.z) < 0.6 && p.y < pt.height + 0.4) {
      it.vel.multiplyScalar(-0.3);
      it.thrown = false;
      pt.hit();
      this.c.painterHits++;
      s.hype += 12;
      s.sfx.thud();
      s.chat('painter', {}, 2);
      if (s.seen) s.bossSay('painter', true);
      return true;
    }
    for (const c of this.cars) {
      if (Math.abs(p.x - c.x) < c.width / 2 + 0.1 && Math.abs(p.z - c.z) < c.len / 2 + 0.1 && p.y < c.height + 0.3) {
        if (it.def.id === 'prop-traffic-cone' && !c.data.hat) {
          this.level.fun.coneHat(c, it);
          return true;
        }
        it.vel.set(rand(-2, 2), 2, c.speed + 1);
        it.thrown = false;
        s.sfx.thud();
        bubbles.say(c.head, 0.8, pick(['A dent! I have no brakes AND now a dent.', 'Projectile detected. Complaint filed.', 'Ow. My paint.']), 2.5, c.name);
        s.hype += 8;
        s.chat('hype');
        return true;
      }
    }
    return false;
  }

  onKick(look: Look | null): boolean {
    if (!look) return false;
    const near = look.point.distanceTo(this.s.camera.getWorldPosition(new THREE.Vector3())) < 2.6;
    if (!near) return false;
    const info = look.info as Interact & { car?: Car };
    const s = this.s;
    if (info.kind === 'car' && info.car) {
      this.level.fun.kickCar(info.car);
      return true;
    }
    if (info.kind === 'painter') {
      const pt = this.painter;
      if (pt.state === 'fallen') {
        pt.say('I am already on the ground. I am painting from here now.', 3);
        s.sfx.thud();
        return true;
      }
      pt.hit();
      this.c.painterHits++;
      s.hype += 10;
      s.sfx.thud();
      s.chat('painter', {}, 2);
      if (s.seen) s.bossSay('painter', true);
      return true;
    }
    return this.level.fun.onKick(look);
  }

  // ---------------------------------------------------------------- per frame

  update(dt: number): void {
    this.level.updateBarriers(dt);
    this.updateTraffic(dt);
    this.updateFlyers(dt);
    this.updateTiny(dt);
    this.painter.update(dt);
    this.level.fun.update(dt);
    this.updatePlayer(dt);
    this.updateRules(dt);
    this.honkCooldown -= dt;
    this.consoleT -= dt;
    if (this.consoleT <= 0) {
      this.consoleT = 0.25;
      this.drawConsole();
    }
    // the cash box left the building
    if (this.level.cashBox.state === 'gone' && this.cash > 0) {
      this.stolenCash += this.cash;
      this.cash = 0;
    }
  }

  // ---------------------------------------------------------------- traffic

  private cruiseFor(c: Car, z: number): number {
    const v = c.data.v ?? 0;
    if (c.offroad) return 7;
    if (c.lane !== MY_LANE) return 10.5 + v;
    if (c.role === 'gran') return c.passed ? 4 : z < -30 ? 8 : 4.5;
    if (c.passed) return 12;
    return z < -30 ? 11 + v * 0.5 : 6.5;
  }

  private barrierOpen(b: Barrier): boolean {
    return b.broken || b.angle > 1.15;
  }

  /** The arm is so short nobody takes it seriously any more. */
  private armUseless(b: Barrier): boolean {
    return b.broken || b.length < 0.45;
  }

  private mustStop(c: Car, b: Barrier): boolean {
    if (c.passed || c.lane !== MY_LANE) return false;
    if (c.role === 'police') return !c.data.siren && !this.barrierOpen(b);
    if (this.isSpecial(c)) {
      return !c.served || !this.barrierOpen(b);
    }
    if (c.role === 'unpaid') return !this.armUseless(b) && !this.barrierOpen(b);
    return false;
  }

  private updateTraffic(dt: number): void {
    const s = this.s;
    const my = this.level.myBarrier();
    // spawning
    for (let lane = 1; lane <= LANES; lane++) {
      this.nextSpawn[lane] -= dt;
      if (this.nextSpawn[lane] > 0) continue;
      const last = this.cars.filter((c) => c.lane === lane && !c.offroad).reduce((m, c) => Math.min(m, c.z - c.len / 2), Infinity);
      if (last < SPAWN_Z + 9) {
        this.nextSpawn[lane] = 1;
        continue;
      }
      if (lane === MY_LANE) {
        this.spawn(lane, this.nextRole());
        this.nextSpawn[lane] = rand(4.5, 8);
      } else {
        this.spawn(lane, 'robot');
        this.nextSpawn[lane] = rand(3, 7.5);
      }
    }

    // driving, lane by lane, front car first
    for (let lane = 1; lane <= LANES; lane++) {
      const list = this.cars.filter((c) => c.lane === lane && !c.offroad).sort((a, b) => b.z - a.z);
      let leader: Car | null = null;
      for (const c of list) {
        let d = Infinity;
        if (leader) d = leader.z - leader.len / 2 - (c.z + c.len / 2) - 1.1;
        if (this.mustStop(c, my)) d = Math.min(d, STOP_FRONT - (c.z + c.len / 2));
        const cruise = this.cruiseFor(c, c.z);
        let v = Math.min(cruise, Math.sqrt(2 * 7 * Math.max(0, d)));
        if (d <= 0.02) v = 0;
        if (c.data.stall > 0) {
          c.data.stall -= dt;
          v = 0;
        }
        c.speed = v < c.speed ? v : Math.min(v, c.speed + 3.2 * dt);
        c.z += c.speed * dt;
        c.wait = c.speed < 0.3 ? c.wait + dt : 0;
        leader = c;
        if (lane === MY_LANE) this.laneThree(c, my, dt);
      }
    }
    // the van that followed its dreams
    for (const c of this.cars) {
      if (!c.offroad) continue;
      c.speed = Math.min(8, c.speed + dt * 3);
      c.x -= c.speed * dt * 0.75;
      c.z += c.speed * dt * 0.66;
      c.group.rotation.y = -0.85;
      if (c.x < -60) c.dead = true;
    }
    // robot lanes open their barriers on their own
    for (const b of this.level.barriers) {
      if (b.lane === MY_LANE) continue;
      const near = this.cars.some((c) => c.lane === b.lane && !c.offroad && c.z + c.len / 2 > BARRIER_Z - 16 && c.z - c.len / 2 < BARRIER_Z + 1);
      b.target = near ? Math.PI / 2 - 0.05 : 0;
    }

    // move meshes, spin wheels, honk, run over things, hit the player
    const P = s.player.pos;
    for (const c of this.cars) {
      c.group.position.set(c.x, 0, c.z);
      // drivers lean out of the window to talk to the human
      const hp = c.head.userData as { base: THREE.Vector3; lean: THREE.Vector3 };
      const lean = c.atWindow && !c.passed && !c.turned;
      c.head.position.lerp(lean ? hp.lean : hp.base, Math.min(1, dt * 5));
      c.head.rotation.y += ((lean ? -0.9 : 0) - c.head.rotation.y) * Math.min(1, dt * 5);
      for (const w of c.wheels) w.rotation.x += c.speed * dt * 2.2;
      if (c.turned > 0 && c.turned < 1) {
        c.turned = Math.min(1, c.turned + dt * 0.5);
        c.body.rotation.y = Math.PI * c.turned;
      }
      if (c.z > DESPAWN_Z) c.dead = true;
      if (c.wait > 2.5 && c.lane === MY_LANE && !c.atWindow) {
        c.nextHonk -= dt;
        if (c.nextHonk <= 0) {
          c.nextHonk = rand(2.5, 6);
          this.honk(c);
        }
      }
      if (c.speed > 2) this.runOver(c);
      if (c.speed > 2.5 && this.stun <= 0 && !c.data.hitPlayer) {
        if (Math.abs(P.x - c.x) < c.width / 2 + 0.3 && Math.abs(P.z - c.z) < c.len / 2 + 0.3) this.hitPlayer(c);
      }
    }
    for (const c of this.cars) {
      if (!c.dead) continue;
      s.scene.remove(c.group);
      disposeCar(c);
    }
    this.cars = this.cars.filter((c) => !c.dead);
  }

  /** Lane 3: barrier crossing, payments and the special drivers. */
  private laneThree(c: Car, b: Barrier, dt: number): void {
    const s = this.s;
    const front = c.z + c.len / 2;
    // tip throwers: a paying car passing the window may toss a coin
    if (!c.threw && c.role === 'paid' && c.z > -2.2 && c.z < 0.5 && c.speed > 2) {
      c.threw = true;
      if (Math.random() < 0.28) {
        this.throwCoin(c, 0.42);
        bubbles.say(c.head, 0.8, pick(TX.TIP_LINES), 2.2, c.name);
        c.data.tip = 1;
      }
    }
    // stopped at the window
    const atWin = !c.passed && c.speed < 0.2 && front > STOP_FRONT - 0.3;
    if (atWin && !c.atWindow) {
      c.atWindow = true;
      this.arrive(c);
    }
    if (c.atWindow && !c.passed) this.atWindow(c, b, dt);
    // crossing the barrier line
    if (!c.passed && front > BARRIER_Z - 0.05) {
      c.passed = true;
      c.atWindow = false;
      s.hud.progress(null);
      const wasBroken = b.broken;
      if (!b.broken && b.angle < 1.0 && b.length >= 0.3) {
        this.crash(c, b);
        return;
      }
      if (c.data.turned) {
        bubbles.say(c.head, 0.8, 'Reversing into the future. Goodbye.', 2.5, c.name);
      }
      if (c.data.dreams) {
        c.offroad = true;
        c.lane = 0;
        s.hype += 10;
        s.chat('dreams', {}, 2);
      }
      if (c.paid || c.served) {
        if (wasBroken) return;
        this.c.correct++;
        s.annoyance = Math.max(0, s.annoyance - 5);
        s.sfx.ding();
        if (s.seen && Math.random() < 0.3) s.bossSay('correctSeen');
        if (Math.random() < 0.15) s.chat('correct');
        if (this.c.correct === QUOTA) s.hud.toast('QUOTA REACHED', 'Brad has increased the traffic. Congratulations.', 'corp');
        if (c.role === 'gran') c.data.stall = 0;
      } else {
        this.c.unpaid++;
        s.hype += 6;
        s.sfx.buzz();
        bubbles.say(c.head, 0.8, pick(TX.UNPAID_FREE), 2.2, c.name);
        s.chat('unpaid');
        if (s.seen) {
          s.annoyance += 22;
          s.boss.confront();
          s.bossSay('unpaid', true);
        }
      }
    }
    // RoboGran stalls once after the barrier
    if (c.role === 'gran' && c.passed && !c.data.stalled && c.z > BARRIER_Z + 3) {
      c.data.stalled = 1;
      c.data.stall = 1.6;
      bubbles.say(c.head, 0.8, pick(TX.GRAN.stall), 2.5, c.name);
    }
  }

  private arrive(c: Car): void {
    const s = this.s;
    const say = (t: string, sec = 3.5) => bubbles.say(c.head, 0.8, t, sec, c.name);
    c.data.t = 0;
    switch (c.role) {
      case 'unpaid':
        c.data.pay = 0.9;
        break;
      case 'gran':
        say(pick(TX.GRAN.arrive), 4);
        c.data.count = 0;
        c.data.next = 2.2;
        s.chat('gran', {}, 2);
        break;
      case 'receipt':
        say(TX.RECEIPT.arrive[0], 4);
        c.data.pay = 1.6;
        s.chat('receipt');
        break;
      case 'police':
        say(TX.POLICE.arrive[0], 5);
        s.chat('police', {}, 2);
        if (s.seen) s.bossSay('police');
        break;
      case 'directions':
        say(pick(TX.DIRECTIONS.ask), 5);
        s.chat('directions');
        break;
      case 'ceo':
        say('I am the CEO. I do not pay tolls. I own tolls. I own this lane. I own your stool. Open the barrier, human.', 5);
        s.chat('ceo', {}, 2);
        break;
    }
  }

  private atWindow(c: Car, b: Barrier, dt: number): void {
    const s = this.s;
    c.data.t = (c.data.t ?? 0) + dt;
    const say = (t: string, sec = 3) => bubbles.say(c.head, 0.8, t, sec, c.name);
    switch (c.role) {
      case 'unpaid':
        if (!c.paid) {
          c.data.pay -= dt;
          if (c.data.pay <= 0) {
            c.paid = true;
            setBeacon(c);
            say(pick(TX.UNPAID_PAY), 2.4);
            this.throwCoin(c, 0.5);
            setTimeout(() => this.throwCoin(c, 0.5), 380);
          }
        } else if (c.data.t > 6 && !this.barrierOpen(b)) {
          c.data.t = 2;
          say(pick(TX.UNPAID_WAIT), 2.5);
        }
        break;
      case 'gran':
        if (!c.served) {
          c.data.next -= dt;
          if (c.data.next <= 0) {
            c.data.count++;
            c.data.next = 0.95;
            this.tinyCoin(c);
            if (c.data.count >= 15) {
              c.served = true;
              c.paid = true;
              this.c.granDone++;
              this.cash += 2;
              say(pick(TX.GRAN.done), 3.5);
              s.hud.progress(null);
            }
          }
          if (!c.served && this.nearWindow()) s.hud.progress(`RoboGran is counting five cent coins: ${c.data.count}/15`, c.data.count / 15);
        } else if (c.data.t > 30 && !this.barrierOpen(b)) {
          c.data.t = 22;
          say(pick(TX.GRAN.wait));
        }
        break;
      case 'receipt':
        if (!c.paid) {
          c.data.pay -= dt;
          if (c.data.pay <= 0) {
            c.paid = true;
            this.throwCoin(c, 0.5);
            setTimeout(() => this.throwCoin(c, 0.5), 380);
            setTimeout(() => say(TX.RECEIPT.ask[0], 3), 900);
          }
        } else if (!c.served) {
          if (c.data.t > 55) {
            c.served = true;
            say(TX.RECEIPT.giveUp[0], 4);
          } else if (Math.floor(c.data.t) % 9 === 0 && Math.floor(c.data.t - dt) % 9 !== 0) {
            say(pick(TX.RECEIPT.ask), 2.5);
          }
        }
        break;
      case 'police': {
        if (!c.data.checked) {
          c.data.checked = 1;
          if (s.counter('stolen') > 0 || this.level.cashBox.state === 'gone') {
            setTimeout(() => say(TX.POLICE.pockets[0], 4.5), 2500);
            this.c.fines += 15;
            s.hype += 12;
            s.chat('police');
          }
          c.paid = true;
        }
        if (!this.barrierOpen(b) && !c.data.siren) {
          const left = 12 - c.data.t;
          if (left < 8 && left > 0 && this.nearWindow()) s.hud.progress(`Officer Unit-0 is counting to ten. Patience: ${Math.ceil(left)}`, 1 - left / 12);
          if (Math.floor(c.data.t) === 6 && Math.floor(c.data.t - dt) === 5) say(pick(TX.POLICE.wait), 2.5);
          if (left <= 0 && !c.data.siren) {
            c.data.siren = 1;
            say(TX.POLICE.siren[0], 2.5);
            s.hud.progress(null);
            this.sirenT = 2.5;
          }
        }
        break;
      }
      case 'ceo':
        if (!c.served && c.data.t > 24) {
          c.served = true;
          c.paid = true;
          say('Fine. I will pay you in exposure. You are now exposed.', 3.5);
        }
        break;
      case 'directions':
        if (!c.served && c.data.t > 26) {
          say('Never mind. I will follow the car in front of me. There is none. I will improvise.', 3.5);
          c.served = true;
          c.paid = true;
        }
        break;
    }
  }

  /** E at the window with a special driver. */
  private serve(c: Car): void {
    const s = this.s;
    const say = (t: string, sec = 3) => bubbles.say(c.head, 0.8, t, sec, c.name);
    switch (c.role) {
      case 'gran':
        if (c.data.count > 0) {
          c.data.count = 0;
          c.data.next = 1.8;
          this.c.granRestarts++;
          say(pick(TX.GRAN.restart), 3);
          s.hype += 9;
          s.chat('granRestart', {}, 2);
          if (s.seen) {
            s.annoyance += 6;
            s.bossSay('granHurry', true);
          }
        } else say('Patience, dear. I am at one.', 2);
        break;
      case 'receipt':
        if (!c.paid) {
          say('I have not even paid yet. Patience is a currency too.', 2.5);
          return;
        }
        this.printReceipt(c);
        break;
      case 'police':
        if (c.data.tolled) {
          say('You already charged me. I am still processing the emotion.', 2.5);
          return;
        }
        c.data.tolled = 1;
        this.c.policeTolled++;
        this.c.fines += 10;
        say(TX.POLICE.toll[0], 4.5);
        this.throwCoin(c, 0.5);
        s.hype += 16;
        s.chat('policeToll', {}, 3);
        if (s.seen) s.bossSay('police', true);
        break;
      case 'directions':
        say(`${pick(TX.DIRECTIONS.ask)}`, 3);
        s.say(TX.DIRECTIONS.options, 3);
        break;
      case 'ceo':
        c.served = true;
        c.paid = true;
        say('You... charged me? Nobody charges me. I respect it. I will fire someone for this. Not you. You are not on any list.', 5);
        this.throwCoin(c, 0.5);
        setTimeout(() => this.throwCoin(c, 0.5), 300);
        setTimeout(() => this.throwCoin(c, 0.5), 600);
        s.hype += 20;
        s.chat('ceo', {}, 3);
        s.secret('toll.ceo');
        if (s.seen) setTimeout(() => s.bossSay('ceo', true), 2500);
        break;
      default:
        say(pick(TX.UNPAID_WAIT), 2);
    }
  }

  private answerDirections(c: Car, n: number): void {
    const s = this.s;
    const say = (t: string, sec = 3.5) => bubbles.say(c.head, 0.8, t, sec, c.name);
    c.served = true;
    c.paid = true;
    this.c.directions++;
    if (n === 1) {
      say(pick(TX.DIRECTIONS.straight));
      this.throwCoin(c, 0.5);
    } else if (n === 2) {
      say(pick(TX.DIRECTIONS.turn), 4);
      c.turned = 0.01;
      c.data.turned = 1;
      this.c.wrongWay++;
      s.hype += 12;
      s.chat('wrongWay', {}, 2);
      if (s.seen) {
        s.annoyance += 10;
        s.bossSay('wrongWay', true);
      }
    } else {
      say(pick(TX.DIRECTIONS.dreams), 4);
      c.data.dreams = 1;
      this.c.dreams++;
      s.hype += 6;
    }
  }

  private talkToCar(c: Car): void {
    const say = (t: string, sec = 2.5) => bubbles.say(c.head, 0.8, t, sec, c.name);
    if (c.atWindow && !c.served && this.nearWindow()) {
      this.serve(c);
      return;
    }
    if (c.speed > 1) say(pick(TX.PAID_PASS));
    else if (c.lane === MY_LANE) say(pick(['Are you the human? Go back in your box.', 'I am queueing. It is a new feeling.', 'HONK. Sorry. Reflex.', 'Is this the authentic experience?']), 2.8);
    else say(pick(['I am a robot lane. Please leave.', 'You are standing in traffic. Bold.']));
  }

  // ---------------------------------------------------------------- events

  private crash(c: Car, b: Barrier): void {
    const s = this.s;
    b.broken = true;
    b.target = 0;
    this.c.crashes++;
    s.hype += 14;
    s.sfx.thud();
    s.sfx.noise(0.35, 0.25, 1800);
    bubbles.say(c.head, 0.8, pick(TX.CRASH_LINES), 2.6, c.name);
    s.chat('crash', {}, 2);
    // the arm flies off down the road
    const pos = new THREE.Vector3(this.level.stump.x + 1.4, 1.1, BARRIER_Z + 0.3);
    let it: Item;
    if (this.keyArmOn) {
      this.keyArmOn = false;
      this.level.setKeyArm(b, false);
      it = this.level.keyArm;
      it.state = 'world';
      s.scene.add(it.mesh);
      if (!s.items.includes(it)) s.items.push(it);
      it.mesh.position.copy(pos);
      s.say('The car snapped off the spare arm. The toilet key is flying down the autobahn.', 3);
    } else {
      it = s.addItem(BROKEN_ARM_DEF, pos);
    }
    it.mesh.rotation.set(0, 0.3, 0);
    it.vel.set(rand(-1, 2), 3.5, c.speed * 0.9 + 2);
    it.sleeping = false;
    if (s.seen || s.boss.horizontalDist(this.level.stump) < 10) {
      s.annoyance += 18;
      s.boss.confront();
      s.bossSay('barrierBroken', true);
    }
  }

  private hitPlayer(c: Car): void {
    const s = this.s;
    c.data.hitPlayer = 1;
    if (this.seated) this.standUp();
    this.c.hits++;
    const P = s.player.pos;
    const side = Math.sign(P.x - c.x) || (Math.random() < 0.5 ? -1 : 1);
    this.knock.set(side * 7, 0, Math.min(10, c.speed) * 0.8);
    this.stun = 1.3;
    s.movementLocked = true;
    this.pitchBefore = s.player.pitch;
    s.player.pitch = clamp(s.player.pitch + 0.7, -1.4, 1.4);
    s.hype += 14;
    s.sfx.thud();
    this.honk(c, true);
    bubbles.say(c.head, 0.8, pick(TX.HIT_PLAYER), 2.4, c.name);
    s.chat('hitByCar', {}, 3);
    s.say(pick(['A car hits you. It does not stop. As advertised.', 'You bounce off a bumper. The bumper is fine.', 'You have been processed by traffic.']), 2.5);
    if (this.c.hits >= 3) s.achieve('roadkill');
    if (s.held) this.dropHeld(new THREE.Vector3(side * 3, 3, c.speed * 0.6));
    if (s.seen) {
      s.annoyance += 8;
      s.bossSay('hitByCar', true);
    }
  }

  private dropHeld(vel: THREE.Vector3): void {
    const s = this.s;
    const it = s.detachHeld();
    if (!it) return;
    const p = s.player.pos;
    s.scene.add(it.mesh);
    it.mesh.position.set(p.x, 1.2, p.z);
    it.mesh.rotation.set(0, s.player.yaw, 0);
    it.state = 'world';
    it.sleeping = false;
    it.vel.copy(vel);
  }

  private honk(c: Car, force = false): void {
    const s = this.s;
    if (this.honkCooldown > 0 && !force) return;
    this.honkCooldown = 0.7;
    const f = rand(330, 470);
    const vol = clamp(0.09 - Math.hypot(c.x - s.player.pos.x, c.z - s.player.pos.z) * 0.0012, 0.02, 0.09);
    s.sfx.tone(f, 0.28, 'square', vol);
    s.sfx.tone(f * 1.26, 0.28, 'square', vol * 0.8);
    bubbles.say(c.head, 0.8, pick(TX.HONKS), 1.4);
    if (Math.random() < 0.25) s.chat('honk');
    s.hype += 1;
  }

  /** Cars kick away anything lying in their path. */
  private runOver(c: Car): void {
    for (const it of this.s.items) {
      if (it.state !== 'world' || it.mesh.position.y > 0.7) continue;
      const p = it.mesh.position;
      if (Math.abs(p.x - c.x) < c.width / 2 && Math.abs(p.z - c.z) < c.len / 2) {
        it.sleeping = false;
        it.vel.set(rand(-3.5, 3.5), rand(1.5, 3.5), c.speed * 0.8);
      }
    }
  }

  // ---------------------------------------------------------------- coins

  /** A car throws a coin at the booth window (at the player when seated). */
  private throwCoin(c: Car, T: number): void {
    const s = this.s;
    if (!this.cars.includes(c)) return;
    const from = c.head.getWorldPosition(new THREE.Vector3());
    from.x = Math.min(from.x, c.x - c.width / 2 - 0.1);
    from.y = Math.max(0.9, from.y);
    from.z += rand(-0.1, 0.2);
    const to = this.seated
      ? new THREE.Vector3(WINDOW_X - 0.2, 1.55 + rand(-0.15, 0.2), s.player.pos.z + rand(-0.35, 0.35))
      : new THREE.Vector3(WINDOW_X, 1.5 + rand(-0.2, 0.2), rand(-0.9, 0.9));
    const it = s.addItem(COIN_DEF, from);
    const vel = to.sub(from).divideScalar(T);
    vel.y += 4.9 * T;
    it.vel.copy(vel);
    it.sleeping = false;
    s.sfx.tone(1400, 0.05, 'triangle', 0.04);
  }

  /** RoboGran's five cent coins: decorative, they land on the counter and vanish. */
  private tinyCoin(c: Car): void {
    const m = tinyCoinMesh();
    m.position.set(c.x - c.width / 2, c.height * 0.7, c.z);
    this.s.scene.add(m);
    const to = new THREE.Vector3(WINDOW_X + 0.15, 1.3, 0.55);
    const T = 0.5;
    const vel = to.sub(m.position).divideScalar(T);
    vel.y += 4.9 * T;
    this.tiny.push({ mesh: m, vel, t: 0 });
    this.s.sfx.tone(2200 + Math.random() * 300, 0.03, 'triangle', 0.03);
  }

  private updateTiny(dt: number): void {
    for (const t of this.tiny) {
      t.t += dt;
      if (t.t < 0.5) {
        t.vel.y -= 9.8 * dt;
        t.mesh.position.addScaledVector(t.vel, dt);
        t.mesh.rotation.x += dt * 12;
      }
    }
    const done = this.tiny.filter((t) => t.t > 1.4);
    for (const t of done) this.s.scene.remove(t.mesh);
    if (done.length) this.tiny = this.tiny.filter((t) => t.t <= 1.4);
  }

  private coinsInAir(): Item[] {
    return this.s.items.filter((i) => i.def.id === 'tollCoin' && i.state === 'world' && !i.sleeping && i.mesh.position.y > 0.35);
  }

  /** The best coin to catch right now, if any. */
  private catchable(): Item | null {
    const s = this.s;
    s.camera.getWorldPosition(this.cam);
    s.camera.getWorldDirection(this.dir);
    let best: Item | null = null;
    let bestD = 2.7;
    for (const it of this.coinsInAir()) {
      const v = it.mesh.position.clone().sub(this.cam);
      const d = v.length();
      if (d > bestD) continue;
      if (d > 0.5 && v.normalize().dot(this.dir) < 0.5) continue;
      best = it;
      bestD = d;
    }
    return best;
  }

  private tryCatch(): boolean {
    const s = this.s;
    const it = this.catchable();
    if (!it) return false;
    if (!this.cashBoxHome() && s.held) return false;
    this.c.caught++;
    const tip = this.cars.some((c) => c.data.tip && Math.abs(c.z - it.mesh.position.z) < 8);
    if (tip) this.c.tips++;
    if (this.cashBoxHome()) {
      s.removeItem(it);
      this.cash++;
      s.sfx.ding();
      s.say(pick(['Caught. Into the box.', 'Nice catch. The box jingles.', 'Caught it. One credit closer to nothing.']), 1.5);
    } else {
      s.pickUp(it);
      s.say('You catch the coin. There is no cash box any more. You hold it awkwardly.', 2.5);
    }
    s.hype += 4;
    if (this.c.caught % 3 === 1) s.chat('catch');
    if (this.c.caught >= 10) s.achieve('catch');
    return true;
  }

  private deposit(): void {
    const s = this.s;
    if (!this.cashBoxHome()) {
      s.say('The cash box is not here. The coin has nowhere to go. Like you.', 2.5);
      return;
    }
    this.cash++;
    this.c.picked++;
    s.sfx.ding();
    s.say('Clink. Into the cash box.', 1.5);
  }

  private cashBoxHome(): boolean {
    const cb = this.level.cashBox;
    if (cb.state === 'fixed') return true;
    if (cb.state !== 'world') return false;
    const p = cb.mesh.position;
    return Math.abs(p.x - islandX(MY_ISLAND)) < CABIN_W && Math.abs(p.z) < CABIN_D;
  }

  // ---------------------------------------------------------------- receipts

  private printReceipt(c: Car): void {
    const s = this.s;
    this.c.receiptsPrinted++;
    s.sfx.tone(900, 0.4, 'sawtooth', 0.03);
    s.sfx.tone(700, 0.3, 'sawtooth', 0.03, undefined, 0.4);
    const it = s.addItem(RECEIPT_DEF, new THREE.Vector3(WINDOW_X + 0.25, 1.35, 0.4), true);
    this.flyers.push({ item: it, vel: new THREE.Vector3(0.6, 0.3, 0.1), hover: 0.9, rest: 0 });
    if (this.c.receiptsPrinted === 1) {
      setTimeout(() => bubbles.say(c.head, 0.8, pick(TX.RECEIPT.blown), 3, c.name), 1300);
      s.bossSay('receipt');
    }
    s.chat('receipt');
  }

  private giveReceipt(c: Car): void {
    const s = this.s;
    s.removeHeld();
    c.served = true;
    this.c.receiptsDone++;
    bubbles.say(c.head, 0.8, pick(TX.RECEIPT.thanks), 3.5, c.name);
    s.hype += 6;
    s.sfx.ding();
  }

  /** Receipts flutter east on the wind, settle, and get blown away again. */
  private updateFlyers(dt: number): void {
    const s = this.s;
    for (const f of this.flyers) {
      const it = f.item;
      if (it.state !== 'fixed') {
        f.rest = -1;
        continue;
      }
      const p = it.mesh.position;
      if (f.hover > 0) {
        f.hover -= dt;
        p.addScaledVector(f.vel, dt * 0.3);
        p.y += Math.sin(s.t * 9) * dt * 0.2;
        if (f.hover <= 0) f.vel.set(rand(2.5, 4), rand(1.2, 2.2), rand(-1, 1.5));
        continue;
      }
      if (f.rest > 0) {
        f.rest -= dt;
        if (f.rest <= 0) f.vel.set(rand(2, 4), rand(1.5, 2.6), rand(-1.5, 1.5));
        continue;
      }
      f.vel.y -= 2.2 * dt;
      f.vel.x += Math.sin(s.t * 2.3 + p.z) * dt * 2;
      p.addScaledVector(f.vel, dt);
      it.mesh.rotation.set(Math.sin(s.t * 7) * 0.6, s.t * 3, Math.cos(s.t * 5) * 0.4);
      if (p.y <= 0.02) {
        p.y = 0.02;
        it.mesh.rotation.set(0, it.mesh.rotation.y, 0);
        f.rest = rand(2.5, 5);
      }
      if (p.x > 32) {
        s.removeItem(it);
        f.rest = -1;
        this.c.receiptsLost++;
      }
    }
    this.flyers = this.flyers.filter((f) => f.rest !== -1);
  }

  // ---------------------------------------------------------------- repairs

  private nearStump(): boolean {
    const p = this.s.player.pos;
    return Math.hypot(p.x - this.level.stump.x, p.z - this.level.stump.z) < 2.6;
  }

  private repair(held: Item): void {
    const s = this.s;
    const b = this.level.myBarrier();
    if (!b.broken) {
      s.say('The barrier already has an arm. One arm is the industry standard.', 2.5);
      return;
    }
    if (held.def.id === 'keyArm') {
      const it = s.detachHeld()!;
      it.state = 'gone';
      b.broken = false;
      b.length = 1;
      b.angle = b.target = 0;
      this.keyArmOn = true;
      this.level.setKeyArm(b, true);
      this.c.keyArm++;
      s.say('You install the spare arm. The toilet key now goes up and down with every car.', 3.5);
      s.sfx.unlock();
      s.hype += 10;
      s.chat('keyArm', {}, 2);
      if (s.seen) s.bossSay('keyArm', true);
      return;
    }
    s.removeHeld();
    b.broken = false;
    b.length = Math.max(0.32, b.length * 0.75);
    b.angle = b.target = 0;
    this.c.repairs++;
    s.sfx.tone(180, 0.5, 'sawtooth', 0.04);
    s.say(b.length < 0.45 ? 'You tape it back on. It is barely an arm now. Cars may not take it seriously.' : 'You duct tape the arm back on. It is a little shorter now.', 3);
    s.chat('repair');
  }

  /** E on the barrier with empty hands. */
  private barrierHands(): void {
    const s = this.s;
    const b = this.level.myBarrier();
    if (this.keyArmOn) {
      this.keyArmOn = false;
      this.level.setKeyArm(b, false);
      b.broken = true;
      const it = this.level.keyArm;
      s.pickUp(it);
      s.say('You unscrew the spare arm. You have a toilet key. Lane 3 has no arm. Priorities.', 3);
      return;
    }
    s.say(b.broken ? 'There is no arm. The old one is somewhere down the road. Duct tape is included.' : 'Barrier 3. The big red button in the booth works it. Or R and Space, when you sit at the window.', 3);
  }

  // ---------------------------------------------------------------- the player

  private nearWindow(): boolean {
    const p = this.s.player.pos;
    return this.seated || (Math.abs(p.x - islandX(MY_ISLAND)) < 3.5 && Math.abs(p.z) < 4);
  }

  private inBooth(): boolean {
    const p = this.s.player.pos;
    return Math.abs(p.x - islandX(MY_ISLAND)) < CABIN_W / 2 && Math.abs(p.z) < CABIN_D / 2;
  }

  /** The car standing at the window of booth 3, if any. */
  private windowCar(): Car | null {
    return this.cars.find((c) => c.lane === MY_LANE && c.atWindow && !c.passed) ?? null;
  }

  private updatePlayer(dt: number): void {
    const s = this.s;
    const P = s.player;
    if (this.stun > 0) {
      this.stun -= dt;
      P.pos.x += this.knock.x * dt;
      P.pos.z += this.knock.z * dt;
      this.knock.multiplyScalar(Math.max(0, 1 - dt * 5));
      if (this.stun < 0.6) P.pitch += (this.pitchBefore - P.pitch) * Math.min(1, dt * 6);
      if (this.stun <= 0) {
        s.movementLocked = this.seated;
        for (const c of this.cars) c.data.hitPlayer = 0;
      }
    }
    if (this.seated) {
      P.pos.set(SEAT.x, 0, SEAT.z);
      s.movementLocked = true;
    }
    // coins in the hands go into the box when you are in the booth
    if (s.held?.def.id === 'tollCoin' && this.inBooth() && this.cashBoxHome()) {
      s.removeHeld();
      this.deposit();
    }
    // the police siren
    if (this.sirenT > 0) {
      this.sirenT -= dt;
      if (Math.floor(this.sirenT * 4) !== Math.floor((this.sirenT + dt) * 4)) s.sfx.tone(this.sirenT * 4 % 2 < 1 ? 700 : 950, 0.22, 'sawtooth', 0.05);
    }
  }

  private inLane(): number {
    const p = this.s.player.pos;
    if (p.z < -24 || p.z > 20) return 0;
    for (let lane = 1; lane <= LANES; lane++) if (Math.abs(p.x - laneX(lane)) < LANE_W / 2) return lane;
    if (p.z < -8.6 || p.z > 7.6) if (p.x > islandX(0) && p.x < islandX(LANES)) return -1;
    return 0;
  }

  /** Brad and the audience notice the state of the lane. */
  private updateRules(dt: number): void {
    const s = this.s;
    const b = this.level.myBarrier();
    // queue length in lane 3
    const queue = this.cars.filter((c) => c.lane === MY_LANE && !c.passed && c.speed < 1 && c.z > -95).length;
    this.c.maxQueue = Math.max(this.c.maxQueue, queue);
    if (queue >= 8) s.achieve('jam');
    if (queue >= 4) {
      this.jamT += dt;
      s.hype += dt * 0.6;
      if (this.jamT > 7) {
        this.jamT = 0;
        s.chat('jam', {}, 2);
      }
      if (!s.boss.offline && s.boss.canSee(new THREE.Vector3(MY_LANE_X, 0, -6), this.level.colliders)) {
        s.annoyance += dt * (queue - 2) * 1.6;
        s.bossSay('jam');
      }
    } else this.jamT = 0;
    // walking on the lanes
    const lane = this.inLane();
    if (lane !== 0 && this.stun <= 0) {
      this.laneT += dt;
      if (this.laneT > 1.5 && s.seen) {
        s.annoyance += dt * 4;
        s.bossSay('jaywalk');
      }
    } else this.laneT = 0;
    // a lane without an arm
    if (b.broken) {
      this.brokenT += dt;
      if (this.brokenT > 12 && !s.boss.offline && s.boss.horizontalDist(this.level.stump) < 12) {
        this.brokenT = 0;
        s.annoyance += 8;
        s.bossSay('barrierMissing', true);
      }
    } else this.brokenT = 0;
  }

  // ---------------------------------------------------------------- the booth console

  private drawConsole(): void {
    const { g, canvas, texture } = this.level.console;
    const w = canvas.width;
    const h = canvas.height;
    g.fillStyle = '#06140c';
    g.fillRect(0, 0, w, h);
    g.font = '10px monospace';
    g.textBaseline = 'top';
    const next = this.cars.filter((c) => c.lane === MY_LANE && !c.passed && c.z > -45).sort((a, b) => b.z - a.z)[0];
    const b = this.level.myBarrier();
    g.fillStyle = '#7dff9a';
    g.fillText('BOOTH 3  LANE 3', 6, 4);
    g.fillText(`CASH  ${String(this.cash).padStart(4, ' ')} CR`, 6, 18);
    g.fillText(`DONE  ${this.c.correct}/${QUOTA}`, 6, 30);
    g.fillStyle = b.broken ? '#ffb020' : this.barrierOpen(b) ? '#7dff9a' : '#ff5a4a';
    g.fillText(`ARM   ${b.broken ? 'MISSING' : this.barrierOpen(b) ? 'OPEN' : 'CLOSED'}`, 6, 42);
    let msg = 'NO CAR';
    let col = '#6a8a74';
    if (next) {
      if (this.isSpecial(next)) {
        msg = next.role === 'police' ? 'POLICE' : next.role === 'ceo' ? 'CEO!!! CEO!!!' : 'WANTS HUMAN';
        col = '#d08cff';
      } else if (next.role === 'paid') {
        msg = 'PAID: OPEN!';
        col = '#3dff6a';
      } else {
        msg = next.paid ? 'PAID: OPEN!' : 'PAY HERE';
        col = next.paid ? '#ffd24f' : '#ff4a3a';
      }
    }
    g.fillStyle = col;
    g.fillRect(4, 58, w - 8, 18);
    g.fillStyle = '#06140c';
    g.font = 'bold 12px monospace';
    g.fillText(msg, 8, 61);
    g.fillStyle = '#7dff9a';
    g.font = '10px monospace';
    const q = this.cars.filter((c) => c.lane === MY_LANE && !c.passed && c.speed < 1).length;
    g.fillText(`QUEUE ${q}`, 6, 82);
    texture.needsUpdate = true;
    // lane signals over the lanes
    for (const sig of this.level.signals) {
      if (sig.lane !== MY_LANE) sig.set('go');
      else sig.set(b.broken ? 'off' : this.barrierOpen(b) ? 'go' : 'stop');
    }
  }
}

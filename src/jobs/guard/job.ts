import * as THREE from 'three';
import { bubbles } from '../../bubbles';
import type { Item, ItemDef } from '../../items';
import * as T from '../../texts';
import { clamp, fill, pick, rand } from '../../util';
import type { Job, Look, Shift } from '../types';
import { Bot, BotCtx, Courier, Scrubber, Sleepwalker } from './bots';
import { CAMS, Factory, OFFICE, SEAT, type IncidentDoor } from './building';
import { Cctv, GuardDouble } from './feeds';
import { FUN_BOSS, FUN_CHAT, GUARD_SECRETS, GuardFun } from './fun';
import { Incident, IncidentCtx, IncidentKind, Incidents } from './incidents';
import { TOASTER_DEF } from './items';
import * as GT from './texts';
import { GuardUi, LogLine } from './ui';

/**
 * Job 6: night security guard at ROBOTICA Plant 9.
 * Watch the monitors, report incidents on the right camera, do your rounds with the
 * flashlight, stay awake. Nothing will happen. Watch it happen.
 */
const QUOTA = 15;
const SHIFT_LEN = 300;
const FOV = 70;

interface Info {
  kind: string;
  index?: number;
  door?: 'dock' | 'fire';
  inc?: Incident;
  bot?: Bot;
  item?: Item;
}

export class GuardJob implements Job {
  info = {
    id: 'guard',
    title: 'NIGHT GUARD',
    place: 'ROBOTICA Plant 9 (night shift)',
    teaser: 'Nothing will happen. Watch it happen.',
    quotaLabel: 'SECURITY',
    lockedDoor: GT.LOCKED_DOOR,
    bladderWarning: GT.BLADDER_WARNING,
    startHour: 22,
  };
  level: Factory;
  bossLines = { ...GT.BOSS_LINES, ...FUN_BOSS };
  chatLines = { ...GT.CHAT_LINES, ...FUN_CHAT };
  achievements = GT.ACHIEVEMENTS;
  secrets = GUARD_SECRETS;

  private s!: Shift;
  private cctv: Cctv;
  private double: GuardDouble;
  private incidents: Incidents;
  private fun: GuardFun;
  private ui!: GuardUi;
  private bots: Bot[] = [];
  private botCtx!: BotCtx;
  private incCtx!: IncidentCtx;
  private flash = new THREE.SpotLight('#fff0c8', 0, 24, 0.38, 0.25, 0.6);
  private sleepwalker!: Sleepwalker;

  private alert = 78;
  private seated = false;
  private zoom = -1;
  private fov = FOV;
  private asleep = 0;
  private napReported = false;
  private flashlightOn = false;
  private flashUsed = false;
  private radio = 0;
  private sips = 0;
  private spinAcc = 0;
  private lastYaw = 0;
  private round = 1;
  private roundReset = 0;
  private keySearch: { t: number; n: number } | null = null;
  private keyFound = false;
  private log: LogLine[] = [];
  private lastLook: Look | null = null;
  private onCam: number[] = [];
  private camCheck = 0;
  private lastPuddles = 0;
  private lastStolen = 0;
  private hintCooldown = 20;
  private drowsyWarned = false;
  private lid = 0;
  private blinkT = 0;
  private nextBlink = 3;
  private jangle = 0;
  private radioT = 0;
  private humT = 0;
  private lastDrip = 0;
  private bladT: { at: number; key: string; vars: Record<string, string>; annoy: number }[] = [];
  private firstSit = true;
  private darkHint = false;
  private nearLine = 4;
  private mugItem: Item | null = null;
  private logbookItem: Item | null = null;
  private toasterItem: Item | null = null;
  private c = {
    reported: 0, inPerson: 0, missed: 0, falseReports: 0, reportedBrad: 0, reportedSelf: 0, checkpoints: 0, rounds: 0,
    naps: 0, sips: 0, vending: 0, spins: 0, keysTried: 0, guided: 0, peeOnCam: 0, stolenOnCam: 0, phone: 0, cleaned: 0,
    woken: 0, doorsOpened: 0, hits: 0,
  };

  constructor(scene: THREE.Scene) {
    this.level = new Factory(scene);
    this.cctv = new Cctv(scene, CAMS, this.level.screens, this.level.colliders);
    this.cctv.hideInFeeds.push(this.level.screenGroup, this.level.camGroup);
    this.double = new GuardDouble(scene);
    this.cctv.onlyInFeeds.push(this.double.group);
    this.incidents = new Incidents(scene, this.level);
    this.fun = new GuardFun(this.level, this.cctv);
    for (const it of this.level.initialItems) {
      if (it.def.id === 'guardMug') this.mugItem = it;
      if (it.def.id === 'guardLogbook') this.logbookItem = it;
    }
    // The feeds render every frame, also behind the title screen.
    this.level.onTick((t) => this.renderFeeds(t));
    // The flashlight exists from the start (switched off), so turning it on later
    // does not recompile every material.
    this.flash.intensity = 0;
    scene.add(this.flash, this.flash.target);
  }

  // ---------------------------------------------------------------- setup

  start(shift: Shift): void {
    this.s = shift;
    this.ui = new GuardUi();
    const cam = shift.camera;
    this.flash.position.set(0.25, -0.25, 0.1);
    this.flash.target.position.set(0, 0, -5);
    cam.add(this.flash);
    cam.add(this.flash.target);
    this.lastPuddles = shift.counter('puddles');
    this.lastStolen = shift.counter('stolen');
    const self = this;
    this.botCtx = {
      nav: shift.nav,
      colliders: this.level.colliders,
      get player() {
        return shift.player.pos;
      },
      flashlight: () => this.flashlightOn,
      puddles: () => shift.puddles,
      cleanPuddle: (i, bot) => {
        shift.removePuddle(i);
        bot.say(pick(GT.CLEANER_PUDDLE), 3.5);
        this.c.cleaned++;
        shift.hype += 4;
        shift.chat('cleaner');
        shift.sfx.whoosh();
      },
      delivered: () => {
        this.c.guided++;
        shift.hype += 8;
        shift.sfx.ding();
        this.alert = Math.min(100, this.alert + 5);
        shift.chat('courier', {}, 2);
        this.addLog('PARCEL-7 guided to the dock');
        this.quotaCheck();
      },
      woken: (_b, by) => {
        this.c.woken++;
        shift.hype += 6;
        shift.chat('sleepwalker');
        if (by === 'keys') shift.say('Your keyring jangled. UNIT 404 woke up. Robots do not sleep. It says.', 3);
      },
    };
    this.incCtx = {
      nav: shift.nav,
      colliders: this.level.colliders,
      get player() {
        return shift.player.pos;
      },
      get playerDir() {
        return shift.player.forward();
      },
      get watchedMonitor() {
        return self.zoom >= 0 ? self.zoom : self.watchedMonitor();
      },
      get inOffice() {
        return self.inOffice();
      },
      missed: (inc) => this.onMissed(inc),
      spawned: (inc) => {
        // The monitor flickers when something appears. The console beeps if you are there.
        this.cctv.glitch[inc.cam] = 0.7;
        if (this.inOffice()) shift.sfx.tone(1320, 0.06, 'square', 0.03);
      },
      toasterMoved: (inc, near) => {
        this.cctv.glitch[inc.cam] = 0.5;
        if (near) shift.sfx.tone(1800, 0.05, 'square', 0.04);
        shift.chat('toaster');
      },
    };
    this.bots.push(new Scrubber(shift.scene, [new THREE.Vector3(-9, 0, -1.2), new THREE.Vector3(14.4, 0, -1.2), new THREE.Vector3(14.4, 0, 10.8), new THREE.Vector3(-9, 0, 10.8)]));
    this.bots.push(new Courier(shift.scene, [new THREE.Vector3(-10.5, 0, 0.6), new THREE.Vector3(12, 0, -1.8), new THREE.Vector3(-9, 0, -12.5), new THREE.Vector3(18.5, 0, 0)]));
    this.sleepwalker = new Sleepwalker(shift.scene, new THREE.Vector3(5, 0, -12.5));
    this.bots.push(this.sleepwalker);
    this.fun.start(shift, {
      bots: () => this.bots,
      wake: () => this.sleepwalker.wake(this.botCtx, 'hit'),
      boost: (n) => this.boost(n),
      addLog: (text, bad) => this.addLog(text, bad),
      watching: () => (this.zoom >= 0 ? this.zoom : this.watchedMonitor()),
    });
    addEventListener('keydown', (e) => this.onKey(e));
  }

  // ---------------------------------------------------------------- small helpers

  private inOffice(): boolean {
    const p = this.s.player.pos;
    return p.x > OFFICE.minX && p.x < OFFICE.maxX && p.z > OFFICE.minZ && p.z < OFFICE.maxZ;
  }

  private inBooth(): boolean {
    const p = this.s.player.pos;
    const b = this.level.booth;
    return p.x > b.minX + 0.05 && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ - 0.05;
  }

  private watchedMonitor(): number {
    const info = this.lastLook?.info as Info | undefined;
    return info?.kind === 'guardMonitor' ? (info.index ?? -1) : -1;
  }

  private clock(): string {
    const t = this.s?.t ?? 0;
    const mins = 22 * 60 + (t / SHIFT_LEN) * 480;
    return `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(Math.floor(mins % 60)).padStart(2, '0')}`;
  }

  private camName(i: number): string {
    if (i === 12) return 'CAM 13 (no signal)';
    if (i === 13) return 'CAM 14 (screensaver)';
    return `CAM ${String(i + 1).padStart(2, '0')} ${CAMS[i].name}`;
  }

  private addLog(text: string, bad = false): void {
    this.log.push({ text: `${this.clock()} ${text}`, bad });
    if (this.log.length > 30) this.log.shift();
  }

  /** Brad line with variables, optionally later. */
  private brad(key: string, vars: Record<string, string> = {}, delay = 0, annoy = 0): void {
    this.bladT.push({ at: this.s.t + delay, key, vars, annoy });
  }

  private quotaCheck(): void {
    const q = this.quota();
    if (q.done === QUOTA) this.s.hud.toast('QUOTA REACHED', 'Brad has raised your quota to "more". Congratulations.', 'corp');
  }

  private boost(n: number): void {
    this.alert = clamp(this.alert + n, 0, 100);
    if (this.alert > 35) this.drowsyWarned = false;
  }

  // ---------------------------------------------------------------- Job interface

  quota() {
    const c = this.c;
    return { done: c.reported + c.inPerson + c.checkpoints + c.guided, target: QUOTA };
  }

  obstacles() {
    return this.bots.filter((b) => b.group.visible).map((b) => ({ x: b.pos.x, z: b.pos.z, r: b.radius }));
  }

  lookTargets(): THREE.Object3D[] {
    return [...this.bots.filter((b) => b.group.visible).map((b) => b.group), ...this.incidents.targets()];
  }

  hypeMultiplier(): number {
    return this.onCam.length ? 1.5 : 1;
  }

  cameraLabel(): string {
    if (!this.onCam.length || this.asleep > 0) return '';
    const names = this.onCam.slice(0, 3).map((i) => String(i + 1).padStart(2, '0')).join(', ');
    return `ON CCTV: CAM ${names} (hype x1.5)`;
  }

  heldLabel(it: Item): string {
    if (it.def.id === 'guardKeyring') return ' (jangling)';
    if (it.def.id === 'guardMug') return ` (${Math.max(0, 6 - this.sips)} sips left)`;
    return this.fun.heldLabel(it);
  }

  productive(): boolean {
    return this.quota().done >= 12;
  }

  employeeOfTheMonth(pocket: ItemDef[], fired: boolean): string {
    if (pocket.some((p) => p.id === 'guardToasterItem')) return 'The Suspicious Toaster (last seen in your pocket)';
    if (pocket.some((p) => p.id === 'guardLogbook') && !fired) return 'Nobody. The logbook is missing.';
    return 'CAM 07 (it never blinks)';
  }

  reviewRows(): [string, string | number][] {
    const c = this.c;
    const rows: [string, string | number][] = [
      ['Incidents reported at the desk', c.reported],
      ['Incidents handled in person', c.inPerson],
      ['Incidents missed', c.missed],
      ['False reports', c.falseReports + c.reportedBrad + c.reportedSelf],
      ['Checkpoints scanned', `${c.checkpoints} (${c.rounds} full rounds)`],
      ['Lost robots guided to the dock', c.guided],
      ['Naps on duty', c.naps],
      ['Sips of cold coffee', c.sips],
    ];
    if (c.reportedBrad) rows.push(['Reports about your manager', c.reportedBrad]);
    if (c.reportedSelf) rows.push(['Reports about yourself', c.reportedSelf]);
    if (c.spins) rows.push(['Chair rotations', c.spins]);
    if (c.keysTried) rows.push(['Keys tried at the toilet door', c.keysTried]);
    rows.push(['Items stolen by intruders', 0], ['Items stolen by security', this.s.counter('stolen')]);
    return rows;
  }

  payRows(): [string, number][] {
    const c = this.c;
    const rows: [string, number][] = [['Night shift supplement', 3], ['Night shift supplement (clawed back)', -3]];
    if (c.naps) rows.push([`Unpaid naps x${c.naps}`, -2.5 * c.naps]);
    if (c.vending) rows.push([`Coffee-Adjacent Beverages x${c.vending}`, -2 * c.vending]);
    if (c.missed) rows.push([`Missed incident fine x${c.missed}`, -1 * c.missed]);
    const f = c.falseReports + c.reportedBrad + c.reportedSelf;
    if (f) rows.push([`False report processing x${f}`, -0.5 * f]);
    if (c.keysTried) rows.push([`Key wear (${c.keysTried} keys tried)`, -Math.round(c.keysTried) / 100]);
    if (this.flashUsed) rows.push(['Flashlight battery rental', -0.75]);
    if (c.phone) rows.push([`Calls to management x${c.phone}`, -0.99 * c.phone]);
    return rows;
  }

  // ---------------------------------------------------------------- input

  private onKey(e: KeyboardEvent): void {
    if (!this.s || !document.pointerLockElement || e.repeat) return;
    if (this.asleep > 0) return;
    switch (e.code) {
      case 'KeyF':
        this.toggleFlashlight();
        break;
      case 'KeyR': {
        if (this.fun.drink()) break;
        if (this.seated) {
          const w = this.watchedMonitor();
          if (this.zoom >= 0) this.zoom = -1;
          else if (w >= 0) this.zoom = w;
          else if ((this.lastLook?.info as Info | undefined)?.item?.def.id === 'guardMug') this.sip();
          else if (this.s.held?.def.id === 'guardMug') this.sip();
        } else if (this.s.held?.def.id === 'guardMug') this.sip();
        break;
      }
      case 'KeyW':
      case 'KeyA':
      case 'KeyS':
      case 'KeyD':
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight': {
        if (!this.seated) break;
        if (this.zoom >= 0) {
          const z = this.zoom;
          const k = e.code;
          if (k === 'KeyA' || k === 'ArrowLeft') this.zoom = (z + 13) % 14;
          else if (k === 'KeyD' || k === 'ArrowRight') this.zoom = (z + 1) % 14;
          else if (k === 'KeyW' || k === 'ArrowUp') this.zoom = z >= 12 ? 8 + (z - 12) * 3 : z >= 4 ? z - 4 : z;
          else this.zoom = z < 8 ? z + 4 : z < 12 ? (z % 4 < 2 ? 12 : 13) : z;
          this.s.sfx.click();
        } else this.standUp();
        break;
      }
    }
  }

  private toggleFlashlight(): void {
    this.flashlightOn = !this.flashlightOn;
    if (this.flashlightOn) this.flashUsed = true;
    this.flash.intensity = this.flashlightOn ? 8 : 0;
    this.s.sfx.click();
  }

  // ---------------------------------------------------------------- seat

  private sit(): void {
    const s = this.s;
    this.seated = true;
    s.movementLocked = true;
    s.player.pos.copy(SEAT);
    s.player.vel.set(0, 0, 0);
    s.player.yaw = 0;
    s.player.pitch = -0.02;
    this.lastYaw = 0;
    this.spinAcc = 0;
    s.sfx.tone(160, 0.25, 'sawtooth', 0.04, 120);
    if (this.firstSit) {
      this.firstSit = false;
      s.say('You sit down. The chair creaks like a warning. Look at a monitor. E reports it. R zooms in.', 5);
      s.bossSay('sitting');
    }
  }

  private standUp(): void {
    const s = this.s;
    this.seated = false;
    this.zoom = -1;
    s.movementLocked = false;
    s.player.pos.set(SEAT.x, 0, SEAT.z + 0.45);
  }

  private updateSeat(dt: number): void {
    const s = this.s;
    const P = s.player;
    const cam = s.camera;
    let targetFov = FOV;
    if (this.seated) {
      P.pos.copy(SEAT);
      P.vel.set(0, 0, 0);
      cam.position.set(SEAT.x, this.asleep > 0 ? 1.12 : 1.28, SEAT.z);
      // Spinning on the chair
      let d = P.yaw - this.lastYaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.lastYaw = P.yaw;
      if (this.zoom < 0 && this.asleep <= 0) {
        this.spinAcc += Math.abs(d);
        if (this.spinAcc >= Math.PI * 2) {
          this.spinAcc -= Math.PI * 2;
          this.c.spins++;
          this.boost(5);
          s.hype += 4;
          s.sfx.tone(500 + this.c.spins * 40, 0.15, 'triangle', 0.05);
          if (this.c.spins % 2 === 1) s.chat('spin');
          if (s.seen) {
            s.annoyance += 8;
            s.bossSay('spinSeen');
          }
          if (this.c.spins === 5) s.achieve('guardSpin');
        }
      }
      if (this.zoom >= 0) {
        const scr = this.level.screens[this.zoom];
        const wp = scr.getWorldPosition(new THREE.Vector3());
        const dx = wp.x - cam.position.x;
        const dy = wp.y - cam.position.y;
        const dz = wp.z - cam.position.z;
        const yaw = Math.atan2(-dx, -dz);
        const pitch = Math.atan2(dy, Math.hypot(dx, dz));
        let dyaw = yaw - P.yaw;
        dyaw = Math.atan2(Math.sin(dyaw), Math.cos(dyaw));
        P.yaw += dyaw * Math.min(1, dt * 10);
        P.pitch += (pitch - P.pitch) * Math.min(1, dt * 10);
        this.lastYaw = P.yaw;
        const dist = Math.hypot(dx, dy, dz);
        const h = this.zoom >= 12 ? 0.26 : 0.38;
        targetFov = THREE.MathUtils.radToDeg(2 * Math.atan((h * 0.8) / dist));
      }
      cam.rotation.set(P.pitch, P.yaw, 0);
    }
    this.level.chair.rotation.y = this.seated ? P.yaw : this.level.chair.rotation.y;
    this.fov += (targetFov - this.fov) * Math.min(1, dt * 8);
    if (Math.abs(cam.fov - this.fov) > 0.01) {
      cam.fov = this.fov;
      cam.updateProjectionMatrix();
    }
  }

  // ---------------------------------------------------------------- staying awake

  private updateAlertness(dt: number): void {
    const s = this.s;
    const P = s.player;
    if (this.asleep > 0) {
      this.updateSleep(dt);
      return;
    }
    let rate: number;
    if (this.seated) rate = -1.05 * GT.RADIO_STATIONS[this.radio].drain;
    else if (P.speed > 4) rate = 0.9;
    else if (P.speed > 0.5) rate = 0.32;
    else rate = -0.5;
    if (rate < 0 && s.t > 150) rate *= 1.25;
    if (s.held?.def.id === 'guardKeyring' && P.speed > 0.5) rate += 0.25;
    this.alert = clamp(this.alert + rate * dt, 0, 100);

    if (this.alert < 25 && !this.drowsyWarned) {
      this.drowsyWarned = true;
      s.say(this.seated ? 'Your eyelids weigh a ton. Coffee. Spin the chair. Walk a round. Anything.' : 'You are getting sleepy. Keep moving.', 4);
      s.chat('drowsy', {}, 2);
    }
    if (this.alert < 20 && s.seen) s.bossSay('drowsy');
    // Blinking gets slower and longer
    this.blinkT -= dt;
    if (this.alert < 32) {
      this.nextBlink -= dt;
      if (this.nextBlink <= 0) {
        this.nextBlink = rand(1.5, 4) * (0.4 + this.alert / 32);
        this.blinkT = 0.18 + (1 - this.alert / 32) * 0.7;
      }
    }
    const base = this.alert < 15 ? ((15 - this.alert) / 15) * 0.35 : 0;
    this.lid = this.blinkT > 0 ? 1 : base;
    if (this.alert <= 0) this.fallAsleep();
  }

  private fallAsleep(): void {
    const s = this.s;
    this.asleep = 7;
    this.napReported = false;
    this.zoom = -1;
    s.movementLocked = true;
    this.c.naps++;
    s.count('naps');
    s.hype += 25;
    s.chat('asleep', {}, 3);
    s.achieve('guardNap');
    s.sfx.tone(220, 1.6, 'sine', 0.05, 110);
    this.addLog('zzzzzzzzzz', true);
  }

  private updateSleep(dt: number): void {
    const s = this.s;
    this.asleep -= dt;
    this.lid = 1;
    s.player.pitch += (-0.7 - s.player.pitch) * Math.min(1, dt * 2);
    if (!this.napReported && this.asleep < 4.5) {
      this.napReported = true;
      if (!s.boss.offline) {
        s.boss.confront();
        s.bossSay('asleep', true);
        s.writeUp('Asleep on duty. Brad watched it on camera 1. Twice.');
      } else {
        s.say('Brad is rebooting. Nobody saw you sleep. Except every camera and the chat.', 4);
      }
    }
    if (this.asleep <= 0) {
      this.asleep = 0;
      this.alert = 55;
      this.lid = 0;
      this.drowsyWarned = false;
      s.movementLocked = this.seated;
      s.player.pitch = -0.05;
      s.say(this.seated ? 'You wake up. Your face has a keyboard pattern on it. CTRL ALT DELETE.' : 'You wake up standing. Impressive. Also concerning.', 3.5);
    }
  }

  private sip(): void {
    const s = this.s;
    const mug = this.mugItem;
    if (!mug || mug.state === 'gone') return;
    if (this.sips >= 6) {
      s.say('The mug is empty. There is a vending machine in the break area. It takes your wage.', 3.5);
      return;
    }
    this.sips++;
    this.c.sips++;
    this.boost(20);
    s.say(GT.SIP_LINES[Math.min(this.sips - 1, GT.SIP_LINES.length - 1)], 3);
    s.sfx.tone(300, 0.12, 'sine', 0.06, 200);
    if (Math.random() < 0.4) s.chat('coffee');
    if (this.sips >= 6) {
      const coffee = mug.mesh.getObjectByName('coffee');
      if (coffee) coffee.visible = false;
    }
  }

  // ---------------------------------------------------------------- reports

  private report(i: number): void {
    const s = this.s;
    const name = this.camName(i);
    if (this.fun.report(i)) return;
    s.sfx.beep();
    if (i >= 12) {
      this.falseReport(i, i === 12 ? 'You report static on camera 13. Static is not a threat. Static is a lifestyle.' : 'You report the screensaver. The logo almost hit the corner. Nobody believes you.');
      return;
    }
    const here = this.incidents.on(i).sort((a, b) => Number(a.byPlayer) - Number(b.byPlayer));
    const inc = here[0];
    if (inc) {
      this.incidents.resolve(inc);
      if (inc.byPlayer) {
        this.c.falseReports++;
        s.annoyance += 10;
        s.say('You report the door you opened yourself. The system logs it as "teamwork".', 3.5);
        this.addLog(`CAM ${i + 1}: own door. Reported.`, true);
        return;
      }
      this.c.reported++;
      this.boost(4);
      s.annoyance = Math.max(0, s.annoyance - 8);
      s.hype += 3;
      s.sfx.ding();
      this.addLog(`CAM ${String(i + 1).padStart(2, '0')}: ${Incidents.label(inc)}. Reported.`);
      s.say(`You report the ${Incidents.label(inc)} on ${name}. A response robot was dispatched. It arrives in 3 to 5 business days. The incident got bored and left.`, 4);
      if (inc.kind === 'toaster') {
        s.bossSay('toasterReport', true);
        this.leaveToaster(inc);
      } else if (inc.kind === 'cutout') s.bossSay('cutoutReport', true);
      else if (s.seen && Math.random() < 0.4) s.bossSay('correctSeen');
      if (Math.random() < 0.45) s.chat('report');
      this.quotaCheck();
      return;
    }
    // Nothing on that camera. What did they see?
    const boss = s.boss;
    if (!boss.offline && this.cctv.sees(i, boss.pos)) {
      this.c.reportedBrad++;
      s.annoyance += 25;
      s.hype += 18;
      s.bossSay('reportBrad', true);
      s.achieve('guardBrad');
      s.chat('reportBrad', {}, 3);
      this.cctv.glitch[i] = 1;
      this.addLog(`CAM ${i + 1}: flying object with tie. Reported.`, true);
      return;
    }
    const me = s.player.pos.clone().setY(1);
    if (this.cctv.sees(i, me)) {
      this.c.reportedSelf++;
      s.hype += 12;
      s.annoyance += 5;
      s.bossSay('reportSelf', true);
      s.chat('reportSelf', {}, 2);
      this.addLog(`CAM ${i + 1}: suspicious human. It was me.`, true);
      return;
    }
    const bot = this.bots.find((b) => b.group.visible && this.cctv.sees(i, b.pos.clone().setY(0.8)));
    if (bot) {
      this.c.falseReports++;
      s.annoyance += 12;
      s.hype += 6;
      s.bossSay('reportStaff', true);
      bot.say('Did someone just report me? I have a badge. Somewhere.', 3);
      this.addLog(`CAM ${i + 1}: ${bot.name}. Staff. Oops.`, true);
      return;
    }
    this.falseReport(i, `You report ${name}. There is nothing there. There was never anything there.`);
  }

  private falseReport(i: number, line: string): void {
    const s = this.s;
    this.c.falseReports++;
    s.annoyance += i >= 12 ? 8 : 15;
    s.hype += 5;
    s.sfx.buzz();
    s.say(line, 3.5);
    s.bossSay('falseReport', true);
    s.chat('falseReport');
    if (i < 12) this.cctv.glitch[i] = 1;
    this.addLog(`CAM ${i + 1}: nothing. Reported anyway.`, true);
  }

  /** A reported or confronted toaster stays behind as a perfectly normal toaster. */
  private leaveToaster(inc: Incident): void {
    if (!inc.obj) return;
    if (this.toasterItem && this.toasterItem.state !== 'held' && this.toasterItem.state !== 'gone') this.s.removeItem(this.toasterItem);
    const p = inc.obj.position.clone().setY(0.3);
    this.toasterItem = this.s.addItem(TOASTER_DEF, p);
    this.toasterItem.mesh.rotation.y = inc.obj.rotation.y;
  }

  private handleInPerson(inc: Incident, how: 'touch' | 'throw', thing = ''): void {
    const s = this.s;
    if (inc.done) return;
    const lines: Record<IncidentKind, string> = {
      toaster: 'You stare at the toaster. The toaster stares back. It is just a toaster now. Probably.',
      cat: 'You point your light at the robot cat. It leaves, offended, at the speed of a cat.',
      ghost: 'You pull the sheet off. It is a vacuum robot. It was bored. It rolls away, embarrassed.',
      balloon: 'You pop the balloon. Happy retirement, Unit 7. The chat claps.',
      cutout: 'You fold cardboard Brad in half. He still looks disappointed in you.',
      arm: 'You tell the robot arm to stop dancing. It stops. It was the most attention it ever got.',
      door: 'You close the door. The night stays outside. Mostly.',
    };
    this.incidents.resolve(inc);
    if (inc.kind === 'toaster') this.leaveToaster(inc);
    if (inc.kind === 'balloon') s.sfx.thud();
    if (inc.byPlayer) {
      s.say('You close the door you opened. Full circle. Nobody gets a point for that.', 3);
      return;
    }
    this.c.inPerson++;
    this.boost(3);
    s.hype += how === 'throw' ? 12 : 3;
    s.sfx.ding();
    s.say(how === 'throw' ? `You hit the ${Incidents.label(inc)} with the ${thing}. Problem solved. Physically.` : lines[inc.kind], 3.5);
    this.addLog(`CAM ${String(inc.cam + 1).padStart(2, '0')}: ${Incidents.label(inc)}. Handled in person.`);
    if (s.seen) s.bossSay('correctSeen');
    this.quotaCheck();
  }

  private onMissed(inc: Incident): void {
    const s = this.s;
    if (inc.byPlayer) {
      s.annoyance += 10;
      this.addLog(`CAM ${inc.cam + 1}: the door closed itself.`, true);
      return;
    }
    this.c.missed++;
    s.annoyance += 10;
    s.bossSay('missed');
    s.chat('missed');
    this.addLog(`CAM ${String(inc.cam + 1).padStart(2, '0')}: ${Incidents.label(inc)}. Missed.`, true);
  }

  // ---------------------------------------------------------------- rounds

  private scan(i: number): void {
    const s = this.s;
    const cp = this.level.checkpoints[i];
    if (cp.done) {
      s.say(`Checkpoint ${i + 1} is already scanned this round. It remembers you.`, 2.5);
      return;
    }
    if (!this.flashlightOn) {
      s.sfx.buzz();
      s.say('Too dark. You cannot find the scanner slot. F: flashlight.', 3);
      return;
    }
    cp.done = true;
    cp.led.color.set('#30ff60');
    cp.led.emissive.set('#30ff60');
    this.c.checkpoints++;
    this.boost(6);
    s.sfx.ding();
    const n = this.level.checkpoints.filter((c) => c.done).length;
    s.say(`Checkpoint ${i + 1} (${cp.name}) scanned. ${n} of 6 this round.`, 2.5);
    if (Math.random() < 0.3) s.chat('round');
    if (n === 6) {
      this.c.rounds++;
      this.roundReset = 2.5;
      s.hype += 5;
      s.hud.toast('PATROL ROUND COMPLETE', 'All six checkpoints. The dark has been thoroughly looked at.', 'corp');
      s.bossSay('roundDone', true);
      s.chat('round', {}, 2);
    }
    this.quotaCheck();
  }

  // ---------------------------------------------------------------- per frame

  update(dt: number): void {
    const s = this.s;
    const P = s.player;
    this.updateSeat(dt);
    this.updateAlertness(dt);

    // Robots
    for (const b of this.bots) {
      b.update(dt, this.botCtx);
      b.sync(dt);
    }
    this.incidents.update(dt, s.t, this.incCtx, s.t > 6);

    // Who sees the player? Which monitors show motion?
    this.camCheck -= dt;
    if (this.camCheck <= 0) {
      this.camCheck = 0.25;
      this.onCam = this.inBooth() ? [] : this.cctv.whoSees(P.pos.clone().setY(1.0));
      const movers: THREE.Vector3[] = [...this.incidents.movers()];
      for (const b of this.bots) if (b.group.visible && b.moving) movers.push(b.pos.clone().setY(0.8));
      if (!s.boss.offline) movers.push(s.boss.pos.clone());
      if (P.speed > 0.5) movers.push(P.pos.clone().setY(1));
      this.cctv.feeds.forEach((f, i) => (f.motion = movers.some((m) => this.cctv.sees(i, m))));
    }
    this.cctv.labels(s.t, this.clock());
    this.level.wallClock.draw(this.clock());

    this.watchCameras();
    this.updateKeys(dt);
    this.updateSounds(dt);
    this.updateBrad(dt);

    if (this.roundReset > 0) {
      this.roundReset -= dt;
      if (this.roundReset <= 0) {
        this.round++;
        for (const cp of this.level.checkpoints) {
          cp.done = false;
          cp.led.color.set('#ff3030');
          cp.led.emissive.set('#ff3030');
        }
      }
    }
    if (!this.darkHint && !this.inOffice() && !this.flashlightOn && s.t > 3) {
      this.darkHint = true;
      s.say('It is dark out here. F: flashlight.', 3);
    }
    // Incident creatures talk when you are near
    this.nearLine -= dt;
    if (this.nearLine <= 0) {
      this.nearLine = rand(5, 9);
      for (const inc of this.incidents.active()) {
        if (!inc.obj || inc.kind === 'arm') continue;
        if (inc.obj.position.distanceTo(P.pos) < 8) {
          const line = Incidents.line(inc);
          if (line) {
            bubbles.say(inc.obj, 1.4, line, 3);
            break;
          }
        }
      }
    }
    this.fun.update(dt);
    this.ui.update({
      alert: this.alert,
      round: this.round,
      scanned: this.level.checkpoints.filter((c) => c.done).length,
      flashlight: this.flashlightOn,
      radio: GT.RADIO_STATIONS[this.radio].name,
      seated: this.seated,
      zoomed: this.zoom >= 0 ? `${this.camName(this.zoom)}   E: REPORT   A/D/W/S: SWITCH   R: BACK` : null,
      log: this.log,
      logbookMissing: !!this.logbookItem && this.logbookItem.state === 'gone',
      keys: this.keysHelp(),
      lid: this.lid,
      darkness: this.asleep > 0 ? 1 : this.alert < 25 ? ((25 - this.alert) / 25) * 0.75 : 0,
      asleep: this.asleep > 0,
    });
  }

  private keysHelp(): string[] {
    const k: string[] = ['<kbd>F</kbd> flashlight'];
    if (this.seated) k.push('<kbd>E</kbd> report', '<kbd>R</kbd> zoom', '<kbd>WASD</kbd> stand up');
    else k.push('<kbd>E</kbd> use / scan');
    if (this.s.held?.def.id === 'guardMug') k.push('<kbd>R</kbd> sip');
    if (this.s.held?.def.id === 'guardCan') k.push('<kbd>R</kbd> drink');
    return k;
  }

  /** Peeing and stealing where a camera can see it. */
  private watchCameras(): void {
    const s = this.s;
    const pud = s.counter('puddles');
    if (pud > this.lastPuddles) {
      this.lastPuddles = pud;
      const cams = this.cctv.whoSees(s.player.pos.clone().setY(1));
      if (cams.length && !this.inBooth()) {
        this.c.peeOnCam++;
        s.achieve('guardTape');
        s.hype += 10;
        s.chat('peeCam', {}, 2);
        if (!s.boss.offline) this.brad('peeCamera', { cam: String(cams[0] + 1) }, 3.5, 25);
      }
    }
    const stolen = s.counter('stolen');
    if (stolen > this.lastStolen) {
      this.lastStolen = stolen;
      if (this.toasterItem?.state === 'gone') this.incidents.retireToaster();
      const cams = this.cctv.whoSees(s.player.pos.clone().setY(1));
      if (cams.length) {
        this.c.stolenOnCam++;
        s.chat('stealCam');
        if (!s.boss.offline) this.brad('stealCamera', { cam: String(cams[0] + 1) }, 5, 0);
      }
    }
  }

  private updateKeys(dt: number): void {
    const s = this.s;
    const held = s.held;
    // The keyring jangles
    if (held?.def.id === 'guardKeyring' && s.player.speed > 0.5) {
      this.jangle -= dt;
      if (this.jangle <= 0) {
        this.jangle = 0.2 + Math.random() * 0.1;
        s.sfx.tone(rand(2400, 4200), 0.05, 'square', 0.016);
        s.sfx.tone(rand(1800, 3600), 0.04, 'triangle', 0.014, undefined, 0.05);
        if (this.sleepwalker.state === 'sleep' && this.sleepwalker.pos.distanceTo(s.player.pos) < 5) this.sleepwalker.wake(this.botCtx, 'keys');
      }
    }
    // Searching for the right key at the toilet door
    const ks = this.keySearch;
    if (ks) {
      if (held?.def.id !== 'guardKeyring' || s.player.pos.distanceTo(this.level.doorFront) > 3) {
        this.keySearch = null;
        s.hud.progress(null);
      } else {
        ks.t += dt;
        const dur = 2.8;
        const k = Math.max(1, Math.floor((ks.t / dur) * ks.n));
        s.hud.progress(`Trying key ${k} of 300...`, ks.t / dur);
        if (Math.floor(ks.t * 9) !== Math.floor((ks.t - dt) * 9)) s.sfx.tone(rand(2600, 3800), 0.03, 'square', 0.02);
        if (ks.t >= dur) {
          this.keySearch = null;
          this.keyFound = true;
          s.hud.progress(null);
          this.c.keysTried += ks.n;
          s.count('keysTried', ks.n);
          s.sfx.unlock();
          s.say(`Key ${ks.n}. Of course it is key ${ks.n}. E: unlock.`, 3);
        }
      }
    }
    if (this.keyFound && this.level.doorAngle > 1) this.keyFound = false;
  }

  private updateSounds(dt: number): void {
    const s = this.s;
    const P = s.player.pos;
    // Vending machine hum
    this.humT -= dt;
    if (this.humT <= 0) {
      this.humT = 1.7;
      const d = P.distanceTo(this.level.vendingPos);
      if (d < 6) s.sfx.tone(118, 1.6, 'sine', 0.02 * (1 - d / 6));
    }
    // The drip, in time with the drop
    const now = performance.now() / 1000;
    const ph = (now % 1.6) / 1.6;
    if (this.lastDrip < 0.97 && ph >= 0.97) {
      const d = P.distanceTo(this.level.dripPos);
      if (d < 10) s.sfx.tone(1700, 0.05, 'sine', 0.04 * (1 - d / 10), 900);
    }
    this.lastDrip = ph;
    // Radio
    if (this.radio) {
      this.radioT -= dt;
      const d = P.distanceTo(this.level.radioMesh.position);
      if (this.radioT <= 0 && d < 7) {
        const v = 1 - d / 7;
        if (this.radio === 1) {
          this.radioT = 2.6;
          s.sfx.tone(rand(160, 260), 1.8, 'sine', 0.035 * v, rand(90, 140));
        } else if (this.radio === 2) {
          this.radioT = 0.5;
          s.sfx.tone(rand(140, 220), 0.18, 'sawtooth', 0.03 * v, rand(100, 300));
        } else {
          this.radioT = 0.6;
          s.sfx.noise(0.5, 0.025 * v, 2400, 0, 0.5, 'bandpass');
        }
      }
    }
  }

  private updateBrad(dt: number): void {
    const s = this.s;
    this.hintCooldown -= dt;
    if (this.hintCooldown <= 0 && !s.boss.offline && this.asleep <= 0) {
      const inc = this.incidents.active().find((i) => !i.byPlayer && !i.hinted && i.age > 30);
      if (inc) {
        inc.hinted = true;
        this.hintCooldown = 28;
        this.brad('incidentHint', { cam: String(inc.cam + 1) }, 0, 5);
      }
    }
    this.bladT = this.bladT.filter((b) => {
      if (b.at > s.t) return true;
      const lines = GT.BOSS_LINES[b.key];
      if (!lines?.length) return false;
      const line = fill(pick(lines), b.vars);
      s.hud.say(T.BOSS_NAME, line, 2 + line.length * 0.035);
      s.sfx.beep();
      s.sfx.say(line, 'boss');
      s.annoyance += b.annoy;
      return false;
    });
  }

  /** Renders a few camera feeds per frame (more while seated, none far away). */
  private renderFeeds(t: number): void {
    const s = this.s;
    let budget = 2;
    if (s) {
      const P = s.player;
      const d = Math.hypot(P.pos.x - -19.5, P.pos.z - -16);
      budget = this.seated ? 3 : d < 12 ? 2 : 0;
      const pose = this.asleep > 0 ? 'sleep' : this.seated ? 'sit' : P.speed > 0.5 ? 'walk' : 'stand';
      this.double.update(P.pos.x, P.pos.z, P.yaw, pose, t, this.flashlightOn);
    }
    this.cctv.render(t, budget);
  }

  // ---------------------------------------------------------------- the player's actions

  thrownHit(it: Item): boolean {
    const s = this.s;
    const p = it.mesh.position;
    for (const b of this.bots) {
      if (!b.group.visible || b.down > 0) continue;
      if (Math.hypot(p.x - b.pos.x, p.z - b.pos.z) < b.radius + 0.2 && p.y < b.height + 0.3) {
        it.vel.multiplyScalar(-0.3);
        it.thrown = false;
        b.knock();
        this.c.hits++;
        s.hype += 10;
        s.sfx.thud();
        s.chat('hitBot');
        if (b === this.sleepwalker) this.sleepwalker.wake(this.botCtx, 'hit');
        else b.say(b.name === 'ZAMBO-9' ? 'Bonk. I will clean that up. Including you.' : 'Ow. My parcel. My dignity.', 3);
        return true;
      }
    }
    for (const inc of this.incidents.active()) {
      if (!inc.obj || inc.kind === 'door') continue;
      const o = inc.obj.getWorldPosition(new THREE.Vector3());
      if (Math.hypot(p.x - o.x, p.z - o.z) < 0.7) {
        it.vel.multiplyScalar(-0.3);
        it.thrown = false;
        s.sfx.thud();
        this.handleInPerson(inc, 'throw', it.def.name);
        return true;
      }
    }
    return false;
  }

  onKick(look: Look | null): boolean {
    const s = this.s;
    if (this.asleep > 0) return true;
    if (this.seated) {
      // Kicking under the desk
      s.sfx.thud();
      for (let i = 0; i < 12; i++) this.cctv.glitch[i] = Math.max(this.cctv.glitch[i], 0.5);
      s.say(pick(['You kick the desk. All monitors flicker. CAM 13 almost comes back. Almost.', 'You kick the desk. The monitors jump. So does the chat.', 'The desk takes it. The desk has taken worse.']), 3);
      s.hype += 2;
      return true;
    }
    if (this.fun.onKick(look)) return true;
    const info = look?.info as Info | undefined;
    if (info?.kind === 'guardIncident' && info.inc && look!.point.distanceTo(s.camera.getWorldPosition(new THREE.Vector3())) < 2.4) {
      s.sfx.thud();
      this.handleInPerson(info.inc, 'throw', 'boot');
      return true;
    }
    return false;
  }

  interact(look: Look | null): boolean {
    const s = this.s;
    if (this.asleep > 0) return true;
    if (this.keySearch) return true;
    const info = look?.info as Info | undefined;
    if (this.seated && this.zoom >= 0) {
      this.report(this.zoom);
      return true;
    }
    if (this.fun.interact(look)) return true;
    if (!info) return false;
    const held = s.held;
    switch (info.kind) {
      case 'guardMonitor':
        this.report(info.index ?? 0);
        return true;
      case 'guardChair':
        if (!this.seated) this.sit();
        return true;
      case 'guardCheckpoint':
        this.scan(info.index ?? 0);
        return true;
      case 'guardVending':
        this.c.vending++;
        this.boost(32);
        s.sfx.click();
        s.sfx.thud();
        s.say(pick(GT.VENDING_LINES), 3.5);
        if (Math.random() < 0.5) s.chat('coffee');
        return true;
      case 'guardRadio': {
        this.radio = (this.radio + 1) % GT.RADIO_STATIONS.length;
        const st = GT.RADIO_STATIONS[this.radio];
        s.say(this.radio ? `${st.name}. ${st.line}` : st.line, 3.5);
        s.sfx.click();
        if (this.radio) s.chat('radio');
        if (this.radio === 1) s.bossSay('radioWhale');
        return true;
      }
      case 'guardPhone':
        this.c.phone++;
        s.annoyance += 6;
        s.sfx.tone(440, 0.4, 'sine', 0.05);
        s.sfx.tone(440, 0.4, 'sine', 0.05, undefined, 0.6);
        s.bossSay('phone', true);
        s.chat('phone');
        return true;
      case 'guardDoor':
        this.useIncidentDoor(info.door!);
        return true;
      case 'guardIncident':
        if (info.inc) this.handleInPerson(info.inc, 'touch');
        return true;
      case 'guardBot':
        if (info.bot) info.bot.talk(this.botCtx);
        return true;
      case 'door':
        // The toilet door: first find the right key.
        if (held?.def.id === 'guardKeyring' && !this.inBooth() && !this.keyFound) {
          this.keySearch = { t: 0, n: Math.floor(rand(120, 300)) };
          s.chat('keys');
          return true;
        }
        return false;
      case 'item':
        if (this.seated && info.item?.def.id === 'guardMug' && !held) {
          this.sip();
          return true;
        }
        return false;
    }
    return false;
  }

  private useIncidentDoor(name: 'dock' | 'fire'): void {
    const s = this.s;
    const door = this.level.doors.find((d) => d.name === name) as IncidentDoor;
    const inc = this.incidents.active().find((i) => i.door === door);
    if (inc) {
      this.handleInPerson(inc, 'touch');
      return;
    }
    if (door.target === 0) {
      const camIndex = CAMS.findIndex((c) => c.door === name);
      this.incidents.spawn(this.incCtx, 'door', camIndex, true);
      this.c.doorsOpened++;
      s.hype += 6;
      s.sfx.whoosh();
      s.say(`You open the door. Fresh night air. Camera ${camIndex + 1} saw that. You are now an incident.`, 3.5);
    }
  }

  hint(look: Look | null): string | null {
    this.lastLook = look;
    if (this.asleep > 0) return '';
    if (this.keySearch) return '';
    const info = look?.info as Info | undefined;
    const held = this.s.held;
    if (this.seated) {
      if (this.zoom >= 0) return '';
      if (info?.kind === 'guardMonitor') return `E: report ${this.camName(info.index ?? 0)}  ·  R: zoom in`;
      if (info?.kind === 'item' && info.item?.def.id === 'guardMug' && !held) return `E: sip cold coffee (${Math.max(0, 6 - this.sips)} left)`;
      if (!info) return 'W A S D: stand up';
    }
    const funHint = this.fun.hint(look);
    if (funHint !== null) return funHint;
    if (!info) return held?.def.id === 'guardMug' ? 'R: sip  ·  E: drop  ·  G: throw  ·  Q: pocket it' : null;
    switch (info.kind) {
      case 'guardMonitor':
        return `E: report ${this.camName(info.index ?? 0)}  ·  sit down to zoom`;
      case 'guardChair':
        return 'E: sit down at the console';
      case 'guardCheckpoint': {
        const cp = this.level.checkpoints[info.index ?? 0];
        if (cp.done) return `Checkpoint ${cp.index + 1}: scanned this round`;
        return this.flashlightOn ? `E: scan checkpoint ${cp.index + 1}` : `E: scan checkpoint ${cp.index + 1} (too dark, F: flashlight)`;
      }
      case 'guardVending':
        return 'E: buy a Coffee-Adjacent Beverage (€2.00)';
      case 'guardRadio':
        return `E: change station (${GT.RADIO_STATIONS[(this.radio + 1) % GT.RADIO_STATIONS.length].name})`;
      case 'guardPhone':
        return 'E: call Brad';
      case 'guardDoor': {
        const door = this.level.doors.find((d) => d.name === info.door);
        return door && door.target > 0 ? 'E: close the door' : 'E: open the door (why?)';
      }
      case 'guardIncident': {
        const k = info.inc?.kind;
        return k === 'toaster' ? 'E: confront the toaster' : k === 'cat' ? 'E: shoo the robot cat' : k === 'ghost' ? 'E: unmask the ghost' : k === 'balloon' ? 'E: pop the balloon' : k === 'cutout' ? 'E: fold cardboard Brad' : 'E: tell the arm to stop dancing';
      }
      case 'guardBot':
        return info.bot ? info.bot.hint(this.botCtx) : null;
      case 'door':
        if (held?.def.id === 'guardKeyring' && !this.inBooth() && !this.keyFound) return 'E: find the right key (300 to try)';
        return null;
    }
    return null;
  }
}

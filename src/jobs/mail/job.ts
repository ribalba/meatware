import * as THREE from 'three';
import type { Item, ItemDef } from '../../items';
import { fill, pick, rand } from '../../util';
import type { Job, Look, Shift } from '../types';
import { Cage, Cubby, CUBBY_COLS, CUBBY_ROWS, Entry, MailOffice } from './building';
import {
  destination,
  ENVELOPE,
  isParcel,
  Mail,
  mailDef,
  mailOf,
  makeLetter,
  makeRandomMail,
  makeSelfParcel,
  needsPostage,
} from './mail';
import { MAIL_SECRETS, MailMischief, MX_BOSS_LINES, MX_CHAT_LINES } from './mischief';
import { CounterBot, Dog, JobApi, PostBot, Sortomatic } from './npcs';
import * as T from './texts';
import type { PenTarget } from './texts';
import { kraftTex } from './textures';
import { MailUi } from './ui';

/**
 * Mail Sorter at POSTAL UNIT 7.
 * Take mail from the belt, frank what has no postage, sort letters into the pigeonhole wall,
 * parcels into the roll cages, nonsense to RETURN TO SENDER and robot pen-pal letters to DEAD LETTERS
 * (or to whatever they are addressed to, if it happens to be in the building).
 */
const QUOTA = 15;
const TRAY_MAX = 8;
const BELT_SPEED = 0.6;

interface OnBelt {
  mail: Mail;
  mesh: THREE.Object3D;
  z: number;
}

const letterMats = [
  new THREE.MeshStandardMaterial({ color: '#efe6cf', roughness: 0.9 }),
  new THREE.MeshStandardMaterial({ color: '#e8dcc0', roughness: 0.9 }),
  new THREE.MeshStandardMaterial({ color: '#dde6ee', roughness: 0.9 }),
];
const letterGeo = new THREE.BoxGeometry(0.24, 0.012, 0.15);
const parcelGeo = new THREE.BoxGeometry(0.4, 0.24, 0.3);

function miniMail(m: Mail): THREE.Mesh {
  if (isParcel(m)) return new THREE.Mesh(parcelGeo, new THREE.MeshStandardMaterial({ map: kraftTex(m.id % 4), roughness: 0.9 }));
  return new THREE.Mesh(letterGeo, letterMats[m.kind === 'penpal' ? 2 : m.id % 2]);
}

export class MailJob implements Job, JobApi {
  info = {
    id: 'mail',
    title: 'MAIL SORTER',
    place: `${T.OFFICE} Sorting Office`,
    teaser: 'Every letter is urgent. None of them are.',
    quotaLabel: 'SORTED',
    lockedDoor: T.LOCKED_DOOR,
    bladderWarning: T.BLADDER,
  };
  level: MailOffice;
  s!: Shift;
  bossLines = { ...T.BRAD, ...MX_BOSS_LINES };
  chatLines = { ...T.CHAT, ...MX_CHAT_LINES };
  achievements = T.ACHIEVEMENTS;
  secrets = MAIL_SECRETS;

  /** Breakables, movables, kick reactions and secrets (mischief.ts). */
  private mx: MailMischief;
  private ui!: MailUi;
  private postbot!: PostBot;
  private counter!: CounterBot;
  private dog!: Dog;
  private sorto!: Sortomatic;
  private queue: Mail[] = [];
  private belt: OnBelt[] = [];
  private trayStack: THREE.Object3D[] = [];
  private spawnT = 3;
  private frank: { t: number; item: Item } | null = null;
  private steam: { t: number; item: Item; seen: boolean } | null = null;
  private shake: { t: number; item: Item } | null = null;
  private spit: { t: number; mail: Mail }[] = [];
  private lastHeld: Item | null = null;
  private paperAt = new THREE.Vector3();
  private trayWarned = 0;
  private c = {
    correct: 0, perfect: 0, wrong: 0, wrongCage: 0, wrongReturn: 0, unfranked: 0, franked: 0, thumbs: 0,
    steamed: 0, steamCaught: 0, shaken: 0, broken: 0, chewed: 0, sprayed: 0, penpal: 0, trick: 0, fed: 0, selfTaken: 0,
  };

  constructor(scene: THREE.Scene) {
    this.level = new MailOffice(scene);
    this.mx = new MailMischief(this.level);
  }

  // ---------------------------------------------------------------- setup

  start(shift: Shift): void {
    this.s = shift;
    this.ui = new MailUi();
    this.postbot = new PostBot(this);
    this.counter = new CounterBot(this);
    this.dog = new Dog(this);
    this.sorto = new Sortomatic(this);
    this.mx.start(shift, {
      dog: this.dog,
      postbot: this.postbot,
      sorto: this.sorto,
      counter: this.counter,
      read: (title, lines) => {
        this.paperAt.copy(shift.player.pos);
        this.ui.read(title, lines, 12, 'E: close');
      },
      pigeonSort: () => {
        this.c.correct++;
        this.afterCorrect();
      },
      belt: (m) => {
        const last = this.belt[this.belt.length - 1];
        this.addToBelt(m, last ? Math.min(this.level.beltStart.z + 0.05, last.z - 0.6) : this.level.beltStart.z + 0.05);
      },
    });
    // A head start: something in the tray, something on the belt.
    this.queue.push(makeLetter(), makeLetter(), makeRandomMail(), makeRandomMail());
    this.queue[0].postage = 'stamp';
    this.queue[1].postage = 'none';
    this.refreshTray();
    for (let i = 0; i < 3; i++) this.addToBelt(makeRandomMail(), this.level.beltStart.z + 1.2 + i * 1.6);
    addEventListener('keydown', this.keyHandler);
  }

  private keyHandler = (e: KeyboardEvent) => this.onKey(e);

  onEnd(): void {
    removeEventListener('keydown', this.keyHandler);
  }

  private onKey(e: KeyboardEvent): void {
    if (!document.pointerLockElement || e.repeat || !this.s) return;
    const held = this.s.held;
    const m = mailOf(held?.def);
    if (e.code === 'KeyR' && held && m && isParcel(m) && !this.frank && !this.steam) this.startShake(held, m);
    if (e.code === 'KeyQ' && m && isParcel(m) && !m.shaken) {
      // The engine says it does not fit right after this. Then this explains why.
      setTimeout(() => this.s.say('Company policy 9.1: never steal a parcel you have not shaken first. (R to shake)', 3.5), 40);
    }
  }

  obstacles() {
    return [
      { x: this.postbot.w.pos.x, z: this.postbot.w.pos.z, r: this.postbot.w.radius },
      { x: this.dog.w.pos.x, z: this.dog.w.pos.z, r: this.dog.w.radius },
    ];
  }

  lookTargets(): THREE.Object3D[] {
    const t: THREE.Object3D[] = [this.postbot.group, this.dog.group];
    if (this.counter.group.visible) t.push(this.counter.group);
    return t;
  }

  quota() {
    return { done: this.c.correct, target: QUOTA };
  }

  heldLabel(it: Item): string {
    const m = mailOf(it.def);
    if (!m) return '';
    if (m.chewed) return ' [chewed]';
    const where = m.code || (m.digit ? T.DISTRICTS[m.digit] : '?????');
    return ` [${where}${needsPostage(m) ? ', NO STAMP' : ''}]`;
  }

  productive(): boolean {
    return this.c.correct >= 12;
  }

  employeeOfTheMonth(pocket: ItemDef[], fired: boolean): string {
    if (pocket.some((p) => p.id === 'mailStamps') && !fired) return 'You. On a stamp. Technically it is Brad on a stamp in your pocket.';
    return 'SORT-O-MATIC 3000 (jammed, still faster)';
  }

  reviewRows(): [string, string | number][] {
    const c = this.c;
    return [
      ['Mail sorted correctly', c.correct],
      ['Perfect pigeonhole sorts', c.perfect],
      ['Mail sent to the wrong place', c.wrong + c.wrongCage + c.wrongReturn],
      ['Unfranked mail sent anyway', c.unfranked],
      ['Parcels shaken', c.shaken],
      ['Fragile parcels "tested"', c.broken],
      ['Thumbs franked', c.thumbs],
      ['Letters steamed open', c.steamed],
      ['Pen-pal letters hand delivered', c.penpal],
      ['RX-88 delivered to RX-88', this.counter?.served ?? 0],
      ['Mail chewed by the dog', c.chewed],
      ['Trouser bites', this.dog?.bites ?? 0],
      ['Letters sprayed by SORT-O-MATIC', c.sprayed],
      ['Trick shots into pigeonholes', c.trick],
      ...this.mx.reviewRows(),
    ];
  }

  payRows(): [string, number][] {
    const c = this.c;
    const rows: [string, number][] = [];
    const toilet = this.s.counter('toilet');
    if (toilet) rows.push([`Chain letter key deposit x${toilet}`, -1.5 * toilet]);
    if (c.thumbs) rows.push([`Thumb postage x${c.thumbs}`, 0.85 * c.thumbs], ['Thumb postage (company property)', -0.85 * c.thumbs]);
    if (c.broken) rows.push([`Fragile parcel deductible x${c.broken}`, -2 * c.broken]);
    if (c.steamed) rows.push([`Kettle electricity (steam) x${c.steamed}`, -0.4 * c.steamed]);
    if (c.unfranked) rows.push([`Postage owed x${c.unfranked}`, -0.85 * c.unfranked]);
    const bites = this.dog?.bites ?? 0;
    if (bites) rows.push([`Trouser repair (dog) x${bites}`, -1 * bites]);
    return rows;
  }

  // ---------------------------------------------------------------- per frame

  update(dt: number): void {
    const s = this.s;
    this.ui.tick(dt);
    if (this.ui.reading && s.player.pos.distanceTo(this.paperAt) > 1.6) this.ui.closePaper();
    this.updateBelt(dt);
    this.updateFrank(dt);
    this.updateSteam(dt);
    this.updateShake(dt);
    this.updateSpit(dt);
    this.postbot.update(dt);
    this.counter.update(dt);
    this.dog.update(dt);
    this.sorto.update(dt, s.t);
    this.mx.update(dt);
    // Letters stand upright in the hand and lie flat everywhere else.
    const held = s.held;
    if (held !== this.lastHeld) {
      const prev = this.lastHeld?.mesh.getObjectByName(ENVELOPE);
      if (prev) prev.rotation.x = -Math.PI / 2;
      const now = held?.mesh.getObjectByName(ENVELOPE);
      if (now) now.rotation.x = 0;
      this.lastHeld = held;
    }
    this.ui.showMail(mailOf(held?.def));
  }

  private addToBelt(m: Mail, z: number): void {
    const mesh = miniMail(m);
    mesh.position.set(this.level.beltStart.x, this.level.beltStart.y + (isParcel(m) ? 0.12 : 0.01), z);
    mesh.rotation.y = (Math.random() - 0.5) * 0.5;
    this.s.scene.add(mesh);
    this.belt.push({ mail: m, mesh, z });
  }

  private updateBelt(dt: number): void {
    const lv = this.level;
    const s = this.s;
    const full = this.queue.length >= TRAY_MAX;
    lv.beltRunning = !(full && this.belt.length && this.belt[0].z >= lv.beltEnd.z - 0.05);
    lv.beltLamp.color.set(lv.beltRunning ? '#2ecc71' : '#ff3b30');
    lv.beltLamp.emissive.set(lv.beltRunning ? '#2ecc71' : '#ff3b30');
    lv.beltFullSign.visible = full;
    if (full) {
      this.trayWarned -= dt;
      if (this.trayWarned <= 0 && !s.boss.offline && s.boss.horizontalDist(lv.trayPos) < 9) {
        this.trayWarned = 25;
        s.annoyance += 10;
        s.bossSay('mailTray', true);
      }
    }
    // Spawn: a little faster as the day goes on
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = Math.max(5.2, 7 - s.t / 120);
      const last = this.belt[this.belt.length - 1];
      if (this.belt.length < 7 && (!last || last.z > lv.beltStart.z + 0.6)) this.addToBelt(makeRandomMail(), lv.beltStart.z + 0.05);
    }
    if (!lv.beltRunning) return;
    let limit = lv.beltEnd.z;
    for (let i = 0; i < this.belt.length; i++) {
      const b = this.belt[i];
      b.z = Math.min(b.z + BELT_SPEED * dt, limit);
      limit = b.z - 0.5;
      b.mesh.position.z = b.z;
    }
    const head = this.belt[0];
    if (head && head.z >= lv.beltEnd.z - 0.01 && this.queue.length < TRAY_MAX) {
      this.belt.shift();
      s.scene.remove(head.mesh);
      this.queue.push(head.mail);
      this.refreshTray();
      s.sfx.tone(260, 0.05, 'triangle', 0.05);
    }
  }

  private refreshTray(): void {
    for (const m of this.trayStack) m.parent?.remove(m);
    this.trayStack = [];
    const p = this.level.trayPos;
    let yL = 0;
    let parcels = 0;
    this.queue.forEach((m, i) => {
      const mesh = miniMail(m);
      if (isParcel(m)) {
        mesh.position.set(p.x + (parcels % 2 ? 0.18 : -0.18), 0.9 + 0.13 + Math.floor(parcels / 2) * 0.25, p.z + 0.12);
        parcels++;
      } else {
        mesh.position.set(p.x + ((i * 37) % 5 - 2) * 0.03, 0.9 + 0.01 + yL, p.z - 0.18);
        yL += 0.014;
      }
      mesh.rotation.y = ((i * 53) % 7 - 3) * 0.08;
      this.s.scene.add(mesh);
      this.trayStack.push(mesh);
    });
  }

  // ---------------------------------------------------------------- the player's actions

  interact(look: Look | null): boolean {
    const s = this.s;
    if (this.frank) {
      this.resolveFrank();
      return true;
    }
    if (this.steam) return true;
    if (this.ui.reading) {
      this.ui.closePaper();
      return true;
    }
    if (this.mx.interact(look)) return true;
    const info = look?.info;
    const held = s.held;
    const m = mailOf(held?.def);
    if (!info) return false;
    switch (info.kind) {
      case 'tray':
        if (m) {
          if (this.queue.length >= TRAY_MAX) {
            s.say('The tray is full. It does not want it back either.', 2.5);
            return true;
          }
          s.removeHeld();
          this.queue.push(m);
          this.refreshTray();
          s.say('You put it back in the tray. It will come back. They always come back.', 2.5);
          return true;
        }
        if (held) return false;
        this.takeFromTray();
        return true;
      case 'cubby':
        if (held) this.place(info.cubby as Cubby, held, false);
        else this.takeBack(info.cubby as Cubby);
        return true;
      case 'cage':
        if (held) this.place(info.cage as Cage, held, false);
        else s.say(`Roll cage ${(info.cage as Cage).name}. It rattles when you look at it.`, 2.5);
        return true;
      case 'return':
        if (!held) {
          s.say(`The RETURN TO SENDER pile. ${this.level.returnCount} letters. It is load bearing now.`, 2.5);
          return true;
        }
        this.toReturn(held, m);
        return true;
      case 'dead':
        if (!held) {
          s.say('DEAD LETTERS. Letters to nobody. Or to things. Do not open the drawer. You open it. It is full.', 3);
          this.level.deadOpen = 1;
          return true;
        }
        this.toDead(m);
        return true;
      case 'routing':
        this.paperAt.copy(s.player.pos);
        this.ui.read('ROUTING SHEET', T.ROUTING_SHEET.slice(1), 14, 'E: close');
        return true;
      case 'franker':
        this.startFrank(held, m);
        return true;
      case 'kettle':
        this.useKettle(held, m);
        return true;
      case 'toaster':
        if (m?.kind === 'penpal') {
          this.deliver(m, 'toaster', look!);
          return true;
        }
        s.say(pick(T.TOASTER_IDLE), 2.5);
        return true;
      case 'plant':
        if (m?.kind === 'penpal' && m.target === 'plant') {
          this.deliver(m, 'plant', look!);
          return true;
        }
        return false;
      case 'sortomatic':
        if (m) {
          if (m.kind === 'penpal' && m.target === 'sortomatic') this.deliver(m, 'sortomatic', look!);
          else this.feed(m);
          return true;
        }
        if (held) {
          s.say('SORT-O-MATIC does not want that. It wants paper. It always wants paper.', 2.5);
          return true;
        }
        this.sorto.kick();
        return true;
      case 'dog':
        if (m?.kind === 'penpal' && m.target === 'dog') {
          this.deliver(m, 'dog', look!);
          return true;
        }
        if (m && !this.dog.friendly) {
          s.say('You offer the dog a letter. The dog takes the letter. And a bit of your sleeve.', 3);
          s.removeHeld();
          this.c.chewed++;
          s.hype += 8;
          s.chat('mailChewed');
          return true;
        }
        this.dog.pet();
        return true;
      case 'postbot':
        if (held) this.postbot.say('Do not hand me mail. Liability. Put it in a hole like a professional.', 3);
        else this.postbot.talk();
        return true;
      case 'counterbot':
        this.counter.use(held);
        if (m?.kind === 'self' && !s.held) {
          this.c.correct++;
          this.afterCorrect();
          s.hype += 6;
          s.chat('mailCounter');
        }
        return true;
      case 'bell':
        this.counter.dingBell();
        s.say('Ding. Nobody comes. You are the nobody who would come.', 2.5);
        return true;
    }
    return false;
  }

  hint(look: Look | null): string | null {
    const s = this.s;
    if (this.frank) return 'E: FRANK! (when the bar is full)';
    if (this.steam) return '';
    if (this.ui.reading) return 'E: put the paper away';
    const mh = this.mx.hint(look);
    if (mh !== null) return mh;
    const info = look?.info;
    if (!info) return null;
    const held = s.held;
    const m = mailOf(held?.def);
    switch (info.kind) {
      case 'tray':
        if (m) return 'E: put it back in the tray';
        if (held) return null;
        return this.queue.length ? `E: take mail (${this.queue.length} waiting)` : 'The tray is empty. For now.';
      case 'cubby': {
        const cb = info.cubby as Cubby;
        const name = `${cb.label} · ${T.DISTRICTS[cb.digit]}`;
        if (held) return `E: sort into ${name}`;
        return cb.entries.length ? `${name} · E: take a letter back out` : `Pigeonhole ${name}`;
      }
      case 'cage': {
        const cg = info.cage as Cage;
        return held ? `E: put in roll cage ${cg.name}` : `Roll cage ${cg.name} · codes ${cg.digits.join(', ')}xxxx`;
      }
      case 'return':
        return held ? 'E: RETURN TO SENDER' : 'Return to sender pile';
      case 'dead':
        return held ? 'E: file under DEAD LETTERS' : 'Dead letters cabinet';
      case 'routing':
        return 'E: read the routing sheet';
      case 'franker':
        if (m) return m.postage === 'none' ? 'E: frank it' : 'E: frank it (again?)';
        if (held?.def.id === 'mailKeyBag') return 'E: frank the chain letters';
        return 'Franking machine';
      case 'kettle':
        if (m && !isParcel(m)) return m.steamed ? 'Already opened' : 'E: steam it open (very illegal)';
        if (m) return 'E: steam the parcel?';
        return 'Kettle (for tea)';
      case 'toaster':
        return m?.kind === 'penpal' ? 'E: deliver it to the toaster' : 'Toaster';
      case 'plant':
        return m?.kind === 'penpal' && m.target === 'plant' ? 'E: deliver it to the plant' : null;
      case 'sortomatic':
        if (m) return m.kind === 'penpal' && m.target === 'sortomatic' ? 'E: deliver the letter to SORT-O-MATIC' : 'E: feed it to SORT-O-MATIC';
        return this.sorto.state === 'warn' ? 'E: PERCUSSIVE MAINTENANCE' : 'E: kick SORT-O-MATIC';
      case 'dog':
        if (m?.kind === 'penpal' && m.target === 'dog') return 'E: give the letter to the dog';
        return this.dog.friendly ? 'E: pet GOOD BOY 3000' : 'E: pet the dog (brave)';
      case 'postbot':
        return `E: talk to ${T.POSTBOT_NAME}`;
      case 'counterbot':
        if (this.counter.state === 'wait' && !held) return 'E: take RX-88\'s parcel';
        if (m?.kind === 'self') return 'E: deliver RX-88 to RX-88';
        return 'E: talk to RX-88';
      case 'bell':
        return 'E: ring the bell';
    }
    return null;
  }

  // ---------------------------------------------------------------- tray

  private takeFromTray(): void {
    const s = this.s;
    const m = this.queue.shift();
    if (!m) {
      s.say('The tray is empty. Enjoy this moment. It will not last.', 2.5);
      return;
    }
    this.refreshTray();
    const it = s.addItem(mailDef(m), this.level.trayPos.clone());
    s.pickUp(it);
  }

  // ---------------------------------------------------------------- sorting

  private stackInCubby(cb: Cubby, m: Mail): void {
    const mesh = miniMail(m);
    const n = cb.stack.length;
    mesh.position.set(cb.pos.x + ((n * 37) % 5 - 2) * 0.02, cb.pos.y + 0.008 + n * 0.013 + 0.03, cb.pos.z - 0.02);
    mesh.rotation.y = ((n * 53) % 7 - 3) * 0.06;
    this.s.scene.add(mesh);
    cb.stack.push(mesh);
  }

  private stackInCage(cg: Cage, m: Mail): void {
    const mesh = miniMail(m);
    const n = cg.stack.length;
    const parcel = isParcel(m);
    mesh.position.set(cg.pos.x - 0.1 + (n % 2 ? 0.15 : -0.15), cg.pos.y + (parcel ? 0.12 : 0.01) + 0.55 + Math.floor(n / 2) * 0.25, cg.pos.z + (n % 4 < 2 ? 0.25 : -0.25));
    mesh.rotation.y = ((n * 53) % 7 - 3) * 0.1;
    this.s.scene.add(mesh);
    cg.stack.push(mesh);
  }

  /** Puts the held (or thrown) item into a pigeonhole or a roll cage. */
  private place(target: Cubby | Cage, it: Item, thrown: boolean): boolean {
    const s = this.s;
    const m = mailOf(it.def);
    const isCubby = 'col' in target;
    if (!m) {
      if (thrown) return false;
      if (it.def.id === 'mailKeyBag') s.say(isCubby ? 'You try to post the toilet key. The pigeonhole refuses. It has standards.' : 'You try to ship the toilet key OFF-WORLD. The cage refuses. It knows what is in that sack.', 3);
      else s.say('That is not mail. Not even legally.', 2.5);
      return true;
    }
    if (isCubby && isParcel(m)) {
      if (!thrown) s.say('It does not fit. Pigeonholes are for letters. You knew that. The parcel knew that.', 3);
      return thrown ? false : true;
    }
    const full = isCubby ? target.entries.length >= 5 : target.entries.length >= 6;
    if (full) {
      if (!thrown) s.say(isCubby ? 'This hole is full. COLLECT-O 2 is on his way. Eventually.' : 'The cage is full. Parcels are stacked to the legal limit of "a lot".', 3);
      return thrown ? false : true;
    }
    if (thrown) s.removeItem(it);
    else s.removeHeld();
    const dest = destination(m);
    const right = isCubby ? dest === 'cubby' && m.digit === (target as Cubby).digit : (dest === 'cage' || dest === 'counter') && (target as Cage).digits.includes(m.digit);
    const unpaid = needsPostage(m);
    const entry: Entry = { mail: m, ok: right && !unpaid, perfect: right && !unpaid && isCubby && m.row === (target as Cubby).row };
    target.entries.push(entry);
    if (isCubby) this.stackInCubby(target as Cubby, m);
    else this.stackInCage(target as Cage, m);
    if (thrown) {
      this.c.trick++;
      s.hype += 12;
      s.say(isCubby ? 'Nothing but hole.' : 'Slam dunk. Into a roll cage.', 2);
      s.chat('hype');
    }
    if (m.kind === 'self') this.counter.lost();
    const where = isCubby ? T.DISTRICTS[(target as Cubby).digit] : (target as Cage).name;
    if (right && unpaid) {
      this.c.unfranked++;
      s.sfx.buzz();
      s.say('Right place. No postage. It sits there, unpaid, judging you.', 2.5);
      if (s.seen) {
        s.annoyance += 12;
        s.bossSay('mailUnfranked', true);
      }
      return true;
    }
    if (right) {
      this.c.correct++;
      if (entry.perfect) this.c.perfect++;
      this.afterCorrect();
      if (m.broken) s.say('Correct cage. The parcel jingles like a sad wind chime.', 2.5);
      return true;
    }
    if (isCubby) this.c.wrong++;
    else this.c.wrongCage++;
    s.hype += 9;
    s.sfx.buzz();
    s.chat('mailWrong', { dist: where.toLowerCase() });
    if (m.kind === 'penpal') s.say(`You sorted "${m.to}" into ${where}. Someone there is getting a very confusing letter.`, 3);
    if (s.seen) {
      s.annoyance += 25;
      s.boss.confront();
      s.bossSay('mailWrong', true);
    }
    return true;
  }

  private afterCorrect(): void {
    const s = this.s;
    s.annoyance = Math.max(0, s.annoyance - 5);
    s.sfx.ding();
    if (s.seen && Math.random() < 0.3) s.bossSay('correctSeen');
    if (Math.random() < 0.2) s.chat('mailCorrect');
    if (this.c.correct === QUOTA) s.hud.toast('QUOTA REACHED', 'Brad has doubled your quota. Retroactively.', 'corp');
  }

  /** E on a pigeonhole with empty hands: the last letter comes back out. */
  private takeBack(cb: Cubby): void {
    const s = this.s;
    const e = cb.entries.pop();
    if (!e) {
      s.say(`Pigeonhole ${cb.label}, ${T.DISTRICTS[cb.digit]}. Empty. Like a promise.`, 2.5);
      return;
    }
    const mesh = cb.stack.pop();
    mesh?.parent?.remove(mesh);
    if (e.ok) this.c.correct = Math.max(0, this.c.correct - 1);
    if (e.perfect) this.c.perfect = Math.max(0, this.c.perfect - 1);
    const it = s.addItem(mailDef(e.mail), cb.pos.clone());
    s.pickUp(it);
    if (s.seen) s.bossSay('mailWrong');
  }

  private toReturn(it: Item, m: Mail | null): void {
    const s = this.s;
    if (!m) {
      if (it.def.id === 'mailKeyBag') s.say('You return the chain letters to sender. The sender is everyone. It comes back.', 3);
      else s.say('Return to sender? It has no sender. It is a ' + it.def.name.toLowerCase() + '.', 2.5);
      return;
    }
    s.removeHeld();
    this.level.addToReturnPile();
    if (destination(m) === 'return') {
      this.c.correct++;
      this.afterCorrect();
      if (Math.random() < 0.4) s.chat('mailReturn');
      return;
    }
    this.c.wrongReturn++;
    s.hype += 8;
    s.sfx.buzz();
    s.chat('mailReturn');
    s.say(m.kind === 'self' ? 'You returned RX-88 to RX-88. Wait. That might actually work.' : 'That address was fine. It is going back anyway. Back where? Nobody knows.', 3);
    if (s.seen) {
      s.annoyance += 20;
      s.boss.confront();
      s.bossSay('mailReturnWrong', true);
    }
  }

  private toDead(m: Mail | null): void {
    const s = this.s;
    this.level.deadOpen = 1;
    if (!m) {
      s.say('The drawer will not take it. Dead letters only. That is not even a letter.', 2.5);
      return;
    }
    s.removeHeld();
    if (m.kind === 'penpal') {
      this.c.correct++;
      this.afterCorrect();
      s.say('Filed under DEAD LETTERS. It will rest here forever. Unread. Unless.', 2.5);
      return;
    }
    this.c.wrong++;
    s.hype += 8;
    s.sfx.buzz();
    s.chat('mailWrong', { dist: 'the dead letters' });
    s.say('You filed a perfectly alive letter under DEAD. It did not deserve that.', 3);
    if (s.seen) {
      s.annoyance += 20;
      s.bossSay('mailWrong', true);
    }
  }

  /** A pen-pal letter handed to the thing it is addressed to. */
  private deliver(m: Mail, to: PenTarget, look: Look): void {
    const s = this.s;
    if (m.target !== to) {
      s.say(`It is addressed to "${m.to}". This is not that. Close, emotionally.`, 3);
      return;
    }
    s.removeHeld();
    this.c.correct++;
    this.c.penpal++;
    this.afterCorrect();
    s.hype += 18;
    s.achieve('mailPenpal');
    s.chat('mailPenpal', {}, 2);
    switch (to) {
      case 'toaster':
        s.say('The toaster reads the letter. It glows warmly. A single crumb falls out, like a tear.', 4);
        s.sfx.tone(880, 0.3, 'sine', 0.08);
        break;
      case 'kettle':
        s.say('The kettle reads the letter. It boils with shame.', 3.5);
        this.level.steaming = true;
        setTimeout(() => (this.level.steaming = !!this.steam), 3000);
        break;
      case 'dog':
        s.say('You hand the dog its first letter ever. Something changes in its firmware.', 3.5);
        this.dog.makeFriendly();
        break;
      case 'sortomatic':
        this.sorto.cry();
        break;
      case 'plant':
        s.say('You lay the letter in the plant pot. The plant grows a little. Or it was always that big.', 3.5);
        look.object.scale.multiplyScalar(1.15);
        break;
    }
    if (s.seen) s.bossSay('mailPenpal', true);
  }

  private feed(m: Mail): void {
    const s = this.s;
    s.removeHeld();
    this.c.fed++;
    s.say(pick(T.SORTO_EAT), 2.5);
    s.sfx.whoosh();
    this.sorto.say('Mmm. Paper. Processing.', 2);
    this.spit.push({ t: 1.8, mail: m });
  }

  private updateSpit(dt: number): void {
    for (const sp of this.spit) sp.t -= dt;
    const due = this.spit.filter((sp) => sp.t <= 0);
    if (!due.length) return;
    this.spit = this.spit.filter((sp) => sp.t > 0);
    for (const sp of due) {
      // It franks things on the way through. Badly.
      if (sp.mail.postage === 'none') sp.mail.postage = 'smudge';
      sp.mail.redraw?.();
      this.throwOut(sp.mail);
      this.sorto.say('Sorted. Emotionally.', 2);
    }
  }

  private throwOut(m: Mail): void {
    const out = this.level.machine.outlet;
    const it = this.s.addItem(mailDef(m), out.clone());
    it.vel.set(rand(-2.5, 2.5), rand(2.5, 4.5), rand(1.2, 3.8));
    it.sleeping = false;
  }

  // ---------------------------------------------------------------- franking

  private startFrank(held: Item | null, m: Mail | null): void {
    const s = this.s;
    if (!held) {
      s.say(T.FRANKER_IDLE, 2.5);
      return;
    }
    if (!m) {
      if (held.def.id === 'mailKeyBag') {
        s.say('You frank the chain letter sack. The chain is now postage paid. This will end badly.', 3.5);
        s.sfx.stamp();
        s.hype += 6;
      } else if (held.def.id === 'mailStamps') {
        s.say('You frank the stamps. They are now doubly worthless. Collectors will kill for this.', 3);
        s.sfx.stamp();
      } else s.say('The franking machine sniffs it and refuses.', 2.5);
      return;
    }
    this.frank = { t: 0, item: held };
    s.movementLocked = true;
    this.level.drawFrankScreen('PRESS E\nWHEN FULL', '#f1c40f');
  }

  private frankFrac(): number {
    const t = this.frank?.t ?? 0;
    return (1 - Math.cos(t * 4.4)) / 2;
  }

  private updateFrank(dt: number): void {
    const f = this.frank;
    if (!f) return;
    const s = this.s;
    if (s.held !== f.item) {
      this.endFrank();
      return;
    }
    f.t += dt;
    const frac = this.frankFrac();
    s.hud.progress('FRANK-O-TRON 64: press E when the bar is FULL', frac);
    this.level.frankHead.position.y = 0.42 + frac * 0.08;
    if (f.t > 8) {
      s.say('The franking machine got bored of you and went to standby.', 2.5);
      this.endFrank();
    }
  }

  private resolveFrank(): void {
    const s = this.s;
    const f = this.frank;
    if (!f) return;
    const m = mailOf(f.item.def)!;
    const frac = this.frankFrac();
    const was = m.postage;
    this.level.frankHead.position.y = 0.36;
    s.sfx.stamp();
    if (frac >= 0.8) {
      m.postage = 'frank';
      this.c.franked++;
      s.say(was === 'none' ? 'KA-CHUNK. A clean frank. Beautiful. Nobody will ever look at it.' : 'KA-CHUNK. Double postage. Robots love inflation.', 2.5);
      if (Math.random() < 0.35) s.chat('mailFrank');
      this.level.drawFrankScreen('CLEAN\nFRANK');
    } else if (frac >= 0.4) {
      if (was === 'none') m.postage = 'smudge';
      this.c.franked++;
      s.say('Ka-chunk. Smudged, but legally postage.', 2.5);
      this.level.drawFrankScreen('SMUDGE\nOK I GUESS', '#f1c40f');
    } else {
      this.c.thumbs++;
      s.hype += 18;
      s.achieve('mailThumb');
      s.chat('mailThumb', {}, 2);
      s.say('You franked your thumb. It now says POSTAGE PAID. The letter does not.', 3);
      this.level.drawFrankScreen('THUMB\nDETECTED', '#ff4d4d');
      if (s.seen) {
        s.annoyance += 8;
        s.bossSay('mailThumb', true);
      }
    }
    m.redraw?.();
    this.endFrank();
  }

  private endFrank(): void {
    this.frank = null;
    this.s.movementLocked = false;
    this.s.hud.progress(null);
    setTimeout(() => this.level.drawFrankScreen('INSERT MAIL'), 1500);
  }

  // ---------------------------------------------------------------- the kettle

  private useKettle(held: Item | null, m: Mail | null): void {
    const s = this.s;
    if (!held) {
      s.say(T.KETTLE_IDLE, 2.5);
      return;
    }
    if (!m) {
      s.say(held.def.id === 'mailKeyBag' ? 'You steam the chain letters. They multiply.' : 'You steam it. It is now warm and damp. Like your career.', 2.5);
      return;
    }
    if (isParcel(m)) {
      s.say('You hold the parcel over the kettle. It gets soggy. You learn nothing.', 2.5);
      return;
    }
    if (m.steamed) {
      s.say('Already opened. Opening it twice would be rude.', 2.5);
      return;
    }
    this.steam = { t: 0, item: held, seen: false };
    s.movementLocked = true;
    this.level.steaming = true;
    s.sfx.noise(3, 0.06, 2500, 0, 0.5, 'highpass');
  }

  private updateSteam(dt: number): void {
    const st = this.steam;
    if (!st) return;
    const s = this.s;
    if (s.held !== st.item) {
      this.endSteam();
      return;
    }
    st.t += dt;
    if (s.seen) st.seen = true;
    s.hud.progress('Steaming the envelope open... (extremely illegal)', st.t / 3);
    st.item.mesh.position.y = -0.2 + Math.sin(st.t * 20) * 0.005;
    if (st.t < 3) return;
    const m = mailOf(st.item.def)!;
    m.steamed = true;
    m.redraw?.();
    this.c.steamed++;
    s.hype += 25;
    s.achieve('mailSteam');
    s.chat('mailSteam', {}, 3);
    this.paperAt.copy(s.player.pos);
    const title = m.kind === 'penpal' ? `LETTER TO ${m.to.toUpperCase()}` : `LETTER FOR ${m.to.toUpperCase()}`;
    this.ui.read(title, m.content, 10, 'Opening mail is illegal. Reading it is worse.  E: close');
    if (st.seen) {
      this.c.steamCaught++;
      s.hype += 15;
      s.boss.confront();
      s.bossSay('mailSteam', true);
      s.writeUp('Violation of postal secrecy (with a kettle)');
    } else if (m.content.some((l) => l.includes('Brad is behind you'))) {
      // The letter was right.
      s.boss.micromanage();
    }
    this.endSteam();
  }

  private endSteam(): void {
    const st = this.steam;
    if (st) st.item.mesh.position.y = st.item.def.holdPos?.[1] ?? -0.28;
    this.steam = null;
    this.s.movementLocked = false;
    this.level.steaming = false;
    this.s.hud.progress(null);
  }

  // ---------------------------------------------------------------- shaking parcels

  private startShake(it: Item, m: Mail): void {
    const s = this.s;
    if (this.shake) return;
    this.shake = { t: 0, item: it };
    const first = !m.shaken;
    if (first) m.shaken = pick(T.SHAKES);
    // Shaken parcels fit in a pocket. Company policy, sort of.
    it.def.pocketable = true;
    it.def.pocketLine = `You pocket the parcel. ${m.shaken} You will find out at home.`;
    s.sfx.noise(0.5, 0.25, 700, 0, 2, 'bandpass');
    if (first) this.c.shaken++;
    if (m.fragile && !m.broken) {
      m.broken = true;
      this.c.broken++;
      s.sfx.tone(2400, 0.15, 'triangle', 0.06, 1800, 0.25);
      s.say('Something inside goes "tink". It was fragile. It is now several things.', 3.5);
      s.hype += 12;
      s.chat('mailFragile', {}, 2);
      if (s.seen) {
        s.annoyance += 20;
        s.boss.confront();
        s.bossSay('mailFragile', true);
      }
      return;
    }
    s.say(`You shake it. ${m.shaken}`, 2.5);
    s.hype += 3;
    if (Math.random() < 0.4) s.chat('mailShake');
    if (s.seen) {
      s.annoyance += 8;
      s.bossSay('mailShake');
    }
  }

  private updateShake(dt: number): void {
    const sh = this.shake;
    if (!sh) return;
    sh.t += dt;
    const it = sh.item;
    const base = it.def.holdPos ?? [0.3, -0.28, -0.6];
    if (this.s.held !== it || sh.t > 0.7) {
      if (this.s.held === it) it.mesh.position.set(base[0], base[1], base[2]);
      this.shake = null;
      return;
    }
    it.mesh.position.set(base[0] + Math.sin(sh.t * 50) * 0.05, base[1] + Math.sin(sh.t * 37) * 0.04, base[2]);
  }

  // ---------------------------------------------------------------- thrown things

  onKick(look: Look | null): boolean {
    if (this.frank || this.steam) return true;
    return this.mx.onKick(look);
  }

  thrownHit(it: Item): boolean {
    if (this.mx.thrownHit(it)) return true;
    const p = it.mesh.position;
    const s = this.s;
    // Robots
    const d = this.dog.w.pos;
    if (Math.hypot(p.x - d.x, p.z - d.z) < 0.55 && p.y < 1.0) {
      it.vel.multiplyScalar(-0.3);
      it.thrown = false;
      s.sfx.thud();
      this.dog.hit();
      s.chat('mailDog');
      return true;
    }
    const pb = this.postbot.w.pos;
    if (Math.hypot(p.x - pb.x, p.z - pb.z) < 0.75 && p.y < 2.0) {
      it.vel.multiplyScalar(-0.3);
      it.thrown = false;
      s.sfx.thud();
      this.postbot.hit();
      s.hype += 10;
      s.chat('hitCustomer');
      if (s.seen) {
        s.annoyance += 15;
        s.bossSay('mailComplaint', true);
      }
      return true;
    }
    const mc = this.level.machine.group.position;
    if (Math.abs(p.x - mc.x) < 1.35 && Math.abs(p.z - mc.z) < 0.95 && p.y < 2.1) {
      it.thrown = false;
      this.sorto.kick();
      return true;
    }
    // Trick shots: mail into the pigeonhole wall or a roll cage
    if (!mailOf(it.def)) return false;
    if (p.z > -10.5 && p.z < -10.2 && p.x > -7.98 && p.x < -3.02) {
      const top = 0.5 + CUBBY_ROWS * 0.44;
      const col = Math.floor((p.x + 7.98) / 0.62);
      const row = Math.floor((top - p.y) / 0.44);
      if (col >= 0 && col < CUBBY_COLS && row >= 0 && row < CUBBY_ROWS) {
        const cb = this.level.cubbies.find((c) => c.col === col && c.row === row);
        if (cb && this.place(cb, it, true)) return true;
      }
    }
    for (const cg of this.level.cages) {
      if (Math.abs(p.x - cg.pos.x) < 0.75 && Math.abs(p.z - cg.pos.z) < 0.75 && p.y < 2.0) {
        if (this.place(cg, it, true)) return true;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------- JobApi for the robots

  collect(target: Cubby | Cage): { total: number; wrong: string[]; unfranked: number } {
    const isCubby = 'col' in target;
    const wrong: string[] = [];
    let unfranked = 0;
    for (const e of target.entries) {
      if (e.ok) continue;
      const m = e.mail;
      const right = isCubby ? destination(m) === 'cubby' && m.digit === (target as Cubby).digit : (target as Cage).digits.includes(m.digit) && isParcel(m);
      if (right && needsPostage(m)) unfranked++;
      else {
        const hole = isCubby ? (target as Cubby).label : (target as Cage).name;
        wrong.push(fill(pick(T.POSTBOT_BAD), { code: m.code || `"${m.to}"`, hole }));
      }
    }
    const total = target.entries.length;
    target.entries = [];
    for (const mesh of target.stack) mesh.parent?.remove(mesh);
    target.stack = [];
    if (wrong.length) this.s.chat('mailWrong', { dist: 'the robot noticed' });
    return { total, wrong, unfranked };
  }

  giveSelfParcel(): void {
    const s = this.s;
    this.c.selfTaken++;
    if (s.held) return;
    const it = s.addItem(mailDef(makeSelfParcel()), new THREE.Vector3(-4, 1.2, 10.6));
    s.pickUp(it);
    s.chat('mailCounter');
  }

  spray(n: number): void {
    for (let i = 0; i < n; i++) {
      this.throwOut(Math.random() < 0.8 ? makeLetter() : makeRandomMail());
      this.c.sprayed++;
    }
  }

  complain(at: THREE.Vector3, key: string, amount: number): void {
    const s = this.s;
    if (s.boss.offline) return;
    if (s.boss.horizontalDist(at) < 11 || s.boss.horizontalDist(s.player.pos) < 11) {
      s.annoyance += amount;
      s.bossSay(key, true);
    }
  }

  chewed(it: Item): void {
    const m = mailOf(it.def);
    if (!m || m.chewed) return;
    m.chewed = true;
    m.redraw?.();
    this.c.chewed++;
    this.s.chat('mailChewed');
  }
}

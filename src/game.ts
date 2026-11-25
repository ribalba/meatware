import * as THREE from 'three';
import { BEERS_PER_CRATE, BeerCrate, bottleMesh } from './beer';
import { Boss } from './boss';
import { BreakableState, Debris, ENGINE_SECRETS, KickBoot, OfficeCat, colorsOf, foundSecrets, saveSecret, setSecretTotal } from './fun';
import { Hud } from './hud';
import { Sfx } from './audio';
import { Item, ItemDef } from './items';
import { bubbles } from './bubbles';
import { Intro } from './intro';
import { NavGrid } from './nav';
import { StyleRenderer } from './styles';
import { Player } from './player';
import { reviewHtml } from './review';
import * as T from './texts';
import { blobGeometry, clamp, fill, pick, rand } from './util';
import type { Interact, Level } from './level';
import { findJob, titleHtml } from './jobs';
import type { Job, JobEntry, Look, Puddle, Shift } from './jobs/types';

type Mode = 'boot' | 'intro' | 'title' | 'ready' | 'playing' | 'paused' | 'ended';

/** Shift length in real seconds (09:00 to 17:00). */
const SHIFT_LEN = 300;
/** "Just five more minutes", in real seconds. */
const OVERTIME = 30;
const puddleMat = new THREE.MeshBasicMaterial({ color: '#cfa81f', transparent: true, opacity: 0.62, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
const puddleShine = new THREE.MeshBasicMaterial({ color: '#f6e27a', transparent: true, opacity: 0.45, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });

/**
 * The shift engine. It runs whatever job was selected and owns everything all jobs share:
 * player, Brad, bladder and toilet, items in hands, stealing, puddles, write-ups,
 * the robot live chat, the clock and the payslip. See jobs/types.ts.
 */
export class Game implements Shift {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(70, 1, 0.05, 120);
  readonly hud: Hud;
  readonly sfx = new Sfx();
  readonly boss: Boss;
  readonly player: Player;
  readonly nav: NavGrid;
  items: Item[] = [];
  puddles: Puddle[] = [];
  held: Item | null = null;
  seen = false;
  t = 0;
  annoyance = 0;
  movementLocked = false;

  readonly renderer: THREE.WebGLRenderer;
  private styleR: StyleRenderer;
  private lastFrame = performance.now();
  private entry: JobEntry;
  private job: Job;
  private level: Level;
  private raycaster = new THREE.Raycaster();
  private root: HTMLElement;

  private mode: Mode = 'boot';
  private intro: Intro | null = null;
  private started = false;
  private overtimes = 0;
  private heldTime = 0;
  private _hype = 25;
  private viewers = 1200;
  private peakViewers = 1200;
  private messyCheck = 6;
  private writeUps = 0;
  private bladder = 35;
  private bladderWarned = false;
  private pocket: ItemDef[] = [];
  private idleTime = 0;
  private lastEvent = 0;
  private nextChat = 3;
  private chatQueue: { at: number; key: string; vars: Record<string, string> }[] = [];
  private recentChat: string[] = [];
  private lastChatUser = '';
  private lowHypeTime = 0;
  private corporateCooldown = 0;
  private doorTimer = 0;
  private bossSayCooldown = 0;
  private bossLastSaid: Record<string, number> = {};
  private bossTable: Record<string, string[]>;
  private inspect: { item: Item; t: number } | null = null;
  private pee: { t: number; dur: number; toilet: boolean; knock: number } | null = null;
  private pendingEnd: { t: number; fired: boolean; reason: string } | null = null;
  private achievements: string[] = [];
  private keyDistance = 0;
  private counters: Record<string, number> = {};
  /** Roughly the beers in the blood. Goes down by one per minute. */
  private drunk = 0;
  private beer: BeerCrate;
  private drinking: { t: number; bottle: THREE.Object3D } | null = null;
  private blurCss = '';
  private tintCss = '';
  private debris: Debris;
  private kickBoot: KickBoot;
  private kickCd = 0;
  private damage = 0;
  private cat: OfficeCat | null = null;
  private golden: Item | null = null;
  private events: { at: number; kind: string }[] = [];
  private powerCut = 0;
  private gravityOff = 0;
  private hiding: string | null = null;
  private hideTime = 0;
  private shiftSecrets: string[] = [];
  private secretTitles: Record<string, string>;

  get hype(): number {
    return this._hype;
  }
  /** Gains can be multiplied by the job (an influencer filming doubles them). */
  set hype(v: number) {
    const d = v - this._hype;
    const mul = this.job?.hypeMultiplier?.() ?? 1;
    if (d >= 10 && mul > 1) this.achieve('viral');
    this._hype = clamp(this._hype + (d > 0 ? d * mul : d), 0, 100);
  }

  constructor(root: HTMLElement) {
    this.root = root;
    const params = new URLSearchParams(location.search);
    this.entry = findJob(params.get('job'));

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    root.appendChild(this.renderer.domElement);
    this.styleR = new StyleRenderer(this.renderer);
    this.scene.add(this.camera);

    this.job = this.entry.create(this.scene);
    this.level = this.job.level;
    this.items.push(...this.level.initialItems);
    this.bossTable = { ...T.BOSS_LINES, ...(this.job.bossLines ?? {}) };
    Object.assign(T.CHAT_LINES, this.job.chatLines ?? {});
    Object.assign(T.ACHIEVEMENTS, this.job.achievements ?? {});

    this.player = new Player(this.camera, this.renderer.domElement);
    this.player.bounds = this.level.bounds;
    this.player.pos.copy(this.level.spawn.pos);
    this.player.yaw = this.level.spawn.yaw;
    this.boss = new Boss(this.scene, { say: (k, force) => this.bossSay(k, force), beep: () => this.sfx.beep() }, this.level.bossWaypoints, this.level.booth, this.level.doorFront);
    this.nav = new NavGrid(this.level.colliders, this.level.bounds, [this.level.booth]);
    this.hud = new Hud(root);
    this.hud.text('job', this.job.info.title);
    this.hud.text('quotaLabel', this.job.info.quotaLabel);
    if (this.job.helpKeys) this.hud.addHelpKeys(this.job.helpKeys);
    // Before start, so jobs may already find secrets there.
    this.secretTitles = { ...ENGINE_SECRETS, ...(this.job.secrets ?? {}) };
    setSecretTotal(this.entry.id, Object.keys(this.secretTitles).length);
    this.job.start(this);
    // After start, because some jobs only add their furniture colliders there.
    // A new hiding place every shift.
    this.beer = new BeerCrate(this.scene, this.level, `${this.entry.id}-${Math.random()}`);
    if (this.beer.collider) this.nav.block(this.beer.collider);
    this.debris = new Debris(this.scene);
    this.kickBoot = new KickBoot(this.camera);
    this.planEvents();

    addEventListener('resize', () => this.resize());
    this.resize();
    addEventListener('keydown', (e) => this.onKey(e));
    // Right mouse kicks, like K.
    addEventListener('mousedown', (e) => {
      if (e.button === 2 && this.mode === 'playing') this.kick();
    });
    this.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('pointerlockchange', () => this.onLockChange());
    this.renderer.domElement.addEventListener('click', () => {
      if (this.mode === 'paused' || this.mode === 'ready') this.lock();
    });
    this.player.update(0, [], [], 0, 0);
    // Coming back from the job selection or "clock in again" skips boot screen and intro.
    if (params.has('skipintro')) this.showTitle();
    else this.boot();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ---------------------------------------------------------------- lifecycle

  private resize(): void {
    this.styleR.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  /** Browsers only allow sound after a key press or click, so the intro waits for one. */
  private boot(): void {
    this.mode = 'boot';
    this.hud.screen(T.BOOT_HTML);
    const go = (e: Event) => {
      if (e instanceof KeyboardEvent && ['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
      removeEventListener('keydown', go);
      removeEventListener('pointerdown', go);
      this.sfx.init();
      this.playIntro();
    };
    addEventListener('keydown', go);
    addEventListener('pointerdown', go);
  }

  private playIntro(): void {
    this.mode = 'intro';
    this.hud.hideScreen();
    this.intro = new Intro({ sfx: this.sfx, root: this.root }, () => {
      this.intro = null;
      this.showTitle();
    });
    this.intro.start();
  }

  private showTitle(): void {
    this.mode = 'title';
    this.hud.screen(titleHtml(this.entry.id));
    document.getElementById('startBtn')?.addEventListener('click', () => this.clockIn());
    document.getElementById('introBtn')?.addEventListener('click', () => {
      this.sfx.init();
      this.playIntro();
    });
    document.querySelectorAll<HTMLElement>('.job[data-job]').forEach((el) =>
      el.addEventListener('click', () => {
        const id = el.dataset.job!;
        if (id !== this.entry.id) location.search = `?job=${id}&skipintro`;
      }),
    );
  }

  private clockIn(): void {
    this.sfx.init();
    this.mode = 'ready';
    this.hud.screen('<div class="card"><h2>CLICK TO CLOCK IN</h2><p>Your mouse will be captured. Press Esc to pause.</p></div>');
    this.lock();
  }

  private lock(): void {
    const el = this.renderer.domElement;
    try {
      const p = el.requestPointerLock() as unknown;
      if (p instanceof Promise) p.catch(() => undefined);
    } catch {
      /* the browser wants another click */
    }
  }

  private onLockChange(): void {
    const locked = document.pointerLockElement === this.renderer.domElement;
    if (locked) {
      if (this.mode === 'ready' || this.mode === 'paused') {
        this.mode = 'playing';
        this.hud.hideScreen();
        this.hud.show(true);
        this.lastFrame = performance.now();
        if (!this.started) this.startShift();
      }
    } else if (this.mode === 'playing') {
      this.mode = 'paused';
      this.sfx.stopVoice();
      this.hud.screen(
        '<div class="card"><h2>PAUSED</h2><p>Brad noticed. (Brad did not notice. Click to continue.)</p>' +
          '<div class="actions"><button id="resumeBtn">BACK TO WORK</button><button id="quitBtn" class="secondary">QUIT SHIFT</button></div></div>',
      );
      document.getElementById('resumeBtn')?.addEventListener('click', () => this.lock());
      // Back to the title screen with the job selection.
      document.getElementById('quitBtn')?.addEventListener('click', () => {
        this.setBlur('');
        location.search = `?job=${this.entry.id}&skipintro`;
      });
    }
  }

  private startShift(): void {
    this.started = true;
    this.bossSay('shiftStart', true);
    this.chat('start', {}, 3);
  }

  private end(fired: boolean, reason: string): void {
    if (this.mode === 'ended') return;
    if (fired && this.t < 60) this.achieve('fastFire');
    this.mode = 'ended';
    this.job.onEnd?.(fired);
    bubbles.clear();
    this.setBlur('');
    this.tintCss = '';
    this.applyFilter();
    this.hud.show(false);
    this.hud.progress(null);
    document.exitPointerLock();
    this.hud.screen(
      reviewHtml({
        fired,
        reason,
        t: this.t,
        shiftLen: SHIFT_LEN,
        overtimes: this.overtimes,
        writeUps: this.writeUps,
        counters: this.counters,
        damage: this.damage,
        secretsShift: this.shiftSecrets.length,
        secretsAll: foundSecrets(this.entry.id).filter((id) => id in this.secretTitles).length,
        secretsTotal: Object.keys(this.secretTitles).length,
        peakViewers: this.peakViewers,
        pocket: this.pocket,
        achievements: this.achievements,
        jobRows: this.job.reviewRows(),
        jobPay: this.job.payRows(fired),
        productive: this.job.productive(),
        employeeOfTheMonth: this.job.employeeOfTheMonth?.(this.pocket, fired) ?? 'The Coffee Machine (again)',
      }),
    );
    document.getElementById('againBtn')?.addEventListener('click', () => {
      location.search = `?job=${this.entry.id}&skipintro`;
    });
  }

  private frame(): void {
    const now = performance.now();
    const dt = Math.min((now - this.lastFrame) / 1000, 0.05);
    this.lastFrame = now;
    this.level.tick(now / 1000);
    if (this.mode === 'playing') this.update(dt);
    else if (this.mode === 'intro') this.intro?.update(dt);
    else if (this.mode === 'title' || this.mode === 'boot') {
      this.player.yaw += dt * 0.08;
      this.player.update(0, [], [], 0, 0);
    }
    if (this.mode === 'intro' && this.intro) {
      this.styleR.render(this.intro.scene, this.intro.camera, dt);
      bubbles.update(this.intro.camera, dt);
    } else {
      this.styleR.render(this.scene, this.camera, dt);
      bubbles.update(this.camera, dt);
    }
  }

  // ---------------------------------------------------------------- Shift API for jobs

  count(key: string, n = 1): number {
    this.counters[key] = (this.counters[key] ?? 0) + n;
    return this.counters[key];
  }

  counter(key: string): number {
    return this.counters[key] ?? 0;
  }

  addItem(def: ItemDef, pos: THREE.Vector3, fixed = false): Item {
    const it = new Item(def);
    it.mesh.position.copy(pos);
    it.state = fixed ? 'fixed' : 'world';
    this.scene.add(it.mesh);
    this.items.push(it);
    return it;
  }

  removeItem(it: Item): void {
    if (it === this.held) this.detachHeld();
    if (it.slot) {
      it.slot.item = null;
      it.slot = null;
    }
    it.state = 'gone';
    it.mesh.parent?.remove(it.mesh);
    this.items = this.items.filter((x) => x !== it);
  }

  say(text: string, seconds = 3): void {
    this.hud.say('', text, seconds);
  }

  /** Breaks a breakable at once, with debris and payslip cost (for scripted breaks). */
  breakObject(obj: THREE.Object3D): void {
    const b = obj.userData.breakable as BreakableState | undefined;
    if (!b || b.broken) return;
    b.hp = 1;
    this.hitBreakable(obj, false);
  }

  /** The player found a secret. Each one counts once per shift and is remembered forever. */
  secret(id: string): void {
    if (this.shiftSecrets.includes(id) || this.mode === 'ended') return;
    this.shiftSecrets.push(id);
    const isNew = saveSecret(this.entry.id, id);
    const total = Object.keys(this.secretTitles).length;
    const all = foundSecrets(this.entry.id).filter((s) => s in this.secretTitles).length;
    const title = this.secretTitles[id] ?? 'Something nobody was supposed to find';
    this.hud.toast(isNew ? 'NEW SECRET FOUND' : 'SECRET', `${title} (${all}/${total})`, 'secret');
    this.sfx.fanfare();
    this.hype += isNew ? 12 : 5;
    this.lastEvent = this.t;
    this.chat('secret', {}, 2);
  }

  pickUp(it: Item): void {
    if (it.state === 'shelf' && it.slot) {
      it.slot.item = null;
      it.slot = null;
    }
    if (this.gravityOff > 0 && it.state === 'world' && it.mesh.position.y - it.baseOffset > 0.6) this.secret('eng.float');
    if (!this.items.includes(it)) this.items.push(it);
    this.held = it;
    this.heldTime = 0;
    it.state = 'held';
    it.sleeping = false;
    it.thrown = false;
    it.vel.set(0, 0, 0);
    this.camera.add(it.mesh);
    it.mesh.position.set(...(it.def.holdPos ?? [0.3, -0.28, -0.6]));
    it.mesh.rotation.set(0, it.def.holdRotY ?? -0.3, 0);
    this.sfx.click();
    if (it.def.toiletKey) {
      this.chat('tire');
      this.keyDistance = 0;
    }
    if (it.def.pickupLine) this.say(it.def.pickupLine, 3);
    else if (it.def.shape === 'nothing') this.say('You are holding nothing. The scanner insists it is an item.', 3);
  }

  detachHeld(): Item | null {
    const it = this.held;
    if (!it) return null;
    this.held = null;
    if (this.inspect) {
      this.inspect = null;
      this.hud.progress(null);
    }
    this.camera.remove(it.mesh);
    return it;
  }

  removeHeld(): void {
    const it = this.detachHeld();
    if (!it) return;
    it.state = 'gone';
    this.items = this.items.filter((x) => x !== it);
  }

  writeUp(reason: string): void {
    if (this.pendingEnd) return;
    this.writeUps++;
    this.hud.stamp(`WRITE-UP ${this.writeUps}/3`);
    this.hud.toast('WRITE-UP', reason, 'writeup');
    this.sfx.alarm();
    this.hype += 12;
    this.chat('writeup', {}, 2);
    if (this.writeUps >= 3) this.fire(`Three write-ups. The last one: ${reason}. The algorithm has decided.`);
  }

  fire(reason: string): void {
    if (this.pendingEnd) return;
    this.pendingEnd = { t: 3.5, fired: true, reason };
    this.hud.stamp('FIRED');
    this.chat('fired', {}, 3);
  }

  achieve(id: string): void {
    if (this.achievements.includes(id)) return;
    const a = T.ACHIEVEMENTS[id];
    if (!a) return;
    this.achievements.push(id);
    this.hud.toast(`ACHIEVEMENT: ${a.title}`, a.text);
    this.sfx.fanfare();
  }

  bossSay(key: string, force = false): void {
    if (!this.started) return;
    const lines = this.bossTable[key];
    if (!lines?.length) return;
    const now = this.t;
    if (!force) {
      if (now < this.bossSayCooldown) return;
      if ((this.bossLastSaid[key] ?? -99) > now - 8) return;
    }
    this.bossLastSaid[key] = now;
    this.bossSayCooldown = now + 3;
    const line = pick(lines);
    this.hud.say(T.BOSS_NAME, line, 2 + line.length * 0.035);
    this.sfx.beep();
    this.sfx.say(line, 'boss');
  }

  chat(key: string, vars: Record<string, string> = {}, n = 1): void {
    for (let i = 0; i < n; i++) this.chatQueue.push({ at: this.t + i * 0.7 + rand(0.1, 0.5), key, vars });
    if (key !== 'ambient' && key !== 'bored' && key !== 'hype') this.lastEvent = this.t;
  }

  makePuddle(x: number, z: number, color?: string): void {
    const r = rand(0.5, 0.75);
    const [mat, shineMat] = color ? this.puddleMats(color) : [puddleMat, puddleShine];
    // An irregular puddle with a lighter wet shine and a few splashes around it.
    const g = new THREE.Group();
    g.add(new THREE.Mesh(blobGeometry(r), mat));
    const shine = new THREE.Mesh(blobGeometry(r * 0.45), shineMat);
    shine.position.set(rand(-0.15, 0.15), 0.001, rand(-0.15, 0.15));
    g.add(shine);
    for (let i = 0, n = 3 + Math.floor(Math.random() * 4); i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = r * rand(1.05, 1.6);
      const drop = new THREE.Mesh(blobGeometry(rand(0.03, 0.09), 12), mat);
      drop.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
      g.add(drop);
    }
    g.position.set(x, 0.01 + this.puddles.length * 0.0005, z);
    g.rotation.y = Math.random() * Math.PI * 2;
    this.scene.add(g);
    this.puddles.push({ mesh: g, x, z, r: r * 1.1 });
  }

  private puddleCache = new Map<string, [THREE.Material, THREE.Material]>();

  /** Puddle materials in any color (water, wine, coffee). The default is the classic. */
  private puddleMats(color: string): [THREE.Material, THREE.Material] {
    let m = this.puddleCache.get(color);
    if (!m) {
      const base = new THREE.Color(color);
      const a = puddleMat.clone();
      a.color.copy(base);
      const b = puddleShine.clone();
      b.color.copy(base).lerp(new THREE.Color('#ffffff'), 0.45);
      m = [a, b];
      this.puddleCache.set(color, m);
    }
    return m;
  }

  removePuddle(index: number): void {
    const pd = this.puddles[index];
    if (!pd) return;
    this.scene.remove(pd.mesh);
    pd.mesh.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    this.puddles.splice(index, 1);
  }

  // ---------------------------------------------------------------- input

  private onKey(e: KeyboardEvent): void {
    if (this.mode !== 'playing' || e.repeat) return;
    switch (e.code) {
      case 'KeyE':
        this.interact();
        break;
      case 'KeyK':
        this.kick();
        break;
      case 'KeyG':
        if (this.held && !this.pee) this.drop(true);
        break;
      case 'KeyQ':
        this.pocketHeld();
        break;
      case 'KeyI':
        this.startInspect();
        break;
      case 'KeyP':
        this.startPee();
        break;
      case 'KeyM':
        this.say(this.sfx.toggleMute() ? 'Sound off.' : 'Sound on.', 1.5);
        break;
      case 'KeyV':
        this.say(this.sfx.toggleVoice() ? 'Brad has a voice again. Sorry.' : 'Brad is muted. Brad does not know.', 2);
        break;
    }
  }

  private look(): Look | null {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.raycaster.far = 3.2;
    const objs: THREE.Object3D[] = [...this.level.interactables, ...this.job.lookTargets()];
    for (const it of this.items) if (it.state === 'world' || it.state === 'shelf' || it.state === 'fixed') objs.push(it.mesh);
    const hits = this.raycaster.intersectObjects(objs, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.interact) o = o.parent;
      if (!o) continue;
      const info = o.userData.interact as Interact;
      if (info.kind === 'wall') return null;
      // No reaching through walls.
      if (this.occluded(this.raycaster.ray.origin, h.point)) return null;
      return { info, point: h.point, object: o };
    }
    return null;
  }

  /** True if a wall (an occluding collider) is between the two points. */
  private occluded(a: THREE.Vector3, b: THREE.Vector3): boolean {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    for (const c of this.level.colliders) {
      if (!c.occludes || c.disabled) continue;
      // The thing the target stands in, sits on or hangs on does not count.
      if (b.x > c.minX - 0.25 && b.x < c.maxX + 0.25 && b.z > c.minZ - 0.25 && b.z < c.maxZ + 0.25) continue;
      let t0 = 0;
      let t1 = 1;
      const slab = (o: number, d: number, lo: number, hi: number) => {
        if (Math.abs(d) < 1e-9) return o >= lo && o <= hi;
        let u = (lo - o) / d;
        let v = (hi - o) / d;
        if (u > v) [u, v] = [v, u];
        t0 = Math.max(t0, u);
        t1 = Math.min(t1, v);
        return t0 <= t1;
      };
      if (slab(a.x, dx, c.minX, c.maxX) && slab(a.z, dz, c.minZ, c.maxZ) && slab(a.y, dy, 0, c.h)) return true;
    }
    return false;
  }

  private interact(): void {
    if (this.pee || this.pendingEnd) return;
    const look = this.look();
    if (this.job.interact(look)) return;
    const info = look?.info;
    if (info?.kind === 'beer') return this.drinkBeer();
    if (info?.kind === 'cat') return this.petCat();
    if (this.held) {
      if (info?.kind === 'door') return this.useDoor();
      if (info?.kind === 'toilet') {
        this.say('You consider flushing it. You decide against it. For now.', 2.5);
        return;
      }
      this.drop(false);
      return;
    }
    if (!info) return;
    switch (info.kind) {
      case 'item':
        if (info.item) this.pickUp(info.item);
        break;
      case 'door':
        this.useDoor();
        break;
      case 'toilet':
        this.say('The approved toilet. Press P. Be quick. Brad is counting.', 3);
        break;
      case 'plant':
        this.say(pick(T.PLANT_LINES), 2.5);
        break;
      case 'sign':
        this.say(info.text ?? '', 3);
        break;
    }
  }

  private hintFor(look: Look | null): string {
    if (this.pee) return '';
    const jobHint = this.job.hint(look);
    if (jobHint !== null) return jobHint;
    const info = look?.info;
    const held = this.held;
    if (!info) return held ? `E: drop  ·  G: throw${held.def.pocketable ? '  ·  Q: pocket it' : ''}  ·  I: inspect` : '';
    switch (info.kind) {
      case 'item':
        return held ? 'E: drop' : `E: take ${info.item!.def.name}`;
      case 'door':
        if (this.inBooth()) return 'E: open the door';
        return held?.def.toiletKey ? 'E: unlock the toilet' : 'Locked.';
      case 'toilet':
        return 'P: pee (approved!)';
      case 'plant':
        return 'A plant';
      case 'sign':
        return 'E: read';
      case 'beer':
        return this.drinking ? '' : this.beer.left ? 'E: drink a beer' : 'Empty.';
      case 'cat':
        return 'E: pet the cat';
      case 'breakable':
        return held ? 'E: drop  ·  K: kick' : `A ${String(info.name ?? 'thing')}. It looks fragile.`;
      default:
        return held ? 'E: drop' : '';
    }
  }

  private drop(throwIt: boolean): void {
    const it = this.held;
    if (!it) return;
    const pos = new THREE.Vector3();
    it.mesh.getWorldPosition(pos);
    this.detachHeld();
    this.scene.add(it.mesh);
    it.mesh.position.copy(pos);
    it.mesh.rotation.set(0, this.player.yaw, 0);
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    if (throwIt) {
      it.vel.copy(dir).multiplyScalar(10).add(new THREE.Vector3(0, 1.5, 0));
      it.thrown = true;
      this.count('thrown');
      this.hype += 3;
      this.sfx.whoosh();
    } else {
      it.vel.copy(dir).multiplyScalar(1.2);
    }
    it.vel.x += this.player.vel.x;
    it.vel.z += this.player.vel.z;
    it.state = 'world';
    it.sleeping = false;
  }

  private pocketHeld(): void {
    const it = this.held;
    if (!it || this.pendingEnd || this.pee) return;
    if (!it.def.pocketable) {
      this.say(`The ${it.def.name.toLowerCase()} does not fit in your pocket. You checked twice.`, 2.5);
      return;
    }
    if (it.def.shape === 'nothing') {
      this.removeHeld();
      this.pocket.push(it.def);
      this.say('You pocket nothing. Technically not theft.', 2.5);
      this.chat('stealNothing');
      if (this.seen) this.bossSay('stealNothing', true);
      return;
    }
    this.removeHeld();
    this.pocket.push(it.def);
    if (this.seen) {
      this.boss.confront();
      this.bossSay('stealSeen', true);
      this.fire('Caught putting company property into your human pocket.');
      return;
    }
    if (it === this.golden) {
      this.golden = null;
      this.secret('eng.golden');
    }
    const stolen = this.count('stolen');
    this.hype += 14;
    this.sfx.pocket();
    this.chat('steal', {}, 2);
    this.say(it.def.pocketLine ?? `You pocket the ${it.def.name}. Your trousers bulge suspiciously.`, 3);
    if (stolen >= 5) this.achieve('klepto');
    if (it.def.pocketAchievement) this.achieve(it.def.pocketAchievement);
  }

  // ---------------------------------------------------------------- bodily functions and rules

  private inBooth(): boolean {
    const p = this.player.pos;
    const b = this.level.booth;
    return p.x > b.minX + 0.05 && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ - 0.05;
  }

  private useDoor(): void {
    if (this.inBooth()) {
      this.doorTimer = 4;
      this.say('Leaving is free. Entering costs a key.', 2);
      return;
    }
    const held = this.held;
    if (held?.def.toiletKey) {
      this.doorTimer = 12;
      this.sfx.unlock();
      this.say(`The ${held.def.name.toLowerCase()} works. The door opens with a sigh of disappointment.`, 3);
      if (this.keyDistance > 25 && held.def.carryAchievement) this.achieve(held.def.carryAchievement);
      return;
    }
    this.sfx.buzz();
    this.say(this.job.info.lockedDoor, 3.5);
  }

  private startInspect(): void {
    const it = this.held;
    if (!it || this.inspect || this.pee) return;
    if (it.def.toiletKey) {
      this.say('It is the toilet key. Inspection complete.', 2.5);
      return;
    }
    this.inspect = { item: it, t: 0 };
    this.chat('inspect');
  }

  private startPee(): void {
    if (this.pee || this.pendingEnd) return;
    if (this.bladder < 15) {
      this.say('You do not need to go. HR has been notified that you tried.', 3);
      return;
    }
    const P = this.player.pos;
    if (this.inBooth()) {
      this.pee = { t: 0, dur: 4, toilet: true, knock: 0.8 };
      this.count('toilet');
      this.chat('toilet');
      return;
    }
    this.pee = { t: 0, dur: 2.5, toilet: false, knock: 99 };
    if (this.powerCut > 0) this.secret('eng.darkPee');
    const f = this.player.forward();
    const px = P.x + f.x * 0.6;
    const pz = P.z + f.z * 0.6;
    const plant = this.level.plants.find((pl) => Math.hypot(pl.pos.x - px, pl.pos.z - pz) < 1.6);
    this.sfx.splash();
    this.hype += 15;
    this.count('puddles');
    if (plant) {
      plant.group.scale.multiplyScalar(1.2);
      this.achieve('plant');
      this.chat('plant', {}, 2);
      this.hype += 10;
    } else {
      this.makePuddle(px, pz);
      this.chat('pee', {}, 2);
    }
    if (this.seen) {
      this.boss.confront();
      this.bossSay('peeSeen', true);
      this.writeUp('Unauthorized liquid event');
    }
  }

  // ---------------------------------------------------------------- per frame

  private update(dt: number): void {
    this.t += dt;
    const P = this.player;
    if (this.pendingEnd) {
      this.pendingEnd.t -= dt;
      if (this.pendingEnd.t <= 0) {
        const e = this.pendingEnd;
        this.pendingEnd = null;
        this.end(e.fired, e.reason);
        return;
      }
    }

    let mul = this.held?.def.heavy ?? 1;
    mul *= Math.max(0.5, 1 - this.pocket.length * 0.06);
    if (this.bladder > 75) mul *= 0.85;
    if (this.inspect) mul *= 0.3;
    P.speedMul = mul;
    P.frozen = !!this.pee || !!this.pendingEnd || this.movementLocked;
    const wobble = Math.max(clamp((this.bladder - 70) / 30, 0, 1), clamp(this.drunk / 6, 0, 1));
    const obstacles = this.cat ? [...this.job.obstacles(), this.cat.circle] : this.job.obstacles();
    P.update(dt, this.level.colliders, obstacles, wobble, this.t);
    this.updateDrunk(dt);
    this.updateMischief(dt);

    if (this.doorTimer > 0) this.doorTimer -= dt;
    this.level.updateDoor(dt, this.doorTimer > 0);

    // Fast throws move in small steps, so they cannot tunnel through thin walls.
    let vmax = 0;
    for (const it of this.items) if (it.state === 'world' && !it.sleeping) vmax = Math.max(vmax, it.vel.lengthSq());
    const sub = Math.min(6, Math.max(1, Math.ceil((Math.sqrt(vmax) * dt) / 0.12)));
    for (let i = 0; i < sub; i++) this.updateItems(dt / sub);
    this.boss.update(dt, this.t, P.pos, P.forward());
    this.seen = this.boss.canSee(P.pos, this.level.colliders);
    this.updateHiding(dt);
    if (this.powerCut > 0) this.seen = false;
    this.boss.setSeen(this.seen);
    this.job.update(dt);
    this.updateBladder(dt);
    this.updatePee(dt);
    this.updateInspect(dt);
    this.updateBossMood(dt);
    this.updateHype(dt);
    this.updateShift();

    if (this.held) {
      this.heldTime += dt;
      if (this.heldTime > 60 && !this.held.def.toiletKey) this.achieve('boxCarrier');
      if (this.held.def.toiletKey) this.keyDistance += P.speed * dt;
    }
    this.updateHud(dt);
  }

  private updateItems(dt: number): void {
    const B = this.level.bounds;
    const top = this.level.ceiling;
    const P = this.player;
    for (const it of this.items) {
      if (it.state === 'world' && it.sleeping && P.speed > 0.6) this.pushItem(it);
      if (it.state === 'world' && this.gravityOff > 0 && it !== this.held) {
        it.sleeping = false;
        // Cancel gravity and drift up slowly, with a little bob. At the end it all rains down.
        it.vel.y += 9.8 * dt + (0.22 + Math.sin(this.t * 2 + it.mesh.id) * 0.15 - it.vel.y) * Math.min(1, dt * 2);
        it.vel.x *= 1 - dt * 0.6;
        it.vel.z *= 1 - dt * 0.6;
        it.mesh.rotation.y += dt * 0.5;
      }
      if (it.state !== 'world' || it.sleeping) continue;
      const p = it.mesh.position;
      const prevY = p.y;
      it.vel.y -= 9.8 * dt;
      p.addScaledVector(it.vel, dt);
      const r = 0.12;
      let grounded = false;
      for (const b of this.level.colliders) {
        if (b.disabled) continue;
        if (p.x < b.minX - r || p.x > b.maxX + r || p.z < b.minZ - r || p.z > b.maxZ + r) continue;
        if (p.y - it.baseOffset >= b.h) continue;
        if (prevY - it.baseOffset >= b.h - 0.05) {
          p.y = b.h + it.baseOffset;
          if (it.vel.y < 0) it.vel.y = it.vel.y < -2 ? -it.vel.y * 0.25 : 0;
          grounded = true;
        } else {
          const pens = [p.x - (b.minX - r), b.maxX + r - p.x, p.z - (b.minZ - r), b.maxZ + r - p.z];
          const m = Math.min(...pens);
          if (m === pens[0]) { p.x = b.minX - r; it.vel.x = -Math.abs(it.vel.x) * 0.4; }
          else if (m === pens[1]) { p.x = b.maxX + r; it.vel.x = Math.abs(it.vel.x) * 0.4; }
          else if (m === pens[2]) { p.z = b.minZ - r; it.vel.z = -Math.abs(it.vel.z) * 0.4; }
          else { p.z = b.maxZ + r; it.vel.z = Math.abs(it.vel.z) * 0.4; }
          if (it.thrown) this.sfx.thud();
        }
      }
      if (p.y - it.baseOffset <= 0) {
        p.y = it.baseOffset;
        if (it.vel.y < 0) it.vel.y = it.vel.y < -2 ? -it.vel.y * 0.3 : 0;
        grounded = true;
      }
      if (p.y > top) { p.y = top; it.vel.y = -Math.abs(it.vel.y) * 0.3; }
      if (p.x < B.minX + 0.3) { p.x = B.minX + 0.3; it.vel.x = Math.abs(it.vel.x) * 0.4; }
      if (p.x > B.maxX - 0.3) { p.x = B.maxX - 0.3; it.vel.x = -Math.abs(it.vel.x) * 0.4; }
      if (p.z < B.minZ + 0.3) { p.z = B.minZ + 0.3; it.vel.z = Math.abs(it.vel.z) * 0.4; }
      if (p.z > B.maxZ - 0.3) { p.z = B.maxZ - 0.3; it.vel.z = -Math.abs(it.vel.z) * 0.4; }

      if (grounded) {
        const f = Math.max(0, 1 - 5 * dt);
        it.vel.x *= f;
        it.vel.z *= f;
      }
      const speed = it.vel.length();
      if (!grounded) {
        it.mesh.rotation.x += speed * dt * 1.5;
        it.mesh.rotation.z += speed * dt * 0.7;
      } else if (speed < 0.25) {
        it.mesh.rotation.x = 0;
        it.mesh.rotation.z = 0;
        it.vel.set(0, 0, 0);
        it.sleeping = true;
        it.thrown = false;
      }
      if (it.thrown && speed > 3) this.checkHits(it);
      if (it.thrown && speed > 4) this.checkBreakHits(it, dt);
    }
  }

  private checkHits(it: Item): void {
    if (this.job.thrownHit?.(it)) return;
    const p = it.mesh.position;
    if (!this.boss.offline && p.distanceTo(this.boss.pos) < 0.8) {
      it.vel.multiplyScalar(-0.3);
      it.thrown = false;
      this.sfx.thud();
      this.boss.confront();
      this.bossSay('hitByItem', true);
      this.hype += 30;
      this.chat('hitBoss', {}, 3);
      this.achieve('hitBoss');
      this.writeUp('Assault on management');
    }
  }

  private updateBladder(dt: number): void {
    if (this.pee) return;
    this.bladder += dt * (100 / 150);
    if (this.bladder > 75 && !this.bladderWarned) {
      this.bladderWarned = true;
      this.chat('bladder', {}, 2);
      this.say(this.job.info.bladderWarning, 4);
    }
    if (this.bladder >= 100) {
      this.bladder = 0;
      this.bladderWarned = false;
      this.makePuddle(this.player.pos.x, this.player.pos.z);
      this.count('puddles');
      this.count('accidents');
      this.sfx.splash();
      this.hype += 20;
      this.chat('accident', {}, 2);
      this.bossSay('accident', true);
      this.writeUp('Bladder overflow. The floor sensors noticed.');
    }
  }

  private updatePee(dt: number): void {
    const pee = this.pee;
    if (!pee) return;
    pee.t += dt;
    const left = Math.max(0, pee.dur - pee.t);
    this.hud.progress(pee.toilet ? `Approved relief in progress. Break time left: ${left.toFixed(1)} s` : 'Unauthorized relief in progress...', pee.t / pee.dur);
    if (pee.toilet) {
      pee.knock -= dt;
      if (pee.knock <= 0) {
        pee.knock = 1.3;
        this.sfx.knock();
      }
      if (pee.t > 1.5) this.bossSay('toiletKnock');
    }
    if (pee.t >= pee.dur) {
      this.pee = null;
      this.bladder = 0;
      this.bladderWarned = false;
      this.hud.progress(null);
      if (pee.toilet) this.say('Ahh. Break over. Back to work.', 2.5);
    }
  }

  // ---------------------------------------------------------------- mischief

  /** Walking into things on the floor pushes them along. */
  private pushItem(it: Item): void {
    const P = this.player;
    const p = it.mesh.position;
    if (p.y - it.baseOffset > 0.25 || it.def.toiletKey) return;
    const dx = p.x - P.pos.x;
    const dz = p.z - P.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.5 || d < 0.01) return;
    const k = (P.speed * 1.15) / (it.def.heavy ? 2 : 1);
    it.vel.set((dx / d) * k, 0.4, (dz / d) * k);
    it.sleeping = false;
  }

  private kick(): void {
    if (this.kickCd > 0 || this.pee || this.pendingEnd || this.drinking) return;
    this.kickCd = 0.6;
    this.kickBoot.start();
    this.sfx.whoosh();
    this.count('kicks');
    const P = this.player;
    const fwd = new THREE.Vector3();
    this.camera.getWorldDirection(fwd);

    // Brad flies at head height, so this is a jump kick.
    const toBoss = new THREE.Vector3(this.boss.pos.x - P.pos.x, 0, this.boss.pos.z - P.pos.z);
    const bd = toBoss.length();
    if (!this.boss.offline && bd < 1.9 && fwd.y > -0.35 && toBoss.normalize().dot(new THREE.Vector3(fwd.x, 0, fwd.z).normalize()) > 0.6) {
      this.sfx.thud();
      this.boss.pos.addScaledVector(toBoss, 1.4);
      this.boss.confront();
      this.bossSay('kicked', true);
      this.hype += 30;
      this.chat('hitBoss', {}, 3);
      this.secret('eng.kickBrad');
      this.writeUp('Assault on management. With a foot.');
      return;
    }

    const look = this.look();
    if (this.job.onKick?.(look)) return;
    const near = look && look.point.distanceTo(this.camera.getWorldPosition(new THREE.Vector3())) < 2.2;
    if (!look || !near) {
      if (Math.random() < 0.3) this.say(pick(T.KICK_AIR_LINES), 2);
      return;
    }
    const info = look.info;
    if (info.kind === 'cat' && this.cat) {
      this.cat.dodge();
      this.secret('eng.catDodge');
      this.chat('catKick', {}, 2);
      this.hype += 6;
      return;
    }
    let o: THREE.Object3D | null = look.object;
    while (o && !o.userData.breakable) o = o.parent;
    if (o) return this.hitBreakable(o, false);
    if (info.kind === 'item' && info.item) return this.kickItem(info.item, fwd);
    this.sfx.thud();
    if (Math.random() < 0.5) this.say(pick(T.KICK_WALL_LINES), 2);
  }

  private kickItem(it: Item, fwd: THREE.Vector3): void {
    if (it.state === 'fixed' || it.def.toiletKey) {
      this.sfx.thud();
      this.say(`The ${it.def.name.toLowerCase()} does not move. It is load-bearing now.`, 2.5);
      return;
    }
    if (it.slot) {
      it.slot.item = null;
      it.slot = null;
    }
    const power = it.def.heavy ? 3.5 : 8;
    it.state = 'world';
    it.sleeping = false;
    it.thrown = true;
    it.vel.copy(fwd).setY(0).normalize().multiplyScalar(power).add(new THREE.Vector3(0, power * 0.45, 0));
    this.sfx.thud();
    const n = this.count('kicked');
    this.hype += 4;
    this.lastEvent = this.t;
    if (n === 1 || Math.random() < 0.3) this.chat('kick', {}, 1);
    if (n >= 10) this.achieve('footballer');
    if (this.seen) this.annoyance += 8;
  }

  private hitBreakable(o: THREE.Object3D, thrown: boolean): void {
    const b = o.userData.breakable as BreakableState;
    if (b.broken) return;
    b.hp -= 1;
    this.sfx.thud();
    if (b.hp > 0) {
      o.rotation.z += (Math.random() - 0.5) * 0.08;
      this.say(pick(T.CRACK_LINES).replaceAll('{name}', b.name), 2);
      return;
    }
    b.broken = true;
    const box = new THREE.Box3().setFromObject(o);
    const center = box.getCenter(new THREE.Vector3());
    this.debris.burst(center, b.colors ?? colorsOf(o), 16);
    o.visible = false;
    this.level.interactables = this.level.interactables.filter((x) => x !== o);
    if (b.collider) b.collider.disabled = true;
    this.sfx.smash();
    const n = this.count('broken');
    this.damage += b.price ?? 19.99;
    this.hype += 10;
    this.lastEvent = this.t;
    this.chat('smash', {}, 2);
    this.say(b.line ?? pick(T.SMASH_LINES).replaceAll('{name}', b.name), 3);
    if (n >= 5) this.achieve('vandal');
    if (thrown) this.achieve('sniper');
    b.onBreak?.();
    if (this.seen) {
      this.boss.confront();
      this.bossSay('smashSeen', true);
      this.writeUp(`Vandalism. The ${b.name} had a family.`);
    }
  }

  /** Thrown items break what they hit. */
  private checkBreakHits(it: Item, dt: number): void {
    // Check a few points along the last step, so fast throws do not skip thin targets.
    const steps = [0, 0.25, 0.5, 0.75].map((f) => it.mesh.position.clone().addScaledVector(it.vel, -dt * f));
    const p = it.mesh.position;
    if (this.cat && Math.hypot(p.x - this.cat.pos.x, p.z - this.cat.pos.z) < 0.4 && p.y < 0.6) {
      this.cat.dodge();
      this.secret('eng.catDodge');
    }
    for (const o of this.level.interactables) {
      const b = o.userData.breakable as BreakableState | undefined;
      if (!b || b.broken || !o.visible) continue;
      if (!b.box) b.box = new THREE.Box3().setFromObject(o).expandByScalar(0.12);
      if (!steps.some((q) => b.box!.containsPoint(q))) continue;
      it.vel.multiplyScalar(-0.25);
      it.thrown = false;
      this.hitBreakable(o, true);
      return;
    }
  }

  private petCat(): void {
    if (!this.cat) return;
    this.sfx.tone(300, 0.6, 'sine', 0.05, 280);
    this.cat.say('*purr.wav* (+1 morale)', 2.5);
    this.count('catPets');
    this.hype += 4;
    this.secret('eng.cat');
    this.chat('cat', {}, 1);
    if (this.counter('catPets') >= 5) this.achieve('catPerson');
  }

  private updateHiding(dt: number): void {
    const p = this.player.pos;
    const spot = this.level.hideSpots.find((h) => p.x > h.rect.minX && p.x < h.rect.maxX && p.z > h.rect.minZ && p.z < h.rect.maxZ);
    if (spot?.name !== this.hiding) {
      this.hiding = spot?.name ?? null;
      if (spot) this.say(pick(T.HIDE_LINES).replaceAll('{name}', spot.name), 2.5);
    }
    if (!spot) return;
    if (this.seen) {
      // He would have seen you. He did not.
      if (this.boss.horizontalDist(p) < 7) {
        this.secret('eng.hide');
        this.bossSay('hideSearch');
      }
      this.seen = false;
    }
    this.hideTime += dt;
    if (this.hideTime > 30) this.achieve('hideout');
  }

  /** Two or three surprises per shift, never the same mix. */
  private planEvents(): void {
    const pool = ['power', 'firmware', 'gravity'].sort(() => Math.random() - 0.5).slice(0, 2);
    if (Math.random() < 0.65) pool.push('cat');
    if (Math.random() < 0.6) pool.push('golden');
    let t = rand(35, 70);
    for (const kind of pool.sort(() => Math.random() - 0.5)) {
      this.events.push({ at: t, kind });
      t += rand(40, 75);
    }
  }

  private updateMischief(dt: number): void {
    this.kickCd = Math.max(0, this.kickCd - dt);
    this.kickBoot.update(dt);
    this.debris.update(dt);
    this.cat?.update(dt, this.t);
    const due = this.events.filter((e) => e.at <= this.t);
    if (due.length) {
      this.events = this.events.filter((e) => e.at > this.t);
      for (const e of due) this.startEvent(e.kind);
    }
    if (this.powerCut > 0) {
      this.powerCut -= dt;
      if (this.powerCut <= 0) {
        this.styleR.lightScale = 1;
        this.tintCss = '';
        this.applyFilter();
        this.say('The lights come back. Brad comes back. Everything comes back.', 3);
      }
    }
    if (this.gravityOff > 0) {
      this.gravityOff -= dt;
      if (this.gravityOff <= 0) this.say('Gravity is back. Thank you for your patience.', 2.5);
    }
  }

  private startEvent(kind: string): void {
    switch (kind) {
      case 'power':
        this.powerCut = 22;
        this.styleR.lightScale = 0.12;
        this.tintCss = 'sepia(0.7) hue-rotate(-35deg) saturate(2.4)';
        this.applyFilter();
        this.sfx.buzz();
        this.hud.toast('POWER SAVING MODE', 'Light is now a premium feature. Brad runs on the same circuit.', 'corp');
        this.chat('power', {}, 1);
        break;
      case 'firmware':
        if (this.boss.offline) return;
        this.boss.firmwareUpdate(30);
        this.hud.toast('BRAD IS UPDATING', 'Installing update 1 of 347. Do not turn off your supervisor.', 'corp');
        this.chat('firmware', {}, 1);
        break;
      case 'gravity': {
        this.gravityOff = 14;
        // Some neatly placed things float off too. The job is never done.
        // Only the engine's shelf slots. Jobs with their own shelf logic keep their things.
        const placed = this.items.filter((i) => i.state === 'shelf' && i.slot).sort(() => Math.random() - 0.5).slice(0, 10);
        for (const it of placed) {
          if (it.slot) {
            it.slot.item = null;
            it.slot = null;
          }
          const p = new THREE.Vector3();
          it.mesh.getWorldPosition(p);
          this.scene.attach(it.mesh);
          it.state = 'world';
          it.vel.set(rand(-0.3, 0.3), rand(0.5, 1.2), rand(-0.3, 0.3));
        }
        this.hud.toast('GRAVITY MAINTENANCE', 'Gravity is being recalibrated. Please hold on to your items.', 'corp');
        this.chat('gravity', {}, 1);
        break;
      }
      case 'cat': {
        const start = this.nav.snap(this.level.spawn.pos.clone().add(new THREE.Vector3(rand(-6, 6), 0, rand(-6, 6))));
        this.cat = new OfficeCat(this.scene, this.nav, this.level.bounds, start);
        this.level.interactables.push(this.cat.group);
        this.cat.say('meow.exe has entered the building', 3);
        this.chat('cat', {}, 1);
        break;
      }
      case 'golden': {
        const pool = this.items.filter((i) => (i.state === 'world' || i.state === 'shelf') && i.def.pocketable && !i.def.toiletKey);
        const it = pool[Math.floor(Math.random() * pool.length)];
        if (!it) return;
        this.golden = it;
        const gold = new THREE.MeshStandardMaterial({ color: '#ffd24a', emissive: '#8a5a00', emissiveIntensity: 0.6, metalness: 0.8, roughness: 0.25 });
        it.mesh.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = gold;
        });
        this.chat('golden', {}, 1);
        break;
      }
    }
  }

  private applyFilter(): void {
    const css = [this.blurCss, this.tintCss].filter(Boolean).join(' ');
    this.renderer.domElement.style.filter = css;
  }

  // ---------------------------------------------------------------- beer

  private drinkBeer(): void {
    if (this.drinking || this.pee || this.pendingEnd) return;
    if (!this.beer.take()) {
      this.say(`An empty crate. Someone drank all ${BEERS_PER_CRATE}. It was you.`, 3);
      return;
    }
    const bottle = bottleMesh();
    bottle.position.set(0.16, -0.32, -0.42);
    this.camera.add(bottle);
    this.drinking = { t: 0, bottle };
    this.sfx.clink();
    this.sfx.glug();
    if (this.seen) {
      this.boss.confront();
      this.bossSay('beerSeen', true);
      this.writeUp('Drinking on shift. Brad smelled it with a sensor he did not know he had.');
    }
  }

  private finishBeer(): void {
    const n = this.count('beers');
    this.drunk += 1;
    this.bladder = Math.min(99, this.bladder + 14);
    this.hype += 8;
    this.lastEvent = this.t;
    const lines = T.BEER_LINES;
    this.say(lines[Math.min(n - 1, lines.length - 1)], 3.5);
    this.chat(this.drunk >= 4 ? 'drunk' : 'beer', {}, 2);
    if (n >= 5) this.achieve('happyHour');
    if (!this.beer.left) this.achieve('emptyCrate');
    if (this.drunk >= 8) {
      this.count('passedOut');
      this.achieve('passedOut');
      this.fire('You fell asleep next to the beer crate. 40,000 robots watched you snore. Brad calls it quiet quitting.');
    }
  }

  /** The more beer, the blurrier and swayier the world. */
  private updateDrunk(dt: number): void {
    const d = this.drinking;
    if (d) {
      d.t += dt;
      const DUR = 1.7;
      const up = clamp(d.t / 0.35, 0, 1);
      const down = clamp((DUR - d.t) / 0.3, 0, 1);
      const k = Math.min(up, down);
      // From the lower right up to the mouth, bottom of the bottle to the sky.
      d.bottle.position.set(0.2 - 0.18 * k, -0.36 + 0.34 * k, -0.42 + 0.15 * k);
      d.bottle.rotation.x = 0.3 + k * (1.6 + 0.3 * clamp((d.t - 0.35) / 1.2, 0, 1));
      if (d.t >= DUR) {
        d.bottle.parent?.remove(d.bottle);
        this.drinking = null;
        this.finishBeer();
      }
    }
    this.drunk = Math.max(0, this.drunk - dt / 60);
    const k = Math.min(this.drunk, 8);
    if (k > 0.02) {
      const t = this.t;
      const cam = this.camera.rotation;
      cam.z += Math.sin(t * 1.3) * 0.012 * k;
      cam.y += Math.sin(t * 0.71) * 0.008 * k;
      cam.x += Math.sin(t * 0.53 + 1) * 0.005 * k;
    }
    const px = (0.35 * k + 0.08 * k * k) * (0.85 + 0.15 * Math.sin(this.t * 1.9));
    this.setBlur(px >= 0.1 ? `blur(${px.toFixed(1)}px)` : '');
  }

  private setBlur(css: string): void {
    if (css === this.blurCss) return;
    this.blurCss = css;
    this.applyFilter();
  }

  private updateInspect(dt: number): void {
    const ins = this.inspect;
    if (!ins) return;
    if (this.held !== ins.item) {
      this.inspect = null;
      this.hud.progress(null);
      return;
    }
    ins.t += dt;
    const dur = 8;
    const steps = T.INSPECT_STEPS;
    const step = Math.min(steps.length - 1, Math.floor((ins.t / dur) * steps.length));
    this.hud.progress(`Regulation 4.2.1 inspection: ${steps[step]}...`, ins.t / dur);
    ins.item.mesh.rotation.set(Math.sin(ins.t * 2) * 0.4, (ins.item.def.holdRotY ?? -0.3) + Math.sin(ins.t * 3) * 0.8, 0);
    if (this.seen) {
      this.boss.frustration += dt * 15;
      this.bossSay('inspectSeen');
    }
    if (ins.t >= dur) {
      ins.item.inspected = true;
      ins.item.mesh.rotation.set(0, ins.item.def.holdRotY ?? -0.3, 0);
      this.inspect = null;
      this.hud.progress(null);
      this.count('inspected');
      this.sfx.ding();
      this.say('Item certified. Eight seconds well spent.', 2.5);
    }
  }

  private updateBossMood(dt: number): void {
    const P = this.player;
    const idle = !this.held && P.speed < 0.3 && !this.pee && !this.inspect && !this.movementLocked;
    this.idleTime = idle ? this.idleTime + dt : 0;
    if (this.seen && this.idleTime > 3) {
      this.annoyance += dt * 18;
      this.bossSay('idle');
    }
    this.annoyance = Math.max(0, this.annoyance - dt * 1.5);
    if (this.annoyance >= 100) {
      this.annoyance = 40;
      this.boss.confront();
      this.bossSay('annoyed', true);
      this.writeUp('Accumulated managerial disappointment');
    }
    if (!this.boss.offline) this.boss.frustration = Math.max(0, this.boss.frustration - dt * 2);
    if (!this.boss.offline && this.boss.frustration >= 100) {
      this.boss.overheat();
      this.count('overheats');
      this.hype += 30;
      this.sfx.overheat();
      this.achieve('compliance');
      this.chat('overheat', {}, 3);
    }
    const stolen = this.pocket.filter((d) => d.shape !== 'nothing').length;
    if (this.seen && stolen >= 3 && this.boss.horizontalDist(P.pos) < 3.5 && Math.random() < dt * 0.05 * stolen) {
      this.bossSay('pocketCheck', true);
      this.fire('Brad noticed your pockets. They were bulging at an unprofessional level.');
    }
    if (this.boss.state === 'micromanage' && Math.random() < dt * 0.15) this.chat('micromanage');
    if (this.seen && this.drunk >= 3 && this.boss.horizontalDist(P.pos) < 4 && Math.random() < dt * 0.08) {
      this.bossSay('drunkSeen');
      this.annoyance += 20;
    }

    // Brad hates things lying on the floor, no matter who put them there.
    this.messyCheck -= dt;
    if (this.messyCheck <= 0) {
      this.messyCheck = 6;
      const floor = this.items.filter((i) => i.state === 'world' && i.sleeping && i.mesh.position.y < 0.6 && !i.def.fixture);
      const visible = floor.filter((i) => this.boss.canSee(i.mesh.position, this.level.colliders)).length;
      if (visible >= 2) {
        this.annoyance += 5 * visible;
        this.bossSay('messy');
        if (Math.random() < 0.4) this.chat('messy');
      }
    }
  }

  private updateHype(dt: number): void {
    this.hype = clamp(this.hype - dt * 0.9, 0, 100);
    const target = 300 + Math.pow(this.hype, 1.5) * 25 + Math.sin(this.t * 0.7) * 40;
    this.viewers += (target - this.viewers) * Math.min(1, dt * 0.8);
    this.peakViewers = Math.max(this.peakViewers, this.viewers);

    this.lowHypeTime = this.hype < 10 ? this.lowHypeTime + dt : 0;
    if (this.lowHypeTime > 30 && this.t > this.corporateCooldown) {
      this.corporateCooldown = this.t + 60;
      this.hud.toast('MESSAGE FROM CORPORATE', pick(T.CORPORATE_LINES), 'corp');
    }

    this.nextChat -= dt;
    if (this.nextChat <= 0) {
      this.nextChat = rand(3, 7);
      this.chat(this.hype > 45 ? 'hype' : this.t - this.lastEvent > 15 ? 'bored' : 'ambient');
    }
    this.chatQueue = this.chatQueue.filter((c) => {
      if (c.at > this.t) return true;
      const lines = T.CHAT_LINES[c.key];
      if (lines) {
        // Avoid the same robot or the same line twice in a row.
        let line = pick(lines);
        for (let i = 0; i < 4 && this.recentChat.includes(line); i++) line = pick(lines);
        let user = pick(T.CHAT_USERS);
        if (user === this.lastChatUser) user = pick(T.CHAT_USERS);
        this.recentChat = [line, ...this.recentChat].slice(0, 6);
        this.lastChatUser = user;
        this.hud.chat(user, fill(line, c.vars));
        this.sfx.pop();
      }
      return false;
    });
  }

  private updateShift(): void {
    if (this.pendingEnd) return;
    const endT = SHIFT_LEN + this.overtimes * OVERTIME;
    if (this.t < endT) return;
    if (this.overtimes < 2) {
      this.overtimes++;
      this.boss.confront();
      this.bossSay('overtime', true);
      this.chat('overtime', {}, 2);
      if (this.overtimes === 2) this.achieve('teamPlayer');
      return;
    }
    const stolen = this.pocket.filter((d) => d.shape !== 'nothing');
    const caught = stolen.some(() => Math.random() < 0.3);
    if (caught) {
      this.end(true, `The exit scanner found ${stolen.length} item(s) in your human pockets. Brad is "disappointed but not surprised".`);
    } else if (stolen.length) {
      this.end(false, `The exit scanner beeped, but Brad was busy updating his motivational quotes. You walk out with ${stolen.length} item(s).`);
    } else {
      this.end(false, 'You survived the shift. Brad says "see you tomorrow". It sounded like a threat.');
    }
  }

  private clockString(): string {
    const mins = (this.job.info.startHour ?? 9) * 60 + (this.t / SHIFT_LEN) * 480;
    const h = Math.floor(mins / 60) % 24;
    const m = Math.floor(mins % 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  private updateHud(dt: number): void {
    const h = this.hud;
    h.tick(dt);
    h.text('clock', this.clockString() + (this.overtimes ? '  OVERTIME' : ''));
    const q = this.job.quota();
    h.bar('prodBar', q.done / q.target);
    h.text('prodVal', `${q.done}/${q.target}`);
    h.bar('annoyBar', this.annoyance / 100);
    h.bar('tempBar', this.boss.frustration / 100);
    h.bar('bladderBar', this.bladder / 100);
    h.vignette(this.bladder);
    h.writeUps(this.writeUps);
    h.watching(this.seen);
    h.text('filming', this.job.cameraLabel?.() ?? '');
    h.text('viewers', Math.round(this.viewers).toLocaleString('en-US'));
    const stolen = this.pocket.length;
    h.text('pocket', stolen ? `POCKETS: ${stolen} item(s), bulging` : '');
    const held = this.held;
    h.text('holding', held ? `Holding: ${held.def.name}${this.job.heldLabel?.(held) ?? ''}${held.inspected ? ' (certified)' : ''}` : '');
    h.text('hint', this.hintFor(this.look()));
  }
}

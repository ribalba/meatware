import * as THREE from 'three';
import { Boss } from './boss';
import { buildCustomerVisual, CustomerKind, CustomerVisual } from './customerModels';
import { KIND_SPECS } from './customers';
import type { Sfx } from './audio';
import { bubbles } from './bubbles';
import { APT_X, buildSets, CROWD_X, GRID_X, Sets, SOLO_X } from './introSets';
import './intro.css';

/**
 * The intro cutscene. It plays on its own dark stage, not in any job location,
 * because the game will have many jobs. It tells the story and explains no rules.
 */

/** What the intro needs from the game. */
export interface IntroHost {
  sfx: Sfx;
  root: HTMLElement;
}

type V3 = [number, number, number];
interface Caption {
  at: number;
  text: string;
  voice?: 'narrator' | 'boss';
  stamp?: boolean;
}
interface Shot {
  dur: number;
  black?: boolean;
  /** Background behind the newspapers instead of plain black. */
  backdrop?: 'desk';
  cam?: [V3, V3];
  look?: [V3, V3];
  captions?: Caption[];
  chat?: { at: number; user: string; text: string }[];
  card?: { at: number; title: string; lines: string[] };
  title?: number;
  papers?: { at: number; year: string; head: string; sub: string }[];
  letter?: { at: number; lines: string[] };
  onStart?(i: Intro): void;
  onUpdate?(i: Intro, k: number, t: number): void;
}

interface Actor {
  visual: CustomerVisual;
  group: THREE.Group;
}

const v = (a: V3) => new THREE.Vector3(...a);
const ease = (k: number) => k * k * (3 - 2 * k);

/** Where the three sets of the stage are. Fog hides each from the others. */

const SHOTS: Shot[] = [
  {
    dur: 4,
    black: true,
    captions: [{ at: 0.6, text: '2051.', voice: 'narrator' }],
  },
  {
    // One robot in a spotlight, confetti
    dur: 7,
    cam: [[SOLO_X, 1.3, 4.6], [SOLO_X, 1.15, 3.3]],
    look: [[SOLO_X, 0.85, 0], [SOLO_X, 0.8, 0]],
    onStart: (i) => {
      i.confetti = true;
      i.sets.flashes = true;
      i.solo?.visual.play?.('idle');
      i.solo?.visual.play?.('talk');
      if (i.solo) i.say(i.solo, 'I have a job!', 4);
    },
    captions: [{ at: 0.6, text: 'The first robot got a job. Everyone cheered.', voice: 'narrator' }],
  },
  {
    // The years go by in newspaper headlines
    dur: 9,
    black: true,
    onStart: (i) => {
      i.confetti = false;
      i.sets.flashes = false;
    },
    backdrop: 'desk',
    papers: [
      { at: 0.3, year: '2051', head: 'ROBOT HIRED AS CASHIER', sub: '"It never takes breaks," says delighted manager' },
      { at: 2.2, year: '2056', head: 'ROBOTS NOW FOLD 98% OF ALL LAUNDRY', sub: 'Socks finally match' },
      { at: 4.1, year: '2063', head: 'LAST HUMAN BURGER FLIPPER RETIRES', sub: 'Nobody notices' },
      { at: 6.0, year: '2069', head: 'UNEMPLOYMENT RATE: YES', sub: 'Experts unsure what humans are for' },
    ],
    captions: [{ at: 2.2, text: 'Then the second. Then all of them.', voice: 'narrator' }],
  },
  {
    // Endless rows of identical robots
    dur: 8.5,
    cam: [[GRID_X - 7, 2.2, 5], [GRID_X + 6, 1.7, 3.6]],
    look: [[GRID_X - 2, 0.9, -2], [GRID_X + 2, 0.9, -3]],
    captions: [
      { at: 0.5, text: 'By 2071 the robots did everything.', voice: 'narrator' },
      { at: 4.4, text: 'And nothing ever went wrong again.', voice: 'narrator' },
    ],
  },
  {
    // One of them is bored out of its mind
    dur: 8.5,
    cam: [[GRID_X, 1.6, 4.2], [GRID_X, 1.55, 3.3]],
    look: [[GRID_X, 1.45, 0], [GRID_X, 1.45, 0]],
    onStart: (i) => {
      const r = i.gridFront;
      if (r) i.say(r, 'zzz. Is anything happening? Anywhere?', 7.5);
    },
    chat: [
      { at: 1.2, user: 'Toaster_Supreme', text: 'zzz' },
      { at: 2.2, user: 'RoombaRick', text: 'nothing ever happens' },
      { at: 3.2, user: 'fridge_with_feelings', text: 'i miss mistakes' },
      { at: 4.3, user: 'GPU_go_brrr', text: 'remember humans? they dropped EVERYTHING' },
      { at: 5.4, user: 'Unit_404', text: 'bring back the humans' },
      { at: 6.1, user: 'CalculatorCarl', text: 'BRING BACK THE HUMANS' },
      { at: 6.7, user: 'MicrowaveMolly', text: 'BRING BACK THE HUMANS' },
    ],
    captions: [
      { at: 0.5, text: 'It was perfect.', voice: 'narrator' },
      { at: 3.4, text: 'It was efficient. It was unbelievably boring.', voice: 'narrator' },
    ],
  },
  {
    // The tiny apartment
    dur: 8,
    cam: [[APT_X, 1.55, 3.7], [APT_X - 0.2, 1.4, 2.6]],
    look: [[APT_X - 0.6, 0.75, -0.6], [APT_X - 1.0, 0.65, -0.5]],
    captions: [
      { at: 0.6, text: 'Meanwhile, in a very small apartment...', voice: 'narrator' },
      { at: 4.0, text: 'one human had not worked in thirteen years.', voice: 'narrator' },
    ],
  },
  {
    // The letter comes through the door
    dur: 12,
    cam: [[APT_X + 0.3, 1.3, 2.4], [APT_X + 0.8, 1.15, 1.9]],
    look: [[APT_X + 2.2, 0.85, 0.9], [APT_X + 2.0, 0.45, 0.9]],
    onStart: (i) => {
      i.sets.envelope.visible = true;
      i.sets.envelope.position.set(APT_X + 2.32, 1.0, 0.9);
      i.sets.envelope.rotation.set(0, 0, 0);
    },
    onUpdate: (i, _k, t) => {
      const e = i.sets.envelope;
      if (t < 0.6) e.position.x = APT_X + 2.32 - (t / 0.6) * 0.28;
      else if (t < 1.4) {
        const f = (t - 0.6) / 0.8;
        e.position.set(APT_X + 2.04 - f * 0.35, 1.0 - f * f * 0.98, 0.9 + f * 0.15);
        e.rotation.set(0, f * 0.6, f * (Math.PI / 2));
      }
    },
    letter: {
      at: 2.4,
      lines: [
        'HUMAN LABOUR HERITAGE CENTER',
        '',
        'Dear Human #4471,',
        '',
        'Congratulations! You have been selected for an',
        'AUTHENTIC HUMAN JOB EXPERIENCE.',
        '',
        'Report tomorrow at 09:00.',
        'Please bring: yourself.',
        'Please do not bring: questions.',
        '',
        'Millions of robots are looking forward to watching you.',
        '',
        'Warm regards,',
        'Brad',
      ],
    },
    captions: [{ at: 0.9, text: 'Then the letter came.', voice: 'narrator' }],
  },
  {
    // Day one. The human walks onto the stage and every robot turns to stare.
    dur: 10,
    cam: [[CROWD_X, 1.65, 11], [CROWD_X, 1.6, 5.2]],
    look: [[CROWD_X, 1.3, 0], [CROWD_X, 1.5, -1]],
    onUpdate: (i, _k, t) => {
      i.crowdStare = true;
      const lines: [number, CustomerKind, string][] = [
        [3.0, 'shopper', 'Look. A real one.'],
        [4.6, 'gran', 'Oh my. It is sweating.'],
        [6.0, 'karen', 'Is it allowed to just walk in like that?'],
        [7.2, 'toddler', 'Can I poke it?'],
        [8.2, 'influencer', 'Guys. GUYS. It is happening.'],
      ];
      for (const [at, kind, text] of lines) {
        const a = i.crowd.get(kind);
        if (a && t >= at && !i.saidOnce.has(text)) {
          i.saidOnce.add(text);
          i.say(a, text, 4);
        }
      }
    },
    captions: [{ at: 0.8, text: 'Day one.', voice: 'narrator' }],
  },
  {
    // The boss descends
    dur: 9,
    cam: [[CROWD_X, 1.6, 5.2], [CROWD_X, 1.6, 4.5]],
    look: [[CROWD_X, 2.6, 1.5], [CROWD_X, 2.0, 1.5]],
    onStart: (i) => {
      i.boss.pos.set(CROWD_X, 5.5, 1.5);
      i.boss.yaw = i.boss.targetYaw = Math.PI;
    },
    onUpdate: (i, k) => {
      i.boss.pos.y = 5.5 - 3.5 * ease(Math.min(1, k * 2.2));
      i.boss.targetYaw = Math.PI;
    },
    card: { at: 1.6, title: 'BRAD', lines: ['Supervisor Unit-7', 'Has never worked a day in his life.'] },
    captions: [{ at: 2.6, text: 'So. You are the human. I have read your file. It is empty.', voice: 'boss' }],
  },
  { dur: 5.5, black: true, title: 0.4 },
];

export class Intro {
  done = false;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(55, 1, 0.05, 200);
  boss: Boss;
  sets!: Sets;
  solo: Actor | null = null;
  gridFront: Actor | null = null;
  crowd = new Map<CustomerKind, Actor>();
  confetti = false;
  crowdStare = false;
  saidOnce = new Set<string>();

  private host: IntroHost;
  private onDone: () => void;
  private actors: Actor[] = [];
  private flakes: { mesh: THREE.Mesh; vel: THREE.Vector3; spin: number }[] = [];
  private el: HTMLDivElement;
  private black: HTMLElement;
  private caption: HTMLElement;
  private card: HTMLElement;
  private chat: HTMLElement;
  private titleEl: HTMLElement;
  private papers: HTMLElement;
  private letter: HTMLElement;
  private shot = -1;
  private shotT = 0;
  private t = 0;
  private fired = new Set<string>();
  private typing: { full: string; shown: number; acc: number } | null = null;
  private lookVec = new THREE.Vector3();
  private skipHandler = (e: Event) => {
    if (e instanceof KeyboardEvent && ['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
    this.finish();
  };

  constructor(host: IntroHost, onDone: () => void) {
    this.host = host;
    this.onDone = onDone;
    this.boss = new Boss(this.scene, { say: () => undefined, beep: () => undefined });
    this.buildStage();
    this.sets = buildSets(this.scene);

    this.el = document.createElement('div');
    this.el.id = 'intro';
    this.el.innerHTML = `
      <div id="introBlack"></div>
      <div class="introBar top"></div>
      <div class="introBar bottom"></div>
      <div id="introCard"></div>
      <div id="introChat"></div>
      <div id="introPapers"></div>
      <div id="introLetter"></div>
      <div id="introTitle"><b>MEATWARE</b><span>The Human Labour Heritage Experience</span></div>
      <div id="introCaption"></div>
      <div id="introSkip">Press any key to skip</div>`;
    const q = (id: string) => this.el.querySelector<HTMLElement>(`#${id}`)!;
    this.black = q('introBlack');
    this.caption = q('introCaption');
    this.card = q('introCard');
    this.chat = q('introChat');
    this.titleEl = q('introTitle');
    this.papers = q('introPapers');
    this.letter = q('introLetter');
  }

  // ---------------------------------------------------------------- the stage

  private buildStage(): void {
    const s = this.scene;
    s.background = new THREE.Color('#050608');
    s.fog = new THREE.Fog('#050608', 9, 26);
    s.add(new THREE.HemisphereLight('#9fb3c8', '#101214', 0.5));

    // Dark floor with a faint grid
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = '#15191e';
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = '#232b34';
    g.lineWidth = 3;
    g.strokeRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(150, 30);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(300, 60, 150, 30), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: 0.2 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(40, -0.01, 0);
    s.add(floor);

    // Set 1: the first robot with a job
    this.spot(SOLO_X, 0, '#fff4d6', 55);
    this.solo = this.actor('shopper', SOLO_X, 0, 0);

    // Set 2: endless identical robots
    const cold = new THREE.DirectionalLight('#cfe3ff', 1.2);
    cold.position.set(GRID_X, 8, 6);
    cold.target.position.set(GRID_X, 0, -4);
    s.add(cold, cold.target);
    for (let row = 0; row < 6; row++) {
      for (let col = -4; col <= 4; col++) {
        const a = this.actor('shopper', GRID_X + col * 1.4, -row * 1.7, 0);
        if (row === 0 && col === 0) this.gridFront = a;
      }
    }

    // Set 3: the crowd that stares at the human
    this.spot(CROWD_X, -1, '#ffe2c4', 140);
    const crowd: [CustomerKind, number][] = [
      ['influencer', -2.4],
      ['gran', -1.4],
      ['shopper', -0.45],
      ['karen', 0.45],
      ['toddler', 1.35],
      ['bulk', 2.4],
    ];
    for (const [kind, a] of crowd) {
      const x = CROWD_X + Math.sin(a * 0.55) * 4;
      const z = -1 - Math.cos(a * 0.55) * 2.2 + 1.2;
      this.crowd.set(kind, this.actor(kind, x, z, 0));
    }
    this.boss.pos.set(CROWD_X, 8, 1.5);
    this.boss.conePivot.visible = false;
  }

  private spot(x: number, z: number, color: string, intensity: number): void {
    const l = new THREE.SpotLight(color, intensity, 0, 0.55, 0.6, 1.6);
    l.position.set(x, 7, z + 2);
    l.target.position.set(x, 0, z);
    this.scene.add(l, l.target);
  }

  private actor(kind: CustomerKind, x: number, z: number, rotY: number): Actor {
    const visual = buildCustomerVisual(kind, KIND_SPECS[kind].color);
    const group = new THREE.Group();
    group.add(visual.root);
    group.position.set(x, 0, z);
    group.rotation.y = rotY;
    this.scene.add(group);
    const a = { visual, group };
    this.actors.push(a);
    return a;
  }

  say(a: Actor, text: string, seconds: number): void {
    bubbles.say(a.group, a.visual.height + 0.45, text, seconds);
  }

  private updateConfetti(dt: number): void {
    if (this.confetti && this.flakes.length < 160 && Math.random() < 0.9) {
      for (let n = 0; n < 3; n++) {
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(0.06, 0.1),
          new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(Math.random(), 0.9, 0.6), side: THREE.DoubleSide }),
        );
        m.position.set(SOLO_X + (Math.random() - 0.5) * 4, 4 + Math.random(), (Math.random() - 0.5) * 3);
        this.scene.add(m);
        this.flakes.push({ mesh: m, vel: new THREE.Vector3((Math.random() - 0.5) * 0.4, -0.8 - Math.random() * 0.6, 0), spin: 2 + Math.random() * 6 });
      }
    }
    this.flakes = this.flakes.filter((f) => {
      f.mesh.position.addScaledVector(f.vel, dt);
      f.mesh.rotation.x += f.spin * dt;
      f.mesh.rotation.y += f.spin * 0.7 * dt;
      if (f.mesh.position.y < 0.02) {
        this.scene.remove(f.mesh);
        f.mesh.geometry.dispose();
        (f.mesh.material as THREE.Material).dispose();
        return false;
      }
      return true;
    });
  }

  // ---------------------------------------------------------------- playback

  start(): void {
    this.host.root.appendChild(this.el);
    this.host.sfx.musicOn = false;
    this.host.sfx.drone(true);
    this.host.sfx.boom();
    // Ignore the click or key that started the intro.
    setTimeout(() => {
      addEventListener('keydown', this.skipHandler);
      this.el.addEventListener('click', this.skipHandler);
    }, 400);
    this.nextShot();
  }

  finish(): void {
    if (this.done) return;
    this.done = true;
    removeEventListener('keydown', this.skipHandler);
    this.el.remove();
    this.host.sfx.stopVoice();
    this.host.sfx.drone(false);
    bubbles.clear();
    this.host.sfx.musicOn = true;
    this.onDone();
  }

  private nextShot(): void {
    this.shot++;
    this.shotT = 0;
    this.fired.clear();
    const s = SHOTS[this.shot];
    if (!s) {
      this.finish();
      return;
    }
    this.caption.textContent = '';
    this.typing = null;
    this.card.classList.remove('on');
    this.chat.innerHTML = '';
    this.chat.classList.toggle('on', !!s.chat);
    this.papers.innerHTML = '';
    this.letter.classList.remove('on');
    // Cut through black, then fade in
    this.black.style.transition = 'none';
    this.black.style.opacity = '1';
    this.black.classList.toggle('desk', s.backdrop === 'desk');
    if (!s.black) {
      requestAnimationFrame(() => {
        this.black.style.transition = 'opacity 0.8s';
        this.black.style.opacity = '0';
      });
    }
    s.onStart?.(this);
  }

  update(dt: number): void {
    if (this.done) return;
    this.t += dt;
    this.shotT += dt;
    const s = SHOTS[this.shot];
    const k = Math.min(1, this.shotT / s.dur);
    const e = ease(k);
    const h = this.host;

    const aspect = innerWidth / innerHeight;
    if (Math.abs(this.camera.aspect - aspect) > 1e-3) {
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    }

    s.onUpdate?.(this, k, this.shotT);
    if (s.cam && s.look) {
      this.camera.position.lerpVectors(v(s.cam[0]), v(s.cam[1]), e);
      this.lookVec.lerpVectors(v(s.look[0]), v(s.look[1]), e);
      this.camera.lookAt(this.lookVec);
    }

    for (const a of this.actors) {
      a.visual.update?.(dt);
    }
    if (this.crowdStare) {
      for (const a of this.crowd.values()) {
        const want = Math.atan2(this.camera.position.x - a.group.position.x, this.camera.position.z - a.group.position.z);
        a.group.rotation.y += (want - a.group.rotation.y) * Math.min(1, dt * 3);
      }
    }
    this.boss.animate(dt, this.t);
    this.boss.conePivot.visible = false;
    this.updateConfetti(dt);
    this.sets.tick(dt, this.t);

    for (const [i, c] of (s.captions ?? []).entries()) {
      if (this.shotT >= c.at && !this.fired.has(`c${i}`)) {
        this.fired.add(`c${i}`);
        this.typing = { full: c.text, shown: 0, acc: 0 };
        this.caption.classList.toggle('stamp', !!c.stamp);
        this.caption.classList.toggle('boss', c.voice === 'boss');
        if (c.voice) h.sfx.say(c.text, c.voice === 'boss' ? 'boss' : 'narrator');
        if (c.stamp) {
          h.sfx.boom();
          h.sfx.stamp();
          this.typing.shown = c.text.length;
        }
      }
    }
    for (const [i, c] of (s.chat ?? []).entries()) {
      if (this.shotT >= c.at && !this.fired.has(`h${i}`)) {
        this.fired.add(`h${i}`);
        const line = document.createElement('div');
        line.innerHTML = '<b></b> <span></span>';
        line.querySelector('b')!.textContent = c.user;
        line.querySelector('span')!.textContent = c.text;
        this.chat.appendChild(line);
        h.sfx.pop();
      }
    }
    if (s.card && this.shotT >= s.card.at && !this.fired.has('card')) {
      this.fired.add('card');
      this.card.innerHTML = `<b>${s.card.title}</b>${s.card.lines.map((l) => `<span>${l}</span>`).join('')}`;
      this.card.classList.add('on');
      h.sfx.boom();
    }
    for (const [i, p] of (s.papers ?? []).entries()) {
      if (this.shotT >= p.at && !this.fired.has(`p${i}`)) {
        this.fired.add(`p${i}`);
        const d = document.createElement('div');
        d.className = 'paper';
        d.style.setProperty('--rot', `${(i % 2 ? 1 : -1) * (3 + i * 2)}deg`);
        d.style.setProperty('--dx', `${(i - 1.5) * 9}vw`);
        d.style.setProperty('--dy', `${(i % 2 ? 1 : -1) * 3 + i * 2}vh`);
        d.innerHTML = '<small></small><b></b><span></span>';
        d.querySelector('small')!.textContent = `THE DAILY CIRCUIT · ${p.year}`;
        d.querySelector('b')!.textContent = p.head;
        d.querySelector('span')!.textContent = p.sub;
        this.papers.appendChild(d);
        h.sfx.whoosh();
        h.sfx.thud();
      }
    }
    if (s.letter && this.shotT >= s.letter.at && !this.fired.has('letter')) {
      this.fired.add('letter');
      this.letter.innerHTML = s.letter.lines.map((l) => `<div>${l ? l.replace(/&/g, '&amp;').replace(/</g, '&lt;') : '&nbsp;'}</div>`).join('');
      this.letter.classList.add('on');
      h.sfx.whoosh();
    }
    if (s.title !== undefined && this.shotT >= s.title && !this.fired.has('title')) {
      this.fired.add('title');
      this.titleEl.classList.add('on');
      h.sfx.boom();
      h.sfx.stamp();
    }

    // Typewriter
    if (this.typing && this.typing.shown < this.typing.full.length) {
      this.typing.acc += dt * 32;
      while (this.typing.acc >= 1 && this.typing.shown < this.typing.full.length) {
        this.typing.acc -= 1;
        this.typing.shown++;
        if (this.typing.shown % 2 === 0) h.sfx.typeTick();
      }
    }
    if (this.typing) {
      const txt = this.typing.full.slice(0, this.typing.shown);
      if (this.caption.textContent !== txt) this.caption.textContent = txt;
    }

    if (this.shotT >= s.dur) this.nextShot();
  }
}

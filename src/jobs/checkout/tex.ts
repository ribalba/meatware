import * as THREE from 'three';
import { make, noise, speckle } from '../../textures';

/**
 * Pixel textures for the checkout job. Drawn small and shown with nearest filtering,
 * like everything else in the game. All keys start with "co-" so they never clash.
 */

/** Worn checkerboard linoleum in front of the checkout lanes. */
export const linoTex = (repeat: [number, number]) =>
  make('co-lino', 64, 64, (g, r) => {
    const a = ['#d8cfb4', '#d1c7aa'];
    const b = ['#7a9c8e', '#6f9183'];
    for (let ty = 0; ty < 2; ty++) {
      for (let tx = 0; tx < 2; tx++) {
        const dark = (tx + ty) % 2 === 1;
        g.fillStyle = (dark ? b : a)[Math.floor(r() * 2)];
        g.fillRect(tx * 32, ty * 32, 32, 32);
      }
    }
    noise(g, r, 64, 64, 14);
    speckle(g, r, 64, 64, 60, ['#8f866f', '#a99f87', '#5a7569', '#e6dfca']);
    g.fillStyle = 'rgba(60,45,30,0.2)';
    for (let i = 0; i < 5; i++) g.fillRect(Math.floor(r() * 56), Math.floor(r() * 60), 5 + Math.floor(r() * 8), 1);
    g.fillStyle = '#6f6754';
    g.fillRect(0, 0, 64, 1);
    g.fillRect(0, 32, 64, 1);
    g.fillRect(0, 0, 1, 64);
    g.fillRect(32, 0, 1, 64);
  }, repeat);

/** Black rubber anti-fatigue mat for the cashier. */
export const matTex = (repeat: [number, number]) =>
  make('co-mat', 16, 16, (g, r) => {
    g.fillStyle = '#1f1d1b';
    g.fillRect(0, 0, 16, 16);
    noise(g, r, 16, 16, 14);
    g.fillStyle = '#34302c';
    for (let y = 1; y < 16; y += 4) for (let x = (y % 8 === 1 ? 1 : 3); x < 16; x += 4) g.fillRect(x, y, 2, 2);
  }, repeat);

/** Fake wood laminate of the checkout counters. */
export const laminateTex = (repeat: [number, number]) =>
  make('co-laminate', 32, 32, (g, r) => {
    g.fillStyle = '#9c6a3c';
    g.fillRect(0, 0, 32, 32);
    for (let y = 0; y < 32; y++) {
      if (r() < 0.35) {
        g.fillStyle = r() < 0.5 ? '#8a5b30' : '#ad7a48';
        g.fillRect(0, y, 32, 1);
      }
    }
    noise(g, r, 32, 32, 14);
    g.fillStyle = 'rgba(40,25,10,0.3)';
    g.fillRect(Math.floor(r() * 28), Math.floor(r() * 28), 4, 2);
  }, repeat);

/** Brushed steel with fingerprints. */
export const steelTex = (repeat: [number, number]) =>
  make('co-steel', 32, 16, (g, r) => {
    g.fillStyle = '#9aa0a6';
    g.fillRect(0, 0, 32, 16);
    for (let y = 0; y < 16; y++) {
      g.fillStyle = r() < 0.5 ? '#a8aeb4' : '#8c9298';
      g.fillRect(0, y, 32, 1);
    }
    noise(g, r, 32, 16, 12);
    g.fillStyle = 'rgba(60,60,60,0.2)';
    for (let i = 0; i < 3; i++) g.fillRect(Math.floor(r() * 28), Math.floor(r() * 12), 3, 3);
  }, repeat);

const CANDY = ['#c0392b', '#f1c40f', '#8e44ad', '#2e86c1', '#e67e22', '#27ae60', '#5d4037', '#ff6fb5'];
const CANDY_NAMES = ['BOLT', 'NUTZ', 'CHOC', 'GEAR', 'MEGA', 'ZAP', 'RUST', 'YUM'];

/** Rows of candy bar wrappers, for the faces of the impulse racks. */
export const candyTex = () =>
  make('co-candy', 64, 64, (g, r) => {
    g.fillStyle = '#3a2e24';
    g.fillRect(0, 0, 64, 64);
    g.font = 'bold 5px monospace';
    for (let row = 0; row < 4; row++) {
      const y = row * 16;
      g.fillStyle = '#8b8f94';
      g.fillRect(0, y + 14, 64, 2);
      for (let x = 1; x < 64; x += 8) {
        const i = Math.floor(r() * CANDY.length);
        if (r() < 0.08) continue;
        g.fillStyle = CANDY[i];
        g.fillRect(x, y + 3, 7, 11);
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.fillRect(x, y + 3, 7, 1);
        g.fillStyle = '#ffffff';
        g.fillRect(x + 1, y + 7, 5, 3);
        g.fillStyle = CANDY[(i + 3) % CANDY.length];
        g.fillRect(x + 2, y + 8, 3, 1);
      }
    }
    noise(g, r, 64, 64, 10);
    g.fillStyle = '#f3e6c8';
    g.fillText(CANDY_NAMES[0], 2, 63);
  });

/** Product facings on the store shelves in the back: boxes, cans and bottles. */
export const facingsTex = (variant: number) =>
  make(`co-facings${variant}`, 64, 32, (g, r) => {
    g.fillStyle = '#2a2621';
    g.fillRect(0, 0, 64, 32);
    const pal = [
      ['#c0392b', '#f1c40f', '#ecf0f1', '#e67e22'],
      ['#2e86c1', '#85c1e9', '#ecf0f1', '#1b4f72'],
      ['#27ae60', '#f4d03f', '#784212', '#a9dfbf'],
      ['#8e44ad', '#d7bde2', '#f5b7b1', '#5d6d7e'],
    ][variant % 4];
    let x = 0;
    while (x < 64) {
      const w = 4 + Math.floor(r() * 5);
      const h = 10 + Math.floor(r() * 18);
      const c = pal[Math.floor(r() * pal.length)];
      const n = 1 + Math.floor(r() * 3);
      for (let k = 0; k < n && x < 64; k++) {
        g.fillStyle = c;
        g.fillRect(x, 32 - h, w - 1, h);
        g.fillStyle = 'rgba(255,255,255,0.5)';
        g.fillRect(x + 1, 32 - h + 3, w - 3, 2);
        g.fillStyle = 'rgba(0,0,0,0.25)';
        g.fillRect(x + w - 2, 32 - h, 1, h);
        x += w;
      }
      if (r() < 0.15) x += 3 + Math.floor(r() * 5);
    }
    noise(g, r, 64, 32, 12);
  });

/** A plastic shopping bag print. */
export const bagTex = () =>
  make('co-bag', 32, 32, (g, r) => {
    g.fillStyle = '#ecebe4';
    g.fillRect(0, 0, 32, 32);
    noise(g, r, 32, 32, 10);
    g.fillStyle = '#c0392b';
    g.font = 'bold 6px monospace';
    g.fillText('THANK', 2, 10);
    g.fillText('YOU', 2, 17);
    g.fillText('THANK', 2, 24);
    g.fillStyle = 'rgba(120,120,110,0.4)';
    for (let i = 0; i < 6; i++) g.fillRect(Math.floor(r() * 30), Math.floor(r() * 30), 1, 4);
  });

/** Overcast car park with acid rain, seen through the front windows. */
export const outsideTex = () =>
  make('co-outside', 128, 48, (g, r) => {
    const sky = g.createLinearGradient(0, 0, 0, 30);
    sky.addColorStop(0, '#4a5058');
    sky.addColorStop(1, '#7c8278');
    g.fillStyle = sky;
    g.fillRect(0, 0, 128, 30);
    // city blocks
    for (let x = 0; x < 128; x += 6 + Math.floor(r() * 6)) {
      const h = 6 + Math.floor(r() * 14);
      g.fillStyle = r() < 0.5 ? '#3c4046' : '#454a50';
      g.fillRect(x, 30 - h, 7, h);
      g.fillStyle = '#d9c36a';
      for (let i = 0; i < 4; i++) if (r() < 0.5) g.fillRect(x + 1 + Math.floor(r() * 5), 30 - h + 2 + Math.floor(r() * (h - 3)), 1, 1);
    }
    // a giant billboard
    g.fillStyle = '#b3160c';
    g.fillRect(84, 6, 30, 11);
    g.fillStyle = '#f2d31b';
    g.font = 'bold 6px monospace';
    g.fillText('SHOP 24/7', 86, 14);
    // car park
    g.fillStyle = '#4a4a48';
    g.fillRect(0, 30, 128, 18);
    noise(g, r, 128, 48, 12);
    g.fillStyle = '#d8d2b0';
    for (let x = 4; x < 128; x += 14) g.fillRect(x, 36, 1, 12);
    // robot taxis and carts
    const cars = ['#e0b21b', '#c0392b', '#2e86c1', '#7f8c8d'];
    for (let i = 0; i < 6; i++) {
      const x = 6 + i * 21 + Math.floor(r() * 4);
      g.fillStyle = cars[i % cars.length];
      g.fillRect(x, 39, 10, 4);
      g.fillRect(x + 2, 37, 6, 2);
      g.fillStyle = '#1b1b1b';
      g.fillRect(x + 1, 43, 2, 1);
      g.fillRect(x + 7, 43, 2, 1);
    }
    // puddles
    g.fillStyle = 'rgba(160,170,180,0.35)';
    for (let i = 0; i < 6; i++) g.fillRect(Math.floor(r() * 120), 44 + Math.floor(r() * 3), 6 + Math.floor(r() * 6), 1);
  });

/** Rain streaks on a transparent canvas. Scroll its offset to make it fall. */
export function rainTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(200,215,230,0.5)';
  for (let i = 0; i < 10; i++) {
    const x = Math.floor(Math.random() * 32);
    const y = Math.floor(Math.random() * 64);
    g.fillRect(x, y, 1, 10 + Math.floor(Math.random() * 10));
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 2);
  return t;
}

const MAGS: { name: string; bg: string; fg: string; lines: string[] }[] = [
  { name: 'ROBO WEEKLY', bg: '#c0392b', fg: '#ffffff', lines: ['TOASTER LEAVES', 'FRIDGE FOR', 'YOUNGER OVEN'] },
  { name: 'CHROME+HOME', bg: '#2e86c1', fg: '#ffffff', lines: ['10 WAYS TO', 'HIDE YOUR', 'RUST'] },
  { name: 'BOLTS!', bg: '#f1c40f', fg: '#1b1b1b', lines: ['SELF CHECKOUT 3:', '"I NEVER NEEDED', 'A HUMAN"'] },
  { name: 'DAILY CIRCUIT', bg: '#27ae60', fg: '#ffffff', lines: ['HUMAN SEEN', 'SMILING AT WORK.', 'EXPERTS BAFFLED'] },
  { name: 'RAM MONTHLY', bg: '#8e44ad', fg: '#ffffff', lines: ['IS YOUR', 'FIRMWARE', 'CHEATING?'] },
  { name: 'OIL & GOSSIP', bg: '#e67e22', fg: '#1b1b1b', lines: ['VACUUM STAR', 'CAUGHT EATING', 'A SOCK'] },
  { name: 'HOT WIRED', bg: '#ff6fb5', fg: '#1b1b1b', lines: ['BRAD UNIT 7:', 'MY DRONE DIET', 'SECRETS'] },
  { name: 'SPARK', bg: '#1abc9c', fg: '#1b1b1b', lines: ['WE RATE 2071', 'HUMAN CASHIERS', '(ALL 1 STAR)'] },
];
export const MAG_HEADLINES = MAGS.map((m) => `${m.name}: ${m.lines.join(' ').replace(/\s+/g, ' ')}`);

/** A wall of magazine covers with robot gossip, 4 x 2 covers. */
export function magazinesTex(): THREE.CanvasTexture {
  return make('co-mags', 256, 160, (g, r) => {
    g.fillStyle = '#2b2520';
    g.fillRect(0, 0, 256, 160);
    MAGS.forEach((m, i) => {
      const x = (i % 4) * 64 + 3;
      const y = Math.floor(i / 4) * 80 + 3;
      g.fillStyle = m.bg;
      g.fillRect(x, y, 58, 74);
      g.fillStyle = m.fg;
      g.font = 'bold 8px monospace';
      g.fillText(m.name, x + 2, y + 10, 54);
      // a robot on the cover
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(x + 20, y + 16, 18, 14);
      g.fillRect(x + 16, y + 30, 26, 16);
      g.fillStyle = '#55ffff';
      g.fillRect(x + 23, y + 20, 4, 3);
      g.fillRect(x + 31, y + 20, 4, 3);
      g.fillStyle = m.fg;
      g.font = 'bold 6px monospace';
      m.lines.forEach((l, k) => g.fillText(l, x + 2, y + 56 + k * 7, 54));
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(x, y, 58, 1);
    });
    noise(g, r, 256, 160, 10);
  });
}

/** Big glowing number box for the lane light. */
export function laneNumberTex(n: number, on: boolean): THREE.CanvasTexture {
  return make(`co-lane${n}${on ? 'on' : 'off'}`, 32, 32, (g) => {
    g.fillStyle = on ? '#2a1204' : '#1a1a1a';
    g.fillRect(0, 0, 32, 32);
    g.fillStyle = on ? '#ffcf4a' : '#4a4a4a';
    g.font = 'bold 24px monospace';
    g.textAlign = 'center';
    g.fillText(String(n), 16, 25);
    g.fillStyle = on ? '#ff8a2a' : '#333333';
    g.fillRect(0, 0, 32, 2);
    g.fillRect(0, 30, 32, 2);
  });
}

/** Coins in the cash drawer: rows of tiny round coins and banknotes. */
export const tillTex = () =>
  make('co-till', 64, 32, (g, r) => {
    g.fillStyle = '#1e1e1e';
    g.fillRect(0, 0, 64, 32);
    for (let i = 0; i < 5; i++) {
      const x = i * 13 + 1;
      g.fillStyle = '#3a3a3a';
      g.fillRect(x, 1, 12, 30);
      if (i < 3) {
        g.fillStyle = ['#7fb069', '#d9a441', '#6f9fd8'][i];
        g.fillRect(x + 1, 4, 10, 26);
        g.fillStyle = 'rgba(0,0,0,0.25)';
        for (let y = 6; y < 30; y += 3) g.fillRect(x + 1, y, 10, 1);
      } else {
        for (let k = 0; k < 18; k++) {
          g.fillStyle = r() < 0.5 ? '#c9a13b' : '#b7b7b7';
          g.fillRect(x + 1 + Math.floor(r() * 9), 3 + Math.floor(r() * 26), 2, 2);
        }
      }
    }
  });

/** Dust and grime overlay for the closed lanes. */
export const dustTex = () =>
  make('co-dust', 32, 32, (g, r) => {
    g.clearRect(0, 0, 32, 32);
    for (let i = 0; i < 90; i++) {
      g.fillStyle = `rgba(160,150,130,${(0.15 + r() * 0.35).toFixed(2)})`;
      g.fillRect(Math.floor(r() * 32), Math.floor(r() * 32), 1 + Math.floor(r() * 2), 1);
    }
  });

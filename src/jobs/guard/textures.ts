import * as THREE from 'three';
import { make, noise, speckle } from '../../textures';

/**
 * Pixel textures for ROBOTICA Plant 9 at night. All keys start with "guard-" so they do not
 * collide with the shared texture cache.
 */

/** Stained factory concrete with expansion joints, 4 x 4 m per texture. */
export const factoryFloorTex = (repeat: [number, number]) =>
  make('guard-floor', 64, 64, (g, r) => {
    g.fillStyle = '#6d675c';
    g.fillRect(0, 0, 64, 64);
    noise(g, r, 64, 64, 22);
    speckle(g, r, 64, 64, 90, ['#57524a', '#7c766a', '#4b463f', '#857f72']);
    // oil stains
    for (let i = 0; i < 3; i++) {
      g.fillStyle = 'rgba(30,25,20,0.18)';
      const x = Math.floor(r() * 54);
      const y = Math.floor(r() * 54);
      g.fillRect(x, y, 6 + Math.floor(r() * 6), 3 + Math.floor(r() * 4));
      g.fillRect(x + 2, y - 1, 4, 6);
    }
    // joints
    g.fillStyle = '#3e3a33';
    g.fillRect(0, 0, 64, 1);
    g.fillRect(0, 0, 1, 64);
    g.fillStyle = 'rgba(160,150,130,0.35)';
    g.fillRect(0, 1, 64, 1);
  }, repeat);

/** Brown speckled office linoleum. */
export const linoTex = (repeat: [number, number]) =>
  make('guard-lino', 32, 32, (g, r) => {
    g.fillStyle = '#6b5a43';
    g.fillRect(0, 0, 32, 32);
    noise(g, r, 32, 32, 18);
    speckle(g, r, 32, 32, 60, ['#4e402f', '#857154', '#5c4c38']);
    g.fillStyle = '#3f3426';
    g.fillRect(0, 0, 32, 1);
    g.fillRect(0, 0, 1, 32);
  }, repeat);

/** Wood-look office wall paneling from a better decade. */
export const panelTex = (repeat: [number, number]) =>
  make('guard-panel', 32, 64, (g, r) => {
    g.fillStyle = '#7a5a3a';
    g.fillRect(0, 0, 32, 64);
    for (let x = 0; x < 32; x++) {
      if (r() < 0.25) {
        g.fillStyle = `rgba(50,30,15,${0.1 + r() * 0.2})`;
        g.fillRect(x, 0, 1, 64);
      }
    }
    noise(g, r, 32, 64, 14);
    g.fillStyle = '#4a3220';
    g.fillRect(0, 0, 1, 64);
    g.fillRect(15, 0, 1, 64);
    g.fillStyle = '#9a7650';
    g.fillRect(1, 0, 1, 64);
  }, repeat);

/** Dark painted factory wall block, lower part. */
export const blockWallTex = (repeat: [number, number]) =>
  make('guard-block', 64, 32, (g, r) => {
    g.fillStyle = '#5a5f57';
    g.fillRect(0, 0, 64, 32);
    noise(g, r, 64, 32, 16);
    g.fillStyle = '#3c403a';
    for (let y = 0; y < 32; y += 8) {
      g.fillRect(0, y, 64, 1);
      const off = (y / 8) % 2 ? 8 : 0;
      for (let x = off; x < 64; x += 16) g.fillRect(x, y, 1, 8);
    }
    g.fillStyle = 'rgba(40,30,20,0.3)';
    for (let i = 0; i < 6; i++) g.fillRect(Math.floor(r() * 62), Math.floor(r() * 20), 1, 6 + Math.floor(r() * 8));
  }, repeat);

/** Dark steel ceiling with trusses implied. */
export const roofTex = (repeat: [number, number]) =>
  make('guard-roof', 32, 32, (g, r) => {
    for (let x = 0; x < 32; x++) {
      const k = 0.5 + 0.5 * Math.sin((x / 32) * Math.PI * 4);
      const v = Math.round(28 + 14 * k);
      g.fillStyle = `rgb(${v},${v + 2},${v + 6})`;
      g.fillRect(x, 0, 1, 32);
    }
    noise(g, r, 32, 32, 10);
  }, repeat);

/** Yellow painted walkway line on concrete, worn. */
export const lineTex = () =>
  make('guard-line', 8, 32, (g, r) => {
    g.fillStyle = '#c9a227';
    g.fillRect(0, 0, 8, 32);
    noise(g, r, 8, 32, 40);
    g.fillStyle = 'rgba(90,80,60,0.6)';
    for (let i = 0; i < 10; i++) g.fillRect(Math.floor(r() * 8), Math.floor(r() * 32), 1 + Math.floor(r() * 2), 1);
  });

/** Pages of the security logbook. */
export const logbookTex = () =>
  make('guard-logbook', 64, 48, (g, r) => {
    g.fillStyle = '#ece3c8';
    g.fillRect(0, 0, 64, 48);
    noise(g, r, 64, 48, 10);
    g.fillStyle = '#9db3c9';
    for (let y = 6; y < 48; y += 4) g.fillRect(2, y, 60, 1);
    g.fillStyle = '#c0392b';
    g.fillRect(8, 0, 1, 48);
    g.fillRect(40, 0, 1, 48);
    g.fillStyle = '#2b2b5a';
    for (let y = 5; y < 44; y += 4) {
      const w = 8 + Math.floor(r() * 20);
      g.fillRect(10, y, w, 1);
      if (r() < 0.6) g.fillRect(42, y, 4 + Math.floor(r() * 16), 1);
    }
    g.fillStyle = '#6a4a2a';
    g.fillRect(31, 0, 2, 48);
  });

/** Chain link fence for the servo vault. Transparent holes. */
export const fenceTex = (repeat: [number, number]) =>
  make('guard-fence', 16, 16, (g) => {
    g.clearRect(0, 0, 16, 16);
    g.fillStyle = '#9aa0a3';
    for (let i = 0; i < 16; i++) {
      g.fillRect(i, i, 1, 1);
      g.fillRect(15 - i, i, 1, 1);
    }
  }, repeat);

/** The night outside the loading dock. */
export const nightTex = () =>
  make('guard-night', 64, 32, (g, r) => {
    const grad = g.createLinearGradient(0, 0, 0, 32);
    grad.addColorStop(0, '#05070f');
    grad.addColorStop(1, '#151b2a');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 32);
    for (let i = 0; i < 20; i++) {
      g.fillStyle = r() < 0.5 ? '#3a4258' : '#5a627a';
      g.fillRect(Math.floor(r() * 64), Math.floor(r() * 14), 1, 1);
    }
    // a streetlight and a parked truck
    g.fillStyle = '#e8b04a';
    g.fillRect(44, 12, 3, 2);
    g.fillStyle = 'rgba(232,176,74,0.25)';
    g.fillRect(40, 14, 11, 18);
    g.fillStyle = '#1c2230';
    g.fillRect(6, 20, 26, 10);
    g.fillRect(32, 23, 8, 7);
  });

/** Riveted steel catwalk grating. Transparent gaps. */
export const gratingTex = (repeat: [number, number]) =>
  make('guard-grating', 16, 16, (g) => {
    g.clearRect(0, 0, 16, 16);
    g.fillStyle = '#5d6166';
    for (let i = 0; i < 16; i += 4) {
      g.fillRect(i, 0, 2, 16);
      g.fillRect(0, i, 16, 1);
    }
  }, repeat);

/** A cork board covered in notes. */
export const corkTex = () =>
  make('guard-cork', 64, 48, (g, r) => {
    g.fillStyle = '#a77b4a';
    g.fillRect(0, 0, 64, 48);
    noise(g, r, 64, 48, 30);
    const colors = ['#f4eaa0', '#ffffff', '#f7c6d0', '#bfe3f0', '#f4eaa0'];
    for (let i = 0; i < 9; i++) {
      g.fillStyle = colors[i % colors.length];
      const x = Math.floor(r() * 52);
      const y = Math.floor(r() * 38);
      const w = 8 + Math.floor(r() * 8);
      const h = 7 + Math.floor(r() * 6);
      g.fillRect(x, y, w, h);
      g.fillStyle = '#555';
      for (let l = 2; l < h - 1; l += 2) g.fillRect(x + 1, y + l, w - 3 - Math.floor(r() * 3), 1);
      g.fillStyle = '#c0392b';
      g.fillRect(x + Math.floor(w / 2), y, 1, 1);
    }
  });

/** The screensaver on the broken monitor 14: a bouncing ROBOTICA logo. */
export function screensaver(): { texture: THREE.CanvasTexture; update: (t: number) => void; cornerFlash: () => boolean } {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 48;
  const g = c.getContext('2d')!;
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  const colors = ['#ff4d8d', '#4dd2ff', '#ffd84d', '#7cff6b', '#c38bff'];
  // The logo almost never hits the corner exactly. When it does, the screen celebrates.
  let cornerAt = -99;
  let now = 0;
  const update = (t: number) => {
    now = t;
    g.fillStyle = '#04040a';
    g.fillRect(0, 0, 64, 48);
    const w = 34;
    const h = 11;
    const px = (t * 9) % ((64 - w) * 2);
    const py = (t * 6) % ((48 - h) * 2);
    const x = px < 64 - w ? px : (64 - w) * 2 - px;
    const y = py < 48 - h ? py : (48 - h) * 2 - py;
    if (Math.min(x, 64 - w - x) < 1.5 && Math.min(y, 48 - h - y) < 1.5 && t - cornerAt > 4) cornerAt = t;
    const flash = t - cornerAt < 2.5;
    const bounces = Math.floor((t * 9) / (64 - w)) + Math.floor((t * 6) / (48 - h));
    g.fillStyle = flash ? (Math.floor(t * 8) % 2 ? '#ffffff' : '#ffd84d') : colors[bounces % colors.length];
    g.fillRect(Math.round(x), Math.round(y), w, h);
    g.fillStyle = '#04040a';
    g.font = 'bold 7px monospace';
    g.fillText('ROBOTICA', Math.round(x) + 2, Math.round(y) + 8);
    if (flash) {
      g.fillStyle = '#ffffff';
      g.font = 'bold 8px monospace';
      g.fillText('CORNER!!', 14, 30);
    }
    texture.needsUpdate = true;
  };
  update(0);
  return { texture, update, cornerFlash: () => now - cornerAt < 2.5 };
}

import * as THREE from 'three';
import { make, noise, speckle } from '../../textures';

/** Pixel textures for the toll plaza. Keys are prefixed so they never clash with other jobs. */

/** Old asphalt with gravel, patches and cracks. */
export const asphaltTex = (repeat: [number, number]) =>
  make('toll-asphalt', 64, 64, (g, r) => {
    g.fillStyle = '#3d3b3a';
    g.fillRect(0, 0, 64, 64);
    noise(g, r, 64, 64, 26);
    speckle(g, r, 64, 64, 220, ['#2a2928', '#55524f', '#4a4744', '#62605c', '#33302e']);
    // a darker repair patch
    g.fillStyle = 'rgba(20,18,18,0.35)';
    g.fillRect(8 + Math.floor(r() * 30), 10 + Math.floor(r() * 30), 14, 9);
    // cracks
    g.fillStyle = '#1e1d1c';
    for (let i = 0; i < 3; i++) {
      let x = Math.floor(r() * 64);
      let y = Math.floor(r() * 64);
      for (let k = 0; k < 10; k++) {
        g.fillRect(x & 63, y & 63, 1, 1);
        x += Math.floor(r() * 3) - 1;
        y += 1;
      }
    }
  }, repeat);

/** Worn white road paint. Used on thin boxes for lane lines. */
export const paintTex = (repeat: [number, number]) =>
  make('toll-paint', 16, 16, (g, r) => {
    g.fillStyle = '#d8d4c4';
    g.fillRect(0, 0, 16, 16);
    noise(g, r, 16, 16, 30);
    speckle(g, r, 16, 16, 30, ['#8a877d', '#6a6760', '#b9b5a6']);
  }, repeat);

/** Faded yellow road paint. */
export const yellowPaintTex = (repeat: [number, number]) =>
  make('toll-ypaint', 16, 16, (g, r) => {
    g.fillStyle = '#d6a91c';
    g.fillRect(0, 0, 16, 16);
    noise(g, r, 16, 16, 30);
    speckle(g, r, 16, 16, 30, ['#8a6e16', '#6a5a30', '#e8c24a']);
  }, repeat);

/** Dry grass with dirt spots. */
export const grassTex = (repeat: [number, number]) =>
  make('toll-grass', 32, 32, (g, r) => {
    g.fillStyle = '#4f5a2c';
    g.fillRect(0, 0, 32, 32);
    noise(g, r, 32, 32, 30);
    speckle(g, r, 32, 32, 160, ['#3c4621', '#66703a', '#7a7440', '#5b4d2c', '#38401d']);
  }, repeat);

/** Ploughed field rows, brown. */
export const fieldTex = (repeat: [number, number]) =>
  make('toll-field', 32, 32, (g, r) => {
    g.fillStyle = '#5a4630';
    g.fillRect(0, 0, 32, 32);
    noise(g, r, 32, 32, 26);
    g.fillStyle = '#3f3020';
    for (let x = 0; x < 32; x += 4) g.fillRect(x, 0, 2, 32);
    speckle(g, r, 32, 32, 40, ['#6e5a3c', '#2f2418', '#5f6a34']);
  }, repeat);

/** Dirty curb concrete with a darker bottom. */
export const curbTex = (repeat: [number, number]) =>
  make('toll-curb', 32, 16, (g, r) => {
    g.fillStyle = '#9b968c';
    g.fillRect(0, 0, 32, 16);
    noise(g, r, 32, 16, 24);
    speckle(g, r, 32, 16, 40, ['#6f6a62', '#b8b3a8', '#5a554e']);
    g.fillStyle = 'rgba(40,30,20,0.35)';
    g.fillRect(0, 12, 32, 4);
    g.fillStyle = '#6a655d';
    g.fillRect(15, 0, 1, 16);
  }, repeat);

/** Corrugated sheet metal for the booth cabins, painted cream with rust streaks. */
export const cabinTex = (repeat: [number, number]) =>
  make('toll-cabin', 32, 32, (g, r) => {
    g.fillStyle = '#d6cfb3';
    g.fillRect(0, 0, 32, 32);
    for (let x = 0; x < 32; x += 4) {
      g.fillStyle = '#b9b296';
      g.fillRect(x, 0, 1, 32);
      g.fillStyle = '#e6dfc4';
      g.fillRect(x + 2, 0, 1, 32);
    }
    noise(g, r, 32, 32, 14);
    g.fillStyle = 'rgba(130,70,30,0.35)';
    for (let i = 0; i < 4; i++) g.fillRect(Math.floor(r() * 31), Math.floor(r() * 10), 1, 8 + Math.floor(r() * 14));
    g.fillStyle = 'rgba(40,40,30,0.3)';
    g.fillRect(0, 28, 32, 4);
  }, repeat);

/** Red and white stripes for barrier arms. */
export const armTex = (repeat: [number, number]) =>
  make('toll-arm', 16, 4, (g, r) => {
    for (let x = 0; x < 16; x++) {
      g.fillStyle = x % 8 < 4 ? '#c8231b' : '#ece7da';
      g.fillRect(x, 0, 1, 4);
    }
    noise(g, r, 16, 4, 20);
  }, repeat);

/** Concrete for the canopy and the overpass. */
export const slabTex = (repeat: [number, number]) =>
  make('toll-slab', 32, 32, (g, r) => {
    g.fillStyle = '#8c877e';
    g.fillRect(0, 0, 32, 32);
    noise(g, r, 32, 32, 22);
    speckle(g, r, 32, 32, 50, ['#6d6860', '#a29d93', '#5a554e']);
    g.fillStyle = 'rgba(30,25,20,0.35)';
    for (let i = 0; i < 4; i++) g.fillRect(Math.floor(r() * 31), 0, 1, 6 + Math.floor(r() * 20));
    g.fillStyle = '#6a655c';
    g.fillRect(0, 0, 32, 1);
  }, repeat);

/** Painted steel lattice for the sign gantry. */
export const latticeTex = (repeat: [number, number]) =>
  make('toll-lattice', 16, 16, (g, r) => {
    g.fillStyle = '#5c6670';
    g.fillRect(0, 0, 16, 16);
    noise(g, r, 16, 16, 22);
    g.fillStyle = '#3a4048';
    for (let i = 0; i < 16; i++) {
      g.fillRect(i, i, 1, 1);
      g.fillRect(15 - i, i, 1, 1);
    }
    g.fillStyle = 'rgba(140,70,30,0.4)';
    g.fillRect(Math.floor(r() * 14), Math.floor(r() * 14), 2, 3);
  }, repeat);

/** Rubber floor mat inside the booth. */
export const matTex = (repeat: [number, number]) =>
  make('toll-mat', 16, 16, (g, r) => {
    g.fillStyle = '#2d2b2a';
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#3c3a38';
    for (let y = 1; y < 16; y += 4) for (let x = (y >> 2) % 2 ? 0 : 2; x < 16; x += 4) g.fillRect(x, y, 2, 2);
    noise(g, r, 16, 16, 16);
  }, repeat);

/** Dusk sky: deep violet at the top, burnt orange at the horizon, fog colour below. */
export const skyTex = () =>
  make('toll-sky', 8, 128, (g, r) => {
    const grad = g.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, '#1b1a33');
    grad.addColorStop(0.3, '#3d2c4f');
    grad.addColorStop(0.42, '#7a4256');
    grad.addColorStop(0.47, '#b8613f');
    grad.addColorStop(0.5, '#d98a45');
    grad.addColorStop(0.53, '#7a5a50');
    grad.addColorStop(1, '#5a4a4c');
    g.fillStyle = grad;
    g.fillRect(0, 0, 8, 128);
    noise(g, r, 8, 128, 6);
  });

/** Distant hills and tree line, a silhouette strip for the horizon ring. */
export const horizonTex = () =>
  make('toll-horizon', 256, 32, (g, r) => {
    g.clearRect(0, 0, 256, 32);
    let h = 14;
    for (let x = 0; x < 256; x++) {
      h += (r() - 0.5) * 2.2;
      h = Math.max(6, Math.min(26, h));
      // trees on top of the hills
      const tree = r() < 0.35 ? Math.floor(r() * 4) : 0;
      g.fillStyle = '#2b2236';
      g.fillRect(x, 32 - h - tree, 1, h + tree);
    }
    // a few lit farm windows
    g.fillStyle = '#f2b15a';
    for (let i = 0; i < 8; i++) g.fillRect(Math.floor(r() * 256), 26 + Math.floor(r() * 4), 1, 1);
    // power line pylons
    g.fillStyle = '#1d1726';
    for (let x = 10; x < 256; x += 37) {
      g.fillRect(x, 2, 1, 26);
      g.fillRect(x - 2, 5, 5, 1);
      g.fillRect(x - 1, 9, 3, 1);
    }
  });

/** Oil stain blotches drawn into a transparent texture. */
export function stainTexture(): THREE.CanvasTexture {
  return make('toll-stain', 32, 32, (g, r) => {
    g.clearRect(0, 0, 32, 32);
    for (let i = 0; i < 40; i++) {
      const a = r() * Math.PI * 2;
      const d = r() * 12;
      g.fillStyle = `rgba(10,8,12,${0.15 + r() * 0.25})`;
      g.fillRect(16 + Math.cos(a) * d - 2, 16 + Math.sin(a) * d - 2, 3 + r() * 3, 3 + r() * 3);
    }
    // rainbow sheen
    g.fillStyle = 'rgba(120,80,160,0.25)';
    g.fillRect(13, 14, 5, 2);
    g.fillStyle = 'rgba(60,140,120,0.2)';
    g.fillRect(15, 17, 4, 1);
  });
}

import * as THREE from 'three';
import { make, noise, speckle } from '../../textures';

/**
 * Pixel textures for the laundry: worn vinyl floor, painted cinderblock, steel machine fronts,
 * cloth patterns for garments and socks, cutting mats and plywood.
 */

/** Worn checkered vinyl, cream and faded teal, with lint fluff and scuffs. 2x2 tiles. */
export const vinylTex = (repeat: [number, number]) =>
  make('ld-vinyl', 64, 64, (g, r) => {
    const tiles = ['#d6ccb0', '#86a593', '#cfc4a7', '#7d9c8a'];
    for (let ty = 0; ty < 2; ty++) {
      for (let tx = 0; tx < 2; tx++) {
        g.fillStyle = (tx + ty) % 2 ? tiles[1 + (r() < 0.5 ? 2 : 0)] : tiles[r() < 0.5 ? 0 : 2];
        g.fillRect(tx * 32, ty * 32, 32, 32);
      }
    }
    noise(g, r, 64, 64, 16);
    speckle(g, r, 64, 64, 60, ['#9a917c', '#b5ab95', '#6f8a79', '#e4dcc8']);
    // lint fluff
    g.fillStyle = 'rgba(200,200,205,0.55)';
    for (let i = 0; i < 6; i++) g.fillRect(Math.floor(r() * 60), Math.floor(r() * 62), 2 + Math.floor(r() * 3), 1);
    g.fillStyle = 'rgba(70,55,40,0.2)';
    for (let i = 0; i < 4; i++) g.fillRect(Math.floor(r() * 56), Math.floor(r() * 60), 6 + Math.floor(r() * 6), 1);
    g.fillStyle = '#6b6352';
    g.fillRect(0, 0, 64, 1);
    g.fillRect(0, 32, 64, 1);
    g.fillRect(0, 0, 1, 64);
    g.fillRect(32, 0, 1, 64);
  }, repeat);

/** Painted cinderblock, warm cream, with grime. */
export const blockTex = (repeat: [number, number]) =>
  make('ld-block', 64, 64, (g, r) => {
    g.fillStyle = '#d9cfa8';
    g.fillRect(0, 0, 64, 64);
    noise(g, r, 64, 64, 12);
    g.fillStyle = '#a99d78';
    for (let row = 0; row < 4; row++) {
      const y = row * 16;
      g.fillRect(0, y, 64, 2);
      const off = row % 2 ? 16 : 0;
      for (let x = off; x < 64 + 32; x += 32) g.fillRect(x % 64, y, 2, 16);
    }
    g.fillStyle = 'rgba(90,70,40,0.22)';
    for (let i = 0; i < 6; i++) g.fillRect(Math.floor(r() * 62), 24 + Math.floor(r() * 30), 1, 4 + Math.floor(r() * 12));
    speckle(g, r, 64, 64, 30, ['#bfb38f', '#e8dfbd']);
  }, repeat);

/** Small glazed teal tiles for the lower wall band. */
export const tealTileTex = (repeat: [number, number]) =>
  make('ld-tealtile', 32, 32, (g, r) => {
    g.fillStyle = '#3f7d73';
    g.fillRect(0, 0, 32, 32);
    for (let y = 0; y < 32; y += 8) for (let x = 0; x < 32; x += 8) {
      g.fillStyle = ['#468a7f', '#3b766c', '#4c9285'][Math.floor(r() * 3)];
      g.fillRect(x + 1, y + 1, 7, 7);
    }
    noise(g, r, 32, 32, 14);
    g.fillStyle = '#d8d2bf';
    for (let i = 0; i < 32; i += 8) {
      g.fillRect(0, i, 32, 1);
      g.fillRect(i, 0, 1, 32);
    }
    g.fillStyle = 'rgba(60,40,20,0.3)';
    g.fillRect(Math.floor(r() * 28), 20, 3, 10);
  }, repeat);

/** Brushed stainless steel with scratches and a few rivets. */
export const steelTex = (repeat: [number, number]) =>
  make('ld-steel', 32, 32, (g, r) => {
    for (let x = 0; x < 32; x++) {
      const v = 150 + Math.floor(r() * 30);
      g.fillStyle = `rgb(${v},${v + 4},${v + 8})`;
      g.fillRect(x, 0, 1, 32);
    }
    noise(g, r, 32, 32, 12);
    g.fillStyle = 'rgba(60,60,70,0.35)';
    for (let i = 0; i < 4; i++) g.fillRect(Math.floor(r() * 28), Math.floor(r() * 30), 4 + Math.floor(r() * 4), 1);
    g.fillStyle = '#6d727a';
    for (const [x, y] of [[2, 2], [29, 2], [2, 29], [29, 29]]) g.fillRect(x, y, 2, 2);
  }, repeat);

/** Painted machine enamel (cream), chipped. */
export const enamelTex = (color: string, repeat: [number, number] = [1, 1]) =>
  make(`ld-enamel${color}`, 32, 32, (g, r) => {
    g.fillStyle = color;
    g.fillRect(0, 0, 32, 32);
    noise(g, r, 32, 32, 14);
    g.fillStyle = 'rgba(60,45,30,0.35)';
    for (let i = 0; i < 5; i++) g.fillRect(Math.floor(r() * 30), Math.floor(r() * 30), 1 + Math.floor(r() * 2), 1 + Math.floor(r() * 2));
    g.fillStyle = 'rgba(120,80,30,0.2)';
    g.fillRect(0, 28, 32, 4);
  }, repeat);

/** The drum seen through a porthole: dark steel with holes. */
export const drumTex = () =>
  make('ld-drum', 32, 32, (g, r) => {
    g.fillStyle = '#2b3036';
    g.fillRect(0, 0, 32, 32);
    noise(g, r, 32, 32, 18);
    g.fillStyle = '#14171a';
    for (let y = 2; y < 32; y += 5) for (let x = (y % 2) * 2 + 1; x < 32; x += 5) g.fillRect(x, y, 2, 2);
  });

/** Green cutting mat with a centimetre grid and the sacred 30 x 30 square. */
export const matTex = () =>
  make('ld-mat', 64, 32, (g, r) => {
    g.fillStyle = '#2f6b4a';
    g.fillRect(0, 0, 64, 32);
    noise(g, r, 64, 32, 10);
    g.fillStyle = '#4f9a70';
    for (let x = 0; x < 64; x += 4) g.fillRect(x, 0, 1, 32);
    for (let y = 0; y < 32; y += 4) g.fillRect(0, y, 64, 1);
    g.fillStyle = '#f2e9c8';
    g.fillRect(24, 6, 16, 1);
    g.fillRect(24, 22, 16, 1);
    g.fillRect(24, 6, 1, 17);
    g.fillRect(39, 6, 1, 17);
    g.font = 'bold 5px monospace';
    g.fillText('30x30', 25, 16);
  });

/** Plywood for cubbies and tables. */
export const plyTex = (repeat: [number, number] = [1, 1]) =>
  make('ld-ply', 32, 32, (g, r) => {
    g.fillStyle = '#b8915e';
    g.fillRect(0, 0, 32, 32);
    for (let y = 0; y < 32; y++) {
      if (r() < 0.35) {
        g.fillStyle = r() < 0.5 ? '#a47d4c' : '#c79f6b';
        g.fillRect(0, y, 32, 1);
      }
    }
    noise(g, r, 32, 32, 12);
    g.fillStyle = 'rgba(70,45,20,0.4)';
    g.fillRect(Math.floor(r() * 24), Math.floor(r() * 24), 5, 3);
  }, repeat);

/** Speckled laminate for counter tops. */
export const laminateTex = (repeat: [number, number] = [1, 1]) =>
  make('ld-laminate', 32, 32, (g, r) => {
    g.fillStyle = '#e0d6bc';
    g.fillRect(0, 0, 32, 32);
    noise(g, r, 32, 32, 10);
    speckle(g, r, 32, 32, 50, ['#a89c80', '#c6b998', '#8e8670', '#f0e8d4']);
  }, repeat);

/** Off-white canvas for laundry carts. */
export const canvasTex = () =>
  make('ld-canvas', 32, 32, (g, r) => {
    g.fillStyle = '#cfc6ae';
    g.fillRect(0, 0, 32, 32);
    noise(g, r, 32, 32, 16);
    g.fillStyle = '#a69c84';
    g.fillRect(0, 3, 32, 1);
    g.fillRect(0, 28, 32, 1);
    g.fillStyle = 'rgba(90,70,40,0.3)';
    g.fillRect(Math.floor(r() * 20), 12, 8, 6);
  });

/** Pegboard for the wall behind the detergent rack. */
export const pegTex = (repeat: [number, number]) =>
  make('ld-peg', 16, 16, (g, r) => {
    g.fillStyle = '#b08a5a';
    g.fillRect(0, 0, 16, 16);
    noise(g, r, 16, 16, 12);
    g.fillStyle = '#5a4128';
    for (let y = 2; y < 16; y += 4) for (let x = 2; x < 16; x += 4) g.fillRect(x, y, 1, 1);
  }, repeat);

/** Floor drain grate. */
export const grateTex = () =>
  make('ld-grate', 16, 16, (g, r) => {
    g.fillStyle = '#2a2b2c';
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#6a6d70';
    for (let x = 1; x < 16; x += 3) g.fillRect(x, 1, 2, 14);
    noise(g, r, 16, 16, 20);
  });

/** Lint: grey fluff. */
export const lintTex = () =>
  make('ld-lint', 16, 16, (g, r) => {
    g.fillStyle = '#9fa1a6';
    g.fillRect(0, 0, 16, 16);
    noise(g, r, 16, 16, 40);
    speckle(g, r, 16, 16, 20, ['#c9c4d6', '#7d7f86', '#b3a8a0', '#8fa0b8']);
  });

export const PATTERNS = ['STRIPES', 'DOTS', 'ARGYLE', 'PLAID', 'ZIGZAG', 'PLAIN', 'HEARTS', 'CHECKS'] as const;

/** A cloth pattern in two colours. Used for garments and socks. */
export function clothTex(pattern: number, a: string, b: string): THREE.CanvasTexture {
  const name = PATTERNS[pattern % PATTERNS.length];
  return make(`ld-cloth-${name}-${a}-${b}`, 16, 16, (g, r) => {
    g.fillStyle = a;
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = b;
    switch (name) {
      case 'STRIPES':
        for (let y = 0; y < 16; y += 4) g.fillRect(0, y, 16, 2);
        break;
      case 'DOTS':
        for (let y = 1; y < 16; y += 4) for (let x = (y % 8 === 1 ? 1 : 3); x < 16; x += 4) g.fillRect(x, y, 2, 2);
        break;
      case 'ARGYLE':
        for (let y = 0; y < 16; y++) {
          const w = Math.abs(8 - y);
          g.fillRect(w, y, 1, 1);
          g.fillRect(15 - w, y, 1, 1);
        }
        g.fillRect(7, 6, 2, 4);
        break;
      case 'PLAID':
        g.globalAlpha = 0.6;
        g.fillRect(0, 3, 16, 3);
        g.fillRect(3, 0, 3, 16);
        g.fillRect(0, 11, 16, 2);
        g.fillRect(11, 0, 2, 16);
        g.globalAlpha = 1;
        break;
      case 'ZIGZAG':
        for (let x = 0; x < 16; x++) {
          const y = x % 8 < 4 ? x % 4 : 3 - (x % 4);
          g.fillRect(x, y + 2, 1, 2);
          g.fillRect(x, y + 10, 1, 2);
        }
        break;
      case 'PLAIN':
        g.fillRect(0, 14, 16, 2);
        break;
      case 'HEARTS':
        for (const [x, y] of [[2, 2], [10, 10]]) {
          g.fillRect(x, y, 2, 1);
          g.fillRect(x + 3, y, 2, 1);
          g.fillRect(x, y + 1, 5, 2);
          g.fillRect(x + 1, y + 3, 3, 1);
          g.fillRect(x + 2, y + 4, 1, 1);
        }
        break;
      case 'CHECKS':
        for (let y = 0; y < 16; y += 4) for (let x = (y / 4) % 2 ? 0 : 4; x < 16; x += 8) g.fillRect(x, y, 4, 4);
        break;
    }
    noise(g, r, 16, 16, 18);
  });
}

/** A soft round puff of steam as a sprite texture. */
export const steamTex = () =>
  make('ld-steam', 16, 16, (g) => {
    const img = g.createImageData(16, 16);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot(x - 7.5, y - 7.5) / 7.5;
        const a = Math.max(0, 1 - d);
        const i = (y * 16 + x) * 4;
        img.data[i] = 235;
        img.data[i + 1] = 235;
        img.data[i + 2] = 240;
        img.data[i + 3] = Math.round(Math.min(1, a * 1.6) * 255 * (d < 0.85 ? 1 : 0.5));
      }
    }
    g.putImageData(img, 0, 0);
  });

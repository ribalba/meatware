import * as THREE from 'three';
import { make, noise, speckle } from '../../textures';

/** Pixel textures for the back kitchen of Le Robot Gourmand. All keys start with "dw". */

/** Terracotta quarry tiles with dark grout and grease spots, 2x2 tiles per texture. */
export const quarryTex = (repeat: [number, number]) =>
  make('dwQuarry', 32, 32, (g, r) => {
    g.fillStyle = '#3a2a22';
    g.fillRect(0, 0, 32, 32);
    const tones = ['#9a4c35', '#8f4530', '#a2563c', '#874029'];
    for (let ty = 0; ty < 2; ty++) {
      for (let tx = 0; tx < 2; tx++) {
        g.fillStyle = tones[Math.floor(r() * tones.length)];
        g.fillRect(tx * 16 + 1, ty * 16 + 1, 14, 14);
        g.fillStyle = 'rgba(255,220,180,0.12)';
        g.fillRect(tx * 16 + 1, ty * 16 + 1, 14, 1);
      }
    }
    noise(g, r, 32, 32, 22);
    speckle(g, r, 32, 32, 26, ['#5a2c1e', '#b66a4c', '#2e211b', '#6b3a28']);
    // a greasy smear
    g.fillStyle = 'rgba(40,25,10,0.25)';
    g.fillRect(4 + Math.floor(r() * 10), 6 + Math.floor(r() * 10), 7, 3);
  }, repeat);

/** Small white wall tiles with grey grout, a little yellowed. 4x4 tiles per texture. */
export const wallTileTex = (repeat: [number, number]) =>
  make('dwWallTile', 32, 32, (g, r) => {
    g.fillStyle = '#9b988a';
    g.fillRect(0, 0, 32, 32);
    for (let ty = 0; ty < 4; ty++) {
      for (let tx = 0; tx < 4; tx++) {
        const v = 220 + Math.floor(r() * 18);
        g.fillStyle = `rgb(${v},${v - 4},${v - 18})`;
        g.fillRect(tx * 8 + 1, ty * 8 + 1, 7, 7);
        g.fillStyle = 'rgba(255,255,255,0.5)';
        g.fillRect(tx * 8 + 1, ty * 8 + 1, 3, 1);
      }
    }
    noise(g, r, 32, 32, 12);
    speckle(g, r, 32, 32, 10, ['#b8a77a', '#8c8571']);
  }, repeat);

/** Lower wall band: dark green tiles that hide the splashes. */
export const wallTileDarkTex = (repeat: [number, number]) =>
  make('dwWallTileDark', 32, 32, (g, r) => {
    g.fillStyle = '#1f2b24';
    g.fillRect(0, 0, 32, 32);
    for (let ty = 0; ty < 4; ty++) {
      for (let tx = 0; tx < 4; tx++) {
        const v = Math.floor(r() * 14);
        g.fillStyle = `rgb(${46 + v},${92 + v},${70 + v})`;
        g.fillRect(tx * 8 + 1, ty * 8 + 1, 7, 7);
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.fillRect(tx * 8 + 1, ty * 8 + 1, 3, 1);
      }
    }
    noise(g, r, 32, 32, 14);
    speckle(g, r, 32, 32, 14, ['#6d5a3a', '#2a2a22']);
  }, repeat);

/** Brushed stainless steel. */
export const steelTex = (repeat: [number, number]) =>
  make('dwSteel', 32, 32, (g, r) => {
    g.fillStyle = '#8d9397';
    g.fillRect(0, 0, 32, 32);
    for (let y = 0; y < 32; y++) {
      const v = 125 + Math.floor(r() * 45);
      g.fillStyle = `rgba(${v},${v + 4},${v + 8},0.55)`;
      g.fillRect(0, y, 32, 1);
    }
    noise(g, r, 32, 32, 14);
    speckle(g, r, 32, 32, 8, ['#7c8285', '#d7dcdf']);
  }, repeat);

/** Greasy stained ceiling panels. */
export const kitchenCeilTex = (repeat: [number, number]) =>
  make('dwCeil', 32, 32, (g, r) => {
    g.fillStyle = '#b9b29b';
    g.fillRect(0, 0, 32, 32);
    noise(g, r, 32, 32, 18);
    g.fillStyle = '#7d7764';
    g.fillRect(0, 0, 32, 1);
    g.fillRect(0, 0, 1, 32);
    g.fillRect(16, 0, 1, 32);
    g.fillStyle = 'rgba(120,90,40,0.35)';
    g.beginPath();
    g.arc(8 + r() * 16, 8 + r() * 16, 3 + r() * 4, 0, Math.PI * 2);
    g.fill();
    speckle(g, r, 32, 32, 12, ['#8b8268', '#6e6650']);
  }, repeat);

/** Dark red damask wallpaper for the dining room. */
export const damaskTex = (repeat: [number, number]) =>
  make('dwDamask', 16, 16, (g, r) => {
    g.fillStyle = '#4a1016';
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#6b1d24';
    g.fillRect(7, 2, 2, 12);
    g.fillRect(4, 5, 8, 2);
    g.fillRect(5, 10, 6, 2);
    g.fillStyle = '#a88a3c';
    g.fillRect(7, 7, 2, 2);
    noise(g, r, 16, 16, 12);
  }, repeat);

/** Black and white checker floor of the dining room. */
export const checkerTex = (repeat: [number, number]) =>
  make('dwChecker', 16, 16, (g, r) => {
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      g.fillStyle = (x + y) % 2 ? '#1b1b1d' : '#d9d2c0';
      g.fillRect(x * 8, y * 8, 8, 8);
    }
    noise(g, r, 16, 16, 18);
  }, repeat);

/** Chrome wire for shelving and racks (use with alphaTest). */
export const wireTex = (repeat: [number, number]) =>
  make('dwWire', 16, 16, (g) => {
    g.clearRect(0, 0, 16, 16);
    g.fillStyle = '#d7dde0';
    for (let i = 0; i < 16; i += 4) {
      g.fillRect(i, 0, 1, 16);
    }
    g.fillRect(0, 0, 16, 1);
    g.fillRect(0, 8, 16, 1);
  }, repeat);

/** Wooden crate slats. */
export const crateTex = (repeat: [number, number]) =>
  make('dwCrate', 16, 16, (g, r) => {
    g.fillStyle = '#8a6438';
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#3b2814';
    g.fillRect(0, 5, 16, 1);
    g.fillRect(0, 11, 16, 1);
    g.fillStyle = '#a77c48';
    g.fillRect(0, 0, 16, 1);
    noise(g, r, 16, 16, 24);
  }, repeat);

/** A soft round puff for steam sprites. */
let puffTex: THREE.CanvasTexture | null = null;
export function steamPuffTex(): THREE.CanvasTexture {
  if (puffTex) return puffTex;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(16, 16, 2, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.5, 'rgba(240,240,240,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  puffTex = new THREE.CanvasTexture(c);
  puffTex.colorSpace = THREE.SRGBColorSpace;
  return puffTex;
}

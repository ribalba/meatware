import * as THREE from 'three';
import { make, noise, speckle } from '../../textures';

/**
 * Pixel textures of the fulfillment center. Keys start with "picker-" so they never
 * collide with the cache entries of other jobs.
 */

/** Polished warehouse concrete with saw cut joints, tire marks and oil stains. 2 x 2 m per texture. */
export const floorTex = (repeat: [number, number]) =>
  make('picker-floor', 64, 64, (g, r) => {
    g.fillStyle = '#a39b8a';
    g.fillRect(0, 0, 64, 64);
    // mottled concrete
    for (let i = 0; i < 40; i++) {
      g.fillStyle = r() > 0.5 ? 'rgba(120,110,95,0.18)' : 'rgba(190,180,160,0.16)';
      g.fillRect(Math.floor(r() * 60), Math.floor(r() * 60), 3 + Math.floor(r() * 8), 2 + Math.floor(r() * 6));
    }
    noise(g, r, 64, 64, 16);
    speckle(g, r, 64, 64, 60, ['#7d7566', '#bcb39f', '#6f685b']);
    // tire marks
    g.fillStyle = 'rgba(40,35,30,0.22)';
    const y0 = 10 + Math.floor(r() * 40);
    g.fillRect(0, y0, 64, 1);
    g.fillRect(0, y0 + 4, 64, 1);
    g.fillStyle = 'rgba(40,35,30,0.12)';
    g.fillRect(Math.floor(r() * 20), 0, 1, 64);
    // oil stain
    g.fillStyle = 'rgba(50,40,30,0.25)';
    g.fillRect(40, 44, 6, 4);
    g.fillRect(42, 42, 3, 8);
    // saw cut joints every 2 m
    g.fillStyle = '#5f594e';
    g.fillRect(0, 0, 64, 1);
    g.fillRect(0, 0, 1, 64);
    g.fillStyle = '#c2b9a4';
    g.fillRect(0, 1, 64, 1);
  }, repeat);

/** Painted concrete blocks for the lower walls, grimy at the bottom. */
export const blockWallTex = (repeat: [number, number]) =>
  make('picker-block', 64, 64, (g, r) => {
    const grad = g.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, '#cbbf9f');
    grad.addColorStop(0.8, '#bfb393');
    grad.addColorStop(1, '#8f8468');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    noise(g, r, 64, 64, 14);
    g.fillStyle = '#8e846a';
    for (let y = 0; y < 64; y += 16) {
      g.fillRect(0, y, 64, 1);
      const off = (y / 16) % 2 ? 16 : 0;
      for (let x = off; x < 64; x += 32) g.fillRect(x, y, 1, 16);
    }
    g.fillStyle = 'rgba(70,55,35,0.25)';
    for (let i = 0; i < 6; i++) g.fillRect(Math.floor(r() * 62), 30 + Math.floor(r() * 20), 1, 6 + Math.floor(r() * 10));
    speckle(g, r, 64, 64, 30, ['#9c9174', '#d8cdb0']);
  }, repeat);

/** Corrugated steel sheet for the upper walls, a little rusty. */
export const sheetWallTex = (repeat: [number, number]) =>
  make('picker-sheet', 32, 32, (g, r) => {
    for (let x = 0; x < 32; x++) {
      const k = 0.5 + 0.5 * Math.sin((x / 32) * Math.PI * 8);
      const v = Math.round(92 + 38 * k);
      g.fillStyle = `rgb(${v + 8},${v + 2},${v - 8})`;
      g.fillRect(x, 0, 1, 32);
    }
    noise(g, r, 32, 32, 14);
    g.fillStyle = 'rgba(130,70,30,0.35)';
    for (let i = 0; i < 4; i++) g.fillRect(Math.floor(r() * 30), Math.floor(r() * 10), 1, 8 + Math.floor(r() * 16));
    g.fillStyle = '#5a5248';
    g.fillRect(0, 31, 32, 1);
  }, repeat);

/** Steel roof deck with ribs. */
export const roofTex = (repeat: [number, number]) =>
  make('picker-roof', 32, 32, (g, r) => {
    g.fillStyle = '#4b463f';
    g.fillRect(0, 0, 32, 32);
    noise(g, r, 32, 32, 18);
    g.fillStyle = '#2f2b26';
    for (let x = 0; x < 32; x += 8) g.fillRect(x, 0, 2, 32);
    g.fillStyle = '#6a645a';
    for (let x = 3; x < 32; x += 8) g.fillRect(x, 0, 1, 32);
  }, repeat);

/** Front of a plastic picking tote with a white label card and the bin number. */
export function toteTex(bin: number): THREE.CanvasTexture {
  const colors = ['#b8321f', '#1f5fa8', '#d6a213'];
  const dark = ['#6e1c10', '#123a66', '#7d5d08'];
  return make(`picker-tote${bin}`, 64, 32, (g, r) => {
    g.fillStyle = colors[bin - 1];
    g.fillRect(0, 0, 64, 32);
    noise(g, r, 64, 32, 18);
    g.fillStyle = dark[bin - 1];
    g.fillRect(0, 0, 64, 3);
    g.fillRect(0, 29, 64, 3);
    g.fillRect(0, 0, 2, 32);
    g.fillRect(62, 0, 2, 32);
    // grip hole
    g.fillStyle = '#1a1410';
    g.fillRect(6, 7, 10, 4);
    g.fillRect(48, 7, 10, 4);
    // label card with the bin number
    g.fillStyle = '#f2ead2';
    g.fillRect(22, 6, 20, 20);
    g.fillStyle = '#111111';
    g.font = 'bold 18px monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(String(bin), 32, 17);
  });
}

/** Side of a tote, plain plastic. */
export function toteSideTex(bin: number): THREE.CanvasTexture {
  const colors = ['#a82d1b', '#1c5697', '#c39410'];
  return make(`picker-toteside${bin}`, 16, 16, (g, r) => {
    g.fillStyle = colors[bin - 1];
    g.fillRect(0, 0, 16, 16);
    noise(g, r, 16, 16, 22);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(0, 0, 16, 2);
  });
}

/** Shrink wrap over boxes: milky plastic with streaks and box shapes underneath. */
export const shrinkTex = () =>
  make('picker-shrink', 32, 32, (g, r) => {
    g.fillStyle = '#9b8264';
    g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#ad9070';
    g.fillRect(1, 1, 14, 14);
    g.fillRect(17, 1, 14, 14);
    g.fillRect(1, 17, 14, 14);
    g.fillRect(17, 17, 14, 14);
    g.fillStyle = 'rgba(235,235,240,0.55)';
    g.fillRect(0, 0, 32, 32);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 9; i++) {
      const y = Math.floor(r() * 32);
      g.fillRect(0, y, 32, 1);
    }
    noise(g, r, 32, 32, 12);
  });

/** Air pillows: a grid of puffy plastic cushions. */
export const pillowTex = () =>
  make('picker-pillow', 32, 32, (g, r) => {
    g.fillStyle = '#c9d6dc';
    g.fillRect(0, 0, 32, 32);
    for (let y = 0; y < 32; y += 8) {
      for (let x = 0; x < 32; x += 16) {
        g.fillStyle = '#eef6fa';
        g.fillRect(x + 1, y + 1, 14, 6);
        g.fillStyle = '#ffffff';
        g.fillRect(x + 3, y + 2, 5, 2);
      }
    }
    noise(g, r, 32, 32, 8);
  });

/** Caution tape. */
export const cautionTex = () =>
  make('picker-caution', 64, 8, (g) => {
    g.fillStyle = '#e8c11c';
    g.fillRect(0, 0, 64, 8);
    g.fillStyle = '#151311';
    for (let x = -8; x < 64; x += 16) {
      g.beginPath();
      g.moveTo(x, 8);
      g.lineTo(x + 4, 0);
      g.lineTo(x + 8, 0);
      g.lineTo(x + 4, 8);
      g.fill();
    }
  });

/** Plastic sheeting on the unfinished break room. */
export const plasticTex = (repeat: [number, number]) =>
  make('picker-plastic', 32, 32, (g, r) => {
    g.fillStyle = '#a9b4b3';
    g.fillRect(0, 0, 32, 32);
    for (let x = 0; x < 32; x += 1) {
      const v = Math.sin(x * 0.9 + r()) * 14;
      g.fillStyle = `rgba(${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${v > 0 ? 255 : 0},${Math.abs(v) / 80})`;
      g.fillRect(x, 0, 1, 32);
    }
    noise(g, r, 32, 32, 10);
    g.fillStyle = 'rgba(90,80,60,0.25)';
    g.fillRect(4, 20, 9, 6);
  }, repeat);

/** Bare plywood and studs. */
export const plywoodTex = (repeat: [number, number]) =>
  make('picker-plywood', 32, 32, (g, r) => {
    g.fillStyle = '#b8935c';
    g.fillRect(0, 0, 32, 32);
    for (let y = 0; y < 32; y++) {
      g.fillStyle = `rgba(110,75,35,${0.08 + 0.1 * Math.abs(Math.sin(y * 0.7 + r() * 2))})`;
      g.fillRect(0, y, 32, 1);
    }
    noise(g, r, 32, 32, 14);
    g.fillStyle = '#6e5230';
    g.fillRect(0, 0, 32, 1);
    g.fillRect(0, 0, 1, 32);
  }, repeat);

/** Pallet wood. */
export const palletTex = () =>
  make('picker-pallet', 32, 16, (g, r) => {
    g.fillStyle = '#8a6a43';
    g.fillRect(0, 0, 32, 16);
    noise(g, r, 32, 16, 24);
    g.fillStyle = '#4e3a22';
    for (let x = 0; x < 32; x += 6) g.fillRect(x, 0, 1, 16);
  });

/** Black rubber floor mat with a rib pattern (packing station). */
export const matTex = (repeat: [number, number]) =>
  make('picker-mat', 16, 16, (g, r) => {
    g.fillStyle = '#25221f';
    g.fillRect(0, 0, 16, 16);
    noise(g, r, 16, 16, 14);
    g.fillStyle = '#3a3632';
    for (let y = 1; y < 16; y += 4) g.fillRect(0, y, 16, 1);
  }, repeat);

/** Vending machine front with bottles behind glass. */
export const vendingTex = () =>
  make('picker-vending', 64, 128, (g, r) => {
    g.fillStyle = '#7a1f14';
    g.fillRect(0, 0, 64, 128);
    g.fillStyle = '#16120e';
    g.fillRect(6, 22, 38, 86);
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 4; col++) {
        const empty = r() < 0.35;
        g.fillStyle = empty ? '#2a2420' : '#d9e2e4';
        g.fillRect(9 + col * 9, 26 + row * 16, 5, 11);
        if (!empty) {
          g.fillStyle = '#e0b21b';
          g.fillRect(9 + col * 9, 30 + row * 16, 5, 3);
        }
      }
    }
    g.fillStyle = '#f0b43c';
    g.font = 'bold 11px monospace';
    g.fillText('RELIEF', 6, 13);
    g.fillStyle = '#222222';
    g.fillRect(48, 30, 12, 40);
    g.fillStyle = '#ff4d4d';
    g.fillRect(50, 33, 8, 4);
    g.fillStyle = '#aaaaaa';
    for (let i = 0; i < 4; i++) g.fillRect(50, 42 + i * 6, 8, 3);
    g.fillStyle = '#0a0806';
    g.fillRect(10, 112, 30, 10);
    noise(g, r, 64, 128, 10);
  });

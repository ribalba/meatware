import * as THREE from 'three';
import { make, noise, speckle } from '../../textures';

/** Pixel textures of the sorting office. Small canvases, nearest-neighbour, drawn once and cached. */

/** Worn linoleum tiles, two tones, scuffed. One repeat is 2 x 2 tiles. */
export const linoTex = (repeat: [number, number]) =>
  make('mail-lino', 32, 32, (g, r, w, h) => {
    const a = '#8b7f5e';
    const b = '#7a6e50';
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      g.fillStyle = (x + y) % 2 ? a : b;
      g.fillRect(x * 16, y * 16, 16, 16);
    }
    noise(g, r, w, h, 18);
    g.fillStyle = 'rgba(40,32,20,0.55)';
    for (let i = 0; i <= 32; i += 16) {
      g.fillRect(i, 0, 1, 32);
      g.fillRect(0, i, 32, 1);
    }
    speckle(g, r, w, h, 26, ['#5e553c', '#9c9070', '#4a4230']);
    // scuff marks
    g.fillStyle = 'rgba(30,25,15,0.25)';
    for (let i = 0; i < 4; i++) g.fillRect(Math.floor(r() * 28), Math.floor(r() * 30), 3 + Math.floor(r() * 4), 1);
  }, repeat);

/** Upper wall: tired cream plaster with water stains. */
export const plasterTex = (repeat: [number, number]) =>
  make('mail-plaster', 32, 32, (g, r, w, h) => {
    g.fillStyle = '#bcb397';
    g.fillRect(0, 0, w, h);
    noise(g, r, w, h, 14);
    g.fillStyle = 'rgba(120,100,60,0.18)';
    for (let i = 0; i < 3; i++) g.fillRect(Math.floor(r() * 26), Math.floor(r() * 20), 4 + Math.floor(r() * 4), 6 + Math.floor(r() * 10));
    speckle(g, r, w, h, 12, ['#a89a72', '#e0d6b0']);
  }, repeat);

/** Lower wall: institutional green gloss paint, kicked a lot. */
export const dadoTex = (repeat: [number, number]) =>
  make('mail-dado', 32, 16, (g, r, w, h) => {
    g.fillStyle = '#4f6b4a';
    g.fillRect(0, 0, w, h);
    noise(g, r, w, h, 12);
    g.fillStyle = '#3c5338';
    g.fillRect(0, 0, w, 1);
    speckle(g, r, w, h, 14, ['#2f412c', '#6b8a64', '#8a7a5a']);
  }, repeat);

/** Dark varnished wood for the pigeonhole wall and counters. */
export const woodTex = (repeat: [number, number]) =>
  make('mail-wood', 32, 32, (g, r, w, h) => {
    g.fillStyle = '#6b4526';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      g.fillStyle = `rgba(${40 + Math.floor(r() * 30)},${20 + Math.floor(r() * 16)},8,${0.25 + r() * 0.3})`;
      g.fillRect(0, y, w, 1);
    }
    noise(g, r, w, h, 14);
    g.fillStyle = 'rgba(30,15,5,0.5)';
    for (let i = 0; i < 3; i++) g.fillRect(Math.floor(r() * w), Math.floor(r() * h), 2, 1);
  }, repeat);

/** Burlap sack cloth. */
export const burlapTex = () =>
  make('mail-burlap', 16, 16, (g, r, w, h) => {
    g.fillStyle = '#8c7650';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      g.fillStyle = 'rgba(60,45,25,0.35)';
      g.fillRect(0, y, w, 1);
    }
    for (let x = 0; x < w; x += 2) {
      g.fillStyle = 'rgba(200,170,120,0.18)';
      g.fillRect(x, 0, 1, h);
    }
    noise(g, r, w, h, 20);
  }, [2, 2]);

/** Postal sack canvas, blue-grey with a stencil. */
export const sackTex = () =>
  make('mail-sack', 32, 32, (g, r, w, h) => {
    g.fillStyle = '#5d6d7e';
    g.fillRect(0, 0, w, h);
    noise(g, r, w, h, 18);
    g.fillStyle = '#d7dbdd';
    g.fillRect(9, 12, 14, 2);
    g.fillRect(9, 16, 10, 2);
    g.fillStyle = '#c0392b';
    g.fillRect(9, 20, 14, 2);
  });

/** Roll cage wire mesh. Transparent between the wires. */
export const wireTex = (repeat: [number, number]) =>
  make('mail-wire', 16, 16, (g) => {
    g.clearRect(0, 0, 16, 16);
    g.fillStyle = '#a7a9a3';
    g.fillRect(0, 0, 16, 1);
    g.fillRect(0, 0, 1, 16);
    g.fillRect(0, 8, 16, 1);
    g.fillRect(8, 0, 1, 16);
  }, repeat);

/** Cork board. */
export const corkTex = () =>
  make('mail-cork', 32, 32, (g, r, w, h) => {
    g.fillStyle = '#a7773f';
    g.fillRect(0, 0, w, h);
    speckle(g, r, w, h, 220, ['#8a5f2e', '#c08a4c', '#6e4a22', '#b98244']);
  });

/** Grey steel with rivets, for machines and cabinets. */
export const steelTex = (repeat: [number, number]) =>
  make('mail-steel', 32, 32, (g, r, w, h) => {
    g.fillStyle = '#7b8480';
    g.fillRect(0, 0, w, h);
    noise(g, r, w, h, 16);
    g.fillStyle = '#5a625e';
    g.fillRect(0, 31, 32, 1);
    g.fillRect(31, 0, 1, 32);
    g.fillStyle = '#a8b0ac';
    for (const [x, y] of [[2, 2], [29, 2], [2, 29], [29, 29]]) g.fillRect(x, y, 1, 1);
    g.fillStyle = 'rgba(80,50,20,0.35)';
    for (let i = 0; i < 4; i++) g.fillRect(Math.floor(r() * 30), Math.floor(r() * 30), 2, 3);
  }, repeat);

/** Olive drab filing cabinet paint. */
export const cabinetTex = () =>
  make('mail-cabinet', 32, 32, (g, r, w, h) => {
    g.fillStyle = '#55603f';
    g.fillRect(0, 0, w, h);
    noise(g, r, w, h, 12);
    for (const y of [1, 9, 17, 25]) {
      g.fillStyle = '#3d452c';
      g.fillRect(1, y, 30, 1);
      g.fillStyle = '#b8b8a8';
      g.fillRect(13, y + 3, 6, 2);
      g.fillStyle = '#e8e0c8';
      g.fillRect(10, y + 6, 4, 1);
    }
  });

/** A sheet of 2071 commemorative stamps. Every stamp shows Brad. */
export const stampSheetTex = () =>
  make('mail-stamps', 32, 24, (g) => {
    g.fillStyle = '#f2ead6';
    g.fillRect(0, 0, 32, 24);
    for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) {
      const px = 1 + x * 8;
      const py = 1 + y * 8;
      g.fillStyle = ['#c0392b', '#2e86c1', '#27ae60'][(x + y) % 3];
      g.fillRect(px, py, 6, 6);
      g.fillStyle = '#222';
      g.fillRect(px + 2, py + 2, 2, 2);
      g.fillStyle = '#ff3b30';
      g.fillRect(px + 2, py + 2, 1, 1);
    }
  });

/** Rubber flaps of the conveyor hatch. */
export const flapTex = () =>
  make('mail-flap', 16, 16, (g, r, w, h) => {
    g.fillStyle = '#1e1e20';
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 4) {
      g.fillStyle = '#353538';
      g.fillRect(x, 0, 1, h);
    }
    noise(g, r, w, h, 10);
  });

/** Brown paper wrapping for parcels. */
export const kraftTex = (variant: number) =>
  make(`mail-kraft-${variant}`, 32, 32, (g, r, w, h) => {
    g.fillStyle = ['#b08a58', '#a27c4c', '#c09a64', '#9a7448'][variant % 4];
    g.fillRect(0, 0, w, h);
    noise(g, r, w, h, 14);
    g.fillStyle = 'rgba(80,55,25,0.4)';
    g.fillRect(0, 15, w, 2);
    g.fillStyle = 'rgba(230,220,190,0.6)';
    g.fillRect(15, 0, 2, h);
  });

/** Flat dark floor of the public area outside the window. */
export const terrazzoTex = (repeat: [number, number]) =>
  make('mail-terrazzo', 32, 32, (g, r, w, h) => {
    g.fillStyle = '#6f6a62';
    g.fillRect(0, 0, w, h);
    speckle(g, r, w, h, 160, ['#8f8a80', '#55504a', '#a39c90', '#4a4640']);
  }, repeat);

/** Canvas helper for live screens (MeshBasicMaterial, glows). */
export function screenCanvas(w: number, h: number): { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D; tex: THREE.CanvasTexture } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearFilter;
  return { canvas, g, tex };
}

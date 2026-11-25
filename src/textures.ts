import * as THREE from 'three';

/**
 * Small procedural pixel textures in the style of late 90s console games.
 * Everything is drawn at low resolution and shown with nearest-neighbour filtering.
 */

/** Deterministic random, so the store looks the same every time. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type Draw = (g: CanvasRenderingContext2D, r: () => number, w: number, h: number) => void;

const cache = new Map<string, THREE.CanvasTexture>();

/** Draws a cached pixel texture. Use a unique key per texture. */
export function make(key: string, w: number, h: number, draw: Draw, repeat: [number, number] = [1, 1]): THREE.CanvasTexture {
  const ck = `${key}/${repeat[0]}x${repeat[1]}`;
  const hit = cache.get(ck);
  if (hit) return hit;
  let base = cache.get(key);
  if (!base) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    draw(g, rng(key.split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7)), w, h);
    base = new THREE.CanvasTexture(c);
    base.colorSpace = THREE.SRGBColorSpace;
    base.magFilter = THREE.NearestFilter;
    // Sharp pixels up close, smooth in the distance so floors do not shimmer when walking.
    base.minFilter = THREE.LinearMipmapLinearFilter;
    base.anisotropy = 4;
    base.wrapS = base.wrapT = THREE.RepeatWrapping;
    cache.set(key, base);
  }
  if (repeat[0] === 1 && repeat[1] === 1) return base;
  const t = base.clone();
  t.repeat.set(repeat[0], repeat[1]);
  t.needsUpdate = true;
  cache.set(ck, t);
  return t;
}

/** Sprinkles per-pixel brightness noise over the canvas. */
export function noise(g: CanvasRenderingContext2D, r: () => number, w: number, h: number, amount: number): void {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  g.putImageData(img, 0, 0);
}

export function speckle(g: CanvasRenderingContext2D, r: () => number, w: number, h: number, n: number, colors: string[]): void {
  for (let i = 0; i < n; i++) {
    g.fillStyle = colors[Math.floor(r() * colors.length)];
    g.fillRect(Math.floor(r() * w), Math.floor(r() * h), 1 + Math.floor(r() * 2), 1);
  }
}

/** Worn supermarket floor tiles, 2x2 tiles per texture. */
export const floorTex = (repeat: [number, number]) =>
  make('floor', 64, 64, (g, r) => {
    const tiles = ['#d9d1bd', '#cdc3ab', '#d4cbb5', '#c9bea4'];
    for (let ty = 0; ty < 2; ty++) {
      for (let tx = 0; tx < 2; tx++) {
        g.fillStyle = tiles[(tx + ty * 2 + Math.floor(r() * 2)) % 4];
        g.fillRect(tx * 32, ty * 32, 32, 32);
      }
    }
    noise(g, r, 64, 64, 14);
    speckle(g, r, 64, 64, 70, ['#9c907a', '#b3a78e', '#8a7f6b', '#e8e0cc']);
    // scuffs
    g.fillStyle = 'rgba(80,65,45,0.18)';
    for (let i = 0; i < 4; i++) g.fillRect(Math.floor(r() * 56), Math.floor(r() * 60), 6 + Math.floor(r() * 6), 1);
    // grout
    g.fillStyle = '#857a66';
    g.fillRect(0, 0, 64, 1);
    g.fillRect(0, 32, 64, 1);
    g.fillRect(0, 0, 1, 64);
    g.fillRect(32, 0, 1, 64);
  }, repeat);

/** Painted wall panels with grime towards the floor. */
export const wallTex = (repeat: [number, number]) =>
  make('wall', 64, 64, (g, r) => {
    const grad = g.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, '#b9c2ae');
    grad.addColorStop(0.75, '#a9b39d');
    grad.addColorStop(1, '#7f8873');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    noise(g, r, 64, 64, 12);
    g.fillStyle = '#8d9781';
    g.fillRect(31, 0, 2, 64);
    g.fillStyle = '#c8d0bd';
    g.fillRect(33, 0, 1, 64);
    g.fillStyle = '#7c8570';
    g.fillRect(0, 50, 64, 1);
    // drips and stains
    g.fillStyle = 'rgba(70,60,40,0.25)';
    for (let i = 0; i < 5; i++) g.fillRect(Math.floor(r() * 62), 20 + Math.floor(r() * 30), 1, 4 + Math.floor(r() * 12));
    speckle(g, r, 64, 64, 30, ['#6f7863', '#c5cdb9']);
  }, repeat);

/** Suspended ceiling tiles. */
export const ceilingTex = (repeat: [number, number]) =>
  make('ceiling', 32, 32, (g, r) => {
    g.fillStyle = '#b4b2a8';
    g.fillRect(0, 0, 32, 32);
    noise(g, r, 32, 32, 16);
    speckle(g, r, 32, 32, 40, ['#8d8b82', '#9b998f']);
    g.fillStyle = '#6d6b63';
    g.fillRect(0, 0, 32, 1);
    g.fillRect(0, 0, 1, 32);
    // a water stain
    g.fillStyle = 'rgba(120,90,40,0.25)';
    g.fillRect(18, 20, 7, 5);
    g.fillRect(20, 19, 4, 7);
  }, repeat);

/** Blue painted sheet metal with perforations, for the shelves. */
export const shelfMetalTex = (repeat: [number, number]) =>
  make('shelfmetal', 32, 32, (g, r) => {
    g.fillStyle = '#3b5578';
    g.fillRect(0, 0, 32, 32);
    noise(g, r, 32, 32, 18);
    g.fillStyle = '#1e2c40';
    for (let y = 3; y < 32; y += 6) for (let x = 3; x < 32; x += 6) g.fillRect(x, y, 2, 2);
    g.fillStyle = '#8ea3bf';
    for (let i = 0; i < 6; i++) g.fillRect(Math.floor(r() * 30), Math.floor(r() * 32), 2 + Math.floor(r() * 3), 1);
  }, repeat);

/** Bare concrete, for pillars. */
export const concreteTex = (repeat: [number, number]) =>
  make('concrete', 32, 32, (g, r) => {
    g.fillStyle = '#8f8b84';
    g.fillRect(0, 0, 32, 32);
    noise(g, r, 32, 32, 30);
    speckle(g, r, 32, 32, 40, ['#6a665f', '#a6a39b', '#5c5852']);
    g.fillStyle = 'rgba(60,50,40,0.3)';
    g.fillRect(Math.floor(r() * 24), Math.floor(r() * 20), 1, 10);
  }, repeat);

/** Yellow and black warning stripes. */
export const hazardTex = (repeat: [number, number]) =>
  make('hazard', 16, 16, (g, r) => {
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        g.fillStyle = (x + y) % 16 < 8 ? '#e0b21b' : '#1d1b17';
        g.fillRect(x, y, 1, 1);
      }
    }
    noise(g, r, 16, 16, 30);
  }, repeat);

/** Orange warehouse racking. */
export const rackTex = (repeat: [number, number]) =>
  make('rack', 16, 16, (g, r) => {
    g.fillStyle = '#c4581d';
    g.fillRect(0, 0, 16, 16);
    noise(g, r, 16, 16, 26);
    g.fillStyle = '#5a2a10';
    for (let y = 2; y < 16; y += 4) g.fillRect(7, y, 2, 2);
  }, repeat);

/** Grey brushed metal for ducts and pipes. */
export const ductTex = (repeat: [number, number]) =>
  make('duct', 32, 16, (g, r) => {
    g.fillStyle = '#8b9096';
    g.fillRect(0, 0, 32, 16);
    noise(g, r, 32, 16, 24);
    g.fillStyle = '#5f646a';
    g.fillRect(0, 0, 1, 16);
    g.fillRect(16, 0, 1, 16);
    g.fillStyle = '#b3b8bd';
    g.fillRect(0, 4, 32, 1);
  }, repeat);

const BOX_PRINTS = ['SHOPOTRON', 'FRAGILE', 'BEANS x48', 'THIS WAY UP', 'DO NOT DROP', 'HUMAN SAFE', 'SAD FLAKES', 'WUFFLES', 'MISC.', 'RETURNS'];

/** Cardboard box sides with tape and printing. Several variants. */
export const cardboardTex = (variant: number) =>
  make(`cardboard${variant}`, 64, 64, (g, r) => {
    const browns = ['#a87a46', '#b5864f', '#9c6f3e', '#b08250'];
    g.fillStyle = browns[variant % browns.length];
    g.fillRect(0, 0, 64, 64);
    noise(g, r, 64, 64, 18);
    // corrugation lines
    g.fillStyle = 'rgba(70,45,20,0.18)';
    for (let x = 0; x < 64; x += 3) g.fillRect(x, 0, 1, 64);
    // tape
    g.fillStyle = '#c9a36a';
    g.fillRect(27, 0, 10, 64);
    g.fillStyle = 'rgba(255,240,200,0.35)';
    g.fillRect(28, 0, 2, 64);
    // printing
    g.fillStyle = variant % 3 === 0 ? '#7a1f14' : '#2c2418';
    g.font = 'bold 9px monospace';
    g.fillText(BOX_PRINTS[variant % BOX_PRINTS.length], 4, 14);
    if (variant % 2 === 0) {
      // "this way up" arrows
      g.fillRect(8, 40, 2, 10);
      g.fillRect(6, 42, 6, 2);
      g.fillRect(14, 40, 2, 10);
      g.fillRect(12, 42, 6, 2);
    } else {
      // barcode
      for (let x = 42; x < 60; x++) if (r() > 0.45) g.fillRect(x, 44, 1, 12);
    }
    // dents and stains
    g.fillStyle = 'rgba(50,30,10,0.25)';
    for (let i = 0; i < 3; i++) g.fillRect(Math.floor(r() * 58), Math.floor(r() * 58), 3 + Math.floor(r() * 5), 2 + Math.floor(r() * 3));
    // edges
    g.fillStyle = 'rgba(60,40,20,0.5)';
    g.fillRect(0, 0, 64, 1);
    g.fillRect(0, 63, 64, 1);
    g.fillRect(0, 0, 1, 64);
    g.fillRect(63, 0, 1, 64);
  });

/** Price strip along the shelf edge. */
export const priceStripTex = (color: string, repeat: [number, number]) =>
  make(`price${color}`, 64, 8, (g, r) => {
    g.fillStyle = color;
    g.fillRect(0, 0, 64, 8);
    for (let x = 4; x < 64; x += 16) {
      g.fillStyle = '#f4f1e8';
      g.fillRect(x, 1, 10, 6);
      g.fillStyle = r() < 0.3 ? '#c0392b' : '#222222';
      g.fillRect(x + 2, 3, 6, 2);
    }
  }, repeat);

/** Wet floor sign: yellow with a falling figure. */
export const wetFloorTex = () =>
  make('wetfloor', 32, 48, (g) => {
    g.fillStyle = '#f2c616';
    g.fillRect(0, 0, 32, 48);
    g.fillStyle = '#1b1b1b';
    g.font = 'bold 7px monospace';
    g.fillText('CAUTION', 2, 9);
    g.fillText('WET', 9, 40);
    g.fillText('FLOOR', 5, 46);
    // falling stick figure
    g.fillRect(14, 15, 4, 4);
    g.fillRect(12, 19, 3, 8);
    g.fillRect(9, 21, 10, 2);
    g.fillRect(14, 26, 8, 2);
    g.fillRect(8, 27, 6, 2);
    g.fillRect(6, 31, 20, 2);
  });

// ---------------------------------------------------------------- intro sets

/** Red stage curtain with vertical folds. */
export const velvetTex = (repeat: [number, number]) =>
  make('velvet', 32, 32, (g, r) => {
    for (let x = 0; x < 32; x++) {
      const k = 0.55 + 0.45 * Math.sin((x / 32) * Math.PI * 4);
      g.fillStyle = `rgb(${Math.round(90 + 90 * k)},${Math.round(12 + 14 * k)},${Math.round(20 + 16 * k)})`;
      g.fillRect(x, 0, 1, 32);
    }
    noise(g, r, 32, 32, 14);
  }, repeat);

/** Sponsor wall behind the first robot, a repeating logo grid. */
export const pressWallTex = (repeat: [number, number]) =>
  make('presswall', 64, 64, (g, r) => {
    g.fillStyle = '#1c2a4a';
    g.fillRect(0, 0, 64, 64);
    noise(g, r, 64, 64, 10);
    g.font = 'bold 8px monospace';
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 2; j++) {
        const x = i * 32 + (j % 2) * 8;
        const y = j * 32;
        g.fillStyle = '#e0b21b';
        g.fillRect(x + 4, y + 6, 8, 8);
        g.fillStyle = '#1c2a4a';
        g.fillRect(x + 6, y + 8, 4, 4);
        g.fillStyle = '#e9e4d4';
        g.fillText('ROBO', x + 13, y + 13);
        g.fillStyle = '#8fa7d8';
        g.fillText('2051', x + 6, y + 25);
      }
    }
  }, repeat);

/** Worn red stage carpet. */
export const carpetTex = (repeat: [number, number]) =>
  make('carpet', 32, 32, (g, r) => {
    g.fillStyle = '#6e1a1f';
    g.fillRect(0, 0, 32, 32);
    noise(g, r, 32, 32, 26);
    speckle(g, r, 32, 32, 30, ['#4a0f13', '#8a2a2e']);
  }, repeat);

/** Riveted steel floor plates. */
export const metalPlateTex = (repeat: [number, number]) =>
  make('metalplate', 32, 32, (g, r) => {
    g.fillStyle = '#4d5156';
    g.fillRect(0, 0, 32, 32);
    noise(g, r, 32, 32, 20);
    g.fillStyle = '#62676d';
    for (let y = 2; y < 32; y += 6) for (let x = (y / 6) % 2 ? 1 : 4; x < 32; x += 6) g.fillRect(x, y, 2, 1);
    g.fillStyle = '#2b2e31';
    g.fillRect(0, 0, 32, 1);
    g.fillRect(0, 0, 1, 32);
    g.fillStyle = '#8a8f95';
    for (const [x, y] of [[2, 2], [29, 2], [2, 29], [29, 29]]) g.fillRect(x, y, 1, 1);
  }, repeat);

/** Conveyor belt rubber with ribs. Scroll its offset to make it move. */
export const beltTex = () => {
  const t = make('belt', 16, 16, (g, r) => {
    g.fillStyle = '#26262a';
    g.fillRect(0, 0, 16, 16);
    noise(g, r, 16, 16, 16);
    g.fillStyle = '#3d3d43';
    for (let x = 0; x < 16; x += 4) g.fillRect(x, 0, 1, 16);
  });
  const c = t.clone();
  c.repeat.set(28, 1);
  c.needsUpdate = true;
  return c;
};

/** Corrugated factory wall. */
export const corrugatedTex = (repeat: [number, number]) =>
  make('corrugated', 32, 32, (g, r) => {
    for (let x = 0; x < 32; x++) {
      const k = 0.5 + 0.5 * Math.sin((x / 32) * Math.PI * 8);
      const v = Math.round(70 + 40 * k);
      g.fillStyle = `rgb(${v},${v + 6},${v + 10})`;
      g.fillRect(x, 0, 1, 32);
    }
    noise(g, r, 32, 32, 12);
    g.fillStyle = 'rgba(90,60,30,0.35)';
    for (let i = 0; i < 4; i++) g.fillRect(Math.floor(r() * 30), 10 + Math.floor(r() * 18), 1, 4 + Math.floor(r() * 8));
  }, repeat);

/** Polished marble checkerboard for the heritage center. */
export const marbleTex = (repeat: [number, number]) =>
  make('marble', 64, 64, (g, r) => {
    for (let ty = 0; ty < 2; ty++) {
      for (let tx = 0; tx < 2; tx++) {
        g.fillStyle = (tx + ty) % 2 ? '#2a2420' : '#d8cdb8';
        g.fillRect(tx * 32, ty * 32, 32, 32);
      }
    }
    noise(g, r, 64, 64, 14);
    g.strokeStyle = 'rgba(120,100,80,0.45)';
    g.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      let x = r() * 64;
      let y = r() * 64;
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += (r() - 0.5) * 20;
        y += (r() - 0.5) * 20;
        g.lineTo(x, y);
      }
      g.stroke();
    }
  }, repeat);

/** Cream stone for columns and walls of the heritage center. */
export const stoneTex = (repeat: [number, number]) =>
  make('stone', 32, 32, (g, r) => {
    g.fillStyle = '#b9ac93';
    g.fillRect(0, 0, 32, 32);
    noise(g, r, 32, 32, 18);
    g.fillStyle = '#8f846f';
    g.fillRect(0, 15, 32, 1);
    g.fillRect(15, 0, 1, 15);
    g.fillRect(4, 16, 1, 16);
    g.fillRect(24, 16, 1, 16);
  }, repeat);

/** Faded, stained wallpaper for the tiny apartment. */
export const wallpaperTex = (repeat: [number, number]) =>
  make('wallpaper', 32, 32, (g, r) => {
    g.fillStyle = '#7c7a55';
    g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#6b6946';
    for (let y = 0; y < 32; y += 8) for (let x = (y / 8) % 2 ? 0 : 4; x < 32; x += 8) g.fillRect(x, y, 3, 3);
    noise(g, r, 32, 32, 16);
    g.fillStyle = 'rgba(70,55,25,0.35)';
    g.fillRect(Math.floor(r() * 20), 18, 9, 10);
  }, repeat);

/** Dark wooden floorboards. */
export const planksTex = (repeat: [number, number]) =>
  make('planks', 32, 32, (g, r) => {
    for (let y = 0; y < 32; y += 8) {
      g.fillStyle = ['#4a3220', '#53392a', '#43301f', '#5a3e28'][(y / 8) % 4];
      g.fillRect(0, y, 32, 8);
      g.fillStyle = '#2a1c12';
      g.fillRect(0, y, 32, 1);
      g.fillRect(Math.floor(r() * 30), y, 1, 8);
    }
    noise(g, r, 32, 32, 14);
  }, repeat);

/** A night city skyline with lit windows, for the apartment window. */
export const cityNightTex = () =>
  make('citynight', 64, 64, (g, r) => {
    const sky = g.createLinearGradient(0, 0, 0, 64);
    sky.addColorStop(0, '#0b0d1c');
    sky.addColorStop(1, '#2a1f3a');
    g.fillStyle = sky;
    g.fillRect(0, 0, 64, 64);
    let x = 0;
    while (x < 64) {
      const w = 6 + Math.floor(r() * 10);
      const h = 18 + Math.floor(r() * 36);
      g.fillStyle = '#0a0a12';
      g.fillRect(x, 64 - h, w, h);
      for (let wy = 64 - h + 2; wy < 62; wy += 3) {
        for (let wx = x + 1; wx < x + w - 1; wx += 2) {
          if (r() < 0.3) {
            g.fillStyle = r() < 0.8 ? '#e8c46a' : '#7fd1ff';
            g.fillRect(wx, wy, 1, 1);
          }
        }
      }
      x += w + 1;
    }
    // a giant robot advert on one building
    g.fillStyle = '#ff3fa4';
    g.fillRect(40, 20, 14, 5);
    g.fillStyle = '#0a0a12';
    g.font = 'bold 5px monospace';
    g.fillText('JOBS', 41, 24);
  });

/** Live TV static. Call the returned update every few frames. */
export function tvStatic(): { texture: THREE.CanvasTexture; update: () => void } {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 24;
  const g = c.getContext('2d')!;
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  const update = () => {
    const img = g.createImageData(32, 24);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 200 + 30;
      img.data[i] = v * 0.85;
      img.data[i + 1] = v * 0.9;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    // the only channel left: robots doing jobs
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(2, 17, 28, 6);
    g.fillStyle = '#ffffff';
    g.font = '5px monospace';
    g.fillText('ROBO NEWS', 3, 22);
    texture.needsUpdate = true;
  };
  update();
  return { texture, update };
}

import * as THREE from 'three';
import { make, noise, speckle } from '../../textures';

/**
 * Pixel textures of MEGABYTE BURGER. Small canvases, nearest filtering, lots of grease.
 * All cache keys start with "bg-" so they never clash with other jobs.
 */

/** Red quarry tiles of the kitchen floor with grease and grout. 2x2 tiles per texture. */
export const kitchenFloorTex = (repeat: [number, number]) =>
  make('bg-kfloor', 64, 64, (g, r) => {
    const tiles = ['#7c4a36', '#84523c', '#764532', '#7f4d38'];
    for (let ty = 0; ty < 2; ty++) {
      for (let tx = 0; tx < 2; tx++) {
        g.fillStyle = tiles[(tx + ty * 2 + Math.floor(r() * 3)) % 4];
        g.fillRect(tx * 32, ty * 32, 32, 32);
      }
    }
    noise(g, r, 64, 64, 18);
    speckle(g, r, 64, 64, 60, ['#56331f', '#9c6a50', '#5f3a28']);
    // grease smears
    g.fillStyle = 'rgba(40,25,10,0.28)';
    for (let i = 0; i < 6; i++) g.fillRect(Math.floor(r() * 54), Math.floor(r() * 60), 4 + Math.floor(r() * 9), 1 + Math.floor(r() * 2));
    g.fillStyle = '#3c2219';
    g.fillRect(0, 0, 64, 2);
    g.fillRect(0, 32, 64, 2);
    g.fillRect(0, 0, 2, 64);
    g.fillRect(32, 0, 2, 64);
  }, repeat);

/** Cream and brown checkerboard of the dining room. */
export const diningFloorTex = (repeat: [number, number]) =>
  make('bg-dfloor', 64, 64, (g, r) => {
    for (let ty = 0; ty < 2; ty++) {
      for (let tx = 0; tx < 2; tx++) {
        g.fillStyle = (tx + ty) % 2 ? '#5b3423' : '#e3d3ae';
        g.fillRect(tx * 32, ty * 32, 32, 32);
      }
    }
    noise(g, r, 64, 64, 16);
    speckle(g, r, 64, 64, 50, ['#a8916a', '#3e2418', '#c9b58c']);
    g.fillStyle = 'rgba(60,40,20,0.2)';
    for (let i = 0; i < 4; i++) g.fillRect(Math.floor(r() * 56), Math.floor(r() * 60), 5 + Math.floor(r() * 6), 1);
  }, repeat);

/** White kitchen wall tiles, yellowed, with grease running down. */
export const tileWallTex = (repeat: [number, number]) =>
  make('bg-tilewall', 64, 64, (g, r) => {
    g.fillStyle = '#e4dcc4';
    g.fillRect(0, 0, 64, 64);
    noise(g, r, 64, 64, 12);
    g.fillStyle = '#a69c84';
    for (let y = 0; y < 64; y += 16) g.fillRect(0, y, 64, 1);
    for (let y = 0; y < 64; y += 16) for (let x = (y / 16) % 2 ? 8 : 0; x < 64; x += 16) g.fillRect(x, y, 1, 16);
    // yellow grime towards the bottom
    const grad = g.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, 'rgba(160,120,40,0)');
    grad.addColorStop(1, 'rgba(140,100,30,0.35)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = 'rgba(110,80,30,0.35)';
    for (let i = 0; i < 6; i++) g.fillRect(Math.floor(r() * 62), 10 + Math.floor(r() * 30), 1, 6 + Math.floor(r() * 18));
  }, repeat);

/** Orange and mustard striped wallpaper of the dining room, 90s fast food style. */
export const diningWallTex = (repeat: [number, number]) =>
  make('bg-dwall', 64, 64, (g, r) => {
    g.fillStyle = '#d9862b';
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#e8a640';
    for (let x = 0; x < 64; x += 16) g.fillRect(x, 0, 6, 64);
    g.fillStyle = '#b8601d';
    for (let x = 10; x < 64; x += 16) g.fillRect(x, 0, 1, 64);
    noise(g, r, 64, 64, 14);
    // little burger and fry icons
    for (let i = 0; i < 3; i++) {
      const x = 2 + Math.floor(r() * 56);
      const y = 4 + Math.floor(r() * 52);
      g.fillStyle = '#7a3412';
      g.fillRect(x, y, 5, 2);
      g.fillStyle = '#f2d24b';
      g.fillRect(x, y + 2, 5, 1);
      g.fillStyle = '#7a3412';
      g.fillRect(x, y + 3, 5, 2);
    }
    speckle(g, r, 64, 64, 25, ['#a2521a', '#f0b860']);
  }, repeat);

/** Dark wood paneling for the lower dining walls and the counter front. */
export const woodPanelTex = (repeat: [number, number]) =>
  make('bg-wood', 32, 32, (g, r) => {
    g.fillStyle = '#6b3d22';
    g.fillRect(0, 0, 32, 32);
    noise(g, r, 32, 32, 20);
    g.fillStyle = 'rgba(40,20,8,0.5)';
    for (let x = 0; x < 32; x += 8) g.fillRect(x, 0, 1, 32);
    g.fillStyle = 'rgba(140,90,50,0.35)';
    for (let i = 0; i < 10; i++) g.fillRect(Math.floor(r() * 32), Math.floor(r() * 32), 1, 3 + Math.floor(r() * 6));
  }, repeat);

/** Scratched stainless steel. */
export const steelTex = (repeat: [number, number]) =>
  make('bg-steel', 32, 32, (g, r) => {
    g.fillStyle = '#8b9094';
    g.fillRect(0, 0, 32, 32);
    for (let y = 0; y < 32; y++) {
      g.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '40,40,40'},${(r() * 0.12).toFixed(2)})`;
      g.fillRect(0, y, 32, 1);
    }
    noise(g, r, 32, 32, 10);
    g.fillStyle = 'rgba(90,70,30,0.25)';
    for (let i = 0; i < 5; i++) g.fillRect(Math.floor(r() * 28), Math.floor(r() * 30), 2 + Math.floor(r() * 6), 1 + Math.floor(r() * 2));
    g.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 4; i++) g.fillRect(Math.floor(r() * 30), Math.floor(r() * 32), 3 + Math.floor(r() * 4), 1);
  }, repeat);

/** The flat-top grill surface: black steel with grease and old burn marks. */
export const grillTopTex = (repeat: [number, number]) =>
  make('bg-grilltop', 64, 32, (g, r) => {
    g.fillStyle = '#2a2624';
    g.fillRect(0, 0, 64, 32);
    noise(g, r, 64, 32, 22);
    g.fillStyle = 'rgba(120,80,30,0.35)';
    for (let i = 0; i < 14; i++) g.fillRect(Math.floor(r() * 60), Math.floor(r() * 30), 2 + Math.floor(r() * 6), 1 + Math.floor(r() * 2));
    g.fillStyle = 'rgba(10,8,6,0.6)';
    for (let i = 0; i < 8; i++) {
      const x = Math.floor(r() * 56);
      const y = Math.floor(r() * 24);
      g.fillRect(x, y, 6, 5);
    }
    g.fillStyle = '#3d3633';
    g.fillRect(0, 0, 64, 1);
  }, repeat);

/** Frying oil, golden brown with bubbles. Scroll the offset for a simmer. */
export const oilTex = () =>
  make('bg-oil', 32, 32, (g, r) => {
    g.fillStyle = '#a86e1c';
    g.fillRect(0, 0, 32, 32);
    noise(g, r, 32, 32, 26);
    g.fillStyle = '#e0a640';
    for (let i = 0; i < 18; i++) g.fillRect(Math.floor(r() * 31), Math.floor(r() * 31), 1 + Math.floor(r() * 2), 1);
    g.fillStyle = '#6e4210';
    for (let i = 0; i < 10; i++) g.fillRect(Math.floor(r() * 31), Math.floor(r() * 31), 2, 1);
  });

/** Frosted metal for the walk-in freezer. */
export const frostTex = (repeat: [number, number]) =>
  make('bg-frost', 32, 32, (g, r) => {
    g.fillStyle = '#b7c9d6';
    g.fillRect(0, 0, 32, 32);
    noise(g, r, 32, 32, 18);
    g.fillStyle = '#8aa1b2';
    for (let x = 0; x < 32; x += 8) g.fillRect(x, 0, 1, 32);
    speckle(g, r, 32, 32, 60, ['#ffffff', '#e6f2fa', '#d4e6f2']);
  }, repeat);

/** Asphalt with a few cracks, outside. */
export const asphaltTex = (repeat: [number, number]) =>
  make('bg-asphalt', 32, 32, (g, r) => {
    g.fillStyle = '#3c3b3a';
    g.fillRect(0, 0, 32, 32);
    noise(g, r, 32, 32, 26);
    speckle(g, r, 32, 32, 40, ['#555350', '#2a2928', '#6a6762']);
    g.fillStyle = '#242322';
    g.fillRect(Math.floor(r() * 20), Math.floor(r() * 20), 1, 8);
  }, repeat);

/** Concrete sidewalk slabs. */
export const sidewalkTex = (repeat: [number, number]) =>
  make('bg-sidewalk', 32, 32, (g, r) => {
    g.fillStyle = '#a19c92';
    g.fillRect(0, 0, 32, 32);
    noise(g, r, 32, 32, 18);
    g.fillStyle = '#77736b';
    g.fillRect(0, 0, 32, 1);
    g.fillRect(0, 0, 1, 32);
  }, repeat);

/** A hazy 2071 sky with a smog band at the horizon. */
export const skyTex = () =>
  make('bg-sky', 64, 64, (g, r) => {
    const grad = g.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, '#6f9cc4');
    grad.addColorStop(0.65, '#b9c9cf');
    grad.addColorStop(1, '#d9b98a');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    noise(g, r, 64, 64, 8);
    // distant city blocks
    for (let x = 0; x < 64; ) {
      const w = 3 + Math.floor(r() * 7);
      const h = 6 + Math.floor(r() * 18);
      g.fillStyle = r() > 0.5 ? '#6a6f78' : '#7d828a';
      g.fillRect(x, 64 - h, w, h);
      g.fillStyle = '#f2d27a';
      for (let i = 0; i < 3; i++) g.fillRect(x + 1 + Math.floor(r() * (w - 1)), 64 - h + 2 + Math.floor(r() * (h - 3)), 1, 1);
      x += w + Math.floor(r() * 3);
    }
  });

/** Red vinyl for booth seats. */
export const vinylTex = (repeat: [number, number]) =>
  make('bg-vinyl', 16, 16, (g, r) => {
    g.fillStyle = '#a3261c';
    g.fillRect(0, 0, 16, 16);
    noise(g, r, 16, 16, 22);
    g.fillStyle = '#c8473a';
    g.fillRect(0, 2, 16, 1);
    g.fillStyle = '#6e150f';
    g.fillRect(0, 15, 16, 1);
    g.fillRect(7, 0, 1, 16);
  }, repeat);

/** Paper tray liner with the MEGABYTE logo pattern. */
export const linerTex = () =>
  make('bg-liner', 32, 32, (g, r) => {
    g.fillStyle = '#efe4c8';
    g.fillRect(0, 0, 32, 32);
    noise(g, r, 32, 32, 10);
    g.fillStyle = '#c0392b';
    for (let y = 2; y < 32; y += 8) for (let x = (y / 8) % 2 ? 6 : 2; x < 32; x += 10) {
      g.fillRect(x, y, 4, 1);
      g.fillRect(x, y + 2, 4, 1);
    }
    g.fillStyle = '#e0b21b';
    for (let y = 3; y < 32; y += 8) for (let x = (y / 8) % 2 ? 6 : 2; x < 32; x += 10) g.fillRect(x, y, 4, 1);
  });

/** A grease stain decal, used as an alpha map. */
export const stainAlpha = () =>
  make('bg-stain', 32, 32, (g, r) => {
    g.fillStyle = '#000000';
    g.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 30; i++) {
      const a = r() * Math.PI * 2;
      const d = r() * 11;
      const s = 2 + Math.floor(r() * 6);
      const v = 100 + Math.floor(r() * 155);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(Math.floor(16 + Math.cos(a) * d - s / 2), Math.floor(16 + Math.sin(a) * d - s / 2), s, s);
    }
  });

/** Pixel flame texture with transparency. */
export const flameTex = () => {
  const t = make('bg-flame', 16, 32, (g, r) => {
    g.clearRect(0, 0, 16, 32);
    for (let y = 0; y < 32; y++) {
      const w = Math.max(1, Math.round(7 * Math.sin((y / 32) * Math.PI * 0.95 + 0.1) * (1 - y / 40)));
      for (let x = 8 - w; x < 8 + w; x++) {
        const edge = Math.abs(x - 7.5) / w;
        const hot = 1 - y / 32;
        const c = edge > 0.7 ? '#c4281c' : hot > 0.55 && edge < 0.45 ? '#fff0a0' : '#f08a1c';
        if (r() < 0.12 && edge > 0.5) continue;
        g.fillStyle = c;
        g.fillRect(x, 31 - y, 1, 1);
      }
    }
  });
  t.minFilter = THREE.NearestFilter;
  return t;
};

/** Soft round puff for steam, smoke and foam. */
export const puffTex = () => {
  const t = make('bg-puff', 16, 16, (g) => {
    g.clearRect(0, 0, 16, 16);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        const d = Math.hypot(x - 7.5, y - 7.5) / 7.5;
        if (d > 1) continue;
        g.fillStyle = `rgba(255,255,255,${(1 - d * d).toFixed(2)})`;
        g.fillRect(x, y, 1, 1);
      }
    }
  });
  t.minFilter = THREE.NearestFilter;
  return t;
};

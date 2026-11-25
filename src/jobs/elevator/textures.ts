import * as THREE from 'three';
import { make, noise, speckle } from '../../textures';

/**
 * Pixel textures of SYNERGY TOWER and its elevator. All keys start with "ev-",
 * so they never clash with the shared texture cache of other jobs.
 */

type Rep = [number, number];

/** Dark varnished wood panels with a raised frame, for the cabin and the executive floor. */
export const woodPanelTex = (repeat: Rep) =>
  make('ev-woodpanel', 32, 64, (g, r) => {
    g.fillStyle = '#5a3419';
    g.fillRect(0, 0, 32, 64);
    for (let x = 0; x < 32; x++) {
      const k = Math.sin(x * 1.7 + r() * 0.6) * 0.5 + 0.5;
      g.fillStyle = `rgba(${110 + k * 30},${60 + k * 18},${25 + k * 8},0.55)`;
      g.fillRect(x, 0, 1, 64);
    }
    noise(g, r, 32, 64, 12);
    // raised frame
    g.fillStyle = '#2e180a';
    g.fillRect(3, 4, 26, 1);
    g.fillRect(3, 4, 1, 56);
    g.fillStyle = '#8a5a30';
    g.fillRect(3, 59, 26, 1);
    g.fillRect(28, 4, 1, 56);
    g.fillStyle = '#24120a';
    g.fillRect(0, 0, 32, 1);
    g.fillRect(0, 0, 1, 64);
  }, repeat);

/** Green pinstripe wallpaper with a faint diamond print, upper cabin walls. */
export const pinstripeTex = (repeat: Rep) =>
  make('ev-pinstripe', 32, 32, (g, r) => {
    g.fillStyle = '#2f4a36';
    g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#3d5d45';
    for (let x = 0; x < 32; x += 8) g.fillRect(x, 0, 1, 32);
    g.fillStyle = '#b59a52';
    for (let y = 4; y < 32; y += 16) for (let x = 4; x < 32; x += 8) {
      g.fillRect(x, y, 1, 1);
      g.fillRect(x - 1, y + 1, 3, 1);
      g.fillRect(x, y + 2, 1, 1);
    }
    noise(g, r, 32, 32, 12);
  }, repeat);

/** Brushed brass. */
export const brassTex = (repeat: Rep) =>
  make('ev-brass', 32, 16, (g, r) => {
    g.fillStyle = '#b08a3a';
    g.fillRect(0, 0, 32, 16);
    for (let y = 0; y < 16; y++) {
      g.fillStyle = `rgba(255,230,150,${0.08 + r() * 0.12})`;
      g.fillRect(0, y, 32, 1);
    }
    noise(g, r, 32, 16, 18);
    speckle(g, r, 32, 16, 10, ['#6e5420', '#e6c878']);
  }, repeat);

/** Dirty concrete with grease drips and a painted guide line, for the shaft. */
export const shaftTex = (repeat: Rep) =>
  make('ev-shaft', 32, 32, (g, r) => {
    g.fillStyle = '#4a453e';
    g.fillRect(0, 0, 32, 32);
    noise(g, r, 32, 32, 28);
    speckle(g, r, 32, 32, 30, ['#2e2a25', '#5e5850', '#3a2a1c']);
    g.fillStyle = 'rgba(20,15,8,0.45)';
    for (let i = 0; i < 4; i++) g.fillRect(Math.floor(r() * 30), Math.floor(r() * 10), 1, 8 + Math.floor(r() * 16));
    g.fillStyle = '#2b2722';
    g.fillRect(0, 15, 32, 1);
  }, repeat);

/** Brick for the basement and the roof machine room. */
export const brickTex = (repeat: Rep) =>
  make('ev-brick', 32, 32, (g, r) => {
    g.fillStyle = '#5b4a3c';
    g.fillRect(0, 0, 32, 32);
    for (let row = 0; row < 8; row++) {
      const off = row % 2 ? 4 : 0;
      for (let x = -8 + off; x < 32; x += 8) {
        const v = 0.75 + r() * 0.3;
        g.fillStyle = `rgb(${Math.round(150 * v)},${Math.round(70 * v)},${Math.round(48 * v)})`;
        g.fillRect(x + 1, row * 4 + 1, 7, 3);
      }
    }
    noise(g, r, 32, 32, 16);
  }, repeat);

/** Grey office carpet with a dotted pattern, for accounting. */
export const officeCarpetTex = (repeat: Rep) =>
  make('ev-officecarpet', 32, 32, (g, r) => {
    g.fillStyle = '#5d6460';
    g.fillRect(0, 0, 32, 32);
    noise(g, r, 32, 32, 22);
    g.fillStyle = '#4a514d';
    for (let y = 2; y < 32; y += 4) for (let x = (y / 4) % 2 ? 0 : 2; x < 32; x += 4) g.fillRect(x, y, 1, 1);
    g.fillStyle = 'rgba(80,60,30,0.3)';
    g.fillRect(Math.floor(r() * 20), Math.floor(r() * 20), 6, 4);
  }, repeat);

/** Teal carpet with orange squiggles, the Department of Synergy. */
export const funCarpetTex = (repeat: Rep) =>
  make('ev-funcarpet', 32, 32, (g, r) => {
    g.fillStyle = '#1f6f73';
    g.fillRect(0, 0, 32, 32);
    noise(g, r, 32, 32, 16);
    const cols = ['#e8862a', '#f2d31b', '#d6457a'];
    for (let i = 0; i < 6; i++) {
      g.fillStyle = cols[i % 3];
      let x = Math.floor(r() * 32);
      let y = Math.floor(r() * 32);
      for (let k = 0; k < 6; k++) {
        g.fillRect(x % 32, y % 32, 2, 1);
        x += 1 + Math.floor(r() * 2);
        y += Math.floor(r() * 3) - 1 + 32;
      }
    }
  }, repeat);

/** Black rubber gym floor with flecks. */
export const rubberTex = (repeat: Rep) =>
  make('ev-rubber', 32, 32, (g, r) => {
    g.fillStyle = '#222326';
    g.fillRect(0, 0, 32, 32);
    noise(g, r, 32, 32, 14);
    speckle(g, r, 32, 32, 60, ['#4d6b8a', '#8a3d3d', '#6b6b6b']);
    g.fillStyle = '#121214';
    g.fillRect(0, 0, 32, 1);
    g.fillRect(0, 0, 1, 32);
  }, repeat);

/** Painted cinder block wall, for the gym and the server farm. */
export const blockWallTex = (color: string, repeat: Rep) =>
  make(`ev-block${color}`, 32, 32, (g, r) => {
    g.fillStyle = color;
    g.fillRect(0, 0, 32, 32);
    noise(g, r, 32, 32, 14);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    for (let row = 0; row < 4; row++) {
      g.fillRect(0, row * 8, 32, 1);
      const off = row % 2 ? 8 : 0;
      for (let x = off; x < 32; x += 16) g.fillRect(x, row * 8, 1, 8);
    }
  }, repeat);

/** Raised floor tiles of the server farm with vent holes. */
export const raisedFloorTex = (repeat: Rep) =>
  make('ev-raisedfloor', 32, 32, (g, r) => {
    g.fillStyle = '#8c9196';
    g.fillRect(0, 0, 32, 32);
    noise(g, r, 32, 32, 14);
    g.fillStyle = '#4e5358';
    g.fillRect(0, 0, 32, 1);
    g.fillRect(0, 0, 1, 32);
    g.fillStyle = '#3a3e42';
    for (let y = 8; y < 26; y += 3) for (let x = 8; x < 26; x += 3) g.fillRect(x, y, 1, 1);
  }, repeat);

/** Roof gravel. */
export const gravelTex = (repeat: Rep) =>
  make('ev-gravel', 32, 32, (g, r) => {
    g.fillStyle = '#6e6a62';
    g.fillRect(0, 0, 32, 32);
    noise(g, r, 32, 32, 40);
    speckle(g, r, 32, 32, 120, ['#4a4741', '#8f8a80', '#59544c', '#a39d91']);
  }, repeat);

/** Damask wallpaper in dark red and gold, executive floor. */
export const damaskTex = (repeat: Rep) =>
  make('ev-damask', 32, 32, (g, r) => {
    g.fillStyle = '#5e1717';
    g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#8a6a2a';
    const motif = (cx: number, cy: number) => {
      g.fillRect(cx, cy - 4, 1, 9);
      g.fillRect(cx - 2, cy - 2, 5, 1);
      g.fillRect(cx - 3, cy, 7, 1);
      g.fillRect(cx - 2, cy + 2, 5, 1);
      g.fillRect(cx - 1, cy + 3, 3, 1);
    };
    motif(8, 8);
    motif(24, 24);
    motif(24, 8);
    motif(8, 24);
    noise(g, r, 32, 32, 12);
  }, repeat);

/** Beige office wallpaper with a dado stripe, accounting. */
export const beigeWallTex = (repeat: Rep) =>
  make('ev-beigewall', 32, 64, (g, r) => {
    const grad = g.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, '#cdbf9d');
    grad.addColorStop(1, '#a8987a');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 64);
    noise(g, r, 32, 64, 12);
    g.fillStyle = '#6e5a3e';
    g.fillRect(0, 44, 32, 2);
    g.fillStyle = 'rgba(60,40,20,0.3)';
    for (let i = 0; i < 3; i++) g.fillRect(Math.floor(r() * 30), 46 + Math.floor(r() * 10), 1, 6);
  }, repeat);

/** Bright two tone wall of the Department of Synergy. */
export const synergyWallTex = (repeat: Rep) =>
  make('ev-synwall', 32, 64, (g, r) => {
    g.fillStyle = '#e3d6b4';
    g.fillRect(0, 0, 32, 64);
    g.fillStyle = '#d6457a';
    g.fillRect(0, 40, 32, 24);
    g.fillStyle = '#f2d31b';
    g.fillRect(0, 38, 32, 2);
    noise(g, r, 32, 64, 12);
  }, repeat);

/** A server rack front with LED rows. Two frames so the LEDs blink. */
export function rackFrontTex(frame: number): THREE.CanvasTexture {
  return make(`ev-rack${frame}`, 32, 64, (g, r) => {
    g.fillStyle = '#16181b';
    g.fillRect(0, 0, 32, 64);
    for (let y = 2; y < 62; y += 4) {
      g.fillStyle = '#2b2f34';
      g.fillRect(2, y, 28, 3);
      for (let x = 4; x < 28; x += 3) {
        const v = r();
        if (v < 0.25 + frame * 0.1) {
          g.fillStyle = v < 0.05 ? '#ff4030' : v < 0.15 ? '#40ff70' : '#3aa0ff';
          g.fillRect(x, y + 1, 1, 1);
        }
      }
    }
    noise(g, r, 32, 64, 8);
  });
}

/** Mirror glass, dark with smudges. */
export const mirrorTex = () =>
  make('ev-mirror', 32, 32, (g, r) => {
    const grad = g.createLinearGradient(0, 0, 32, 32);
    grad.addColorStop(0, '#4f5a5e');
    grad.addColorStop(0.5, '#2c3336');
    grad.addColorStop(1, '#4a5458');
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    g.fillStyle = 'rgba(220,230,235,0.12)';
    for (let i = 0; i < 6; i++) g.fillRect(Math.floor(r() * 28), Math.floor(r() * 28), 3, 2);
    g.fillStyle = 'rgba(255,255,255,0.18)';
    for (let i = 0; i < 32; i++) g.fillRect(i, 31 - i, 1, 1);
  });

/** Old elevator rubber floor with a diamond tread. */
export const treadTex = (repeat: Rep) =>
  make('ev-tread', 16, 16, (g, r) => {
    g.fillStyle = '#3a2a24';
    g.fillRect(0, 0, 16, 16);
    noise(g, r, 16, 16, 14);
    g.fillStyle = '#56413a';
    for (let y = 1; y < 16; y += 4) for (let x = (y % 8 === 1 ? 1 : 3); x < 16; x += 4) g.fillRect(x, y, 2, 1);
  }, repeat);

/** Whiteboard with buzzword scribbles. */
export const whiteboardTex = () =>
  make('ev-whiteboard', 64, 40, (g, r) => {
    g.fillStyle = '#ecefe9';
    g.fillRect(0, 0, 64, 40);
    noise(g, r, 64, 40, 8);
    const cols = ['#c0392b', '#2e86c1', '#1e1e1e', '#27ae60'];
    g.font = 'bold 6px monospace';
    const words = ['SYNERGY', 'PIVOT!', 'LEVERAGE', 'Q5?', 'HUMANS=$', 'ALIGN', '10x', 'BLAME?'];
    words.forEach((w, i) => {
      g.fillStyle = cols[i % cols.length];
      g.fillText(w, 2 + (i % 2) * 30 + Math.floor(r() * 4), 8 + Math.floor(i / 2) * 9);
    });
    g.strokeStyle = '#c0392b';
    g.beginPath();
    g.moveTo(40, 34);
    g.lineTo(60, 22);
    g.stroke();
  });

/** Bar chart going down, for accounting. */
export const chartTex = () =>
  make('ev-chart', 64, 40, (g, r) => {
    g.fillStyle = '#f4f1e6';
    g.fillRect(0, 0, 64, 40);
    noise(g, r, 64, 40, 6);
    g.fillStyle = '#1e1e1e';
    g.font = 'bold 6px monospace';
    g.fillText('HUMAN MORALE Q1-Q4', 2, 7);
    const hs = [26, 20, 13, 4];
    hs.forEach((h, i) => {
      g.fillStyle = ['#27ae60', '#f1c40f', '#e67e22', '#c0392b'][i];
      g.fillRect(8 + i * 13, 36 - h, 9, h);
    });
    g.fillStyle = '#1e1e1e';
    g.fillRect(6, 36, 54, 1);
  });

/** Helipad marking. */
export const helipadTex = () =>
  make('ev-helipad', 64, 64, (g, r) => {
    g.fillStyle = '#3c3b39';
    g.fillRect(0, 0, 64, 64);
    noise(g, r, 64, 64, 20);
    g.strokeStyle = '#e0b21b';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(32, 32, 26, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#e9e4d4';
    g.fillRect(20, 18, 5, 28);
    g.fillRect(39, 18, 5, 28);
    g.fillRect(20, 29, 24, 5);
  });

/** City skyline in smog, for the roof backdrop. */
export const smogCityTex = () =>
  make('ev-smogcity', 128, 48, (g, r) => {
    const sky = g.createLinearGradient(0, 0, 0, 48);
    sky.addColorStop(0, '#5a4a3a');
    sky.addColorStop(1, '#a08060');
    g.fillStyle = sky;
    g.fillRect(0, 0, 128, 48);
    let x = 0;
    while (x < 128) {
      const w = 5 + Math.floor(r() * 10);
      const h = 10 + Math.floor(r() * 30);
      g.fillStyle = r() < 0.5 ? '#2f2a26' : '#3a332c';
      g.fillRect(x, 48 - h, w, h);
      for (let wy = 48 - h + 2; wy < 46; wy += 3) for (let wx = x + 1; wx < x + w - 1; wx += 2) {
        if (r() < 0.18) {
          g.fillStyle = r() < 0.7 ? '#d8b060' : '#7fd1ff';
          g.fillRect(wx, wy, 1, 1);
        }
      }
      if (r() < 0.2) {
        g.fillStyle = '#ff3b30';
        g.fillRect(x + Math.floor(w / 2), 48 - h - 3, 1, 3);
      }
      x += w + 1;
    }
    g.fillStyle = 'rgba(160,120,80,0.25)';
    g.fillRect(0, 20, 128, 28);
  });

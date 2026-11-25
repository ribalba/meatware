import '@fontsource/press-start-2p/400.css';
import '@fontsource/vt323/400.css';
import './style.css';
import { MANIFEST, preloadModels } from './assets';
import { findJob } from './jobs';
import { Game } from './game';

// The HUD and canvas text use these two pixel fonts, so they have to be ready before the game starts.
const fontsReady = Promise.all([
  document.fonts.load("16px 'Press Start 2P'"),
  document.fonts.load("20px 'VT323'"),
]).catch((e) => console.warn('Pixel fonts failed to load, using fallbacks:', e));

const app = document.getElementById('app')!;
const loading = document.createElement('div');
loading.id = 'loading';
loading.textContent = 'Hiring robots to watch you...';
app.appendChild(loading);

const job = findJob(new URLSearchParams(location.search).get('job'));
const failed = await preloadModels({ ...MANIFEST, ...(job.models ?? {}) }, (done, total) => {
  loading.textContent = `Hiring robots to watch you... ${done}/${total}`;
});
if (failed.length) console.warn('Missing models, using fallback shapes:', failed);
await fontsReady;
loading.remove();

const game = new Game(app);
// Handy for poking at the game from the browser console during development.
if (import.meta.env.DEV) (window as unknown as { game: Game }).game = game;

import * as THREE from 'three';

/**
 * Speech bubbles as HTML elements that follow 3D objects on screen.
 * They stay sharp no matter how low the 3D resolution is.
 */
interface Bubble {
  el: HTMLDivElement;
  anchor: THREE.Object3D;
  offsetY: number;
  t: number;
  total: number;
}

export class BubbleLayer {
  private root: HTMLDivElement;
  private list = new Map<THREE.Object3D, Bubble>();
  private v = new THREE.Vector3();
  private camPos = new THREE.Vector3();

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'bubbles';
    document.body.appendChild(this.root);
  }

  /** Shows text above an object. A new line from the same object replaces the old one. */
  say(anchor: THREE.Object3D, offsetY: number, text: string, seconds: number, speaker?: string): void {
    let b = this.list.get(anchor);
    if (!b) {
      const el = document.createElement('div');
      el.className = 'bubble';
      this.root.appendChild(el);
      b = { el, anchor, offsetY, t: seconds, total: seconds };
      this.list.set(anchor, b);
    }
    b.offsetY = offsetY;
    b.t = b.total = seconds;
    b.el.innerHTML = speaker ? '<b></b><span></span>' : '<span></span>';
    if (speaker) b.el.querySelector('b')!.textContent = speaker;
    b.el.querySelector('span')!.textContent = text;
    b.el.classList.remove('out');
    // restart the pop-in animation
    b.el.classList.remove('pop');
    void b.el.offsetWidth;
    b.el.classList.add('pop');
  }

  clear(): void {
    for (const b of this.list.values()) b.el.remove();
    this.list.clear();
  }

  update(camera: THREE.Camera, dt: number): void {
    camera.getWorldPosition(this.camPos);
    for (const [key, b] of this.list) {
      b.t -= dt;
      if (b.t <= 0 || !b.anchor.parent) {
        b.el.remove();
        this.list.delete(key);
        continue;
      }
      b.anchor.getWorldPosition(this.v);
      this.v.y += b.offsetY;
      const dist = this.v.distanceTo(this.camPos);
      this.v.project(camera);
      const visible = this.v.z < 1 && dist < 24 && Math.abs(this.v.x) < 1.3 && Math.abs(this.v.y) < 1.3;
      b.el.style.display = visible ? 'block' : 'none';
      if (!visible) continue;
      const x = (this.v.x * 0.5 + 0.5) * innerWidth;
      const y = (-this.v.y * 0.5 + 0.5) * innerHeight;
      const scale = Math.max(0.55, Math.min(1.15, 6.5 / dist));
      b.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%) scale(${scale.toFixed(3)})`;
      b.el.style.zIndex = String(1000 - Math.round(dist * 10));
      b.el.classList.toggle('out', b.t < 0.35);
    }
  }
}

export const bubbles = new BubbleLayer();

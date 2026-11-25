import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { Pass } from 'three/examples/jsm/postprocessing/Pass.js';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect.js';
import { HorizontalTiltShiftShader } from 'three/examples/jsm/shaders/HorizontalTiltShiftShader.js';
import { VerticalTiltShiftShader } from 'three/examples/jsm/shaders/VerticalTiltShiftShader.js';

/**
 * Visual styles. Each one swaps the materials, tweaks the lights and adds a post-processing chain.
 * The game code never knows which style is active.
 */
export type StyleName = 'default' | 'comic' | 'ps1' | 'noir' | 'toy';
export const STYLES: StyleName[] = ['default', 'comic', 'ps1', 'noir', 'toy'];

const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

/** Comic book: saturated colors, paper tint and halftone dots in the shadows. */
const ComicShader = {
  uniforms: { tDiffuse: { value: null }, res: { value: new THREE.Vector2(1, 1) } },
  vertexShader: FULLSCREEN_VERT,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse; uniform vec2 res; varying vec2 vUv;
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  // more punch
  c = mix(vec3(l), c, 1.5);
  c = floor(c * 5.0 + 0.5) / 5.0;
  // ink: the darkest parts go black
  c *= smoothstep(0.04, 0.16, l);
  // halftone dots, 45 degree grid
  vec2 p = vUv * res;
  mat2 r = mat2(0.7071, -0.7071, 0.7071, 0.7071);
  vec2 q = r * p / 9.0;
  vec2 cell = fract(q) - 0.5;
  float radius = clamp((0.6 - l) * 1.3, 0.0, 0.62);
  float dotMask = 1.0 - smoothstep(radius - 0.08, radius, length(cell));
  c *= 1.0 - dotMask * 0.6;
  // paper
  c = mix(c, vec3(1.0, 0.97, 0.88), smoothstep(0.88, 1.0, l) * 0.5);
  gl_FragColor = vec4(c, 1.0);
}`,
};

/** PlayStation 1: 15-bit color with ordered dithering. */
const Ps1Shader = {
  uniforms: { tDiffuse: { value: null }, res: { value: new THREE.Vector2(1, 1) } },
  vertexShader: FULLSCREEN_VERT,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse; uniform vec2 res; varying vec2 vUv;
float bayer(vec2 p) {
  int x = int(mod(p.x, 4.0)); int y = int(mod(p.y, 4.0));
  int i = x + y * 4;
  float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
  for (int k = 0; k < 16; k++) if (k == i) return m[k] / 16.0;
  return 0.0;
}
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  float d = (bayer(floor(vUv * res)) - 0.5) / 24.0;
  c = (c - 0.5) * 1.15 + 0.5;
  c *= vec3(1.06, 1.0, 0.86);
  c = floor((c + d) * 24.0 + 0.5) / 24.0;
  gl_FragColor = vec4(c, 1.0);
}`,
};

/** Film noir: black and white with high contrast, only red survives. Vignette and grain. */
const NoirShader = {
  uniforms: { tDiffuse: { value: null }, time: { value: 0 } },
  vertexShader: FULLSCREEN_VERT,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse; uniform float time; varying vec2 vUv;
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  l = smoothstep(0.08, 0.9, l);
  float red = smoothstep(0.12, 0.3, c.r - max(c.g, c.b));
  vec3 col = mix(vec3(l) * vec3(1.0, 0.98, 0.93), vec3(c.r * 1.25, c.g * 0.6, c.b * 0.6), red);
  vec2 uv = vUv - 0.5;
  col *= mix(0.25, 1.0, smoothstep(0.82, 0.2, length(uv)));
  float n = fract(sin(dot(vUv * vec2(1213.9898, 787.233) + time, vec2(12.9898, 78.233))) * 43758.5453);
  col += (n - 0.5) * 0.09;
  gl_FragColor = vec4(col, 1.0);
}`,
};

/** Toy diorama: warm, bright, a bit more saturated. */
const ToyGradeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: FULLSCREEN_VERT,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse; varying vec2 vUv;
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, 1.25);
  c *= vec3(1.04, 1.0, 0.95);
  c = pow(c, vec3(0.92));
  gl_FragColor = vec4(c, 1.0);
}`,
};

/** Renders the scene through OutlineEffect into the composer's buffer. */
class OutlineRenderPass extends Pass {
  private effect: OutlineEffect;
  scene: THREE.Scene;
  camera: THREE.Camera;
  constructor(effect: OutlineEffect, scene: THREE.Scene, camera: THREE.Camera) {
    super();
    this.effect = effect;
    this.scene = scene;
    this.camera = camera;
    this.needsSwap = false;
  }
  render(renderer: THREE.WebGLRenderer, _write: THREE.WebGLRenderTarget, read: THREE.WebGLRenderTarget): void {
    renderer.setRenderTarget(this.renderToScreen ? null : read);
    renderer.clear();
    this.effect.render(this.scene, this.camera);
  }
}

const toonGradient = (() => {
  const t = new THREE.DataTexture(new Uint8Array([105, 255]), 2, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

const ps1Snap = { value: new THREE.Vector2(160, 90) };

/** Draws a material slightly in front of coplanar surfaces. Keeps offsets set by the game. */
function pullForward(m: THREE.Material): void {
  if (m.polygonOffset) return;
  m.polygonOffset = true;
  m.polygonOffsetFactor = -2;
  m.polygonOffsetUnits = -2;
}

type AnyMat = THREE.Material & {
  color?: THREE.Color;
  map?: THREE.Texture | null;
  emissive?: THREE.Color;
  emissiveIntensity?: number;
  emissiveMap?: THREE.Texture | null;
};

export class StyleRenderer {
  style: StyleName = 'default';
  private renderer: THREE.WebGLRenderer;
  private cache = new Map<THREE.Material, THREE.Material>();
  private composer: EffectComposer | null = null;
  private composerFor: { scene: THREE.Scene; camera: THREE.Camera; style: StyleName } | null = null;
  private outline: OutlineEffect;
  private time = 0;

  constructor(renderer: THREE.WebGLRenderer) {
    this.renderer = renderer;
    this.outline = new OutlineEffect(renderer, { defaultThickness: 0.0085, defaultColor: [0.05, 0.04, 0.06], defaultAlpha: 1 });
    // The game uses the retro look. The others stay reachable with ?style=... for comparison.
    const fromUrl = new URLSearchParams(location.search).get('style') as StyleName | null;
    this.setStyle(fromUrl && STYLES.includes(fromUrl) ? fromUrl : 'ps1');
  }

  setStyle(s: StyleName): void {
    this.style = s;
    this.cache.clear();
    this.composer?.dispose();
    this.composer = null;
    this.composerFor = null;
    const pr = s === 'ps1' ? 0.25 : Math.min(devicePixelRatio, 2);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.domElement.style.imageRendering = s === 'ps1' ? 'pixelated' : '';
  }

  cycle(): StyleName {
    const next = STYLES[(STYLES.indexOf(this.style) + 1) % STYLES.length];
    this.setStyle(next);
    return next;
  }

  setSize(w: number, h: number): void {
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
    this.updateRes();
  }

  render(scene: THREE.Scene, camera: THREE.Camera, dt: number): void {
    this.time += dt;
    this.prepare(scene);
    try {
      this.draw(scene, camera, dt);
    } finally {
      // Give the game its own light values back, so animations like `intensity *= decay`
      // never see (and compound) the style's factor.
      for (const l of this.scaledLights) l.intensity = l.userData.rawIntensity as number;
      this.scaledLights.length = 0;
    }
  }

  private scaledLights: THREE.Light[] = [];
  /** Dims every light (power cuts). */
  lightScale = 1;

  private draw(scene: THREE.Scene, camera: THREE.Camera, dt: number): void {
    if (this.style === 'default') {
      this.renderer.render(scene, camera);
      return;
    }
    if (!this.composer || !this.composerFor || this.composerFor.scene !== scene || this.composerFor.camera !== camera || this.composerFor.style !== this.style) {
      this.buildComposer(scene, camera);
    }
    if (this.noir) this.noir.uniforms.time.value = this.time % 100;
    this.composer!.render(dt);
  }

  // ---------------------------------------------------------------- post-processing

  private noir: ShaderPass | null = null;
  private resPasses: ShaderPass[] = [];

  private buildComposer(scene: THREE.Scene, camera: THREE.Camera): void {
    this.composer?.dispose();
    const c = new EffectComposer(this.renderer);
    this.noir = null;
    this.resPasses = [];
    const size = new THREE.Vector2(innerWidth, innerHeight);
    switch (this.style) {
      case 'comic': {
        c.addPass(new OutlineRenderPass(this.outline, scene, camera));
        c.addPass(new OutputPass());
        const p = new ShaderPass(ComicShader);
        this.resPasses.push(p);
        c.addPass(p);
        break;
      }
      case 'ps1': {
        c.addPass(new RenderPass(scene, camera));
        c.addPass(new OutputPass());
        const p = new ShaderPass(Ps1Shader);
        this.resPasses.push(p);
        c.addPass(p);
        break;
      }
      case 'noir': {
        c.addPass(new RenderPass(scene, camera));
        c.addPass(new UnrealBloomPass(size, 0.55, 0.5, 0.78));
        c.addPass(new OutputPass());
        this.noir = new ShaderPass(NoirShader);
        c.addPass(this.noir);
        break;
      }
      case 'toy': {
        c.addPass(new RenderPass(scene, camera));
        c.addPass(new UnrealBloomPass(size, 0.15, 0.8, 0.9));
        c.addPass(new OutputPass());
        const h = new ShaderPass(HorizontalTiltShiftShader);
        const v = new ShaderPass(VerticalTiltShiftShader);
        h.uniforms.h.value = 4.5 / innerWidth;
        v.uniforms.v.value = 4.5 / innerHeight;
        h.uniforms.r.value = v.uniforms.r.value = 0.5;
        c.addPass(h);
        c.addPass(v);
        c.addPass(new ShaderPass(ToyGradeShader));
        break;
      }
    }
    this.composer = c;
    this.composerFor = { scene, camera, style: this.style };
    this.updateRes();
  }

  private updateRes(): void {
    const pr = this.renderer.getPixelRatio();
    for (const p of this.resPasses) p.uniforms.res.value.set(innerWidth * pr, innerHeight * pr);
    // One snap step per rendered pixel: still wobbly, but walls and floors no longer jump.
    ps1Snap.value.set(innerWidth * pr, innerHeight * pr);
  }

  // ---------------------------------------------------------------- materials and lights

  /** Swaps materials on every mesh to the style's version. Cheap enough to run every frame. */
  private prepare(scene: THREE.Scene): void {
    const style = this.style;
    this.atmosphere(scene);
    scene.traverse((o) => {
      const light = o as THREE.Light;
      if (light.isLight) {
        // Scaled only for this frame's render, render() restores the game's value afterwards.
        light.userData.rawIntensity = light.intensity;
        light.intensity *= this.lightFactor(light) * this.lightScale;
        this.scaledLights.push(light);
        return;
      }
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const ud = m.userData;
      if (ud.styleKey !== style || m.material !== ud.styledMat) {
        // New mesh, new style, or the game assigned a new material since the last frame.
        const base = (ud.styledMat && m.material !== ud.styledMat ? m.material : (ud.baseMat ?? m.material)) as THREE.Material | THREE.Material[];
        const styled = Array.isArray(base) ? base.map((b) => this.convert(b)) : this.convert(base);
        if (this.isLayer(m)) for (const s of Array.isArray(styled) ? styled : [styled]) pullForward(s);
        ud.baseMat = base;
        ud.styledMat = styled;
        ud.styleKey = style;
        m.material = styled;
      }
      // Keep animated properties (blinking eyes, flashes, fades) in sync.
      const base = ud.baseMat as THREE.Material | THREE.Material[];
      const styled = m.material;
      if (Array.isArray(base) && Array.isArray(styled)) base.forEach((b, i) => this.sync(b as AnyMat, styled[i] as AnyMat));
      else if (!Array.isArray(base) && !Array.isArray(styled)) this.sync(base as AnyMat, styled as AnyMat);
    });
  }

  /**
   * Thin flat meshes (signs, posters, stripes, price strips, stains) sit a few centimetres
   * in front of a wall or floor. The retro vertex snap moves their corners differently from
   * the wall's, so without help they slip behind it while the camera moves.
   */
  private isLayer(m: THREE.Mesh): boolean {
    const ud = m.userData;
    if (ud.isLayer !== undefined) return ud.isLayer as boolean;
    let layer = false;
    if (!(m as THREE.SkinnedMesh).isSkinnedMesh && m.geometry) {
      const g = m.geometry;
      if (!g.boundingBox) g.computeBoundingBox();
      const size = g.boundingBox!.getSize(new THREE.Vector3()).multiply(m.getWorldScale(new THREE.Vector3()));
      const d = [Math.abs(size.x), Math.abs(size.y), Math.abs(size.z)].sort((a, b) => a - b);
      // Thin, but not a whole floor or ceiling.
      layer = d[0] <= 0.06 && d[2] > 0.05 && d[1] * d[2] < 30;
    }
    ud.isLayer = layer;
    return layer;
  }

  /** Fog and background per style. The originals are kept on the scene. */
  private atmosphere(scene: THREE.Scene): void {
    const ud = scene.userData;
    if (!ud.atmoSaved) {
      ud.atmoSaved = true;
      ud.baseFog = scene.fog;
      ud.baseBg = scene.background;
    }
    if (ud.atmoStyle === this.style) return;
    ud.atmoStyle = this.style;
    scene.fog = ud.baseFog;
    scene.background = ud.baseBg;
    // A level can bring its own retro fog (outdoor jobs need more view distance):
    // scene.userData.retroFog = { color: '#...', near, far }
    const own = ud.retroFog as { color: string; near: number; far: number } | undefined;
    if (this.style === 'ps1' && own) {
      const c = new THREE.Color(own.color);
      scene.fog = new THREE.Fog(c, own.near, own.far);
      scene.background = c;
    } else if (this.style === 'ps1') {
      const fogColor = new THREE.Color('#1c1611');
      scene.fog = new THREE.Fog(fogColor, ud.baseFog ? 6 : 9, ud.baseFog ? 22 : 40);
      scene.background = fogColor;
    } else if (this.style === 'noir' && !ud.baseFog) {
      scene.fog = new THREE.Fog('#0b0b0b', 14, 42);
    } else if (this.style === 'toy' && !ud.baseFog) {
      scene.background = new THREE.Color('#f3e6d3');
    }
  }

  private lightFactor(l: THREE.Light): number {
    const hemi = (l as THREE.HemisphereLight).isHemisphereLight;
    switch (this.style) {
      case 'comic':
        return hemi ? 0.75 : 1.9;
      case 'noir':
        return hemi ? 0.45 : 1.8;
      case 'toy':
        return hemi ? 1.15 : 0.9;
      case 'ps1':
        return hemi ? 0.42 : 1.1;
      default:
        return 1;
    }
  }

  private sync(base: AnyMat, styled: AnyMat): void {
    if (base === styled) return;
    if (base.emissiveIntensity !== undefined && styled.emissiveIntensity !== undefined) styled.emissiveIntensity = base.emissiveIntensity;
    if (styled.opacity !== base.opacity) styled.opacity = base.opacity;
    styled.visible = base.visible;
    if (base.map !== undefined && styled.map !== base.map) styled.map = base.map ?? null;
    // Colors changed at runtime (cooking patties, blinking lights) must show up too.
    // The toy style keeps its own pastel version of the color.
    if (this.style !== 'toy') {
      if (base.color && styled.color && !styled.color.equals(base.color)) styled.color.copy(base.color);
      if (base.emissive && styled.emissive && !styled.emissive.equals(base.emissive)) styled.emissive.copy(base.emissive);
    }
  }

  private convert(mat: THREE.Material): THREE.Material {
    if (this.style === 'default') return mat;
    const cached = this.cache.get(mat);
    if (cached) return cached;
    let out: THREE.Material = mat;
    const src = mat as AnyMat;
    const lit = (mat as THREE.MeshStandardMaterial).isMeshStandardMaterial || (mat as THREE.MeshLambertMaterial).isMeshLambertMaterial;
    if (lit) {
      const common = {
        color: src.color?.clone(),
        map: src.map ?? null,
        emissive: src.emissive?.clone(),
        emissiveIntensity: src.emissiveIntensity,
        emissiveMap: src.emissiveMap ?? null,
        transparent: mat.transparent,
        opacity: mat.opacity,
        side: mat.side,
        depthWrite: mat.depthWrite,
        depthTest: mat.depthTest,
        alphaTest: mat.alphaTest,
        alphaMap: (mat as THREE.MeshStandardMaterial).alphaMap ?? null,
        vertexColors: mat.vertexColors,
        polygonOffset: mat.polygonOffset,
        polygonOffsetFactor: mat.polygonOffsetFactor,
        polygonOffsetUnits: mat.polygonOffsetUnits,
      };
      switch (this.style) {
        case 'comic':
          out = new THREE.MeshToonMaterial({ ...common, gradientMap: toonGradient });
          break;
        case 'ps1': {
          const l = new THREE.MeshLambertMaterial(common);
          if (l.map) {
            l.map.magFilter = THREE.NearestFilter;
            l.map.needsUpdate = true;
          }
          l.onBeforeCompile = (sh) => {
            sh.uniforms.uSnap = ps1Snap;
            sh.vertexShader = sh.vertexShader
              .replace('void main() {', 'uniform vec2 uSnap;\nvoid main() {')
              .replace('#include <project_vertex>', '#include <project_vertex>\n  gl_Position.xy = floor(gl_Position.xy / gl_Position.w * uSnap) / uSnap * gl_Position.w;');
          };
          l.customProgramCacheKey = () => 'ps1';
          out = l;
          break;
        }
        case 'noir': {
          const s = new THREE.MeshStandardMaterial({ ...common, roughness: 0.55, metalness: 0.15 });
          out = s;
          break;
        }
        case 'toy': {
          const color = common.color ?? new THREE.Color('#ffffff');
          const hsl = { h: 0, s: 0, l: 0 };
          color.getHSL(hsl);
          color.setHSL(hsl.h, Math.min(1, hsl.s * 0.9 + 0.15), Math.min(0.93, hsl.l * 0.65 + 0.32));
          out = new THREE.MeshStandardMaterial({ ...common, color, roughness: 0.9, metalness: 0 });
          break;
        }
      }
    } else if ((mat as THREE.MeshBasicMaterial).isMeshBasicMaterial) {
      // Flat things (bubbles, puddles, faces) get no outline.
      mat.userData.outlineParameters = { visible: false };
    }
    this.cache.set(mat, out);
    return out;
  }
}

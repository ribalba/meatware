import * as THREE from 'three';

/**
 * Collects copies of one shape and bakes them into merged meshes, one per floor chunk,
 * so the thousands of rack parts cost a few draw calls and the parts behind the camera
 * are culled.
 */
export class Batch {
  private m: THREE.Matrix4[] = [];
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  add(x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, ry = 0, _color?: string, rx = 0, rz = 0): void {
    this.e.set(rx, ry, rz);
    this.q.setFromEuler(this.e);
    this.m.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), this.q.clone(), new THREE.Vector3(sx, sy, sz)));
  }
  get count(): number {
    return this.m.length;
  }
  build(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], chunk = 10): THREE.Mesh[] {
    const cells = new Map<string, THREE.BufferGeometry[]>();
    const p = new THREE.Vector3();
    for (const mm of this.m) {
      p.setFromMatrixPosition(mm);
      const key = `${Math.floor(p.x / chunk)},${Math.floor(p.z / chunk)}`;
      const g = geo.clone().applyMatrix4(mm);
      let list = cells.get(key);
      if (!list) cells.set(key, (list = []));
      list.push(g);
    }
    const out: THREE.Mesh[] = [];
    for (const list of cells.values()) {
      const mesh = new THREE.Mesh(mergeAll(list), mat);
      parent.add(mesh);
      out.push(mesh);
      for (const g of list) g.dispose();
    }
    return out;
  }
}

/**
 * Merges geometries with the same attributes (position, normal, uv) into one.
 * Material groups are kept: all faces of one material index end up in one group.
 */
export function mergeAll(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let vCount = 0;
  for (const g of geos) vCount += g.attributes.position.count;
  const pos = new Float32Array(vCount * 3);
  const nor = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const byMat = new Map<number, number[]>();
  let vo = 0;
  for (const g of geos) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array as Float32Array, vo * 3);
    nor.set(g.attributes.normal.array as Float32Array, vo * 3);
    uv.set(g.attributes.uv.array as Float32Array, vo * 2);
    const idx = g.index ? Array.from(g.index.array) : Array.from({ length: n }, (_, k) => k);
    const groups = g.groups.length ? g.groups : [{ start: 0, count: idx.length, materialIndex: 0 }];
    for (const gr of groups) {
      const mi = gr.materialIndex ?? 0;
      let list = byMat.get(mi);
      if (!list) byMat.set(mi, (list = []));
      for (let k = gr.start; k < gr.start + gr.count; k++) list.push(idx[k] + vo);
    }
    vo += n;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const all: number[] = [];
  const keys = [...byMat.keys()].sort((a, b) => a - b);
  for (const k of keys) {
    const list = byMat.get(k)!;
    out.addGroup(all.length, list.length, k);
    for (const i of list) all.push(i);
  }
  out.setIndex(new THREE.BufferAttribute(vCount > 65535 ? new Uint32Array(all) : new Uint16Array(all), 1));
  out.computeBoundingSphere();
  return out;
}

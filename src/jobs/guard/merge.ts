import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Merges all static meshes under `root` into one mesh per material. The plant is full of
 * small props and the CCTV renders the scene several times per frame, so this keeps the
 * draw calls low. Meshes that are interactive (userData.interact on them or a parent) or
 * marked with userData.dynamic (on them or a parent) are left alone.
 */
export function mergeStatic(root: THREE.Object3D): number {
  root.updateMatrixWorld(true);
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const merged: THREE.Mesh[] = [];
  const skip = (o: THREE.Object3D): boolean => {
    for (let p: THREE.Object3D | null = o; p && p !== root; p = p.parent) {
      if (p.userData.interact || p.userData.dynamic) return true;
    }
    return false;
  };
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || (m as THREE.SkinnedMesh).isSkinnedMesh || (m as unknown as THREE.InstancedMesh).isInstancedMesh) return;
    if (!m.visible || skip(m)) return;
    const src = m.geometry;
    if (!src.attributes.position) return;
    let g = new THREE.BufferGeometry();
    g.setAttribute('position', toFloat(src.attributes.position, 3));
    if (src.attributes.normal) g.setAttribute('normal', toFloat(src.attributes.normal, 3));
    if (src.attributes.uv) g.setAttribute('uv', toFloat(src.attributes.uv, 2));
    if (src.index) g.setIndex(src.index.clone());
    for (const gr of src.groups) g.addGroup(gr.start, gr.count, gr.materialIndex);
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(m.matrixWorld);
    if (g.index) g = g.toNonIndexed();
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const parts: [THREE.Material, THREE.BufferGeometry][] = [];
    if (Array.isArray(m.material) && g.groups.length) {
      for (const gr of g.groups) {
        const mat = mats[gr.materialIndex ?? 0];
        if (!mat) continue;
        parts.push([mat, slice(g, gr.start, gr.count)]);
      }
    } else {
      g.clearGroups();
      parts.push([mats[0], g]);
    }
    for (const [mat, geo] of parts) {
      let list = buckets.get(mat);
      if (!list) buckets.set(mat, (list = []));
      list.push(geo);
    }
    merged.push(m);
  });
  for (const m of merged) m.parent?.remove(m);
  let n = 0;
  for (const [mat, list] of buckets) {
    const geo = mergeGeometries(list, false);
    if (!geo) continue;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = 'merged';
    mesh.matrixAutoUpdate = false;
    root.add(mesh);
    n++;
  }
  return n;
}

function slice(g: THREE.BufferGeometry, start: number, count: number): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const a = g.attributes[name] as THREE.BufferAttribute | undefined;
    if (!a) continue;
    const arr = (a.array as Float32Array).slice(start * a.itemSize, (start + count) * a.itemSize);
    out.setAttribute(name, new THREE.BufferAttribute(arr, a.itemSize));
  }
  return out;
}

/** A plain float copy of an attribute (also for interleaved or quantized ones). */
function toFloat(a: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, size: number): THREE.BufferAttribute {
  const n = a.count;
  const arr = new Float32Array(n * size);
  for (let i = 0; i < n; i++) {
    arr[i * size] = a.getX(i);
    if (size > 1) arr[i * size + 1] = a.getY(i);
    if (size > 2) arr[i * size + 2] = a.getZ(i);
  }
  return new THREE.BufferAttribute(arr, size);
}

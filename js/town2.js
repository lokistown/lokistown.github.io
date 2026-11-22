// The whole town in one style (Kenney Fantasy Town Kit + Nature Kit, CC0):
// every block not used by Loki is lined with timber cottages facing the streets, with gardens
// behind; the outskirts have taller townhouses, mills and farm fields; streets get lanterns.
// Layout is planned synchronously (colliders, map), models arrive a moment later and each block
// is merged into a few meshes so the whole town stays fast.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { cottage, kitModel, preload } from './kit.js';
import { model, modelAsync } from './models.js';
import { PLOT, ROAD } from './layout.js';

const CELL = 2.4; // one kit tile in metres (a storey is 2.4 m)
const ROOFS = ['red', 'red', 'blue', 'brown', 'teal', 'slate', 'green', 'plum'];

export function rand(seed) {
  let s = 0;
  for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Merge every mesh in a group into one mesh per material (draw calls stay low).
export function mergeGroup(group) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const byMat = new Map();
  group.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    const list = byMat.get(o.material) || [];
    list.push(g);
    byMat.set(o.material, list);
  });
  const out = new THREE.Group();
  for (const [mat, geos] of byMat) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const m = new THREE.Mesh(merged, mat);
    m.castShadow = m.receiveShadow = true;
    out.add(m);
  }
  out.position.copy(group.position);
  out.rotation.copy(group.rotation);
  out.scale.copy(group.scale);
  return out;
}

// Plan one block lined with cottages: rows along the four street sides, gardens inside.
function planBlock(info, r, tall) {
  const half = PLOT / 2 - ROAD / 2 - 0.9; // inner edge of the pavement
  const depth = 2 * CELL;
  const items = [];
  const sides = [
    { nx: 0, nz: 1, len: half * 2 }, // south row faces +z
    { nx: 0, nz: -1, len: half * 2 },
    { nx: 1, nz: 0, len: half * 2 - 2 * depth - 1 },
    { nx: -1, nz: 0, len: half * 2 - 2 * depth - 1 },
  ];
  for (const s of sides) {
    let t = -s.len / 2;
    while (t < s.len / 2 - CELL * 2) {
      const w = Math.min(Math.floor((s.len / 2 - t) / CELL), 2 + Math.floor(r() * 3));
      if (w < 2) break;
      const len = w * CELL;
      const along = t + len / 2;
      const off = half - depth / 2;
      // tangent is perpendicular to the outward normal
      const tx = -s.nz, tz = s.nx;
      const x = info.x + s.nx * off + tx * along, z = info.z + s.nz * off + tz * along;
      const floors = tall ? 2 + Math.floor(r() * 2) : r() < 0.35 ? 1 : 2;
      items.push({ kind: 'cottage', x, z, rot: Math.atan2(s.nx, s.nz), w, floors, roof: ROOFS[Math.floor(r() * ROOFS.length)], seed: `${info.i},${info.j},${t}`, hw: s.nx ? depth / 2 : len / 2, hd: s.nx ? len / 2 : depth / 2, h: (floors + 0.8) * CELL });
      t += len + (r() < 0.3 ? 1.2 : 0.15);
    }
  }
  // garden courtyard
  for (let k = 0; k < 4; k++) items.push({ kind: 'tree', x: info.x + (r() - 0.5) * 8, z: info.z + (r() - 0.5) * 8, s: 0.9 + r() * 0.5, v: Math.floor(r() * 4) });
  return items;
}
function planPark(info, r) {
  const items = [];
  for (let k = 0; k < 7; k++) items.push({ kind: 'tree', x: info.x + (r() - 0.5) * 22, z: info.z + (r() - 0.5) * 22, s: 1 + r() * 0.6, v: Math.floor(r() * 4) });
  for (let k = 0; k < 6; k++) items.push({ kind: 'hedge', x: info.x + (k - 2.5) * 2.6, z: info.z + info.dz * 11 + (info.dz ? 0 : (r() - 0.5) * 4), rot: info.rot });
  items.push({ kind: 'stall', x: info.x - info.dx * 3, z: info.z - info.dz * 3, rot: info.rot, v: r() < 0.5 ? 'stall-red' : 'stall-green' });
  return items;
}
function planOutskirts(info, r) {
  const items = [];
  const roll = r();
  if (roll < 0.25) items.push({ kind: 'mill', x: info.x, z: info.z, rot: r() * 6, v: r() < 0.6 ? 'windmill' : 'watermill', hw: 3.2, hd: 3.2, h: 12 });
  if (roll < 0.6) {
    // farm field with crops and a fence
    const crops = ['crop_carrot', 'crop_pumpkin', 'crop_turnip', 'crop_melon'];
    const c = crops[Math.floor(r() * crops.length)];
    for (let a = -3; a <= 3; a++) for (let b = -2; b <= 2; b++) items.push({ kind: 'crop', x: info.x + a * 2.2 + 6, z: info.z + b * 2.2 + 4, v: c });
    for (let k = -4; k <= 4; k++) items.push({ kind: 'fence', x: info.x + k * 2 + 6, z: info.z - 2, rot: 0 });
    for (let k = 0; k < 3; k++) items.push({ kind: 'tree', x: info.x + (r() - 0.5) * 24, z: info.z - 9 + (r() - 0.5) * 6, s: 1.1 + r() * 0.5, v: Math.floor(r() * 4) });
    return items;
  }
  return planBlock(info, r, true);
}

const TREES = ['nature/tree_oak', 'nature/tree_default', 'nature/tree_detailed', 'nature/tree_fat'];

export function createNeighbourhood(group, usedPlots, maxRing, plotInfoFn) {
  const colliders = [];
  const decor = [];
  const blocks = [];
  for (let idx = 0; idx < 600; idx++) {
    const info = plotInfoFn(idx);
    if (info.ring > maxRing + 1) break;
    if (usedPlots.has(idx)) continue;
    const r = rand(`block${idx}`);
    let items;
    if (info.ring > maxRing) items = planOutskirts(info, r);
    else items = r() < 0.8 ? planBlock(info, r, false) : planPark(info, r);
    for (const it of items) {
      if (it.hw) {
        colliders.push({ x: it.x, z: it.z, hw: it.hw, hd: it.hd, h: it.h || 6 });
        decor.push({ x: it.x, z: it.z, hw: it.hw, hd: it.hd, kind: it.kind === 'mill' ? 'tower' : 'home', roof: it.roof });
      } else if (it.kind === 'tree') {
        colliders.push({ x: it.x, z: it.z, hw: 0.5, hd: 0.5, h: 4 });
        decor.push({ x: it.x, z: it.z, kind: 'tree' });
      } else if (it.kind === 'stall') colliders.push({ x: it.x, z: it.z, hw: 1.3, hd: 1.3, h: 2 });
    }
    blocks.push({ info, items });
  }
  // lanterns and trees along every street (kit lanterns glow at night)
  const ext = (maxRing + 0.5) * PLOT;
  const street = [];
  for (let k = -maxRing; k <= maxRing + 1; k++) {
    const c = (k - 0.5) * PLOT;
    for (let s = -ext + 4; s <= ext - 4; s += 10) {
      if (Math.abs(s) < 15 && Math.abs(c) < 17) continue;
      if (Math.abs(((s + PLOT / 2) % PLOT + PLOT) % PLOT - PLOT / 2) > PLOT / 2 - 4) continue; // not inside crossings
      const side = ROAD / 2 + 0.55;
      for (const [x, z] of [[c + side, s], [s, c - side]]) {
        street.push({ x, z, lantern: Math.round(s / 10) % 2 === 0 });
        colliders.push({ x, z, hw: 0.25, hd: 0.25, h: 3 });
      }
    }
  }
  // build the models (async), merging each block
  const ready = (async () => {
    await preload(['lantern', 'stall-red', 'stall-green', 'hedge', 'windmill', 'watermill', 'fence']);
    for (const { info, items } of blocks) {
      const blk = new THREE.Group();
      for (const it of items) {
        let m;
        if (it.kind === 'cottage') m = await cottage({ w: it.w, floors: it.floors, roof: it.roof, seed: it.seed, cell: CELL });
        else if (it.kind === 'stall') m = await kitModel(it.v, { scale: 2.6 });
        else if (it.kind === 'hedge') m = await kitModel('hedge', { scale: 2.6 });
        else if (it.kind === 'fence') m = await kitModel('fence', { scale: 2 });
        else if (it.kind === 'mill') m = await kitModel(it.v, { scale: 3.2 });
        else if (it.kind === 'tree') m = await modelAsync(TREES[it.v % TREES.length], 2.4 * it.s, 2.4 * it.s, { h: 5.2 * it.s });
        else if (it.kind === 'crop') m = await modelAsync(`nature/${it.v}`, 1.4, 1.4, { h: 0.9 });
        if (!m) continue;
        m.position.set(it.x, 0, it.z);
        m.rotation.y = it.rot || 0;
        blk.add(m);
      }
      group.add(mergeGroup(blk));
    }
    const lights = new THREE.Group();
    for (const s of street) {
      if (s.lantern) {
        const l = await kitModel('lantern', { scale: 2.1 });
        l.position.set(s.x, 0, s.z);
        lights.add(l);
      } else {
        const t = await modelAsync('nature/tree_default', 1.8, 1.8, { h: 4.2 });
        t.position.set(s.x, 0, s.z);
        lights.add(t);
      }
    }
    group.add(mergeGroup(lights));
  })().catch((e) => console.warn('neighbourhood failed', e));
  return { colliders, decor, ready };
}

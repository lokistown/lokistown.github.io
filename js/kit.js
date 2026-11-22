// Kenney Fantasy Town Kit (CC0): modular 1x1 tiles. This builds whole cozy cottages, shops and
// towers from the kit's real walls, windows, doors and roofs, so every building in town shares
// one professional style. Models are cached and cloned; roof colours come from tinted colour maps.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const cache = new Map();
const ramp = (() => {
  const t = new THREE.DataTexture(new Uint8Array([120, 185, 235, 255]), 4, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

// Roof palettes: the kit's colour map has one roof swatch; we recolour it per house.
const ROOF = { teal: null, red: '#c4553f', blue: '#4f74b8', brown: '#8c5a3c', slate: '#5d6b7a', green: '#5f9a5a', plum: '#8e5d93' };
const mats = new Map();
function toonOf(src, roof) {
  const key = `${src.uuid}:${roof}`;
  if (mats.has(key)) return mats.get(key);
  const m = new THREE.MeshToonMaterial({ map: src.map || null, color: src.color?.clone() || new THREE.Color('#fff'), gradientMap: ramp });
  if (m.map) m.map.colorSpace = THREE.SRGBColorSpace;
  if (roof && ROOF[roof] && m.map) m.map = roofMap(m.map, ROOF[roof]);
  mats.set(key, m);
  return m;
}
// Swap the teal roof swatch in the colour map for another colour.
const roofMaps = new Map();
function roofMap(tex, color) {
  if (roofMaps.has(color)) return roofMaps.get(color);
  const img = tex.image;
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  const want = new THREE.Color(color);
  for (let i = 0; i < d.data.length; i += 4) {
    const r = d.data[i], gg = d.data[i + 1], b = d.data[i + 2];
    // teal-ish pixels (the roof swatches): g and b high, r low
    if (gg > r + 30 && b > r + 15 && Math.abs(gg - b) < 70) {
      const l = Math.min(1.3, (r + gg + b) / 3 / 115);
      d.data[i] = Math.min(255, want.r * 255 * l);
      d.data[i + 1] = Math.min(255, want.g * 255 * l);
      d.data[i + 2] = Math.min(255, want.b * 255 * l);
    }
  }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = tex.flipY;
  t.magFilter = THREE.NearestFilter;
  roofMaps.set(color, t);
  return t;
}

export function loadPiece(name, dir = 'fantasy') {
  const key = `${dir}/${name}`;
  if (!cache.has(key)) cache.set(key, loader.loadAsync(`vendor/models/${key}.glb`).then((g) => g.scene).catch((e) => (console.warn('kit piece failed', key, e), null)));
  return cache.get(key);
}
export const preload = (names, dir) => Promise.all(names.map((n) => loadPiece(n, dir)));

// A clone of a piece (sync once preloaded), toon-shaded, optional roof colour.
function piece(src, roof) {
  const m = src.clone(true);
  m.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    o.material = toonOf(o.material, roof);
  });
  return m;
}
export async function kitModel(name, { roof = null, scale = 1, dir = 'fantasy' } = {}) {
  const src = await loadPiece(name, dir);
  const g = new THREE.Group();
  if (src) {
    const m = piece(src, roof);
    m.scale.setScalar(scale);
    g.add(m);
  }
  return g;
}

// Places a piece in a group at a grid cell. Wall pieces sit on the cell's +x edge; `face` is the
// outward direction: 'e' (+x), 'w' (-x), 's' (+z), 'n' (-z).
export const ROOF_FACE = { front: 'n', back: 's' };
const FACE = { e: 0, w: Math.PI, s: -Math.PI / 2, n: Math.PI / 2 };
function put(group, src, x, y, z, face = 'e', roof = null) {
  if (!src) return;
  const m = piece(src, roof);
  m.position.set(x, y, z);
  m.rotation.y = FACE[face] ?? face;
  group.add(m);
  return m;
}

const rand = (seed) => {
  let s = 0;
  for (const c of String(seed)) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
};

// A cottage: w cells along x (front faces +z), depth 2, 1-2 floors, gable roof along x.
// Returns a THREE.Group already scaled to `cell` world units per tile.
export async function cottage({ w = 3, floors = 2, roof = 'red', seed = 'x', cell = 2.4, door = true, wood = true, sign = null } = {}) {
  const r = rand(seed);
  const names = ['wall', 'wall-window-shutters', 'wall-window-glass', 'wall-window-round', 'wall-door', 'wall-wood', 'wall-wood-window-shutters', 'wall-wood-window-glass', 'wall-wood-detail-cross', 'roof', 'roof-left', 'roof-right', 'roof-gable', 'roof-gable-end', 'chimney', 'chimney-top', 'banner-red', 'banner-green', 'lantern', 'overhang', 'wall-corner'];
  await preload(names);
  const P = {};
  for (const n of names) P[n] = await loadPiece(n);
  const g = new THREE.Group();
  const d = 2;
  const ox = (w - 1) / 2, oz = (d - 1) / 2;
  const doorAt = Math.floor(w / 2);
  for (let f = 0; f < floors; f++) {
    const up = f > 0 && wood;
    const plain = up ? 'wall-wood' : 'wall';
    const win = up ? (r() < 0.5 ? 'wall-wood-window-shutters' : 'wall-wood-window-glass') : r() < 0.6 ? 'wall-window-shutters' : 'wall-window-glass';
    for (let i = 0; i < w; i++) {
      const x = i - ox;
      // front (+z) and back (-z)
      const front = f === 0 && door && i === doorAt ? 'wall-door' : (i + f) % 2 === 0 || w < 3 ? win : up ? 'wall-wood-detail-cross' : plain;
      put(g, P[front], x, f, oz, 's');
      put(g, P[(i + f) % 2 ? win : plain], x, f, -oz, 'n');
    }
    for (let j = 0; j < d; j++) {
      const z = j - oz;
      put(g, P[j === 0 ? win : plain], -ox, f, z, 'w');
      put(g, P[j === 1 ? win : plain], ox, f, z, 'e');
    }
  }
  // gable roof: slopes on the front and back rows, closed ends
  const y = floors;
  for (let i = 0; i < w; i++) {
    const x = i - ox;
    const endL = i === 0, endR = i === w - 1;
    put(g, P[endL ? 'roof-left' : endR ? 'roof-right' : 'roof'], x, y, oz, ROOF_FACE.front, roof);
    put(g, P[endL ? 'roof-right' : endR ? 'roof-left' : 'roof'], x, y, -oz, ROOF_FACE.back, roof);
  }
  // a small brick chimney poking out of the back slope
  if (r() < 0.7) {
    const ch = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.7, 0.28), toonOf({ color: new THREE.Color('#9a6a55') }));
    ch.position.set((r() < 0.5 ? -1 : 1) * Math.max(0, ox - 0.4), y + 0.45, -0.3);
    ch.castShadow = true;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.36), toonOf({ color: new THREE.Color('#6d4a3c') }));
    cap.position.y = 0.37;
    ch.add(cap);
    g.add(ch);
  }
  if (sign) put(g, P[sign], ox + 0.02, Math.max(0.6, floors - 0.6), oz, 'e');
  g.scale.setScalar(cell);
  g.userData.size = { w: w * cell, d: d * cell, h: (floors + 0.7) * cell };
  return g;
}

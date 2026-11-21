// Real 3D models (Kenney's free CC0 kits) — loaded once, cached, fitted to a footprint.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const cache = new Map();
const ramp = (() => {
  const t = new THREE.DataTexture(new Uint8Array([110, 175, 225, 255]), 4, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

// Natural colours for the nature kit (its presets read as teal under our lights).
const NATURE = [
  [/leafs?Fall|fall/i, '#e58a3a'],
  [/leafs?Dark|dark/i, '#3f7a43'],
  [/leafs?|leaves|grass|bush|plant|green/i, '#62a95a'],
  [/bark|wood|log|trunk/i, '#8b5a3c'],
  [/stone|rock|cliff/i, '#b9b3a8'],
  [/dirt|ground|soil/i, '#a9794f'],
];
function prepare(scene, path) {
  const nature = path.startsWith('nature/');
  scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const old = Array.isArray(o.material) ? o.material : [o.material];
    const conv = old.map((m) => {
      const t = new THREE.MeshToonMaterial({ color: m.color ? m.color.clone() : new THREE.Color('#fff'), map: m.map || null, gradientMap: ramp, transparent: m.transparent, opacity: m.opacity, vertexColors: !!o.geometry.attributes.color, side: m.side });
      if (t.map) t.map.colorSpace = THREE.SRGBColorSpace;
      if (nature && !/flower|petal|red|yellow|purple|blue|white|pink|mushroom/i.test(m.name || '')) {
        const hit = NATURE.find(([re]) => re.test(m.name || ''));
        if (hit) t.color.set(hit[1]);
      }
      return t;
    });
    o.material = Array.isArray(o.material) ? conv : conv[0];
  });
  return scene;
}

export function loadModel(path) {
  if (!cache.has(path)) cache.set(path, loader.loadAsync(`vendor/models/${path}.glb`).then((g) => prepare(g.scene, path)).catch((e) => (console.warn('model failed', path, e), null)));
  return cache.get(path);
}

// A group that fills itself with the model once loaded, scaled to fit w×d (and optionally height h).
export function model(path, w, d, { h = null, y = 0, rot = 0, stretch = false } = {}) {
  const g = new THREE.Group();
  g.userData.model = path;
  loadModel(path).then((src) => {
    if (!src) return;
    const m = src.clone(true);
    const box = new THREE.Box3().setFromObject(m);
    const size = box.getSize(new THREE.Vector3());
    const rotated = Math.abs(Math.sin(rot)) > 0.5;
    const sx = (rotated ? d : w) / Math.max(0.01, size.x), sz = (rotated ? w : d) / Math.max(0.01, size.z);
    let s = Math.min(sx, sz);
    if (h) s = Math.min(s, h / Math.max(0.01, size.y));
    if (stretch) m.scale.set(sx, h ? h / size.y : s, sz);
    else m.scale.setScalar(s);
    const b2 = new THREE.Box3().setFromObject(m);
    const c = b2.getCenter(new THREE.Vector3());
    m.position.set(-c.x, -b2.min.y + y, -c.z);
    const pivot = new THREE.Group();
    pivot.add(m);
    pivot.rotation.y = rot;
    g.add(pivot);
  });
  return g;
}

export function preload(paths) {
  return Promise.all(paths.map(loadModel));
}

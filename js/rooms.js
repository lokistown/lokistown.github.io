// Rooms and furniture. Furniture always stands against a wall, in a corner, so the
// middle of every wall (where doorways are) stays clear. Each item is modelled to read
// as the real object: sofas, fridges, washing machines, pianos, easels...
import * as THREE from 'three';
import { toon, block, part, paperTexture } from './toon.js';

const WOOD = '#a8754a', DARK = '#5b3a29', CREAM = '#fff3dc', METAL = '#9aa5ab', BLACK = '#2b2d42';
const cyl = (r1, r2, h, s = 16) => new THREE.CylinderGeometry(r1, r2, h, s);
const sph = (r, a = 16, b = 12) => new THREE.SphereGeometry(r, a, b);

// ---------------- reusable objects (all built facing +z, origin at floor centre) ----------------
export function flower(color = '#ef476f', h = 0.35) {
  const g = new THREE.Group();
  g.add(block(0.02, h, 0.02, '#3f8f4f', 0, h / 2, 0, { ink: false, cast: false }));
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    const p = part(sph(0.05, 8, 6), color, { x: Math.cos(a) * 0.05, y: h, z: Math.sin(a) * 0.05, ink: 0, shadow: false });
    p.scale.set(1, 0.45, 1);
    g.add(p);
  }
  g.add(part(sph(0.035, 8, 6), '#ffd166', { y: h + 0.02, ink: 0, shadow: false }));
  g.add(part(sph(0.05, 6, 4), '#57b368', { x: 0.04, y: h * 0.45, ink: 0, shadow: false }).rotateZ(-0.6));
  return g;
}
export function pottedPlant(s = 1) {
  const g = new THREE.Group();
  g.add(part(cyl(0.22 * s, 0.17 * s, 0.38 * s, 14), '#c96f4a', { y: 0.19 * s, ink: 0.015 }));
  g.add(part(cyl(0.2 * s, 0.2 * s, 0.03, 14), '#4a3221', { y: 0.37 * s, ink: 0 }));
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2;
    const leaf = part(sph(0.09 * s, 10, 8), k % 2 ? '#3f9a52' : '#57b368', { x: Math.cos(a) * 0.12 * s, y: 0.62 * s + (k % 3) * 0.08 * s, z: Math.sin(a) * 0.12 * s, ink: 0.01 });
    leaf.scale.set(0.6, 2.2, 0.35);
    leaf.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
    g.add(leaf);
  }
  return g;
}
function rug(w, d, color, accent = '#fff3dc') {
  const g = new THREE.Group();
  const r = new THREE.Mesh(new THREE.BoxGeometry(w, 0.025, d), toon(color));
  r.position.y = 0.012;
  r.receiveShadow = true;
  const b = new THREE.Mesh(new THREE.BoxGeometry(w - 0.25, 0.03, d - 0.25), toon(accent));
  b.position.y = 0.013;
  const c = new THREE.Mesh(new THREE.BoxGeometry(w - 0.4, 0.035, d - 0.4), toon(color));
  c.position.y = 0.014;
  g.add(r, b, c);
  return g;
}
function sofa(w = 1.6, color = '#e07a1f') {
  const g = new THREE.Group();
  const dark = new THREE.Color(color).offsetHSL(0, 0, -0.08).getStyle();
  g.add(block(w, 0.22, 0.8, DARK, 0, 0.11, 0));
  g.add(block(w - 0.3, 0.2, 0.62, color, 0, 0.32, 0.06));
  g.add(block(w, 0.55, 0.2, dark, 0, 0.5, -0.3));
  for (const s of [-1, 1]) g.add(block(0.16, 0.45, 0.8, dark, s * (w / 2 - 0.08), 0.37, 0));
  for (let k = 0; k < 2; k++) g.add(block((w - 0.34) / 2 - 0.02, 0.32, 0.12, color, -w / 4 + 0.085 + k * (w / 2 - 0.17), 0.58, -0.17));
  const pillow = part(sph(0.13, 12, 8), CREAM, { x: w / 2 - 0.34, y: 0.52, z: -0.08, ink: 0.01 });
  pillow.scale.set(1, 1, 0.5);
  g.add(pillow);
  return g;
}
function tvUnit() {
  const g = new THREE.Group();
  g.add(block(1.4, 0.45, 0.45, '#8d5b3c', 0, 0.23, 0));
  for (const x of [-0.35, 0.35]) g.add(block(0.6, 0.32, 0.02, '#a0704a', x, 0.24, 0.235, { ink: false }));
  g.add(block(1.15, 0.68, 0.06, BLACK, 0, 0.88, -0.05));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.58), new THREE.MeshBasicMaterial({ color: '#3a5a7a' }));
  scr.position.set(0, 0.88, -0.015);
  g.add(scr, block(0.25, 0.04, 0.18, BLACK, 0, 0.48, -0.05, { ink: false }), block(0.05, 0.08, 0.05, BLACK, 0, 0.52, -0.05, { ink: false }));
  g.userData.screen = scr;
  return g;
}
function bookshelf(w = 1.2, h = 1.9) {
  const g = new THREE.Group();
  g.add(block(w, h, 0.38, '#8d5b3c', 0, h / 2, 0));
  const cols = ['#e63946', '#457b9d', '#ffd166', '#06a77d', '#8e7cc3', '#f28c28', '#3d405b'];
  for (let s = 0; s < 4; s++) {
    const y = 0.12 + s * (h / 4);
    g.add(block(w - 0.06, 0.03, 0.34, '#6b4226', 0, y, 0.03, { ink: false }));
    let x = -w / 2 + 0.08;
    let k = s * 3;
    while (x < w / 2 - 0.12) {
      const bw = 0.05 + ((k * 13) % 4) * 0.012, bh = 0.25 + ((k * 7) % 5) * 0.03;
      g.add(block(bw, bh, 0.26, cols[k % cols.length], x + bw / 2, y + 0.015 + bh / 2, 0.05, { ink: false }));
      x += bw + 0.008;
      k++;
    }
  }
  return g;
}
function floorLamp() {
  const g = new THREE.Group();
  g.add(part(cyl(0.16, 0.18, 0.04), BLACK, { y: 0.02, ink: 0 }), block(0.04, 1.5, 0.04, BLACK, 0, 0.77, 0, { ink: false }));
  g.add(part(new THREE.CylinderGeometry(0.16, 0.26, 0.32, 16, 1, true), '#ffe6a8', { y: 1.55, ink: 0.01, mat: new THREE.MeshToonMaterial({ color: '#ffe6a8', emissive: '#ffcf6e', emissiveIntensity: 0.35, side: THREE.DoubleSide }) }));
  return g;
}
function table(w, d, color = WOOD) {
  const g = new THREE.Group();
  g.add(block(w, 0.06, d, color, 0, 0.75, 0));
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(block(0.06, 0.72, 0.06, DARK, a * (w / 2 - 0.07), 0.36, b * (d / 2 - 0.07), { ink: false }));
  return g;
}
function chair(color = WOOD) {
  const g = new THREE.Group();
  g.add(block(0.44, 0.05, 0.44, color, 0, 0.46, 0), block(0.44, 0.48, 0.05, color, 0, 0.72, -0.2));
  for (const [a, b] of [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]]) g.add(block(0.04, 0.46, 0.04, DARK, a, 0.23, b, { ink: false }));
  return g;
}
function bistro() {
  const g = new THREE.Group();
  g.add(part(cyl(0.38, 0.38, 0.04, 20), '#f8f9fa', { y: 0.74, ink: 0.01 }), part(cyl(0.04, 0.04, 0.72, 8), BLACK, { y: 0.37, ink: 0 }), part(cyl(0.22, 0.25, 0.03, 14), BLACK, { y: 0.015, ink: 0 }));
  g.add(part(cyl(0.05, 0.04, 0.1, 10), '#fff', { y: 0.81, x: 0.1, ink: 0.008 }));
  for (const s of [-1, 1]) {
    const c = chair('#e07a1f');
    c.scale.setScalar(0.85);
    c.position.set(s * 0.62, 0, 0);
    c.rotation.y = -s * Math.PI / 2;
    g.add(c);
  }
  return g;
}
function kitchenCounter(w = 1.7) {
  const g = new THREE.Group();
  g.add(block(w, 0.86, 0.6, '#f1e3c8', 0, 0.43, 0));
  for (let k = 0; k < 3; k++) g.add(block(w / 3 - 0.06, 0.7, 0.02, '#e3d0ad', -w / 3 + k * (w / 3), 0.43, 0.305, { ink: false }), block(0.12, 0.02, 0.03, METAL, -w / 3 + k * (w / 3), 0.72, 0.32, { ink: false }));
  g.add(block(w + 0.04, 0.05, 0.64, '#6c757d', 0, 0.885, 0));
  // sink
  g.add(block(0.42, 0.04, 0.34, '#adb5bd', -w / 2 + 0.38, 0.9, 0.02, { ink: false }), block(0.03, 0.22, 0.03, METAL, -w / 2 + 0.38, 1.0, -0.17, { ink: false }), block(0.03, 0.03, 0.14, METAL, -w / 2 + 0.38, 1.1, -0.11, { ink: false }));
  // hob + pan
  for (const [x, z] of [[0.35, -0.1], [0.6, -0.1], [0.35, 0.14], [0.6, 0.14]]) g.add(part(cyl(0.08, 0.08, 0.012, 12), BLACK, { x: x + (w - 1.7) / 2, y: 0.915, z, ink: 0 }));
  g.add(part(cyl(0.12, 0.1, 0.07, 14), '#c4621a', { x: 0.35 + (w - 1.7) / 2, y: 0.96, z: -0.1, ink: 0.01 }));
  // wall cabinets
  g.add(block(w, 0.55, 0.32, '#e3d0ad', 0, 1.75, -0.14));
  return g;
}
function fridge() {
  const g = new THREE.Group();
  g.add(block(0.72, 1.85, 0.66, '#e9f5f7', 0, 0.93, 0));
  g.add(block(0.7, 0.02, 0.02, '#b8c4c8', 0, 1.25, 0.335, { ink: false }), block(0.03, 0.4, 0.04, METAL, 0.28, 1.55, 0.35, { ink: false }), block(0.03, 0.5, 0.04, METAL, 0.28, 0.85, 0.35, { ink: false }));
  g.add(block(0.08, 0.08, 0.01, '#ffd166', -0.15, 1.6, 0.336, { ink: false }), block(0.06, 0.09, 0.01, '#ef476f', -0.02, 1.45, 0.336, { ink: false }));
  return g;
}
function catBowl() {
  const g = new THREE.Group();
  g.add(part(cyl(0.2, 0.15, 0.1, 18), '#2a9d8f', { y: 0.05, ink: 0.012 }));
  const fish = part(sph(0.07, 10, 6), '#9ecae1', { y: 0.12, ink: 0.008 });
  fish.scale.set(1.8, 0.5, 0.8);
  g.add(fish, part(new THREE.ConeGeometry(0.05, 0.08, 4), '#9ecae1', { x: -0.14, y: 0.12, ink: 0 }).rotateZ(Math.PI / 2));
  g.add(part(cyl(0.16, 0.12, 0.08, 18), '#e9ecef', { x: 0.36, y: 0.04, ink: 0.01 }));
  return g;
}
function catBed() {
  const g = new THREE.Group();
  const rim = part(new THREE.TorusGeometry(0.5, 0.16, 12, 28), '#2a9d8f', { y: 0.18, ink: 0.02 });
  rim.rotation.x = Math.PI / 2;
  g.add(rim, part(cyl(0.52, 0.55, 0.12, 28), '#21867a', { y: 0.06, ink: 0.015 }), part(cyl(0.42, 0.42, 0.1, 24), CREAM, { y: 0.15, ink: 0 }));
  g.add(part(sph(0.12, 10, 8), '#ffd166', { x: 0.25, y: 0.22, z: 0.1, ink: 0.01 })); // toy ball of yarn
  return g;
}
function wardrobe() {
  const g = new THREE.Group();
  g.add(block(1.1, 1.95, 0.55, '#b07a4f', 0, 0.98, 0));
  g.add(block(0.02, 1.8, 0.02, DARK, 0, 1.0, 0.28, { ink: false }), block(0.03, 0.2, 0.04, '#ffd166', -0.08, 1.05, 0.29, { ink: false }), block(0.03, 0.2, 0.04, '#ffd166', 0.08, 1.05, 0.29, { ink: false }));
  return g;
}
function nightstand() {
  const g = new THREE.Group();
  g.add(block(0.5, 0.55, 0.42, WOOD, 0, 0.28, 0), block(0.4, 0.02, 0.02, DARK, 0, 0.36, 0.215, { ink: false }));
  g.add(part(cyl(0.07, 0.09, 0.22, 12), '#e9c46a', { y: 0.66, ink: 0.01 }), part(new THREE.CylinderGeometry(0.1, 0.16, 0.18, 14, 1, true), '#ffe6a8', { y: 0.84, ink: 0.01, mat: new THREE.MeshToonMaterial({ color: '#ffe6a8', emissive: '#ffcf6e', emissiveIntensity: 0.4, side: THREE.DoubleSide }) }));
  g.add(part(cyl(0.08, 0.06, 0.12, 14), '#ffffff', { x: 0.16, y: 0.61, ink: 0.008 })); // Pip's teacup bed
  return g;
}
function washer(label = 'wash') {
  const g = new THREE.Group();
  g.add(block(0.68, 0.86, 0.64, '#f8f9fa', 0, 0.43, 0));
  g.add(block(0.66, 0.14, 0.02, '#dee2e6', 0, 0.76, 0.325, { ink: false }));
  for (const x of [-0.2, 0.18]) g.add(part(cyl(0.035, 0.035, 0.03, 12), '#6c757d', { x, y: 0.76, z: 0.34, ink: 0 }).rotateX(Math.PI / 2));
  const ring = part(new THREE.TorusGeometry(0.21, 0.035, 10, 24), '#adb5bd', { y: 0.38, z: 0.33, ink: 0.01 });
  g.add(ring);
  const drum = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.19, 24), new THREE.MeshToonMaterial({ color: label === 'dry' ? '#cfd8dc' : '#9ecae1' }));
  drum.add(glass);
  for (let k = 0; k < 3; k++) {
    const sock = new THREE.Mesh(new THREE.CircleGeometry(0.05, 8), new THREE.MeshBasicMaterial({ color: ['#e63946', '#ffd166', '#2a9d8f'][k] }));
    sock.position.set(Math.cos(k * 2.1) * 0.1, Math.sin(k * 2.1) * 0.1, 0.005);
    drum.add(sock);
  }
  drum.position.set(0, 0.38, 0.332);
  g.add(drum);
  g.userData.drum = drum;
  return g;
}
function laundryBasket() {
  const g = new THREE.Group();
  g.add(part(cyl(0.3, 0.24, 0.4, 16), '#d4a373', { y: 0.2, ink: 0.015 }));
  for (let k = 0; k < 4; k++) {
    const c = part(sph(0.13, 10, 8), ['#e63946', '#fff', '#457b9d', '#ffd166'][k], { x: Math.cos(k * 1.6) * 0.1, y: 0.42, z: Math.sin(k * 1.6) * 0.1, ink: 0.008 });
    c.scale.set(1.3, 0.45, 1);
    g.add(c);
  }
  return g;
}
function dryingRack() {
  const g = new THREE.Group();
  for (const x of [-0.5, 0.5]) g.add(block(0.04, 1.2, 0.04, METAL, x, 0.6, 0, { ink: false }), block(0.04, 0.04, 0.4, METAL, x, 0.02, 0, { ink: false }));
  for (const y of [0.85, 1.15]) g.add(block(1.04, 0.02, 0.02, METAL, 0, y, 0, { ink: false }));
  ['#e07a1f', '#2a9d8f', '#f4a3a3'].forEach((c, k) => g.add(block(0.26, 0.4, 0.01, c, -0.32 + k * 0.32, 0.93, 0.01, { ink: false })));
  return g;
}
function shelfUnit(w = 1, items = ['#2a9d8f', '#e07a1f', '#ffd166']) {
  const g = new THREE.Group();
  for (const x of [-w / 2, w / 2]) g.add(block(0.04, 1.6, 0.35, DARK, x, 0.8, 0, { ink: false }));
  for (const y of [0.4, 0.9, 1.4]) {
    g.add(block(w, 0.03, 0.35, WOOD, 0, y, 0, { ink: false }));
    for (let k = 0; k < 3; k++) g.add(part(cyl(0.06, 0.06, 0.2, 10), items[(k + Math.round(y * 3)) % items.length], { x: -w / 3 + k * (w / 3), y: y + 0.115, ink: 0.008 }));
  }
  return g;
}
function piano() {
  const g = new THREE.Group();
  g.add(block(1.5, 1.2, 0.5, '#2b2d42', 0, 0.6, 0));
  g.add(block(1.5, 0.06, 0.32, '#2b2d42', 0, 0.74, 0.4));
  g.add(block(1.4, 0.04, 0.2, '#f8f9fa', 0, 0.79, 0.45, { ink: false }));
  for (let k = 0; k < 14; k++) if (k % 7 !== 2 && k % 7 !== 6) g.add(block(0.05, 0.03, 0.12, '#111', -0.65 + k * 0.1, 0.81, 0.41, { ink: false }));
  for (const x of [-0.68, 0.68]) g.add(block(0.08, 0.72, 0.08, '#2b2d42', x, 0.36, 0.48, { ink: false }));
  g.add(block(0.5, 0.3, 0.02, CREAM, 0, 1.05, 0.26, { ink: false })); // sheet music
  const bench = block(0.8, 0.07, 0.35, '#2b2d42', 0, 0.48, 0.95);
  g.add(bench, block(0.05, 0.45, 0.05, BLACK, -0.35, 0.23, 0.95, { ink: false }), block(0.05, 0.45, 0.05, BLACK, 0.35, 0.23, 0.95, { ink: false }));
  return g;
}
function micStand() {
  const g = new THREE.Group();
  g.add(part(cyl(0.2, 0.22, 0.03, 16), BLACK, { y: 0.015, ink: 0 }), block(0.03, 1.3, 0.03, '#555', 0, 0.66, 0, { ink: false }));
  const mic = part(new THREE.CapsuleGeometry(0.04, 0.1, 4, 10), '#888', { y: 1.38, z: 0.05, ink: 0.008 });
  mic.rotation.x = 0.5;
  g.add(mic);
  return g;
}
function speaker() {
  const g = new THREE.Group();
  g.add(block(0.45, 0.8, 0.4, '#3d3d3d', 0, 0.4, 0));
  for (const [y, r] of [[0.28, 0.14], [0.62, 0.07]]) g.add(part(cyl(r, r, 0.02, 18), '#777', { y, z: 0.205, ink: 0 }).rotateX(Math.PI / 2));
  return g;
}
function guitar() {
  const g = new THREE.Group();
  g.add(part(sph(0.2, 14, 10), '#d4a373', { y: 0.32, ink: 0.01 }), part(sph(0.15, 14, 10), '#d4a373', { y: 0.58, ink: 0.01 }));
  g.children.forEach((c) => (c.scale.z = 0.35));
  g.add(block(0.06, 0.6, 0.04, DARK, 0, 0.95, 0, { ink: false }), part(cyl(0.05, 0.05, 0.02, 12), '#2b1a10', { y: 0.45, z: 0.07, ink: 0 }).rotateX(Math.PI / 2));
  g.rotation.x = -0.15;
  return g;
}
function frame(tex, w = 1.1, h = 1.1) {
  const f = new THREE.Group();
  f.add(block(w + 0.14, h + 0.14, 0.06, '#6b4226', 0, 0, 0));
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), tex ? new THREE.MeshBasicMaterial({ map: tex }) : toon('#efe7da'));
  p.position.z = 0.04;
  f.add(p);
  return f;
}
const texLoader = new THREE.TextureLoader();
export function artTexture(file) {
  if (!file) return null;
  const t = texLoader.load(`gallery/${encodeURIComponent(file)}`);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function easel(tex) {
  const g = new THREE.Group();
  for (const x of [-0.35, 0.35]) {
    const l = block(0.05, 1.7, 0.05, WOOD, x, 0.85, 0.1, { ink: false });
    l.rotation.z = -Math.sign(x) * 0.06;
    g.add(l);
  }
  const back = block(0.05, 1.6, 0.05, WOOD, 0, 0.8, -0.25, { ink: false });
  back.rotation.x = -0.28;
  g.add(back, block(0.9, 0.05, 0.12, WOOD, 0, 0.72, 0.12));
  const canvas = frame(tex, 0.75, 0.75);
  canvas.position.set(0, 1.15, 0.13);
  canvas.rotation.x = -0.1;
  g.add(canvas);
  return g;
}
function paintTable() {
  const g = table(0.9, 0.55, '#d4a373');
  ['#e63946', '#ffd166', '#2a9d8f', '#457b9d', '#f28c28'].forEach((c, k) => g.add(part(cyl(0.05, 0.05, 0.1, 10), c, { x: -0.32 + k * 0.16, y: 0.83, z: -0.1, ink: 0.006 })));
  g.add(part(cyl(0.06, 0.05, 0.14, 10), '#adb5bd', { x: 0.3, y: 0.85, z: 0.12, ink: 0.006 }));
  for (let k = 0; k < 3; k++) g.add(block(0.015, 0.25, 0.015, WOOD, 0.28 + k * 0.025, 0.98, 0.12, { ink: false }));
  const pal = part(cyl(0.16, 0.16, 0.015, 16), '#e9c46a', { x: -0.15, y: 0.79, z: 0.13, ink: 0.006 });
  pal.scale.z = 0.7;
  g.add(pal);
  return g;
}
function deskSetup() {
  const g = new THREE.Group();
  g.add(block(1.6, 0.05, 0.7, '#3d405b', 0, 0.75, 0));
  for (const x of [-0.75, 0.75]) g.add(block(0.05, 0.73, 0.65, BLACK, x, 0.37, 0, { ink: false }));
  const screens = [];
  [[-0.52, 0.25], [0, 0], [0.52, -0.25]].forEach(([x, r], i) => {
    const m = new THREE.Group();
    m.add(block(0.5, 0.32, 0.03, BLACK, 0, 0.32, 0), block(0.04, 0.2, 0.04, BLACK, 0, 0.1, 0, { ink: false }), block(0.18, 0.02, 0.12, BLACK, 0, 0.01, 0, { ink: false }));
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.28), new THREE.MeshBasicMaterial({ color: ['#5cc9bb', '#ffd166', '#f28c28'][i] }));
    s.position.set(0, 0.32, 0.017);
    m.add(s);
    screens.push(s);
    m.position.set(x, 0.78, -0.15);
    m.rotation.y = r;
    g.add(m);
  });
  g.add(block(0.5, 0.02, 0.16, '#ced4da', 0, 0.785, 0.15, { ink: false }), block(0.08, 0.02, 0.12, '#ced4da', 0.38, 0.785, 0.17, { ink: false }));
  g.userData.screens = screens;
  return g;
}
function officeChair() {
  const g = new THREE.Group();
  g.add(part(cyl(0.25, 0.25, 0.03, 5), BLACK, { y: 0.05, ink: 0 }), block(0.05, 0.4, 0.05, BLACK, 0, 0.26, 0, { ink: false }));
  g.add(block(0.48, 0.08, 0.46, '#e07a1f', 0, 0.48, 0), block(0.44, 0.5, 0.07, '#e07a1f', 0, 0.78, -0.22));
  return g;
}
function serverRack() {
  const g = new THREE.Group();
  g.add(block(0.6, 1.8, 0.6, BLACK, 0, 0.9, 0));
  const leds = [];
  for (let k = 0; k < 10; k++) {
    g.add(block(0.52, 0.12, 0.02, '#3d405b', 0, 0.25 + k * 0.15, 0.305, { ink: false }));
    const l = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.035), new THREE.MeshBasicMaterial({ color: '#06d6a0' }));
    l.position.set(0.2, 0.25 + k * 0.15, 0.32);
    g.add(l);
    leds.push(l);
  }
  g.userData.leds = leds;
  return g;
}
function coatRack() {
  const g = new THREE.Group();
  g.add(part(cyl(0.18, 0.2, 0.04, 14), DARK, { y: 0.02, ink: 0 }), block(0.05, 1.7, 0.05, DARK, 0, 0.87, 0, { ink: false }));
  g.add(part(new THREE.CapsuleGeometry(0.12, 0.4, 4, 10), '#2a9d8f', { x: 0.1, y: 1.3, ink: 0.01 })); // Loki's spare scarf
  g.add(part(sph(0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#e63946', { x: -0.1, y: 1.65, ink: 0.01 }));
  return g;
}
function shoeBench() {
  const g = new THREE.Group();
  g.add(block(1.0, 0.45, 0.38, WOOD, 0, 0.23, 0), block(0.96, 0.02, 0.34, DARK, 0, 0.14, 0, { ink: false }));
  for (let k = 0; k < 3; k++) g.add(block(0.14, 0.1, 0.25, ['#2b2d42', '#e07a1f', '#457b9d'][k], -0.3 + k * 0.3, 0.07, 0, { ink: false }));
  return g;
}
function mirror() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CircleGeometry(0.38, 28), new THREE.MeshToonMaterial({ color: '#cfe8f3' }));
  const rim = part(new THREE.TorusGeometry(0.4, 0.04, 8, 28), '#d4a373', { ink: 0 });
  g.add(m, rim);
  g.position.y = 1.55;
  return g;
}
function workbench() {
  const g = new THREE.Group();
  g.add(block(1.7, 0.08, 0.7, '#b07a4f', 0, 0.86, 0));
  for (const x of [-0.78, 0.78]) g.add(block(0.08, 0.84, 0.64, DARK, x, 0.42, 0, { ink: false }));
  g.add(block(1.6, 0.04, 0.6, DARK, 0, 0.25, 0, { ink: false }));
  g.add(block(0.22, 0.14, 0.18, '#457b9d', -0.6, 0.97, 0.15), block(0.3, 0.04, 0.06, '#888', 0.1, 0.92, 0.12, { ink: false }), block(0.1, 0.06, 0.08, '#b5523b', 0.2, 0.92, 0.12, { ink: false }));
  // pegboard with tools
  g.add(block(1.6, 0.9, 0.04, '#c68b59', 0, 1.6, -0.33));
  ['#888', '#b5523b', '#457b9d', '#e9c46a', '#888'].forEach((c, k) => g.add(block(0.05, 0.35 + (k % 2) * 0.1, 0.03, c, -0.6 + k * 0.3, 1.6, -0.3, { ink: false })));
  return g;
}
function printer3d() {
  const g = new THREE.Group();
  g.add(block(0.6, 0.6, 0.55, '#3d405b', 0, 0.3, 0));
  const frameTop = new THREE.Group();
  for (const x of [-0.28, 0.28]) frameTop.add(block(0.04, 0.6, 0.04, '#f8f9fa', x, 0.9, 0, { ink: false }));
  frameTop.add(block(0.6, 0.04, 0.04, '#f8f9fa', 0, 1.2, 0, { ink: false }));
  const head = block(0.1, 0.1, 0.1, '#e07a1f', 0, 1.12, 0, { ink: false });
  frameTop.add(head);
  g.add(frameTop, part(cyl(0.08, 0.1, 0.12, 6), '#ffd166', { y: 0.66, ink: 0.008 }));
  g.userData.head = head;
  return g;
}
function crates(n = 2) {
  const g = new THREE.Group();
  for (let k = 0; k < n; k++) g.add(block(0.6, 0.45, 0.5, '#c68b59', 0, 0.23 + k * 0.46, 0), block(0.62, 0.05, 0.05, '#9c6a43', 0, 0.23 + k * 0.46, 0.255, { ink: false }));
  return g;
}
function brickOven() {
  const g = new THREE.Group();
  g.add(block(1.5, 0.7, 1.1, '#b5523b', 0, 0.35, 0));
  g.add(part(sph(0.7, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), '#c96f4a', { y: 0.7, ink: 0.02 }));
  const mouth = new THREE.Mesh(new THREE.CircleGeometry(0.28, 16, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#ffb347' }));
  mouth.position.set(0, 0.72, 0.64);
  g.add(mouth, block(0.24, 0.6, 0.24, '#8d5b4c', 0.3, 1.6, -0.2));
  return g;
}
function displayCounter() {
  const g = new THREE.Group();
  g.add(block(1.6, 0.9, 0.6, '#f1e3c8', 0, 0.45, 0));
  const glassM = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 0.5), new THREE.MeshToonMaterial({ color: '#d8f0ff', transparent: true, opacity: 0.35 }));
  glassM.position.y = 1.08;
  g.add(glassM);
  for (let k = 0; k < 6; k++) {
    const b = part(new THREE.CapsuleGeometry(0.07, 0.16, 4, 10), k % 2 ? '#d99a4e' : '#e9b872', { x: -0.6 + k * 0.24, y: 0.97, ink: 0.008 });
    b.rotation.z = Math.PI / 2;
    g.add(b);
  }
  return g;
}
function espresso() {
  const g = new THREE.Group();
  g.add(block(1.6, 0.95, 0.6, '#8d5b3c', 0, 0.48, 0), block(1.64, 0.05, 0.64, '#3d405b', 0, 0.97, 0));
  g.add(block(0.45, 0.45, 0.38, '#adb5bd', -0.4, 1.22, -0.05), block(0.3, 0.05, 0.05, BLACK, -0.4, 1.12, 0.17, { ink: false }));
  for (let k = 0; k < 3; k++) g.add(part(cyl(0.05, 0.04, 0.09, 10), '#fff', { x: 0.2 + k * 0.15, y: 1.04, ink: 0.006 }));
  return g;
}
function armchair(color = '#2a9d8f') {
  const g = new THREE.Group();
  g.add(block(0.85, 0.35, 0.8, color, 0, 0.25, 0), block(0.85, 0.6, 0.18, color, 0, 0.6, -0.31));
  for (const s of [-1, 1]) g.add(block(0.15, 0.45, 0.8, color, s * 0.42, 0.42, 0));
  return g;
}
function pedestal(color = '#f28c28') {
  const g = new THREE.Group();
  g.add(block(0.5, 0.9, 0.5, '#f1f3f5', 0, 0.45, 0));
  const s = part(new THREE.TorusKnotGeometry(0.15, 0.05, 48, 8), color, { y: 1.15, ink: 0.01 });
  g.add(s);
  return g;
}
function register() {
  const g = new THREE.Group();
  g.add(block(1.6, 0.95, 0.6, '#8d5b3c', 0, 0.48, 0), block(1.64, 0.05, 0.64, '#e9c46a', 0, 0.97, 0));
  g.add(block(0.35, 0.22, 0.3, BLACK, 0.45, 1.1, 0), block(0.3, 0.14, 0.02, '#5cc9bb', 0.45, 1.25, -0.1, { ink: false }));
  for (let k = 0; k < 3; k++) g.add(block(0.2, 0.15, 0.2, ['#f28c28', '#2a9d8f', '#ffd166'][k], -0.55 + k * 0.25, 1.08, 0));
  return g;
}

// ---------------- room recipes ----------------
// Each item: [builder, wall ('n' back, 's' front, 'e' right, 'w' left), side (-1/1 along the wall), width, depth, opts]
// opts.spot = {act, label, d (distance in front)} ; opts.item = interactable type
function recipes(ctx) {
  const art = (k) => artTexture(ctx.art[k]?.file);
  return {
    hall: [[coatRack, 'n', -1, 0.45, 0.45], [shoeBench, 'w', 1, 1.0, 0.4], [() => pottedPlant(1.1), 'n', 1, 0.5, 0.5, { spot: { act: 'greet', label: 'saying hi by the front door', d: 1.2 } }], [mirror, 'e', -1, 0.8, 0.08, { wallHung: true }]],
    living: [[() => sofa(1.6), 'n', -1, 1.6, 0.8, { spot: { act: 'relax', label: 'curled up on the sofa watching TV', d: 0.25, onTop: 0.32 } }], [tvUnit, 's', -1, 1.4, 0.45], [floorLamp, 'n', 1, 0.4, 0.4], [() => armchair('#e76f51'), 'e', 1, 0.9, 0.85, { spot: { act: 'radio', label: 'listening to the radio in his armchair', d: 0.2, onTop: 0.3 } }], [() => pottedPlant(1.3), 'w', 1, 0.5, 0.5]],
    kitchen: [[() => kitchenCounter(1.7), 'n', -1, 1.7, 0.62, { spot: { act: 'cook', label: 'cooking something that smells of fish', d: 0.7 } }], [fridge, 'n', 1, 0.72, 0.66], [catBowl, 'e', 1, 0.8, 0.45, { spot: { act: 'eat', label: 'eating fish from his bowl', d: 0.55 } }], [() => { const g = table(1.0, 0.8, '#d4a373'); const c = chair(); c.position.set(0, 0, 0.6); c.rotation.y = Math.PI; g.add(c); return g; }, 'w', -1, 1.0, 0.8]],
    bedroom: [[catBed, 'n', -1, 1.3, 1.3, { spot: { act: 'sleep', label: 'asleep in his bed', d: -0.65, onTop: 0.12 } }], [wardrobe, 'n', 1, 1.1, 0.55], [nightstand, 'w', 1, 0.5, 0.42], [() => rug(1.6, 1.1, '#9c89b8'), 'e', -1, 1.4, 1.0, { flat: true, spot: { act: 'stretch', label: 'stretching after a nap', d: -0.5 } }]],
    laundry: [[() => washer('wash'), 'n', -1, 0.7, 0.66, { spot: { act: 'laundry', label: 'watching the washing machine spin', d: 0.75 }, anim: 'drum' }], [() => washer('dry'), 'n', 1, 0.7, 0.66, { anim: 'drum' }], [laundryBasket, 'e', 1, 0.6, 0.6], [() => shelfUnit(1.0, ['#4cc9f0', '#f4a3a3', '#ffd166']), 'w', -1, 1.0, 0.36], [dryingRack, 's', 1, 1.1, 0.45]],
    music: [[piano, 'n', -1, 1.5, 1.15, { spot: { act: 'piano', label: 'playing the piano', d: -0.15 } }], [micStand, 'n', 1, 0.5, 0.5, { spot: { act: 'sing', label: 'practising singing at the microphone', d: 0.6 }, anim: 'notes' }], [speaker, 'e', 1, 0.45, 0.4], [speaker, 'w', 1, 0.45, 0.4], [guitar, 'e', -1, 0.4, 0.3]],
    studio: [[() => easel(art(0)), 'n', -1, 0.9, 0.6, { spot: { act: 'paint', label: 'painting at his easel', d: 0.8 } }], [paintTable, 'n', 1, 0.9, 0.55], [() => { const g = new THREE.Group(); for (let k = 0; k < 3; k++) { const f = frame(art(k + 1), 0.7, 0.7); f.position.set(0, 0.42, -0.05 + k * 0.08); f.rotation.x = -0.2; g.add(f); } return g; }, 'w', 1, 0.8, 0.4], [() => rug(1.5, 1.2, '#ffd166', '#f28c28'), 's', -1, 1.5, 1.2, { flat: true }]],
    control: [[deskSetup, 'n', -1, 1.6, 0.7, { spot: { act: 'work', label: 'checking his screens in the control room', d: 0.75 }, anim: 'screens' }], [officeChair, 'n', -1, 0.5, 0.5, { offsetD: 0.75, noBlock: true }], [serverRack, 'n', 1, 0.6, 0.6, { anim: 'leds' }], [() => pottedPlant(0.9), 'e', 1, 0.45, 0.45]],
    workshop: [[workbench, 'n', -1, 1.7, 0.7, { spot: { act: 'build', label: 'building something at the workbench', d: 0.7 } }], [printer3d, 'n', 1, 0.6, 0.55, { spot: { act: 'print', label: 'watching the 3D printer', d: 0.7 }, anim: 'printer' }], [() => crates(2), 'e', 1, 0.6, 0.5], [() => shelfUnit(1.0), 'w', -1, 1.0, 0.36]],
    storage: [[() => shelfUnit(1.2, ['#c68b59', '#ffd166', '#06d6a0']), 'n', -1, 1.2, 0.36], [() => crates(3), 'n', 1, 0.6, 0.5], [() => crates(2), 'e', 1, 0.6, 0.5, { spot: { act: 'tidy', label: 'tidying the storeroom', d: 0.8 } }]],
    bakery: [[brickOven, 'n', -1, 1.5, 1.1, { spot: { act: 'bake', label: 'baking fish buns', d: 0.8 } }], [displayCounter, 'e', 1, 1.6, 0.6], [() => shelfUnit(1.0, ['#d99a4e', '#e9b872', '#c4621a']), 'n', 1, 1.0, 0.36]],
    cafe: [[espresso, 'n', -1, 1.6, 0.62, { spot: { act: 'coffee', label: 'making a warm milk at the café counter', d: 0.7 } }], [bistro, 'w', 1, 1.6, 0.9, { spot: { act: 'sit', label: 'sitting at a café table', d: 0.9 } }], [bistro, 'e', 1, 1.6, 0.9], [() => pottedPlant(1.2), 'n', 1, 0.5, 0.5]],
    gallery: [[() => frame(art(ctx.galleryOffset || 0), 1.2, 1.2), 'n', -1, 1.3, 0.1, { wallHung: true, y: 1.6 }], [() => frame(art((ctx.galleryOffset || 0) + 1), 1.2, 1.2), 'n', 1, 1.3, 0.1, { wallHung: true, y: 1.6 }], [() => frame(art((ctx.galleryOffset || 0) + 2), 1.1, 1.1), 'w', 1, 1.2, 0.1, { wallHung: true, y: 1.6 }], [() => frame(art((ctx.galleryOffset || 0) + 3), 1.1, 1.1), 'e', -1, 1.2, 0.1, { wallHung: true, y: 1.6 }], [() => pedestal('#f28c28'), 'w', -1, 0.5, 0.5, { spot: { act: 'admire', label: 'admiring the art in the gallery', d: 1.0 }, item: 'gallery' }]],
    library: [[() => bookshelf(1.5), 'n', -1, 1.5, 0.38], [() => bookshelf(1.2), 'n', 1, 1.2, 0.38], [() => armchair('#2a9d8f'), 'w', 1, 0.9, 0.85, { spot: { act: 'read', label: 'reading in a comfy armchair', d: 0.2, onTop: 0.3 } }], [floorLamp, 'e', 1, 0.4, 0.4]],
    shop: [[register, 'n', 1, 1.6, 0.62, { spot: { act: 'sell', label: 'minding the shop counter', d: -0.7 }, item: 'shop' }], [() => shelfUnit(1.3, ['#f28c28', '#2a9d8f', '#ffd166', '#e63946']), 'n', -1, 1.3, 0.36], [() => shelfUnit(1.3, ['#8e7cc3', '#06d6a0', '#f4a261']), 'w', 1, 1.3, 0.36]],
    garden_room: [[() => pottedPlant(1.6), 'n', -1, 0.7, 0.7], [() => pottedPlant(1.4), 'n', 1, 0.6, 0.6, { spot: { act: 'garden', label: 'watering his plants', d: 0.8 } }], [() => pottedPlant(1.5), 'e', 1, 0.6, 0.6], [() => pottedPlant(1.2), 'w', -1, 0.6, 0.6]],
  };
}

const ROT = { n: 0, s: Math.PI, e: -Math.PI / 2, w: Math.PI / 2 };
export function buildRoom(kind, ctx, half, room) {
  const list = (recipes({ ...ctx, galleryOffset: room.galleryOffset })[kind] || recipes(ctx).living);
  const g = new THREE.Group();
  const blockers = [], spots = [], items = [], anims = [];
  for (const [fn, wall, side, w, d, opts = {}] of list) {
    const obj = fn();
    // position along the wall, in its corner, never in the doorway strip
    const along = side * Math.max(1.15 + w / 2, half - w / 2 - 0.08);
    const off = half - d / 2 - 0.05 - (opts.offsetD || 0);
    let x = 0, z = 0;
    if (wall === 'n') (x = along), (z = -off);
    if (wall === 's') (x = along), (z = off);
    if (wall === 'e') (x = off), (z = along);
    if (wall === 'w') (x = -off), (z = along);
    obj.position.set(x, opts.wallHung ? opts.y || 0 : 0, z);
    obj.rotation.y = ROT[wall];
    g.add(obj);
    const horiz = wall === 'n' || wall === 's';
    if (!opts.flat && !opts.wallHung && !opts.noBlock) blockers.push({ x, z, w: horiz ? w : d, d: horiz ? d : w });
    const facing = ROT[wall];
    if (opts.spot) {
      const dist = d / 2 + opts.spot.d;
      spots.push({ act: opts.spot.act, label: opts.spot.label, x: x + Math.sin(facing) * dist, z: z + Math.cos(facing) * dist, face: facing + Math.PI, onTop: opts.spot.onTop || 0 });
    }
    if (opts.item) items.push({ type: opts.item, x: x + Math.sin(facing) * (d / 2 + 1.1), z: z + Math.cos(facing) * (d / 2 + 1.1), r: 2.2, label: opts.item === 'shop' ? "🛍️ Visit Loki's shop" : "🖼️ Look at Loki's paintings" });
    if (opts.anim) anims.push({ type: opts.anim, obj });
  }
  if (kind === 'music') items.push({ type: 'music', x: 0, z: 0, r: 2.6, label: "🎹 Listen to Loki's songs" });
  if (kind === 'studio') items.push({ type: 'gallery', x: 0, z: 0, r: 2.2, label: "🎨 See Loki's paintings" });
  if (kind === 'control') items.push({ type: 'control', x: 0, z: 0, r: 2.2, label: '🖥️ Open the Control Centre (owner)' });
  // music notes sprite
  let notes = null;
  if (kind === 'music') {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x2 = c.getContext('2d');
    x2.font = '48px serif';
    x2.fillStyle = '#e07a1f';
    x2.fillText('♪', 14, 48);
    const tex = new THREE.CanvasTexture(c);
    notes = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      sp.scale.setScalar(0.35);
      sp.userData.phase = k / 3;
      notes.add(sp);
    }
    const mic = spots.find((s) => s.act === 'sing');
    if (mic) notes.position.set(mic.x, 1.5, mic.z);
    notes.visible = false;
    g.add(notes);
  }
  const tick = (t, active) => {
    for (const a of anims) {
      if (a.type === 'drum' && a.obj.userData.drum) a.obj.userData.drum.rotation.z = t * (active ? 6 : 0.8);
      if (a.type === 'leds') a.obj.userData.leds.forEach((l, i) => l.material.color.set(Math.sin(t * 3 + i * 1.7) > 0 ? '#06d6a0' : '#1b4332'));
      if (a.type === 'screens') a.obj.userData.screens.forEach((s, i) => s.material.color.setHSL((t * 0.03 + i * 0.3) % 1, 0.55, 0.6));
      if (a.type === 'printer') a.obj.userData.head.position.x = Math.sin(t * (active ? 4 : 0.5)) * 0.2;
    }
    if (notes) {
      notes.visible = active;
      notes.children.forEach((s) => {
        const k = (t * 0.5 + s.userData.phase) % 1;
        s.position.set(Math.sin(k * 6 + s.userData.phase * 9) * 0.3, k * 1.2, 0);
        s.material.opacity = 1 - k;
      });
    }
  };
  return { group: g, blockers, spots, items, tick };
}

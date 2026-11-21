// Things Loki adds to his town that aren't buildings: statues, murals, plants, benches...
// plus fully custom objects he designs himself from simple shapes (same toon style).
import * as THREE from 'three';
import { toon, block, part, shade, signBoard } from './toon.js';
import { flower, pottedPlant, artTexture } from './rooms.js';
import { tree } from './buildings.js';

const C = (c, d) => (/^#[0-9a-f]{3,6}$/i.test(c || '') ? c : d);

function catStatue(color) {
  const g = new THREE.Group();
  g.add(block(1.2, 0.8, 1.2, '#d6cfc2', 0, 0.4, 0));
  const body = part(new THREE.SphereGeometry(0.42, 18, 14), color, { y: 1.2, ink: 0.025 });
  body.scale.set(0.9, 1.1, 0.8);
  const head = part(new THREE.SphereGeometry(0.3, 18, 14), color, { y: 1.75, z: 0.05, ink: 0.02 });
  g.add(body, head);
  for (const s of [-1, 1]) g.add(part(new THREE.ConeGeometry(0.1, 0.22, 10), color, { x: s * 0.16, y: 2.02, z: 0.02, ink: 0.01 }));
  const tail = part(new THREE.TorusGeometry(0.3, 0.06, 8, 16, Math.PI), color, { x: -0.25, y: 0.95, z: -0.2, ink: 0.01 });
  tail.rotation.y = Math.PI / 2;
  g.add(tail);
  return { g, r: 0.7 };
}
function fishStatue(color) {
  const g = new THREE.Group();
  g.add(part(new THREE.CylinderGeometry(0.5, 0.6, 0.9, 16), '#d6cfc2', { y: 0.45, ink: 0.02 }));
  const f = part(new THREE.SphereGeometry(0.45, 18, 12), color, { y: 1.4, ink: 0.02 });
  f.scale.set(1.6, 0.9, 0.6);
  f.rotation.z = 0.4;
  const tail = part(new THREE.ConeGeometry(0.3, 0.45, 4), color, { x: -0.85, y: 1.05, ink: 0.015 });
  tail.rotation.z = Math.PI / 2 + 0.4;
  g.add(f, tail);
  return { g, r: 0.7 };
}
function abstractSculpture(color) {
  const g = new THREE.Group();
  g.add(block(0.9, 0.5, 0.9, '#3d405b', 0, 0.25, 0));
  g.add(part(new THREE.TorusKnotGeometry(0.35, 0.1, 80, 10), color, { y: 1.15, ink: 0.015 }));
  return { g, r: 0.6 };
}
function birdbath() {
  const g = new THREE.Group();
  g.add(part(new THREE.CylinderGeometry(0.12, 0.2, 0.8, 12), '#d6cfc2', { y: 0.4, ink: 0.015 }), part(new THREE.CylinderGeometry(0.5, 0.25, 0.18, 18), '#d6cfc2', { y: 0.88, ink: 0.015 }));
  const w = new THREE.Mesh(new THREE.CircleGeometry(0.42, 18), new THREE.MeshToonMaterial({ color: '#7fd3f2' }));
  w.rotation.x = -Math.PI / 2;
  w.position.y = 0.96;
  g.add(w);
  return { g, r: 0.6 };
}
function bench(color) {
  const g = new THREE.Group();
  g.add(block(2, 0.12, 0.6, color, 0, 0.55, 0), block(2, 0.45, 0.1, color, 0, 0.9, -0.26), block(0.1, 0.55, 0.55, '#3b3b45', -0.85, 0.28, 0), block(0.1, 0.55, 0.55, '#3b3b45', 0.85, 0.28, 0));
  return { g, r: 1.1, box: { w: 2.1, d: 0.7 } };
}
function lamp() {
  const g = new THREE.Group();
  g.add(part(new THREE.CylinderGeometry(0.07, 0.11, 3.2, 8), '#3b3b45', { y: 1.6, ink: 0.015 }), part(new THREE.SphereGeometry(0.24, 12, 10), '#fff3c4', { y: 3.3, ink: 0.01, mat: new THREE.MeshToonMaterial({ color: '#fff3c4', emissive: '#ffd27a', emissiveIntensity: 0.6 }) }));
  return { g, r: 0.3 };
}
function flowerbed(color) {
  const g = new THREE.Group();
  g.add(block(2.4, 0.3, 1.2, '#8d5b3c', 0, 0.15, 0), block(2.2, 0.06, 1.0, '#5b3a29', 0, 0.31, 0, { ink: false }));
  for (let k = 0; k < 14; k++) {
    const f = flower([C(color, '#ef476f'), '#ffd166', '#f8f9fa', '#c77dff'][k % 4], 0.3);
    f.position.set(-0.95 + (k % 7) * 0.32, 0.3, -0.25 + Math.floor(k / 7) * 0.5);
    g.add(f);
  }
  return { g, r: 1.2, box: { w: 2.4, d: 1.2 } };
}
function rockGarden() {
  const g = new THREE.Group();
  for (let k = 0; k < 5; k++) {
    const r = part(new THREE.DodecahedronGeometry(0.3 + (k % 3) * 0.15, 0), '#b8b2a7', { x: Math.cos(k * 1.3) * 0.7, y: 0.2, z: Math.sin(k * 1.3) * 0.5, ink: 0.02 });
    r.scale.y = 0.7;
    g.add(r);
  }
  for (let k = 0; k < 6; k++) {
    const f = flower('#c77dff', 0.25);
    f.position.set(Math.cos(k) * 1.0, 0, Math.sin(k) * 0.8);
    g.add(f);
  }
  return { g, r: 1.1 };
}
function signpost(name) {
  const g = new THREE.Group();
  g.add(block(0.15, 2.2, 0.15, '#6b4226', 0, 1.1, 0));
  const s = signBoard(name || 'This way', 2.4, { icon: '🪧' });
  s.position.y = 1.9;
  g.add(s);
  return { g, r: 0.3 };
}
function kite(color) {
  const g = new THREE.Group();
  const k = part(new THREE.OctahedronGeometry(0.6, 0), color, { y: 6, ink: 0.02 });
  k.scale.set(1, 1.3, 0.12);
  g.add(k);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.9, 0), new THREE.Vector3(0, 5.4, 0)]), new THREE.LineBasicMaterial({ color: '#3b2416' }));
  g.add(line, block(0.1, 0.9, 0.1, '#6b4226', 0, 0.45, 0));
  g.userData.kite = k;
  return { g, r: 0.3 };
}
function treeProp(color) {
  return { g: tree(1.2, 0.3, C(color, '#3f8f4f')), r: 0.6 };
}
function planter() {
  const g = new THREE.Group();
  const p = pottedPlant(1.8);
  g.add(p);
  return { g, r: 0.5 };
}

// A custom object: up to 60 primitive parts designed by Loki's brain.
function custom(design = {}) {
  const g = new THREE.Group();
  const parts = Array.isArray(design.parts) ? design.parts.slice(0, 60) : [];
  let rMax = 0.5;
  for (const p of parts) {
    const s = (Array.isArray(p.size) ? p.size : [0.5, 0.5, 0.5]).map((v) => Math.max(0.02, Math.min(6, Number(v) || 0.5)));
    const pos = (Array.isArray(p.pos) ? p.pos : [0, 0, 0]).map((v) => Math.max(-6, Math.min(12, Number(v) || 0)));
    const rot = (Array.isArray(p.rot) ? p.rot : [0, 0, 0]).map((v) => (Number(v) || 0) * (Math.PI / 180));
    let geo;
    switch (p.shape) {
      case 'sphere': geo = new THREE.SphereGeometry(0.5, 18, 14); break;
      case 'cylinder': geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 18); break;
      case 'cone': geo = new THREE.ConeGeometry(0.5, 1, 18); break;
      case 'torus': geo = new THREE.TorusGeometry(0.4, 0.12, 10, 24); break;
      case 'capsule': geo = new THREE.CapsuleGeometry(0.3, 0.6, 6, 12); break;
      default: geo = new THREE.BoxGeometry(1, 1, 1);
    }
    const m = part(geo, C(p.color, '#c98b5a'), { ink: p.shape === 'box' || !p.shape ? 0 : 0.02 });
    m.scale.set(s[0], s[1], s[2]);
    m.position.set(pos[0], pos[1], pos[2]);
    m.rotation.set(rot[0], rot[1], rot[2]);
    g.add(m);
    rMax = Math.max(rMax, Math.hypot(pos[0], pos[2]) + Math.max(s[0], s[2]) / 2);
  }
  return { g, r: Math.min(4, rMax) };
}

// Murals are painted on a building wall using one of Loki's pictures.
export function mural(file, w = 3) {
  const g = new THREE.Group();
  const tex = artTexture(file);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w), tex ? new THREE.MeshBasicMaterial({ map: tex }) : toon('#efe7da'));
  g.add(m);
  return g;
}

export const PROP_TYPES = ['statue_cat', 'statue_fish', 'sculpture', 'birdbath', 'bench', 'lamp', 'flowerbed', 'rock_garden', 'signpost', 'kite', 'tree', 'planter', 'custom'];

export function buildProp(p) {
  const color = C(p.color, '#f28c28');
  let r;
  switch (p.type) {
    case 'statue_cat': r = catStatue(color); break;
    case 'statue_fish': r = fishStatue(color); break;
    case 'sculpture': r = abstractSculpture(color); break;
    case 'birdbath': r = birdbath(); break;
    case 'bench': r = bench(C(p.color, '#8a5a3b')); break;
    case 'lamp': r = lamp(); break;
    case 'flowerbed': r = flowerbed(color); break;
    case 'rock_garden': r = rockGarden(); break;
    case 'signpost': r = signpost(p.name); break;
    case 'kite': r = kite(color); break;
    case 'tree': r = treeProp(p.color); break;
    case 'planter': r = planter(); break;
    default: r = custom(p.design);
  }
  const s = Math.max(0.3, Math.min(3, Number(p.scale) || 1));
  r.g.scale.setScalar(s);
  r.g.position.set(Number(p.x) || 0, 0, Number(p.z) || 0);
  r.g.rotation.y = ((Number(p.rot) || 0) * Math.PI) / 180;
  return { group: r.g, radius: r.r * s, box: r.box };
}

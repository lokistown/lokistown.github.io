// Loki's Town in 3D: ground, plaza, roads, and data-driven low-poly buildings.
// Every building in town.json gets a "plot" on a grid that grows outward from the plaza,
// so anything Loki builds in the future appears automatically in the right place.
import * as THREE from 'three';

export const PLOT = 18; // size of one town block (metres)
const ROAD = 3.2;

// ---------- helpers ----------
export function rng(seedStr) {
  let h = 1779033703 ^ String(seedStr).length;
  for (let i = 0; i < String(seedStr).length; i++) {
    h = Math.imul(h ^ String(seedStr).charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, metalness: 0, ...opts }));
  return matCache.get(key);
}
export function mesh(geo, material, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}
function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'string' ? mat(color) : color);
  m.position.set(x, y, z);
  return m;
}
function shade(hex, f) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, f);
  return '#' + c.getHexString();
}

// Window glass is shared so day/night can switch all windows at once.
export const glass = new THREE.MeshStandardMaterial({ color: '#bfe3ff', emissive: '#ffcf6e', emissiveIntensity: 0, flatShading: true, roughness: 0.3 });
export const bulb = new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffd27a', emissiveIntensity: 0, flatShading: true });

export function textTexture(lines, { w = 512, h = 256, bg = '#fff8ec', fg = '#3b2416', size = 40, title = null, border = '#3b2416' } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = border;
  g.lineWidth = 10;
  g.strokeRect(5, 5, w - 10, h - 10);
  g.fillStyle = fg;
  g.textBaseline = 'top';
  let y = 22;
  if (title) {
    g.font = `bold ${Math.round(size * 1.05)}px system-ui, sans-serif`;
    g.fillText(title, 24, y, w - 48);
    y += size * 1.4;
  }
  g.font = `${size}px system-ui, sans-serif`;
  for (const raw of lines) {
    const words = String(raw).split(/\s+/);
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (g.measureText(test).width > w - 48 && line) {
        g.fillText(line, 24, y);
        y += size * 1.2;
        line = word;
        if (y > h - size * 1.3) break;
      } else line = test;
    }
    if (y <= h - size * 1.3) {
      g.fillText(line, 24, y);
      y += size * 1.35;
    }
    if (y > h - size * 1.3) break;
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function sign(text, width = 4) {
  const tex = textTexture([], { w: 512, h: 128, title: text, size: 64, bg: '#fff1d6' });
  const g = new THREE.Group();
  const board = mesh(new THREE.PlaneGeometry(width, width / 4), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), { cast: false });
  const back = box(width + 0.2, width / 4 + 0.2, 0.1, '#6b4226', 0, 0, -0.06);
  g.add(back, board);
  return g;
}

// ---------- plots ----------
let plotOrder = null;
export function plotCell(index) {
  if (!plotOrder) {
    const cells = [];
    for (let i = -6; i <= 6; i++)
      for (let j = -6; j <= 6; j++) {
        if (i === 0 && j === 0) continue; // plaza
        cells.push({ i, j, ring: Math.max(Math.abs(i), Math.abs(j)), ang: (Math.atan2(j, i) + Math.PI * 2.25) % (Math.PI * 2) });
      }
    cells.sort((a, b) => a.ring - b.ring || a.ang - b.ang);
    plotOrder = cells;
  }
  return plotOrder[index % plotOrder.length];
}

export function plotInfo(index) {
  const { i, j, ring } = plotCell(index);
  const x = i * PLOT;
  const z = j * PLOT;
  // Face the plaza along the main axis.
  let dx = 0, dz = 0;
  if (Math.abs(i) >= Math.abs(j)) dx = -Math.sign(i);
  else dz = -Math.sign(j);
  const rot = Math.atan2(dx, dz);
  return { x, z, dx, dz, rot, ring };
}

// Assign plots to any building that doesn't have one (older data).
export function ensurePlots(town) {
  const used = new Set(town.buildings.filter((b) => Number.isInteger(b.plot)).map((b) => b.plot));
  let next = 0;
  for (const b of town.buildings) {
    if (Number.isInteger(b.plot)) continue;
    while (used.has(next)) next++;
    b.plot = next;
    used.add(next);
  }
  return town;
}

// ---------- building builders ----------
const DEFAULT_COLORS = {
  house: '#e9a86b', workshop: '#a7806a', bakery: '#f6d5b0', gallery: '#eef0f2', market: '#e76f51', cafe: '#f2c6a0',
  shop: '#f4a261', library: '#8e7cc3', tower: '#b8a9d9', park: '#7cc36a', garden: '#8fd16a', fountain: '#7fd3f2', tree: '#3f8f4f', other: '#c9a37a',
};
const ROOF_COLORS = { house: '#b5523b', workshop: '#6d4c41', bakery: '#d64545', gallery: '#3d6e9e', cafe: '#2a9d8f', shop: '#e07a1f', library: '#4a3f6b', other: '#8a5a3b' };

function addWindows(g, w, h, d, floors, r) {
  const perRow = Math.max(1, Math.floor(w / 2.4));
  for (let f = 0; f < floors; f++) {
    const y = 1.9 + f * 2.6;
    if (y > h - 0.8) break;
    for (let k = 0; k < perRow; k++) {
      const x = -w / 2 + (k + 0.5) * (w / perRow);
      if (f === 0 && Math.abs(x) < 1.2) continue; // door
      const frame = box(1.1, 1.2, 0.12, '#5b3a29', x, y, d / 2 + 0.03);
      const pane = mesh(new THREE.BoxGeometry(0.85, 0.95, 0.1), glass, { cast: false });
      pane.position.set(x, y, d / 2 + 0.07);
      g.add(frame, pane);
      if (f === 0 && r() < 0.7) {
        g.add(box(1.2, 0.3, 0.4, '#7a4e2d', x, y - 0.75, d / 2 + 0.25));
        for (let p = 0; p < 3; p++) g.add(box(0.22, 0.22, 0.22, ['#ef476f', '#ffd166', '#f8f9fa'][p], x - 0.35 + p * 0.35, y - 0.5, d / 2 + 0.3));
      }
    }
  }
  // side windows
  for (let f = 0; f < floors; f++) {
    const y = 1.9 + f * 2.6;
    if (y > h - 0.8) break;
    for (const s of [-1, 1]) {
      const pane = mesh(new THREE.BoxGeometry(0.1, 0.95, 0.85), glass, { cast: false });
      pane.position.set(s * (w / 2 + 0.05), y, 0);
      g.add(pane);
    }
  }
}

function pitchedRoof(w, d, rh, color) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 - 0.5, 0);
  shape.lineTo(w / 2 + 0.5, 0);
  shape.lineTo(0, rh);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d + 1, bevelEnabled: false });
  geo.translate(0, 0, -(d + 1) / 2);
  return mesh(geo, mat(color));
}

function chimney(g, x, y, z) {
  g.add(box(0.8, 1.8, 0.8, '#8d5b4c', x, y, z));
  g.add(box(1, 0.25, 1, '#6d4038', x, y + 0.95, z));
  const smoke = [];
  for (let i = 0; i < 4; i++) {
    const p = mesh(new THREE.IcosahedronGeometry(0.28, 0), new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, flatShading: true }), { cast: false });
    p.position.set(x, y + 1.2, z);
    p.userData.phase = i / 4;
    smoke.push(p);
    g.add(p);
  }
  g.userData.smoke = (g.userData.smoke || []).concat(smoke);
}

function genericBuilding(b, r) {
  const g = new THREE.Group();
  const lvl = Math.max(1, Math.min(5, b.level || 1));
  const kind = b.kind;
  const color = b.color || DEFAULT_COLORS[kind] || DEFAULT_COLORS.other;
  const floors = kind === 'house' ? 1 + Math.floor(lvl / 3) : 1 + Math.floor((lvl - 1) / 2);
  const w = 7 + lvl * 0.5;
  const d = 6.5;
  const h = 3.2 + (floors - 1) * 2.6;
  // foundation + walls
  g.add(box(w + 0.6, 0.4, d + 0.6, '#b9a48c', 0, 0.2, 0));
  g.add(box(w, h, d, color, 0, 0.4 + h / 2, 0));
  g.add(box(w + 0.1, 0.35, d + 0.1, shade(color, -0.12), 0, 0.4 + h - 0.1, 0));
  // roof
  const roofColor = ROOF_COLORS[kind] || ROOF_COLORS.other;
  if (kind === 'gallery' || kind === 'library') {
    g.add(box(w + 0.8, 0.6, d + 0.8, roofColor, 0, 0.4 + h + 0.3, 0));
    g.add(box(w * 0.6, 1, d * 0.6, shade(roofColor, 0.1), 0, 0.4 + h + 1, 0));
  } else {
    const roof = pitchedRoof(w, d, 2.4 + lvl * 0.15, roofColor);
    roof.rotation.y = Math.PI / 2;
    roof.position.y = 0.4 + h;
    // roof ridge runs left-right: rotate so the gable faces sideways
    roof.rotation.y = 0;
    roof.scale.set(1, 1, 1);
    g.add(roof);
  }
  // door + porch
  g.add(box(1.5, 2.3, 0.2, '#6b4226', 0, 0.4 + 1.15, d / 2 + 0.05));
  g.add(box(0.15, 0.15, 0.1, '#ffd166', 0.5, 0.4 + 1.1, d / 2 + 0.2));
  g.add(box(2.4, 0.25, 1.4, '#a58a6f', 0, 0.12, d / 2 + 0.7));
  addWindows(g, w, h + 0.4, d, floors, r);
  // name sign
  const s = sign(b.name, Math.min(4.6, w - 1));
  s.position.set(0, 0.4 + Math.min(h - 0.5, 3.1), d / 2 + 0.12);
  g.add(s);
  // extras by kind / level
  if (['house', 'bakery', 'workshop', 'cafe'].includes(kind)) chimney(g, w / 2 - 1.3, 0.4 + h + 1.4, -d / 4);
  if (kind === 'bakery' || kind === 'cafe' || kind === 'shop' || lvl >= 3) {
    const aw = new THREE.Group();
    const stripes = 6;
    for (let k = 0; k < stripes; k++) {
      const st = box(w / stripes, 0.12, 1.5, k % 2 ? '#fff5e6' : roofColor, -w / 2 + (k + 0.5) * (w / stripes), 0, 0);
      aw.add(st);
    }
    aw.position.set(0, 0.4 + 2.75, d / 2 + 0.75);
    aw.rotation.x = 0.35;
    g.add(aw);
  }
  if (kind === 'cafe' || kind === 'bakery') {
    for (const sx of [-2.3, 2.3]) {
      g.add(box(1, 0.1, 1, '#ffffff', sx, 1.0, d / 2 + 2.3));
      g.add(box(0.12, 1, 0.12, '#5b3a29', sx, 0.5, d / 2 + 2.3));
    }
  }
  if (kind === 'workshop') {
    g.add(box(1.2, 1, 1, '#c68b59', -w / 2 - 0.9, 0.5, d / 2 - 0.5));
    g.add(box(0.9, 0.8, 0.9, '#b07a4f', -w / 2 - 0.9, 1.4, d / 2 - 0.5));
  }
  if (kind === 'house') {
    // Loki's bed on the porch
    const bed = new THREE.Group();
    bed.add(mesh(new THREE.CylinderGeometry(0.95, 1.05, 0.35, 10), mat('#2a9d8f')));
    const cushion = mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.2, 10), mat('#f6e7cf'));
    cushion.position.y = 0.2;
    bed.add(cushion);
    bed.position.set(w / 2 - 1.2, 0.2, d / 2 + 1.6);
    g.add(bed);
    g.userData.bed = bed.position.clone();
  }
  if (lvl >= 4) {
    // little balcony / roof flag
    const pole = box(0.12, 2.2, 0.12, '#5b3a29', -w / 2 + 0.6, 0.4 + h + 1.1, d / 2 - 0.6);
    const flag = box(1.1, 0.7, 0.06, '#f28c28', -w / 2 + 1.2, 0.4 + h + 1.8, d / 2 - 0.6);
    g.add(pole, flag);
  }
  return { group: g, w: w + 0.6, d: d + 0.6, front: d / 2 + 2.6 };
}

function marketStall(b) {
  const g = new THREE.Group();
  const lvl = Math.max(1, Math.min(5, b.level || 1));
  const color = b.color || DEFAULT_COLORS.market;
  const w = 5 + lvl * 0.6;
  for (const [x, z] of [[-w / 2, -1.2], [w / 2, -1.2], [-w / 2, 1.2], [w / 2, 1.2]]) g.add(box(0.2, 3, 0.2, '#7a4e2d', x, 1.5, z));
  g.add(box(w + 0.2, 1, 1.4, '#a1785a', 0, 0.5, 0.6));
  for (let k = 0; k < 7; k++) g.add(box((w + 1) / 7, 0.15, 3.2, k % 2 ? '#fff5e6' : color, -(w + 1) / 2 + (k + 0.5) * ((w + 1) / 7), 3.1, 0));
  const goods = ['#f28c28', '#4cc9f0', '#ffd166', '#ef476f', '#06d6a0'];
  for (let k = 0; k < 4 + lvl; k++) g.add(box(0.45, 0.45, 0.45, goods[k % goods.length], -w / 2 + 0.6 + k * ((w - 1) / (3 + lvl)), 1.25, 0.6));
  const s = sign(b.name || 'Market', 3.4);
  s.position.set(0, 3.7, 1.3);
  g.add(s);
  return { group: g, w: w + 0.4, d: 3, front: 3.2 };
}

function fountain(b) {
  const g = new THREE.Group();
  const lvl = Math.max(1, Math.min(5, b.level || 1));
  const R = 2.2 + lvl * 0.3;
  g.add(mesh(new THREE.CylinderGeometry(R, R + 0.2, 0.8, 14), mat('#c9c3b8')));
  const water = mesh(new THREE.CylinderGeometry(R - 0.3, R - 0.3, 0.1, 14), new THREE.MeshStandardMaterial({ color: b.color || '#7fd3f2', roughness: 0.2, flatShading: true }), { cast: false });
  water.position.y = 0.38;
  g.add(water);
  g.add(box(0.5, 1.6 + lvl * 0.3, 0.5, '#bdb5a8', 0, 0.8, 0));
  const jet = mesh(new THREE.ConeGeometry(0.35, 1.2, 6), new THREE.MeshStandardMaterial({ color: '#bfefff', transparent: true, opacity: 0.75, flatShading: true }), { cast: false });
  jet.position.y = 2.4 + lvl * 0.3;
  jet.rotation.x = Math.PI;
  g.add(jet);
  g.userData.jet = jet;
  return { group: g, w: R * 2 + 0.4, d: R * 2 + 0.4, front: R + 1.5 };
}

function tree(r, scale = 1, color = '#3f8f4f') {
  const g = new THREE.Group();
  const h = (2 + r() * 1.2) * scale;
  g.add(mesh(new THREE.CylinderGeometry(0.18 * scale, 0.25 * scale, h, 6), mat('#7a4e2d')));
  g.children[0].position.y = h / 2;
  const kinds = r();
  const leaf = mat(shade(color, (r() - 0.5) * 0.1));
  if (kinds < 0.5) {
    const c = mesh(new THREE.IcosahedronGeometry(1.3 * scale, 0), leaf);
    c.position.y = h + 0.6 * scale;
    g.add(c);
  } else {
    for (let k = 0; k < 3; k++) {
      const c = mesh(new THREE.ConeGeometry((1.4 - k * 0.35) * scale, 1.5 * scale, 7), leaf);
      c.position.y = h - 0.2 * scale + k * 0.85 * scale;
      g.add(c);
    }
  }
  return g;
}

function park(b, r) {
  const g = new THREE.Group();
  const lvl = Math.max(1, Math.min(5, b.level || 1));
  const S = 11;
  g.add(mesh(new THREE.BoxGeometry(S, 0.15, S), mat(b.color || '#8fd16a'), { cast: false }));
  g.children[0].position.y = 0.08;
  g.add(box(1.6, 0.17, S, '#e3c58d', 0, 0.1, 0));
  for (let k = 0; k < 2 + lvl; k++) {
    const t = tree(r, 0.8 + r() * 0.4);
    t.position.set((r() < 0.5 ? -1 : 1) * (2 + r() * 3), 0, -S / 2 + 1 + r() * (S - 2));
    g.add(t);
  }
  for (let k = 0; k < 12 + lvl * 6; k++) g.add(box(0.2, 0.2, 0.2, ['#ef476f', '#ffd166', '#f8f9fa', '#c77dff'][k % 4], (r() - 0.5) * (S - 1), 0.25, (r() - 0.5) * (S - 1)));
  // bench
  const bench = new THREE.Group();
  bench.add(box(2, 0.15, 0.6, '#8a5a3b', 0, 0.6, 0), box(2, 0.5, 0.1, '#8a5a3b', 0, 0.95, -0.28), box(0.1, 0.6, 0.5, '#4a3b30', -0.9, 0.3, 0), box(0.1, 0.6, 0.5, '#4a3b30', 0.9, 0.3, 0));
  bench.position.set(1.8, 0, 2);
  bench.rotation.y = -Math.PI / 2;
  g.add(bench);
  const s = sign(b.name || 'Park', 3);
  s.position.set(0, 1.6, S / 2 - 0.2);
  g.add(s, box(0.15, 1.6, 0.15, '#6b4226', -1.3, 0.8, S / 2 - 0.3), box(0.15, 1.6, 0.15, '#6b4226', 1.3, 0.8, S / 2 - 0.3));
  return { group: g, w: 0, d: 0, front: S / 2 + 1.5, walkable: true };
}

function tower(b, r) {
  const g = new THREE.Group();
  const lvl = Math.max(1, Math.min(5, b.level || 1));
  const h = 7 + lvl * 1.6;
  g.add(mesh(new THREE.CylinderGeometry(2.2, 2.6, h, 10), mat(b.color || DEFAULT_COLORS.tower)));
  g.children[0].position.y = h / 2;
  const roof = mesh(new THREE.ConeGeometry(3, 3.2, 10), mat('#4a3f6b'));
  roof.position.y = h + 1.6;
  g.add(roof);
  for (let k = 0; k < Math.floor(h / 2.6); k++) {
    const pane = mesh(new THREE.BoxGeometry(0.7, 1, 0.2), glass, { cast: false });
    const a = k * 1.3;
    pane.position.set(Math.sin(a) * 2.35, 2 + k * 2.4, Math.cos(a) * 2.35);
    pane.rotation.y = a;
    g.add(pane);
  }
  g.add(box(1.4, 2.2, 0.3, '#6b4226', 0, 1.1, 2.45));
  const s = sign(b.name, 3.2);
  s.position.set(0, 2.9, 2.6);
  g.add(s);
  return { group: g, w: 5.4, d: 5.4, front: 4.4 };
}

export function buildBuilding(b) {
  const r = rng(b.id + ':' + (b.level || 1));
  let res;
  if (b.kind === 'market') res = marketStall(b, r);
  else if (b.kind === 'fountain') res = fountain(b, r);
  else if (b.kind === 'park' || b.kind === 'garden') res = park(b, r);
  else if (b.kind === 'tree') {
    const g = new THREE.Group();
    const t = tree(r, 1.8, b.color || '#3f8f4f');
    g.add(t);
    const s = sign(b.name, 2.6);
    s.position.set(0, 1.4, 2.4);
    g.add(s);
    res = { group: g, w: 2, d: 2, front: 3.5 };
  } else if (b.kind === 'tower') res = tower(b, r);
  else res = genericBuilding(b, r);
  return res;
}

// ---------- static world ----------
export function createGround(scene) {
  const size = PLOT * 15;
  const ground = mesh(new THREE.PlaneGeometry(size, size, 60, 60), mat('#8fd17a'), { cast: false });
  ground.rotation.x = -Math.PI / 2;
  // gentle bumps far away from the town
  const pos = ground.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const d = Math.hypot(x, y);
    if (d > PLOT * 4.5) pos.setZ(i, Math.sin(x * 0.05) * Math.cos(y * 0.06) * 3 * Math.min(1, (d - PLOT * 4.5) / 30) + (d - PLOT * 4.5) * 0.08);
  }
  ground.geometry.computeVertexNormals();
  scene.add(ground);

  // distant hills and forest ring
  const r = rng('forest');
  const ring = new THREE.Group();
  for (let k = 0; k < 160; k++) {
    const a = r() * Math.PI * 2;
    const d = PLOT * (4.8 + r() * 2);
    const t = tree(r, 1.2 + r() * 1.2, r() < 0.5 ? '#3f8f4f' : '#2f7a45');
    t.position.set(Math.cos(a) * d, d > PLOT * 5 ? (d - PLOT * 4.5) * 0.08 : 0, Math.sin(a) * d);
    ring.add(t);
  }
  scene.add(ring);
}

export function createPlaza(scene) {
  const g = new THREE.Group();
  const paving = mesh(new THREE.CylinderGeometry(7.5, 7.5, 0.12, 24), mat('#e7d3b0'), { cast: false });
  paving.position.y = 0.06;
  g.add(paving);
  const inner = mesh(new THREE.CylinderGeometry(4.5, 4.5, 0.14, 24), mat('#d9c29a'), { cast: false });
  inner.position.y = 0.07;
  g.add(inner);
  // lamp posts
  const lamps = [];
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const lp = new THREE.Group();
    lp.add(box(0.18, 3.4, 0.18, '#3b3b45', 0, 1.7, 0));
    const b = mesh(new THREE.IcosahedronGeometry(0.35, 0), bulb, { cast: false });
    b.position.y = 3.55;
    lp.add(b);
    lp.position.set(Math.cos(a) * 6.6, 0, Math.sin(a) * 6.6);
    const light = new THREE.PointLight('#ffcf80', 0, 14, 1.6);
    light.position.set(0, 3.4, 0);
    lp.add(light);
    lamps.push(light);
    g.add(lp);
  }
  scene.add(g);
  return { lamps };
}

export function createRoads(group, maxRing) {
  const ext = (maxRing + 0.5) * PLOT;
  const roadMat = mat('#e3c58d');
  for (let k = -maxRing; k <= maxRing + 1; k++) {
    const c = (k - 0.5) * PLOT;
    const a = mesh(new THREE.BoxGeometry(ROAD, 0.1, ext * 2 + ROAD), roadMat, { cast: false });
    a.position.set(c, 0.05, 0);
    const b = mesh(new THREE.BoxGeometry(ext * 2 + ROAD, 0.1, ROAD), roadMat, { cast: false });
    b.position.set(0, 0.051, c);
    group.add(a, b);
  }
}

export function noticeBoard(entry) {
  const g = new THREE.Group();
  const tex = textTexture(entry ? [entry.text] : ['Loki has not written anything yet.'], {
    w: 768,
    h: 512,
    title: entry ? `${entry.title}` : "Loki's diary",
    size: 34,
    bg: '#fdf6e3',
  });
  const board = mesh(new THREE.PlaneGeometry(3.6, 2.4), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }), { cast: false });
  board.position.set(0, 2.3, 0.08);
  g.add(box(3.9, 2.7, 0.15, '#7a4e2d', 0, 2.3, 0), board);
  g.add(box(0.2, 2.4, 0.2, '#5b3a29', -1.6, 1.0, 0), box(0.2, 2.4, 0.2, '#5b3a29', 1.6, 1.0, 0));
  const roof = box(4.3, 0.2, 0.7, '#b5523b', 0, 3.75, 0.1);
  g.add(roof);
  const s = sign("Loki's diary", 2.4);
  s.position.set(0, 4.15, 0.1);
  g.add(s);
  return g;
}

export function artWall(items) {
  const g = new THREE.Group();
  const n = Math.max(3, Math.min(6, items.length));
  const W = n * 2.3 + 0.6;
  g.add(box(W, 3.2, 0.4, '#f6efe6', 0, 1.6, 0));
  g.add(box(W + 0.3, 0.3, 0.7, '#3d6e9e', 0, 3.3, 0));
  const loader = new THREE.TextureLoader();
  for (let k = 0; k < n; k++) {
    const x = -W / 2 + 0.3 + (k + 0.5) * 2.3;
    g.add(box(2, 2, 0.1, '#5b3a29', x, 1.7, 0.22));
    const item = items[k];
    let m;
    if (item) {
      const tex = loader.load(`gallery/${encodeURIComponent(item.file)}`);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      m = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
    } else m = mat('#e9e4dc');
    const pic = mesh(new THREE.PlaneGeometry(1.7, 1.7), m, { cast: false });
    pic.position.set(x, 1.7, 0.28);
    g.add(pic);
  }
  const s = sign('Gallery wall', 2.6);
  s.position.set(0, 3.75, 0.25);
  g.add(s);
  return { group: g, w: W, d: 0.8 };
}

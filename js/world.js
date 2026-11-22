// The land around the buildings: meadow, hills, forest, roads, the plaza.
import * as THREE from 'three';
import { toon, block, part, shade, signBoard, paperTexture } from './toon.js';
import { PLOT, ROAD } from './layout.js';
import { tree, bulbs } from './buildings.js';
import { flower } from './rooms.js';
import { model, modelAsync } from './models.js';
import { mergeGroup } from './town2.js';
import { kitModel } from './kit.js';

// Cobblestone texture (drawn once): rounded stones in warm greys with darker joints.
let cobbleCanvas = null;
function cobbleImage() {
  if (cobbleCanvas) return cobbleCanvas;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#8f8576';
  g.fillRect(0, 0, 256, 256);
  const r = rng('cobble');
  const tones = ['#cfc3ae', '#c4b79f', '#d8cdb9', '#bcae96', '#c9bda6', '#b5a891'];
  const row = 32;
  for (let y = 0; y < 256 + row; y += row) {
    const shift = (y / row) % 2 ? row / 2 : 0;
    for (let x = -row; x < 256 + row; x += row) {
      const w = row - 4 + r() * 3, h = row - 5 + r() * 3;
      g.fillStyle = tones[Math.floor(r() * tones.length)];
      g.beginPath();
      g.roundRect(x + shift + 2, y + 2, w, h, 9);
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.beginPath();
      g.roundRect(x + shift + 5, y + 4, w * 0.6, h * 0.35, 6);
      g.fill();
    }
  }
  cobbleCanvas = c;
  return c;
}
export function cobble(repeatX, repeatY, tint = '#ffffff') {
  const t = new THREE.CanvasTexture(cobbleImage());
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return new THREE.MeshToonMaterial({ map: t, color: tint });
}

export function rng(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createLand(scene, maxRing = 1) {
  const size = PLOT * (maxRing * 2 + 22);
  const geo = new THREE.PlaneGeometry(size, size, 90, 90);
  const pos = geo.attributes.position;
  const colors = [];
  const base = new THREE.Color('#9ad57c'), far = new THREE.Color('#79c06a'), light = new THREE.Color('#b5e38f');
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const d = Math.hypot(x, y);
    const edge = PLOT * (maxRing + 5);
    let h = 0;
    if (d > edge) h = (d - edge) * 0.12 + Math.sin(x * 0.03) * Math.cos(y * 0.035) * 6 * Math.min(1, (d - edge) / 40);
    pos.setZ(i, h);
    const c = base.clone().lerp(far, Math.min(1, Math.max(0, (d - edge) / 80))).lerp(light, (Math.sin(x * 0.11) * Math.cos(y * 0.09) + 1) * 0.12);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const ground = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ vertexColors: true }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // forest ring, rocks and bushes outside town
  const r = rng('forest');
  const g = new THREE.Group();
  const forest = [];
  for (let k = 0; k < 170; k++) {
    const a = r() * Math.PI * 2;
    const d = PLOT * (maxRing + 5.2 + r() * 3);
    const sz = 1.1 + r() * 1.3;
    const path = ['nature/tree_oak', 'nature/tree_default', 'nature/tree_detailed', 'nature/tree_fat', 'nature/tree_cone', 'nature/tree_pineRoundA'][Math.floor(r() * 6)];
    const hgt = d > PLOT * (maxRing + 5) ? (d - PLOT * (maxRing + 5)) * 0.12 : 0;
    forest.push({ path, sz, x: Math.cos(a) * d, y: hgt - 0.2, z: Math.sin(a) * d, ry: r() * 6 });
  }
  for (let k = 0; k < 40; k++) {
    const a = r() * Math.PI * 2, d = PLOT * (maxRing + 2.6 + r() * 2.2);
    const rock = part(new THREE.DodecahedronGeometry(0.6 + r() * 0.9, 0), '#b8b2a7', { x: Math.cos(a) * d, y: 0.3, z: Math.sin(a) * d, ink: 0.04 });
    rock.scale.y = 0.6;
    g.add(rock);
  }
  g.name = 'land';
  ground.name = 'land';
  scene.add(g);
  // build the forest, then merge it into a handful of meshes
  (async () => {
    const f = new THREE.Group();
    for (const t of forest) {
      const m = await modelAsync(t.path, 2.6 * t.sz, 2.6 * t.sz, { h: 5 * t.sz });
      m.position.set(t.x, t.y, t.z);
      m.rotation.y = t.ry;
      f.add(m);
    }
    const merged = mergeGroup(f);
    merged.name = 'land';
    scene.add(merged);
  })().catch((e) => console.warn('forest failed', e));
}

export function createRoads(group, maxRing) {
  const ext = (maxRing + 0.5) * PLOT;
  const roadMat = toon('#e8cf9d');
  const edgeMat = toon('#cdb084');
  for (let k = -maxRing; k <= maxRing + 1; k++) {
    const c = (k - 0.5) * PLOT;
    for (const [w, d, x, z] of [[ROAD, ext * 2 + ROAD, c, 0], [ext * 2 + ROAD, ROAD, 0, c]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), cobble(w / 1.6, d / 1.6));
      m.position.set(x, 0.05, z);
      m.receiveShadow = true;
      group.add(m);
      const e = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.08, d + 0.4), edgeMat);
      e.position.set(x, 0.04, z);
      e.receiveShadow = true;
      group.add(e);
    }
  }
  // short paths from the plaza to the main roads
  for (const [x, z, w, d] of [[0, PLOT / 4 + 2, ROAD, PLOT / 2 - 4], [0, -PLOT / 4 - 2, ROAD, PLOT / 2 - 4], [PLOT / 4 + 2, 0, PLOT / 2 - 4, ROAD], [-PLOT / 4 - 2, 0, PLOT / 2 - 4, ROAD]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), cobble(w / 1.6, d / 1.6));
    m.position.set(x, 0.05, z);
    m.receiveShadow = true;
    group.add(m);
  }
}

// Plaza: paving, lamps, benches, diary board, mailbox (leave him something), what's-on board.
export function createPlaza(group, { diary, whatsOn }) {
  const colliders = [];
  const items = [];
  const places = [];
  const SQ = PLOT - ROAD - 0.4; // the whole central block is one cobbled town square
  const paving = new THREE.Mesh(new THREE.BoxGeometry(SQ, 0.12, SQ), cobble(SQ / 1.3, SQ / 1.3, '#f3e7d2'));
  paving.position.y = 0.06;
  paving.receiveShadow = true;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 9.5, 0.14, 48), cobble(9, 9, '#e6cfa8'));
  ring.position.y = 0.07;
  ring.receiveShadow = true;
  const border = part(new THREE.TorusGeometry(9.5, 0.18, 6, 64), '#9c8b74', { y: 0.12, ink: 0, shadow: false });
  border.rotation.x = Math.PI / 2;
  group.add(paving, ring, border);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const kerb = block(SQ, 0.18, 0.35, '#a99a84', 0, 0.1, sz * SQ / 2, { ink: false, cast: false });
    const kerb2 = block(0.35, 0.18, SQ, '#a99a84', sx * SQ / 2, 0.1, 0, { ink: false, cast: false });
    group.add(kerb, kerb2);
  }
  const lamps = [];
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const lp = new THREE.Group();
    kitModel('lantern', { scale: 2.5 }).then((m) => lp.add(m));
    lp.add(part(new THREE.SphereGeometry(0.16, 10, 8), '#fff', { y: 3.62, mat: bulbs, ink: 0, shadow: false }));
    const light = new THREE.PointLight('#ffcf80', 0, 16, 1.6);
    light.position.y = 3.6;
    lp.add(light);
    lamps.push(light);
    lp.position.set(Math.cos(a) * 8.6, 0, Math.sin(a) * 8.6);
    group.add(lp);
    colliders.push({ x: lp.position.x, z: lp.position.z, hw: 0.25, hd: 0.25, h: 4 });
  }
  // the town fountain in the middle of the square (Kenney Fantasy Town Kit)
  const fountain = new THREE.Group();
  kitModel('fountain-round-detail', { scale: 2.7 }).then((m) => fountain.add(m));
  kitModel('fountain-center', { scale: 2.7 }).then((m) => fountain.add(m));
  const water = new THREE.Mesh(new THREE.CircleGeometry(2.35, 40), new THREE.MeshToonMaterial({ color: '#7cc8f0', transparent: true, opacity: 0.85 }));
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.62;
  fountain.add(water);
  group.add(fountain);
  colliders.push({ x: 0, z: 0, hw: 2.4, hd: 2.4, h: 1.5 });
  places.push({ id: 'plaza:fountain', building: 'plaza', act: 'admire', label: 'watching the fountain sparkle', where: 'the town square', x: 0, z: 3.4, face: Math.PI, inside: false });
  // market stalls on the south side of the square
  for (const [x, v] of [[-4.6, 'stall-red'], [4.6, 'stall-green']]) {
    const st = new THREE.Group();
    kitModel(v, { scale: 2.6 }).then((m) => st.add(m));
    st.position.set(x, 0, 7.2);
    st.rotation.y = Math.PI;
    group.add(st);
    colliders.push({ x, z: 7.2, hw: 1.3, hd: 1.3, h: 2.5 });
  }
  // diary board (north)
  const board = new THREE.Group();
  const tex = paperTexture(diary ? diary.title : "Loki's diary", diary ? diary.text : 'Nothing written yet.', { w: 900, h: 620 });
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 2.6), new THREE.MeshBasicMaterial({ map: tex }));
  paper.position.set(0, 2.2, 0.125);
  board.add(block(4.2, 3, 0.2, '#7a4a2a', 0, 2.2, 0), paper);
  board.add(block(0.22, 2.6, 0.22, '#5b3a29', -1.9, 1.0, 0), block(0.22, 2.6, 0.22, '#5b3a29', 1.9, 1.0, 0));
  board.add(block(4.7, 0.25, 0.9, '#b5523b', 0, 3.85, 0.1));
  const s = signBoard("Loki's diary", 2.8, { icon: '' });
  s.position.set(0, 4.35, 0.2);
  board.add(s);
  board.position.set(-3.2, 0, -6.5);
  board.rotation.y = 0.35;
  group.add(board);
  colliders.push({ x: -3.2, z: -6.5, hw: 2.1, hd: 0.6, h: 3 });
  items.push({ type: 'diary', x: -2.4, z: -4.6, r: 2.6, label: "Read Loki's diary" });

  // mailbox: leave him something
  const mb = new THREE.Group();
  mb.add(part(new THREE.CylinderGeometry(0.12, 0.12, 1.3, 8), '#5b3a29', { y: 0.65, ink: 0.02 }));
  const box = part(new THREE.CapsuleGeometry(0.42, 0.7, 6, 12), '#e63946', { y: 1.55, ink: 0.03 });
  box.rotation.z = Math.PI / 2;
  mb.add(box);
  mb.add(block(0.6, 0.06, 0.06, '#2b1a10', 0, 1.62, 0.43, { ink: false }));
  const flag = block(0.08, 0.5, 0.06, '#ffd166', 0.62, 1.8, 0);
  mb.add(flag);
  const ms = signBoard('Leave him something', 2.6, { icon: '', color: '#b5523b' });
  ms.position.set(0, 2.55, 0);
  mb.add(ms);
  mb.position.set(3.4, 0, -6.4);
  mb.rotation.y = -0.35;
  group.add(mb);
  colliders.push({ x: 3.4, z: -6.4, hw: 0.7, hd: 0.5, h: 2 });
  items.push({ type: 'offer', x: 2.8, z: -4.7, r: 2.6, label: 'Leave Loki something' });

  // benches
  for (const [x, z, r] of [[-7.5, 2.5, Math.PI / 2], [7.5, 2.5, -Math.PI / 2]]) {
    const b = new THREE.Group();
    b.add(block(2.2, 0.15, 0.7, '#8a5a3b', 0, 0.6, 0), block(2.2, 0.5, 0.12, '#8a5a3b', 0, 0.95, -0.3), block(0.12, 0.6, 0.6, '#4a3b30', -1, 0.3, 0), block(0.12, 0.6, 0.6, '#4a3b30', 1, 0.3, 0));
    b.position.set(x, 0, z);
    b.rotation.y = r;
    group.add(b);
    colliders.push({ x, z, hw: 0.4, hd: 1.15, h: 1 });
  }
  places.push({ id: 'plaza:center', building: 'plaza', act: 'stroll', label: 'wandering around the plaza', where: 'the plaza', x: 1.5, z: 1.5, face: 0, inside: false });
  places.push({ id: 'plaza:bench', building: 'plaza', act: 'sit', label: 'sitting on a plaza bench, people-watching', where: 'the plaza', x: -6.6, z: 2.5, face: Math.PI / 2, inside: false });
  places.push({ id: 'plaza:mail', building: 'plaza', act: 'mail', label: 'checking the mailbox for gifts', where: 'the plaza', x: 2.8, z: -4.9, face: Math.PI, inside: false });
  places.push({ id: 'plaza:board', building: 'plaza', act: 'write', label: 'pinning a new page on the diary board', where: 'the plaza', x: -2.6, z: -4.9, face: Math.PI, inside: false });
  return { lamps, colliders, items, places };
}

// Empty plots become little meadows with a "free plot" sign; roads get trees & lamps.
export const decorList = []; // neighbourhood footprints, for the big map
export function decorate(group, usedPlots, maxRing, plotInfoFn) {
  const colliders = [];
  decorList.length = 0;
  const r = rng('decor');
  const SUB = 'abcdefghijklmnopqrstu'.split('');
  const COM = 'abcdefghijklmn'.split('');
  const place = (m, x, z, rot, hw, hd) => {
    m.position.set(x, 0, z);
    m.rotation.y = rot;
    group.add(m);
    if (hw) colliders.push({ x, z, hw, hd, h: 8 });
    const path = m.userData.model || '';
    decorList.push({ x, z, hw, hd, kind: /skyscraper/.test(path) ? 'tower' : /commercial\/building/.test(path) ? 'shop' : /suburban\/building/.test(path) ? 'home' : /tree/.test(path) || !path ? 'tree' : 'plant' });
  };
  for (let idx = 0; idx < 400; idx++) {
    const info = plotInfoFn(idx);
    if (info.ring > maxRing + 1) break;
    if (usedPlots.has(idx)) continue;
    const roll = r();
    const side = Math.abs(info.dx) > 0;
    // perpendicular offset for pairs of houses
    const px = side ? 0 : 1, pz = side ? 1 : 0;
    if (info.ring > maxRing) {
      // skyline ring: city blocks and skyscrapers, with open gaps to walk through
      if (r() < 0.45) continue;
      for (const k of [r() < 0.5 ? -1 : 1]) {
        const tall = r() < 0.45;
        const name = tall ? `commercial/building-skyscraper-${'abcde'[Math.floor(r() * 5)]}` : `commercial/building-${COM[Math.floor(r() * COM.length)]}`;
        const sz = tall ? 10 : 11;
        const m = model(name, sz, sz, { h: tall ? 22 + r() * 16 : null });
        place(m, info.x + px * k * 7.5, info.z + pz * k * 7.5, info.rot, sz / 2, sz / 2);
      }
      continue;
    }
    if (roll < 0.55) {
      // two neighbours' houses with fences, trees and a planter
      for (const k of [-1, 1]) {
        const m = model(`suburban/building-type-${SUB[Math.floor(r() * SUB.length)]}`, 9, 9);
        const hx = info.x + px * k * 6.5 - info.dx * 1, hz = info.z + pz * k * 6.5 - info.dz * 1;
        place(m, hx, hz, info.rot, 4.5, 4.5);
        const f = model('suburban/fence-2x3', 9.5, 2, { stretch: true, h: 1 });
        place(f, hx + info.dx * 6.2, hz + info.dz * 6.2, info.rot + Math.PI / 2 * 0, 0, 0);
        const t = tree(0.8, r());
        place(t, hx - info.dx * 6 + px * k * 3, hz - info.dz * 6 + pz * k * 3, 0, 0.5, 0.5);
      }
      const pl = model('suburban/planter', 2, 2);
      place(pl, info.x + info.dx * 9, info.z + info.dz * 9, info.rot, 1, 1);
    } else if (roll < 0.75) {
      // corner shop with parasols
      const m = model(`commercial/building-${COM[Math.floor(r() * COM.length)]}`, 12, 12);
      place(m, info.x - info.dx * 2, info.z - info.dz * 2, info.rot, 6, 6);
      for (const k of [-1, 1]) {
        const ps = model(`commercial/detail-parasol-${r() < 0.5 ? 'a' : 'b'}`, 2.4, 2.4);
        place(ps, info.x + info.dx * 7.5 + px * k * 3, info.z + info.dz * 7.5 + pz * k * 3, 0, 0, 0);
      }
    } else {
      // a lawn Loki may build on
      for (let k = 0; k < 4; k++) {
        const t = tree(0.9 + r() * 0.5, r());
        const x = info.x + (r() - 0.5) * 20, z = info.z + (r() - 0.5) * 20;
        place(t, x, z, 0, 0.5, 0.5);
      }
      for (let k = 0; k < 10; k++) {
        const b = model(`nature/${['plant_bush', 'plant_bushLarge', 'grass_large', 'flower_redA', 'flower_yellowA', 'flower_purpleB', 'mushroom_redGroup'][k % 7]}`, 1.2, 1.2, { h: 0.9 });
        place(b, info.x + (r() - 0.5) * 22, info.z + (r() - 0.5) * 22, r() * 6, 0, 0);
      }
      const s = signBoard('For sale · Loki may build here', 4.2, { icon: '', color: '#8d6e4e' });
      const sp = new THREE.Group();
      sp.add(s, block(0.15, 1.4, 0.15, '#6b4226', -1.6, -0.9, -0.05), block(0.15, 1.4, 0.15, '#6b4226', 1.6, -0.9, -0.05));
      sp.position.set(info.x + info.dx * 9.5, 1.9, info.z + info.dz * 9.5);
      sp.rotation.y = info.rot;
      group.add(sp);
    }
  }
  // street trees and lamps along the roads
  const ext = (maxRing + 0.5) * PLOT;
  for (let k = -maxRing; k <= maxRing + 1; k++) {
    const c = (k - 0.5) * PLOT;
    for (let s = -ext; s <= ext; s += 14) {
      if (Math.hypot(c, s) < 14) continue;
      const side = 3.2;
      for (const [x, z] of [[c + side, s + 7], [s + 7, c - side]]) {
        if (Math.abs(x) < 15.5 && Math.abs(z) < 15.5) continue; // the plaza block holds Loki's exhibits
        if (Math.round((x + z) * 7) % 3 === 0) {
          const lp = new THREE.Group();
          lp.add(part(new THREE.CylinderGeometry(0.07, 0.1, 3, 8), '#3b3b45', { y: 1.5, ink: 0.015 }), part(new THREE.SphereGeometry(0.2, 10, 8), '#fff', { y: 3.1, mat: bulbs, ink: 0.01 }));
          lp.position.set(x, 0, z);
          group.add(lp);
        } else {
          const t = tree(0.7, 0.2);
          t.position.set(x, 0, z);
          group.add(t);
        }
        colliders.push({ x, z, hw: 0.3, hd: 0.3, h: 3 });
      }
    }
  }
  return colliders;
}

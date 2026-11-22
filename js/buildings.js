// Builds every kind of building from town data. Enterable buildings get real rooms;
// when the visitor walks in, the roof lifts off and the walls drop to a dollhouse view.
import * as THREE from 'three';
import { toon, block, part, edges, shade, signBoard } from './toon.js';
import { layoutBuilding, roomsOf, ROOM_INFO, ENTERABLE, WALL_H, WALL_T, FLOOR_Y, plotInfo, toWorld, boxToWorld } from './layout.js';
import { buildRoom, flower } from './rooms.js';
import { model } from './models.js';
import { DEFAULT_BRANDS, logoSign, housePlaque } from './brand.js';

export const glass = new THREE.MeshToonMaterial({ color: '#bfe3ff', emissive: '#ffcf6e', emissiveIntensity: 0 });
export const bulbs = new THREE.MeshToonMaterial({ color: '#fff3c4', emissive: '#ffd27a', emissiveIntensity: 0 });

// Same palette as the Kenney Fantasy Town Kit cottages, so Loki's buildings match the town.
const KIND = {
  house: { wall: '#f4e3c3', roof: '#c4553f', icon: '' },
  workshop: { wall: '#e6d3b3', roof: '#8c5a3c', icon: '' },
  bakery: { wall: '#f7e8cf', roof: '#c4553f', icon: '' },
  cafe: { wall: '#f1e0c4', roof: '#4e9a8f', icon: '' },
  gallery: { wall: '#eef0f2', roof: '#4f74b8', icon: '' },
  library: { wall: '#e9dfee', roof: '#8e5d93', icon: '' },
  shop: { wall: '#f4e3c3', roof: '#c4553f', icon: '' },
  tower: { wall: '#e9dfee', roof: '#5d6b7a', icon: '' },
  other: { wall: '#efe0c6', roof: '#8c5a3c', icon: '' },
};
const TIMBER = '#a8683f';

// Half-timbered wall: stone base, plaster, beams and cross braces (drawn once per colour).
const timberCache = new Map();
function timberImage(plaster) {
  if (timberCache.has(plaster)) return timberCache.get(plaster);
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 384;
  const g = c.getContext('2d');
  g.fillStyle = plaster;
  g.fillRect(0, 0, 256, 384);
  // soft plaster texture
  for (let k = 0; k < 500; k++) {
    g.fillStyle = `rgba(0,0,0,${Math.random() * 0.035})`;
    g.fillRect(Math.random() * 256, Math.random() * 300, 3 + Math.random() * 8, 2 + Math.random() * 6);
  }
  // stone base
  const base = 300;
  g.fillStyle = '#9d968c';
  g.fillRect(0, base, 256, 84);
  const st = ['#b8b1a6', '#aaa397', '#c3bcb0', '#a39c91'];
  for (let y = base + 3; y < 384; y += 26) for (let x = ((y / 26) % 2) * -24; x < 256; x += 50) {
    g.fillStyle = st[Math.floor(Math.random() * st.length)];
    g.beginPath();
    g.roundRect(x + 2, y, 46, 22, 6);
    g.fill();
  }
  // timber frame
  g.fillStyle = '#8a5432';
  const beam = (x, y, w, h) => {
    g.fillRect(x, y, w, h);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(x, y, w, 3);
    g.fillStyle = '#8a5432';
  };
  beam(0, 0, 256, 14);
  beam(0, base - 14, 256, 16);
  beam(0, 150, 256, 12);
  beam(0, 0, 16, base);
  beam(240, 0, 16, base);
  g.strokeStyle = '#8a5432';
  g.lineWidth = 12;
  g.beginPath();
  g.moveTo(16, 150);
  g.lineTo(120, 14);
  g.moveTo(240, 150);
  g.lineTo(136, 14);
  g.stroke();
  timberCache.set(plaster, c);
  return c;
}
function timberMat(plaster, length) {
  const t = new THREE.CanvasTexture(timberImage(plaster));
  t.wrapS = THREE.RepeatWrapping;
  t.repeat.set(Math.max(1, Math.round(length / 2.6)), 1);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return new THREE.MeshToonMaterial({ map: t });
}
// Roof tiles in rows, like the kit's roofs.
const tileCache = new Map();
function tileMat(color) {
  if (tileCache.has(color)) return tileCache.get(color);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const base = new THREE.Color(color);
  g.fillStyle = `#${base.clone().multiplyScalar(0.72).getHexString()}`;
  g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 16) for (let x = ((y / 16) % 2) * -12; x < 128; x += 24) {
    const v = 0.9 + Math.random() * 0.2;
    g.fillStyle = `#${base.clone().multiplyScalar(v).getHexString()}`;
    g.beginPath();
    g.roundRect(x + 1, y + 1, 22, 14, [2, 2, 8, 8]);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(0.55, 0.55);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshToonMaterial({ map: t });
  tileCache.set(color, m);
  return m;
}
const FLOOR = ['#e9cfa6', '#dcbf95', '#e3c9a2', '#d8b88c'];

function gableRoof(W, D, color, level) {
  const g = new THREE.Group();
  const rise = Math.min(W, D) * 0.32 + level * 0.1;
  const overhang = 0.7;
  const shape = new THREE.Shape();
  shape.moveTo(-W / 2 - overhang, 0);
  shape.lineTo(W / 2 + overhang, 0);
  shape.lineTo(0, rise);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: D + overhang * 2, bevelEnabled: false });
  geo.translate(0, 0, -(D + overhang * 2) / 2);
  const roof = new THREE.Mesh(geo, [toon(shade(color, -0.2)), tileMat(color)]);
  roof.castShadow = true;
  roof.receiveShadow = true;
  edges(roof);
  g.add(roof);
  // ridge cap
  const ridge = part(new THREE.CylinderGeometry(0.16, 0.16, D + overhang * 2, 8), shade(color, -0.25), { x: 0, y: rise - 0.02, ink: 0.01 });
  ridge.rotation.x = Math.PI / 2;
  g.add(ridge);
  return { group: g, rise };
}

function windowOn(wallGroup, x, y, z, rotY) {
  const w = new THREE.Group();
  w.add(block(1.25, 1.35, 0.14, '#b87443', 0, 0, 0));
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.1), glass);
  pane.position.z = 0.08;
  w.add(pane);
  w.add(block(1.0, 0.06, 0.05, '#8a5432', 0, 0, 0.1, { ink: false }), block(0.06, 1.1, 0.05, '#8a5432', 0, 0, 0.1, { ink: false }));
  w.add(block(1.4, 0.12, 0.35, '#b87443', 0, -0.72, 0.15));
  for (const sx of [-1, 1]) w.add(block(0.5, 1.3, 0.06, '#5f8f6a', sx * 0.92, 0, 0.12)); // shutters
  // flower box
  w.add(block(1.2, 0.25, 0.3, '#8d5b3c', 0, -0.9, 0.25));
  for (let k = 0; k < 5; k++) {
    const f = flower(['#ef476f', '#ffd166', '#f8f9fa', '#c77dff', '#ef476f'][k], 0.22);
    f.position.set(-0.44 + k * 0.22, -0.8, 0.27);
    w.add(f);
  }
  w.position.set(x, y, z);
  w.rotation.y = rotY;
  wallGroup.add(w);
}

function enterable(b, ctx) {
  const info = plotInfo(b.plot);
  const style = KIND[b.kind] || KIND.other;
  const lay = layoutBuilding(b);
  const { W, D } = lay;
  const root = new THREE.Group();
  const wallGroup = new THREE.Group();
  const interior = new THREE.Group();
  root.add(wallGroup, interior);
  // Loki's own colour choice tints the plaster gently, so it still fits the town
  const wallColor = b.color ? '#' + new THREE.Color(style.wall).lerp(new THREE.Color(b.color), 0.35).getHexString() : style.wall;
  const level = Math.max(1, Math.min(5, b.level || 1));

  // foundation, porch, floor
  root.add(block(W + 0.8, 0.3, D + 0.8, '#b9a48c', 0, 0.15, 0));
  root.add(block(3.2, 0.22, 1.6, '#a58a6f', lay.door.x, 0.11, D / 2 + 1.1));
  root.add(block(2.2, 0.12, 0.6, '#a58a6f', lay.door.x, 0.06, D / 2 + 2.1));
  lay.cells.forEach((c, i) => {
    const f = new THREE.Mesh(new THREE.BoxGeometry(c.size, 0.06, c.size), toon(FLOOR[i % FLOOR.length]));
    f.position.set(c.cx, 0.33, c.cz);
    f.receiveShadow = true;
    interior.add(f);
  });

  // walls: exterior face painted, inside cream
  const inside = toon('#fbf1df');
  const trim = toon(TIMBER);
  for (const w of lay.walls) {
    const ext = Math.abs(Math.abs(w.z) - D / 2) < 0.01 && w.d < 1 ? (w.z > 0 ? 4 : 5) : Math.abs(Math.abs(w.x) - W / 2) < 0.01 && w.w < 1 ? (w.x > 0 ? 0 : 1) : -1;
    const mats = [inside, inside, trim, inside, inside, inside];
    if (ext >= 0) mats[ext] = timberMat(wallColor, Math.max(w.w, w.d));
    const m = new THREE.Mesh(new THREE.BoxGeometry(w.w, WALL_H, w.d), mats);
    m.position.set(w.x, 0.33 + WALL_H / 2, w.z);
    m.castShadow = true;
    m.receiveShadow = true;
    edges(m);
    wallGroup.add(m);
  }
  // corner trims + top band
  for (const [x, z] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]]) wallGroup.add(block(0.45, WALL_H + 0.1, 0.45, '#8a5432', x, 0.33 + WALL_H / 2, z));

  // windows on the outside (front, back, sides)
  const wy = 0.33 + 1.9;
  lay.cells.forEach((c) => {
    if (c.r === 0 && c !== lay.cells[0]) windowOn(wallGroup, c.cx, wy, D / 2 + 0.15, 0);
    if (Math.abs(c.cz + D / 2 - c.size / 2) < 0.01) windowOn(wallGroup, c.cx, wy, -D / 2 - 0.15, Math.PI);
    if (Math.abs(c.cx - (-W / 2 + c.size / 2)) < 0.01) windowOn(wallGroup, -W / 2 - 0.15, wy, c.cz, -Math.PI / 2);
    if (Math.abs(c.cx - (W / 2 - c.size / 2)) < 0.01) windowOn(wallGroup, W / 2 + 0.15, wy, c.cz, Math.PI / 2);
  });
  // door frames on every doorway (interior + front), so doorways read as doors
  const trimC = shade(wallColor, -0.25);
  for (const f of lay.frames) {
    const fr = new THREE.Group();
    const hw = 0.8;
    fr.add(block(0.14, 2.45, WALL_T + 0.08, trimC, -hw - 0.07, 1.22, 0), block(0.14, 2.45, WALL_T + 0.08, trimC, hw + 0.07, 1.22, 0));
    fr.add(block(hw * 2 + 0.28, 0.16, WALL_T + 0.08, trimC, 0, 2.5, 0));
    fr.add(block(hw * 2, WALL_H - 2.58, WALL_T, f.exterior ? wallColor : '#fbf1df', 0, 2.58 + (WALL_H - 2.58) / 2, 0)); // wall above the door
    if (f.exterior) {
      // front door, swung open inwards against the wall
      const hinge = new THREE.Group();
      const door = block(1.5, 2.35, 0.08, '#7a4a2a', 0.75, 1.18, 0);
      for (const y of [0.6, 1.6]) door.add(block(1.2, 0.6, 0.02, '#8d5b3c', 0, y - 1.18, 0.05, { ink: false }));
      door.add(part(new THREE.SphereGeometry(0.06, 10, 8), '#ffd166', { x: 0.6, y: 0, z: 0.08, ink: 0 }));
      hinge.add(door);
      hinge.position.set(-hw, 0, -0.1);
      hinge.rotation.y = -Math.PI / 2 + 0.15;
      fr.add(hinge);
    }
    fr.position.set(f.x, 0.33, f.z);
    if (f.along === 'z') fr.rotation.y = Math.PI / 2;
    wallGroup.add(fr);
  }
  // welcome mat
  const mat = block(1.4, 0.03, 0.8, '#c4621a', lay.door.x, 0.35, D / 2 + 0.7, { ink: false, cast: false });
  root.add(mat);
  // lantern by the door
  const lantern = part(new THREE.SphereGeometry(0.16, 10, 8), '#fff', { x: lay.door.x + 1.3, y: 0.33 + 2.3, z: D / 2 + 0.3, mat: bulbs, ink: 0.015 });
  wallGroup.add(lantern);

  // roof + chimney
  const roof = gableRoof(W + 0.2, D + 0.2, b.roof || style.roof, level);
  roof.group.position.y = 0.33 + WALL_H;
  root.add(roof.group);
  if (['house', 'bakery', 'workshop', 'cafe'].includes(b.kind)) {
    const ch = new THREE.Group();
    ch.add(block(0.9, 2.2, 0.9, '#8d5b4c', 0, 0, 0), block(1.1, 0.25, 1.1, '#6d4038', 0, 1.15, 0));
    ch.position.set(W / 4, roof.rise * 0.55 + 1, -D / 6);
    roof.group.add(ch);
    ch.userData.smoke = true;
    ctx.smoke.push({ obj: ch, building: b.id });
  }
  if (level >= 3) {
    const flag = new THREE.Group();
    flag.add(block(0.1, 2.4, 0.1, dark(), 0, 1.2, 0, { ink: false }), block(1.2, 0.7, 0.05, '#f28c28', 0.6, 2.0, 0));
    flag.position.set(-W / 2 + 0.6, roof.rise * 0.2, D / 2 - 0.6);
    roof.group.add(flag);
  }

  // sign above the door
  // shop-front logo for businesses; homes get a house-number plaque and a letterbox instead
  let sign;
  if (b.kind === 'house') {
    sign = housePlaque(b.number || '7', b.names || 'Loki & Pip');
    sign.position.set(lay.door.x + 1.25, 0.33 + 1.9, D / 2 + 0.16);
    const box = new THREE.Group();
    box.add(block(0.08, 1.0, 0.08, '#3b3b45', 0, 0.5, 0, { ink: false }), block(0.45, 0.32, 0.3, '#1d3557', 0, 1.1, 0));
    box.position.set(lay.door.x - 1.6, 0, D / 2 + 2.6);
    root.add(box);
  } else {
    const brand = { ...(DEFAULT_BRANDS[b.kind] || DEFAULT_BRANDS.other), ...(b.brand || {}) };
    sign = logoSign(brand, Math.min(4.4, Math.max(3.2, W * 0.42)));
    sign.position.set(lay.door.x, 0.33 + 3.02, D / 2 + 0.2);
  }
  root.add(sign);

  // rooms + furniture
  const places = [];
  const blockers = [];
  const items = [];
  const ticks = [];
  let galleryCount = 0;
  lay.cells.forEach((c) => {
    const room = { ...c.room };
    if (room.kind === 'gallery') room.galleryOffset = 5 * galleryCount++;
    const r = buildRoom(room.kind, ctx, c.size / 2 - WALL_T / 2 - 0.05, room);
    r.group.position.set(c.cx, 0.36, c.cz);
    interior.add(r.group);
    const meta = ROOM_INFO[room.kind] || { name: room.kind, icon: '' };
    for (const bl of r.blockers) blockers.push({ x: c.cx + bl.x, z: c.cz + bl.z, w: bl.w, d: bl.d, h: 1.2 });
    for (const s of r.spots) {
      const p = toWorld(info, c.cx + s.x, c.cz + s.z);
      places.push({ id: `${room.id}:${s.act}`, building: b.id, room: room.id, roomKind: room.kind, act: s.act, label: s.label, name: `${room.name || meta.name}`, where: `${b.name} · ${room.name || meta.name}`, x: p.x, z: p.z, y: FLOOR_Y + (s.onTop || 0), face: s.face + info.rot, inside: true, onBed: s.act === 'sleep' });
    }
    for (const it of r.items) {
      const p = toWorld(info, c.cx + it.x, c.cz + it.z);
      items.push({ ...it, x: p.x, z: p.z, building: b.id });
    }
    if (r.tick) ticks.push({ fn: r.tick, roomId: room.id });
  });

  root.position.set(info.x, 0, info.z);
  root.rotation.y = info.rot;
  root.traverse((o) => (o.userData.building = b.id));

  const colliders = lay.walls.map((w) => boxToWorld(info, w)).concat(blockers.map((bl) => boxToWorld(info, bl)));
  const doorW = toWorld(info, lay.door.x, lay.door.z + 2.6);
  const fp = boxToWorld(info, { x: 0, z: 0, w: W, d: D });
  items.push({ type: 'building', x: doorW.x, z: doorW.z, r: 2.6, label: b.name, data: b });
  places.push({ id: `${b.id}:door`, building: b.id, act: 'stroll', label: `outside ${b.name}`, where: b.name, x: doorW.x, z: doorW.z, face: info.rot, inside: false });
  return {
    root,
    colliders,
    places,
    items,
    ticks,
    footprint: fp,
    door: doorW,
    setCutaway(on) {
      const target = on ? 0.3 : 1;
      wallGroup.scale.y += (target - wallGroup.scale.y) * 0.25;
      roof.group.visible = wallGroup.scale.y > 0.8;
      sign.visible = roof.group.visible;
    },
  };
}
function dark() {
  return '#5b3a29';
}

// ---------- outdoor places ----------
const TREE_KINDS = ['tree_default', 'tree_oak', 'tree_fat', 'tree_detailed', 'tree_cone'];
function season() {
  const m = new Date().getUTCMonth() + 1;
  return m >= 9 && m <= 11 ? '_fall' : m === 12 || m <= 2 ? '_dark' : '';
}
function tree(scale = 1, seed = 0.5, color = '#3f8f4f') {
  const kind = TREE_KINDS[Math.floor((seed * 997) % TREE_KINDS.length)];
  const autumnMix = season() === '_fall' && (seed * 13) % 1 < 0.35 ? '' : season();
  const name = kind === 'tree_fat' && autumnMix === '_dark' ? 'tree_fat_darkh' : `${kind}${autumnMix}`;
  const h = (3.2 + seed * 2.2) * scale;
  return model(`nature/${name}`, h * 0.75, h * 0.75, { h });
}
function oldTree(scale = 1, seed = 0.5, color = '#3f8f4f') {
  const g = new THREE.Group();
  const h = (1.8 + seed * 1.2) * scale;
  g.add(part(new THREE.CylinderGeometry(0.18 * scale, 0.28 * scale, h, 8), '#7a4e2d', { y: h / 2, ink: 0.02 }));
  if (seed < 0.55) {
    for (let k = 0; k < 3; k++) {
      const c = part(new THREE.SphereGeometry((1.15 - k * 0.2) * scale, 12, 10), shade(color, k * 0.05), { x: (k - 1) * 0.5 * scale, y: h + 0.4 * scale + (k === 1 ? 0.6 : 0) * scale, z: (k % 2) * 0.3 * scale, ink: 0.04 });
      g.add(c);
    }
  } else {
    for (let k = 0; k < 3; k++) g.add(part(new THREE.ConeGeometry((1.35 - k * 0.32) * scale, 1.5 * scale, 10), shade('#2f7a45', k * 0.04), { y: h - 0.1 * scale + k * 0.85 * scale, ink: 0.035 }));
  }
  return g;
}
export { tree };

function outdoor(b, ctx) {
  const info = plotInfo(b.plot);
  const root = new THREE.Group();
  const level = Math.max(1, Math.min(5, b.level || 1));
  const colliders = [];
  const places = [];
  const items = [];
  const local = [];
  const add = (lx, lz, act, label, face = 0) => {
    const p = toWorld(info, lx, lz);
    places.push({ id: `${b.id}:${act}:${places.length}`, building: b.id, act, label, where: b.name, x: p.x, z: p.z, face: face + info.rot, inside: false });
  };
  let icon = '';
  if (b.kind === 'market') {
    icon = '';
    const w = 6 + level * 0.6;
    for (const [x, z] of [[-w / 2, -1.4], [w / 2, -1.4], [-w / 2, 1.4], [w / 2, 1.4]]) root.add(block(0.22, 3.2, 0.22, '#7a4e2d', x, 1.6, z));
    root.add(block(w, 1, 1.4, '#a1785a', 0, 0.5, 0.5));
    for (let k = 0; k < 8; k++) root.add(block(w / 8 + 0.02, 0.14, 3.6, k % 2 ? '#fff5e6' : b.color || '#e76f51', -w / 2 + (k + 0.5) * (w / 8), 3.3, 0));
    const n = 3 + Math.min(3, level);
    for (let k = 0; k < n; k++) {
      const cx = -w / 2 + 0.7 + k * ((w - 1.4) / Math.max(1, n - 1));
      root.add(block(0.7, 0.22, 0.5, '#c68b59', cx, 1.11, 0.5));
      const kind = k % 3;
      for (let q = 0; q < 6; q++) {
        const px = cx - 0.22 + (q % 3) * 0.22, pz = 0.38 + Math.floor(q / 3) * 0.22;
        if (kind === 0) { const f = part(new THREE.SphereGeometry(0.08, 10, 6), '#9ecae1', { x: px, y: 1.27, z: pz, ink: 0.006 }); f.scale.set(2, 0.6, 0.8); root.add(f); }
        else if (kind === 1) { const br = part(new THREE.CapsuleGeometry(0.06, 0.12, 4, 8), '#d99a4e', { x: px, y: 1.27, z: pz, ink: 0.006 }); br.rotation.z = Math.PI / 2; root.add(br); }
        else root.add(part(new THREE.SphereGeometry(0.08, 10, 8), q % 2 ? '#e63946' : '#80b918', { x: px, y: 1.28, z: pz, ink: 0.006 }));
      }
    }
    local.push({ x: 0, z: 0.5, w: w, d: 1.4 });
    add(0, -1.2, 'sell', 'selling at the market stall', Math.PI);
    items.push({ type: 'shop', ...toWorld(info, 0, 2.2), r: 3, label: "Visit Loki's shop" });
  } else if (b.kind === 'fountain') {
    icon = '';
    const R = 2.4 + level * 0.3;
    root.add(part(new THREE.CylinderGeometry(R + 0.2, R + 0.35, 0.25, 32), '#cfc6b6', { y: 0.12, ink: 0.03 }));
    const rim = part(new THREE.TorusGeometry(R, 0.22, 10, 40), '#ddd5c7', { y: 0.62, ink: 0.03 });
    rim.rotation.x = Math.PI / 2;
    root.add(rim, part(new THREE.CylinderGeometry(R, R, 0.6, 32, 1, true), '#d6cfc2', { y: 0.32, ink: 0 }));
    const water = new THREE.Mesh(new THREE.CircleGeometry(R - 0.05, 40), new THREE.MeshToonMaterial({ color: '#58b9e6', transparent: true, opacity: 0.9 }));
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.55;
    root.add(water);
    for (let k = 0; k < 6; k++) {
      const drop = part(new THREE.SphereGeometry(0.12, 8, 6), '#bfefff', { ink: 0, shadow: false, mat: new THREE.MeshToonMaterial({ color: '#d7f3ff', transparent: true, opacity: 0.85 }) });
      drop.userData.drop = k / 6;
      root.add(drop);
      ctx.drops = (ctx.drops || []).concat([{ obj: drop, top: 2.3 + level * 0.3, r: R * 0.55 }]);
    }
    root.add(part(new THREE.CylinderGeometry(0.3, 0.5, 1.8 + level * 0.3, 12), '#c9c1b3', { y: 0.9 + level * 0.15 }));
    const fish = part(new THREE.SphereGeometry(0.45, 12, 8), '#f28c28', { y: 2.2 + level * 0.3 });
    fish.scale.set(1.5, 0.8, 0.8);
    root.add(fish);
    ctx.jets.push(water);
    local.push({ x: 0, z: 0, w: R * 2, d: R * 2 });
    add(0, R + 1, 'watch', 'watching the fish fountain');
  } else if (b.kind === 'tree') {
    root.add(tree(1.8, 0.3, b.color || '#3f8f4f'));
    local.push({ x: 0, z: 0, w: 1.2, d: 1.2 });
    add(0, 2.2, 'nap', 'napping under the old tree');
  } else {
    // park / garden
    icon = b.kind === 'garden' ? '' : '';
    const S = 18;
    const grass = new THREE.Mesh(new THREE.BoxGeometry(S, 0.12, S), toon(b.color || '#8fd16a'));
    grass.position.y = 0.06;
    grass.receiveShadow = true;
    root.add(grass);
    root.add(block(2, 0.14, S, '#e9d3a8', 0, 0.08, 0, { ink: false }));
    let seed = 0;
    const rnd = () => ((seed = (seed * 9301 + 49297 + b.id.length) % 233280) / 233280);
    for (let k = 0; k < 3 + level * 2; k++) {
      const t = tree(0.8 + rnd() * 0.5, rnd());
      const x = (rnd() < 0.5 ? -1 : 1) * (2.5 + rnd() * 5), z = -S / 2 + 1.5 + rnd() * (S - 3);
      t.position.set(x, 0, z);
      root.add(t);
      local.push({ x, z, w: 0.8, d: 0.8 });
    }
    for (let k = 0; k < 24 + level * 8; k++) {
      const f = flower(['#ef476f', '#ffd166', '#f8f9fa', '#c77dff'][k % 4], 0.3);
      f.position.set((rnd() - 0.5) * (S - 2), 0.12, (rnd() - 0.5) * (S - 2));
      root.add(f);
    }
    const bench = new THREE.Group();
    bench.add(block(2.2, 0.15, 0.7, '#8a5a3b', 0, 0.6, 0), block(2.2, 0.5, 0.12, '#8a5a3b', 0, 0.95, -0.3), block(0.12, 0.6, 0.6, '#4a3b30', -1, 0.3, 0), block(0.12, 0.6, 0.6, '#4a3b30', 1, 0.3, 0));
    bench.position.set(2.2, 0, 1);
    bench.rotation.y = -Math.PI / 2;
    root.add(bench);
    local.push({ x: 2.2, z: 1, w: 0.7, d: 2.2 });
    if (b.kind === 'garden') {
      for (let k = 0; k < 4; k++) root.add(block(3, 0.4, 1.2, '#8d5b3c', -5, 0.2, -6 + k * 3));
      add(-3, -3, 'garden', 'tending the garden beds');
    }
    add(1.2, 1, 'sit', 'sitting on the park bench', -Math.PI / 2);
    add(0, -4, 'stroll', `strolling through ${b.name}`);
  }
  const sign = b.kind === 'market' ? logoSign({ ...DEFAULT_BRANDS.market, ...(b.brand || {}) }, 3.8) : signBoard(b.name, 3.6, { icon: '', color: '#7a4a2a' });
  const sp = new THREE.Group();
  sp.add(sign, block(0.15, 1.6, 0.15, '#6b4226', -1.4, -1.0, -0.05), block(0.15, 1.6, 0.15, '#6b4226', 1.4, -1.0, -0.05));
  sign.position.y = 0;
  sp.position.set(0, 2.2, b.kind === 'park' || b.kind === 'garden' ? 9.3 : 4.2);
  root.add(sp);
  local.push({ x: 0, z: sp.position.z, w: 3.2, d: 0.3 });

  root.position.set(info.x, 0, info.z);
  root.rotation.y = info.rot;
  const door = toWorld(info, 0, b.kind === 'park' || b.kind === 'garden' ? 10.5 : 5.5);
  items.push({ type: 'building', ...door, r: 3, label: b.name, data: b });
  return { root, colliders: colliders.concat(local.map((l) => boxToWorld(info, l))), places, items, ticks: [], footprint: null, door, setCutaway() {} };
}

export function buildBuilding(b, ctx) {
  if (ENTERABLE.includes(b.kind) || (b.rooms && b.rooms.length)) return enterable(b, ctx);
  return outdoor(b, ctx);
}

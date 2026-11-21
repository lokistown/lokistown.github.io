// Builds every kind of building from town data. Enterable buildings get real rooms;
// when the visitor walks in, the roof lifts off and the walls drop to a dollhouse view.
import * as THREE from 'three';
import { toon, block, part, edges, shade, signBoard } from './toon.js';
import { layoutBuilding, roomsOf, ROOM_INFO, ENTERABLE, WALL_H, WALL_T, plotInfo, toWorld, boxToWorld } from './layout.js';
import { buildRoom } from './rooms.js';

export const glass = new THREE.MeshToonMaterial({ color: '#bfe3ff', emissive: '#ffcf6e', emissiveIntensity: 0 });
export const bulbs = new THREE.MeshToonMaterial({ color: '#fff3c4', emissive: '#ffd27a', emissiveIntensity: 0 });

const KIND = {
  house: { wall: '#f2b880', roof: '#b5523b', icon: '🏠' },
  workshop: { wall: '#b98b6e', roof: '#5b4636', icon: '🔨' },
  bakery: { wall: '#f6dcb8', roof: '#d64545', icon: '🥐' },
  cafe: { wall: '#f2c6a0', roof: '#2a9d8f', icon: '☕' },
  gallery: { wall: '#eef0f2', roof: '#3d6e9e', icon: '🖼️' },
  library: { wall: '#b7a6d9', roof: '#4a3f6b', icon: '📚' },
  shop: { wall: '#f6c28b', roof: '#e07a1f', icon: '🛍️' },
  tower: { wall: '#b8a9d9', roof: '#4a3f6b', icon: '🔭' },
  other: { wall: '#d9b99b', roof: '#8a5a3b', icon: '⭐' },
};
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
  const roof = new THREE.Mesh(geo, toon(color));
  roof.castShadow = true;
  roof.receiveShadow = true;
  edges(roof);
  g.add(roof);
  // ridge tiles
  for (let k = -3; k <= 3; k++) {
    const t = part(new THREE.SphereGeometry(0.22, 8, 6), shade(color, -0.1), { x: 0, y: rise, z: (k / 3) * (D / 2), ink: 0.02 });
    g.add(t);
  }
  return { group: g, rise };
}

function windowOn(wallGroup, x, y, z, rotY) {
  const w = new THREE.Group();
  w.add(block(1.25, 1.35, 0.14, '#fff6e5', 0, 0, 0));
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.1), glass);
  pane.position.z = 0.08;
  w.add(pane);
  w.add(block(1.0, 0.06, 0.05, '#fff6e5', 0, 0, 0.1, { ink: false }), block(0.06, 1.1, 0.05, '#fff6e5', 0, 0, 0.1, { ink: false }));
  w.add(block(1.4, 0.12, 0.35, '#fff6e5', 0, -0.72, 0.15));
  // flower box
  w.add(block(1.2, 0.25, 0.3, '#8d5b3c', 0, -0.9, 0.25));
  for (let k = 0; k < 4; k++) w.add(part(new THREE.SphereGeometry(0.1, 8, 6), ['#ef476f', '#ffd166', '#f8f9fa', '#c77dff'][k], { x: -0.45 + k * 0.3, y: -0.7, z: 0.28, ink: 0.01 }));
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
  const wallColor = b.color || style.wall;
  const level = Math.max(1, Math.min(5, b.level || 1));

  // foundation, porch, floor
  root.add(block(W + 0.8, 0.3, D + 0.8, '#b9a48c', 0, 0.15, 0));
  root.add(block(3.2, 0.22, 1.6, '#a58a6f', lay.door.x, 0.11, D / 2 + 1.1));
  lay.cells.forEach((c, i) => {
    const f = new THREE.Mesh(new THREE.BoxGeometry(c.size, 0.06, c.size), toon(FLOOR[i % FLOOR.length]));
    f.position.set(c.cx, 0.33, c.cz);
    f.receiveShadow = true;
    interior.add(f);
  });

  // walls: exterior face painted, inside cream
  const inside = toon('#fbf1df');
  const outside = toon(wallColor);
  const trim = toon(shade(wallColor, -0.12));
  for (const w of lay.walls) {
    const ext = Math.abs(Math.abs(w.z) - D / 2) < 0.01 && w.d < 1 ? (w.z > 0 ? 4 : 5) : Math.abs(Math.abs(w.x) - W / 2) < 0.01 && w.w < 1 ? (w.x > 0 ? 0 : 1) : -1;
    const mats = [inside, inside, trim, inside, inside, inside];
    if (ext >= 0) mats[ext] = outside;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w.w, WALL_H, w.d), mats);
    m.position.set(w.x, 0.33 + WALL_H / 2, w.z);
    m.castShadow = true;
    m.receiveShadow = true;
    edges(m);
    wallGroup.add(m);
  }
  // corner trims + top band
  for (const [x, z] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]]) wallGroup.add(block(0.45, WALL_H + 0.1, 0.45, shade(wallColor, -0.15), x, 0.33 + WALL_H / 2, z));

  // windows on the outside (front, back, sides)
  const wy = 0.33 + 1.9;
  lay.cells.forEach((c) => {
    if (c.r === 0 && c !== lay.cells[0]) windowOn(wallGroup, c.cx, wy, D / 2 + 0.15, 0);
    if (Math.abs(c.cz + D / 2 - c.size / 2) < 0.01) windowOn(wallGroup, c.cx, wy, -D / 2 - 0.15, Math.PI);
    if (Math.abs(c.cx - (-W / 2 + c.size / 2)) < 0.01) windowOn(wallGroup, -W / 2 - 0.15, wy, c.cz, -Math.PI / 2);
    if (Math.abs(c.cx - (W / 2 - c.size / 2)) < 0.01) windowOn(wallGroup, W / 2 + 0.15, wy, c.cz, Math.PI / 2);
  });
  // door frame + open door
  const dx = lay.door.x;
  wallGroup.add(block(2.3, 0.35, 0.4, shade(wallColor, -0.2), dx, 0.33 + 2.55, D / 2));
  const door = block(1.0, 2.3, 0.1, '#6b4226', 0, 1.15, 0);
  door.add(part(new THREE.SphereGeometry(0.06, 8, 6), '#ffd166', { x: 0.35, y: 0, z: 0.08, ink: 0 }));
  const hinge = new THREE.Group();
  hinge.add(door);
  door.position.x = 0.5;
  hinge.position.set(dx - 0.9, 0.33, D / 2 + 0.1);
  hinge.rotation.y = -1.2;
  wallGroup.add(hinge);
  // lantern by the door
  const lantern = part(new THREE.SphereGeometry(0.16, 10, 8), '#fff', { x: dx + 1.3, y: 0.33 + 2.3, z: D / 2 + 0.3, mat: bulbs, ink: 0.015 });
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
  const sign = signBoard(b.name, Math.min(5.5, Math.max(3.4, W * 0.4)), { icon: style.icon, color: '#7a4a2a' });
  sign.position.set(dx, 0.33 + WALL_H + 0.55, D / 2 + 0.45);
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
    const r = buildRoom(room.kind, ctx, c.size / 2 - WALL_T, room);
    r.group.position.set(c.cx, 0.36, c.cz);
    interior.add(r.group);
    const meta = ROOM_INFO[room.kind] || { name: room.kind, icon: '⭐' };
    for (const bl of r.blockers) blockers.push({ x: c.cx + bl.x, z: c.cz + bl.z, w: bl.w, d: bl.d, h: 1.2 });
    for (const s of r.spots) {
      const p = toWorld(info, c.cx + s.x, c.cz + s.z);
      places.push({ id: `${room.id}:${s.act}`, building: b.id, room: room.id, roomKind: room.kind, act: s.act, label: s.label, name: `${room.name || meta.name}`, where: `${b.name} · ${room.name || meta.name}`, x: p.x, z: p.z, face: s.face + info.rot, inside: true, onBed: !!s.inside });
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
  items.push({ type: 'building', x: doorW.x, z: doorW.z, r: 2.6, label: `${style.icon} ${b.name}`, data: b });
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
function tree(scale = 1, seed = 0.5, color = '#3f8f4f') {
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
  let icon = '🌳';
  if (b.kind === 'market') {
    icon = '🧺';
    const w = 6 + level * 0.6;
    for (const [x, z] of [[-w / 2, -1.4], [w / 2, -1.4], [-w / 2, 1.4], [w / 2, 1.4]]) root.add(block(0.22, 3.2, 0.22, '#7a4e2d', x, 1.6, z));
    root.add(block(w, 1, 1.4, '#a1785a', 0, 0.5, 0.5));
    for (let k = 0; k < 8; k++) root.add(block(w / 8 + 0.02, 0.14, 3.6, k % 2 ? '#fff5e6' : b.color || '#e76f51', -w / 2 + (k + 0.5) * (w / 8), 3.3, 0));
    const goods = ['#f28c28', '#4cc9f0', '#ffd166', '#ef476f', '#06d6a0'];
    for (let k = 0; k < 4 + level; k++) root.add(part(new THREE.SphereGeometry(0.22, 10, 8), goods[k % 5], { x: -w / 2 + 0.6 + k * ((w - 1.2) / (3 + level)), y: 1.2, z: 0.5, ink: 0.015 }));
    local.push({ x: 0, z: 0.5, w: w, d: 1.4 });
    add(0, -1.2, 'sell', 'selling at the market stall', Math.PI);
    items.push({ type: 'shop', ...toWorld(info, 0, 2.2), r: 3, label: "Visit Loki's shop" });
  } else if (b.kind === 'fountain') {
    icon = '⛲';
    const R = 2.4 + level * 0.3;
    root.add(part(new THREE.CylinderGeometry(R, R + 0.25, 0.8, 24), '#d6cfc2', { y: 0.4, ink: 0.04 }));
    const water = new THREE.Mesh(new THREE.CylinderGeometry(R - 0.3, R - 0.3, 0.1, 24), new THREE.MeshToonMaterial({ color: b.color || '#7fd3f2' }));
    water.position.y = 0.75;
    root.add(water);
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
    icon = b.kind === 'garden' ? '🌷' : '🌳';
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
    for (let k = 0; k < 30 + level * 10; k++) root.add(part(new THREE.SphereGeometry(0.1, 6, 4), ['#ef476f', '#ffd166', '#f8f9fa', '#c77dff'][k % 4], { x: (rnd() - 0.5) * (S - 1), y: 0.2, z: (rnd() - 0.5) * (S - 1), ink: 0 }));
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
  const sign = signBoard(b.name, 3.6, { icon, color: '#7a4a2a' });
  const sp = new THREE.Group();
  sp.add(sign, block(0.15, 1.6, 0.15, '#6b4226', -1.4, -1.0, -0.05), block(0.15, 1.6, 0.15, '#6b4226', 1.4, -1.0, -0.05));
  sign.position.y = 0;
  sp.position.set(0, 2.2, b.kind === 'park' || b.kind === 'garden' ? 9.3 : 4.2);
  root.add(sp);
  local.push({ x: 0, z: sp.position.z, w: 3.2, d: 0.3 });

  root.position.set(info.x, 0, info.z);
  root.rotation.y = info.rot;
  const door = toWorld(info, 0, b.kind === 'park' || b.kind === 'garden' ? 10.5 : 5.5);
  items.push({ type: 'building', ...door, r: 3, label: `${icon} ${b.name}`, data: b });
  return { root, colliders: colliders.concat(local.map((l) => boxToWorld(info, l))), places, items, ticks: [], footprint: null, door, setCutaway() {} };
}

export function buildBuilding(b, ctx) {
  if (ENTERABLE.includes(b.kind) || (b.rooms && b.rooms.length)) return enterable(b, ctx);
  return outdoor(b, ctx);
}

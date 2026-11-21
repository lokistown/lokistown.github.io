// Town & building layout. Pure data: positions, rooms, walls, doorways.
// The same layout drives rendering, collisions and Loki's pathfinding.

export const PLOT = 32; // one town block
export const ROAD = 3.6;
export const WALL_H = 3.4;
export const WALL_T = 0.28;
export const DOOR_W = 1.6;
export const FLOOR_Y = 0.36; // top of building floors

// ---------- plots: the town grows ring by ring around the plaza, without a fixed limit ----------
const RINGS = 24;
let order = null;
function buildOrder() {
  const cells = [];
  for (let i = -RINGS; i <= RINGS; i++)
    for (let j = -RINGS; j <= RINGS; j++) {
      if (i === 0 && j === 0) continue;
      cells.push({ i, j, ring: Math.max(Math.abs(i), Math.abs(j)), ang: (Math.atan2(j, i) + Math.PI * 2.25) % (Math.PI * 2) });
    }
  cells.sort((a, b) => a.ring - b.ring || a.ang - b.ang);
  return cells;
}
export function plotCell(index) {
  order ||= buildOrder();
  return order[Math.min(index, order.length - 1)];
}
export function cellIndex(i, j) {
  order ||= buildOrder();
  return order.findIndex((c) => c.i === i && c.j === j);
}

export function plotInfo(index) {
  const { i, j, ring } = plotCell(index);
  let dx = 0, dz = 0;
  if (Math.abs(i) >= Math.abs(j)) dx = -Math.sign(i);
  else dz = -Math.sign(j);
  return { x: i * PLOT, z: j * PLOT, dx, dz, rot: Math.atan2(dx, dz), ring, i, j };
}

// Buildings may name an exact grid cell ({cell: {i, j}}) or just take the next free plot.
export function ensurePlots(town) {
  for (const b of town.buildings) if (b.cell && Number.isInteger(b.cell.i)) b.plot = cellIndex(b.cell.i, b.cell.j);
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

export function toWorld(info, lx, lz) {
  const c = Math.cos(info.rot), s = Math.sin(info.rot);
  return { x: info.x + lx * c + lz * s, z: info.z - lx * s + lz * c };
}
export function boxToWorld(info, b) {
  const p = toWorld(info, b.x, b.z);
  const swap = Math.abs(Math.sin(info.rot)) > 0.5;
  return { x: p.x, z: p.z, hw: (swap ? b.d : b.w) / 2, hd: (swap ? b.w : b.d) / 2, h: b.h ?? WALL_H };
}

// ---------- rooms ----------
export const ROOM_INFO = {
  hall: { name: 'Hallway', icon: '' },
  living: { name: 'Living room', icon: '' },
  kitchen: { name: 'Kitchen', icon: '' },
  bedroom: { name: 'Bedroom', icon: '' },
  laundry: { name: 'Laundry room', icon: '' },
  music: { name: 'Music room', icon: '' },
  studio: { name: 'Art studio', icon: '' },
  control: { name: 'Control room', icon: '' },
  workshop: { name: 'Workshop', icon: '' },
  storage: { name: 'Storeroom', icon: '' },
  bakery: { name: 'Bakery', icon: '' },
  cafe: { name: 'Café', icon: '' },
  gallery: { name: 'Gallery', icon: '' },
  library: { name: 'Library', icon: '' },
  shop: { name: 'Shop', icon: '' },
  garden_room: { name: 'Greenhouse', icon: '' },
  bathroom: { name: 'Bathroom', icon: '' },
  arcade: { name: 'Arcade', icon: '' },
};

export const ENTERABLE = ['house', 'workshop', 'bakery', 'cafe', 'gallery', 'library', 'shop', 'tower', 'arcade', 'other'];
export const DEFAULT_ROOMS = {
  house: ['hall', 'living', 'kitchen', 'studio', 'music', 'bedroom', 'laundry', 'control'],
  workshop: ['workshop', 'storage'],
  bakery: ['bakery', 'cafe'],
  cafe: ['cafe'],
  gallery: ['gallery', 'gallery'],
  library: ['library', 'library'],
  shop: ['shop'],
  tower: ['library'],
  arcade: ['arcade', 'cafe'],
  other: ['living'],
};

export function roomsOf(b) {
  if (Array.isArray(b.rooms) && b.rooms.length) return b.rooms.map((r, i) => (typeof r === 'string' ? { id: `${b.id}-${i}`, kind: r } : { id: r.id || `${b.id}-${i}`, ...r }));
  return (DEFAULT_ROOMS[b.kind] || DEFAULT_ROOMS.other).map((kind, i) => ({ id: `${b.id}-${i}`, kind }));
}

// Rooms sit on a grid; every shared wall has a doorway in its middle (kept clear of furniture).
export function layoutBuilding(b) {
  const rooms = roomsOf(b).slice(0, 12);
  const n = rooms.length;
  const cols = n <= 2 ? n : n <= 6 ? Math.ceil(n / 2) : 4;
  const rows = Math.ceil(n / cols);
  const cell = n <= 2 ? 8.4 : 6.4;
  const W = cols * cell, D = rows * cell;
  const front = [...Array(cols).keys()].sort((a, c) => Math.abs(a - (cols - 1) / 2) - Math.abs(c - (cols - 1) / 2));
  const slots = [];
  for (let r = 0; r < rows; r++) for (const c of r === 0 ? front : [...Array(cols).keys()]) slots.push({ r, c });
  const cells = rooms.map((room, k) => {
    const { r, c } = slots[k];
    return { room, r, c, cx: -W / 2 + (c + 0.5) * cell, cz: D / 2 - (r + 0.5) * cell, size: cell, doors: { n: false, s: false, e: false, w: false } };
  });
  const entrance = cells[0];
  entrance.doors.s = true; // s = front (+z)
  const walls = [];
  const frames = []; // doorway frames: {x, z, along: 'x'|'z', exterior}
  const H = WALL_H, T = WALL_T;
  const seg = (x1, z1, x2, z2, gaps) => {
    const horizontal = z1 === z2;
    const a = horizontal ? Math.min(x1, x2) : Math.min(z1, z2);
    const end = horizontal ? Math.max(x1, x2) : Math.max(z1, z2);
    let cur = a;
    const cuts = gaps.map((g) => [g.at - g.w / 2, g.at + g.w / 2]).sort((p, q) => p[0] - q[0]);
    for (const [g0, g1] of [...cuts, [end, end]]) {
      if (g0 - cur > 0.05) {
        const mid = (cur + g0) / 2, len = g0 - cur;
        walls.push(horizontal ? { x: mid, z: z1, w: len + T, d: T, h: H } : { x: x1, z: mid, w: T, d: len + T, h: H });
      }
      cur = g1;
    }
    for (const g of gaps) frames.push(horizontal ? { x: g.at, z: z1, along: 'x', exterior: !!g.exterior } : { x: x1, z: g.at, along: 'z', exterior: !!g.exterior });
  };
  seg(-W / 2, D / 2, W / 2, D / 2, [{ at: entrance.cx, w: DOOR_W, exterior: true }]);
  seg(-W / 2, -D / 2, W / 2, -D / 2, []);
  seg(-W / 2, -D / 2, -W / 2, D / 2, []);
  seg(W / 2, -D / 2, W / 2, D / 2, []);
  const at = (r, c) => cells.find((x) => x.r === r && x.c === c);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols - 1; c++) {
      const a = at(r, c), bb = at(r, c + 1);
      const x = -W / 2 + (c + 1) * cell;
      const z0 = D / 2 - r * cell, z1 = z0 - cell;
      const open = a && bb;
      if (open) (a.doors.e = true), (bb.doors.w = true);
      seg(x, z1, x, z0, open ? [{ at: (z0 + z1) / 2, w: DOOR_W }] : []);
    }
  for (let r = 0; r < rows - 1; r++)
    for (let c = 0; c < cols; c++) {
      const a = at(r, c), bb = at(r + 1, c);
      const z = D / 2 - (r + 1) * cell;
      const x0 = -W / 2 + c * cell, x1 = x0 + cell;
      const open = a && bb;
      if (open) (a.doors.n = true), (bb.doors.s = true);
      seg(x0, z, x1, z, open ? [{ at: (x0 + x1) / 2, w: DOOR_W }] : []);
    }
  return { W, D, cell, cells, walls, frames, door: { x: entrance.cx, z: D / 2 }, front: D / 2 + 2.4 };
}

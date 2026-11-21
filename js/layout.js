// Town & building layout. Pure data: positions, rooms, walls. No drawing here,
// so the same layout drives rendering, collisions and Loki's pathfinding.

export const PLOT = 28; // one town block
export const ROAD = 3.6;
export const WALL_H = 3.4;
export const WALL_T = 0.28;
export const DOOR_W = 1.8;

// ---------- plots: the town grows ring by ring around the plaza ----------
let order = null;
export function plotCell(index) {
  if (!order) {
    const cells = [];
    for (let i = -6; i <= 6; i++)
      for (let j = -6; j <= 6; j++) {
        if (i === 0 && j === 0) continue;
        cells.push({ i, j, ring: Math.max(Math.abs(i), Math.abs(j)), ang: (Math.atan2(j, i) + Math.PI * 2.25) % (Math.PI * 2) });
      }
    cells.sort((a, b) => a.ring - b.ring || a.ang - b.ang);
    order = cells;
  }
  return order[index % order.length];
}

export function plotInfo(index) {
  const { i, j, ring } = plotCell(index);
  let dx = 0, dz = 0;
  if (Math.abs(i) >= Math.abs(j)) dx = -Math.sign(i);
  else dz = -Math.sign(j);
  return { x: i * PLOT, z: j * PLOT, dx, dz, rot: Math.atan2(dx, dz), ring };
}

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

// local (building space, +z = front door side) -> world
export function toWorld(info, lx, lz) {
  const c = Math.cos(info.rot), s = Math.sin(info.rot);
  return { x: info.x + lx * c + lz * s, z: info.z - lx * s + lz * c };
}
// local axis-aligned box -> world axis-aligned box (rotations are multiples of 90 degrees)
export function boxToWorld(info, b) {
  const p = toWorld(info, b.x, b.z);
  const swap = Math.abs(Math.sin(info.rot)) > 0.5;
  return { x: p.x, z: p.z, hw: (swap ? b.d : b.w) / 2, hd: (swap ? b.w : b.d) / 2, h: b.h ?? WALL_H };
}

// ---------- rooms ----------
export const ROOM_INFO = {
  hall: { name: 'Hallway', icon: '🚪' },
  living: { name: 'Living room', icon: '🛋️' },
  kitchen: { name: 'Kitchen', icon: '🍳' },
  bedroom: { name: 'Bedroom', icon: '🛏️' },
  laundry: { name: 'Laundry room', icon: '🧺' },
  music: { name: 'Music room', icon: '🎹' },
  studio: { name: 'Art studio', icon: '🎨' },
  control: { name: 'Control room', icon: '🖥️' },
  workshop: { name: 'Workshop', icon: '🔨' },
  storage: { name: 'Storeroom', icon: '📦' },
  bakery: { name: 'Bakery', icon: '🥐' },
  cafe: { name: 'Café', icon: '☕' },
  gallery: { name: 'Gallery', icon: '🖼️' },
  library: { name: 'Library', icon: '📚' },
  shop: { name: 'Shop', icon: '🛍️' },
  garden_room: { name: 'Greenhouse', icon: '🪴' },
};

export const ENTERABLE = ['house', 'workshop', 'bakery', 'cafe', 'gallery', 'library', 'shop', 'tower', 'other'];

export const DEFAULT_ROOMS = {
  house: ['hall', 'living', 'kitchen', 'studio', 'music', 'bedroom', 'laundry', 'control'],
  workshop: ['workshop', 'storage'],
  bakery: ['bakery', 'cafe'],
  cafe: ['cafe'],
  gallery: ['gallery', 'gallery'],
  library: ['library', 'library'],
  shop: ['shop'],
  tower: ['library'],
  other: ['living'],
};

export function roomsOf(b) {
  if (Array.isArray(b.rooms) && b.rooms.length) return b.rooms.map((r, i) => (typeof r === 'string' ? { id: `${b.id}-${i}`, kind: r } : { id: r.id || `${b.id}-${i}`, ...r }));
  return (DEFAULT_ROOMS[b.kind] || DEFAULT_ROOMS.other).map((kind, i) => ({ id: `${b.id}-${i}`, kind }));
}

// Lay rooms out on a grid. Front row first; the entrance is in the middle of the front row.
export function layoutBuilding(b) {
  const rooms = roomsOf(b).slice(0, 12);
  const n = rooms.length;
  const cols = n <= 2 ? n : n <= 6 ? Math.ceil(n / 2) : 4;
  const rows = Math.ceil(n / cols);
  const cell = n <= 2 ? 8 : 5.6;
  const W = cols * cell, D = rows * cell;
  const cells = [];
  // order cells so the entrance (front-middle) gets the first room (hall)
  const front = [];
  for (let c = 0; c < cols; c++) front.push(c);
  front.sort((a, b2) => Math.abs(a - (cols - 1) / 2) - Math.abs(b2 - (cols - 1) / 2));
  const slots = [];
  for (let r = 0; r < rows; r++) for (const c of r === 0 ? front : [...Array(cols).keys()]) slots.push({ r, c });
  rooms.forEach((room, k) => {
    const { r, c } = slots[k];
    cells.push({ room, r, c, cx: -W / 2 + (c + 0.5) * cell, cz: D / 2 - (r + 0.5) * cell, size: cell });
  });
  const entrance = cells[0];
  const walls = [];
  const H = WALL_H, T = WALL_T;
  const seg = (x1, z1, x2, z2, gaps) => {
    // wall along x (z const) or along z (x const), with door gaps [{at, w}]
    const horizontal = z1 === z2;
    const a = horizontal ? Math.min(x1, x2) : Math.min(z1, z2);
    const bEnd = horizontal ? Math.max(x1, x2) : Math.max(z1, z2);
    let cur = a;
    const cuts = gaps.map((g) => [g.at - g.w / 2, g.at + g.w / 2]).sort((p, q) => p[0] - q[0]);
    for (const [g0, g1] of [...cuts, [bEnd, bEnd]]) {
      if (g0 - cur > 0.05) {
        const mid = (cur + g0) / 2, len = g0 - cur;
        walls.push(horizontal ? { x: mid, z: z1, w: len + T, d: T, h: H } : { x: x1, z: mid, w: T, d: len + T, h: H });
      }
      cur = g1;
    }
  };
  // exterior
  seg(-W / 2, D / 2, W / 2, D / 2, [{ at: entrance.cx, w: DOOR_W }]);
  seg(-W / 2, -D / 2, W / 2, -D / 2, []);
  seg(-W / 2, -D / 2, -W / 2, D / 2, []);
  seg(W / 2, -D / 2, W / 2, D / 2, []);
  // interior walls with doorways between neighbouring cells
  const at = (r, c) => cells.find((x) => x.r === r && x.c === c);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols - 1; c++) {
      const a = at(r, c), bb = at(r, c + 1);
      const x = -W / 2 + (c + 1) * cell;
      const z0 = D / 2 - r * cell, z1 = z0 - cell;
      seg(x, z1, x, z0, a && bb ? [{ at: (z0 + z1) / 2, w: DOOR_W - 0.2 }] : []);
    }
  for (let r = 0; r < rows - 1; r++)
    for (let c = 0; c < cols; c++) {
      const a = at(r, c), bb = at(r + 1, c);
      const z = D / 2 - (r + 1) * cell;
      const x0 = -W / 2 + c * cell, x1 = x0 + cell;
      seg(x0, z, x1, z, a && bb ? [{ at: (x0 + x1) / 2, w: DOOR_W - 0.2 }] : []);
    }
  return { W, D, cell, cells, walls, door: { x: entrance.cx, z: D / 2 }, front: D / 2 + 2.4 };
}

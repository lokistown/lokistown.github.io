// Walkability grid + A* pathfinding so Loki walks around walls, through doorways.
export class NavGrid {
  constructor(half, cell = 0.5) {
    this.half = half;
    this.cell = cell;
    this.n = Math.ceil((half * 2) / cell);
    this.blocked = new Uint8Array(this.n * this.n);
  }
  idx(x, z) {
    const i = Math.floor((x + this.half) / this.cell), j = Math.floor((z + this.half) / this.cell);
    if (i < 0 || j < 0 || i >= this.n || j >= this.n) return -1;
    return j * this.n + i;
  }
  center(k) {
    const i = k % this.n, j = Math.floor(k / this.n);
    return { x: -this.half + (i + 0.5) * this.cell, z: -this.half + (j + 0.5) * this.cell };
  }
  addBox(b, pad = 0.45) {
    const c = this.cell;
    for (let x = b.x - b.hw - pad; x <= b.x + b.hw + pad; x += c / 2)
      for (let z = b.z - b.hd - pad; z <= b.z + b.hd + pad; z += c / 2) {
        const k = this.idx(x, z);
        if (k >= 0) this.blocked[k] = 1;
      }
  }
  free(x, z) {
    const k = this.idx(x, z);
    return k >= 0 && !this.blocked[k];
  }
  nearestFree(x, z) {
    if (this.free(x, z)) return { x, z };
    for (let r = 1; r < 12; r++)
      for (let a = 0; a < 16; a++) {
        const px = x + Math.cos((a / 16) * Math.PI * 2) * r * this.cell, pz = z + Math.sin((a / 16) * Math.PI * 2) * r * this.cell;
        if (this.free(px, pz)) return { x: px, z: pz };
      }
    return { x, z };
  }
  lineFree(a, b) {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const steps = Math.ceil(d / (this.cell * 0.5));
    for (let s = 1; s < steps; s++) {
      const t = s / steps;
      if (!this.free(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
    }
    return true;
  }
  path(from, to) {
    const s = this.nearestFree(from.x, from.z), g = this.nearestFree(to.x, to.z);
    const start = this.idx(s.x, s.z), goal = this.idx(g.x, g.z);
    if (start < 0 || goal < 0) return null;
    const n = this.n;
    const gs = new Float32Array(n * n).fill(Infinity);
    const came = new Int32Array(n * n).fill(-1);
    const closed = new Uint8Array(n * n);
    const heap = [];
    const push = (k, f) => {
      heap.push([f, k]);
      let i = heap.length - 1;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    const gx = goal % n, gz = Math.floor(goal / n);
    const h = (k) => {
      const dx = Math.abs((k % n) - gx), dz = Math.abs(Math.floor(k / n) - gz);
      return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
    };
    gs[start] = 0;
    push(start, h(start));
    let found = false, iter = 0;
    const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    while (heap.length && iter++ < 200000) {
      const [, k] = pop();
      if (closed[k]) continue;
      if (k === goal) {
        found = true;
        break;
      }
      closed[k] = 1;
      const x = k % n, z = Math.floor(k / n);
      for (const [dx, dz, cost] of DIRS) {
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= n || nz >= n) continue;
        const nk = nz * n + nx;
        if (this.blocked[nk] || closed[nk]) continue;
        if (dx && dz && (this.blocked[z * n + nx] || this.blocked[nz * n + x])) continue; // no corner cutting
        const ng = gs[k] + cost;
        if (ng < gs[nk]) {
          gs[nk] = ng;
          came[nk] = k;
          push(nk, ng + h(nk));
        }
      }
    }
    if (!found) return null;
    const cells = [];
    for (let k = goal; k !== -1 && k !== start; k = came[k]) cells.push(this.center(k));
    cells.reverse();
    // string-pull: keep only the corners we need
    const out = [];
    let anchor = s;
    for (let i = 0; i < cells.length; i++) {
      const next = cells[i + 1];
      if (!next || !this.lineFree(anchor, next)) {
        out.push(cells[i]);
        anchor = cells[i];
      }
    }
    out.push({ x: to.x, z: to.z });
    return out;
  }
}

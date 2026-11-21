// Loki's life in the town: where he should be right now, how he gets there, what he's doing.
// Uses the schedule his brain writes each session; between sessions a deterministic routine
// (same for every visitor) keeps him roaming his town.
import * as THREE from 'three';

export function ukNow(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', year: 'numeric', month: '2-digit', day: '2-digit', hourCycle: 'h23' }).formatToParts(d).map((x) => [x.type, x.value]));
  return { h: Number(p.hour) + Number(p.minute) / 60, hour: Number(p.hour), label: `${p.hour}:${p.minute}`, date: `${p.year}-${p.month}-${p.day}` };
}
function hash(s) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}

// What Loki likes to do at different times of day (fallback routine).
const ROUTINE = [
  { from: 7, to: 9, acts: { eat: 4, cook: 2, stretch: 2, greet: 1, mail: 2, laundry: 1 } },
  { from: 9, to: 12, acts: { paint: 4, build: 3, work: 3, piano: 2, sing: 2, read: 2, print: 1, write: 2, admire: 1 } },
  { from: 12, to: 14, acts: { eat: 3, coffee: 2, sit: 2, stroll: 3, sell: 1, bake: 1 } },
  { from: 14, to: 18, acts: { paint: 3, sing: 3, piano: 2, build: 2, garden: 2, stroll: 2, sell: 2, laundry: 2, watch: 1, work: 2, admire: 1, tidy: 1 } },
  { from: 18, to: 23, acts: { eat: 2, relax: 4, radio: 2, piano: 2, read: 2, sit: 1, write: 1, mail: 1 } },
];

export class LokiLife {
  constructor(loki, pip) {
    this.loki = loki;
    this.pip = pip;
    this.places = [];
    this.nav = null;
    this.state = null;
    this.path = [];
    this.current = null;
    this.placed = false;
    this.nextCheck = 0;
    this.act = 'idle';
    this.moving = false;
    loki.head.add(pip.root);
    pip.root.position.set(0.02, 0.34, -0.06);
    pip.root.scale.setScalar(0.85);
  }
  setWorld(places, nav) {
    this.places = places;
    this.nav = nav;
    this.current = null; // re-resolve
  }
  setState(s) {
    this.state = s;
    this.nextCheck = 0;
  }

  resolve(spec) {
    if (!spec) return null;
    const P = this.places;
    const by = (f) => P.filter(f);
    let c = [];
    if (spec.placeId) c = by((p) => p.id === spec.placeId);
    if (!c.length && spec.building && spec.roomKind) c = by((p) => p.building === spec.building && p.roomKind === spec.roomKind && (!spec.act || p.act === spec.act));
    if (!c.length && spec.roomKind) c = by((p) => p.roomKind === spec.roomKind && (!spec.act || p.act === spec.act));
    if (!c.length && spec.roomKind) c = by((p) => p.roomKind === spec.roomKind);
    if (!c.length && spec.act) c = by((p) => p.act === spec.act);
    if (!c.length && spec.building) c = by((p) => p.building === spec.building);
    return c[0] || null;
  }

  sleeping(now) {
    return (this.state && this.state.asleep) || now.h >= 23 || now.h < 7;
  }

  // Decide the place for "now" — identical for every visitor at the same moment.
  plan(now) {
    const s = this.state;
    if (this.sleeping(now)) {
      const bed = this.resolve({ roomKind: 'bedroom', act: 'sleep' }) || this.resolve({ building: 'house' });
      return bed ? { place: bed, act: 'sleep', label: 'asleep in his bed', thought: 'Zzz…' } : null;
    }
    const t = Date.now();
    if (s && Array.isArray(s.schedule)) {
      const e = s.schedule.find((x) => new Date(x.start).getTime() <= t && t < new Date(x.end).getTime());
      if (e) {
        const place = this.resolve(e);
        if (place) return { place, act: e.act || place.act, label: e.label || place.label, thought: e.thought || s.thought };
      }
    }
    // routine: a new choice every 12 minutes
    const slot = Math.floor(t / (12 * 60000));
    const r = ROUTINE.find((x) => now.h >= x.from && now.h < x.to) || ROUTINE[3];
    const options = [];
    for (const p of this.places) {
      const w = r.acts[p.act];
      if (w) options.push([p, w]);
    }
    if (!options.length) return this.places[0] ? { place: this.places[0], act: this.places[0].act, label: this.places[0].label, thought: s?.thought } : null;
    let total = options.reduce((a, [, w]) => a + w, 0);
    let pick = hash(`${now.date}:${slot}`) * total;
    for (const [p, w] of options) {
      pick -= w;
      if (pick <= 0) return { place: p, act: p.act, label: p.label, thought: s?.thought };
    }
    const p = options[0][0];
    return { place: p, act: p.act, label: p.label, thought: s?.thought };
  }

  update(dt, t, visitorPos) {
    const root = this.loki.root;
    if (t > this.nextCheck && this.places.length && this.nav) {
      this.nextCheck = t + 3;
      const now = ukNow();
      const want = this.plan(now);
      if (want && (!this.current || want.place.id !== this.current.place.id)) {
        this.current = want;
        if (!this.placed) {
          root.position.set(want.place.x, 0, want.place.z);
          this.path = [];
          this.placed = true;
        } else {
          this.path = this.nav.path({ x: root.position.x, z: root.position.z }, { x: want.place.x, z: want.place.z });
        }
      } else if (want) this.current.label = want.label, (this.current.thought = want.thought);
    }
    const cur = this.current;
    this.moving = false;
    if (this.path.length) {
      const wp = this.path[0];
      const dx = wp.x - root.position.x, dz = wp.z - root.position.z;
      const d = Math.hypot(dx, dz);
      const remaining = this.path.length;
      const speed = remaining > 12 ? 4.2 : 2.3;
      if (d < 0.12) this.path.shift();
      else {
        const step = Math.min(d, speed * dt);
        root.position.x += (dx / d) * step;
        root.position.z += (dz / d) * step;
        let diff = Math.atan2(dx, dz) - root.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        root.rotation.y += diff * Math.min(1, dt * 8);
        this.moving = true;
      }
    } else if (cur) {
      // settle into the spot, face the right way (or the visitor if they come close)
      let face = cur.place.face;
      if (visitorPos && cur.act !== 'sleep') {
        const vx = visitorPos.x - root.position.x, vz = visitorPos.z - root.position.z;
        if (Math.hypot(vx, vz) < 3.2 && !['paint', 'piano', 'build', 'work'].includes(cur.act)) face = Math.atan2(vx, vz);
      }
      let diff = face - root.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      root.rotation.y += diff * Math.min(1, dt * 4);
    }
    const act = this.moving ? 'walk' : cur ? cur.act : 'idle';
    this.act = act;
    root.position.y = !this.moving && cur && cur.place.onBed ? 0.62 : 0;
    this.loki.animate(dt, act, this.moving);
    this.pip.animate(dt, act === 'sleep');
  }

  info() {
    if (!this.current) return null;
    return { where: this.current.place.where, label: this.moving ? `on his way to ${this.current.place.where}` : this.current.label, act: this.act, thought: this.current.thought, building: this.current.place.building };
  }
}

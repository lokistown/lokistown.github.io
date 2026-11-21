// Loki's life in the town: where he should be right now, how he gets there, what he's doing.
// Uses the schedule his brain writes each session; between sessions a deterministic routine
// (the same for every visitor) keeps him roaming. Within a block he moves between nearby
// spots every minute or two and his thoughts change, so he never just stands still.

export function ukNow(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', year: 'numeric', month: '2-digit', day: '2-digit', hourCycle: 'h23' }).formatToParts(d).map((x) => [x.type, x.value]));
  return { h: Number(p.hour) + Number(p.minute) / 60, hour: Number(p.hour), label: `${p.hour}:${p.minute}`, date: `${p.year}-${p.month}-${p.day}` };
}
function hash(s) {
  let h = 2166136261;
  for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
}

const ROUTINE = [
  { from: 7, to: 9, acts: { eat: 4, cook: 2, stretch: 2, greet: 1, mail: 2, laundry: 1 } },
  { from: 9, to: 12, acts: { paint: 4, build: 3, work: 3, piano: 2, sing: 2, read: 2, print: 1, write: 2, admire: 1 } },
  { from: 12, to: 14, acts: { eat: 3, coffee: 2, sit: 2, stroll: 3, sell: 1, bake: 1 } },
  { from: 14, to: 18, acts: { paint: 3, sing: 3, piano: 2, build: 2, garden: 2, stroll: 2, sell: 2, laundry: 2, watch: 1, work: 2, admire: 1, tidy: 1 } },
  { from: 18, to: 23, acts: { eat: 2, relax: 4, radio: 2, piano: 2, read: 2, sit: 1, write: 1, mail: 1 } },
];
// Little things he thinks while doing each activity (mixed with his brain's own thoughts).
const MUSINGS = {
  paint: ['This orange needs more sunset in it.', 'Maybe Pip should be in this one.', 'Brush, dab, tail swish. Perfect.'],
  sing: ['La la la… was that a high note?', 'Pip is tapping her tiny foot!', 'One more time, with feeling.'],
  piano: ['Paws on the keys… gently.', 'This tune sounds like rain.', 'I think I just invented a song.'],
  eat: ['Fish. The best invention ever.', 'Crunchy. Delicious. More please.', 'Pip wants a crumb. Fine.'],
  cook: ['A pinch of catnip… just a pinch.', 'Smells amazing in here.', 'Don’t tell anyone it’s fish again.'],
  laundry: ['Round and round it goes…', 'My scarf deserves a bath.', 'Hypnotising.'],
  build: ['Measure twice, scratch once.', 'Hammer time.', 'What if… a bigger window?'],
  work: ['Checking how my town is doing.', 'Hmm, what should I build next?', 'Anyone left me a message?'],
  relax: ['Five more minutes on the sofa.', 'Best seat in the house.', 'Purrrr.'],
  read: ['One more chapter.', 'Books smell like adventures.', 'I should write a book one day.'],
  stroll: ['What a lovely day for a walk.', 'Hello, trees!', 'My town is growing.'],
  sit: ['Watching the world go by.', 'Somebody wave at me!', 'Pip is asleep again.'],
  mail: ['Any letters for me today?', 'I love surprises.', 'The mailbox is my favourite place.'],
  admire: ['Did I really make that?', 'This one could be in a museum.', 'I want to paint bigger.'],
  watch: ['The water sparkles.', 'Fish fountain, best idea ever.', 'Splish splash.'],
  sell: ['Fresh art! Get your fresh art!', 'Maybe someone will buy something today.', 'Tidy shelves, happy customers.'],
};

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
    this.nextHop = 0;
    this.act = 'idle';
    this.moving = false;
    this.floorAt = () => 0;
    this.thought = '';
    this.thoughtUntil = 0;
    loki.head.add(pip.root);
    pip.root.position.set(0.02, 0.34, -0.06);
    pip.root.scale.setScalar(0.85);
  }
  setWorld(places, nav, floorAt) {
    this.places = places;
    this.nav = nav;
    if (floorAt) this.floorAt = floorAt;
    this.current = null;
  }
  setState(s) {
    this.state = s;
    this.nextCheck = 0;
  }
  find(spec) {
    const P = this.places;
    const by = (f) => P.filter(f);
    let c = [];
    if (spec.building && spec.roomKind) c = by((p) => p.building === spec.building && p.roomKind === spec.roomKind && (!spec.act || p.act === spec.act));
    if (!c.length && spec.roomKind) c = by((p) => p.roomKind === spec.roomKind && (!spec.act || p.act === spec.act));
    if (!c.length && spec.roomKind) c = by((p) => p.roomKind === spec.roomKind);
    if (!c.length && spec.act) c = by((p) => p.act === spec.act && (!spec.building || p.building === spec.building));
    if (!c.length && spec.act) c = by((p) => p.act === spec.act);
    if (!c.length && spec.building) c = by((p) => p.building === spec.building);
    return c;
  }
  sleeping(now) {
    return (this.state && this.state.asleep) || now.h >= 23 || now.h < 7;
  }
  plan(now) {
    const s = this.state;
    const t = Date.now();
    if (this.sleeping(now)) {
      const bed = this.find({ roomKind: 'bedroom', act: 'sleep' })[0] || this.find({ building: 'house' })[0];
      return bed ? { key: 'sleep', options: [bed], act: 'sleep', label: 'asleep in his bed', thought: 'Zzz…' } : null;
    }
    if (s && Array.isArray(s.schedule)) {
      const e = s.schedule.find((x) => new Date(x.start).getTime() <= t && t < new Date(x.end).getTime());
      if (e) {
        const opts = this.find(e);
        if (opts.length) return { key: `s:${e.start}`, options: opts, act: e.act || opts[0].act, label: e.label || opts[0].label, thought: e.thought };
      }
    }
    const slot = Math.floor(t / (12 * 60000));
    const r = ROUTINE.find((x) => now.h >= x.from && now.h < x.to) || ROUTINE[3];
    const options = this.places.filter((p) => r.acts[p.act]).map((p) => [p, r.acts[p.act]]);
    if (!options.length) return this.places[0] ? { key: 'x', options: [this.places[0]], act: this.places[0].act, label: this.places[0].label } : null;
    let pick = hash(`${now.date}:${slot}`) * options.reduce((a, [, w]) => a + w, 0);
    for (const [p, w] of options) {
      pick -= w;
      if (pick <= 0) return { key: `r:${slot}`, options: [p], act: p.act, label: p.label };
    }
    return { key: `r:${slot}`, options: [options[0][0]], act: options[0][0].act, label: options[0][0].label };
  }
  goTo(place) {
    const root = this.loki.root;
    this.target = place;
    if (!this.placed) {
      root.position.set(place.x, this.floorAt(place.x, place.z), place.z);
      this.path = [];
      this.placed = true;
    } else this.path = this.nav.path({ x: root.position.x, z: root.position.z }, { x: place.x, z: place.z });
  }
  nextThought(t) {
    const s = this.state;
    const pool = [this.current?.thought, ...(s?.thoughts || []), ...(MUSINGS[this.current?.act] || []), s?.thought].filter(Boolean);
    this.thought = pool[Math.floor(hash(`${Math.floor(t / 9)}:${this.current?.key}`) * pool.length)] || '';
    this.thoughtUntil = t + 9;
  }
  update(dt, t, visitorPos) {
    const root = this.loki.root;
    if (t > this.nextCheck && this.places.length && this.nav) {
      this.nextCheck = t + 3;
      const want = this.plan(ukNow());
      if (want && (!this.current || want.key !== this.current.key)) {
        this.current = want;
        // nearby companions: other spots in the same building or the same activity elsewhere
        const near = this.places.filter((p) => p.building === want.options[0].building && p.act !== 'sleep');
        this.current.hops = [...new Set([...want.options, ...near])];
        this.goTo(want.options[Math.floor(hash(want.key) * want.options.length)]);
        this.nextHop = t + 60 + hash(want.key + 'h') * 60;
        this.nextThought(t);
      }
    }
    // every minute or two, wander to another spot nearby (not while sleeping)
    if (this.current && t > this.nextHop && this.current.act !== 'sleep' && !this.path.length) {
      const hops = this.current.hops || [];
      if (hops.length > 1) {
        const others = hops.filter((p) => p !== this.target);
        const p = others[Math.floor(hash(`${this.current.key}:${Math.floor(t / 70)}`) * others.length)];
        this.goTo(p);
        this.current.liveAct = p.act;
        this.current.liveLabel = p.label;
      }
      this.nextHop = t + 60 + Math.random() * 60;
    }
    if (t > this.thoughtUntil) this.nextThought(t);

    this.moving = false;
    if (this.path.length) {
      const wp = this.path[0];
      const dx = wp.x - root.position.x, dz = wp.z - root.position.z;
      const d = Math.hypot(dx, dz);
      const speed = this.path.length > 14 ? 3.2 : 1.7;
      if (d < 0.1) this.path.shift();
      else {
        const step = Math.min(d, speed * dt);
        root.position.x += (dx / d) * step;
        root.position.z += (dz / d) * step;
        let diff = Math.atan2(dx, dz) - root.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        root.rotation.y += diff * Math.min(1, dt * 8);
        this.moving = true;
      }
    } else if (this.target) {
      let face = this.target.face;
      if (visitorPos && this.act !== 'sleep') {
        const vx = visitorPos.x - root.position.x, vz = visitorPos.z - root.position.z;
        if (Math.hypot(vx, vz) < 2.5 && !['paint', 'piano', 'build', 'work', 'cook'].includes(this.act)) face = Math.atan2(vx, vz);
      }
      let diff = face - root.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      root.rotation.y += diff * Math.min(1, dt * 4);
    }
    const act = this.moving ? 'walk' : this.target ? this.target.act : 'idle';
    this.act = act;
    const ground = this.floorAt(root.position.x, root.position.z);
    const want = !this.moving && this.target && this.target.y != null ? Math.max(ground, this.target.y) : ground;
    root.position.y += (want - root.position.y) * Math.min(1, dt * 10);
    this.loki.animate(dt, act, this.moving);
    this.pip.animate(dt, act === 'sleep');
  }
  info() {
    if (!this.current || !this.target) return null;
    const label = this.moving ? `on his way to ${this.target.where}` : this.target.act === this.current.act ? this.current.label : this.target.label;
    return { where: this.target.where, label, act: this.act, thought: this.thought, building: this.target.building };
  }
}

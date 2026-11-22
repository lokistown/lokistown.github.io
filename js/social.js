// Other people in Loki's Town, live. One small WebSocket to Loki's Cloudflare worker:
// everyone sees everyone else walking around, can wave hi, or throw something soft
// (a yarn ball, a paper plane, a flower...) just to get attention. Nothing ever hurts.
import * as THREE from 'three';
import { createVisitor } from './characters.js';
import { part } from './toon.js';

export const THROWS = {
  yarn: 'a yarn ball',
  plane: 'a paper plane',
  flower: 'a flower',
  snow: 'a snowball',
  pillow: 'a pillow',
  fish: 'a plush fish',
};
const THROW_NAMES = { yarn: 'Yarn ball', plane: 'Paper plane', flower: 'Flower', snow: 'Snowball', pillow: 'Pillow', fish: 'Plush fish' };

function nameTag(text, color = '#fff8ec') {
  const c = document.createElement('canvas');
  c.width = 384;
  c.height = 72;
  const g = c.getContext('2d');
  g.font = "800 34px 'Nunito', sans-serif";
  const w = Math.min(376, g.measureText(text).width + 34);
  g.fillStyle = color;
  g.strokeStyle = '#2b1a10';
  g.lineWidth = 5;
  g.beginPath();
  g.roundRect((384 - w) / 2, 6, w, 58, 26);
  g.fill();
  g.stroke();
  g.fillStyle = '#2b1a10';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 192, 37);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  sp.scale.set(2.4, 0.45, 1);
  sp.renderOrder = 5;
  return sp;
}

function projectile(kind) {
  const g = new THREE.Group();
  if (kind === 'yarn') {
    g.add(part(new THREE.SphereGeometry(0.2, 14, 10), '#e76f9a', { ink: 0.012 }));
    for (let k = 0; k < 3; k++) {
      const t = part(new THREE.TorusGeometry(0.2, 0.018, 6, 20), '#c74f7c', { ink: 0 });
      t.rotation.set(k * 1.1, k * 0.7, 0);
      g.add(t);
    }
  } else if (kind === 'plane') {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.35, -0.25, 0.02, -0.25, 0, -0.06, -0.2, 0, 0, 0.35, 0, -0.06, -0.2, 0.25, 0.02, -0.25], 3));
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, new THREE.MeshToonMaterial({ color: '#ffffff', side: THREE.DoubleSide })));
  } else if (kind === 'flower') {
    g.add(part(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 6), '#57b368', { y: -0.2, ink: 0 }));
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      g.add(part(new THREE.SphereGeometry(0.07, 8, 6), '#ffb3c6', { x: Math.cos(a) * 0.09, z: Math.sin(a) * 0.09, ink: 0 }));
    }
    g.add(part(new THREE.SphereGeometry(0.06, 8, 6), '#ffd166', { y: 0.02, ink: 0 }));
  } else if (kind === 'snow') {
    g.add(part(new THREE.SphereGeometry(0.18, 12, 10), '#ffffff', { ink: 0.01 }));
  } else if (kind === 'pillow') {
    const p = part(new THREE.SphereGeometry(0.3, 14, 10), '#9ecae1', { ink: 0.012 });
    p.scale.set(1.3, 0.45, 1);
    g.add(p);
  } else {
    const b = part(new THREE.SphereGeometry(0.18, 12, 10), '#f4a261', { ink: 0.012 });
    b.scale.set(1.6, 1, 0.7);
    g.add(b);
    const tail = part(new THREE.ConeGeometry(0.13, 0.2, 8), '#e76f51', { x: -0.33, ink: 0.01 });
    tail.rotation.z = Math.PI / 2;
    g.add(tail);
  }
  return g;
}

let audioCtx = null;
function boing() {
  try {
    audioCtx ||= new AudioContext();
    const o = audioCtx.createOscillator(), v = audioCtx.createGain();
    const t = audioCtx.currentTime;
    o.type = 'sine';
    o.frequency.setValueAtTime(520, t);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.25);
    v.gain.setValueAtTime(0.12, t);
    v.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.connect(v).connect(audioCtx.destination);
    o.start(t);
    o.stop(t + 0.32);
  } catch {}
}

export class Social {
  constructor({ scene, camera, canvas, visitor, controls, getMe, colorIdx, workerUrl, isBusy }) {
    Object.assign(this, { scene, camera, canvas, visitor, controls, getMe, colorIdx, workerUrl, isBusy });
    this.peers = new Map();
    this.flying = [];
    this.bursts = [];
    this.settings = { multiplayer: true, showCount: true, throwing: true };
    this.online = 0;
    this.ws = null;
    this.lastSent = { x: 1e9, z: 1e9, r: 0, mv: 0, y: 0, t: 0 };
    this.retry = 2000;
    this.menuPeer = null;
    this.myEmote = null;
    this.ui();
  }

  // ---------- connection ----------
  async start() {
    if (!this.workerUrl) return;
    try {
      const r = await fetch(`${this.workerUrl}/api/town`, { cache: 'no-store' });
      this.settings = { ...this.settings, ...(await r.json()) };
    } catch {}
    this.applySettings();
    if (this.settings.multiplayer) this.connect();
    else setTimeout(() => this.start(), 5 * 60000);
    document.addEventListener('visibilitychange', () => {
      clearTimeout(this.hideTimer);
      if (document.hidden) this.hideTimer = setTimeout(() => this.disconnect(), 60000);
      else if (!this.ws && this.settings.multiplayer) this.connect();
    });
  }
  connect() {
    if (this.ws) return;
    const ws = new WebSocket(`${this.workerUrl.replace(/^http/, 'ws')}/town/ws`);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 2000;
      this.hello();
    };
    ws.onmessage = (e) => {
      try {
        this.onMsg(JSON.parse(e.data));
      } catch (err) {
        console.warn('town msg', err);
      }
    };
    ws.onclose = (e) => {
      if (this.ws === ws) this.ws = null;
      this.clearPeers();
      if (e.code === 4000) {
        this.settings.multiplayer = false;
        this.applySettings();
        setTimeout(() => this.start(), 5 * 60000);
        return;
      }
      if (!document.hidden) setTimeout(() => this.connect(), (this.retry = Math.min(60000, this.retry * 2)));
    };
  }
  disconnect() {
    const ws = this.ws;
    this.ws = null;
    try {
      ws?.close();
    } catch {}
    this.clearPeers();
  }
  send(m) {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(m));
  }
  pose() {
    const p = this.visitor.root.position;
    return [p.x, p.y, p.z, this.visitor.root.rotation.y, this.controls.moving ? 1 : 0];
  }
  hello() {
    this.send({ t: 'hello', nick: this.getMe().nick, c: this.colorIdx, p: this.pose() });
  }
  rename() {
    this.hello();
    this.renderPeople();
  }

  onMsg(m) {
    if (m.online != null) this.online = m.online;
    if (m.t === 'init') {
      this.you = m.you;
      this.settings = { ...this.settings, ...m.settings };
      this.clearPeers();
      m.peers.forEach((p) => this.addPeer(p));
      this.applySettings();
    } else if (m.t === 'settings') {
      this.settings = { ...this.settings, ...m.settings };
      this.applySettings();
    } else if (m.t === 'join') {
      const known = this.peers.get(m.id);
      if (known) {
        known.nick = m.nick;
        this.setTag(known);
      } else {
        this.addPeer(m);
        if (m.first) this.toast(`${m.nick} just arrived in town`, 'Wave hi', () => this.hi(this.peers.get(m.id)));
      }
    } else if (m.t === 'leave') {
      this.removePeer(m.id);
    } else if (m.t === 'p') {
      const p = this.peers.get(m.id);
      if (p) p.target = m.p;
    } else if (m.t === 'hi') {
      const p = this.peers.get(m.id);
      if (!p) return;
      p.model.wave?.();
      this.emote(p, 'Hi!');
      if (m.to === this.you) {
        boing();
        this.toast(`${p.nick} waves at you`, 'Wave back', () => this.hi(p));
      }
    } else if (m.t === 'throw') {
      const from = this.peers.get(m.id);
      if (!from) return;
      const toMe = m.to === this.you;
      const target = toMe ? { model: this.visitor, me: true } : this.peers.get(m.to);
      if (!target) return;
      this.launch(from.model.root, target, m.k, () => {
        if (toMe) this.toast(`${from.nick} threw ${THROWS[m.k] || 'something soft'} at you!`, this.settings.throwing ? 'Throw one back' : null, () => this.throwAt(from, m.k));
      });
    }
    this.renderCount();
  }

  // ---------- peers ----------
  addPeer({ id, nick, c, p }) {
    if (this.peers.has(id) || id === this.you) return;
    const model = createVisitor(c || 0);
    model.root.position.set(p[0], p[1], p[2]);
    model.root.rotation.y = p[3];
    model.root.traverse((o) => (o.userData.peerId = id));
    this.scene.add(model.root);
    const peer = { id, nick, model, target: p, emote: null };
    this.setTag(peer);
    this.peers.set(id, peer);
    this.renderPeople();
  }
  setTag(peer) {
    if (peer.tag) peer.model.root.remove(peer.tag);
    peer.tag = nameTag(peer.nick);
    peer.tag.position.y = 2.25;
    peer.model.root.add(peer.tag);
    this.renderPeople();
  }
  removePeer(id) {
    const p = this.peers.get(id);
    if (!p) return;
    this.scene.remove(p.model.root);
    this.peers.delete(id);
    if (this.menuPeer?.id === id) this.closeMenu();
    this.renderPeople();
  }
  clearPeers() {
    [...this.peers.keys()].forEach((id) => this.removePeer(id));
    this.online = this.ws ? this.online : 0;
    this.renderCount();
  }
  nearest(pos, r = 2.8) {
    let best = null, bd = r;
    for (const p of this.peers.values()) {
      const d = Math.hypot(p.model.root.position.x - pos.x, p.model.root.position.z - pos.z);
      if (d < bd) {
        bd = d;
        best = p;
      }
    }
    return best;
  }

  // ---------- actions ----------
  hi(peer) {
    if (!this.ws) return;
    this.send({ t: 'hi', to: peer?.id || '' });
    this.visitor.wave?.();
    this.myEmote = this.makeEmote('Hi!', this.visitor.root);
  }
  throwAt(peer, kind = 'yarn') {
    if (!peer || !this.peers.has(peer.id) || !this.settings.throwing) return;
    const now = performance.now();
    if (now - (this.lastThrow || 0) < 1250) return;
    this.lastThrow = now;
    this.send({ t: 'throw', to: peer.id, k: kind });
    this.launch(this.visitor.root, peer, kind);
  }
  launch(fromRoot, target, kind, onHit) {
    const obj = projectile(kind);
    const a = fromRoot.position.clone();
    a.y += 1.3;
    obj.position.copy(a);
    this.scene.add(obj);
    this.flying.push({ obj, a, target, t: 0, dur: 0.85, onHit, kind });
  }
  emote(peer, text) {
    if (peer.emote) peer.model.root.remove(peer.emote.sp);
    peer.emote = this.makeEmote(text, peer.model.root);
  }
  makeEmote(text, root) {
    const sp = nameTag(text, '#ffd166');
    sp.scale.set(1.6, 0.3, 1);
    sp.position.y = 2.75;
    root.add(sp);
    return { sp, root, until: performance.now() + 2500 };
  }
  burst(at) {
    const cols = ['#ffd166', '#ef476f', '#06d6a0', '#118ab2', '#ffffff'];
    for (let k = 0; k < 10; k++) {
      const s = part(new THREE.SphereGeometry(0.06, 6, 4), cols[k % cols.length], { ink: 0, shadow: false });
      s.position.copy(at);
      const v = new THREE.Vector3((Math.random() - 0.5) * 4, 2 + Math.random() * 2.5, (Math.random() - 0.5) * 4);
      this.scene.add(s);
      this.bursts.push({ s, v, life: 0.9 });
    }
  }

  // ---------- every frame ----------
  update(dt) {
    const k = Math.min(1, dt * 9);
    for (const p of this.peers.values()) {
      const r = p.model.root, t = p.target;
      const dx = t[0] - r.position.x, dz = t[2] - r.position.z;
      const far = Math.hypot(dx, dz);
      if (far > 25) r.position.set(t[0], t[1], t[2]);
      else {
        r.position.x += dx * k;
        r.position.z += dz * k;
        r.position.y += (t[1] - r.position.y) * k;
      }
      let dy = t[3] - r.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      r.rotation.y += dy * k;
      p.model.animate(dt, t[4] === 1 || far > 0.08, far > 1.5);
      const sc = Math.min(1.6, Math.max(1, this.camera.position.distanceTo(r.position) / 14));
      p.tag.scale.set(2.4 * sc, 0.45 * sc, 1);
      if (p.emote && performance.now() > p.emote.until) {
        r.remove(p.emote.sp);
        p.emote = null;
      }
    }
    if (this.myEmote && performance.now() > this.myEmote.until) {
      this.myEmote.root.remove(this.myEmote.sp);
      this.myEmote = null;
    }
    // things in the air
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const f = this.flying[i];
      f.t += dt / f.dur;
      const root = f.target.model.root;
      const b = root.position.clone();
      b.y += 1.2;
      const u = Math.min(1, f.t);
      f.obj.position.lerpVectors(f.a, b, u);
      f.obj.position.y += Math.sin(u * Math.PI) * (1.2 + f.a.distanceTo(b) * 0.12);
      if (f.kind === 'plane') f.obj.lookAt(b);
      else f.obj.rotation.x += dt * 9;
      if (u >= 1) {
        this.scene.remove(f.obj);
        this.flying.splice(i, 1);
        this.burst(b);
        f.target.model.bonk?.();
        boing();
        f.onHit?.();
      }
    }
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.life -= dt;
      b.v.y -= 9 * dt;
      b.s.position.addScaledVector(b.v, dt);
      b.s.scale.setScalar(Math.max(0.01, b.life));
      if (b.life <= 0) {
        this.scene.remove(b.s);
        this.bursts.splice(i, 1);
      }
    }
    // tell the others where I am (only when something changed, max ~7 times a second)
    const now = performance.now();
    if (this.ws?.readyState === 1 && now - this.lastSent.t > 140) {
      const [x, y, z, r, mv] = this.pose();
      const L = this.lastSent;
      if (Math.hypot(x - L.x, z - L.z) > 0.05 || Math.abs(y - L.y) > 0.05 || Math.abs(r - L.r) > 0.05 || mv !== L.mv) {
        this.send({ t: 'p', p: [x, y, z, r, mv] });
        this.lastSent = { x, y, z, r, mv, t: now };
      }
    }
  }

  // ---------- UI ----------
  ui() {
    const $ = (id) => document.getElementById(id);
    this.el = { pill: $('online'), people: $('people'), list: $('people-list'), menu: $('peer-menu'), toasts: $('toasts') };
    this.el.pill.onclick = () => this.togglePeople();
    $('people-x').onclick = () => this.togglePeople(false);
    $('peer-x').onclick = () => this.closeMenu();
    // tap / click a person in the world
    let down = null;
    this.canvas.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
    this.canvas.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8 || !this.peers.size) return;
      const ray = new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), this.camera);
      const hit = ray.intersectObjects([...this.peers.values()].map((p) => p.model.root), true)[0];
      const id = hit?.object.userData.peerId;
      if (id) this.openMenu(this.peers.get(id));
    });
  }
  applySettings() {
    if (!this.settings.multiplayer) this.disconnect();
    this.renderCount();
    this.renderPeople();
    if (this.menuPeer) this.openMenu(this.menuPeer);
  }
  renderCount() {
    const show = this.settings.multiplayer && this.settings.showCount && !!this.ws;
    this.el.pill.hidden = !show;
    const n = Math.max(1, this.online || this.peers.size + 1);
    this.el.pill.querySelector('span').textContent = n === 1 ? 'just you in town' : `${n} in town`;
    this.el.pill.dataset.n = n;
  }
  togglePeople(force) {
    const open = force ?? this.el.people.hidden;
    this.el.people.hidden = !open;
    if (open) this.renderPeople();
  }
  renderPeople() {
    if (!this.el || this.el.people.hidden) return;
    const me = this.getMe();
    const rows = [...this.peers.values()].map((p) => {
      const row = document.createElement('div');
      row.className = 'person';
      const b = document.createElement('b');
      b.textContent = p.nick;
      const go = document.createElement('button');
      go.className = 'pill small';
      go.textContent = 'Say hi';
      go.onclick = () => this.openMenu(p);
      row.append(b, go);
      return row;
    });
    this.el.list.replaceChildren(
      ...(rows.length ? rows : [Object.assign(document.createElement('p'), { className: 'muted', textContent: this.settings.multiplayer ? 'Nobody else is here right now. Share the town with a friend!' : 'Seeing other visitors is switched off right now.' })]),
    );
    document.getElementById('people-me').textContent = me.nick;
  }
  openMenu(peer) {
    if (!peer) return;
    this.menuPeer = peer;
    const m = this.el.menu;
    m.hidden = false;
    m.querySelector('h3').textContent = peer.nick;
    const box = m.querySelector('.acts');
    const btn = (text, fn, cls = 'pill small') => Object.assign(document.createElement('button'), { className: cls, textContent: text, onclick: fn });
    box.replaceChildren(
      btn('Wave hi', () => this.hi(peer), 'pill warm'),
      ...(this.settings.throwing ? Object.entries(THROW_NAMES).map(([k, n]) => btn(`Throw ${n.toLowerCase()}`, () => this.throwAt(peer, k))) : []),
      btn('Walk over', () => {
        const p = peer.model.root.position;
        this.visitor.root.position.set(p.x + 1.6, p.y, p.z + 1.6);
        this.closeMenu();
      }),
    );
    m.querySelector('.note').textContent = this.settings.throwing ? 'Everything is soft. It just says "hey, over here!"' : '';
  }
  closeMenu() {
    this.menuPeer = null;
    this.el.menu.hidden = true;
  }
  toast(text, action, fn) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.append(Object.assign(document.createElement('span'), { textContent: text }));
    if (action) {
      const b = Object.assign(document.createElement('button'), { className: 'pill small warm', textContent: action });
      b.onclick = () => {
        fn();
        t.remove();
      };
      t.append(b);
    }
    this.el.toasts.append(t);
    setTimeout(() => t.classList.add('out'), 5500);
    setTimeout(() => t.remove(), 6200);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
  }
}

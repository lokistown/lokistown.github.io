// Loki's Town — a walkable 3D world built from Loki's own memory.
import * as THREE from 'three';
import { fontsReady, toon, part } from './toon.js';
import { PLOT, plotInfo, ensurePlots, roomsOf, ROOM_INFO } from './layout.js';
import { buildBuilding, glass, bulbs } from './buildings.js';
import { createLand, createRoads, createPlaza, decorate, rng } from './world.js';
import { NavGrid } from './nav.js';
import { createLoki, createPip, createVisitor } from './characters.js';
import { LokiLife, ukNow } from './life.js';
import { Controls } from './player.js';
import { playSong, stopMusic } from './audio.js';

const $ = (id) => document.getElementById(id);
const q = new URLSearchParams(location.search);
const hourOverride = q.has('hour') ? Number(q.get('hour')) : null;

// ---------- renderer ----------
const canvas = $('world');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 900);
scene.fog = new THREE.Fog('#bfe6ff', 90, 330);
const hemi = new THREE.HemisphereLight('#e8f6ff', '#86c06c', 1.3);
const sun = new THREE.DirectionalLight('#fff1d6', 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 300 });
sun.shadow.bias = -0.0005;
sun.shadow.normalBias = 0.05;
scene.add(hemi, sun, sun.target);

// sky dome with gradient
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  fog: false,
  uniforms: { top: { value: new THREE.Color('#7cc4f2') }, bottom: { value: new THREE.Color('#dff3ff') } },
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y*1.6+0.15,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, h),1.0); }',
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(600, 24, 16), skyMat);
scene.add(sky);
const starsGeo = new THREE.BufferGeometry();
{
  const r = rng('stars'), p = [];
  for (let i = 0; i < 900; i++) {
    const a = r() * Math.PI * 2, e = 0.1 + r() * 1.3;
    p.push(Math.cos(a) * Math.cos(e) * 500, Math.sin(e) * 500, Math.sin(a) * Math.cos(e) * 500);
  }
  starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
}
const stars = new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: '#fff', size: 1.8, sizeAttenuation: false, transparent: true, fog: false }));
scene.add(stars);
const moon = new THREE.Mesh(new THREE.SphereGeometry(14, 20, 14), new THREE.MeshBasicMaterial({ color: '#fff6d5', fog: false }));
moon.position.set(-200, 230, -300);
scene.add(moon);
const clouds = new THREE.Group();
{
  const r = rng('clouds');
  for (let i = 0; i < 16; i++) {
    const c = new THREE.Group();
    for (let k = 0; k < 5; k++) c.add(part(new THREE.SphereGeometry(3 + r() * 3, 12, 8), '#ffffff', { x: k * 4 - 8, y: r() * 2, z: r() * 3, ink: 0, shadow: false }));
    c.position.set((r() - 0.5) * 420, 60 + r() * 30, (r() - 0.5) * 420);
    c.userData.speed = 0.8 + r();
    clouds.add(c);
  }
}
scene.add(clouds);
createLand(scene);

// ---------- state ----------
let D = { state: null, town: { buildings: [] }, diary: [], gallery: [], music: [], products: [], wishes: [], config: {} };
let townGroup = null, built = [], colliders = [], items = [], places = [], nav = null, lamps = [], smoke = [], jets = [], bounds = PLOT * 3, townKey = '';
const nightLights = [];

async function getJson(name, fallback) {
  try {
    const r = await fetch(`data/${name}?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) throw 0;
    return await r.json();
  } catch {
    return fallback;
  }
}

function buildTown() {
  if (townGroup) scene.remove(townGroup);
  nightLights.length = 0;
  townGroup = new THREE.Group();
  const town = ensurePlots(D.town);
  const ctx = { art: D.gallery, smoke: [], jets: [] };
  const maxRing = Math.max(1, ...town.buildings.map((b) => plotInfo(b.plot).ring));
  bounds = (maxRing + 1.2) * PLOT;
  createRoads(townGroup, maxRing);
  const plaza = createPlaza(townGroup, { diary: D.diary[0] });
  lamps = plaza.lamps;
  colliders = [...plaza.colliders];
  items = [...plaza.items];
  places = [...plaza.places];
  built = [];
  for (const b of town.buildings) {
    const r = buildBuilding(b, ctx);
    townGroup.add(r.root);
    built.push({ b, ...r });
    colliders.push(...r.colliders);
    items.push(...r.items);
    places.push(...r.places);
    if (r.footprint) {
      const l = new THREE.PointLight('#ffd9a0', 0, 18, 1.4);
      l.position.set(r.footprint.x, 2.8, r.footprint.z);
      townGroup.add(l);
      nightLights.push(l);
    }
  }
  // chimney smoke puffs
  smoke = [];
  for (const s of ctx.smoke) {
    for (let k = 0; k < 4; k++) {
      const p = part(new THREE.SphereGeometry(0.35, 10, 8), '#ffffff', { ink: 0, shadow: false, mat: new THREE.MeshToonMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 }) });
      p.userData = { phase: k / 4, base: new THREE.Vector3(0, 1.4, 0) };
      s.obj.add(p);
      smoke.push(p);
    }
  }
  jets = ctx.jets;
  colliders.push(...decorate(townGroup, new Set(town.buildings.map((b) => b.plot)), maxRing, plotInfo));
  scene.add(townGroup);
  nav = new NavGrid(bounds + 4, 0.5);
  for (const c of colliders) nav.addBox(c, 0.35);
  life.setWorld(places, nav);
}

async function load(first) {
  const [state, town, diary, gallery, music, products, wishes, config] = await Promise.all([
    getJson('state.json', null), getJson('town.json', { buildings: [] }), getJson('diary.json', []), getJson('gallery.json', []),
    getJson('music.json', []), getJson('products.json', []), getJson('wishes.json', []), getJson('config.json', {}),
  ]);
  Object.assign(D, { state, town, diary, gallery, music, products, wishes, config });
  const key = JSON.stringify(town) + (gallery[0]?.file || '') + (diary[0]?.title || '');
  if (key !== townKey) {
    townKey = key;
    buildTown();
  }
  life.setState(state);
  renderNeeds();
  if (panelOpen) renderPanel(curTab);
  if (first) loadOffers();
}

// ---------- characters ----------
const loki = createLoki();
const pip = createPip();
scene.add(loki.root);
const life = new LokiLife(loki, pip);
let colorIdx = 0;
try {
  colorIdx = Number(localStorage.getItem('loki.color') ?? Math.floor(Math.random() * 7));
  localStorage.setItem('loki.color', String(colorIdx));
} catch {}
const visitor = createVisitor(colorIdx);
visitor.root.position.set(0, 0, 6);
visitor.root.rotation.y = Math.PI;
scene.add(visitor.root);
const controls = new Controls(canvas, camera, visitor);
window.__loki = { visitor, loki, life, controls, camera, get built() { return built; }, get places() { return places; } };

// ---------- time of day ----------
const C = (h) => new THREE.Color(h);
let night = 0;
function applyTime(h) {
  const elev = Math.sin(((h - 6.5) / 13.5) * Math.PI);
  const day = THREE.MathUtils.clamp(elev * 2.2, 0, 1);
  const dusk = THREE.MathUtils.clamp(1 - Math.abs(elev) * 3.5, 0, 1);
  night = 1 - day;
  const top = C('#0b1030').lerp(C('#6fbdf0'), day).lerp(C('#6a5aa8'), dusk * 0.5);
  const bottom = C('#1b2350').lerp(C('#e4f5ff'), day).lerp(C('#ffb38a'), dusk * 0.8);
  skyMat.uniforms.top.value.copy(top);
  skyMat.uniforms.bottom.value.copy(bottom);
  scene.fog.color.copy(bottom);
  const az = ((h - 6.5) / 13.5) * Math.PI;
  sun.position.set(Math.cos(az) * 120 + visitor.root.position.x, Math.max(10, elev * 150), -50 + visitor.root.position.z);
  sun.target.position.copy(visitor.root.position);
  sun.intensity = 0.25 + day * 2.2;
  sun.color.copy(C('#fff1d6')).lerp(C('#ffa86b'), dusk);
  hemi.intensity = 0.75 + day * 0.65;
  hemi.color.copy(C('#8fa0e8')).lerp(C('#e8f6ff'), day);
  stars.material.opacity = THREE.MathUtils.clamp(night * 1.3 - 0.3, 0, 1);
  stars.visible = stars.material.opacity > 0.01;
  moon.visible = night > 0.5;
  const glow = THREE.MathUtils.clamp((night - 0.35) * 2.2, 0, 1.3);
  glass.emissiveIntensity = glow;
  bulbs.emissiveIntensity = glow * 1.5;
  lamps.forEach((l) => (l.intensity = glow * 30));
  nightLights.forEach((l) => (l.intensity = glow * 22));
}

// ---------- HUD ----------
const NEED_COLORS = { fullness: '#7cc36a', energy: '#f4a261', joy: '#ffd166', curiosity: '#b388eb', calm: '#4cc9f0' };
const NEED_NAMES = { fullness: 'Full', energy: 'Energy', joy: 'Joy', curiosity: 'Curious', calm: 'Calm' };
function needsNow() {
  const n = { fullness: 70, energy: 70, joy: 70, curiosity: 70, calm: 70, ...(D.state?.needs || {}) };
  // gentle drift since the last brain update so the bars feel alive
  const hrs = D.state?.updated ? (Date.now() - new Date(D.state.updated)) / 3600000 : 0;
  n.fullness = Math.max(5, n.fullness - hrs * 4);
  n.energy = Math.max(5, n.energy - hrs * 2.5);
  return n;
}
function bars(el, values, small) {
  el.replaceChildren(
    ...Object.keys(NEED_COLORS).map((k) => {
      const v = Math.round(Math.max(0, Math.min(100, values[k] ?? 60)));
      const b = document.createElement('div');
      b.className = 'bar';
      b.title = `${NEED_NAMES[k]}: ${v}%`;
      b.innerHTML = `${small ? '' : `<label><i style="background:${NEED_COLORS[k]}"></i>${NEED_NAMES[k]}</label>`}<div class="track"><div class="fill" style="width:${v}%;background:${NEED_COLORS[k]}"></div></div>`;
      return b;
    }),
  );
}
function renderNeeds() {
  bars($('needs-loki'), needsNow());
  bars($('needs-pip'), { fullness: 60, energy: 70, joy: 75, curiosity: 85, calm: 60, ...(D.state?.pip?.needs || {}) }, true);
  const s = D.state;
  $('lvl').textContent = s ? `lvl ${s.level} · ${s.stage}` : '';
  const w = $('whatson');
  w.hidden = !s?.whatsOn;
  if (s?.whatsOn) w.textContent = `"${s.whatsOn}"`;
}

let bubbleText = '', bubbleSwap = 0;
function updateNowCard(t) {
  const info = life.info();
  const s = D.state;
  if (!info) return;
  $('now-where').textContent = info.where ? `At ${info.where}` : 'Somewhere in town';
  $('now-label').textContent = info.label.charAt(0).toUpperCase() + info.label.slice(1);
  $('now-thought').textContent = info.thought || s?.thought || '';
  const rec = (s?.recent || []).slice(0, 2).map((r) => `<div>· ${escapeHtml(r.text)} <span class="muted">${r.time || ''}</span></div>`).join('');
  $('now-recent').innerHTML = rec;
  const v = visitor.root.position, l = loki.root.position;
  const dx = l.x - v.x, dz = l.z - v.z;
  const dist = Math.hypot(dx, dz);
  const fx = -Math.sin(controls.yaw), fz = -Math.cos(controls.yaw), rx = Math.cos(controls.yaw), rz = -Math.sin(controls.yaw);
  const rel = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
  $('arrow').style.transform = `rotate(${rel - Math.PI / 2}rad)`;
  $('finder-text').textContent = `Loki is ${info.label} · ${dist < 4 ? 'right here!' : Math.round(dist) + ' m'}`;
  if (t > bubbleSwap) {
    bubbleSwap = t + 6;
    const thought = info.thought || s?.thought || '';
    bubbleText = info.act === 'sleep' ? 'Zzz… 💤' : bubbleText === thought ? info.label : thought || info.label;
  }
}
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

const tmpV = new THREE.Vector3();
function updateBubble() {
  loki.head.getWorldPosition(tmpV);
  tmpV.y += 1.0;
  const d = camera.position.distanceTo(tmpV);
  tmpV.project(camera);
  const b = $('bubble');
  const vis = d < 30 && tmpV.z < 1 && Math.abs(tmpV.x) < 1.05 && Math.abs(tmpV.y) < 1.05 && !panelOpen;
  b.hidden = !vis || !bubbleText;
  if (!b.hidden) {
    b.textContent = bubbleText;
    b.style.left = `${((tmpV.x + 1) / 2) * innerWidth}px`;
    b.style.top = `${((1 - tmpV.y) / 2) * innerHeight}px`;
    b.style.opacity = String(THREE.MathUtils.clamp((30 - d) / 8, 0, 1));
  }
}

// minimap
const mm = $('minimap').getContext('2d');
function drawMinimap() {
  const S = 220, R = S / 2, scale = R / (bounds + 6);
  mm.clearRect(0, 0, S, S);
  mm.save();
  mm.beginPath();
  mm.arc(R, R, R, 0, Math.PI * 2);
  mm.clip();
  mm.fillStyle = '#b7e3a0';
  mm.fillRect(0, 0, S, S);
  // rotate so "up" is where the camera looks
  mm.translate(R, R);
  mm.rotate(controls.yaw);
  mm.fillStyle = '#ecd7ad';
  mm.beginPath();
  mm.arc(0, 0, 10 * scale, 0, Math.PI * 2);
  mm.fill();
  for (const bb of built) {
    const fp = bb.footprint;
    mm.fillStyle = fp ? '#c96f4a' : '#5fa35a';
    if (fp) mm.fillRect((fp.x - fp.hw) * scale, (fp.z - fp.hd) * scale, fp.hw * 2 * scale, fp.hd * 2 * scale);
    else {
      const i = plotInfo(bb.b.plot);
      mm.beginPath();
      mm.arc(i.x * scale, i.z * scale, 6 * scale, 0, Math.PI * 2);
      mm.fill();
    }
  }
  const l = loki.root.position, v = visitor.root.position;
  mm.fillStyle = '#f28c28';
  mm.strokeStyle = '#2b1a10';
  mm.lineWidth = 3;
  mm.beginPath();
  mm.arc(l.x * scale, l.z * scale, 9, 0, Math.PI * 2);
  mm.fill();
  mm.stroke();
  mm.save();
  mm.translate(v.x * scale, v.z * scale);
  mm.rotate(-visitor.root.rotation.y + Math.PI);
  mm.fillStyle = '#3d3a6b';
  mm.beginPath();
  mm.moveTo(0, -10);
  mm.lineTo(7, 7);
  mm.lineTo(-7, 7);
  mm.closePath();
  mm.fill();
  mm.restore();
  mm.restore();
}

// interaction prompt
let nearest = null;
function updatePrompt() {
  const v = visitor.root.position;
  const lokiItem = { type: 'loki', x: loki.root.position.x, z: loki.root.position.z, r: 2.8, label: life.act === 'sleep' ? '💤 Watch Loki sleep' : '🐱 Say hi to Loki' };
  let best = null, bd = 1e9;
  for (const it of [lokiItem, ...items]) {
    const d = Math.hypot(v.x - it.x, v.z - it.z);
    if (d < it.r && d < bd) {
      best = it;
      bd = d;
    }
  }
  nearest = best;
  $('prompt').hidden = !best || panelOpen || offerOpen;
  if (best) $('prompt-text').textContent = best.label;
}
function interact(it) {
  if (!it) return;
  if (it.type === 'loki') openPanel('loki');
  else if (it.type === 'diary') openPanel('diary');
  else if (it.type === 'gallery') openPanel('gallery');
  else if (it.type === 'music') openPanel('music');
  else if (it.type === 'shop') openPanel('shop');
  else if (it.type === 'offer') openOffer();
  else if (it.type === 'control') location.href = 'control/';
  else if (it.type === 'building') openPanel('place', it.data);
}
$('prompt').addEventListener('click', () => interact(nearest));
addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input, textarea')) return;
  if (e.code === 'Escape') closeAll();
  else if (e.code === 'KeyE' && !panelOpen && !offerOpen) interact(nearest);
  else if (e.code === 'KeyM') panelOpen ? closeAll() : openPanel('loki');
});

// ---------- book ----------
let panelOpen = false, curTab = 'loki', placeData = null;
function openPanel(tab, extra) {
  closeOffer();
  panelOpen = true;
  curTab = tab;
  placeData = extra || placeData;
  controls.enabled = false;
  $('panel').hidden = false;
  renderPanel(tab);
}
function closeAll() {
  panelOpen = false;
  controls.enabled = true;
  $('panel').hidden = true;
  closeOffer();
}
$('panel-x').onclick = closeAll;
$('menu-btn').onclick = () => (panelOpen ? closeAll() : openPanel('loki'));
$('now-diary').onclick = () => openPanel('diary');
$('now-x').onclick = () => $('now').classList.toggle('min');
$('finder').onclick = () => openPanel('loki');
document.querySelectorAll('#tabs button').forEach((b) => (b.onclick = () => renderPanel((curTab = b.dataset.tab))));

function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e[k] = v;
    else if (v != null) e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k.nodeType ? k : String(k));
  return e;
}

function renderPanel(tab) {
  document.querySelectorAll('#tabs button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  const s = D.state;
  const body = $('panel-body');
  let c;
  if (tab === 'loki') {
    const info = life.info();
    if (!s) c = h('p', {}, 'Loki is still on his way…');
    else {
      const prev = (s.level - 1) ** 2 * 10;
      const pct = Math.max(0, Math.min(100, ((s.xp - prev) / (s.nextLevelXp - prev)) * 100));
      const n = needsNow();
      c = h('div', {},
        h('h2', {}, '🐱 Loki'),
        h('p', { class: 'quote' }, `“${s.thought || '…'}”`),
        h('dl', {},
          h('dt', {}, 'Right now'), h('dd', {}, info ? `${info.label} (${info.where})` : '…'),
          h('dt', {}, 'Mood'), h('dd', {}, s.mood || '…'),
          h('dt', {}, 'Level'), h('dd', {}, `${s.level} · ${s.stage} `, h('span', { class: 'xp' }, h('span', { style: `width:${pct}%` })), ` ${s.xp}/${s.nextLevelXp} XP`),
          h('dt', {}, 'Needs'), h('dd', {}, Object.keys(NEED_NAMES).map((k) => `${NEED_NAMES[k]} ${Math.round(n[k])}%`).join(' · ')),
          h('dt', {}, 'Has done'), h('dd', {}, `${s.tasksDone} things in ${s.sessions} work sessions`),
          h('dt', {}, 'Skills'), h('dd', {}, s.skills?.length ? s.skills.map((k) => k.name).join(', ') : 'none yet'),
          h('dt', {}, 'Pip'), h('dd', {}, s.pip?.status || 'riding on Loki’s head, as usual'),
        ),
        s.recent?.length ? [h('h3', {}, 'Lately'), h('ul', {}, s.recent.slice(0, 8).map((r) => h('li', {}, `${r.time} — ${r.text}`)))] : null,
        h('p', {}, h('button', { class: 'btn', onclick: () => openOffer() }, '💌 Leave him something')),
      );
    }
  } else if (tab === 'diary') {
    c = h('ol', { class: 'diary' }, D.diary.length ? D.diary.map((d) => h('li', {}, h('h3', {}, d.title), h('div', { class: 'muted' }, `${d.date} · ${d.time}`), h('p', {}, d.text))) : h('li', {}, 'Nothing yet.'));
  } else if (tab === 'gallery') {
    c = D.gallery.length ? h('div', { class: 'gallery' }, D.gallery.map((a) => h('figure', {}, h('img', { src: `gallery/${encodeURIComponent(a.file)}`, alt: a.title, loading: 'lazy' }), h('figcaption', {}, `${a.title} · ${a.date}`)))) : h('p', {}, 'No art yet. Loki is warming up his paws.');
  } else if (tab === 'music') {
    c = h('div', {}, h('h2', {}, '🎹 Loki’s songs'), h('p', { class: 'muted' }, 'Loki is learning to sing and play. These are his own tunes.'),
      D.music.length ? D.music.map((m) => {
        const btn = h('button', { class: 'round small' }, '▶');
        btn.onclick = () => {
          if (btn.textContent === '■') return stopMusic();
          document.querySelectorAll('.track-row .round').forEach((x) => (x.textContent = '▶'));
          btn.textContent = '■';
          playSong(m, () => (btn.textContent = '▶'));
        };
        return h('div', { class: 'track-row' }, btn, h('div', {}, h('b', {}, m.title), h('div', { class: 'muted' }, `${m.date || ''} · ${m.mood || ''}`)));
      }) : h('p', {}, 'No songs yet — he’s still practising scales in the music room.'));
  } else if (tab === 'messages') {
    c = h('div', {}, h('h2', {}, '💌 Loki’s mailbox'), h('p', {}, h('button', { class: 'btn', onclick: () => openOffer() }, 'Leave him something')), feedEl(offers));
  } else if (tab === 'wishes') {
    c = h('div', {}, h('h2', {}, '🌠 Loki’s wishes'), h('p', { class: 'muted' }, 'Things Loki has asked his human for. Some come true.'),
      D.wishes.length ? D.wishes.map((w) => h('div', { class: 'wish' }, h('span', { class: 'st' }, w.status), h('b', {}, w.text), h('div', { class: 'muted' }, w.why || ''))) : h('p', {}, 'No wishes yet.'));
  } else if (tab === 'shop') {
    const kofi = D.config.kofi || 'https://ko-fi.com/lokistown';
    const gum = D.config.gumroad || 'https://lokistown.gumroad.com';
    c = h('div', {}, h('h2', {}, '🛍️ Loki’s shop'), h('p', {}, 'Everything here is made by Loki. Buying something helps his town grow.'),
      h('p', {}, h('a', { class: 'btn', href: kofi, target: '_blank', rel: 'noopener' }, '☕ Ko-fi: buy Loki a fish'), h('a', { class: 'btn alt', href: gum, target: '_blank', rel: 'noopener' }, '🛒 Gumroad shop')),
      h('h3', {}, 'On the shelves'),
      D.products.filter((p) => p.status === 'listed').length ? D.products.filter((p) => p.status === 'listed').map((p) => h('div', { class: 'wish' }, h('b', {}, p.title), h('div', {}, p.description), p.url ? h('a', { href: p.url, target: '_blank', rel: 'noopener' }, `Get it · ${p.price || ''}`) : null)) : h('p', { class: 'muted' }, 'Loki is still making his first products. Check back soon!'),
      D.products.filter((p) => p.status !== 'listed').length ? h('p', { class: 'muted' }, `${D.products.filter((p) => p.status !== 'listed').length} more being prepared in the workshop…`) : null);
  } else if (tab === 'town') {
    c = h('div', {}, h('h2', {}, '🏘️ Loki’s Town'), D.town.buildings.map((b) => h('div', { class: 'wish' }, h('b', {}, `${b.name} · level ${b.level}`), h('div', {}, b.description || ''), ['park', 'garden', 'fountain', 'tree', 'market'].includes(b.kind) ? null : h('div', { class: 'muted' }, 'Rooms: ' + roomsOf(b).map((r) => r.name || ROOM_INFO[r.kind]?.name || r.kind).join(', ')))));
  } else if (tab === 'place' && placeData) {
    const b = placeData;
    c = h('div', {}, h('h2', {}, b.name), h('p', {}, b.description || ''), h('p', { class: 'muted' }, `Level ${b.level}${b.built ? ' · built ' + b.built : ''}`), ['park', 'garden', 'fountain', 'tree', 'market'].includes(b.kind) ? null : h('p', {}, 'Rooms: ' + roomsOf(b).map((r) => r.name || ROOM_INFO[r.kind]?.name).join(', ')), h('p', { class: 'muted' }, 'Walk through the door to go inside.'));
  } else {
    c = h('div', {}, h('h2', {}, 'About Loki’s Town'),
      h('p', {}, 'Loki is a small orange cat who lives here with his friend Pip the mouse. Nobody tells him what to do: every couple of hours his brain wakes up, reads his memory and his mailbox, and decides what to do — paint, sing, build, cook, look after his town, make things to sell, and write his diary. He sleeps 23:00–07:00 UK time.'),
      h('p', {}, 'Leave him something in the red mailbox on the plaza. He reads everything, keeps what he likes, and remembers who you are.'),
      h('p', { class: 'muted' }, 'Loki is an AI character. His words and choices are made by an AI model.'));
  }
  body.replaceChildren(c);
}

// ---------- leave him something ----------
let offers = { items: [], pending: 0 };
let offerOpen = false;
const ADJ = ['mossy', 'salty', 'sleepy', 'brave', 'tiny', 'velvet', 'sunny', 'quiet', 'fuzzy', 'lucky', 'paper', 'copper', 'misty', 'bouncy'];
const ANI = ['Otter', 'Sparrow', 'Pebble', 'Fox', 'Teacup', 'Badger', 'Moth', 'Radish', 'Kettle', 'Newt', 'Plum', 'Heron', 'Acorn', 'Biscuit'];
function ident() {
  let id, nick;
  try {
    id = localStorage.getItem('loki.vid');
    nick = localStorage.getItem('loki.nick');
  } catch {}
  if (!id) id = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join('');
  if (!nick) nick = newNick();
  try {
    localStorage.setItem('loki.vid', id);
    localStorage.setItem('loki.nick', nick);
  } catch {}
  return { id, nick };
}
function newNick() {
  const r = crypto.getRandomValues(new Uint32Array(3));
  return ADJ[r[0] % ADJ.length] + ANI[r[1] % ANI.length] + (r[2] % 90 + 10);
}
let me = ident();
let imageData = null;
function openOffer() {
  $('panel').hidden = true;
  panelOpen = false;
  offerOpen = true;
  controls.enabled = false;
  $('offer').hidden = false;
  $('nick').textContent = me.nick;
  $('offer-feed').replaceChildren(feedEl(offers));
  if (!D.config.workerUrl) $('offer-status').textContent = 'Loki’s mailbox opens very soon!';
}
function closeOffer() {
  offerOpen = false;
  $('offer').hidden = true;
  if (!panelOpen) controls.enabled = true;
}
$('offer-btn').onclick = openOffer;
$('offer-x').onclick = closeAll;
$('nick-new').onclick = () => {
  me.nick = newNick();
  try {
    localStorage.setItem('loki.nick', me.nick);
  } catch {}
  $('nick').textContent = me.nick;
};
$('offer-file').onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const img = await createImageBitmap(f);
  const max = 640, k = Math.min(1, max / Math.max(img.width, img.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(img.width * k);
  cv.height = Math.round(img.height * k);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  imageData = cv.toDataURL('image/jpeg', 0.8);
  $('offer-preview').src = imageData;
  $('offer-preview').hidden = false;
};
$('offer-send').onclick = async () => {
  const text = $('offer-text').value.trim();
  if (!text && !imageData) return ($('offer-status').textContent = 'Write something or add a picture first.');
  if (!D.config.workerUrl) return ($('offer-status').textContent = 'Loki’s mailbox opens very soon — please come back!');
  $('offer-status').textContent = 'Sending…';
  try {
    const r = await fetch(`${D.config.workerUrl}/api/offer`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ visitorId: me.id, nick: me.nick, text, image: imageData }) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || r.status);
    $('offer-text').value = '';
    imageData = null;
    $('offer-preview').hidden = true;
    $('offer-status').textContent = '💌 In his mailbox! He’ll read it in his own time.';
    loadOffers();
  } catch (e) {
    $('offer-status').textContent = `Couldn’t send: ${e.message}`;
  }
};
async function loadOffers() {
  if (!D.config.workerUrl) return;
  try {
    const r = await fetch(`${D.config.workerUrl}/api/offerings?limit=40`);
    offers = await r.json();
    if (offerOpen) $('offer-feed').replaceChildren(feedEl(offers));
  } catch {}
}
function feedEl(o) {
  const list = o.items || [];
  return h('div', { class: 'feed' },
    o.pending ? h('p', { class: 'muted' }, `${o.pending} waiting in his mailbox`) : null,
    list.length ? list.map((m) => h('div', { class: 'msg' },
      h('div', { class: 'who' }, m.nick, h('span', { class: 'kept' }, m.status === 'kept' ? '· Loki kept it' : m.status === 'letgo' ? '· he let it go' : '· waiting')),
      m.text ? h('div', {}, m.text) : null,
      m.image ? h('img', { src: m.image, alt: 'picture for Loki', loading: 'lazy' }) : null,
      m.reply ? h('div', { class: 'reply' }, h('b', {}, 'Loki: '), m.reply, m.question ? h('div', {}, h('i', {}, `He asked: ${m.question}`)) : null) : null,
    )) : h('p', { class: 'muted' }, 'Nothing here yet. Be the first!'));
}

// ---------- loop ----------
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
let lastHud = 0, lastMap = 0;
let simT = 0;
function frame(forcedDt) {
  const dt = forcedDt ?? Math.min(0.05, clock.getDelta());
  simT += dt;
  const t = simT;
  const now = ukNow();
  applyTime(hourOverride ?? now.h);
  // inside a building? -> dollhouse view for that building
  const v = visitor.root.position;
  let inside = false;
  for (const bb of built) {
    const fp = bb.footprint;
    const isIn = fp && Math.abs(v.x - fp.x) < fp.hw + 0.2 && Math.abs(v.z - fp.z) < fp.hd + 0.2;
    if (isIn) inside = true;
    bb.setCutaway(isIn);
    const activeRoom = life.current?.place?.room;
    for (const tk of bb.ticks) tk.fn(t, activeRoom === tk.roomId && !life.moving);
  }
  controls.inside = inside;
  controls.update(dt, colliders, bounds);
  life.update(dt, t, visitor.root.position);
  for (const p of smoke) {
    const k = (t * 0.22 + p.userData.phase) % 1;
    p.position.set(Math.sin(k * 6) * 0.4, 1.4 + k * 3.5, 0);
    p.scale.setScalar(0.5 + k * 1.6);
    p.material.opacity = 0.65 * (1 - k);
  }
  for (const j of jets) j.position.y = 0.75 + Math.sin(t * 3) * 0.03;
  clouds.children.forEach((c) => {
    c.position.x += c.userData.speed * dt;
    if (c.position.x > 230) c.position.x = -230;
  });
  updateBubble();
  if (t - lastHud > 0.25) {
    lastHud = t;
    updatePrompt();
    updateNowCard(t);
    $('clock').textContent = `🌙 ${now.label}`.replace('🌙', night > 0.5 ? '🌙' : '☀️');
  }
  if (t - lastMap > 0.1) {
    lastMap = t;
    drawMinimap();
  }
  renderer.render(scene, camera);
}
function tick() {
  frame();
  requestAnimationFrame(tick);
}
window.__loki.step = (n = 60, dt = 0.05) => {
  for (let i = 0; i < n; i++) frame(dt);
};

(async () => {
  await fontsReady();
  await load(true);
  $('loading').hidden = true;
  requestAnimationFrame(tick);
  setTimeout(() => $('help').classList.add('fade'), 10000);
  setInterval(() => load(false), 120000);
  setInterval(loadOffers, 60000);
  setInterval(renderNeeds, 30000);
})();

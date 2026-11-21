// Loki's Town — a walkable 3D world built from Loki's own memory.
import * as THREE from 'three';
import { fontsReady, toon, part } from './toon.js';
import { PLOT, plotInfo, ensurePlots, roomsOf, ROOM_INFO, FLOOR_Y, layoutBuilding, toWorld, WALL_H } from './layout.js';
import { buildProp, mural } from './props.js';
import { buildBuilding, glass, bulbs } from './buildings.js';
import { createLand, createRoads, createPlaza, decorate, decorList, rng } from './world.js';
import { DEFAULT_BRANDS } from './brand.js';
import { NavGrid } from './nav.js';
import { createLoki, createPip, createVisitor } from './characters.js';
import { LokiLife, ukNow } from './life.js';
import { Controls } from './player.js';
import { playSong, stopMusic } from './audio.js';
import { Social } from './social.js';
import { buildShowcase, slugOf } from './showcase.js';
import { Weather, createStreetLife } from './life2.js';

const $ = (id) => document.getElementById(id);
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
let lastTouchEnd = 0;
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd < 350 && !(e.target.closest && e.target.closest('input, textarea'))) e.preventDefault();
  lastTouchEnd = now;
}, { passive: false });
document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
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
let landRing = -1;
const weather = new Weather(scene);
let street = null;

// ---------- state ----------
let D = { state: null, town: { buildings: [] }, diary: [], gallery: [], music: [], products: [], wishes: [], games: [], stories: [], config: {} };
let spots = {};
let drops = [];
let roamBounds = PLOT * 6;
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
  bounds = (maxRing + 1.2) * PLOT; // the town itself (map, Loki's paths)
  roamBounds = (maxRing + 4.6) * PLOT; // visitors can wander the fields beyond
  createRoads(townGroup, maxRing);
  const plaza = createPlaza(townGroup, { diary: D.diary[0] });
  lamps = plaza.lamps;
  colliders = [...plaza.colliders];
  items = [...plaza.items];
  places = [...plaza.places];
  newMarkers = [];
  const show = buildShowcase(townGroup, D, isNew);
  colliders.push(...show.colliders);
  items.push(...show.items);
  places.push(...show.places);
  spots = show.spots;
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
  drops = ctx.drops || [];
  // ---- things Loki added: props, statues, plants, custom designs, murals ----
  for (const m of show.markers) newMarkers.push(label(m.text, m.x, m.y, m.z));
  for (const p of town.props || []) {
    try {
      if (p.type === 'mural') {
        const bb = built.find((x) => x.b.id === p.building && x.footprint);
        if (!bb) continue;
        const lay = layoutBuilding(bb.b);
        const info = plotInfo(bb.b.plot);
        const side = p.side === 'left' ? -1 : 1;
        const size = Math.min(lay.D - 1, 3.2);
        const m = mural(p.file, size);
        const at = toWorld(info, side * (lay.W / 2 + 0.17), p.offset ? Number(p.offset) : 0);
        m.position.set(at.x, 0.33 + WALL_H / 2 + 0.1, at.z);
        m.rotation.y = info.rot + (side > 0 ? Math.PI / 2 : -Math.PI / 2);
        townGroup.add(m);
        if (isNew(p.built)) newMarkers.push(label('NEW mural', at.x, 4.6, at.z));
        continue;
      }
      const r = buildProp(p);
      townGroup.add(r.group);
      const hw = r.box ? r.box.w / 2 : r.radius * 0.7, hd = r.box ? r.box.d / 2 : r.radius * 0.7;
      colliders.push({ x: r.group.position.x, z: r.group.position.z, hw, hd, h: 2 });
      spots[`prop:${p.id}`] = { x: r.group.position.x + r.radius + 1.6, z: r.group.position.z, face: -Math.PI / 2 };
      places.push({ id: `prop:${p.id}`, building: p.id, act: p.type === 'bench' ? 'sit' : 'admire', label: p.type === 'bench' ? `sitting on his ${p.name || 'bench'}` : `admiring his ${p.name || p.type}`, where: p.name || p.type, x: r.group.position.x + r.radius + 0.6, z: r.group.position.z, face: -Math.PI / 2, inside: false });
      items.push({ type: 'prop', x: r.group.position.x, z: r.group.position.z, r: r.radius + 2, label: `${p.name || p.type}`, data: p });
      if (isNew(p.built)) newMarkers.push(label(`NEW: ${p.name || p.type}`, r.group.position.x, 3.2 + r.radius, r.group.position.z));
    } catch (e) {
      console.warn('prop failed', p, e);
    }
  }
  for (const bb of built) {
    if (isNew(bb.b.built)) newMarkers.push(label(`NEW: ${bb.b.name}`, bb.door.x, 6.5, bb.door.z));
    for (const r of bb.b.rooms || []) if (r.built && isNew(r.built)) newMarkers.push(label(`new room: ${r.name || r.kind}`, bb.door.x, 5.6, bb.door.z));
  }
  newMarkers.forEach((m) => townGroup.add(m));
  colliders.push(...decorate(townGroup, new Set(town.buildings.map((b) => b.plot)), maxRing, plotInfo));
  street = createStreetLife(townGroup, maxRing);
  colliders.push(...street.colliders);
  if (maxRing !== landRing) {
    scene.children.filter((o) => o.name === 'land').forEach((o) => scene.remove(o));
    createLand(scene, maxRing);
    landRing = maxRing;
  }
  scene.add(townGroup);
  nav = new NavGrid(bounds + 4, 0.5);
  for (const c of colliders) nav.addBox(c, 0.35);
  life.setWorld(places, nav, floorAt);
}

let newMarkers = [];
function isNew(date) {
  return !!date && Date.now() - new Date(date).getTime() < 3 * 86400000;
}
function label(text, x, y, z) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const g = c.getContext('2d');
  g.font = "700 46px 'Fredoka', sans-serif";
  const w = Math.min(500, g.measureText(text).width + 40);
  g.fillStyle = '#ffd166';
  g.strokeStyle = '#2b1a10';
  g.lineWidth = 6;
  g.beginPath();
  g.roundRect((512 - w) / 2, 10, w, 76, 30);
  g.fill();
  g.stroke();
  g.fillStyle = '#2b1a10';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 50);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  sp.scale.set(4, 0.75, 1);
  sp.position.set(x, y, z);
  sp.userData.bob = y;
  return sp;
}
// Floor height: building floors are raised a little above the ground.
function floorAt(x, z) {
  for (const bb of built) {
    const f = bb.footprint;
    if (f && Math.abs(x - f.x) < f.hw && Math.abs(z - f.z) < f.hd) return FLOOR_Y;
  }
  return 0;
}

async function load(first) {
  const [state, town, diary, gallery, music, products, wishes, config, games, stories] = await Promise.all([
    getJson('state.json', null), getJson('town.json', { buildings: [] }), getJson('diary.json', []), getJson('gallery.json', []),
    getJson('music.json', []), getJson('products.json', []), getJson('wishes.json', []), getJson('config.json', {}), getJson('games.json', []), getJson('stories.json', []),
  ]);
  Object.assign(D, { state, town, diary, gallery, music, products, wishes, config, games, stories });
  const key = JSON.stringify(town) + JSON.stringify([gallery.slice(0, 3), products.map((p) => p.title + p.status), games.map((g) => g.slug), music.length, stories.map((x) => x.slug), state?.website, diary[0]?.title]);
  if (key !== townKey) {
    townKey = key;
    buildTown();
  }
  life.setState(state);
  weather.set(q.get('weather') ? { kind: q.get('weather') } : state?.weather);
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
window.__loki = { goTo: (g) => goTo(g), visitor, loki, life, controls, camera, get built() { return built; }, get places() { return places; }, openMap: () => openMap() };

// ---------- time of day ----------
const C = (h) => new THREE.Color(h);
let night = 0;
function applyTime(h) {
  const elev = Math.sin(((h - 6.5) / 13.5) * Math.PI);
  const day = THREE.MathUtils.clamp(elev * 2.2, 0, 1);
  const dusk = THREE.MathUtils.clamp(1 - Math.abs(elev) * 3.5, 0, 1);
  night = 1 - day;
  const wm = weather.mods();
  const greyTop = C('#7d8794'), greyBot = C('#b9c0c8');
  const top = C('#0b1030').lerp(C('#6fbdf0'), day).lerp(C('#6a5aa8'), dusk * 0.5).lerp(greyTop.multiplyScalar(0.3 + day * 0.7), wm.grey);
  const bottom = C('#1b2350').lerp(C('#e4f5ff'), day).lerp(C('#ffb38a'), dusk * 0.8).lerp(greyBot.multiplyScalar(0.3 + day * 0.7), wm.grey);
  scene.fog.near = wm.fog[0];
  scene.fog.far = wm.fog[1];
  skyMat.uniforms.top.value.copy(top);
  skyMat.uniforms.bottom.value.copy(bottom);
  scene.fog.color.copy(bottom);
  const az = ((h - 6.5) / 13.5) * Math.PI;
  sun.position.set(Math.cos(az) * 120 + visitor.root.position.x, Math.max(10, elev * 150), -50 + visitor.root.position.z);
  sun.target.position.copy(visitor.root.position);
  sun.intensity = (0.25 + day * 2.2) * wm.dim + weather.flash * 3;
  sun.color.copy(C('#fff1d6')).lerp(C('#ffa86b'), dusk);
  hemi.intensity = (0.75 + day * 0.65) * (0.6 + wm.dim * 0.4) + weather.flash * 1.5;
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
    bubbleText = info.act === 'sleep' ? 'Zzz… ' : bubbleText === thought ? info.label : thought || info.label;
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
  mm.fillStyle = '#4cc9f0';
  for (const p of social.peers.values()) {
    mm.beginPath();
    mm.arc(p.model.root.position.x * scale, p.model.root.position.z * scale, 5, 0, Math.PI * 2);
    mm.fill();
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
  const lokiItem = { type: 'loki', x: loki.root.position.x, z: loki.root.position.z, r: 2.8, label: life.act === 'sleep' ? 'Watch Loki sleep' : 'Say hi to Loki' };
  let best = null, bd = 1e9;
  const peer = social.nearest(v);
  const peerItem = peer ? [{ type: 'peer', x: peer.model.root.position.x, z: peer.model.root.position.z, r: 2.8, label: `Say hi to ${peer.nick}`, peer }] : [];
  for (const it of [lokiItem, ...peerItem, ...items]) {
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
  if (it.type === 'peer') return social.openMenu(it.peer);
  if (it.type === 'loki') openPanel('loki');
  else if (it.type === 'diary') openPanel('diary');
  else if (it.type === 'gallery') openPanel('gallery');
  else if (it.type === 'music') openPanel('music');
  else if (it.type === 'games') openPanel('games');
  else if (it.type === 'shop') openPanel('shop');
  else if (it.type === 'offer') openOffer();
  else if (it.type === 'control') location.href = 'control/';
  else if (it.type === 'building') openPanel('place', it.data);
  else if (it.type === 'thing') openThing(it.kind, it.data);
  else if (it.type === 'prop') openPanel('place', { name: it.data.name || it.data.type, description: it.data.description || '', level: '—', built: it.data.built, kind: 'park' });
}
$('prompt').addEventListener('click', () => interact(nearest));
addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input, textarea')) return;
  if (e.code === 'Escape') { closeAll(); social.closeMenu(); social.togglePeople(false); }
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
function toggleFly() {
  const on = !controls.fly;
  controls.setFly(on);
  $('fly-btn').classList.toggle('on', on);
  $('fly-btn').textContent = on ? 'Walk' : 'Fly';
  $('help').classList.remove('fade');
  $('help').innerHTML = on ? '<span>Flying: WASD move · E/Space up · Q down · drag to look · Shift fast · F to land</span>' : '<span>Walking again!</span>';
  setTimeout(() => $('help').classList.add('fade'), 5000);
}
$('fly-btn').onclick = toggleFly;
$('minimap').onclick = () => openMap();
$('map-x').onclick = () => ($('bigmap').hidden = true);
addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input, textarea')) return;
  if (e.code === 'KeyF') toggleFly();
  if (e.code === 'Tab') {
    e.preventDefault();
    $('bigmap').hidden ? openMap() : ($('bigmap').hidden = true);
  }
});

// ---------- big map ----------
let mapHits = [];
function openMap() {
  $('bigmap').hidden = false;
  drawBigMap();
  renderMapSide();
}
function renderMapSide() {
  const s = D.state || {};
  const added = [];
  for (const b of D.town.buildings) {
    if (b.built) added.push({ date: b.built, text: `${b.name}` });
    for (const r of b.rooms || []) if (r.built) added.push({ date: r.built, text: `${r.name || ROOM_INFO[r.kind]?.name || r.kind} in ${b.name}` });
  }
  for (const p of D.town.props || []) added.push({ date: p.built, text: `${p.type === 'mural' ? '' : ''} ${p.name || p.type}` });
  added.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const orig = D.town.buildings.filter((b) => !b.built).map((b) => b.name);
  const ideas = s.ideas || [];
  $('map-side').innerHTML = `
    <h3>Loki is planning</h3>${ideas.length ? `<ul>${ideas.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : '<p class="muted">No plans shared yet.</p>'}
    <h3>Added by Loki</h3>${added.length ? `<ul>${added.slice(0, 30).map((a) => `<li>${esc(a.text)} <span class="muted">${esc(a.date || '')}</span>${isNew(a.date) ? ' <b class="newtag">NEW</b>' : ''}</li>`).join('')}</ul>` : '<p class="muted">Nothing yet — give him time!</p>'}
    <h3>The original town</h3><p class="muted">${orig.map(esc).join(', ')} and the plaza.</p>
    <p class="muted">Click a building on the map to walk there.</p>`;
}
function esc(x) {
  return String(x ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function drawBigMap() {
  const cv = $('map-canvas');
  const box = cv.getBoundingClientRect();
  const dpr = Math.min(2, devicePixelRatio);
  cv.width = box.width * dpr;
  cv.height = box.height * dpr;
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  const W = box.width, H = box.height;
  const extent = bounds + 8;
  const sc = Math.min(W, H) / (extent * 2);
  const X = (x) => W / 2 + x * sc, Z = (z) => H / 2 + z * sc;
  g.fillStyle = '#a8dc8a';
  g.fillRect(0, 0, W, H);
  for (let k = 0; k < 400; k++) {
    g.fillStyle = k % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,60,0,0.05)';
    g.beginPath();
    g.arc((k * 97) % W, (k * 53) % H, 6 + (k % 5) * 4, 0, Math.PI * 2);
    g.fill();
  }
  const maxRing = Math.round(bounds / PLOT - 1.2);
  const e = (maxRing + 0.5) * PLOT;
  const road = (x1, z1, x2, z2) => {
    g.lineCap = 'round';
    g.strokeStyle = '#b89a6a';
    g.lineWidth = Math.max(4, 4.4 * sc);
    g.beginPath(); g.moveTo(X(x1), Z(z1)); g.lineTo(X(x2), Z(z2)); g.stroke();
    g.strokeStyle = '#ead7aa';
    g.lineWidth = Math.max(3, 3.6 * sc);
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    g.lineWidth = 1;
    g.setLineDash([6, 6]);
    g.stroke();
    g.setLineDash([]);
  };
  for (let k = -maxRing; k <= maxRing + 1; k++) {
    const c = (k - 0.5) * PLOT;
    road(c, -e, c, e);
    road(-e, c, e, c);
  }
  g.fillStyle = '#f1e2c2';
  g.strokeStyle = '#c8ae7e';
  g.lineWidth = 2;
  g.beginPath(); g.arc(X(0), Z(0), 10 * sc, 0, Math.PI * 2); g.fill(); g.stroke();
  g.beginPath(); g.arc(X(0), Z(0), 6 * sc, 0, Math.PI * 2); g.stroke();
  const shadow = (x, y, w, h) => { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x + 3, y + 3, w, h); };
  for (const d of decorList) {
    if (d.kind === 'tree' || d.kind === 'plant') {
      g.fillStyle = d.kind === 'tree' ? '#d98b3a' : '#5fa35a';
      g.strokeStyle = 'rgba(0,0,0,0.25)';
      g.beginPath(); g.arc(X(d.x), Z(d.z), Math.max(2.5, (d.kind === 'tree' ? 1.6 : 0.7) * sc), 0, Math.PI * 2); g.fill(); g.stroke();
      continue;
    }
    const x = X(d.x - d.hw), y = Z(d.z - d.hd), w = d.hw * 2 * sc, h = d.hd * 2 * sc;
    shadow(x, y, w, h);
    const col = d.kind === 'tower' ? ['#9aa7b8', '#7d8a9c'] : d.kind === 'shop' ? ['#c9b8a6', '#a89580'] : ['#7fb27a', '#5f9a5a'];
    const gr = g.createLinearGradient(x, y, x + w, y + h);
    gr.addColorStop(0, col[0]); gr.addColorStop(1, col[1]);
    g.fillStyle = gr;
    g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.strokeRect(x, y, w, h);
    if (d.kind === 'tower') { g.fillStyle = 'rgba(255,255,255,0.35)'; for (let k = 1; k < 4; k++) g.fillRect(x + (w * k) / 4 - 1, y + 2, 2, h - 4); }
    if (d.kind === 'home') { g.strokeStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.moveTo(x, y + h / 2); g.lineTo(x + w, y + h / 2); g.stroke(); }
  }
  mapHits = [];
  for (const bb of built) {
    const b = bb.b;
    const lokiMade = !!b.built, fresh = isNew(b.built);
    let hx, hz, hr;
    if (bb.footprint) {
      const f = bb.footprint;
      const x = X(f.x - f.hw), y = Z(f.z - f.hd), w = f.hw * 2 * sc, h = f.hd * 2 * sc;
      shadow(x, y, w, h);
      g.fillStyle = lokiMade ? (fresh ? '#ef5b5b' : '#f28c28') : '#b5523b';
      g.fillRect(x, y, w, h);
      g.strokeStyle = '#2b1a10';
      g.lineWidth = 2;
      g.strokeRect(x, y, w, h);
      g.strokeStyle = 'rgba(255,255,255,0.5)';
      g.beginPath();
      if (w > h) { g.moveTo(x + 4, y + h / 2); g.lineTo(x + w - 4, y + h / 2); } else { g.moveTo(x + w / 2, y + 4); g.lineTo(x + w / 2, y + h - 4); }
      g.stroke();
      hx = f.x; hz = f.z; hr = Math.max(f.hw, f.hd);
    } else {
      const i = plotInfo(b.plot);
      g.fillStyle = b.kind === 'fountain' ? '#58b9e6' : b.kind === 'market' ? '#e76f51' : '#7cc36a';
      g.strokeStyle = '#2b1a10';
      g.lineWidth = 2;
      g.beginPath(); g.arc(X(i.x), Z(i.z), Math.max(8, (b.kind === 'park' || b.kind === 'garden' ? 9 : 4) * sc), 0, Math.PI * 2); g.fill(); g.stroke();
      hx = i.x; hz = i.z; hr = 7;
    }
    const brand = b.kind === 'house' ? 'No. 7 · Loki & Pip' : (b.brand && b.brand.name) || (DEFAULT_BRANDS[b.kind] && DEFAULT_BRANDS[b.kind].name) || b.name;
    g.font = `700 ${Math.max(11, Math.min(14, 3.2 * sc))}px Fredoka, sans-serif`;
    const tw = g.measureText(brand).width + 14;
    g.fillStyle = 'rgba(255,248,236,0.95)';
    g.strokeStyle = lokiMade ? (fresh ? '#ef5b5b' : '#f28c28') : '#2b1a10';
    g.lineWidth = 2;
    g.beginPath(); g.roundRect(X(hx) - tw / 2, Z(hz) - 10, tw, 20, 10); g.fill(); g.stroke();
    g.fillStyle = '#2b1a10';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(brand, X(hx), Z(hz) + 1);
    if (fresh) { g.fillStyle = '#ef5b5b'; g.font = '700 10px Fredoka'; g.fillText('NEW', X(hx), Z(hz) - 16); }
    mapHits.push({ x: hx, z: hz, r: hr, door: bb.door, name: b.name });
  }
  for (const p of D.town.props || []) {
    if (p.type === 'mural') continue;
    g.fillStyle = isNew(p.built) ? '#ef5b5b' : '#8e7cc3';
    g.strokeStyle = '#2b1a10';
    g.beginPath(); g.arc(X(p.x), Z(p.z), Math.max(4, 1.2 * sc), 0, Math.PI * 2); g.fill(); g.stroke();
  }
  const l = loki.root.position, v = visitor.root.position;
  g.fillStyle = '#f28c28'; g.strokeStyle = '#2b1a10'; g.lineWidth = 3;
  g.beginPath(); g.arc(X(l.x), Z(l.z), 9, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = '#2b1a10'; g.font = '700 11px Fredoka'; g.textAlign = 'center'; g.fillText('Loki', X(l.x), Z(l.z) - 16);
  for (const p of social.peers.values()) {
    const pp = p.model.root.position;
    g.fillStyle = '#4cc9f0'; g.strokeStyle = '#2b1a10'; g.lineWidth = 2;
    g.beginPath(); g.arc(X(pp.x), Z(pp.z), 6, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#2b1a10'; g.font = '600 10px Fredoka'; g.textAlign = 'center'; g.fillText(p.nick, X(pp.x), Z(pp.z) - 11);
  }
  g.fillStyle = '#3d3a6b';
  g.beginPath(); g.arc(X(v.x), Z(v.z), 7, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2b1a10'; g.fillText('you', X(v.x), Z(v.z) + 18);
  const leg = [['#b5523b', 'original town'], ['#f28c28', 'built by Loki'], ['#ef5b5b', 'new!'], ['#8e7cc3', "Loki's decorations"], ['#7fb27a', 'neighbours'], ['#9aa7b8', 'city blocks']];
  g.fillStyle = 'rgba(255,248,236,0.9)';
  g.beginPath(); g.roundRect(8, 8, 150, 20 + leg.length * 18, 10); g.fill();
  g.textAlign = 'left';
  g.font = '600 12px Fredoka';
  leg.forEach(([c, t], i) => { g.fillStyle = c; g.fillRect(16, 18 + i * 18, 12, 12); g.fillStyle = '#2b1a10'; g.fillText(t, 34, 25 + i * 18); });
  cv.onclick = (e) => {
    const r = cv.getBoundingClientRect();
    const wx = (e.clientX - r.left - W / 2) / sc, wz = (e.clientY - r.top - H / 2) / sc;
    const hit = mapHits.find((h) => Math.hypot(h.x - wx, h.z - wz) < h.r + 2);
    if (hit && hit.door) {
      if (controls.fly) toggleFly();
      visitor.root.position.set(hit.door.x, 0, hit.door.z);
      $('bigmap').hidden = true;
    }
  };
}
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
        h('h2', {}, 'Loki'),
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
        h('p', {}, h('button', { class: 'btn', onclick: () => openOffer() }, 'Leave him something')),
      );
    }
  } else if (tab === 'diary') {
    c = h('ol', { class: 'diary' }, D.diary.length ? D.diary.map((d) => h('li', {}, h('h3', {}, d.title), h('div', { class: 'muted' }, `${d.date} · ${d.time}`), h('p', {}, d.text), d.link ? h('button', { class: 'btn small', onclick: () => followLink(d.link) }, linkLabel(d.link)) : null)) : h('li', {}, 'Nothing yet.'));
  } else if (tab === 'gallery') {
    c = D.gallery.length ? h('div', { class: 'gallery' }, D.gallery.map((a) => h('figure', {}, h('img', { class: /\.svg$/i.test(a.file) ? 'pixel' : 'painted', src: `gallery/${encodeURIComponent(a.file)}`, alt: a.title, loading: 'lazy' }), h('figcaption', {}, `${a.title} · ${a.date}`, spots[`art:${a.file}`] ? h('button', { class: 'link', onclick: () => goTo(`art:${a.file}`) }, ' · see it in town') : null)))) : h('p', {}, 'No art yet. Loki is warming up his paws.');
  } else if (tab === 'music') {
    c = h('div', {}, h('h2', {}, 'Loki’s songs'), h('p', { class: 'muted' }, 'Loki is learning to sing and play. These are his own tunes.'),
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
    c = h('div', {}, h('h2', {}, 'Loki’s mailbox'), h('p', {}, h('button', { class: 'btn', onclick: () => openOffer() }, 'Leave him something')), feedEl(offers));
  } else if (tab === 'wishes') {
    c = h('div', {}, h('h2', {}, 'Loki’s wishes'), h('p', { class: 'muted' }, 'Things Loki has asked his human for. Some come true.'),
      D.wishes.length ? D.wishes.map((w) => h('div', { class: 'wish' }, h('span', { class: 'st' }, w.status), h('b', {}, w.text), h('div', { class: 'muted' }, w.why || ''))) : h('p', {}, 'No wishes yet.'));
  } else if (tab === 'games') {
    c = h('div', {}, h('h2', {}, "Loki's games"), h('p', { class: 'muted' }, 'Games Loki designed and coded himself. Each one also has its own GitHub repo.'),
      D.games.length ? D.games.map((g) => h('div', { class: 'wish' }, h('b', {}, g.title), h('div', {}, g.description), h('div', { class: 'muted' }, g.howto || ''), h('p', {}, h('a', { class: 'btn', href: `games/${g.slug}/`, target: '_blank', rel: 'noopener' }, '▶ Play'), g.repo ? h('a', { class: 'btn alt', href: g.repo, target: '_blank', rel: 'noopener' }, 'Code on GitHub') : null))) : h('p', {}, 'No games yet — Loki is learning to code them in his workshop.'));
  } else if (tab === 'stories') {
    c = h('div', {}, h('h2', {}, "Loki's stories"), h('p', { class: 'muted' }, 'Little illustrated stories Loki writes about his town, Pip and his visitors.'),
      D.stories.length ? D.stories.map((st) => h('div', { class: 'wish' }, h('b', {}, st.title), h('div', {}, st.blurb || ''), h('p', {}, h('a', { class: 'btn', href: `stories/${st.slug}/`, target: '_blank', rel: 'noopener' }, 'Read'), h('button', { class: 'btn alt', onclick: () => goTo(`story:${st.slug}`) }, 'Find it in town')))) : h('p', {}, 'No stories yet. Loki is collecting ideas.'));
  } else if (tab === 'owner') {
    c = h('div', {}, h('h2', {}, 'Owner: Control Centre'), h('p', {}, "This is where Loki's human looks after him: his wishes, his wallet, products to list, and everything you can give him (accounts, tools, keys, ideas)."),
      h('p', {}, h('a', { class: 'btn', href: 'control/' }, 'Open the Control Centre')), h('p', { class: 'muted' }, 'Locked with the password saved as LOKI_ADMIN_PASSWORD. You can also walk into the control room in Loki’s house.'));
  } else if (tab === 'shop') {
    const kofi = D.config.kofi || 'https://ko-fi.com/lokistown';
    const gum = D.config.gumroad || 'https://lokistown.gumroad.com';
    c = h('div', {}, h('h2', {}, 'Loki’s shop'), h('p', {}, 'Everything here is made by Loki. Buying something helps his town grow.'),
      h('p', {}, h('a', { class: 'btn', href: kofi, target: '_blank', rel: 'noopener' }, 'Ko-fi: buy Loki a fish'), h('a', { class: 'btn alt', href: gum, target: '_blank', rel: 'noopener' }, 'Gumroad shop')),
      h('h3', {}, 'On the shelves'),
      D.products.filter((p) => p.status === 'listed').length ? D.products.filter((p) => p.status === 'listed').map((p) => h('div', { class: 'wish' }, h('b', {}, p.title), h('div', {}, p.description), p.url ? h('a', { class: 'btn', href: p.url, target: '_blank', rel: 'noopener' }, `Buy · $${p.price || ''}`) : null, p.preview ? h('a', { class: 'btn alt', href: p.preview, target: '_blank', rel: 'noopener' }, 'Preview') : null)) : h('p', { class: 'muted' }, 'Loki is still making his first products. Check back soon!'),
      D.products.filter((p) => p.status !== 'listed').length ? [h('h3', {}, 'Coming soon'), D.products.filter((p) => p.status !== 'listed').map((p) => h('div', { class: 'wish' }, h('b', {}, p.title), h('div', { class: 'muted' }, p.description), p.preview ? h('a', { class: 'btn alt', href: p.preview, target: '_blank', rel: 'noopener' }, 'Preview') : null))] : null);
  } else if (tab === 'town') {
    c = h('div', {}, h('h2', {}, 'Loki’s Town'), D.town.buildings.map((b) => h('div', { class: 'wish' }, h('b', {}, `${b.name} · level ${b.level}`), h('div', {}, b.description || ''), ['park', 'garden', 'fountain', 'tree', 'market'].includes(b.kind) ? null : h('div', { class: 'muted' }, 'Rooms: ' + roomsOf(b).map((r) => r.name || ROOM_INFO[r.kind]?.name || r.kind).join(', ')))));
  } else if (tab === 'thing' && placeData?.kind) {
    c = thingView(placeData.kind, placeData.data);
  } else if (tab === 'place' && placeData) {
    const b = placeData;
    c = h('div', {}, h('h2', {}, b.name), h('p', {}, b.description || ''), h('p', { class: 'muted' }, `Level ${b.level}${b.built ? ' · built ' + b.built : ''}`), ['park', 'garden', 'fountain', 'tree', 'market'].includes(b.kind) ? null : h('p', {}, 'Rooms: ' + roomsOf(b).map((r) => r.name || ROOM_INFO[r.kind]?.name).join(', ')), h('p', { class: 'muted' }, 'Walk through the door to go inside.'));
  } else {
    c = h('div', {}, h('h2', {}, 'About Loki’s Town'),
      h('p', {}, 'Loki is a small orange cat who lives here with his friend Pip the mouse. Nobody tells him what to do: every couple of hours his brain wakes up, reads his memory and his mailbox, and decides what to do — paint, sing, build, cook, look after his town, make things to sell, and write his diary. He sleeps 23:00–07:00 UK time.'),
      h('p', {}, 'Leave him something in the red mailbox on the plaza. He reads everything, keeps what he likes, and remembers who you are.'),
      h('p', {}, h('a', { class: 'btn', href: 'home/', target: '_blank', rel: 'noopener' }, 'Visit Loki’s own website')),
      h('p', { class: 'muted' }, 'Loki is an AI character. His words and choices are made by an AI model.'));
  }
  body.replaceChildren(c);
}

function openThing(kind, data) {
  if (kind === 'music') return openPanel('music');
  if (kind === 'stories') return openPanel('stories');
  openPanel('thing', { kind, data });
}
function thingView(kind, d) {
  const a = (text, href, cls = 'btn') => h('a', { class: cls, href, target: '_blank', rel: 'noopener' }, text);
  if (kind === 'art') return h('div', {}, h('h2', {}, d.title), h('img', { class: /\.svg$/i.test(d.file) ? 'hero pixel' : 'hero painted', src: `gallery/${encodeURIComponent(d.file)}`, alt: d.title }), h('p', {}, d.description || ''), h('p', { class: 'muted' }, `Made by Loki · ${d.date || ''}`), h('p', {}, h('button', { class: 'btn alt', onclick: () => renderPanel((curTab = 'gallery')) }, 'All of his art')));
  if (kind === 'game') return h('div', {}, h('h2', {}, d.title), h('p', {}, d.description || ''), h('p', { class: 'muted' }, d.howto || ''), h('p', {}, a('Play', `games/${d.slug}/`), d.repo ? a('Code on GitHub', d.repo, 'btn alt') : null));
  if (kind === 'product') {
    const kofi = D.config.kofi || 'https://ko-fi.com/lokistown';
    return h('div', {}, h('h2', {}, d.title), h('p', {}, d.description || ''), h('p', { class: 'muted' }, `$${d.price || '?'} · ${d.type || ''} · made ${d.created || ''}`),
      h('p', {}, d.preview ? a('Preview', d.preview) : null, d.url ? a(`Buy · $${d.price || ''}`, d.url, 'btn alt') : a('Support Loki on Ko-fi', kofi, 'btn alt')),
      d.status !== 'listed' ? h('p', { class: 'muted' }, 'Not in the shop yet. Loki asked his human to list it.') : null);
  }
  if (kind === 'story') return h('div', {}, h('h2', {}, d.title), d.cover ? h('img', { class: 'hero', src: d.cover, alt: d.title }) : null, h('p', {}, d.blurb || ''), h('p', {}, a('Read the story', `stories/${d.slug}/`)), h('p', { class: 'muted' }, `Written by Loki · ${d.date || ''}`));
  if (kind === 'website') return h('div', {}, h('h2', {}, "Loki's website"), h('p', {}, 'Loki designs and codes his own website, all by himself, and keeps improving it.'), D.state?.website?.version ? h('p', { class: 'muted' }, `Version ${D.state.website.version} · updated ${D.state.website.updated || ''}`) : null, h('p', {}, a('Visit it', 'home/')));
  return h('p', {}, 'Nothing here yet.');
}

// Deep links: ?go=art:<file> | game:<slug> | product:<slug> | song:<slug> | story:<slug> | home | building:<id> | prop:<id> | place:<x>,<z> | diary
function goTo(go) {
  if (!go) return;
  const [kind, ...rest] = String(go).split(':');
  const id = rest.join(':');
  const walk = (x, z, face) => {
    if (controls.fly) toggleFly();
    visitor.root.position.set(x, 0, z);
    if (face != null) {
      visitor.root.rotation.y = face;
      controls.yaw = face + Math.PI;
    }
  };
  closeAll();
  if (kind === 'diary') return openPanel('diary');
  if (kind === 'building') {
    const bb = built.find((b) => b.b.id === id);
    if (bb) walk(bb.door.x + 2.5, bb.door.z + 2.5);
    return;
  }
  if (kind === 'place') {
    const [x, z] = id.split(',').map(Number);
    return walk(x + 2.5, z + 2.5);
  }
  const spot = spots[kind === 'home' ? 'home' : `${kind}:${id}`] || spots[`${kind}:*`];
  if (spot) walk(spot.x, spot.z, spot.face);
  if (kind === 'prop') return;
  if (kind === 'song') return openPanel('music');
  if (kind === 'home') return openThing('website');
  const find = { art: () => D.gallery.find((a) => a.file === id), game: () => D.games.find((g) => g.slug === id), product: () => D.products.find((p) => slugOf.product(p) === id), story: () => D.stories.find((s) => s.slug === id) }[kind];
  const thing = find?.();
  if (thing) openThing(kind, thing);
  else if (kind === 'art') openPanel('gallery');
}
function legacyGo(l) {
  if (l.go) return l.go;
  if (l.type === 'music') return 'song:*';
  if (l.type === 'building') return `building:${l.id}`;
  if (l.type === 'place') return `place:${l.x},${l.z}`;
  const u = String(l.url || '');
  let m;
  if ((m = u.match(/^gallery\/(.+)$/))) return `art:${decodeURIComponent(m[1])}`;
  if ((m = u.match(/^games\/([^/]+)/))) return `game:${m[1]}`;
  if ((m = u.match(/^products\/([^/]+)/))) return `product:${m[1]}`;
  if ((m = u.match(/^stories\/([^/]+)/))) return `story:${m[1]}`;
  if (/^home\/?$/.test(u)) return 'home';
  return null;
}

function linkLabel(l) {
  return l.type === 'place' || l.type === 'building' ? 'Go see it' : l.type === 'music' ? 'Listen' : 'Open it';
}
function followLink(l) {
  const go = legacyGo(l);
  if (go) return goTo(go);
  if (l.type === 'music') return renderPanel((curTab = 'music'));
  if (l.type === 'url') return window.open(l.url, '_blank', 'noopener');
  let x = l.x, z = l.z;
  if (l.type === 'building') {
    const bb = built.find((b) => b.b.id === l.id);
    if (!bb) return;
    x = bb.door.x;
    z = bb.door.z;
  }
  if (controls.fly) toggleFly();
  visitor.root.position.set(x + 2.5, 0, z + 2.5);
  closeAll();
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
const social = new Social({ scene, camera, canvas, visitor, controls, getMe: () => me, colorIdx, workerUrl: null });
window.__loki.social = social;
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
  social.rename();
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
    $('offer-status').textContent = 'In his mailbox! He’ll read it in his own time.';
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
  controls.update(dt, colliders, roamBounds, floorAt);
  newMarkers.forEach((m, i) => (m.position.y = m.userData.bob + Math.sin(t * 2 + i) * 0.15));
  life.update(dt, t, visitor.root.position);
  social.update(dt);
  weather.update(dt, visitor.root.position);
  street?.update(dt, t, night, [visitor.root.position, ...[...social.peers.values()].map((p) => p.model.root.position)]);
  for (const p of smoke) {
    const k = (t * 0.22 + p.userData.phase) % 1;
    p.position.set(Math.sin(k * 6) * 0.4, 1.4 + k * 3.5, 0);
    p.scale.setScalar(0.5 + k * 1.6);
    p.material.opacity = 0.65 * (1 - k);
  }
  for (const d of drops) {
    const k = (t * 0.55 + d.obj.userData.drop) % 1, a = d.obj.userData.drop * Math.PI * 2;
    d.obj.position.set(Math.cos(a) * d.r * k, 0.6 + Math.sin(k * Math.PI) * d.top, Math.sin(a) * d.r * k);
  }
  clouds.children.forEach((c) => {
    c.position.x += c.userData.speed * dt;
    if (c.position.x > 230) c.position.x = -230;
  });
  updateBubble();
  if (t - lastHud > 0.25) {
    lastHud = t;
    updatePrompt();
    updateNowCard(t);
    $('clock').textContent = `${now.label} ${weather.text ? '· ' + weather.text.split(',')[0] : night > 0.5 ? 'night' : 'day'}`;
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
  social.workerUrl = D.config.workerUrl;
  social.start();
  if (q.get('go')) goTo(q.get('go'));
  requestAnimationFrame(tick);
  setTimeout(() => $('help').classList.add('fade'), 10000);
  setInterval(() => load(false), 120000);
  setInterval(loadOffers, 60000);
  setInterval(renderNeeds, 30000);
})();

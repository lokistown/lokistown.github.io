// Loki's Town — a walkable 3D world built from Loki's own data.
import * as THREE from 'three';
import { createGround, createPlaza, createRoads, buildBuilding, plotInfo, ensurePlots, noticeBoard, artWall, glass, bulb, PLOT, rng, mesh, mat } from './world.js';
import { createLoki } from './loki.js';
import { createVisitor, Controls } from './player.js';

const $ = (id) => document.getElementById(id);
const canvas = $('world');

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 600);
scene.fog = new THREE.Fog('#bfe6ff', 70, 230);

const hemi = new THREE.HemisphereLight('#dff3ff', '#7cbf6a', 1.1);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff1d6', 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera;
sc.left = sc.bottom = -70;
sc.right = sc.top = 70;
sc.near = 1;
sc.far = 260;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.04;
scene.add(sun, sun.target);

// stars
const starGeo = new THREE.BufferGeometry();
const sp = [];
const sr = rng('stars');
for (let i = 0; i < 700; i++) {
  const a = sr() * Math.PI * 2, e = 0.12 + sr() * 1.3, R = 400;
  sp.push(Math.cos(a) * Math.cos(e) * R, Math.sin(e) * R, Math.sin(a) * Math.cos(e) * R);
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, fog: false }));
scene.add(stars);

// moon / sun discs
const moon = new THREE.Mesh(new THREE.SphereGeometry(8, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff6d5', fog: false }));
scene.add(moon);

// clouds
const clouds = new THREE.Group();
const cr = rng('clouds');
for (let i = 0; i < 14; i++) {
  const c = new THREE.Group();
  for (let k = 0; k < 4; k++) {
    const p = mesh(new THREE.IcosahedronGeometry(3 + cr() * 3, 0), mat('#ffffff', { roughness: 1 }), { cast: false, receive: false });
    p.position.set(k * 4 - 6, cr() * 2, cr() * 3);
    c.add(p);
  }
  c.position.set((cr() - 0.5) * 300, 45 + cr() * 25, (cr() - 0.5) * 300);
  c.userData.speed = 0.6 + cr();
  clouds.add(c);
}
scene.add(clouds);

createGround(scene);
const { lamps } = createPlaza(scene);

// ---------- town (rebuilt whenever Loki changes it) ----------
let townGroup = null;
let spots = {};
let colliders = [];
let interactables = [];
let animated = [];
let townKey = '';
let bounds = PLOT * 4.3;

function toWorld(info, lx, lz) {
  const c = Math.cos(info.rot), s = Math.sin(info.rot);
  return new THREE.Vector3(info.x + lx * c + lz * s, 0, info.z - lx * s + lz * c);
}

function buildTown(town, diary, gallery) {
  if (townGroup) scene.remove(townGroup);
  townGroup = new THREE.Group();
  spots = {};
  colliders = [];
  interactables = [];
  animated = [];
  ensurePlots(town);
  const maxRing = Math.max(1, ...town.buildings.map((b) => plotInfo(b.plot).ring));
  bounds = (maxRing + 1.3) * PLOT;
  createRoads(townGroup, maxRing);

  for (const b of town.buildings) {
    const info = plotInfo(b.plot);
    const res = buildBuilding(b);
    res.group.position.set(info.x, 0, info.z);
    res.group.rotation.y = info.rot;
    res.group.traverse((o) => (o.userData.building = b.id));
    townGroup.add(res.group);
    if (res.group.userData.smoke) animated.push(...res.group.userData.smoke.map((p) => ({ type: 'smoke', p, base: p.position.clone() })));
    if (res.group.userData.jet) animated.push({ type: 'jet', p: res.group.userData.jet });
    // path from the door toward the road
    const path = mesh(new THREE.BoxGeometry(2, 0.1, PLOT / 2 - res.d / 2 + 0.5), mat('#e9d3a8'), { cast: false });
    const plen = PLOT / 2 - res.d / 2 + 0.5;
    const pc = toWorld(info, 0, res.d / 2 + plen / 2);
    path.position.set(pc.x, 0.04, pc.z);
    path.rotation.y = info.rot;
    townGroup.add(path);

    const door = toWorld(info, 0, res.front);
    spots[b.id] = { pos: door, name: b.name, building: b };
    if (res.group.userData.bed) {
      const bp = res.group.userData.bed;
      spots.bed = { pos: toWorld(info, bp.x, bp.z), name: `${b.name} (bed)` };
    }
    if (!res.walkable && res.w > 0) {
      const sideways = Math.abs(info.dx) > 0;
      colliders.push({ x: info.x, z: info.z, hw: (sideways ? res.d : res.w) / 2, hd: (sideways ? res.w : res.d) / 2 });
    }
    interactables.push({ type: 'building', pos: door, r: 3.2, label: `Look at ${b.name}`, data: b });

    if (b.kind === 'gallery') {
      const wall = artWall(gallery.slice(0, 4));
      const wl = toWorld(info, res.w / 2 + 1.6, 0);
      wall.group.position.set(wl.x, 0, wl.z);
      wall.group.rotation.y = info.rot + Math.PI / 2;
      townGroup.add(wall.group);
      const sideways = Math.abs(Math.sin(info.rot + Math.PI / 2)) > 0.5;
      colliders.push({ x: wl.x, z: wl.z, hw: (sideways ? 0.4 : wall.w) / 2, hd: (sideways ? wall.w : 0.4) / 2 });
      const front = toWorld(info, res.w / 2 + 3.5, 0);
      interactables.push({ type: 'gallery', pos: front, r: 3.5, label: "See Loki's gallery" });
    }
    if (b.kind === 'market') interactables.push({ type: 'shop', pos: door, r: 3.6, label: "Visit Loki's shop" });
  }

  // diary notice board on the plaza
  const nb = noticeBoard(diary[0]);
  nb.position.set(0, 0, -4.2);
  townGroup.add(nb);
  colliders.push({ x: 0, z: -4.2, hw: 2, hd: 0.3 });
  interactables.push({ type: 'diary', pos: new THREE.Vector3(0, 0, -2.6), r: 3, label: "Read Loki's diary" });
  spots.square = { pos: new THREE.Vector3(2.5, 0, 1.5), name: 'the plaza' };

  scene.add(townGroup);
}

// ---------- Loki + visitor ----------
const loki = createLoki();
scene.add(loki.root);
const lokiCtl = { target: new THREE.Vector3(), waypoint: new THREE.Vector3(), nextWander: 0, mode: 'idle', placed: false };

const visitor = createVisitor();
visitor.root.position.set(0, 0, 3.5);
visitor.root.rotation.y = Math.PI;
scene.add(visitor.root);
const controls = new Controls(canvas, camera, visitor);
window.__loki = { visitor, loki, controls, camera }; // handy for debugging in the console

// ---------- data ----------
let state = null, diary = [], gallery = [], town = { buildings: [] };

async function getJson(name, fallback) {
  try {
    const r = await fetch(`data/${name}?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    return await r.json();
  } catch {
    return fallback;
  }
}

async function load() {
  const [s, t, d, g] = await Promise.all([getJson('state.json', null), getJson('town.json', { buildings: [] }), getJson('diary.json', []), getJson('gallery.json', [])]);
  state = s;
  diary = d;
  gallery = g;
  town = t;
  const key = JSON.stringify(t) + '|' + (d[0] && d[0].title) + '|' + (g[0] && g[0].file);
  if (key !== townKey) {
    townKey = key;
    buildTown(town, diary, gallery);
  }
  renderHud();
  if (panelOpen) renderPanel(currentTab);
}

function lokiSpot() {
  if (!state) return spots.house || spots.square;
  if (state.asleep) return spots.bed || spots.house || spots.square;
  return spots[state.location] || spots.square;
}

// ---------- time of day (real UK time) ----------
function ukTime() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { h: Number(p.hour) + Number(p.minute) / 60, label: `${p.hour}:${p.minute}` };
}
const C = (h) => new THREE.Color(h);
const SKY = { day: C('#9fd8f5'), dusk: C('#f3a37f'), night: C('#0d1330') };
let nightness = 0;
let timeOverride = null; // for testing: ?hour=21

function applyTime(h) {
  // sun elevation: 0 at 6:30 and 19:30, peak at 13:00
  const elev = Math.sin(((h - 6.5) / 13) * Math.PI);
  const az = ((h - 6.5) / 13) * Math.PI;
  const day = THREE.MathUtils.clamp(elev * 2.2, 0, 1);
  const duskAmt = THREE.MathUtils.clamp(1 - Math.abs(elev) * 4, 0, 1);
  nightness = 1 - day;
  const sky = SKY.night.clone().lerp(SKY.day, day).lerp(SKY.dusk, duskAmt * 0.7);
  scene.background = sky;
  scene.fog.color.copy(sky);
  sun.position.set(Math.cos(az) * 120, Math.max(8, elev * 140), -60 + Math.sin(az) * 20);
  sun.intensity = 0.15 + day * 2.1;
  sun.color.copy(C('#fff1d6')).lerp(C('#ffb27a'), duskAmt);
  hemi.intensity = 0.6 + day * 0.6;
  hemi.color.copy(C('#7f8fd6')).lerp(C('#dff3ff'), day);
  stars.material.opacity = THREE.MathUtils.clamp(nightness * 1.2 - 0.2, 0, 1);
  stars.visible = stars.material.opacity > 0.01;
  moon.visible = nightness > 0.4;
  moon.position.set(-120, 110, -160);
  glass.emissiveIntensity = THREE.MathUtils.clamp((nightness - 0.3) * 2, 0, 1.4);
  bulb.emissiveIntensity = glass.emissiveIntensity * 1.6;
  lamps.forEach((l) => (l.intensity = glass.emissiveIntensity * 25));
  renderer.toneMappingExposure = 0.9 + day * 0.2;
}

// ---------- HUD / UI ----------
const bubble = $('bubble');
const prompt = $('prompt');
let nearest = null;
let panelOpen = false;
let currentTab = 'loki';

function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k === 'style') e.style.cssText = v;
    else e[k] = v;
  }
  for (const k of kids) if (k != null) e.append(k);
  return e;
}

function renderHud() {
  const where = lokiSpot();
  $('loki-where').textContent = state ? (state.asleep ? `Loki is asleep at ${where ? where.name : 'home'}` : `Loki is at ${where ? where.name : 'the plaza'}`) : 'Loki is somewhere…';
}

function openPanel(tab, extra) {
  panelOpen = true;
  currentTab = tab;
  controls.enabled = false;
  $('panel').hidden = false;
  renderPanel(tab, extra);
}
function closePanel() {
  panelOpen = false;
  controls.enabled = true;
  $('panel').hidden = true;
}
$('panel-close').addEventListener('click', closePanel);
$('menu-btn').addEventListener('click', () => (panelOpen ? closePanel() : openPanel('loki')));
document.querySelectorAll('#panel nav button').forEach((b) => b.addEventListener('click', () => renderPanel((currentTab = b.dataset.tab))));
addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && panelOpen) closePanel();
  else if ((e.code === 'KeyE' || e.code === 'Enter') && !panelOpen && nearest) interact(nearest);
  else if (e.code === 'KeyM' || e.code === 'Tab') {
    e.preventDefault();
    panelOpen ? closePanel() : openPanel('loki');
  }
});
prompt.addEventListener('click', () => nearest && interact(nearest));

function interact(it) {
  if (it.type === 'loki') openPanel('loki');
  else if (it.type === 'diary') openPanel('diary');
  else if (it.type === 'gallery') openPanel('gallery');
  else if (it.type === 'shop') openPanel('shop');
  else if (it.type === 'building') openPanel('place', it.data);
}

function renderPanel(tab, extra) {
  document.querySelectorAll('#panel nav button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
  const body = $('panel-body');
  let content;
  if (tab === 'loki') {
    if (!state) content = el('p', { textContent: 'Loki is still on his way…' });
    else {
      const prev = (state.level - 1) ** 2 * 10;
      const pct = Math.max(0, Math.min(100, ((state.xp - prev) / (state.nextLevelXp - prev)) * 100));
      content = el(
        'div',
        {},
        el('h2', { textContent: 'Loki' }),
        el('p', { class: 'quote', textContent: `“${state.thought}”` }),
        el('dl', {},
          el('dt', { textContent: 'Doing' }), el('dd', { textContent: state.asleep ? `asleep — ${state.activity}` : state.activity }),
          el('dt', { textContent: 'Mood' }), el('dd', { textContent: state.mood }),
          el('dt', { textContent: 'Level' }), el('dd', {}, `${state.level} · ${state.stage} `, el('span', { class: 'bar' }, el('span', { style: `width:${pct}%` })), ` ${state.xp}/${state.nextLevelXp} XP`),
          el('dt', { textContent: 'Has done' }), el('dd', { textContent: `${state.tasksDone} things in ${state.sessions} work sessions` }),
          el('dt', { textContent: 'Skills' }), el('dd', { textContent: state.skills.length ? state.skills.map((s) => s.name).join(', ') : 'none yet' }),
        ),
        state.recent && state.recent.length ? el('div', {}, el('h3', { textContent: 'Lately' }), el('ul', {}, ...state.recent.slice(0, 6).map((r) => el('li', { textContent: `${r.time} — ${r.text}` })))) : null,
        el('p', { class: 'muted', textContent: 'Leaving Loki a message is coming soon.' }),
      );
    }
  } else if (tab === 'diary') {
    content = el('ol', { class: 'diary' }, ...(diary.length ? diary.map((d) => el('li', {}, el('h3', { textContent: d.title }), el('div', { class: 'muted', textContent: `${d.date} · ${d.time}` }), el('p', { textContent: d.text }))) : [el('li', { textContent: 'Nothing yet.' })]));
  } else if (tab === 'gallery') {
    content = gallery.length
      ? el('div', { class: 'gallery' }, ...gallery.map((a) => el('figure', {}, el('img', { src: `gallery/${encodeURIComponent(a.file)}`, alt: a.title, loading: 'lazy' }), el('figcaption', { textContent: `${a.title} · ${a.date}` }))))
      : el('p', { textContent: 'No art yet. Loki is warming up his paws.' });
  } else if (tab === 'town') {
    content = el('ul', { class: 'places' }, ...town.buildings.map((b) => el('li', {}, el('strong', { textContent: b.name }), ` · level ${b.level} — ${b.description || ''}`)));
  } else if (tab === 'shop') {
    content = el(
      'div',
      {},
      el('h2', { textContent: "Loki's shop" }),
      el('p', { textContent: 'Loki is preparing his first art packs, printables and templates. Until then you can buy him a fish:' }),
      el('p', {}, el('a', { class: 'btn', href: 'https://ko-fi.com/lokistown', target: '_blank', rel: 'noopener', textContent: 'Support Loki on Ko-fi' })),
    );
  } else if (tab === 'place' && extra) {
    content = el('div', {}, el('h2', { textContent: extra.name }), el('p', { textContent: extra.description || '' }), el('p', { class: 'muted', textContent: `Level ${extra.level}${extra.built ? ` · built ${extra.built}` : ''}` }));
  } else if (tab === 'about') {
    content = el(
      'div',
      {},
      el('h2', { textContent: "About Loki's Town" }),
      el('p', { textContent: 'Loki is a small orange cat who lives here and decides everything himself. Every couple of hours he wakes up, thinks, and gets to work: building his town, painting, learning and writing in his diary. He sleeps from 23:00 to 07:00 UK time.' }),
      el('p', { textContent: 'Walk around to find him. The town grows as he builds it.' }),
      el('p', { class: 'muted', textContent: 'Loki is an AI character; his words are written by an AI model.' }),
    );
  }
  body.replaceChildren(content || el('p', { textContent: '' }));
}

// ---------- loop ----------
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

const clock = new THREE.Clock();
const tmp = new THREE.Vector3();
let lastHud = 0;

function updateLoki(dt, t) {
  const spot = lokiSpot();
  if (!spot) return;
  const asleep = state && state.asleep;
  if (!lokiCtl.placed) {
    loki.root.position.copy(spot.pos);
    lokiCtl.waypoint.copy(spot.pos);
    lokiCtl.placed = true;
  }
  if (!lokiCtl.target.equals(spot.pos)) {
    lokiCtl.target.copy(spot.pos);
    lokiCtl.waypoint.copy(spot.pos);
    lokiCtl.nextWander = t + 10;
  }
  if (!asleep && t > lokiCtl.nextWander) {
    const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 2.5;
    lokiCtl.waypoint.set(lokiCtl.target.x + Math.cos(a) * r, 0, lokiCtl.target.z + Math.sin(a) * r);
    lokiCtl.nextWander = t + 8 + Math.random() * 10;
    lokiCtl.mode = Math.random() < 0.45 ? 'sit' : 'idle';
  }
  const pos = loki.root.position;
  tmp.subVectors(lokiCtl.waypoint, pos);
  tmp.y = 0;
  const dist = tmp.length();
  const moving = dist > 0.15;
  if (moving) {
    const speed = dist > 25 ? 6 : 1.8;
    tmp.normalize();
    pos.addScaledVector(tmp, Math.min(dist, speed * dt));
    const target = Math.atan2(tmp.x, tmp.z);
    let diff = target - loki.root.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    loki.root.rotation.y += diff * Math.min(1, dt * 6);
    for (const c of colliders) {
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const ox = c.hw + 0.6 - Math.abs(dx), oz = c.hd + 0.6 - Math.abs(dz);
      if (ox > 0 && oz > 0) ox < oz ? (pos.x += Math.sign(dx || 1) * ox) : (pos.z += Math.sign(dz || 1) * oz);
    }
  } else if (moving === false && !asleep) {
    // look at the visitor if they come close
    tmp.subVectors(visitor.root.position, pos);
    if (tmp.length() < 6) {
      const target = Math.atan2(tmp.x, tmp.z);
      let diff = target - loki.root.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      loki.root.rotation.y += diff * Math.min(1, dt * 3);
    }
  }
  const mode = asleep && !moving ? 'sleep' : moving ? 'walk' : lokiCtl.mode;
  if (asleep && !moving) pos.y = 0.25;
  else pos.y = 0;
  loki.animate(dt, mode, moving);
}

let bubbleText = '', bubbleSwap = 0;
function updateBubble(t) {
  if (!state) return (bubble.hidden = true);
  if (t > bubbleSwap) {
    bubbleSwap = t + 7;
    bubbleText = state.asleep ? 'Zzz… (dreaming)' : bubbleText === state.thought ? state.activity : state.thought;
  }
  loki.head.getWorldPosition(tmp);
  tmp.y += 1.2;
  const d = camera.position.distanceTo(tmp);
  tmp.project(camera);
  const visible = d < 32 && tmp.z < 1 && Math.abs(tmp.x) < 1.1 && Math.abs(tmp.y) < 1.1;
  bubble.hidden = !visible || panelOpen;
  if (visible) {
    bubble.textContent = bubbleText;
    bubble.style.left = `${((tmp.x + 1) / 2) * innerWidth}px`;
    bubble.style.top = `${((1 - tmp.y) / 2) * innerHeight}px`;
    bubble.style.opacity = String(THREE.MathUtils.clamp((32 - d) / 8, 0, 1));
  }
}

function updatePrompt() {
  const vp = visitor.root.position;
  let best = null, bd = Infinity;
  const lokiIt = { type: 'loki', pos: loki.root.position, r: 3.2, label: state && state.asleep ? 'Watch Loki sleep' : 'Talk to Loki' };
  for (const it of [lokiIt, ...interactables]) {
    const d = Math.hypot(vp.x - it.pos.x, vp.z - it.pos.z);
    if (d < it.r && d < bd) {
      best = it;
      bd = d;
    }
  }
  nearest = best;
  prompt.hidden = !best || panelOpen;
  if (best) $('prompt-text').textContent = best.label;
}

function updateCompass() {
  const vp = visitor.root.position;
  const lp = loki.root.position;
  const dx = lp.x - vp.x, dz = lp.z - vp.z;
  const dist = Math.hypot(dx, dz);
  // angle between where the camera looks and where Loki is (positive = to the right)
  const fx = -Math.sin(controls.yaw), fz = -Math.cos(controls.yaw);
  const rx = Math.cos(controls.yaw), rz = -Math.sin(controls.yaw);
  const rel = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
  $('arrow').style.transform = `rotate(${rel}rad)`;
  $('loki-dist').textContent = dist < 4 ? 'right here!' : `${Math.round(dist)} m away`;
}

function tick() {
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;
  const tm = ukTime();
  applyTime(timeOverride ?? tm.h);
  controls.update(dt, colliders, bounds);
  updateLoki(dt, t);
  for (const a of animated) {
    if (a.type === 'smoke') {
      const k = ((t * 0.25 + a.p.userData.phase) % 1);
      a.p.position.set(a.base.x + Math.sin(k * 6) * 0.3, a.base.y + k * 3, a.base.z);
      a.p.scale.setScalar(0.6 + k * 1.4);
      a.p.material.opacity = 0.55 * (1 - k);
    } else if (a.type === 'jet') a.p.scale.y = 1 + Math.sin(t * 6) * 0.08;
  }
  clouds.children.forEach((c) => {
    c.position.x += c.userData.speed * dt;
    if (c.position.x > 170) c.position.x = -170;
  });
  sun.target.position.copy(visitor.root.position);
  sun.position.add(visitor.root.position);
  updateBubble(t);
  if (t - lastHud > 0.2) {
    lastHud = t;
    updatePrompt();
    updateCompass();
    $('clock').textContent = `${tm.label} UK`;
  }
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}

const q = new URLSearchParams(location.search);
if (q.has('hour')) timeOverride = Number(q.get('hour'));

load().then(() => {
  $('loading').hidden = true;
  requestAnimationFrame(tick);
  setTimeout(() => $('help').classList.add('fade'), 9000);
});
setInterval(load, 120000);

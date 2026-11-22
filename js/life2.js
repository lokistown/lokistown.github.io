// Town atmosphere: real weather (from Loki's brain, which checks London's weather every session)
// and street life — birds, butterflies by day, fireflies at night,
// bunting over the plaza, paths to Loki's exhibits, picnic tables, bins and street signs.
import * as THREE from 'three';
import { block, part, signBoard } from './toon.js';
import { PLOT, ROAD } from './layout.js';
import { flower } from './rooms.js';
import { model } from './models.js';

// ---------------------------------------------------------------- weather
export class Weather {
  constructor(scene) {
    this.scene = scene;
    this.kind = 'clear';
    this.flash = 0;
    const N = 2200;
    const pos = new Float32Array(N * 6);
    this.rainGeo = new THREE.BufferGeometry();
    this.rainGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain = new THREE.LineSegments(this.rainGeo, new THREE.LineBasicMaterial({ color: '#d8ecff', transparent: true, opacity: 0.8 }));
    this.rain.frustumCulled = false;
    this.drops = Array.from({ length: N }, () => ({ x: (Math.random() - 0.5) * 70, y: Math.random() * 40, z: (Math.random() - 0.5) * 70, v: 26 + Math.random() * 10 }));
    const sp = new Float32Array(1600 * 3);
    this.snowGeo = new THREE.BufferGeometry();
    this.snowGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.snow = new THREE.Points(this.snowGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 0.22, transparent: true, opacity: 0.95 }));
    this.snow.frustumCulled = false;
    this.flakes = Array.from({ length: 1600 }, () => ({ x: (Math.random() - 0.5) * 70, y: Math.random() * 35, z: (Math.random() - 0.5) * 70, v: 1.2 + Math.random(), p: Math.random() * 6 }));
    this.rain.visible = this.snow.visible = false;
    scene.add(this.rain, this.snow);
  }
  set(w) {
    this.kind = w?.kind || 'clear';
    this.text = w?.text || '';
    this.rain.visible = this.kind === 'rain' || this.kind === 'storm';
    this.snow.visible = this.kind === 'snow';
  }
  // how the weather changes light and fog
  mods() {
    return {
      rain: { dim: 0.55, fog: [35, 170], grey: 0.55 },
      storm: { dim: 0.4, fog: [30, 140], grey: 0.7 },
      snow: { dim: 0.75, fog: [40, 180], grey: 0.45 },
      fog: { dim: 0.7, fog: [12, 75], grey: 0.6 },
      cloudy: { dim: 0.8, fog: [80, 300], grey: 0.35 },
      partly: { dim: 0.92, fog: [90, 320], grey: 0.12 },
    }[this.kind] || { dim: 1, fog: [90, 330], grey: 0 };
  }
  update(dt, at) {
    if (this.rain.visible) {
      const p = this.rainGeo.attributes.position.array;
      this.drops.forEach((d, i) => {
        d.y -= d.v * dt;
        if (d.y < 0) {
          d.y = 30 + Math.random() * 10;
          d.x = (Math.random() - 0.5) * 70;
          d.z = (Math.random() - 0.5) * 70;
        }
        const x = at.x + d.x, z = at.z + d.z;
        p.set([x, d.y, z, x + 0.05, d.y + 0.7, z], i * 6);
      });
      this.rainGeo.attributes.position.needsUpdate = true;
    }
    if (this.snow.visible) {
      const p = this.snowGeo.attributes.position.array;
      this.flakes.forEach((f, i) => {
        f.y -= f.v * dt;
        f.p += dt;
        if (f.y < 0) f.y = 30 + Math.random() * 6;
        p.set([at.x + f.x + Math.sin(f.p) * 0.6, f.y, at.z + f.z + Math.cos(f.p * 0.7) * 0.6], i * 3);
      });
      this.snowGeo.attributes.position.needsUpdate = true;
    }
    if (this.kind === 'storm') {
      this.flash = Math.max(0, this.flash - dt * 3);
      if (Math.random() < dt * 0.08) this.flash = 1;
    } else this.flash = 0;
  }
}

// ---------------------------------------------------------------- critters
function bird() {
  const g = new THREE.Group();
  const b = part(new THREE.SphereGeometry(0.16, 10, 8), '#5c6b7a', { ink: 0.01 });
  b.scale.set(1, 0.8, 1.6);
  g.add(b, part(new THREE.ConeGeometry(0.04, 0.12, 6), '#ffb703', { z: 0.28, ink: 0 }).rotateX(Math.PI / 2));
  const wings = [];
  for (const sx of [-1, 1]) {
    const w = new THREE.Group();
    const m = block(0.42, 0.03, 0.2, '#47535f', sx * 0.21, 0, 0, { ink: false });
    w.add(m);
    g.add(w);
    wings.push({ w, sx });
  }
  g.userData.wings = wings;
  return g;
}
function butterfly(color) {
  const g = new THREE.Group();
  const wings = [];
  for (const sx of [-1, 1]) {
    const w = new THREE.Group();
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.12, 10), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    m.position.x = sx * 0.11;
    m.rotation.x = -Math.PI / 2;
    w.add(m);
    g.add(w);
    wings.push({ w, sx });
  }
  g.userData.wings = wings;
  return g;
}

export function createStreetLife(group, maxRing) {
  const colliders = [];
  const movers = [];
  // ---- paved walkways from the plaza to each exhibit corner ----
  const pave = new THREE.MeshToonMaterial({ color: '#e2cda6' });
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    for (let k = 0; k < 6; k++) {
      const d = 9.4 + k * 0.62;
      const st = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.5), pave);
      st.position.set(sx * d * 0.7071, 0.1, sz * d * 0.7071);
      st.rotation.y = Math.atan2(sx, sz) + Math.PI / 2;
      st.receiveShadow = true;
      group.add(st);
    }
    // flowers + a small hedge on both sides of each exhibit
    for (const side of [-1, 1]) {
      const ox = sx * 11.4 + side * sz * 3.6 * 0.7071 * 1.0, oz = sz * 11.4 - side * sx * 3.6 * 0.7071;
      const bed = part(new THREE.CylinderGeometry(0.8, 0.9, 0.35, 12), '#7a5235', { x: ox, y: 0.18, z: oz, ink: 0.02 });
      group.add(bed);
      for (let f = 0; f < 7; f++) {
        const fl = flower(['#ef476f', '#ffd166', '#c77dff', '#ffffff'][f % 4], 0.3);
        fl.position.set(ox + Math.cos(f * 0.9) * 0.45, 0.34, oz + Math.sin(f * 0.9) * 0.45);
        group.add(fl);
      }
      colliders.push({ x: ox, z: oz, hw: 0.8, hd: 0.8, h: 0.6 });
    }
  }
  // ---- bunting across the plaza (between the four lamps) ----
  const lampAt = (k) => {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    return new THREE.Vector3(Math.cos(a) * 8.6, 3.5, Math.sin(a) * 8.6);
  };
  const flagCols = ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#f28c28'];
  for (const [a, b] of [[0, 2], [1, 3]]) {
    const A = lampAt(a), Bv = lampAt(b);
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const p = A.clone().lerp(Bv, t);
      p.y -= Math.sin(t * Math.PI) * 1.1;
      pts.push(p);
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#5b3a29' })));
    for (let i = 1; i < 24; i++) {
      const tri = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.42, 3), new THREE.MeshToonMaterial({ color: flagCols[i % flagCols.length] }));
      tri.position.copy(pts[i]).add(new THREE.Vector3(0, -0.24, 0));
      tri.rotation.x = Math.PI;
      tri.rotation.y = Math.atan2(Bv.x - A.x, Bv.z - A.z);
      tri.scale.z = 0.15;
      group.add(tri);
    }
  }
  // ---- picnic tables, bins and a bike rack in the plaza block ----
  const picnic = (x, z, rot) => {
    const g = new THREE.Group();
    g.add(block(2, 0.1, 0.9, '#a5714b', 0, 0.78, 0), block(2, 0.08, 0.32, '#8a5a3b', 0, 0.45, 0.68), block(2, 0.08, 0.32, '#8a5a3b', 0, 0.45, -0.68));
    for (const sx of [-0.8, 0.8]) g.add(block(0.1, 0.8, 1.6, '#6b4226', sx, 0.38, 0));
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    group.add(g);
    colliders.push({ x, z, hw: 1.0, hd: 1.0, h: 1 });
  };
  picnic(12.8, 5.2, 0.1);
  picnic(-12.8, -5.2, -0.1);
  const bin = (x, z) => {
    const g = new THREE.Group();
    g.add(part(new THREE.CylinderGeometry(0.3, 0.26, 0.85, 12), '#2a9d8f', { y: 0.43, ink: 0.015 }), part(new THREE.CylinderGeometry(0.33, 0.33, 0.07, 12), '#264653', { y: 0.88, ink: 0.01 }));
    g.position.set(x, 0, z);
    group.add(g);
    colliders.push({ x, z, hw: 0.32, hd: 0.32, h: 1 });
  };
  bin(6.2, 6.6);
  bin(-6.6, -6.0);
  bin(10.8, 2.8);
  const rack = new THREE.Group();
  for (let k = 0; k < 4; k++) {
    const hoop = part(new THREE.TorusGeometry(0.4, 0.04, 6, 16, Math.PI), '#6c757d', { x: k * 0.6 - 0.9, y: 0.02, ink: 0.005 });
    rack.add(hoop);
  }
  rack.position.set(4.6, 0, 13.3);
  group.add(rack);
  // ---- street signs at the four corners around the plaza block ----
  const NAMES = [['Whisker Way', 'Pip Lane'], ['Yarn Street', 'Fishbone Row'], ['Lantern Lane', 'Biscuit Road'], ['Purr Avenue', 'Moth Street']];
  [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz], i) => {
    const g = new THREE.Group();
    g.add(part(new THREE.CylinderGeometry(0.06, 0.06, 3, 8), '#3b3b45', { y: 1.5, ink: 0.01 }));
    const a = signBoard(NAMES[i][0], 1.7, { color: '#1f6f50' });
    a.position.y = 2.75;
    const b = signBoard(NAMES[i][1], 1.7, { color: '#1f6f50' });
    b.position.y = 2.35;
    b.rotation.y = Math.PI / 2;
    g.add(a, b);
    g.position.set(sx * 13.9, 0, sz * 13.9);
    group.add(g);
    colliders.push({ x: sx * 13.9, z: sz * 13.9, hw: 0.2, hd: 0.2, h: 3 });
  });
  // ---- birds circling high up, butterflies and fireflies ----
  for (let i = 0; i < 6; i++) {
    const b = bird();
    group.add(b);
    movers.push({ kind: 'bird', obj: b, a: (i / 6) * Math.PI * 2, r: 14 + (i % 3) * 6, h: 14 + (i % 2) * 4, s: 0.25 + (i % 3) * 0.06 });
  }
  const flies = [];
  for (let i = 0; i < 10; i++) {
    const f = butterfly(['#ffd166', '#ffffff', '#ffafcc', '#a2d2ff'][i % 4]);
    const [sx, sz] = [[-1, -1], [1, -1], [1, 1], [-1, 1]][i % 4];
    group.add(f);
    movers.push({ kind: 'fly', obj: f, cx: sx * 11.4 + (Math.random() - 0.5) * 5, cz: sz * 11.4 + (Math.random() - 0.5) * 5, p: Math.random() * 10 });
  }
  const ffMat = new THREE.MeshBasicMaterial({ color: '#f6ff9e', transparent: true, opacity: 0 });
  for (let i = 0; i < 26; i++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), ffMat);
    group.add(f);
    flies.push({ obj: f, a: Math.random() * 6.28, r: 4 + Math.random() * 13, p: Math.random() * 10 });
  }
  let night = 0;
  return {
    colliders,
    update(dt, t, nightLevel, people) {
      night = nightLevel;
      ffMat.opacity = Math.max(0, (night - 0.45) * 1.8);
      for (const m of movers) {
        if (m.kind === 'bird') {
          m.a += dt * m.s;
          m.obj.position.set(Math.cos(m.a) * m.r, m.h + Math.sin(t + m.r) * 0.6, Math.sin(m.a) * m.r);
          m.obj.rotation.y = -m.a;
          for (const { w, sx } of m.obj.userData.wings) w.rotation.z = sx * Math.sin(t * 9 + m.r) * 0.6;
        } else {
          m.p += dt;
          m.obj.visible = night < 0.5;
          m.obj.position.set(m.cx + Math.sin(m.p * 0.7) * 1.6, 0.9 + Math.sin(m.p * 2.3) * 0.35, m.cz + Math.cos(m.p * 0.5) * 1.6);
          m.obj.rotation.y = m.p * 0.7;
          for (const { w, sx } of m.obj.userData.wings) w.rotation.z = sx * Math.sin(m.p * 22) * 0.9;
        }
      }
      if (ffMat.opacity > 0)
        for (const f of flies) {
          f.p += dt;
          f.obj.position.set(Math.cos(f.a + f.p * 0.1) * f.r, 0.6 + Math.sin(f.p * 1.3) * 0.5 + 0.5, Math.sin(f.a + f.p * 0.12) * f.r);
        }
    },
  };
}

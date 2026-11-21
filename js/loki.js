// Loki, modelled in code: a low-poly orange tabby with a white chest, green eyes and a teal scarf.
import * as THREE from 'three';
import { mat, mesh } from './world.js';

const ORANGE = '#f28c28', STRIPE = '#c4621a', WHITE = '#fff5e6', OUT = '#3b2416';

function part(geo, color, x, y, z) {
  const m = mesh(geo, mat(color));
  m.position.set(x, y, z);
  return m;
}

export function createLoki() {
  const root = new THREE.Group(); // position + heading
  const body = new THREE.Group(); // pose
  root.add(body);

  // torso (faces +z)
  const torso = part(new THREE.SphereGeometry(0.5, 8, 6), ORANGE, 0, 0.62, 0);
  torso.scale.set(0.9, 0.78, 1.35);
  body.add(torso);
  const chest = part(new THREE.SphereGeometry(0.33, 8, 6), WHITE, 0, 0.6, 0.5);
  chest.scale.set(1, 1.05, 0.7);
  body.add(chest);
  for (let k = 0; k < 3; k++) {
    const s = part(new THREE.BoxGeometry(0.78, 0.08, 0.12), STRIPE, 0, 0.98 - Math.abs(k - 1) * 0.02, -0.35 + k * 0.28);
    s.rotation.x = 0.05;
    body.add(s);
  }

  // head
  const head = new THREE.Group();
  head.position.set(0, 1.05, 0.62);
  body.add(head);
  const skull = part(new THREE.SphereGeometry(0.4, 8, 7), ORANGE, 0, 0, 0);
  skull.scale.set(1.1, 0.95, 0.95);
  head.add(skull);
  const muzzle = part(new THREE.SphereGeometry(0.2, 8, 6), WHITE, 0, -0.12, 0.3);
  muzzle.scale.set(1.25, 0.8, 0.8);
  head.add(muzzle);
  head.add(part(new THREE.SphereGeometry(0.06, 6, 4), '#f4a3a3', 0, -0.04, 0.44));
  head.add(part(new THREE.BoxGeometry(0.5, 0.07, 0.08), STRIPE, 0, 0.3, 0.2));
  const eyes = [];
  for (const sx of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(sx * 0.17, 0.06, 0.33);
    eye.add(part(new THREE.SphereGeometry(0.085, 8, 6), '#3cb043', 0, 0, 0));
    eye.add(part(new THREE.SphereGeometry(0.045, 6, 4), '#111', 0, 0, 0.06));
    eye.add(part(new THREE.SphereGeometry(0.02, 4, 3), '#fff', 0.025, 0.03, 0.08));
    head.add(eye);
    eyes.push(eye);
    const ear = part(new THREE.ConeGeometry(0.15, 0.3, 4), ORANGE, sx * 0.24, 0.34, -0.02);
    ear.rotation.z = -sx * 0.25;
    head.add(ear);
    const inner = part(new THREE.ConeGeometry(0.08, 0.18, 4), '#f4a3a3', sx * 0.24, 0.32, 0.04);
    inner.rotation.z = -sx * 0.25;
    head.add(inner);
    for (const wy of [-0.1, -0.16]) {
      const w = part(new THREE.BoxGeometry(0.28, 0.012, 0.012), OUT, sx * 0.3, wy, 0.32);
      w.rotation.z = sx * (wy + 0.13) * 1.6;
      head.add(w);
    }
  }

  // scarf
  const scarf = part(new THREE.TorusGeometry(0.3, 0.09, 6, 12), '#2a9d8f', 0, 0.86, 0.48);
  scarf.rotation.x = Math.PI / 2 - 0.5;
  body.add(scarf);
  const tail1 = part(new THREE.BoxGeometry(0.16, 0.36, 0.08), '#2a9d8f', 0.18, 0.68, 0.66);
  tail1.rotation.z = 0.25;
  body.add(tail1);

  // legs (pivot at hip)
  const legs = [];
  for (const [x, z] of [[-0.24, 0.42], [0.24, 0.42], [-0.24, -0.42], [0.24, -0.42]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.5, z);
    const leg = part(new THREE.CylinderGeometry(0.1, 0.09, 0.48, 6), ORANGE, 0, -0.24, 0);
    const paw = part(new THREE.SphereGeometry(0.11, 6, 4), WHITE, 0, -0.48, 0.03);
    paw.scale.set(1, 0.6, 1.2);
    pivot.add(leg, paw);
    body.add(pivot);
    legs.push(pivot);
  }

  // tail: chain of segments
  const tail = [];
  let parent = body;
  let pos = new THREE.Vector3(0, 0.75, -0.62);
  for (let k = 0; k < 5; k++) {
    const seg = new THREE.Group();
    seg.position.copy(pos);
    const color = k === 4 ? STRIPE : k % 2 ? STRIPE : ORANGE;
    const m = part(new THREE.CylinderGeometry(0.075, 0.085, 0.26, 6), color, 0, 0.12, 0);
    seg.add(m);
    seg.rotation.x = k === 0 ? -0.9 : -0.25;
    parent.add(seg);
    tail.push(seg);
    parent = seg;
    pos = new THREE.Vector3(0, 0.24, 0);
  }

  // "Zzz" sprite for sleeping
  const zc = document.createElement('canvas');
  zc.width = 128;
  zc.height = 64;
  const zg = zc.getContext('2d');
  zg.font = 'bold 44px system-ui';
  zg.fillStyle = '#ffffff';
  zg.strokeStyle = '#3b2416';
  zg.lineWidth = 6;
  zg.strokeText('Zzz', 8, 48);
  zg.fillText('Zzz', 8, 48);
  const zzz = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(zc), transparent: true, depthWrite: false }));
  zzz.scale.set(1.2, 0.6, 1);
  zzz.visible = false;
  root.add(zzz);

  root.scale.setScalar(1.25);
  root.traverse((o) => (o.userData.isLoki = true));

  const state = { mode: 'idle', t: 0, blink: 0, speed: 0, sitting: 0 };

  function animate(dt, mode, moving) {
    state.t += dt;
    const t = state.t;
    // blend into sit / sleep poses
    const wantSit = mode === 'sit' ? 1 : 0;
    const wantSleep = mode === 'sleep' ? 1 : 0;
    state.sitting += (wantSit - state.sitting) * Math.min(1, dt * 4);
    state.sleeping = (state.sleeping || 0) + (wantSleep - (state.sleeping || 0)) * Math.min(1, dt * 3);
    const sit = state.sitting;
    const slp = state.sleeping;

    // walking legs
    const amp = moving ? 0.7 : 0;
    legs.forEach((l, i) => {
      const phase = i === 0 || i === 3 ? 0 : Math.PI;
      l.rotation.x = Math.sin(t * 10 + phase) * amp * (1 - slp);
    });
    // sit: tilt torso up at the front, fold back legs
    body.rotation.x = -0.45 * sit;
    body.position.y = -0.12 * sit - 0.35 * slp + (moving ? Math.abs(Math.sin(t * 10)) * 0.04 : Math.sin(t * 2) * 0.01);
    legs[2].rotation.x += -1.1 * sit - 1.4 * slp;
    legs[3].rotation.x += -1.1 * sit - 1.4 * slp;
    legs[0].rotation.x += 0.45 * sit + 1.4 * slp;
    legs[1].rotation.x += 0.45 * sit + 1.4 * slp;
    // head
    head.rotation.x = 0.45 * sit * 0.9 + 0.5 * slp + Math.sin(t * 0.7) * 0.05;
    head.rotation.y = moving ? 0 : Math.sin(t * 0.4) * 0.35 * (1 - slp);
    head.position.y = 1.05 - 0.25 * slp;
    // tail swish (curls around when sleeping)
    tail.forEach((s, i) => {
      s.rotation.z = Math.sin(t * (moving ? 6 : 2.2) - i * 0.6) * (0.25 + i * 0.05) * (1 - slp) + slp * 0.5;
      if (i > 0) s.rotation.x = -0.25 + slp * 0.25 + sit * 0.15;
    });
    // blink (eyes shut while sleeping)
    if (t > state.blink) state.blink = t + 2.5 + Math.random() * 3;
    const shut = slp > 0.5 || state.blink - t < 0.12;
    eyes.forEach((e) => (e.scale.y = shut ? 0.12 : 1));
    // zzz
    zzz.visible = slp > 0.6;
    zzz.position.set(0.5, 1.4 + ((t * 0.4) % 0.6), 0.4);
    zzz.material.opacity = 1 - ((t * 0.4) % 0.6) / 0.6;
  }

  return { root, head, animate };
}

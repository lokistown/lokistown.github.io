// Loki (orange tabby), Pip (his mouse friend) and the visitor, all modelled in code.
import * as THREE from 'three';
import { toon, part, block, INK } from './toon.js';

const ORANGE = '#f39a3d', STRIPE = '#c8641c', CREAM = '#fff4e2', PINK = '#f7a8b0', GREEN = '#4cc04a';
const smooth = (geo) => geo;

// Paint tabby stripes straight onto a geometry's vertices (flush with the fur, no "bars").
function painted(geo, fn) {
  const pos = geo.attributes.position;
  const col = [];
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    c.set(fn(pos.getX(i), pos.getY(i), pos.getZ(i)));
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}
const furMat = new THREE.MeshToonMaterial({ color: '#ffffff', vertexColors: true });
function furPart(geo, opts) {
  const m = part(geo, '#ffffff', { ...opts, mat: furMat });
  return m;
}
function arcStripe(radius, tube, arc, color) {
  const m = new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 8, 24, arc), toon(color));
  m.castShadow = true;
  return m;
}

// ---------------- LOKI ----------------
export function createLoki() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // torso: capsule lying along z
  // capsule along local y; after rotating, local -z is the cat's back, +z his belly
  const torsoGeo = painted(new THREE.CapsuleGeometry(0.3, 0.5, 12, 28), (x, y, z) => {
    if (z > 0.16) return CREAM;
    const wave = Math.sin(y * 13 + Math.abs(x) * 4);
    return z < 0.05 && wave > 0.45 ? STRIPE : ORANGE;
  });
  const torso = furPart(torsoGeo, { y: 0.55, ink: 0.025 });
  torso.rotation.x = Math.PI / 2;
  body.add(torso);
  // chest / belly
  const chest = part(new THREE.SphereGeometry(0.25, 20, 14), CREAM, { y: 0.52, z: 0.28, ink: 0 });
  chest.scale.set(1.0, 1.1, 0.9);
  body.add(chest);

  // head
  const neck = new THREE.Group();
  neck.position.set(0, 0.78, 0.38);
  body.add(neck);
  const head = new THREE.Group();
  head.position.set(0, 0.2, 0.06);
  neck.add(head);
  const skullGeo = painted(new THREE.SphereGeometry(0.36, 32, 24), (x, y, z) => {
    // tabby "M" on the forehead + stripes on the cheeks
    if (y > 0.12 && z > 0.05 && Math.abs(Math.sin(x * 26)) > 0.72) return STRIPE;
    if (Math.abs(x) > 0.27 && y > -0.08 && y < 0.08 && Math.sin(y * 50) > 0.3) return STRIPE;
    return ORANGE;
  });
  const skull = furPart(skullGeo, { ink: 0.025 });
  skull.scale.set(1.12, 0.96, 1);
  head.add(skull);
  // muzzle / cheeks
  for (const sx of [-1, 1]) {
    const ch = part(new THREE.SphereGeometry(0.13, 16, 12), CREAM, { x: sx * 0.09, y: -0.12, z: 0.28, ink: 0.012 });
    ch.scale.set(1.1, 0.85, 0.8);
    head.add(ch);
  }
  const chin = part(new THREE.SphereGeometry(0.08, 12, 8), CREAM, { y: -0.2, z: 0.25, ink: 0 });
  head.add(chin);
  const nose = part(new THREE.SphereGeometry(0.045, 12, 8), PINK, { y: -0.06, z: 0.36, ink: 0.008 });
  nose.scale.set(1.3, 0.8, 0.8);
  head.add(nose);
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), toon('#5b1e1e'));
  mouth.position.set(0, -0.17, 0.32);
  mouth.scale.set(1, 0.2, 0.5);
  head.add(mouth);
  // eyes
  const eyes = [];
  for (const sx of [-1, 1]) {
    const e = new THREE.Group();
    e.position.set(sx * 0.15, 0.05, 0.3);
    e.rotation.y = sx * 0.35;
    const white = new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 14), toon('#ffffff'));
    white.scale.set(1, 1.15, 0.55);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.08, 20, 14), toon(GREEN));
    iris.scale.set(1, 1.15, 0.5);
    iris.position.z = 0.03;
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshBasicMaterial({ color: '#111' }));
    pupil.scale.set(0.7, 1.7, 0.5);
    pupil.position.z = 0.065;
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff' }));
    shine.position.set(0.025, 0.04, 0.08);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.105, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), toon(ORANGE));
    lid.scale.set(1, 1.2, 0.6);
    lid.rotation.x = -Math.PI / 2 + 0.2;
    lid.position.z = 0.01;
    lid.visible = false;
    e.add(white, iris, pupil, shine, lid);
    const ink = new THREE.Mesh(white.geometry, INK);
    ink.scale.set(1.08, 1.22, 0.6);
    e.add(ink);
    head.add(e);
    eyes.push({ e, lid, iris, pupil });
  }
  // ears
  for (const sx of [-1, 1]) {
    const ear = part(new THREE.ConeGeometry(0.14, 0.28, 16), ORANGE, { x: sx * 0.22, y: 0.3, z: -0.02, ink: 0.015 });
    ear.rotation.z = -sx * 0.32;
    ear.rotation.x = -0.1;
    const inner = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.18, 12), toon(PINK));
    inner.position.set(0, -0.03, 0.05);
    ear.add(inner);
    head.add(ear);
  }
  // whiskers
  const wm = new THREE.LineBasicMaterial({ color: '#3b2416' });
  for (const sx of [-1, 1])
    for (const k of [0, 1]) {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(sx * 0.16, -0.1 - k * 0.04, 0.3), new THREE.Vector3(sx * 0.45, -0.06 - k * 0.1, 0.24)]);
      head.add(new THREE.Line(g, wm));
    }

  // scarf
  const scarf = part(new THREE.TorusGeometry(0.24, 0.075, 12, 28), '#2a9d8f', { y: 0.02, z: 0.02, ink: 0.015 });
  scarf.rotation.x = Math.PI / 2 - 0.35;
  neck.add(scarf);
  const tail1 = part(new THREE.CapsuleGeometry(0.06, 0.25, 4, 10), '#2a9d8f', { x: 0.14, y: -0.15, z: 0.2, ink: 0.012 });
  tail1.rotation.z = 0.35;
  neck.add(tail1);
  for (let k = 0; k < 3; k++) neck.add(part(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 4), '#ffd166', { x: 0.2 + k * 0.03 - 0.03, y: -0.33, z: 0.2, ink: 0 }));

  // legs
  const legs = [];
  for (const [x, z] of [[-0.17, 0.3], [0.17, 0.3], [-0.17, -0.3], [0.17, -0.3]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.48, z);
    const leg = part(new THREE.CapsuleGeometry(0.085, 0.24, 4, 12), ORANGE, { y: -0.2, ink: 0.015 });
    const paw = part(new THREE.SphereGeometry(0.1, 14, 10), CREAM, { y: -0.4, z: 0.03, ink: 0.012 });
    paw.scale.set(1, 0.65, 1.25);
    pivot.add(leg, paw);
    body.add(pivot);
    legs.push(pivot);
  }

  // tail: chain of capsules with stripes
  const tail = [];
  let parent = body;
  let pos = new THREE.Vector3(0, 0.62, -0.55);
  for (let k = 0; k < 7; k++) {
    const seg = new THREE.Group();
    seg.position.copy(pos);
    const color = k === 6 || k % 2 === 1 ? STRIPE : ORANGE;
    seg.add(part(new THREE.CapsuleGeometry(0.065 - k * 0.003, 0.1, 4, 10), color, { y: 0.07, ink: 0.012 }));

    seg.rotation.x = k === 0 ? -1.0 : -0.18;
    parent.add(seg);
    tail.push(seg);
    parent = seg;
    pos = new THREE.Vector3(0, 0.15, 0);
  }

  // music notes / zzz sprites
  const mkSprite = (text, color) => {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 64;
    const x = c.getContext('2d');
    x.font = "700 46px 'Fredoka', sans-serif";
    x.lineWidth = 8;
    x.strokeStyle = '#2b1a10';
    x.strokeText(text, 10, 48);
    x.fillStyle = color;
    x.fillText(text, 10, 48);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    sp.scale.set(0.9, 0.45, 1);
    sp.visible = false;
    root.add(sp);
    return sp;
  };
  const zzz = mkSprite('Zzz', '#ffffff');
  const note = mkSprite('♪ ♫', '#ffd166');

  root.scale.setScalar(0.62);
  const st = { t: 0, blinkAt: 2, sit: 0, lie: 0 };
  const POSE_SIT = ['sit', 'watch', 'laundry', 'radio', 'admire', 'read', 'work', 'relax', 'sing', 'piano', 'paint', 'coffee', 'print'];

  function animate(dt, act, moving) {
    st.t += dt;
    const t = st.t;
    const wantLie = act === 'sleep' || act === 'nap' ? 1 : 0;
    const wantSit = !moving && !wantLie && POSE_SIT.includes(act) ? 1 : 0;
    st.sit += (wantSit - st.sit) * Math.min(1, dt * 5);
    st.lie += (wantLie - st.lie) * Math.min(1, dt * 3);
    const sit = st.sit, lie = st.lie;

    // base pose
    body.rotation.x = -0.5 * sit;
    body.position.y = -0.14 * sit - 0.3 * lie + (moving ? Math.abs(Math.sin(t * 11)) * 0.04 : Math.sin(t * 2.2) * 0.008);
    body.position.z = -0.1 * sit;
    const swing = moving ? 0.8 : 0;
    legs.forEach((l, i) => {
      const ph = i === 0 || i === 3 ? 0 : Math.PI;
      l.rotation.x = Math.sin(t * 11 + ph) * swing * (1 - lie);
      l.rotation.z = 0;
    });
    legs[2].rotation.x += -1.25 * sit - 1.4 * lie;
    legs[3].rotation.x += -1.25 * sit - 1.4 * lie;
    legs[0].rotation.x += 0.5 * sit + 1.45 * lie;
    legs[1].rotation.x += 0.5 * sit + 1.45 * lie;

    // activity gestures (front right paw = legs[1])
    let headPitch = 0.5 * sit + 0.55 * lie, headYaw = moving ? 0 : Math.sin(t * 0.45) * 0.4 * (1 - lie) * (1 - sit * 0.5), headRoll = 0;
    let mouthOpen = 0;
    if (!moving && !lie) {
      if (act === 'paint' || act === 'build' || act === 'cook' || act === 'garden' || act === 'bake' || act === 'write' || act === 'work') {
        legs[1].rotation.x = -1.4 + Math.sin(t * (act === 'build' ? 9 : 3)) * 0.35;
        legs[1].rotation.z = Math.sin(t * 2) * 0.2;
        headPitch = 0.65;
      } else if (act === 'piano') {
        legs[0].rotation.x = -1.1 + Math.max(0, Math.sin(t * 8)) * 0.3;
        legs[1].rotation.x = -1.1 + Math.max(0, Math.sin(t * 8 + 2)) * 0.3;
        headRoll = Math.sin(t * 2) * 0.15;
      } else if (act === 'sing') {
        headPitch = 0.1 + Math.sin(t * 1.5) * 0.1;
        mouthOpen = 0.5 + Math.abs(Math.sin(t * 5)) * 0.8;
        headRoll = Math.sin(t * 1.6) * 0.18;
      } else if (act === 'eat') {
        headPitch = 0.4 + 0.5 * (0.5 + 0.5 * Math.sin(t * 6));
      } else if (act === 'greet' || act === 'wave') {
        legs[1].rotation.x = -2.2;
        legs[1].rotation.z = Math.sin(t * 8) * 0.4;
      } else if (act === 'read') headPitch = 0.75;
    }
    neck.rotation.x = headPitch * 0.5;
    head.rotation.set(headPitch * 0.5, headYaw, headRoll);
    neck.position.y = 0.78 - 0.18 * lie;
    neck.position.z = 0.38 + 0.08 * lie;
    mouth.scale.set(1, 0.2 + mouthOpen, 0.5);

    // tail
    tail.forEach((s, i) => {
      s.rotation.z = Math.sin(t * (moving ? 7 : 2) - i * 0.55) * (0.18 + i * 0.04) * (1 - lie) + lie * 0.35;
      if (i > 0) s.rotation.x = -0.18 + lie * 0.25 + sit * 0.2;
    });

    // blink / sleep eyes
    if (t > st.blinkAt) st.blinkAt = t + 2 + Math.random() * 3.5;
    const closed = lie > 0.5 || st.blinkAt - t < 0.12;
    eyes.forEach((o) => {
      o.lid.visible = closed;
      o.iris.visible = o.pupil.visible = !closed;
    });

    zzz.visible = lie > 0.6;
    if (zzz.visible) {
      const k = (t * 0.35) % 1;
      zzz.position.set(0.35, 0.9 + k * 0.7, 0.3);
      zzz.material.opacity = 1 - k;
    }
    note.visible = !moving && (act === 'sing' || act === 'piano' || act === 'radio');
    if (note.visible) {
      const k = (t * 0.5) % 1;
      note.position.set(Math.sin(t * 2) * 0.3 + 0.3, 1.3 + k * 0.6, 0.2);
      note.material.opacity = 1 - k;
    }
  }

  return { root, head, body, animate };
}

// ---------------- PIP (mouse) ----------------
export function createPip() {
  const root = new THREE.Group();
  const GREY = '#b9b4bd';
  const b = part(new THREE.SphereGeometry(0.11, 16, 12), GREY, { y: 0.1, ink: 0.01 });
  b.scale.set(0.9, 0.85, 1.25);
  root.add(b);
  const h = part(new THREE.SphereGeometry(0.08, 16, 12), GREY, { y: 0.15, z: 0.12, ink: 0.01 });
  h.scale.set(1, 0.95, 1.15);
  root.add(h);
  for (const sx of [-1, 1]) {
    const ear = part(new THREE.SphereGeometry(0.055, 14, 10), GREY, { x: sx * 0.06, y: 0.24, z: 0.1, ink: 0.008 });
    ear.scale.set(1, 1, 0.35);
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), toon(PINK));
    inner.scale.set(1, 1, 0.3);
    inner.position.z = 0.012;
    ear.add(inner);
    root.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), new THREE.MeshBasicMaterial({ color: '#111' }));
    eye.position.set(sx * 0.035, 0.17, 0.2);
    root.add(eye);
  }
  root.add(part(new THREE.SphereGeometry(0.018, 8, 6), PINK, { y: 0.14, z: 0.215, ink: 0 }));
  const tailCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.08, -0.12), new THREE.Vector3(0.05, 0.04, -0.25), new THREE.Vector3(-0.04, 0.1, -0.35), new THREE.Vector3(0.02, 0.18, -0.38)]);
  const tail = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 12, 0.008, 5), toon(PINK));
  root.add(tail);
  // tiny yellow bandana
  const band = part(new THREE.TorusGeometry(0.06, 0.015, 6, 14), '#ffd166', { y: 0.13, z: 0.08, ink: 0 });
  band.rotation.x = Math.PI / 2 - 0.4;
  root.add(band);
  let t = 0;
  return {
    root,
    animate(dt, sleeping) {
      t += dt;
      if (root.userData.baseY === undefined) root.userData.baseY = root.position.y;
      root.rotation.y = sleeping ? 0 : Math.sin(t * 0.8) * 0.6;
      root.position.y = root.userData.baseY + (sleeping ? 0 : Math.abs(Math.sin(t * 3)) * 0.015);
      tail.rotation.y = Math.sin(t * 3) * 0.3;
    },
  };
}

// ---------------- VISITOR ----------------
const HOODIES = ['#457b9d', '#e76f51', '#8e7cc3', '#2a9d8f', '#f4a261', '#e63946', '#06a77d'];
export function createVisitor(colorIndex = 0) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const hoodie = HOODIES[colorIndex % HOODIES.length];
  const SKIN = '#f6cfa6';
  const torso = part(new THREE.CapsuleGeometry(0.27, 0.32, 6, 16), hoodie, { y: 0.78, ink: 0.022 });
  body.add(torso);
  const pocket = part(new THREE.SphereGeometry(0.16, 14, 8), hoodie, { y: 0.68, z: 0.2, ink: 0.01 });
  pocket.scale.set(1.2, 0.6, 0.4);
  body.add(pocket);
  const head = new THREE.Group();
  head.position.y = 1.38;
  body.add(head);
  const face = part(new THREE.SphereGeometry(0.33, 24, 18), SKIN, { ink: 0.022 });
  head.add(face);
  const HAIR = ['#5b3a29', '#2b1a10', '#c68b59', '#8d5b3c', '#e9c46a'][colorIndex % 5];
  const hair = part(new THREE.SphereGeometry(0.345, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.52), HAIR, { y: 0.03, z: -0.03, ink: 0.015 });
  hair.rotation.x = -0.35;
  head.add(hair);
  for (const sx of [-1, 0, 1]) {
    const tuft = part(new THREE.SphereGeometry(0.11, 12, 8), HAIR, { x: sx * 0.13, y: 0.2, z: 0.22, ink: 0.008 });
    tuft.scale.set(1.2, 0.6, 0.7);
    head.add(tuft);
  }
  for (const sx of [-1, 1]) {
    const ear = part(new THREE.SphereGeometry(0.06, 10, 8), SKIN, { x: sx * 0.32, y: -0.02, ink: 0.008 });
    ear.scale.z = 0.6;
    head.add(ear);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.012, 6, 12, Math.PI), new THREE.MeshBasicMaterial({ color: '#7a3b2e' }));
  mouth.position.set(0, -0.14, 0.31);
  mouth.rotation.z = Math.PI;
  head.add(mouth);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), new THREE.MeshBasicMaterial({ color: '#2b1a10' }));
    eye.position.set(sx * 0.12, -0.02, 0.3);
    eye.scale.set(0.8, 1.2, 0.5);
    head.add(eye);
    const blush = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 6), new THREE.MeshBasicMaterial({ color: '#f4978e', transparent: true, opacity: 0.7 }));
    blush.position.set(sx * 0.2, -0.11, 0.26);
    blush.scale.set(1, 0.6, 0.3);
    head.add(blush);
  }
  // backpack
  const pack = part(new THREE.CapsuleGeometry(0.17, 0.16, 6, 12), '#c68b59', { y: 0.86, z: -0.27, ink: 0.015 });
  pack.scale.set(1, 1, 0.55);
  body.add(pack);
  body.add(part(new THREE.SphereGeometry(0.09, 10, 8), '#a56b3f', { y: 0.74, z: -0.36, ink: 0.008 }));
  for (const sx of [-1, 1]) body.add(block(0.05, 0.45, 0.03, '#8d5b3c', sx * 0.15, 0.92, 0.2, { ink: false }));
  const hood = part(new THREE.TorusGeometry(0.2, 0.07, 8, 18), hoodie, { y: 1.1, z: -0.08, ink: 0.01 });
  hood.rotation.x = Math.PI / 2 - 0.3;
  body.add(hood);
  // limbs
  const limbs = [];
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(sx * 0.33, 1.0, 0);
    arm.add(part(new THREE.CapsuleGeometry(0.08, 0.26, 4, 10), hoodie, { y: -0.18, ink: 0.012 }));
    arm.add(part(new THREE.SphereGeometry(0.075, 10, 8), SKIN, { y: -0.38, ink: 0.01 }));
    body.add(arm);
    const leg = new THREE.Group();
    leg.position.set(sx * 0.13, 0.42, 0);
    leg.add(part(new THREE.CapsuleGeometry(0.09, 0.2, 4, 10), '#3d405b', { y: -0.17, ink: 0.012 }));
    leg.add(part(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 12), '#ffffff', { y: -0.42, z: 0.05, ink: 0 }));
    const shoe = part(new THREE.SphereGeometry(0.1, 12, 8), '#e63946', { y: -0.36, z: 0.05, ink: 0.01 });
    shoe.scale.set(1, 0.6, 1.4);
    leg.add(shoe);
    body.add(leg);
    limbs.push({ arm, leg, sx });
  }
  let t = 0;
  return {
    root,
    body,
    animate(dt, moving, running) {
      t += dt * (running ? 1.5 : 1);
      const a = moving ? Math.sin(t * 10) * 0.7 : 0;
      limbs.forEach(({ arm, leg, sx }) => {
        arm.rotation.x = a * sx;
        leg.rotation.x = -a * sx;
        arm.rotation.z = sx * (moving ? 0.1 : 0.05 + Math.sin(t * 2) * 0.02);
      });
      body.position.y = moving ? Math.abs(Math.sin(t * 10)) * 0.06 : Math.sin(t * 2) * 0.01;
      head.rotation.z = moving ? Math.sin(t * 5) * 0.05 : 0;
    },
  };
}

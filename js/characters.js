// Loki (orange tabby), Pip (his mouse friend) and the visitor, all modelled in code.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
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

// Rounded box (like Kenney's chunky characters): a box whose corners are pulled round.
export function roundedBox(w, h, d, r, seg = 3) {
  const geo = new THREE.BoxGeometry(w, h, d, seg * 2, seg * 2, seg * 2);
  const p = geo.attributes.position;
  const v = new THREE.Vector3(), inner = new THREE.Vector3();
  const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    inner.set(THREE.MathUtils.clamp(v.x, -hx, hx), THREE.MathUtils.clamp(v.y, -hy, hy), THREE.MathUtils.clamp(v.z, -hz, hz));
    v.sub(inner);
    if (v.lengthSq() > 0) v.normalize().multiplyScalar(r);
    p.setXYZ(i, inner.x + v.x, inner.y + v.y, inner.z + v.z);
  }
  geo.computeVertexNormals();
  return geo;
}
const furRamp = (() => {
  const t = new THREE.DataTexture(new Uint8Array([125, 190, 240, 255]), 4, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
const flat = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: furRamp });
function canvasMat(draw, w = 256, h = 256) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return new THREE.MeshToonMaterial({ map: t, gradientMap: furRamp });
}
// tabby stripes across a face of a box (u along the face)
const stripes = (n, wob = 10) => (g, w, h) => {
  g.fillStyle = ORANGE;
  g.fillRect(0, 0, w, h);
  g.fillStyle = STRIPE;
  for (let k = 0; k < n; k++) {
    const x = ((k + 0.5) / n) * w;
    g.beginPath();
    g.moveTo(x - 9, 0);
    g.quadraticCurveTo(x + wob, h * 0.5, x - 6, h * 0.82);
    g.lineTo(x + 6, h * 0.82);
    g.quadraticCurveTo(x + wob + 12, h * 0.5, x + 9, 0);
    g.fill();
  }
};
function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ---------------- LOKI ----------------
// Chunky stylised orange tabby (same proportions and flat toon look as the Kenney characters).
export function createLoki() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const orange = flat(ORANGE), cream = flat(CREAM), pink = flat(PINK), dark = flat('#3a2418');
  const sideStripes = canvasMat(stripes(5));
  const topStripes = canvasMat(stripes(6, 4));

  // torso (BoxGeometry face order: +x, -x, +y, -y, +z, -z)
  const torso = mesh(roundedBox(0.62, 0.52, 0.96, 0.18), [sideStripes, sideStripes, topStripes, cream, orange, orange], 0, 0.56, 0);
  body.add(torso);
  body.add(mesh(roundedBox(0.44, 0.36, 0.2, 0.1), cream, 0, 0.5, 0.42)); // chest bib

  // head
  const neck = new THREE.Group();
  neck.position.set(0, 0.78, 0.38);
  body.add(neck);
  const head = new THREE.Group();
  head.position.set(0, 0.2, 0.06);
  neck.add(head);
  const faceMat = canvasMat((g, w, h) => {
    g.fillStyle = ORANGE;
    g.fillRect(0, 0, w, h);
    // tabby "M" on the forehead
    g.strokeStyle = STRIPE;
    g.lineWidth = 13;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(78, 20);
    g.lineTo(98, 62);
    g.lineTo(128, 34);
    g.lineTo(158, 62);
    g.lineTo(178, 20);
    g.stroke();
    // cheek stripes
    for (const sx of [-1, 1]) for (const k of [0, 1]) {
      g.beginPath();
      g.moveTo(128 + sx * 128, 128 + k * 26);
      g.lineTo(128 + sx * 92, 132 + k * 22);
      g.stroke();
    }
    // cream muzzle patch
    g.fillStyle = CREAM;
    g.beginPath();
    g.ellipse(128, 196, 74, 58, 0, 0, Math.PI * 2);
    g.fill();
  });
  const skull = mesh(roundedBox(0.76, 0.6, 0.62, 0.2), [sideStripes, sideStripes, topStripes, cream, faceMat, orange], 0, 0, 0);
  head.add(skull);
  // muzzle, nose, mouth
  head.add(mesh(roundedBox(0.3, 0.16, 0.12, 0.06), cream, 0, -0.14, 0.3));
  const nose = mesh(roundedBox(0.09, 0.06, 0.05, 0.02), pink, 0, -0.08, 0.37);
  head.add(nose);
  const mouth = mesh(roundedBox(0.1, 0.06, 0.04, 0.015), flat('#5b1e1e'), 0, -0.19, 0.35);
  mouth.scale.set(1, 0.2, 1);
  head.add(mouth);
  // eyes: big green squares with slit pupils and a shine, like a cartoon cat
  const eyes = [];
  for (const sx of [-1, 1]) {
    const e = new THREE.Group();
    e.position.set(sx * 0.17, 0.04, 0.315);
    const white = mesh(roundedBox(0.17, 0.19, 0.03, 0.06), flat('#fffdf6'));
    const iris = mesh(roundedBox(0.13, 0.15, 0.03, 0.05), flat(GREEN), 0, 0, 0.012);
    const pupil = mesh(roundedBox(0.04, 0.12, 0.02, 0.018), dark, 0, 0, 0.024);
    const shine = mesh(new THREE.BoxGeometry(0.035, 0.035, 0.01), new THREE.MeshBasicMaterial({ color: '#fff' }), sx * -0.03, 0.04, 0.036);
    const lid = mesh(roundedBox(0.19, 0.2, 0.04, 0.06), orange, 0, 0, 0.016);
    const lash = mesh(new THREE.BoxGeometry(0.16, 0.02, 0.01), dark, 0, -0.02, 0.04);
    lid.add(lash);
    lid.visible = false;
    e.add(white, iris, pupil, shine, lid);
    head.add(e);
    eyes.push({ e, lid, iris, pupil });
  }
  // ears: pyramids with pink insides
  for (const sx of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(0.15, 0.26, 4), orange, sx * 0.24, 0.36, -0.04);
    ear.rotation.set(-0.08, Math.PI / 4, -sx * 0.25);
    const inner = mesh(new THREE.ConeGeometry(0.09, 0.17, 4), pink, 0, -0.03, 0.055);
    ear.add(inner);
    head.add(ear);
  }
  // whiskers
  const wm = new THREE.LineBasicMaterial({ color: '#4a2a18' });
  for (const sx of [-1, 1])
    for (const k of [0, 1]) {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(sx * 0.15, -0.13 - k * 0.04, 0.36), new THREE.Vector3(sx * 0.48, -0.08 - k * 0.1, 0.3)]);
      head.add(new THREE.Line(g, wm));
    }
  // teal collar with a gold bell
  const collar = mesh(new THREE.TorusGeometry(0.27, 0.06, 6, 16), flat('#2a9d8f'), 0, -0.1, 0.1);
  collar.rotation.x = Math.PI / 2 - 0.35;
  neck.add(collar);
  neck.add(mesh(new THREE.SphereGeometry(0.06, 10, 8), flat('#ffd166'), 0, -0.26, 0.33));

  // legs: chunky with cream socks
  const legs = [];
  for (const [x, z] of [[-0.17, 0.3], [0.17, 0.3], [-0.17, -0.3], [0.17, -0.3]]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.48, z);
    pivot.add(mesh(roundedBox(0.17, 0.34, 0.18, 0.07), orange, 0, -0.17, 0));
    pivot.add(mesh(roundedBox(0.19, 0.12, 0.24, 0.06), cream, 0, -0.38, 0.03));
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
    seg.add(mesh(roundedBox(0.13 - k * 0.006, 0.17, 0.13 - k * 0.006, 0.05), flat(color), 0, 0.07, 0));

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
    x.font = "400 46px 'Lilita One', sans-serif";
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
// A chunky little grey mouse with big round ears and a yellow bandana.
export function createPip() {
  const root = new THREE.Group();
  const grey = flat('#b9b4bd'), light = flat('#d9d5dd'), pink = flat(PINK), dark = flat('#1d1d24');
  root.add(mesh(roundedBox(0.2, 0.16, 0.26, 0.07), grey, 0, 0.09, 0));
  root.add(mesh(roundedBox(0.13, 0.08, 0.1, 0.035), light, 0, 0.06, 0.08)); // tummy
  const head = new THREE.Group();
  head.position.set(0, 0.16, 0.12);
  root.add(head);
  head.add(mesh(roundedBox(0.17, 0.14, 0.15, 0.06), grey));
  head.add(mesh(roundedBox(0.08, 0.06, 0.06, 0.025), light, 0, -0.025, 0.08));
  head.add(mesh(roundedBox(0.035, 0.03, 0.03, 0.01), pink, 0, -0.005, 0.115));
  for (const sx of [-1, 1]) {
    const ear = mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.025, 16), grey, sx * 0.08, 0.1, -0.01);
    ear.rotation.x = Math.PI / 2;
    ear.rotation.z = sx * 0.3;
    ear.add(mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.02, 14), pink, 0, 0.008, 0));
    head.add(ear);
    head.add(mesh(roundedBox(0.03, 0.04, 0.02, 0.01), dark, sx * 0.045, 0.02, 0.075));
  }
  const tailCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.08, -0.12), new THREE.Vector3(0.05, 0.04, -0.25), new THREE.Vector3(-0.04, 0.1, -0.35), new THREE.Vector3(0.02, 0.18, -0.38)]);
  const tail = new THREE.Mesh(new THREE.TubeGeometry(tailCurve, 12, 0.01, 5), pink);
  root.add(tail);
  const band = mesh(new THREE.TorusGeometry(0.07, 0.016, 5, 12), flat('#ffd166'), 0, 0.13, 0.07);
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
      head.rotation.x = sleeping ? 0.35 : Math.sin(t * 1.7) * 0.12;
      tail.rotation.y = Math.sin(t * 3) * 0.3;
    },
  };
}

// ---------------- VISITOR ----------------
const HOODIES = ['#457b9d', '#e76f51', '#8e7cc3', '#2a9d8f', '#f4a261', '#e63946', '#06a77d'];
export function createVisitorOld(colorIndex = 0) {
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
  let t = 0, waveT = 0, bonkT = 0;
  return {
    root,
    body,
    wave() { waveT = 1.6; },
    bonk() { bonkT = 0.6; },
    animate(dt, moving, running) {
      t += dt * (running ? 1.5 : 1);
      waveT = Math.max(0, waveT - dt);
      bonkT = Math.max(0, bonkT - dt);
      const a = moving ? Math.sin(t * 10) * 0.7 : 0;
      limbs.forEach(({ arm, leg, sx }) => {
        arm.rotation.x = a * sx;
        leg.rotation.x = -a * sx;
        arm.rotation.z = sx * (moving ? 0.1 : 0.05 + Math.sin(t * 2) * 0.02);
        if (waveT > 0 && sx > 0) {
          arm.rotation.x = 0;
          arm.rotation.z = 2.6 + Math.sin(t * 14) * 0.35; // hand up, waving
        }
      });
      body.position.y = moving ? Math.abs(Math.sin(t * 10)) * 0.06 : Math.sin(t * 2) * 0.01;
      head.rotation.z = moving ? Math.sin(t * 5) * 0.05 : 0;
      // soft "boing" when something lands on them
      const b = bonkT > 0 ? Math.sin((0.6 - bonkT) * 26) * bonkT : 0;
      body.scale.set(1 + b * 0.25, 1 - b * 0.3, 1 + b * 0.25);
      if (bonkT > 0) head.rotation.z = Math.sin(bonkT * 30) * 0.15;
    },
  };
}

// ---------------------------------------------------------------------------------------------
// Visitors are Kenney "Mini Characters" (CC0): 12 rigged people with real animations
// (idle, walk, sprint, jump, emote...). Same interface as before: root, animate(), wave(), bonk().
const PEOPLE = ['female-a', 'male-a', 'female-b', 'male-b', 'female-c', 'male-c', 'female-d', 'male-d', 'female-e', 'male-e', 'female-f', 'male-f'];
const peopleLoader = new GLTFLoader();
const peopleRamp = (() => {
  const t = new THREE.DataTexture(new Uint8Array([125, 190, 240, 255]), 4, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
export function createVisitor(colorIndex = 0) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  // a soft shadow blob that is there even before the model arrives
  const blob = new THREE.Mesh(new THREE.CircleGeometry(0.42, 20), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.18, depthWrite: false }));
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.02;
  root.add(blob);
  let mixer = null, actions = {}, current = null, waveT = 0, bonkT = 0, emoteBusy = 0;
  const play = (name, fade = 0.18) => {
    const a = actions[name];
    if (!a || current === a) return;
    a.reset().fadeIn(fade).play();
    if (current) current.fadeOut(fade);
    current = a;
  };
  const name = PEOPLE[Math.abs(colorIndex) % PEOPLE.length];
  peopleLoader.loadAsync(`vendor/models/people/character-${name}.glb`).then((gltf) => {
    const m = gltf.scene;
    m.scale.setScalar(2.05);
    m.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.frustumCulled = false;
      const src = o.material;
      o.material = new THREE.MeshToonMaterial({ map: src.map || null, color: src.color?.clone() || new THREE.Color('#fff'), gradientMap: peopleRamp });
      if (o.material.map) o.material.map.colorSpace = THREE.SRGBColorSpace;
    });
    body.add(m);
    mixer = new THREE.AnimationMixer(m);
    for (const clip of gltf.animations) actions[clip.name] = mixer.clipAction(clip);
    for (const n of ['emote-yes', 'emote-no', 'jump', 'pick-up']) if (actions[n]) {
      actions[n].setLoop(THREE.LoopOnce);
      actions[n].clampWhenFinished = true;
    }
    play('idle', 0);
  }).catch((e) => console.warn('visitor model failed', e));
  return {
    root,
    body,
    wave() {
      waveT = 1.6;
      emoteBusy = 1.4;
      if (actions['emote-yes']) {
        current?.fadeOut(0.15);
        current = actions['emote-yes'];
        current.reset().fadeIn(0.15).play();
      }
    },
    bonk() {
      bonkT = 0.6;
    },
    animate(dt, moving, running) {
      waveT = Math.max(0, waveT - dt);
      bonkT = Math.max(0, bonkT - dt);
      emoteBusy = Math.max(0, emoteBusy - dt);
      if (mixer) {
        if (!(emoteBusy > 0 && !moving)) play(moving ? (running ? 'sprint' : 'walk') : 'idle');
        mixer.update(dt);
      }
      const b = bonkT > 0 ? Math.sin((0.6 - bonkT) * 26) * bonkT : 0;
      body.scale.set(1 + b * 0.25, 1 - b * 0.3, 1 + b * 0.25);
    },
  };
}

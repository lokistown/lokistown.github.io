// Furniture for every room kind. Each builder returns
// { group, blockers: [{x,z,w,d}] (room-local), spots: [{act, x, z, face, label}], items: [interactables], tick? }
import * as THREE from 'three';
import { toon, block, part, shade, paperTexture } from './toon.js';

const wood = '#a8754a', dark = '#5b3a29', cream = '#fff3dc';

function rug(g, w, d, color, x = 0, z = 0) {
  const r = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.04, 24), toon(color));
  r.scale.set(w / 2, 1, d / 2);
  r.position.set(x, 0.03, z);
  r.receiveShadow = true;
  g.add(r);
}
function plant(g, x, z, s = 1) {
  g.add(part(new THREE.CylinderGeometry(0.28 * s, 0.22 * s, 0.5 * s, 10), '#c96f4a', { x, y: 0.25 * s, z }));
  const leaves = ['#3f9a52', '#57b368', '#2f7f45'];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2;
    const l = part(new THREE.SphereGeometry(0.22 * s, 10, 8), leaves[k % 3], { x: x + Math.cos(a) * 0.15 * s, y: 0.65 * s + (k % 2) * 0.15 * s, z: z + Math.sin(a) * 0.15 * s, ink: 0.02 });
    l.scale.set(1, 1.4, 1);
    g.add(l);
  }
}
function lamp(g, x, z, h = 1.6) {
  g.add(block(0.08, h, 0.08, dark, x, h / 2, z, { ink: false }));
  const shadeM = part(new THREE.ConeGeometry(0.35, 0.4, 14, 1, true), '#ffe6a8', { x, y: h, z, ink: 0.02, mat: new THREE.MeshToonMaterial({ color: '#ffe6a8', emissive: '#ffcf6e', emissiveIntensity: 0.4, side: THREE.DoubleSide }) });
  g.add(shadeM);
}
function shelf(g, x, z, w, colors, rot = 0) {
  const s = new THREE.Group();
  s.add(block(w, 0.08, 0.4, wood, 0, 1.6, 0), block(w, 0.08, 0.4, wood, 0, 1.0, 0));
  for (let k = 0; k < Math.floor(w / 0.18); k++) {
    const h = 0.3 + ((k * 7) % 5) * 0.03;
    s.add(block(0.14, h, 0.3, colors[k % colors.length], -w / 2 + 0.12 + k * 0.18, 1.04 + h / 2, 0, { ink: false }));
  }
  s.position.set(x, 0, z);
  s.rotation.y = rot;
  g.add(s);
}
function frame(tex, w = 1.2, h = 1.2) {
  const f = new THREE.Group();
  f.add(block(w + 0.16, h + 0.16, 0.08, '#6b4226', 0, 0, 0));
  const mat = tex ? new THREE.MeshBasicMaterial({ map: tex }) : toon('#efe7da');
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  p.position.z = 0.05;
  f.add(p);
  return f;
}
const texLoader = new THREE.TextureLoader();
export function artTexture(file) {
  if (!file) return null;
  const t = texLoader.load(`gallery/${encodeURIComponent(file)}`);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function chair(g, x, z, rot, color = wood) {
  const c = new THREE.Group();
  c.add(block(0.6, 0.08, 0.6, color, 0, 0.5, 0), block(0.6, 0.6, 0.08, color, 0, 0.82, -0.26));
  for (const [a, b] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) c.add(block(0.06, 0.5, 0.06, dark, a, 0.25, b, { ink: false }));
  c.position.set(x, 0, z);
  c.rotation.y = rot;
  g.add(c);
}
function table(g, x, z, w = 1.4, d = 0.9, color = wood, round = false) {
  if (round) {
    g.add(part(new THREE.CylinderGeometry(w / 2, w / 2, 0.08, 18), color, { x, y: 0.78, z }));
    g.add(part(new THREE.CylinderGeometry(0.07, 0.12, 0.76, 8), dark, { x, y: 0.38, z, ink: 0 }));
  } else {
    g.add(block(w, 0.08, d, color, x, 0.78, z));
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(block(0.07, 0.76, 0.07, dark, x + a * (w / 2 - 0.08), 0.38, z + b * (d / 2 - 0.08), { ink: false }));
  }
}
function screen(g, x, y, z, w, h, color = '#5cc9bb') {
  g.add(block(w + 0.1, h + 0.1, 0.08, '#2b2d42', x, y, z));
  const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color }));
  s.position.set(x, y, z + 0.05);
  g.add(s);
  return s;
}
function notes() {
  // floating music notes (shown while Loki sings / plays)
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  x.font = '48px serif';
  x.fillStyle = '#e07a1f';
  x.fillText('♪', 14, 48);
  const tex = new THREE.CanvasTexture(c);
  const group = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    sp.scale.setScalar(0.45);
    sp.userData.phase = k / 3;
    group.add(sp);
  }
  return group;
}

// half = half the room size; walls are at +-half. Back wall is -z.
export const ROOMS = {
  hall(ctx, half) {
    const g = new THREE.Group();
    rug(g, 2.2, 1.4, '#e76f51', 0, half - 1.4);
    plant(g, -half + 0.7, half - 0.8);
    g.add(block(0.9, 0.9, 0.4, wood, half - 0.8, 0.45, -half + 0.4));
    const t = paperTexture('Welcome!', "This is Loki's house. Wipe your paws, look around, and say hi if you find him.", { w: 512, h: 380 });
    const n = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.96), new THREE.MeshBasicMaterial({ map: t }));
    n.position.set(0, 1.7, -half + 0.16);
    g.add(n);
    return { group: g, blockers: [{ x: half - 0.8, z: -half + 0.4, w: 0.9, d: 0.4 }], spots: [{ act: 'greet', x: 0, z: 0.3, face: 0, label: 'in the hallway' }] };
  },
  living(ctx, half) {
    const g = new THREE.Group();
    rug(g, 3, 2.2, '#2a9d8f', 0, 0.3);
    const sofa = new THREE.Group();
    sofa.add(block(2.4, 0.5, 0.9, '#e07a1f', 0, 0.3, 0), block(2.4, 0.7, 0.25, '#c4621a', 0, 0.75, -0.35), block(0.25, 0.65, 0.9, '#c4621a', -1.2, 0.45, 0), block(0.25, 0.65, 0.9, '#c4621a', 1.2, 0.45, 0));
    for (const x of [-0.6, 0.6]) sofa.add(part(new THREE.SphereGeometry(0.28, 12, 8), '#fff3dc', { x, y: 0.7, z: -0.1, ink: 0.02 }));
    sofa.position.set(0, 0, -half + 0.8);
    g.add(sofa);
    table(g, 0, 0.6, 1.2, 0.6, '#8d5b3c');
    g.add(part(new THREE.CylinderGeometry(0.12, 0.1, 0.12, 12), '#fff', { x: 0.3, y: 0.88, z: 0.6, ink: 0.015 }));
    // radio
    g.add(block(0.7, 0.45, 0.35, '#b5523b', half - 0.6, 0.98, -half + 0.4), block(0.5, 0.75, 0.4, wood, half - 0.6, 0.38, -half + 0.4));
    plant(g, -half + 0.6, -half + 0.6, 1.2);
    lamp(g, -half + 0.6, half - 0.8);
    return {
      group: g,
      blockers: [{ x: 0, z: -half + 0.8, w: 2.6, d: 1 }, { x: 0, z: 0.6, w: 1.2, d: 0.6 }, { x: half - 0.6, z: -half + 0.4, w: 0.7, d: 0.5 }],
      spots: [{ act: 'relax', x: 0, z: -half + 1.6, face: Math.PI, label: 'curled up on the sofa' }, { act: 'radio', x: half - 0.7, z: -half + 1.2, face: Math.PI, label: 'listening to the radio' }],
    };
  },
  kitchen(ctx, half) {
    const g = new THREE.Group();
    const counter = new THREE.Group();
    counter.add(block(half * 2 - 0.6, 0.9, 0.7, '#f1e3c8', 0, 0.45, 0), block(half * 2 - 0.5, 0.08, 0.78, '#7a8a8f', 0, 0.94, 0));
    counter.add(part(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 14), '#2b2d42', { x: -0.6, y: 1.0, z: 0, ink: 0.01 }));
    counter.add(part(new THREE.CylinderGeometry(0.17, 0.2, 0.25, 12), '#c4621a', { x: -0.6, y: 1.15, z: 0 }));
    counter.position.set(0, 0, -half + 0.45);
    g.add(counter);
    g.add(block(0.8, 1.9, 0.7, '#e9f5f7', half - 0.6, 0.95, -half + 0.45));
    g.add(block(0.05, 0.6, 0.05, '#7a8a8f', half - 0.95, 1.3, -half + 0.82, { ink: false }));
    table(g, -0.3, 0.8, 1.1, 1.1, '#d4a373', true);
    chair(g, -1.1, 0.8, Math.PI / 2);
    chair(g, 0.5, 0.8, -Math.PI / 2);
    // food bowl with fish
    g.add(part(new THREE.CylinderGeometry(0.3, 0.22, 0.15, 14), '#2a9d8f', { x: half - 0.8, y: 0.08, z: half - 1.1 }));
    const fish = part(new THREE.SphereGeometry(0.12, 10, 6), '#9ecae1', { x: half - 0.8, y: 0.2, z: half - 1.1, ink: 0.01 });
    fish.scale.set(1.6, 0.6, 0.8);
    g.add(fish);
    return {
      group: g,
      blockers: [{ x: 0, z: -half + 0.45, w: half * 2 - 0.6, d: 0.8 }, { x: half - 0.6, z: -half + 0.45, w: 0.8, d: 0.8 }, { x: -0.3, z: 0.8, w: 1.2, d: 1.2 }],
      spots: [{ act: 'eat', x: half - 1.4, z: half - 1.1, face: Math.PI / 2, label: 'eating fish from his bowl' }, { act: 'cook', x: -0.6, z: -half + 1.3, face: Math.PI, label: 'cooking something that smells of fish' }],
    };
  },
  bedroom(ctx, half) {
    const g = new THREE.Group();
    rug(g, 2.4, 2, '#9c89b8', 0, 0);
    const bed = new THREE.Group();
    bed.add(part(new THREE.CylinderGeometry(1.0, 1.1, 0.35, 20), '#2a9d8f'));
    bed.add(part(new THREE.CylinderGeometry(0.85, 0.85, 0.2, 20), cream, { y: 0.2 }));
    bed.children.forEach((c) => (c.position.y += 0.18));
    bed.position.set(-0.6, 0, -half + 1.3);
    g.add(bed);
    g.add(block(0.6, 0.6, 0.5, wood, half - 0.6, 0.3, -half + 0.4));
    lamp(g, half - 0.6, -half + 0.4, 0.95);
    shelf(g, 0.8, -half + 0.25, 1.6, ['#e63946', '#457b9d', '#ffd166', '#06d6a0']);
    // teacup bed for Pip
    g.add(part(new THREE.CylinderGeometry(0.22, 0.15, 0.22, 14), '#fff', { x: half - 0.6, y: 0.72, z: -half + 0.4, ink: 0.015 }));
    return {
      group: g,
      blockers: [{ x: -0.6, z: -half + 1.3, w: 2.1, d: 2.1, low: true }, { x: half - 0.6, z: -half + 0.4, w: 0.6, d: 0.5 }],
      spots: [{ act: 'sleep', x: -0.6, z: -half + 1.3, face: 0, label: 'asleep in his bed', inside: true }, { act: 'stretch', x: 0.4, z: 0.8, face: Math.PI, label: 'stretching after a nap' }],
    };
  },
  laundry(ctx, half) {
    const g = new THREE.Group();
    const drums = [];
    for (const x of [-0.9, 0.3]) {
      const m = new THREE.Group();
      m.add(block(1.05, 1.15, 0.9, '#f4f6f8', 0, 0.58, 0));
      m.add(block(1.0, 0.12, 0.25, '#cfd8dc', 0, 1.08, 0.3, { ink: false }));
      const door = part(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 20), '#b0bec5', { y: 0.55, z: 0.46, ink: 0.015 });
      door.rotation.x = Math.PI / 2;
      m.add(door);
      const drum = new THREE.Group();
      const glassM = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20), new THREE.MeshToonMaterial({ color: '#9ecae1' }));
      glassM.position.set(0, 0, 0);
      drum.add(glassM);
      for (let k = 0; k < 3; k++) {
        const sock = new THREE.Mesh(new THREE.CircleGeometry(0.08, 8), new THREE.MeshBasicMaterial({ color: ['#e63946', '#ffd166', '#2a9d8f'][k] }));
        sock.position.set(Math.cos(k * 2.1) * 0.16, Math.sin(k * 2.1) * 0.16, 0.01);
        drum.add(sock);
      }
      drum.position.set(0, 0.55, 0.5);
      m.add(drum);
      drums.push(drum);
      m.position.set(x, 0, -half + 0.55);
      g.add(m);
    }
    // basket + drying rack
    g.add(part(new THREE.CylinderGeometry(0.35, 0.28, 0.45, 14), '#d4a373', { x: half - 0.8, y: 0.23, z: half - 1 }));
    for (let k = 0; k < 4; k++) g.add(block(0.25, 0.12, 0.25, ['#ffd166', '#e63946', '#fff', '#457b9d'][k], half - 0.85 + (k % 2) * 0.12, 0.5, half - 1 + (k > 1 ? 0.1 : -0.05), { ink: false }));
    const rack = new THREE.Group();
    rack.add(block(0.06, 1.5, 0.06, dark, -0.7, 0.75, 0, { ink: false }), block(0.06, 1.5, 0.06, dark, 0.7, 0.75, 0, { ink: false }), block(1.5, 0.04, 0.04, '#999', 0, 1.45, 0, { ink: false }));
    for (let k = 0; k < 3; k++) rack.add(block(0.32, 0.5, 0.02, ['#e07a1f', '#2a9d8f', '#f4a3a3'][k], -0.45 + k * 0.45, 1.18, 0, { ink: false }));
    rack.position.set(-half + 0.5, 0, 0.6);
    rack.rotation.y = Math.PI / 2;
    g.add(rack);
    return {
      group: g,
      blockers: [{ x: -0.3, z: -half + 0.55, w: 2.4, d: 1 }, { x: half - 0.8, z: half - 1, w: 0.7, d: 0.7 }, { x: -half + 0.5, z: 0.6, w: 0.3, d: 1.6 }],
      spots: [{ act: 'laundry', x: -0.3, z: -half + 1.6, face: Math.PI, label: 'watching the washing machine spin' }],
      tick: (t, active) => drums.forEach((d, i) => (d.rotation.z = t * (active ? 6 : 1.2) * (i ? -1 : 1))),
    };
  },
  music(ctx, half) {
    const g = new THREE.Group();
    rug(g, 2.6, 2.2, '#3d405b', 0, 0.2);
    const piano = new THREE.Group();
    piano.add(block(1.8, 1.25, 0.6, '#2b2d42', 0, 0.62, 0), block(1.8, 0.06, 0.32, '#f8f9fa', 0, 0.82, 0.42, { ink: false }));
    for (let k = 0; k < 7; k++) piano.add(block(0.1, 0.07, 0.18, '#111', -0.75 + k * 0.25, 0.86, 0.38, { ink: false }));
    piano.add(block(1.0, 0.5, 0.4, '#2b2d42', 0, 0.25, 0.75));
    piano.position.set(-0.7, 0, -half + 0.4);
    g.add(piano);
    // mic stand
    g.add(block(0.04, 1.4, 0.04, '#555', half - 1.1, 0.7, 0.3, { ink: false }));
    g.add(part(new THREE.SphereGeometry(0.1, 10, 8), '#777', { x: half - 1.1, y: 1.45, z: 0.3, ink: 0.01 }));
    g.add(part(new THREE.CylinderGeometry(0.25, 0.3, 0.04, 14), '#333', { x: half - 1.1, y: 0.02, z: 0.3, ink: 0 }));
    // speakers + guitar
    for (const x of [half - 0.45, -half + 0.45]) {
      g.add(block(0.6, 1.0, 0.5, '#3d3d3d', x, 0.5, half - 0.6));
      g.add(part(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 14), '#888', { x, y: 0.55, z: half - 0.33, ink: 0 }).rotateX(Math.PI / 2));
    }
    const guitar = new THREE.Group();
    guitar.add(part(new THREE.SphereGeometry(0.28, 12, 8), '#d4a373', { y: 0.35 }), part(new THREE.SphereGeometry(0.2, 12, 8), '#d4a373', { y: 0.7 }), block(0.08, 0.8, 0.05, dark, 0, 1.2, 0, { ink: false }));
    guitar.children[0].scale.z = 0.4;
    guitar.children[1].scale.z = 0.4;
    guitar.position.set(half - 0.4, 0, -half + 0.5);
    guitar.rotation.z = 0.15;
    g.add(guitar);
    const n = notes();
    n.position.set(half - 1.1, 1.6, 0.3);
    n.visible = false;
    g.add(n);
    return {
      group: g,
      blockers: [{ x: -0.7, z: -half + 0.5, w: 1.9, d: 1.3 }, { x: half - 0.45, z: half - 0.6, w: 0.6, d: 0.5 }, { x: -half + 0.45, z: half - 0.6, w: 0.6, d: 0.5 }],
      spots: [{ act: 'sing', x: half - 1.1, z: 1.1, face: Math.PI, label: 'practising singing at the microphone' }, { act: 'piano', x: -0.7, z: -half + 1.5, face: Math.PI, label: 'playing the piano' }],
      items: [{ type: 'music', x: 0, z: 0.6, r: 2.6, label: 'Listen to Loki\'s music' }],
      tick: (t, active) => {
        n.visible = active;
        n.children.forEach((s) => {
          const k = (t * 0.5 + s.userData.phase) % 1;
          s.position.set(Math.sin(k * 6 + s.userData.phase * 9) * 0.4, k * 1.4, 0);
          s.material.opacity = 1 - k;
        });
      },
    };
  },
  studio(ctx, half) {
    const g = new THREE.Group();
    rug(g, 2.4, 2, '#ffd166', 0, 0);
    const easel = new THREE.Group();
    easel.add(block(0.07, 2, 0.07, wood, -0.5, 1, 0, { ink: false }), block(0.07, 2, 0.07, wood, 0.5, 1, 0, { ink: false }), block(0.07, 2, 0.07, wood, 0, 1, -0.45, { ink: false }));
    easel.children[2].rotation.x = -0.25;
    easel.add(block(1.2, 0.06, 0.15, wood, 0, 0.82, 0.04));
    const art = frame(artTexture(ctx.art[0]?.file), 1.05, 1.05);
    art.position.set(0, 1.42, 0.06);
    art.rotation.x = -0.08;
    easel.add(art);
    easel.position.set(0.2, 0, -half + 1.2);
    g.add(easel);
    // paint table with pots
    table(g, half - 0.8, 0.6, 0.9, 1.4, '#d4a373');
    ['#e63946', '#ffd166', '#2a9d8f', '#457b9d', '#f28c28'].forEach((c, k) => g.add(part(new THREE.CylinderGeometry(0.09, 0.09, 0.16, 10), c, { x: half - 0.95 + (k % 2) * 0.3, y: 0.9, z: 0.1 + k * 0.22, ink: 0.01 })));
    // stacked canvases
    for (let k = 0; k < 3; k++) {
      const f = frame(artTexture(ctx.art[k + 1]?.file), 0.8, 0.8);
      f.position.set(-half + 0.2, 0.5, -0.6 + k * 0.4);
      f.rotation.y = Math.PI / 2;
      f.rotation.x = -0.15;
      g.add(f);
    }
    return {
      group: g,
      blockers: [{ x: 0.2, z: -half + 1.2, w: 1.3, d: 0.8 }, { x: half - 0.8, z: 0.6, w: 0.9, d: 1.4 }],
      spots: [{ act: 'paint', x: 0.2, z: -half + 2.1, face: Math.PI, label: 'painting at his easel' }],
      items: [{ type: 'gallery', x: 0.2, z: -half + 2.4, r: 2.2, label: "Look at Loki's paintings" }],
    };
  },
  control(ctx, half) {
    const g = new THREE.Group();
    const desk = new THREE.Group();
    desk.add(block(2.6, 0.08, 0.9, '#3d405b', 0, 0.8, 0));
    for (const x of [-1.2, 1.2]) desk.add(block(0.08, 0.8, 0.85, '#2b2d42', x, 0.4, 0, { ink: false }));
    const screens = [screen(desk, -0.85, 1.35, -0.25, 0.75, 0.5, '#5cc9bb'), screen(desk, 0, 1.45, -0.3, 0.85, 0.55, '#ffd166'), screen(desk, 0.85, 1.35, -0.25, 0.75, 0.5, '#f28c28')];
    desk.position.set(0, 0, -half + 0.6);
    g.add(desk);
    chair(g, 0, -half + 1.5, Math.PI, '#e07a1f');
    // server rack with blinking lights
    const rack = block(0.8, 2, 0.7, '#2b2d42', half - 0.6, 1, half - 0.7);
    g.add(rack);
    const leds = [];
    for (let k = 0; k < 8; k++) {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.08), new THREE.MeshBasicMaterial({ color: '#06d6a0' }));
      l.position.set(half - 0.8 + (k % 2) * 0.3, 0.5 + Math.floor(k / 2) * 0.35, half - 1.06);
      l.rotation.y = Math.PI;
      g.add(l);
      leds.push(l);
    }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.5), new THREE.MeshBasicMaterial({ map: paperTexture('CONTROL', "Owner only · password", { w: 512, h: 140, bg: '#2b2d42', accent: '#ffd166' }) }));
    sign.position.set(0, 2.55, -half + 0.16);
    g.add(sign);
    return {
      group: g,
      blockers: [{ x: 0, z: -half + 0.6, w: 2.7, d: 1 }, { x: half - 0.6, z: half - 0.7, w: 0.8, d: 0.7 }],
      spots: [{ act: 'work', x: 0, z: -half + 1.6, face: Math.PI, label: 'checking his screens in the control room' }],
      items: [{ type: 'control', x: 0, z: -half + 1.8, r: 2.2, label: 'Open the Control Centre (owner)' }],
      tick: (t) => {
        leds.forEach((l, i) => l.material.color.set(Math.sin(t * 3 + i * 1.7) > 0 ? '#06d6a0' : '#1b4332'));
        screens.forEach((s, i) => s.material.color.setHSL(((t * 0.03 + i * 0.3) % 1), 0.55, 0.6));
      },
    };
  },
  workshop(ctx, half) {
    const g = new THREE.Group();
    const bench = new THREE.Group();
    bench.add(block(half * 2 - 1, 0.12, 0.9, '#b07a4f', 0, 0.9, 0));
    for (const x of [-(half - 0.7), half - 0.7]) bench.add(block(0.1, 0.9, 0.8, dark, x, 0.45, 0, { ink: false }));
    bench.add(block(0.5, 0.3, 0.3, '#e63946', -0.8, 1.1, 0), block(0.08, 0.08, 0.6, '#888', 0.4, 1.0, 0, { ink: false }), block(0.25, 0.15, 0.15, dark, 0.4, 1.05, 0.3, { ink: false }));
    bench.position.set(0, 0, -half + 0.55);
    g.add(bench);
    // tool wall
    const wallTools = new THREE.Group();
    for (let k = 0; k < 6; k++) wallTools.add(block(0.08, 0.5 + (k % 3) * 0.1, 0.04, ['#888', '#b5523b', '#457b9d'][k % 3], -1.2 + k * 0.48, 1.9, 0, { ink: false }));
    wallTools.position.set(0, 0, -half + 0.18);
    g.add(wallTools);
    // 3D printer
    const pr = new THREE.Group();
    pr.add(block(0.9, 0.9, 0.9, '#f8f9fa', 0, 0.45 + 0.6, 0), block(0.8, 0.6, 0.8, '#3d405b', 0, 0.3, 0));
    const nozzle = block(0.12, 0.12, 0.12, '#e07a1f', 0, 1.3, 0, { ink: false });
    pr.add(nozzle);
    pr.position.set(half - 0.7, 0, half - 0.9);
    g.add(pr);
    for (let k = 0; k < 3; k++) g.add(block(0.7, 0.55, 0.6, '#c68b59', -half + 0.6, 0.28 + k * 0.56, half - 0.8));
    return {
      group: g,
      blockers: [{ x: 0, z: -half + 0.55, w: half * 2 - 1, d: 0.9 }, { x: half - 0.7, z: half - 0.9, w: 0.9, d: 0.9 }, { x: -half + 0.6, z: half - 0.8, w: 0.7, d: 0.6 }],
      spots: [{ act: 'build', x: 0, z: -half + 1.5, face: Math.PI, label: 'building something at the workbench' }, { act: 'print', x: half - 0.7, z: half - 1.9, face: 0, label: 'watching the 3D printer' }],
      tick: (t, active) => (nozzle.position.x = Math.sin(t * (active ? 4 : 0.5)) * 0.3),
    };
  },
  storage(ctx, half) {
    const g = new THREE.Group();
    const blockers = [];
    for (let k = 0; k < 6; k++) {
      const x = -half + 0.7 + (k % 3) * 0.8, z = -half + 0.6 + Math.floor(k / 3) * 0.75;
      g.add(block(0.7, 0.6, 0.6, '#c68b59', x, 0.3, z));
      if (k < 3) g.add(block(0.6, 0.5, 0.5, '#b07a4f', x, 0.85, z));
    }
    blockers.push({ x: -half + 1.5, z: -half + 0.95, w: 2.4, d: 1.5 });
    shelf(g, half - 0.3, 0, 2.2, ['#ffd166', '#06d6a0', '#e76f51'], Math.PI / 2);
    blockers.push({ x: half - 0.3, z: 0, w: 0.4, d: 2.2 });
    return { group: g, blockers, spots: [{ act: 'tidy', x: 0, z: 0.8, face: Math.PI, label: 'tidying the storeroom' }] };
  },
  bakery(ctx, half) {
    const g = new THREE.Group();
    const oven = new THREE.Group();
    oven.add(part(new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), '#c96f4a', { y: 0.6 }));
    oven.add(block(2, 0.6, 2, '#b5523b', 0, 0.3, 0));
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.35, 14, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#ffb347' }));
    glow.position.set(0, 0.6, 1.0);
    oven.add(glow);
    oven.position.set(-half + 1.3, 0, -half + 1.2);
    g.add(oven);
    const counter = block(2.6, 1, 0.8, '#f1e3c8', half - 1.6, 0.5, 0.8);
    g.add(counter);
    for (let k = 0; k < 6; k++) {
      const b = part(new THREE.SphereGeometry(0.15, 10, 6), '#e0a458', { x: half - 2.6 + k * 0.4, y: 1.08, z: 0.8, ink: 0.01 });
      b.scale.set(1.5, 0.7, 1);
      g.add(b);
    }
    return {
      group: g,
      blockers: [{ x: -half + 1.3, z: -half + 1.2, w: 2.1, d: 2.1 }, { x: half - 1.6, z: 0.8, w: 2.6, d: 0.8 }],
      spots: [{ act: 'bake', x: -half + 1.3, z: -half + 2.8, face: Math.PI, label: 'baking fish buns' }],
    };
  },
  cafe(ctx, half) {
    const g = new THREE.Group();
    g.add(block(half * 2 - 1.2, 1, 0.7, '#8d5b3c', 0, 0.5, -half + 0.5));
    g.add(block(0.5, 0.6, 0.45, '#adb5bd', -0.8, 1.3, -half + 0.5));
    const blockers = [{ x: 0, z: -half + 0.5, w: half * 2 - 1.2, d: 0.7 }];
    const spots = [{ act: 'coffee', x: 0, z: -half + 1.4, face: Math.PI, label: 'making coffee (he only drinks milk)' }];
    for (const [x, z] of [[-1.3, 0.8], [1.3, 0.8], [0, half - 1.3]]) {
      table(g, x, z, 0.9, 0.9, '#f8f9fa', true);
      chair(g, x - 0.75, z, Math.PI / 2, '#e07a1f');
      chair(g, x + 0.75, z, -Math.PI / 2, '#e07a1f');
      blockers.push({ x, z, w: 1, d: 1 });
    }
    spots.push({ act: 'sit', x: -1.3, z: 1.6, face: Math.PI, label: 'sitting at a café table' });
    return { group: g, blockers, spots };
  },
  gallery(ctx, half, room) {
    const g = new THREE.Group();
    const idx = room.galleryOffset || 0;
    const slots = [[0, -half + 0.2, 0], [-half + 0.2, 0, Math.PI / 2], [half - 0.2, 0, -Math.PI / 2], [-1.5, -half + 0.2, 0], [1.5, -half + 0.2, 0]];
    slots.forEach(([x, z, r], k) => {
      const item = ctx.art[idx + k];
      const f = frame(artTexture(item?.file), 1.3, 1.3);
      f.position.set(x, 1.6, z);
      f.rotation.y = r;
      g.add(f);
    });
    g.add(block(1.6, 0.45, 0.6, '#3d6e9e', 0, 0.23, 0.6));
    return {
      group: g,
      blockers: [{ x: 0, z: 0.6, w: 1.6, d: 0.6 }],
      spots: [{ act: 'admire', x: 0, z: 0, face: Math.PI, label: 'admiring the art in the gallery' }],
      items: [{ type: 'gallery', x: 0, z: 1.4, r: 2.8, label: 'Browse the gallery' }],
    };
  },
  library(ctx, half) {
    const g = new THREE.Group();
    const cols = ['#e63946', '#457b9d', '#ffd166', '#06d6a0', '#8e7cc3', '#f28c28'];
    shelf(g, 0, -half + 0.25, half * 2 - 0.6, cols);
    shelf(g, -half + 0.25, 0, half * 2 - 1.2, cols, Math.PI / 2);
    const arm = new THREE.Group();
    arm.add(block(1, 0.45, 1, '#2a9d8f', 0, 0.3, 0), block(1, 0.7, 0.25, '#21867a', 0, 0.75, -0.4));
    arm.position.set(half - 1.1, 0, 0.8);
    arm.rotation.y = -Math.PI / 2;
    g.add(arm);
    lamp(g, half - 0.5, -0.4);
    return {
      group: g,
      blockers: [{ x: 0, z: -half + 0.25, w: half * 2 - 0.6, d: 0.45 }, { x: -half + 0.25, z: 0, w: 0.45, d: half * 2 - 1.2 }, { x: half - 1.1, z: 0.8, w: 1, d: 1 }],
      spots: [{ act: 'read', x: half - 1.9, z: 0.8, face: Math.PI / 2, label: 'reading in the library' }],
    };
  },
  shop(ctx, half) {
    const g = new THREE.Group();
    const cols = ['#f28c28', '#2a9d8f', '#ffd166', '#e63946'];
    shelf(g, 0, -half + 0.25, half * 2 - 0.8, cols);
    shelf(g, -half + 0.25, 0, half * 2 - 1.6, cols, Math.PI / 2);
    g.add(block(2.2, 1, 0.8, '#8d5b3c', half - 1.6, 0.5, 0.6));
    const reg = block(0.5, 0.35, 0.4, '#2b2d42', half - 1.0, 1.18, 0.6);
    g.add(reg);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2, 0.6), new THREE.MeshBasicMaterial({ map: paperTexture("Loki's Shop", 'Ko-fi · Gumroad', { w: 512, h: 150 }) }));
    sign.position.set(half - 1.6, 2.4, -half + 0.2);
    g.add(sign);
    return {
      group: g,
      blockers: [{ x: 0, z: -half + 0.25, w: half * 2 - 0.8, d: 0.45 }, { x: -half + 0.25, z: 0, w: 0.45, d: half * 2 - 1.6 }, { x: half - 1.6, z: 0.6, w: 2.2, d: 0.8 }],
      spots: [{ act: 'sell', x: half - 1.6, z: -0.4, face: 0, label: 'minding the shop counter' }],
      items: [{ type: 'shop', x: half - 1.6, z: 1.6, r: 2.4, label: "Visit Loki's shop" }],
    };
  },
  garden_room(ctx, half) {
    const g = new THREE.Group();
    for (let k = 0; k < 6; k++) plant(g, -half + 0.8 + (k % 3) * 1.6, -half + 0.8 + Math.floor(k / 3) * 1.4, 1.3);
    return { group: g, blockers: [{ x: 0, z: -half + 1.5, w: half * 2 - 1, d: 2 }], spots: [{ act: 'garden', x: 0, z: 0.8, face: Math.PI, label: 'watering his plants' }] };
  },
};

export function buildRoom(kind, ctx, half, room) {
  const f = ROOMS[kind] || ROOMS.living;
  const r = f(ctx, half, room);
  r.blockers ||= [];
  r.spots ||= [];
  r.items ||= [];
  return r;
}

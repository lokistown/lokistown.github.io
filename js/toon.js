// Shared look for Loki's Town: soft toon shading, ink outlines, painted signs.
import * as THREE from 'three';

// 4-step light ramp gives the cozy "storybook" shading.
const ramp = (() => {
  const data = new Uint8Array([90, 160, 215, 255]);
  const t = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

const cache = new Map();
export function toon(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!cache.has(key)) cache.set(key, new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...opts }));
  return cache.get(key);
}

export const INK = new THREE.MeshBasicMaterial({ color: '#2b1a10', side: THREE.BackSide });

// Inverted-hull outline for rounded, centred geometry (characters, props).
// The town now uses Kenney's outline-free style everywhere, so hand-made props match the kits.
export const OUTLINES = false;
export function outline(mesh, thickness = 0.035) {
  if (!OUTLINES) return mesh;
  const geo = mesh.geometry;
  if (!geo.boundingSphere) geo.computeBoundingSphere();
  const r = geo.boundingSphere.radius || 1;
  const o = new THREE.Mesh(geo, INK);
  o.scale.setScalar(1 + thickness / r);
  o.position.copy(geo.boundingSphere.center).multiplyScalar(-(thickness / r));
  o.raycast = () => {};
  o.userData.isOutline = true;
  mesh.add(o);
  return mesh;
}

// Crisp ink edges for boxy things (buildings, furniture).
const EDGE = new THREE.LineBasicMaterial({ color: '#2b1a10', transparent: true, opacity: 0.55 });
export function edges(mesh, angle = 30) {
  if (!OUTLINES) return mesh;
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, angle), EDGE);
  e.raycast = () => {};
  mesh.add(e);
  return mesh;
}

export function part(geo, color, { x = 0, y = 0, z = 0, ink = 0.03, shadow = true, mat = null } = {}) {
  const m = new THREE.Mesh(geo, mat || toon(color));
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  if (ink) outline(m, ink);
  return m;
}

export function block(w, h, d, color, x = 0, y = 0, z = 0, { ink = true, cast = true, mat = null } = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || toon(color));
  m.position.set(x, y, z);
  m.castShadow = cast;
  m.receiveShadow = true;
  if (ink) edges(m);
  return m;
}

export function shade(hex, l) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, l);
  return '#' + c.getHexString();
}

// ---------- text ----------
export const FONT = "'Lilita One', 'Nunito', system-ui, sans-serif"; // signs and titles
export const BODY = "'Nunito', system-ui, sans-serif"; // reading text
export async function fontsReady() {
  try {
    await document.fonts.load(`400 40px 'Lilita One'`);
    await document.fonts.load(`700 40px Nunito`);
    await document.fonts.load(`800 40px Nunito`);
  } catch {}
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// A painted wooden sign: plank texture, icon, name in Lilita One with outline.
export function signTexture(text, { icon = '', color = '#7a4a2a', ink = '#fff6e5' } = {}) {
  const W = 1024, H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  roundRect(g, 8, 8, W - 16, H - 16, 60);
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, shade(color, 0.08));
  grad.addColorStop(1, shade(color, -0.08));
  g.fillStyle = grad;
  g.fill();
  // wood grain
  g.save();
  g.clip();
  g.globalAlpha = 0.12;
  g.strokeStyle = '#000';
  for (let i = 0; i < 9; i++) {
    g.lineWidth = 3;
    g.beginPath();
    const y = 30 + i * 26;
    g.moveTo(0, y);
    for (let x = 0; x <= W; x += 64) g.lineTo(x, y + Math.sin(x / 90 + i) * 6);
    g.stroke();
  }
  g.restore();
  g.lineWidth = 14;
  g.strokeStyle = '#2b1a10';
  roundRect(g, 8, 8, W - 16, H - 16, 60);
  g.stroke();
  g.lineWidth = 5;
  g.strokeStyle = 'rgba(255,240,210,0.45)';
  roundRect(g, 26, 26, W - 52, H - 52, 44);
  g.stroke();
  // nails
  g.fillStyle = '#d8c49a';
  for (const x of [46, W - 46]) {
    g.beginPath();
    g.arc(x, H / 2, 10, 0, Math.PI * 2);
    g.fill();
  }
  // text
  let size = 118;
  const label = icon ? `${icon}  ${text}` : text;
  g.font = `400 ${size}px ${FONT}`;
  while (g.measureText(label).width > W - 150 && size > 40) {
    size -= 4;
    g.font = `400 ${size}px ${FONT}`;
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = size * 0.16;
  g.strokeStyle = '#2b1a10';
  g.strokeText(label, W / 2, H / 2 + 6);
  g.fillStyle = ink;
  g.fillText(label, W / 2, H / 2 + 6);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function signBoard(text, width = 4, opts = {}) {
  const g = new THREE.Group();
  const tex = signTexture(text, opts);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
  m.position.z = 0.06;
  g.add(m);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(width * 0.98, width / 4 * 0.94), toon('#5a361d'));
  back.rotation.y = Math.PI;
  g.add(back);
  return g;
}

// Paper note / board texture with title and wrapped body text.
export function paperTexture(title, body, { w = 768, h = 560, bg = '#fffaf0', accent = '#e07a1f' } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(120,90,60,0.08)';
  for (let y = 70; y < h; y += 44) g.fillRect(30, y, w - 60, 2);
  g.fillStyle = accent;
  g.font = `400 46px ${FONT}`;
  g.textBaseline = 'top';
  g.fillText(title.slice(0, 40), 32, 22);
  g.fillStyle = '#3b2416';
  g.font = `700 32px ${BODY}`;
  const words = String(body || '').split(/\s+/);
  let line = '', y = 92;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (g.measureText(test).width > w - 64 && line) {
      g.fillText(line, 32, y);
      y += 44;
      line = word;
      if (y > h - 50) {
        line = '…';
        break;
      }
    } else line = test;
  }
  g.fillText(line, 32, y);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

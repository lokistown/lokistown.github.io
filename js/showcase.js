// "Made by Loki": four little exhibits in the corners around the plaza. Everything Loki makes
// shows up here by itself: his newest pictures on the Art Wall, his games in arcade cabinets,
// his products on the shop stall, his songs on the jukebox, his stories on the book stand and
// his website on a big screen. Each thing can be walked up to and opened, and deep links
// (?go=art:..., ?go=game:...) bring you right in front of it.
import * as THREE from 'three';
import { block, part, toon, signBoard, paperTexture } from './toon.js';
import { artTexture } from './rooms.js';
import { bulbs } from './buildings.js';
import { kitModel } from './kit.js';

const FONT = "'Lilita One', 'Nunito', sans-serif";
const R = 11.4; // distance of each corner from the plaza centre (along x and z)

export const slugOf = {
  product: (p) => (p.preview || '').split('/').filter(Boolean).pop() || p.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40),
  song: (m) => m.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40),
  story: (s) => s.slug,
  game: (g) => g.slug,
  art: (a) => a.file,
};

function screenTexture(title, sub, { bg = '#1d1b3a', fg = '#ffd166', accent = '#4cc9f0', w = 512, h = 384 } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, bg);
  gr.addColorStop(1, '#0b0a1a');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(255,255,255,0.05)';
  for (let y = 0; y < h; y += 6) g.fillRect(0, y, w, 2); // scanlines
  g.textAlign = 'center';
  g.fillStyle = fg;
  let size = 58;
  g.font = `400 ${size}px ${FONT}`;
  const words = String(title).split(/\s+/);
  const lines = [];
  let line = '';
  for (const wd of words) {
    const t = line ? `${line} ${wd}` : wd;
    if (g.measureText(t).width > w - 50 && line) {
      lines.push(line);
      line = wd;
    } else line = t;
  }
  lines.push(line);
  const top = h / 2 - (lines.length - 1) * 32 - 20;
  lines.slice(0, 3).forEach((l, i) => g.fillText(l, w / 2, top + i * 64));
  g.fillStyle = accent;
  g.font = `400 34px ${FONT}`;
  g.fillText(sub, w / 2, h - 44);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const glow = (tex, w, h) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));

function plaque(text, w = 1.1) {
  const t = paperTexture(text, '', { w: 512, h: 96, bg: '#fff8ec' });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.19), new THREE.MeshBasicMaterial({ map: t }));
  return m;
}

// put a local (exhibit-space) point into the world
function place(group, lx, lz) {
  const v = new THREE.Vector3(lx, 0, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), group.rotation.y);
  return { x: group.position.x + v.x, z: group.position.z + v.z };
}
function corner(sx, sz) {
  const g = new THREE.Group();
  g.position.set(sx * R, 0, sz * R);
  g.rotation.y = Math.atan2(-sx, -sz); // front (+z) faces the plaza
  return g;
}

export function buildShowcase(group, D, isNew) {
  const colliders = [], items = [], places = [], spots = {}, markers = [];
  const add = (g, w, d) => {
    group.add(g);
    // exhibits sit at 45 degrees: a row of small boxes along their length blocks walking through
    for (let lx = -w / 2; lx <= w / 2 + 0.01; lx += 0.7) {
      const p = place(g, lx, 0);
      colliders.push({ x: p.x, z: p.z, hw: 0.5 * d, hd: 0.5 * d, h: 3 });
    }
  };
  const front = (g, lx, dist = 2.2) => {
    const p = place(g, lx, dist);
    return { x: p.x, z: p.z, face: g.rotation.y + Math.PI };
  };
  // one floating "NEW" label per exhibit, above its sign
  const newTag = (g, text, lx, y) => {
    const have = markers.find((m) => m.g === g);
    if (have) {
      if (!have.parts.includes(text)) have.parts.push(text);
      have.text = `NEW: ${have.parts.join(', ')}`;
      return;
    }
    const top = { art: 5.0, arcade: 4.0, shop: 4.3, music: 4.3, lab: 4.1 }[g.userData.kind] || 4.5;
    const p = place(g, 0, 0.2);
    markers.push({ g, parts: [text], text: `NEW: ${text}`, x: p.x, y: top, z: p.z });
  };

  // ---------- Art Wall (north-west) ----------
  {
    const g = corner(-1, -1);
    g.userData.kind = 'art';
    const W = 5.6;
    g.add(block(W + 0.4, 2.9, 0.25, '#7a4a2a', 0, 1.95, 0));
    g.add(block(W + 0.9, 0.22, 0.8, '#b5523b', 0, 3.5, 0.15));
    for (const x of [-W / 2, W / 2]) g.add(block(0.25, 3.4, 0.25, '#5b3a29', x, 1.7, 0.05));
    const s = signBoard("Loki's Art Wall", 3.2, { color: '#3d6e9e' });
    s.position.set(0, 4.05, 0.2);
    g.add(s);
    const art = (D.gallery || []).slice(0, 3);
    if (!art.length) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 1.6), new THREE.MeshBasicMaterial({ map: paperTexture('Coming soon', 'Loki is painting his first pictures.') }));
      m.position.set(0, 1.95, 0.14);
      g.add(m);
    }
    art.forEach((a, i) => {
      const x = (i - (art.length - 1) / 2) * 1.8;
      g.add(block(1.5, 1.5, 0.08, '#e9c46a', x, 2.15, 0.15, { ink: false }));
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.3), new THREE.MeshBasicMaterial({ map: artTexture(a.file) }));
      pic.position.set(x, 2.15, 0.2);
      g.add(pic);
      const pl = plaque(a.title.slice(0, 28));
      pl.position.set(x, 1.1, 0.14);
      g.add(pl);
      const spot = front(g, x, 2.0);
      spots[`art:${a.file}`] = spot;
      items.push({ type: 'thing', kind: 'art', data: a, x: spot.x, z: spot.z, r: 1.1, label: `Look at "${a.title}"` });
      if (isNew(a.date)) newTag(g, 'picture', x, 3.2);
    });
    spots['art:*'] = front(g, 0, 2.4);
    places.push({ id: 'show:art', building: 'plaza', act: 'admire', label: 'admiring his pictures on the Art Wall', where: 'the Art Wall', ...spots['art:*'], inside: false });
    add(g, W + 0.8, 1);
  }

  // ---------- Arcade (north-east) ----------
  {
    const g = corner(1, -1);
    g.userData.kind = 'arcade';
    const games = (D.games || []).slice(0, 3);
    const list = games.length ? games : [{ title: 'Coming soon', soon: true }];
    const cols = ['#e63946', '#3a86ff', '#8338ec'];
    list.forEach((gm, i) => {
      const x = (i - (list.length - 1) / 2) * 1.35;
      const cab = new THREE.Group();
      cab.position.x = x;
      const c = cols[i % cols.length];
      cab.add(block(1.05, 1.95, 0.9, c, 0, 0.98, 0));
      cab.add(block(1.1, 0.42, 0.95, '#1d1b3a', 0, 2.1, 0.02));
      const top = glow(screenTexture(gm.soon ? 'LOKI ARCADE' : gm.title, '', { w: 512, h: 128, bg: c }), 0.95, 0.3);
      top.position.set(0, 2.12, 0.5);
      cab.add(top);
      const scr = glow(screenTexture(gm.title, gm.soon ? 'Loki is coding...' : 'PRESS E TO PLAY'), 0.82, 0.62);
      scr.position.set(0, 1.45, 0.455);
      scr.rotation.x = -0.12;
      cab.add(scr);
      cab.add(block(0.95, 0.12, 0.35, '#2b2d42', 0, 1.02, 0.55));
      cab.add(part(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 8), '#2b1a10', { x: -0.22, y: 1.14, z: 0.55, ink: 0 }));
      cab.add(part(new THREE.SphereGeometry(0.06, 10, 8), '#e63946', { x: -0.22, y: 1.22, z: 0.55, ink: 0 }));
      for (const bx of [0.08, 0.24]) cab.add(part(new THREE.CylinderGeometry(0.05, 0.05, 0.04, 12), bx > 0.1 ? '#ffd166' : '#06d6a0', { x: bx, y: 1.1, z: 0.55, ink: 0 }));
      g.add(cab);
      if (!gm.soon) {
        const spot = front(g, x, 1.9);
        spots[`game:${gm.slug}`] = spot;
        items.push({ type: 'thing', kind: 'game', data: gm, x: spot.x, z: spot.z, r: 0.9, label: `Play "${gm.title}"` });
        if (isNew(gm.date || gm.created)) newTag(g, 'game', x, 2.9);
      }
    });
    const s = signBoard('Pixel Paws Arcade', 3, { color: '#2b2d42', ink: '#ffd166' });
    s.position.set(0, 3.05, -0.2);
    g.add(s, block(0.12, 1.2, 0.12, '#3b3b45', -1.3, 2.4, -0.3), block(0.12, 1.2, 0.12, '#3b3b45', 1.3, 2.4, -0.3));
    spots['game:*'] = front(g, 0, 2.3);
    places.push({ id: 'show:arcade', building: 'plaza', act: 'play', label: 'playing one of his own games at the arcade', where: 'the arcade corner', ...spots['game:*'], inside: false });
    add(g, list.length * 1.35, 1);
  }

  // ---------- Shop stall (south-east) ----------
  {
    const g = corner(1, 1);
    g.userData.kind = 'shop';
    const W = 4.8;
    g.add(block(W, 1.0, 1.0, '#8a5a3b', 0, 0.5, 0));
    g.add(block(W + 0.1, 0.1, 1.1, '#c69c6d', 0, 1.05, 0));
    for (const x of [-W / 2 + 0.1, W / 2 - 0.1]) g.add(block(0.14, 2.6, 0.14, '#5b3a29', x, 1.3, -0.4));
    for (let k = 0; k < 8; k++) {
      const st = block(W / 8, 0.08, 1.6, k % 2 ? '#fff8ec' : '#e76f51', -W / 2 + W / 16 + (k * W) / 8, 2.7, 0.2, { ink: false });
      st.rotation.x = 0.25;
      g.add(st);
    }
    const s = signBoard("Loki's Corner Shop", 3.2, { color: '#e07a1f' });
    s.position.set(0, 3.25, -0.4);
    g.add(s);
    const prods = (D.products || []).filter((p) => p.status !== 'needs_work').slice(0, 4);
    if (!prods.length) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.9), new THREE.MeshBasicMaterial({ map: paperTexture('Opening soon', 'Loki is making things to sell.', { w: 512, h: 192 }) }));
      m.position.set(0, 1.6, -0.3);
      g.add(m);
    }
    prods.forEach((p, i) => {
      const x = (i - (prods.length - 1) / 2) * 1.1;
      const box = new THREE.Group();
      box.position.set(x, 1.1, 0);
      const col = p.type === 'template' ? '#3a86ff' : p.type === 'art_pack' ? '#ef476f' : '#2a9d8f';
      box.add(block(0.8, 0.9, 0.18, col, 0, 0.45, 0));
      const cover = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.8), new THREE.MeshBasicMaterial({ map: paperTexture(p.title.slice(0, 22), p.type === 'template' ? 'website template' : p.type === 'art_pack' ? 'art pack' : 'digital download', { w: 384, h: 440, accent: col }) }));
      cover.position.set(0, 0.45, 0.1);
      box.add(cover);
      box.rotation.x = -0.15;
      const tag = plaque(`${p.status === 'listed' ? '' : 'soon · '}$${p.price || '?'}`, 0.7);
      tag.position.set(0, -0.02, 0.52);
      tag.rotation.x = -0.5;
      g.add(box, tag);
      tag.position.x = x;
      const spot = front(g, x, 1.8);
      spots[`product:${slugOf.product(p)}`] = spot;
      items.push({ type: 'thing', kind: 'product', data: p, x: spot.x, z: spot.z, r: 0.8, label: `Look at "${p.title}"` });
      if (isNew(p.created)) newTag(g, 'in the shop', x, 2.4);
    });
    spots['product:*'] = front(g, 0, 2.3);
    places.push({ id: 'show:shop', building: 'plaza', act: 'work', label: 'tidying the shelves of his shop stall', where: "Loki's Corner Shop", ...spots['product:*'], inside: false });
    add(g, W, 1.2);
  }

  // ---------- Music & stories corner (south-west): jukebox, book stand, website screen ----------
  {
    const g = corner(-1, 1);
    g.userData.kind = 'music';
    // jukebox
    const jb = new THREE.Group();
    jb.position.x = -1.7;
    jb.add(block(1.1, 1.5, 0.7, '#9b2226', 0, 0.75, 0));
    const arch = part(new THREE.CylinderGeometry(0.55, 0.55, 0.7, 24, 1, false, 0, Math.PI), '#ffb703', { y: 1.5, ink: 0.02 });
    arch.rotation.z = Math.PI / 2;
    arch.rotation.y = Math.PI / 2;
    jb.add(arch);
    const songs = (D.music || []).slice(0, 4);
    const list = glow(screenTexture(songs.map((m) => m.title).join(' · ') || 'No songs yet', `${(D.music || []).length} songs by Loki`, { bg: '#3d0e10', fg: '#ffd166', accent: '#ffb3c6' }), 0.9, 0.62);
    list.position.set(0, 1.0, 0.36);
    jb.add(list);
    for (let k = 0; k < 5; k++) jb.add(part(new THREE.SphereGeometry(0.05, 8, 6), '#fff', { x: -0.4 + k * 0.2, y: 0.35, z: 0.36, mat: bulbs, ink: 0 }));
    g.add(jb);
    const js = front(g, -1.7, 1.8);
    spots['song:*'] = js;
    items.push({ type: 'thing', kind: 'music', x: js.x, z: js.z, r: 1, label: 'Play the jukebox' });
    (D.music || []).forEach((m) => (spots[`song:${slugOf.song(m)}`] = js));
    if (isNew(D.music?.[0]?.date)) newTag(g, 'song', -1.7, 2.6);
    // book stand
    const bs = new THREE.Group();
    bs.position.x = 0.15;
    bs.add(block(1.3, 1.0, 0.6, '#6b4226', 0, 0.5, 0));
    const lect = block(1.2, 0.08, 0.8, '#8a5a3b', 0, 1.1, 0.05);
    lect.rotation.x = -0.45;
    bs.add(lect);
    const stories = (D.stories || []).slice(0, 2);
    const cover = new THREE.Mesh(new THREE.PlaneGeometry(1.05, 0.68), new THREE.MeshBasicMaterial({ map: paperTexture(stories[0]?.title || "Loki's stories", stories[0]?.blurb || 'Loki is writing his first story.', { w: 512, h: 330, accent: '#2a9d8f' }) }));
    cover.position.set(0, 1.16, 0.06);
    cover.rotation.x = -0.45 - Math.PI / 2 + Math.PI / 2;
    bs.add(cover);
    g.add(bs);
    const bspot = front(g, 0.15, 1.8);
    spots['story:*'] = bspot;
    for (const st of D.stories || []) spots[`story:${st.slug}`] = bspot;
    items.push({ type: 'thing', kind: stories.length ? 'story' : 'stories', data: stories[0], x: bspot.x, z: bspot.z, r: 0.9, label: stories.length ? `Read "${stories[0].title}"` : "Loki's stories" });
    if (stories[0] && isNew(stories[0].date)) newTag(g, 'story', 0.15, 2.0);
    // website screen
    const ws = new THREE.Group();
    ws.position.x = 1.95;
    ws.add(block(0.14, 1.4, 0.14, '#3b3b45', 0, 0.7, -0.05));
    ws.add(block(1.7, 1.15, 0.12, '#2b2d42', 0, 1.95, 0));
    const site = D.state?.website;
    const scr = glow(screenTexture(site?.version ? "Loki's website" : 'Website coming soon', site?.version ? `version ${site.version} · tap to visit` : 'Loki is designing it', { bg: '#0f4c5c', fg: '#ffffff', accent: '#ffd166' }), 1.55, 1.0);
    scr.position.set(0, 1.95, 0.07);
    ws.add(scr);
    g.add(ws);
    const wspot = front(g, 1.95, 1.8);
    spots.home = wspot;
    items.push({ type: 'thing', kind: 'website', x: wspot.x, z: wspot.z, r: 0.9, label: "Visit Loki's website" });
    if (site && isNew(site.updated)) newTag(g, 'website', 1.95, 2.9);
    const s = signBoard('Songs & Stories', 3, { color: '#6a4c93' });
    s.position.set(0, 3.25, -0.35);
    g.add(s, block(0.12, 1.3, 0.12, '#3b3b45', -1.4, 2.6, -0.4), block(0.12, 1.3, 0.12, '#3b3b45', 1.4, 2.6, -0.4));
    places.push({ id: 'show:music', building: 'plaza', act: 'listen', label: 'listening to his songs on the jukebox', where: 'the Songs & Stories corner', ...js, inside: false });
    add(g, 4.8, 1);
  }
  // ---------- Loki's Lab (east side of the square): his own inventions ----------
  {
    const g = new THREE.Group();
    g.userData.kind = 'lab';
    g.position.set(11.6, 0, -4.2);
    g.rotation.y = -Math.PI / 2; // faces the fountain
    kitModel('stall-green', { scale: 2.8 }).then((m) => g.add(m));
    const made = (D.made || []).slice(0, 3);
    const scr = glow(screenTexture(made[0]?.title || 'Inventing…', made[0] ? made[0].kind : 'something new soon', { bg: '#20124d', fg: '#ffd166', accent: '#7ef7c7' }), 1.9, 1.2);
    scr.position.set(0, 2.15, 0.05);
    g.add(scr, block(2.05, 1.35, 0.1, '#3b2a5e', 0, 2.15, -0.02));
    const s = signBoard("Loki's Lab", 2.6, { color: '#5b3f8c' });
    s.position.set(0, 3.25, 0);
    g.add(s);
    group.add(g);
    colliders.push({ x: g.position.x, z: g.position.z, hw: 1.5, hd: 1.5, h: 3 });
    const spot = front(g, 0, 2.3);
    spots['made:*'] = spot;
    for (const m of D.made || []) spots[`made:${m.slug}`] = spot;
    items.push({ type: 'thing', kind: made.length ? 'made' : 'lab', data: made[0], x: spot.x, z: spot.z, r: 1.2, label: made.length ? `Try "${made[0].title}"` : "Loki's Lab" });
    if (made[0] && isNew(made[0].date)) newTag(g, 'invention', 0, 4);
    places.push({ id: 'show:lab', building: 'plaza', act: 'work', label: 'tinkering with a new invention in his lab', where: "Loki's Lab", ...spot, inside: false });
  }
  return { colliders, items, places, spots, markers };
}

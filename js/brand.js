// Shop-front logos: every business in town gets a real brand (name + drawn logo + style),
// like a high street. Loki invents brands for the places he builds.
import * as THREE from 'three';
import { FONT } from './toon.js';

export const DEFAULT_BRANDS = {
  bakery: { name: 'Purrfect Crust', tagline: 'bakery · est. 2026', style: 'badge', color: '#7a3e1d', accent: '#f6c28b', icon: 'croissant' },
  workshop: { name: 'Paws & Hammers', tagline: 'workshop & co.', style: 'plate', color: '#2b2d42', accent: '#f4a261', icon: 'hammer' },
  gallery: { name: 'The Whisker Gallery', tagline: 'fine pixel art', style: 'serif', color: '#1d3557', accent: '#f1faee', icon: 'frame' },
  market: { name: 'Fishbone Market', tagline: 'fresh every day', style: 'banner', color: '#c1121f', accent: '#fff3dc', icon: 'fish' },
  cafe: { name: 'Milk & Mittens', tagline: 'café', style: 'script', color: '#2a9d8f', accent: '#fff8ec', icon: 'cup' },
  library: { name: 'Nine Lives Library', tagline: 'books & naps', style: 'serif', color: '#4a3f6b', accent: '#ffd166', icon: 'book' },
  shop: { name: "Loki's Corner Shop", tagline: 'made by a cat', style: 'neon', color: '#3d1a78', accent: '#ff5fa2', icon: 'bag' },
  arcade: { name: 'Pixel Paws Arcade', tagline: 'games by Loki', style: 'neon', color: '#10002b', accent: '#4cc9f0', icon: 'joystick' },
  tower: { name: 'Stargazer Tower', tagline: 'look up', style: 'serif', color: '#22223b', accent: '#c9ada7', icon: 'star' },
  other: { name: 'Loki & Co.', tagline: '', style: 'plate', color: '#5b3a29', accent: '#ffd166', icon: 'paw' },
};

function icon(g, kind, x, y, s, color) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.fillStyle = color;
  g.strokeStyle = color;
  g.lineWidth = 6;
  g.lineCap = g.lineJoin = 'round';
  g.beginPath();
  switch (kind) {
    case 'croissant':
      for (let k = -2; k <= 2; k++) {
        g.beginPath();
        g.ellipse(k * 14, Math.abs(k) * 6, 11, 18 - Math.abs(k) * 3, k * 0.35, 0, Math.PI * 2);
        g.fill();
      }
      break;
    case 'hammer':
      g.fillRect(-4, -10, 8, 46);
      g.fillRect(-24, -26, 48, 18);
      break;
    case 'frame':
      g.lineWidth = 8;
      g.strokeRect(-26, -22, 52, 44);
      g.beginPath();
      g.moveTo(-18, 14);
      g.lineTo(-4, -4);
      g.lineTo(6, 8);
      g.lineTo(12, 0);
      g.lineTo(20, 14);
      g.stroke();
      g.beginPath();
      g.arc(12, -10, 5, 0, Math.PI * 2);
      g.fill();
      break;
    case 'fish':
      g.ellipse(0, 0, 26, 14, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(22, 0);
      g.lineTo(38, -14);
      g.lineTo(38, 14);
      g.closePath();
      g.fill();
      break;
    case 'cup':
      g.fillRect(-20, -12, 32, 30);
      g.lineWidth = 6;
      g.beginPath();
      g.arc(16, 2, 9, -Math.PI / 2, Math.PI / 2);
      g.stroke();
      for (const sx of [-12, -2, 8]) {
        g.beginPath();
        g.moveTo(sx, -18);
        g.quadraticCurveTo(sx + 6, -26, sx, -34);
        g.stroke();
      }
      break;
    case 'book':
      g.fillRect(-26, -18, 24, 36);
      g.fillRect(2, -18, 24, 36);
      break;
    case 'bag':
      g.fillRect(-22, -10, 44, 34);
      g.lineWidth = 6;
      g.beginPath();
      g.arc(0, -10, 12, Math.PI, 0);
      g.stroke();
      break;
    case 'joystick':
      g.fillRect(-26, 10, 52, 14);
      g.fillRect(-3, -14, 6, 26);
      g.beginPath();
      g.arc(0, -18, 9, 0, Math.PI * 2);
      g.fill();
      break;
    case 'star':
      for (let k = 0; k < 10; k++) {
        const r = k % 2 ? 11 : 26, a = (k / 10) * Math.PI * 2 - Math.PI / 2;
        k ? g.lineTo(Math.cos(a) * r, Math.sin(a) * r) : g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.closePath();
      g.fill();
      break;
    default: // paw
      g.beginPath();
      g.ellipse(0, 8, 16, 13, 0, 0, Math.PI * 2);
      g.fill();
      for (const [px, py] of [[-18, -10], [-6, -20], [6, -20], [18, -10]]) {
        g.beginPath();
        g.ellipse(px, py, 6, 8, 0, 0, Math.PI * 2);
        g.fill();
      }
  }
  g.restore();
}

function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

export function logoTexture(brand) {
  const b = { ...DEFAULT_BRANDS.other, ...brand };
  const W = 1024, H = 320;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const fit = (text, font, maxW, size) => {
    let s = size;
    g.font = font.replace('$', s);
    while (g.measureText(text).width > maxW && s > 24) {
      s -= 4;
      g.font = font.replace('$', s);
    }
    return s;
  };
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (b.style === 'badge') {
    g.fillStyle = b.accent;
    rr(g, 20, 20, W - 40, H - 40, 140);
    g.fill();
    g.lineWidth = 14;
    g.strokeStyle = b.color;
    g.stroke();
    g.lineWidth = 4;
    rr(g, 44, 44, W - 88, H - 88, 120);
    g.stroke();
    icon(g, b.icon, 150, H / 2, 1.9, b.color);
    g.fillStyle = b.color;
    fit(b.name, `700 $px Georgia, 'Times New Roman', serif`, W - 330, 96);
    g.fillText(b.name, W / 2 + 70, H / 2 - 18);
    g.font = `600 40px ${FONT}`;
    g.fillText(b.tagline.toUpperCase(), W / 2 + 70, H / 2 + 62);
  } else if (b.style === 'banner') {
    g.fillStyle = b.color;
    g.beginPath();
    g.moveTo(20, 60);
    g.lineTo(W - 20, 60);
    g.lineTo(W - 80, H / 2);
    g.lineTo(W - 20, H - 60);
    g.lineTo(20, H - 60);
    g.lineTo(80, H / 2);
    g.closePath();
    g.fill();
    for (let k = 0; k < 12; k++) {
      g.fillStyle = k % 2 ? b.color : b.accent;
      g.fillRect(100 + k * 69, 20, 69, 34);
    }
    icon(g, b.icon, 190, H / 2, 1.8, b.accent);
    g.fillStyle = b.accent;
    fit(b.name, `800 $px ${FONT}`, W - 420, 104);
    g.fillText(b.name, W / 2 + 60, H / 2 - 8);
    g.font = `500 34px ${FONT}`;
    g.fillText(b.tagline, W / 2 + 60, H / 2 + 62);
  } else if (b.style === 'neon') {
    g.fillStyle = '#120a1f';
    rr(g, 10, 10, W - 20, H - 20, 40);
    g.fill();
    g.shadowColor = b.accent;
    g.shadowBlur = 30;
    g.strokeStyle = b.accent;
    g.lineWidth = 8;
    rr(g, 34, 34, W - 68, H - 68, 30);
    g.stroke();
    icon(g, b.icon, 150, H / 2, 1.7, b.accent);
    g.fillStyle = '#ffffff';
    fit(b.name, `700 $px ${FONT}`, W - 330, 100);
    g.fillText(b.name, W / 2 + 70, H / 2 - 10);
    g.fillStyle = b.accent;
    g.font = `600 36px ${FONT}`;
    g.fillText(b.tagline.toUpperCase(), W / 2 + 70, H / 2 + 66);
    g.shadowBlur = 0;
  } else if (b.style === 'script') {
    g.fillStyle = b.color;
    rr(g, 20, 30, W - 40, H - 60, 60);
    g.fill();
    g.strokeStyle = b.accent;
    g.lineWidth = 6;
    g.setLineDash([18, 12]);
    rr(g, 46, 56, W - 92, H - 112, 44);
    g.stroke();
    g.setLineDash([]);
    icon(g, b.icon, 160, H / 2 + 6, 1.7, b.accent);
    g.fillStyle = b.accent;
    fit(b.name, `italic 700 $px 'Brush Script MT', 'Segoe Script', cursive`, W - 330, 120);
    g.fillText(b.name, W / 2 + 70, H / 2 - 4);
    g.font = `600 34px ${FONT}`;
    g.fillText(b.tagline.toUpperCase(), W / 2 + 70, H / 2 + 70);
  } else if (b.style === 'serif') {
    g.fillStyle = b.color;
    g.fillRect(16, 16, W - 32, H - 32);
    g.strokeStyle = '#c9a227';
    g.lineWidth = 10;
    g.strokeRect(34, 34, W - 68, H - 68);
    icon(g, b.icon, 140, H / 2, 1.6, '#c9a227');
    g.fillStyle = b.accent;
    fit(b.name, `600 $px Georgia, 'Times New Roman', serif`, W - 300, 92);
    g.fillText(b.name, W / 2 + 60, H / 2 - 14);
    g.fillStyle = '#c9a227';
    g.font = `italic 36px Georgia, serif`;
    g.fillText(b.tagline, W / 2 + 60, H / 2 + 60);
  } else {
    // plate
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#5c677d');
    grad.addColorStop(1, b.color);
    g.fillStyle = grad;
    rr(g, 16, 40, W - 32, H - 80, 24);
    g.fill();
    g.fillStyle = '#c0c6cf';
    for (const [x, y] of [[50, 74], [W - 50, 74], [50, H - 74], [W - 50, H - 74]]) {
      g.beginPath();
      g.arc(x, y, 10, 0, Math.PI * 2);
      g.fill();
    }
    icon(g, b.icon, 160, H / 2, 1.6, b.accent);
    g.fillStyle = '#ffffff';
    fit(b.name.toUpperCase(), `800 $px ${FONT}`, W - 340, 88);
    g.fillText(b.name.toUpperCase(), W / 2 + 70, H / 2 - 10);
    g.fillStyle = b.accent;
    g.font = `600 34px ${FONT}`;
    g.fillText(b.tagline.toUpperCase(), W / 2 + 70, H / 2 + 52);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function logoSign(brand, width = 3.6) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, width * 0.3125), new THREE.MeshBasicMaterial({ map: logoTexture(brand), transparent: true }));
  return m;
}

// House-number plaque for homes (Loki's house is "No. 7", with a small "Loki & Pip" letterbox).
export function housePlaque(number = '7', names = 'Loki & Pip') {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#1d3557';
  g.beginPath();
  g.roundRect(8, 8, 496, 240, 40);
  g.fill();
  g.strokeStyle = '#f1faee';
  g.lineWidth = 8;
  g.beginPath();
  g.roundRect(26, 26, 460, 204, 30);
  g.stroke();
  g.fillStyle = '#f1faee';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `700 120px Georgia, serif`;
  g.fillText(`No. ${number}`, 256, 110);
  g.font = `500 40px ${FONT}`;
  g.fillText(names, 256, 196);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.45), new THREE.MeshBasicMaterial({ map: t }));
}

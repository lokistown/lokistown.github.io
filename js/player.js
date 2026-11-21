// The visitor: a small round traveller you walk around as (third person).
// Keyboard (WASD / arrows, Shift to run), mouse drag to look, wheel to zoom,
// and on phones a joystick on the left + drag on the right to look.
import * as THREE from 'three';
import { mat, mesh } from './world.js';

export function createVisitor() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const b = mesh(new THREE.CapsuleGeometry(0.42, 0.45, 4, 10), mat('#a8dadc'));
  b.position.y = 0.72;
  body.add(b);
  const belly = mesh(new THREE.SphereGeometry(0.3, 8, 6), mat('#f1faee'));
  belly.position.set(0, 0.62, 0.22);
  belly.scale.set(1, 1.1, 0.6);
  body.add(belly);
  for (const sx of [-1, 1]) {
    const e = mesh(new THREE.SphereGeometry(0.07, 6, 4), mat('#1d3557'));
    e.position.set(sx * 0.15, 1.05, 0.36);
    body.add(e);
    const foot = mesh(new THREE.SphereGeometry(0.14, 6, 4), mat('#457b9d'));
    foot.position.set(sx * 0.2, 0.1, 0.05);
    foot.scale.set(1, 0.6, 1.4);
    body.add(foot);
    foot.userData.side = sx;
  }
  const hat = mesh(new THREE.SphereGeometry(0.4, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat('#e63946'));
  hat.position.y = 1.18;
  body.add(hat);
  const pom = mesh(new THREE.IcosahedronGeometry(0.11, 0), mat('#ffffff'));
  pom.position.y = 1.6;
  body.add(pom);
  const brim = mesh(new THREE.TorusGeometry(0.38, 0.06, 6, 14), mat('#ffffff'));
  brim.rotation.x = Math.PI / 2;
  brim.position.y = 1.2;
  body.add(brim);
  return { root, body };
}

export class Controls {
  constructor(dom, camera, visitor) {
    this.dom = dom;
    this.camera = camera;
    this.v = visitor;
    this.keys = new Set();
    this.yaw = 0; // camera behind the visitor, looking north toward the plaza
    this.pitch = 0.32;
    this.dist = innerWidth < 600 ? 11 : 8;
    this.joy = { x: 0, y: 0, active: false };
    this.vel = new THREE.Vector3();
    this.walkT = 0;
    this.enabled = true;

    addEventListener('keydown', (e) => {
      if (e.target.closest && e.target.closest('input, textarea')) return;
      this.keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    // look: drag anywhere on the canvas (mouse or the right half on touch)
    let look = null;
    dom.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' && e.clientX < innerWidth * 0.45) return; // left side = joystick
      look = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 };
      dom.setPointerCapture(e.pointerId);
    });
    dom.addEventListener('pointermove', (e) => {
      if (!look || e.pointerId !== look.id) return;
      const dx = e.clientX - look.x, dy = e.clientY - look.y;
      look.moved += Math.abs(dx) + Math.abs(dy);
      look.x = e.clientX;
      look.y = e.clientY;
      this.yaw -= dx * 0.006;
      this.pitch = Math.max(0.05, Math.min(1.2, this.pitch + dy * 0.004));
    });
    const end = (e) => {
      if (look && e.pointerId === look.id) {
        if (look.moved < 6 && this.onTap) this.onTap(e);
        look = null;
      }
    };
    dom.addEventListener('pointerup', end);
    dom.addEventListener('pointercancel', end);
    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.dist = Math.max(4, Math.min(22, this.dist + e.deltaY * 0.01));
    }, { passive: false });

    this.setupJoystick();
  }

  setupJoystick() {
    const pad = document.getElementById('joystick');
    const knob = pad.querySelector('.knob');
    let id = null, cx = 0, cy = 0;
    const R = 46;
    pad.addEventListener('pointerdown', (e) => {
      id = e.pointerId;
      pad.setPointerCapture(id);
      const r = pad.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      move(e);
    });
    const move = (e) => {
      if (e.pointerId !== id) return;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) {
        dx = (dx / d) * R;
        dy = (dy / d) * R;
      }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.joy = { x: dx / R, y: dy / R, active: true };
    };
    pad.addEventListener('pointermove', move);
    const up = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      knob.style.transform = '';
      this.joy = { x: 0, y: 0, active: false };
    };
    pad.addEventListener('pointerup', up);
    pad.addEventListener('pointercancel', up);
  }

  update(dt, colliders, bounds) {
    const k = this.keys;
    let fx = 0, fz = 0;
    if (this.enabled) {
      if (k.has('KeyW') || k.has('ArrowUp')) fz += 1;
      if (k.has('KeyS') || k.has('ArrowDown')) fz -= 1;
      if (k.has('KeyA') || k.has('ArrowLeft')) fx -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) fx += 1;
      if (this.joy.active) {
        fx += this.joy.x;
        fz -= this.joy.y;
      }
    }
    const len = Math.hypot(fx, fz);
    const run = k.has('ShiftLeft') || k.has('ShiftRight') || (this.joy.active && Math.hypot(this.joy.x, this.joy.y) > 0.95);
    const speed = run ? 9 : 5;
    const v = this.v.root;
    if (len > 0.05) {
      fx /= Math.max(1, len);
      fz /= Math.max(1, len);
      // camera-relative direction
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      const mx = -sin * fz + cos * fx;
      const mz = -cos * fz - sin * fx;
      v.position.x += mx * speed * dt;
      v.position.z += mz * speed * dt;
      const target = Math.atan2(mx, mz);
      let diff = target - v.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      v.rotation.y += diff * Math.min(1, dt * 12);
      this.walkT += dt * (run ? 16 : 11);
    }
    this.moving = len > 0.05;
    // collisions with buildings (axis-aligned boxes) and world edge
    const R = 0.5;
    for (const c of colliders) {
      const dx = v.position.x - c.x, dz = v.position.z - c.z;
      const ox = c.hw + R - Math.abs(dx), oz = c.hd + R - Math.abs(dz);
      if (ox > 0 && oz > 0) {
        if (ox < oz) v.position.x += Math.sign(dx || 1) * ox;
        else v.position.z += Math.sign(dz || 1) * oz;
      }
    }
    const d = Math.hypot(v.position.x, v.position.z);
    if (d > bounds) {
      v.position.x *= bounds / d;
      v.position.z *= bounds / d;
    }
    // little walk bounce
    this.v.body.position.y = this.moving ? Math.abs(Math.sin(this.walkT)) * 0.12 : 0;
    this.v.body.rotation.z = this.moving ? Math.sin(this.walkT) * 0.06 : 0;

    // camera follow
    const target = new THREE.Vector3(v.position.x, 1.4, v.position.z);
    const cam = new THREE.Vector3(
      target.x + Math.sin(this.yaw) * Math.cos(this.pitch) * this.dist,
      target.y + Math.sin(this.pitch) * this.dist,
      target.z + Math.cos(this.yaw) * Math.cos(this.pitch) * this.dist,
    );
    cam.y = Math.max(0.6, cam.y);
    // keep the camera out of buildings: pull it toward the visitor until it is outside
    for (let step = 0; step < 12; step++) {
      const hit = colliders.some((c) => Math.abs(cam.x - c.x) < c.hw + 0.4 && Math.abs(cam.z - c.z) < c.hd + 0.4 && cam.y < 9);
      if (!hit) break;
      cam.lerp(target, 0.18);
    }
    this.camera.position.lerp(cam, Math.min(1, dt * 8));
    this.camera.lookAt(target);
  }
}

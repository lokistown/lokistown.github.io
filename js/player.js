// Third-person controls for the visitor: WASD/arrows + Shift, mouse drag to look, wheel zoom,
// touch joystick + drag on the right. Collides with walls; camera never clips into walls.
import * as THREE from 'three';

export class Controls {
  constructor(dom, camera, visitor) {
    this.dom = dom;
    this.camera = camera;
    this.v = visitor;
    this.keys = new Set();
    this.yaw = 0;
    this.pitch = 0.35;
    this.dist = innerWidth < 600 ? 10 : 8;
    this.joy = { x: 0, y: 0, active: false };
    this.enabled = true;
    this.moving = false;
    this.running = false;
    this.inside = false;

    addEventListener('keydown', (e) => {
      if (e.target.closest && e.target.closest('input, textarea, [contenteditable]')) return;
      this.keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    let look = null;
    dom.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' && e.clientX < innerWidth * 0.4) return;
      look = { id: e.pointerId, x: e.clientX, y: e.clientY };
      dom.setPointerCapture(e.pointerId);
    });
    dom.addEventListener('pointermove', (e) => {
      if (!look || e.pointerId !== look.id) return;
      const dx = e.clientX - look.x, dy = e.clientY - look.y;
      look.x = e.clientX;
      look.y = e.clientY;
      this.yaw -= dx * 0.006;
      this.pitch = Math.max(0.05, Math.min(1.25, this.pitch + dy * 0.004));
    });
    const end = (e) => {
      if (look && e.pointerId === look.id) look = null;
    };
    dom.addEventListener('pointerup', end);
    dom.addEventListener('pointercancel', end);
    dom.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.dist = Math.max(3.5, Math.min(26, this.dist + e.deltaY * 0.01));
    }, { passive: false });
    this.setupJoystick();
  }

  setupJoystick() {
    const pad = document.getElementById('joystick');
    if (!pad) return;
    const knob = pad.querySelector('.knob');
    let id = null, cx = 0, cy = 0;
    const R = 46;
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
    pad.addEventListener('pointerdown', (e) => {
      id = e.pointerId;
      pad.setPointerCapture(id);
      const r = pad.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
      move(e);
    });
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
    this.running = k.has('ShiftLeft') || k.has('ShiftRight') || (this.joy.active && Math.hypot(this.joy.x, this.joy.y) > 0.95);
    const speed = this.running ? 8.5 : 4.6;
    const v = this.v.root;
    this.moving = len > 0.05;
    if (this.moving) {
      fx /= Math.max(1, len);
      fz /= Math.max(1, len);
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      const mx = -sin * fz + cos * fx, mz = -cos * fz - sin * fx;
      v.position.x += mx * speed * dt;
      v.position.z += mz * speed * dt;
      let diff = Math.atan2(mx, mz) - v.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      v.rotation.y += diff * Math.min(1, dt * 12);
    }
    const R = 0.38;
    for (let pass = 0; pass < 2; pass++)
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
    this.v.animate(dt, this.moving, this.running);

    // camera: closer and higher when inside a building (dollhouse view)
    const dist = this.inside ? Math.min(this.dist, 7.5) : this.dist;
    const pitch = this.inside ? Math.max(this.pitch, 0.8) : this.pitch;
    const target = new THREE.Vector3(v.position.x, 1.3, v.position.z);
    const cam = new THREE.Vector3(
      target.x + Math.sin(this.yaw) * Math.cos(pitch) * dist,
      target.y + Math.sin(pitch) * dist,
      target.z + Math.cos(this.yaw) * Math.cos(pitch) * dist,
    );
    for (let step = 0; step < 14; step++) {
      const hit = colliders.some((c) => (c.h ?? 3.4) * (this.inside ? 0.35 : 1) > cam.y - 0.3 && Math.abs(cam.x - c.x) < c.hw + 0.3 && Math.abs(cam.z - c.z) < c.hd + 0.3);
      if (!hit) break;
      cam.lerp(target, 0.15);
    }
    cam.y = Math.max(0.7, cam.y);
    this.camera.position.lerp(cam, Math.min(1, dt * 7));
    this.camera.lookAt(target);
  }
}

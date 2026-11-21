// Plays Loki's songs (simple melodies he composes) with a tiny Web Audio synth.
let ctx = null;
let stopFn = null;

export function stopMusic() {
  if (stopFn) stopFn();
  stopFn = null;
}

export function playSong(song, onEnd) {
  stopMusic();
  ctx ||= new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  const bpm = Math.max(50, Math.min(200, song.bpm || 100));
  const beat = 60 / bpm;
  const master = ctx.createGain();
  master.gain.value = 0.18;
  master.connect(ctx.destination);
  const wave = ['sine', 'triangle', 'square', 'sawtooth'].includes(song.wave) ? song.wave : 'triangle';
  let t = ctx.currentTime + 0.08;
  const nodes = [];
  const play = (notes, type, gainMul, octave = 0) => {
    let tt = t;
    for (const n of notes || []) {
      const [midi, beats] = Array.isArray(n) ? n : [n.note, n.beats];
      const dur = Math.max(0.1, Math.min(4, Number(beats) || 1)) * beat;
      if (Number.isFinite(midi) && midi > 20 && midi < 110) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = type;
        o.frequency.value = 440 * Math.pow(2, (midi + octave * 12 - 69) / 12);
        if (type === 'sine') {
          const lfo = ctx.createOscillator();
          const lg = ctx.createGain();
          lfo.frequency.value = 5.5;
          lg.gain.value = 4;
          lfo.connect(lg).connect(o.frequency);
          lfo.start(tt);
          lfo.stop(tt + dur);
        }
        g.gain.setValueAtTime(0, tt);
        g.gain.linearRampToValueAtTime(gainMul, tt + 0.02);
        g.gain.exponentialRampToValueAtTime(gainMul * 0.5, tt + dur * 0.5);
        g.gain.exponentialRampToValueAtTime(0.0001, tt + dur * 0.98);
        o.connect(g).connect(master);
        o.start(tt);
        o.stop(tt + dur);
        nodes.push(o);
      }
      tt += dur;
    }
    return tt;
  };
  const end1 = play(song.notes, wave, 0.9);
  const end2 = play(song.bass, 'sine', 0.6, -1);
  const end = Math.max(end1, end2);
  const timer = setTimeout(() => {
    stopFn = null;
    onEnd && onEnd();
  }, (end - ctx.currentTime) * 1000 + 200);
  stopFn = () => {
    clearTimeout(timer);
    nodes.forEach((n) => {
      try {
        n.stop();
      } catch {}
    });
    master.disconnect();
    onEnd && onEnd();
  };
}

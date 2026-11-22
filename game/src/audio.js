// A tiny WebAudio synth for AETHER CLASH: every sound is a short oscillator blip or
// arpeggio built at call time, so there are no assets and nothing to load. The AudioContext
// is created lazily on the first sound (browsers require a user gesture anyway) and every
// call is wrapped so audio can never break the game — no WebAudio, no sound, no crash.

export function createAudio() {
  let ctx = null;

  // The shared context, created on first use; null when WebAudio is unavailable.
  function ac() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    } catch {
      return null;
    }
  }

  // One enveloped oscillator note. `slide` glides the pitch toward that frequency.
  function tone(freq, dur, type = 'sine', vol = 0.12, delay = 0, slide = 0) {
    const audio = ac();
    if (!audio) return;
    try {
      const t0 = audio.currentTime + delay;
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t0 + dur);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain).connect(audio.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch {
      // A failed note is silent, never fatal.
    }
  }

  // A short rising sweep for a card being played or the rival's flip.
  function flip() {
    tone(420, 0.09, 'triangle', 0.08, 0, 900);
  }

  // Soft tick for UI presses and the pick confirm.
  function play() {
    tone(660, 0.06, 'sine', 0.09);
    tone(880, 0.05, 'sine', 0.05, 0.03);
  }

  function click() {
    tone(520, 0.045, 'sine', 0.07);
  }

  // Rising major arpeggio for victory.
  function win() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.22, 'triangle', 0.11, i * 0.09));
  }

  // Falling minor tones for defeat.
  function lose() {
    [392, 311.13, 246.94, 196].forEach((f, i) => tone(f, 0.26, 'sine', 0.1, i * 0.11));
  }

  // Low square zap when a clash deals damage.
  function damage() {
    tone(140, 0.14, 'square', 0.09, 0, 60);
    tone(90, 0.1, 'sawtooth', 0.05, 0.02, 45);
  }

  return { flip, play, win, lose, damage, click };
}

/**
 * audio.js — a tiny WebAudio synth for Hopper's sound effects.
 * No audio assets: every sound is an enveloped oscillator or noise burst.
 */

export const sfx = {
    ctx: null,

    /** Create the AudioContext (must happen after a user gesture). */
    ensure() {
        if (!this.ctx) {
            try {
                const AC = window.AudioContext || window.webkitAudioContext;
                this.ctx = new AC();
            } catch (e) {
                // audio unavailable — stay silent
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },

    /** One enveloped oscillator sweep from f0 to f1 over dur seconds. */
    blip(f0, f1, dur, type, vol, delay = 0) {
        if (!this.ctx) return;
        const t0 = this.ctx.currentTime + delay;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(f0, t0);
        osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t0 + dur);
        gain.gain.setValueAtTime(vol, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        osc.connect(gain).connect(this.ctx.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.02);
    },

    /** Low-passed white-noise burst (splashes). */
    noise(dur, vol, freq) {
        if (!this.ctx) return;
        const t0 = this.ctx.currentTime;
        const len = Math.floor(this.ctx.sampleRate * dur);
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const ch = buf.getChannelData(0);
        for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const filt = this.ctx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.value = freq;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol, t0);
        gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
        src.connect(filt).connect(gain).connect(this.ctx.destination);
        src.start(t0);
    },

    hop() {
        this.blip(330, 540, 0.07, 'square', 0.10);
    },
    thud() {
        this.blip(150, 90, 0.09, 'triangle', 0.18);
    },
    tick() {
        this.blip(880, 1350, 0.05, 'sine', 0.07);
    },
    splash() {
        this.noise(0.4, 0.25, 900);
    },
    squash() {
        this.blip(220, 55, 0.25, 'sawtooth', 0.2);
    },
    gameOver() {
        this.blip(392, 392, 0.14, 'square', 0.10, 0.25);
        this.blip(330, 330, 0.14, 'square', 0.10, 0.42);
        this.blip(262, 220, 0.30, 'square', 0.10, 0.59);
    },
};

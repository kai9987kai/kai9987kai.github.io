import AudioUtils from '../AudioUtils.js';

export default class PianoModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;
        this.masterGain = ctx.createGain();
        this.masterGain.gain.value = 0;
        this.masterGain.connect(this.output);

        this.active = false;
        this.timer = null;
        this.volume = 0;

        // C Minor Pentatonic: C, Eb, F, G, Bb
        // MIDI: 48 (C3), 51, 53, 55, 58, 60 (C4), ...
        this.scale = [48, 51, 53, 55, 58, 60, 63, 65, 67, 70, 72];
    }

    setGain(val) {
        this.volume = val;
        this.masterGain.gain.setTargetAtTime(this.volume * 0.6, this.ctx.currentTime, 0.5);

        if (this.volume > 0.05 && !this.active) this.start();
        else if (this.volume <= 0.05 && this.active) this.stop();
    }

    update(params) {
        if (params.piano !== undefined) {
            this.setGain(params.piano);
        }
    }

    start() {
        if (this.active) return;
        this.active = true;
        this.scheduleNextNote();
    }

    stop() {
        this.active = false;
        if (this.timer) clearTimeout(this.timer);
    }

    scheduleNextNote() {
        if (!this.active) return;

        // Play note
        if (Math.random() > 0.3) { // 70% chance to play connection
            this.playNote();
        }

        // Variable timing: Satie-esque tempo
        // Humanized: 1s to 4s spacing
        const delay = 1000 + Math.random() * 3000;

        this.timer = setTimeout(() => {
            this.scheduleNextNote();
        }, delay);
    }

    playNote(targetMidi = null, when = 0) {
        let t = when;
        if (t < this.ctx.currentTime) t = this.ctx.currentTime;

        // Pick node from scale or use target
        let midi = targetMidi;
        if (midi === null) {
            // Bias towards center
            const idx = Math.floor(Math.random() * this.scale.length);
            midi = this.scale[idx];
        }

        const freq = 440 * Math.pow(2, (midi - 69) / 12);

        // FM Synthesis for Electric Piano / Bell tone
        // Carrier: Freq
        // Modulator: Freq * Ratio (e.g. 1:2 or 1:4 for bells/tines)

        const dur = 3.0; // Long decay

        // Carrier
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;

        // Modulator
        const mod = this.ctx.createOscillator();
        mod.type = 'sine';
        mod.frequency.value = freq * 4; // Ratio 4

        const modGain = this.ctx.createGain();
        // Initial modulation index high -> low (Tine strike)
        modGain.gain.setValueAtTime(freq * 2, t);
        modGain.gain.exponentialRampToValueAtTime(1, t + 0.5);

        mod.connect(modGain);
        modGain.connect(osc.frequency);

        // Envelope
        const env = this.ctx.createGain();
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(Math.random() * 0.5 + 0.3, t + 0.05); // Attack
        env.gain.exponentialRampToValueAtTime(0.001, t + dur); // Decay

        const pan = this.ctx.createStereoPanner();
        pan.pan.value = (Math.random() * 2 - 1) * 0.5; // Slight stereo spread

        // Output Wiring
        osc.connect(env);
        env.connect(pan);
        pan.connect(this.masterGain);

        osc.start(t);
        mod.start(t);

        osc.stop(t + dur + 0.1);
        mod.stop(t + dur + 0.1);

        // Cleanup
        osc.onended = () => {
            osc.disconnect();
            mod.disconnect();
            modGain.disconnect();
            env.disconnect();
            pan.disconnect();
        };
    }
}

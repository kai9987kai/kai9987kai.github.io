import AudioUtils from '../AudioUtils.js';

export default class ThunderModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;
        this.intensity = 0;
        this.timer = null;
        this.start();
    }

    update(intensity) {
        this.intensity = intensity;
    }

    start() {
        this.timer = setInterval(() => {
            if (this.ctx.state !== 'running') return;
            if (Math.random() < this.intensity * 0.05) this.fire();
        }, 2000);
    }

    fire() {
        const t = this.ctx.currentTime;
        const dur = 1.5 + Math.random() * 2;

        // Rumble
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(40 + Math.random() * 30, t);
        osc.frequency.linearRampToValueAtTime(20, t + dur);

        const oscGain = this.ctx.createGain();
        oscGain.gain.setValueAtTime(0, t);
        oscGain.gain.linearRampToValueAtTime(0.25, t + 0.1);
        oscGain.gain.setTargetAtTime(0, t + dur * 0.8, 0.2);

        const oscFilter = this.ctx.createBiquadFilter();
        oscFilter.type = 'lowpass';
        oscFilter.frequency.value = 150;

        osc.connect(oscFilter);
        oscFilter.connect(oscGain);
        oscGain.connect(this.output);

        // Crackle
        const noise = this.ctx.createBufferSource();
        noise.buffer = AudioUtils.createWhiteNoise(this.ctx);

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = 800;

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0, t);
        noiseGain.gain.linearRampToValueAtTime(0.12, t + 0.05);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.output);

        osc.start(t);
        osc.stop(t + dur + 0.5);
        noise.start(t);
        noise.stop(t + 0.5);
    }
}

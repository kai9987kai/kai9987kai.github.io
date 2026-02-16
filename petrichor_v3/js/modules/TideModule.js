import AudioUtils from '../AudioUtils.js';

export default class TideModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;
        this.masterGain = ctx.createGain();
        this.masterGain.gain.value = 0;
        this.masterGain.connect(this.output);

        this.active = false;
        this.node = null;
    }

    update(params) {
        const biome = params.biome || 'forest';
        const pressure = params.pressure !== undefined ? params.pressure : 0.5;
        const isActive = biome === 'ocean';

        if (isActive !== this.active) {
            this.active = isActive;
            if (this.active) this.start();
            else this.stop();
        }

        if (this.active && this.node) {
            const t = this.ctx.currentTime;

            // Pressure modulates LFO frequency (choppier waters in low pressure)
            // 0.0 -> 0.4Hz, 1.0 -> 0.05Hz
            // 0.0 -> 0.4Hz, 1.0 -> 0.05Hz
            const lfoFreq = 0.4 - (pressure * 0.35);
            this.node.lfo.frequency.setTargetAtTime(lfoFreq, t, 1.0);

            // Pressure modulates Filter Mod Depth (Storm surge)
            // Clamp so baseFreq (800) - modDepth is always > 150Hz
            const modDepth = Math.min(650, 1200 - (pressure * 900));
            this.node.lfoGain.gain.setTargetAtTime(modDepth, t, 1.0);

            // Salt-Spray Logic (High frequency hiss on surges)
            // We use the volume LFO to drive a high-pass noise layer
            const sprayGain = Math.max(0, (1.0 - pressure) * 0.4);
            this.node.sprayGain.gain.setTargetAtTime(sprayGain, t, 0.5);
        }
    }

    start() {
        if (this.node) return;

        const t = this.ctx.currentTime;

        // Pink Noise source (The Swell)
        const buffer = AudioUtils.createPinkNoise(this.ctx);
        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;

        // Salt-Spray source (The Hiss)
        const whiteBuffer = AudioUtils.createWhiteNoise(this.ctx);
        const spraySrc = this.ctx.createBufferSource();
        spraySrc.buffer = whiteBuffer;
        spraySrc.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, t);
        filter.Q.value = 0.5;

        const sprayFilter = this.ctx.createBiquadFilter();
        sprayFilter.type = 'highpass';
        sprayFilter.frequency.value = 5000;

        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.1;

        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 600;

        const volLfoGain = this.ctx.createGain();
        volLfoGain.gain.value = 0.3;

        const baseGain = this.ctx.createGain();
        baseGain.gain.value = 0.4;

        const sprayGain = this.ctx.createGain();
        sprayGain.gain.value = 0;

        // Connections
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        lfo.connect(volLfoGain);
        volLfoGain.connect(baseGain.gain);

        src.connect(filter);
        filter.connect(baseGain);
        baseGain.connect(this.masterGain);

        spraySrc.connect(sprayFilter);
        sprayFilter.connect(sprayGain);
        sprayGain.connect(this.masterGain);

        src.start(t);
        spraySrc.start(t);
        lfo.start(t);

        this.node = { src, spraySrc, lfo, lfoGain, sprayGain };

        this.masterGain.gain.setTargetAtTime(1.0, t, 2.0);
    }

    stop() {
        if (!this.node) return;
        const t = this.ctx.currentTime;
        this.masterGain.gain.setTargetAtTime(0, t, 2.0);

        setTimeout(() => {
            if (!this.active && this.node) {
                this.node.src.stop();
                this.node.spraySrc.stop();
                this.node.lfo.stop();
                this.node = null;
            }
        }, 2500);
    }
}

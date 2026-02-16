import AudioUtils from '../AudioUtils.js';

export default class BiolumeModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;

        this.intensity = 0.5;
        this.pulseRate = 1.0;
        this.active = false;

        this.shimmerNodes = null;
        this.masterGain = ctx.createGain();
        this.masterGain.gain.value = 0;
        this.masterGain.connect(this.output);

        this.lastBubbleTime = 0;
    }

    update(params) {
        const t = this.ctx.currentTime;
        const isOcean = params.biome === 'ocean';

        if (isOcean !== this.active) {
            this.active = isOcean;
            if (this.active) this.start(t);
            else this.stop(t);
        }

        if (this.active) {
            this.intensity = params.biolumeIntensity !== undefined ? params.biolumeIntensity : 0.5;
            this.pulseRate = params.biolumePulse !== undefined ? params.biolumePulse : 1.0;

            const targetGain = this.intensity * 0.4;
            this.masterGain.gain.setTargetAtTime(targetGain, t, 0.5);

            if (this.shimmerNodes) {
                this.shimmerNodes.lfo.frequency.setTargetAtTime(0.1 * this.pulseRate, t, 1.0);
            }

            // Bubble triggers
            if (Math.random() < 0.05 * this.intensity) {
                if (Date.now() - this.lastBubbleTime > 500 / this.intensity) {
                    this.triggerBubble(t);
                    this.lastBubbleTime = Date.now();
                }
            }
        }
    }

    start(t) {
        if (this.shimmerNodes) return;

        // Resonant FM Shimmer
        const carrier = this.ctx.createOscillator();
        const modulator = this.ctx.createOscillator();
        const modGain = this.ctx.createGain();

        carrier.type = 'sine';
        carrier.frequency.value = 800 + Math.random() * 200;

        modulator.type = 'sine';
        modulator.frequency.value = 1.5;
        modGain.gain.value = 100;

        // LFO for pulsing
        const lfo = this.ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.1 * this.pulseRate;

        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 0.2;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1200;
        filter.Q.value = 15;

        modulator.connect(modGain);
        modGain.connect(carrier.frequency);

        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency); // Modulate filter for shimmer movement

        carrier.connect(filter);
        filter.connect(this.masterGain);

        carrier.start(t);
        modulator.start(t);
        lfo.start(t);

        this.shimmerNodes = { carrier, modulator, lfo, filter };
    }

    stop(t) {
        if (!this.shimmerNodes) return;
        this.masterGain.gain.setTargetAtTime(0, t, 2.0);
        const nodes = this.shimmerNodes;
        this.shimmerNodes = null;
        setTimeout(() => {
            nodes.carrier.stop();
            nodes.modulator.stop();
            nodes.lfo.stop();
        }, 2000);
    }

    triggerBubble(t) {
        const dur = 0.1 + Math.random() * 0.2;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        const freq = 400 + Math.random() * 800;
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 1.5, t + dur);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.1, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 200;

        const pan = this.ctx.createStereoPanner();
        pan.pan.value = Math.random() * 2 - 1;

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(pan);
        pan.connect(this.output);

        osc.start(t);
        osc.stop(t + dur + 0.1);
    }
}

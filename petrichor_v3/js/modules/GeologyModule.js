import AudioUtils from '../AudioUtils.js';

export default class GeologyModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;

        this.intensity = 0; // 0 to 1
        this.tremorNodes = null;
        this.rumbleGain = ctx.createGain();
        this.rumbleGain.gain.value = 0;
        this.rumbleGain.connect(this.output);

        this.lastShiftTime = 0;
    }

    update(params) {
        const t = this.ctx.currentTime;
        const newIntensity = params.seismic || 0;

        if (newIntensity !== this.intensity) {
            this.intensity = newIntensity;
            this.syncIntensity(t);
        }

        // Random seismic shifts (grinding sounds)
        if (this.intensity > 0.1 && Date.now() - this.lastShiftTime > 5000 / this.intensity) {
            this.triggerShift(t);
            this.lastShiftTime = Date.now();
        }
    }

    syncIntensity(t) {
        if (this.intensity > 0 && !this.tremorNodes) {
            this.startRumble(t);
        } else if (this.intensity === 0 && this.tremorNodes) {
            this.stopRumble(t);
        }

        if (this.tremorNodes) {
            this.rumbleGain.gain.setTargetAtTime(this.intensity * 0.5, t, 1.0);
            this.tremorNodes.filter.frequency.setTargetAtTime(40 + this.intensity * 60, t, 1.0);
        }
    }

    startRumble(t) {
        // Brownian Noise for deep rumble
        const buffer = AudioUtils.createBrownNoise(this.ctx);
        const src = this.ctx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 40;
        filter.Q.value = 1.0;

        // Sub-oscillator for physical weight (30Hz)
        const sub = this.ctx.createOscillator();
        sub.type = 'sine';
        sub.frequency.value = 30 + Math.random() * 5;

        const subGain = this.ctx.createGain();
        subGain.gain.value = 0.3;

        src.connect(filter);
        filter.connect(this.rumbleGain);

        sub.connect(subGain);
        subGain.connect(this.rumbleGain);

        src.start(t);
        sub.start(t);

        this.tremorNodes = { src, sub, filter };
    }

    stopRumble(t) {
        if (!this.tremorNodes) return;
        this.rumbleGain.gain.setTargetAtTime(0, t, 2.0);
        const nodes = this.tremorNodes;
        this.tremorNodes = null;
        setTimeout(() => {
            nodes.src.stop();
            nodes.sub.stop();
        }, 2000);
    }

    triggerShift(t) {
        // A sudden grinding/cracking sound
        const dur = 1.0 + Math.random() * 2.0;
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(60, t);
        osc.frequency.exponentialRampToValueAtTime(30, t + dur);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(200, t);
        filter.frequency.linearRampToValueAtTime(40, t + dur);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.15 * this.intensity, t + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.output);

        osc.start(t);
        osc.stop(t + dur + 0.1);
    }
}

export default class DropsModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;
        this.intensity = 0;
        this.surface = 'concrete';
        this.timer = null;
        this.init();
    }

    init() {
        this.timer = setInterval(() => {
            if (this.ctx.state !== 'running') return;
            if (Math.random() > this.intensity * 1.5 + 0.05) return;
            this.spawn();
        }, 80);
    }

    update(intensity) {
        this.intensity = intensity;
    }

    setSurface(type) {
        this.surface = type;
    }

    spawn() {
        const t = this.ctx.currentTime;
        const p = {
            concrete: { f: 2800, d: 0.04, w: 'sine', g: 0.12, fVar: 1800 },
            soil: { f: 800, d: 0.025, w: 'sine', g: 0.06, fVar: 600 },
            metal: { f: 4000, d: 0.08, w: 'triangle', g: 0.09, fVar: 3000 },
            leaves: { f: 600, d: 0.02, w: 'sine', g: 0.04, fVar: 400 }
        }[this.surface] || { f: 2800, d: 0.04, w: 'sine', g: 0.12, fVar: 1800 };

        const freq = p.f + Math.random() * p.fVar;
        const osc = this.ctx.createOscillator();
        osc.type = p.w;
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.3, t + p.d);

        const env = this.ctx.createGain();
        env.gain.setValueAtTime(p.g, t);
        env.gain.exponentialRampToValueAtTime(0.001, t + p.d + 0.01);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = freq * 0.8;
        filter.Q.value = 1.5;

        const pan = this.ctx.createStereoPanner();
        pan.pan.value = Math.random() * 2 - 1;

        osc.connect(filter);
        filter.connect(env);
        env.connect(pan);
        pan.connect(this.output);

        osc.start(t);
        osc.stop(t + p.d + 0.05);
    }
}

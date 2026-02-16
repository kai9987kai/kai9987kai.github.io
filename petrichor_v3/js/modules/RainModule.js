import AudioUtils from '../AudioUtils.js';

export default class RainModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;

        this.src = null;
        this.filter = null;
        this.gain = null;

        this.init();
    }

    init() {
        const whiteBuf = AudioUtils.createWhiteNoise(this.ctx);
        this.src = this.ctx.createBufferSource();
        this.src.buffer = whiteBuf;
        this.src.loop = true;

        this.filter = this.ctx.createBiquadFilter();
        this.filter.type = 'bandpass';
        this.filter.frequency.value = 3500;
        this.filter.Q.value = 0.8;

        this.gain = this.ctx.createGain();
        this.gain.gain.value = 0;

        this.src.connect(this.filter);
        this.filter.connect(this.gain);
        this.gain.connect(this.output);
        this.src.start();
    }

    update(intensity) {
        const t = this.ctx.currentTime;
        this.gain.gain.setTargetAtTime(intensity * 0.4, t, 0.1);
    }

    setSurface(type) {
        const t = this.ctx.currentTime;
        const p = {
            concrete: { f: 3500, q: 0.8 },
            soil: { f: 1500, q: 0.5 },
            metal: { f: 5000, q: 1.5 },
            leaves: { f: 1200, q: 0.4 }
        }[type] || { f: 3500, q: 0.8 };

        this.filter.frequency.setTargetAtTime(p.f, t, 0.2);
        this.filter.Q.setTargetAtTime(p.q, t, 0.2);
    }
}

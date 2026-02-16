import AudioUtils from '../AudioUtils.js';

export default class FireModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;
        this.intensity = 0;
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
        this.filter.frequency.value = 800;
        this.filter.Q.value = 2.0;

        this.gain = this.ctx.createGain();
        this.gain.gain.value = 0;

        this.src.connect(this.filter);
        this.filter.connect(this.gain);
        this.gain.connect(this.output);
        this.src.start();

        // Random crackle timer
        this.crackleTimer = setInterval(() => {
            if (this.ctx.state !== 'running' || this.intensity < 0.1) return;
            if (Math.random() < this.intensity * 0.3) this.spawnCrackle();
        }, 50);
    }

    update(intensity) {
        this.intensity = intensity;
        this.gain.gain.setTargetAtTime(intensity * 0.2, this.ctx.currentTime, 0.1);
    }

    spawnCrackle() {
        const t = this.ctx.currentTime;
        const dur = 0.01 + Math.random() * 0.02;

        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(2000 + Math.random() * 5000, t);

        const env = this.ctx.createGain();
        env.gain.setValueAtTime(0.05, t);
        env.gain.exponentialRampToValueAtTime(0.001, t + dur);

        osc.connect(env);
        env.connect(this.output);

        osc.start(t);
        osc.stop(t + dur + 0.01);
    }
}

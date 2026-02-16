import AudioUtils from '../AudioUtils.js';

export default class TrafficModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;

        this.src = null;
        this.filter = null;
        this.gain = null;

        this.init();
    }

    init() {
        const brownBuf = AudioUtils.createBrownNoise(this.ctx);
        this.src = this.ctx.createBufferSource();
        this.src.buffer = brownBuf;
        this.src.loop = true;

        this.filter = this.ctx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 200;

        this.gain = this.ctx.createGain();
        this.gain.gain.value = 0;

        this.src.connect(this.filter);
        this.filter.connect(this.gain);
        this.gain.connect(this.output);
        this.src.start();
    }

    update(intensity) {
        const t = this.ctx.currentTime;
        this.gain.gain.setTargetAtTime(intensity * 0.3, t, 0.1);
        this.filter.frequency.setTargetAtTime(120 + intensity * 180, t, 0.1);
    }
}

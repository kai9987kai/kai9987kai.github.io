import AudioUtils from '../AudioUtils.js';

export default class HearthModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;
        this.masterGain = ctx.createGain();
        this.masterGain.gain.value = 0;
        this.masterGain.connect(this.output);

        this.rumbleNode = null;
        this.crackleNode = null;
        this.active = false;
    }

    update(params) {
        const desiredState = params.hearth || false;
        if (desiredState !== this.active) {
            this.active = desiredState;
            if (this.active) this.start();
            else this.stop();
        }
    }

    start() {
        if (!this.rumbleNode) {
            // Rumble: Brown Noise -> Lowpass
            const brown = AudioUtils.createBrownNoise(this.ctx);
            this.rumbleSrc = this.ctx.createBufferSource();
            this.rumbleSrc.buffer = brown;
            this.rumbleSrc.loop = true;

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 150;

            const gain = this.ctx.createGain();
            gain.gain.value = 0.5;

            this.rumbleSrc.connect(filter);
            filter.connect(gain);
            gain.connect(this.masterGain);

            this.rumbleSrc.start();
            this.rumbleNode = { src: this.rumbleSrc, gain: gain };
        }

        // Crackle: Randomized bursts
        this.crackleLoop();

        // Fade in
        this.masterGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.5);
    }

    stop() {
        this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
        // We keep nodes running for a bit to fade out or stop them?
        // Simple stop:
        setTimeout(() => {
            if (!this.active && this.rumbleNode) {
                this.rumbleNode.src.stop();
                this.rumbleNode = null;
            }
        }, 1000);
    }

    crackleLoop() {
        if (!this.active) return;

        // Schedule next crackle
        const nextTime = 0.05 + Math.random() * 0.2;
        setTimeout(() => this.crackleLoop(), nextTime * 1000);

        // Play one crackle pop
        this.playPop();
    }

    playPop() {
        if (Math.random() > 0.3) return; // Not too dense

        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.frequency.value = 100 + Math.random() * 200; // Low pop
        osc.type = 'square'; // Harsh

        // Very short envelope
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.1 + Math.random() * 0.1, t + 0.002);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(t);
        osc.stop(t + 0.03);

        setTimeout(() => gain.disconnect(), 100);
    }
}

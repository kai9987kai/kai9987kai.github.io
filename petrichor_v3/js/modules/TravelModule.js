import AudioUtils from '../AudioUtils.js';

export default class TravelModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;
        this.masterGain = ctx.createGain();
        this.masterGain.gain.value = 0;
        this.masterGain.connect(this.output);

        this.speed = 0;
        this.rumbleNode = null;
        this.engineNode = null;

        this.initAudio();
    }

    initAudio() {
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        // Standard brown noise loop
        let last = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            last = (last + (0.02 * white)) / 1.02;
            data[i] = last * 3.5;
            if (!isFinite(data[i])) data[i] = 0;
        }

        this.rumbleBuffer = buffer;
        this.active = false;
    }

    start() {
        if (this.active) return;
        this.active = true;

        // Rumble Source
        this.rumbleNode = this.ctx.createBufferSource();
        this.rumbleNode.buffer = this.rumbleBuffer;
        this.rumbleNode.loop = true;

        this.rumbleFilter = this.ctx.createBiquadFilter();
        this.rumbleFilter.type = 'lowpass';
        this.rumbleFilter.frequency.value = 60;

        this.rumbleGain = this.ctx.createGain();
        this.rumbleGain.gain.value = 0;

        this.rumbleNode.connect(this.rumbleFilter);
        this.rumbleFilter.connect(this.rumbleGain);
        this.rumbleGain.connect(this.masterGain);
        this.rumbleNode.start();

        // Engine Drone (Sine/Saw)
        this.engineNode = this.ctx.createOscillator();
        this.engineNode.type = 'sawtooth';
        this.engineNode.frequency.value = 50;

        this.engineFilter = this.ctx.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.value = 100;

        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;

        this.engineNode.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.masterGain);
        this.engineNode.start();
    }

    stop() {
        if (!this.active) return;
        this.active = false;

        if (this.rumbleNode) { this.rumbleNode.stop(); this.rumbleNode = null; }
        if (this.engineNode) { this.engineNode.stop(); this.engineNode = null; }
    }

    setSpeed(val) {
        this.speed = val;

        if (val > 0.01) {
            if (!this.active) this.start();

            // Rumble increases volume and cutoff
            this.rumbleGain.gain.setTargetAtTime(val * 0.5, this.ctx.currentTime, 0.1);
            this.rumbleFilter.frequency.setTargetAtTime(60 + val * 200, this.ctx.currentTime, 0.1);

            // Engine pitch rises
            this.engineNode.frequency.setTargetAtTime(50 + val * 100, this.ctx.currentTime, 0.1);
            this.engineGain.gain.setTargetAtTime(val * 0.15, this.ctx.currentTime, 0.1);

            // Master volume based on speed
            this.masterGain.gain.setTargetAtTime(Math.min(val, 0.8), this.ctx.currentTime, 0.1);
        } else {
            if (this.active) {
                // Fade out then stop?
                this.masterGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
                setTimeout(() => { if (this.speed < 0.01) this.stop(); }, 600);
            }
        }
    }
}

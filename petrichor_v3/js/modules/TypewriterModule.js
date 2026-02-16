import AudioUtils from '../AudioUtils.js';

export default class TypewriterModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;
        this.active = false;

        this.buffers = {
            key: null,
            space: null,
            return: null
        };

        this.init();
    }

    init() {
        // Synthesize sounds? Or load?
        // Plan said "Synthesized mechanical key clicks".
        // Let's synthesize them.

        this.buffers.key = this.synthKeyClick();
        this.buffers.space = this.synthSpaceBar();
        this.buffers.return = this.synthCarriageReturn(); // Bell + Zip
    }

    setActive(active) {
        this.active = active;
    }

    trigger(type) {
        if (!this.active) return;
        const t = this.ctx.currentTime;

        let buf = this.buffers.key;
        if (type === 'space') buf = this.buffers.space;
        if (type === 'return') buf = this.buffers.return;

        if (buf) {
            const src = this.ctx.createBufferSource();
            src.buffer = buf;

            // Randomize pitch/timing slightly for realism
            if (type === 'key') {
                src.playbackRate.value = 0.9 + Math.random() * 0.2;
            }

            const gain = this.ctx.createGain();
            gain.gain.value = 0.5;

            src.connect(gain);
            gain.connect(this.output);
            src.start(t);
        }
    }

    synthKeyClick() {
        const dur = 0.05;
        const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
        const data = buf.getChannelData(0);

        // Short burst of noise + sine impact
        for (let i = 0; i < data.length; i++) {
            const env = 1 - (i / data.length);
            // Noise
            const noise = (Math.random() * 2 - 1) * env * env;
            // Sine impulse (contact)
            const t = i / this.ctx.sampleRate;
            const sine = Math.sin(t * 2000 * Math.PI * 2) * env;

            data[i] = (noise * 0.7 + sine * 0.3);
        }
        return buf;
    }

    synthSpaceBar() {
        // Thuddier click
        const dur = 0.08;
        const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
        const data = buf.getChannelData(0);

        for (let i = 0; i < data.length; i++) {
            const env = 1 - (i / data.length);
            const noise = (Math.random() * 2 - 1) * env;
            const t = i / this.ctx.sampleRate;
            const sine = Math.sin(t * 400 * Math.PI * 2) * env; // Lower freq

            data[i] = (noise * 0.4 + sine * 0.6);
        }
        return buf;
    }

    synthCarriageReturn() {
        // Bell sound + Zip
        const dur = 1.0;
        const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
        const data = buf.getChannelData(0);

        for (let i = 0; i < data.length; i++) {
            const t = i / this.ctx.sampleRate;

            // Bell (Sine mix)
            let bell = 0;
            if (t < 0.8) {
                const env = Math.exp(-t * 3);
                bell = Math.sin(t * 1500 * Math.PI * 2) * env +
                    Math.sin(t * 4500 * Math.PI * 2) * env * 0.3;
            }

            // Zip (Sawtooth slide)
            let zip = 0;
            if (t > 0.1 && t < 0.6) {
                const zt = t - 0.1;
                const zEnv = 1 - (zt / 0.5);
                zip = (Math.random() * 2 - 1) * 0.1 * zEnv; // Rattle
            }

            data[i] = bell * 0.5 + zip * 0.2;
        }
        return buf;
    }
}

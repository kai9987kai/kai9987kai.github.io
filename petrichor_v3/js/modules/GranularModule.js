export default class GranularModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;
        this.masterGain = ctx.createGain();
        this.masterGain.gain.value = 0;
        this.masterGain.connect(this.output);

        this.buffer = null;
        this.isPlaying = false;
        this.timerID = null;

        this.params = {
            density: 0.5, // 0-1, affects interval
            size: 0.2,   // 0-1, affects grain duration
            mix: 0       // 0-1 volume
        };

        this.transmute();
    }

    update(params) {
        if (params.grainDensity !== undefined) this.params.density = params.grainDensity;
        if (params.grainSize !== undefined) this.params.size = params.grainSize;
        if (params.grainMix !== undefined) {
            this.params.mix = params.grainMix;
            this.masterGain.gain.setTargetAtTime(this.params.mix * 2.0, this.ctx.currentTime, 0.1);
            // Mix * 2.0 boost because grains can be quiet

            if (this.params.mix > 0.05 && !this.isPlaying) this.start();
            else if (this.params.mix <= 0.05 && this.isPlaying) this.stop();
        }
    }

    start() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.schedule();
    }

    stop() {
        this.isPlaying = false;
        if (this.timerID) clearTimeout(this.timerID);
    }

    transmute() {
        // Generate a 4-second buffer of complex textures
        const len = this.ctx.sampleRate * 4;
        this.buffer = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
        const l = this.buffer.getChannelData(0);
        const r = this.buffer.getChannelData(1);

        // Additive Synthesis into buffer
        // Base freqs
        const freqs = [110, 164.8, 196, 220, 329.6]; // A Major 9 ish

        for (let i = 0; i < len; i++) {
            let val = 0;
            const t = i / this.ctx.sampleRate;

            freqs.forEach(f => {
                // Sine with slow FM
                val += Math.sin(t * f * Math.PI * 2) * 0.2;
                // Harmonics
                val += Math.sin(t * f * 2 * Math.PI * 2) * 0.1;
            });

            // Noise layer
            val += (Math.random() - 0.5) * 0.05;

            // Fade in/out buffer to avoid clicks at loop points (if we looped, but we random seek)

            l[i] = val * 0.5;
            r[i] = val * 0.5; // Mono source, stereo rendering later via pan
        }
    }

    schedule() {
        if (!this.isPlaying) return;

        // Density determines interval
        // 0 = 500ms, 1 = 20ms
        const interval = 500 - (this.params.density * 480);
        const variation = interval * 0.5;
        const nextTime = interval + (Math.random() - 0.5) * variation;

        this.spawnGrain();

        this.timerID = setTimeout(() => this.schedule(), nextTime);
    }

    spawnGrain() {
        if (!this.buffer) return;

        // Grain duration: 0.05s to 1.0s
        const duration = 0.05 + (this.params.size * 0.95);

        // Random offset
        const offset = Math.random() * (this.buffer.duration - duration);

        const src = this.ctx.createBufferSource();
        src.buffer = this.buffer;

        // Pitch Jitter
        // +/- 2 semitones
        const detune = (Math.random() - 0.5) * 400;
        src.detune.value = detune;

        const env = this.ctx.createGain();
        const pan = this.ctx.createStereoPanner();

        const t = this.ctx.currentTime;

        // Window (Hann/Triangle approximation)
        env.gain.setValueAtTime(0, t);
        env.gain.linearRampToValueAtTime(0.5, t + duration * 0.5);
        env.gain.linearRampToValueAtTime(0, t + duration);

        pan.pan.value = (Math.random() * 2) - 1;

        src.connect(env);
        env.connect(pan);
        pan.connect(this.masterGain);

        src.start(t, offset, duration);
        src.stop(t + duration + 0.1);

        src.onended = () => {
            src.disconnect();
            env.disconnect();
            pan.disconnect();
        };
    }
}

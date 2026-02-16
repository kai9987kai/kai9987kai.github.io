/**
 * NebulaModule.js
 * Cosmic granular cloud synthesizer.
 * Generates evolving pad textures from harmonic noise, shimmer, and spectral spreading.
 */
export default class NebulaModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;
        this.masterGain = ctx.createGain();
        this.masterGain.gain.value = 0;
        this.masterGain.connect(this.output);

        this.active = false;
        this.intensity = 0;
        this.density = 0.5;
        this.shimmer = 0.5;

        // Drone oscillators (harmonically related)
        this.drones = [];
        this.droneFreqs = [55, 82.41, 110, 164.81, 220]; // A1, E2, A2, E3, A3

        // Shimmer network: pitch shifted delay
        this.shimmerDelay = ctx.createDelay(0.5);
        this.shimmerDelay.delayTime.value = 0.15;
        this.shimmerFb = ctx.createGain();
        this.shimmerFb.gain.value = 0.4;
        this.shimmerFilter = ctx.createBiquadFilter();
        this.shimmerFilter.type = 'highpass';
        this.shimmerFilter.frequency.value = 3000;

        this.shimmerGain = ctx.createGain();
        this.shimmerGain.gain.value = 0;

        this.masterGain.connect(this.shimmerDelay);
        this.shimmerDelay.connect(this.shimmerFilter);
        this.shimmerFilter.connect(this.shimmerFb);
        this.shimmerFb.connect(this.shimmerDelay);
        this.shimmerFilter.connect(this.shimmerGain);
        this.shimmerGain.connect(this.output);

        // Spectral spreading filter
        this.spreadFilter = ctx.createBiquadFilter();
        this.spreadFilter.type = 'allpass';
        this.spreadFilter.frequency.value = 1000;
        this.spreadFilter.Q.value = 10;

        this.spreadFilter.connect(this.masterGain);

        // Grain scheduling
        this.grainTimer = null;
        this.grainBuffer = null;
        this.generateCloudBuffer();
    }

    generateCloudBuffer() {
        const len = this.ctx.sampleRate * 6;
        const buf = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
        const l = buf.getChannelData(0);
        const r = buf.getChannelData(1);

        for (let i = 0; i < len; i++) {
            const t = i / this.ctx.sampleRate;
            let valL = 0, valR = 0;

            // Additive harmonics with slow FM
            this.droneFreqs.forEach((f, idx) => {
                const fm = Math.sin(t * 0.3 * (idx + 1)) * f * 0.02;
                const sig = Math.sin(t * (f + fm) * Math.PI * 2);
                const pan = Math.sin(t * 0.1 * idx) * 0.5;
                valL += sig * (0.5 - pan) * 0.15;
                valR += sig * (0.5 + pan) * 0.15;
            });

            // Subtle noise dust
            valL += (Math.random() - 0.5) * 0.02;
            valR += (Math.random() - 0.5) * 0.02;

            l[i] = valL;
            r[i] = valR;
        }

        this.grainBuffer = buf;
    }

    update(params) {
        if (params.nebula !== undefined) {
            this.intensity = params.nebula;
            this.active = this.intensity > 0.01;
            this.masterGain.gain.setTargetAtTime(
                this.intensity * 0.5,
                this.ctx.currentTime, 0.5
            );
        }

        if (params.nebulaDensity !== undefined) this.density = params.nebulaDensity;
        if (params.nebulaShimmer !== undefined) {
            this.shimmer = params.nebulaShimmer;
            this.shimmerGain.gain.setTargetAtTime(
                this.shimmer * 0.3,
                this.ctx.currentTime, 0.3
            );
            this.shimmerFb.gain.setTargetAtTime(
                0.2 + this.shimmer * 0.5,
                this.ctx.currentTime, 0.3
            );
        }

        if (!this.active) {
            if (this.grainTimer) {
                clearTimeout(this.grainTimer);
                this.grainTimer = null;
            }
            return;
        }

        if (!this.grainTimer) {
            this.scheduleGrain();
        }

        // Spectral spreading: modulate with space param
        const space = params.space || 0;
        this.spreadFilter.frequency.setTargetAtTime(
            500 + space * 3000,
            this.ctx.currentTime, 0.5
        );
    }

    scheduleGrain() {
        if (!this.active || !this.grainBuffer) return;

        this.spawnGrain();

        // Interval based on density (200ms to 20ms)
        const interval = 200 - this.density * 180;
        const jitter = interval * 0.3;
        const next = interval + (Math.random() - 0.5) * jitter;

        this.grainTimer = setTimeout(() => this.scheduleGrain(), Math.max(20, next));
    }

    spawnGrain() {
        if (!this.grainBuffer) return;

        const now = this.ctx.currentTime;
        const dur = 0.2 + this.density * 0.8; // 0.2s to 1.0s
        const offset = Math.random() * (this.grainBuffer.duration - dur);

        const src = this.ctx.createBufferSource();
        src.buffer = this.grainBuffer;

        // Detune: cosmic pitch drift ±3 semitones
        src.detune.value = (Math.random() - 0.5) * 600;

        const env = this.ctx.createGain();
        const pan = this.ctx.createStereoPanner();

        // Hann window envelope
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.4, now + dur * 0.3);
        env.gain.linearRampToValueAtTime(0.3, now + dur * 0.7);
        env.gain.linearRampToValueAtTime(0, now + dur);

        pan.pan.value = (Math.random() - 0.5) * 1.6; // Wide stereo

        src.connect(env);
        env.connect(pan);
        pan.connect(this.spreadFilter);

        src.start(now, offset, dur);
        src.stop(now + dur + 0.05);

        src.onended = () => {
            src.disconnect();
            env.disconnect();
            pan.disconnect();
        };
    }
}

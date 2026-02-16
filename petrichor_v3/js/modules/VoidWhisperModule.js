/**
 * VoidWhisperModule.js
 * Spectral voice synthesis with formant-filtered noise.
 * Creates eerie, distant vocal textures that emerge and disappear.
 */
export default class VoidWhisperModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;
        this.masterGain = ctx.createGain();
        this.masterGain.gain.value = 0;
        this.masterGain.connect(this.output);

        this.active = false;
        this.intensity = 0;
        this.whisperPhase = 0;

        // Formant filters (vowel shapes)
        // A, E, I, O, U formant frequencies
        this.formants = [
            { f1: 730, f2: 1090, f3: 2440 },  // A
            { f1: 530, f2: 1840, f3: 2480 },  // E
            { f1: 270, f2: 2290, f3: 3010 },  // I
            { f1: 570, f2: 840, f3: 2410 },   // O
            { f1: 300, f2: 870, f3: 2240 }    // U
        ];
        this.currentFormant = 0;
        this.targetFormant = 0;
        this.morphProgress = 0;

        // 3 parallel bandpass filters for formants
        this.filters = [];
        this.filterGains = [];
        for (let i = 0; i < 3; i++) {
            const f = ctx.createBiquadFilter();
            f.type = 'bandpass';
            f.Q.value = 12 + i * 5;
            const g = ctx.createGain();
            g.gain.value = 0.3;
            f.connect(g);
            g.connect(this.masterGain);
            this.filters.push(f);
            this.filterGains.push(g);
        }

        // Noise source (continuous)
        this.noiseNode = null;
        this.noiseGain = ctx.createGain();
        this.noiseGain.gain.value = 0;

        // Connect noise to all formant filters
        this.filters.forEach(f => {
            this.noiseGain.connect(f);
        });

        // Reverb tail via feedback delay
        this.reverbDelay = ctx.createDelay(1.0);
        this.reverbDelay.delayTime.value = 0.3;
        this.reverbFb = ctx.createGain();
        this.reverbFb.gain.value = 0.5;
        this.reverbFilter = ctx.createBiquadFilter();
        this.reverbFilter.type = 'lowpass';
        this.reverbFilter.frequency.value = 2000;

        this.masterGain.connect(this.reverbDelay);
        this.reverbDelay.connect(this.reverbFilter);
        this.reverbFilter.connect(this.reverbFb);
        this.reverbFb.connect(this.reverbDelay);
        this.reverbFilter.connect(this.output);

        // Breath LFO for amplitude modulation
        this.breathLFO = null;
        this.breathGain = ctx.createGain();
        this.breathGain.gain.value = 0;
    }

    startNoise() {
        if (this.noiseNode) return;

        // Generate pink-ish noise buffer
        const len = this.ctx.sampleRate * 4;
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buf.getChannelData(0);

        // Pink noise approximation using Voss-McCartney
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < len; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
            b6 = white * 0.115926;
        }

        this.noiseNode = this.ctx.createBufferSource();
        this.noiseNode.buffer = buf;
        this.noiseNode.loop = true;
        this.noiseNode.connect(this.noiseGain);
        this.noiseNode.start();

        // Breath LFO
        this.breathLFO = this.ctx.createOscillator();
        this.breathLFO.type = 'sine';
        this.breathLFO.frequency.value = 0.15; // Very slow breath
        this.breathLFO.connect(this.breathGain);
        this.breathGain.connect(this.noiseGain.gain);
        this.breathLFO.start();
    }

    update(params) {
        if (params.voidWhisper !== undefined) {
            this.intensity = params.voidWhisper;
            this.active = this.intensity > 0.01;

            if (this.active && !this.noiseNode) {
                this.startNoise();
            }

            this.masterGain.gain.setTargetAtTime(
                this.intensity * 0.4,
                this.ctx.currentTime, 0.5
            );

            this.noiseGain.gain.setTargetAtTime(
                this.intensity * 0.6,
                this.ctx.currentTime, 0.3
            );
        }

        if (!this.active) return;

        const now = this.ctx.currentTime;

        // Slowly morph between vowel formants
        this.morphProgress += 0.002;
        if (this.morphProgress >= 1.0) {
            this.morphProgress = 0;
            this.currentFormant = this.targetFormant;
            this.targetFormant = Math.floor(Math.random() * this.formants.length);
        }

        const fromF = this.formants[this.currentFormant];
        const toF = this.formants[this.targetFormant];
        const t = this.morphProgress;

        // Smooth interpolation (ease in-out)
        const ease = t * t * (3 - 2 * t);

        const freqs = [
            fromF.f1 + (toF.f1 - fromF.f1) * ease,
            fromF.f2 + (toF.f2 - fromF.f2) * ease,
            fromF.f3 + (toF.f3 - fromF.f3) * ease
        ];

        this.filters.forEach((f, i) => {
            f.frequency.setTargetAtTime(freqs[i], now, 0.1);
        });

        // Modulate reverb with space param
        const spaceMod = params.space || 0;
        this.reverbFb.gain.setTargetAtTime(
            0.3 + spaceMod * 0.4,
            now, 0.3
        );

        // Time of day: whispers louder at night
        const time = params.time || 12;
        const nightFactor = (time < 6 || time > 20) ? 1.3 : 0.8;
        this.filterGains.forEach(g => {
            g.gain.setTargetAtTime(0.25 * nightFactor, now, 0.5);
        });
    }
}

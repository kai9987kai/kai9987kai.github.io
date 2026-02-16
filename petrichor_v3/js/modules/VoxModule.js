export default class VoxModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = ctx.createGain();
        this.output.connect(outputNode);
        this.output.gain.value = 0;

        this.oscillators = [];
        this.formants = [];
        this.vowels = {
            'a': [600, 1040, 2250, 2450, 2750],
            'e': [400, 1620, 2400, 2800, 3100],
            'i': [250, 1750, 2600, 3050, 3340],
            'o': [400, 750, 2400, 2600, 2900],
            'u': [350, 600, 2400, 2675, 2950]
        };

        this.currentVowel = 'o';
        this.init();
    }

    init() {
        // Create 3 oscillators for a "choir" feel
        const freqs = [110, 164.81, 220]; // A2, E3, A3
        freqs.forEach(f => {
            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = f;

            const oscGain = this.ctx.createGain();
            oscGain.gain.value = 0.3;

            osc.connect(oscGain);

            // Create 5 formant filters for this oscillator
            const filters = [];
            this.vowels[this.currentVowel].forEach((v, i) => {
                const filter = this.ctx.createBiquadFilter();
                filter.type = 'bandpass';
                filter.frequency.value = v;
                filter.Q.value = 10;

                oscGain.connect(filter);
                filter.connect(this.output);
                filters.push(filter);
            });

            this.oscillators.push(osc);
            this.formants.push(filters);
            osc.start();
        });

        // Slow LFO for volume swells
        this.lfo = this.ctx.createOscillator();
        this.lfo.frequency.value = 0.1;
        this.lfoGain = this.ctx.createGain();
        this.lfoGain.gain.value = 0.1;

        this.lfo.connect(this.lfoGain);
        this.lfoGain.connect(this.output.gain);
        this.lfo.start();
    }

    setGain(val) {
        const target = Math.max(0, Math.min(0.5, val));
        this.output.gain.setTargetAtTime(target, this.ctx.currentTime, 0.5);
    }

    setVowel(v) {
        if (!this.vowels[v]) return;
        this.currentVowel = v;
        const targetFormants = this.vowels[v];

        this.formants.forEach(filterGroup => {
            filterGroup.forEach((f, i) => {
                f.frequency.setTargetAtTime(targetFormants[i], this.ctx.currentTime, 0.2);
            });
        });
    }
}

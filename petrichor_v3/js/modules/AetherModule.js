export default class AetherModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;

        this.oscillators = [];
        this.masterGain = null;
        this.filter = null;
        this.lfo = null;

        this.params = {
            harmony: 0, // 0-1 Volume of synth
            space: 0.5  // Filter cutoff
        };

        this.rootFreq = 130.81; // C3
        this.ratios = [1, 1.5, 2]; // Root, 5th, Octave

        this.init();
    }

    init() {
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0;

        // Lowpass Filter for "Space" control
        this.filter = this.ctx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 800;
        this.filter.Q.value = 1;

        // Slow LFO for filter movement
        this.lfo = this.ctx.createOscillator();
        this.lfo.type = 'sine';
        this.lfo.frequency.value = 0.1; // 10s cycle

        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 150; // Reduced sweep to stay safe from 0Hz

        this.lfo.connect(lfoGain);
        lfoGain.connect(this.filter.frequency);
        this.lfo.start();

        // Create 3 Oscillators (Root, 5th, Octave)
        this.ratios.forEach((ratio, i) => {
            const osc = this.ctx.createOscillator();
            osc.type = i === 2 ? 'sine' : 'triangle';
            osc.frequency.value = this.rootFreq * ratio;

            // Detune slightly for thickness
            osc.detune.value = (Math.random() - 0.5) * 20; // +/- 10 cents

            const gain = this.ctx.createGain();
            gain.gain.value = 0.3 / this.ratios.length;

            osc.connect(gain);
            gain.connect(this.filter);

            osc.start();
            this.oscillators.push({ osc, gain });
        });

        this.filter.connect(this.masterGain);
        this.masterGain.connect(this.output);
    }

    update(params) {
        if (params.harmony !== undefined) this.params.harmony = params.harmony;
        if (params.space !== undefined) this.params.space = params.space;

        const t = this.ctx.currentTime;

        // Volume (Harmony)
        this.masterGain.gain.setTargetAtTime(this.params.harmony * 0.4, t, 0.5);

        // Filter Cutoff (Space)
        // Map 0-1 to 300Hz - 2100Hz (Safety floor 300 > LFO 150)
        const cutoff = 300 + this.params.space * 1800;
        this.filter.frequency.setTargetAtTime(cutoff, t, 0.5);
    }
}

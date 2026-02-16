export default class QuantumModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.input = ctx.createGain();
        this.output = ctx.createGain();
        this.output.connect(outputNode);

        // 1. Temporal Displacement Engine (Multi-tap Delay)
        this.numTaps = 6;
        this.taps = [];
        this.tapGains = [];
        this.tapFilters = [];

        const tapsIn = ctx.createGain();
        this.input.connect(tapsIn);

        for (let i = 0; i < this.numTaps; i++) {
            const delay = ctx.createDelay(2.0);
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            delay.delayTime.value = 0.2 + i * 0.15 + (Math.random() * 0.05);
            gain.gain.value = 0; // Controlled by probability
            filter.type = 'bandpass';
            filter.frequency.value = 400 + i * 600;
            filter.Q.value = 2;

            tapsIn.connect(delay);
            delay.connect(filter);
            filter.connect(gain);
            gain.connect(this.output);

            this.taps.push(delay);
            this.tapGains.push(gain);
            this.tapFilters.push(filter);
        }

        // 2. Grain Shifting Modulation (LFOs for delay time)
        this.modulators = [];
        this.modGains = [];

        for (let i = 0; i < this.numTaps; i++) {
            const lfo = ctx.createOscillator();
            const lfoGain = ctx.createGain();

            lfo.type = 'sine';
            lfo.frequency.value = 0.1 + Math.random() * 0.5;
            lfoGain.gain.value = 0.005; // Base modulation depth

            lfo.connect(lfoGain);
            lfoGain.connect(this.taps[i].delayTime);
            lfo.start();

            this.modulators.push(lfo);
            this.modGains.push(lfoGain);
        }

        this.params = {
            entropy: 0.5,      // Probability of "ghost" notes
            displacement: 0.3, // Baseline delay time stretch
            flux: 0.1          // Modulation intensity
        };

        this.lastUpdateTime = 0;
    }

    update(params) {
        if (params.entropy !== undefined) this.params.entropy = params.entropy;
        if (params.displacement !== undefined) this.params.displacement = params.displacement;
        if (params.flux !== undefined) this.params.flux = params.flux;

        const now = this.ctx.currentTime;

        // Quantum Displacement Scaling
        this.taps.forEach((d, i) => {
            const baseTime = 0.2 + i * 0.15 * (1.0 + this.params.displacement);
            d.delayTime.setTargetAtTime(baseTime, now, 0.5);
        });

        // Flux Modulation
        this.modGains.forEach(g => {
            g.gain.setTargetAtTime(0.005 + this.params.flux * 0.05, now, 0.2);
        });

        // Stochastic Triggering (Entropy)
        // We pulse the gain of taps based on random chance
        if (now - this.lastUpdateTime > 0.1) {
            this.lastUpdateTime = now;
            this.tapGains.forEach((g, i) => {
                const chance = Math.random();
                if (chance < this.params.entropy * 0.5) {
                    // Trigger "ghost"
                    const intensity = 0.1 + Math.random() * 0.4;
                    g.gain.setTargetAtTime(intensity, now, 0.05);
                    g.gain.setTargetAtTime(0, now + 0.1 + Math.random() * 0.3, 0.2);
                }
            });
        }
    }
}

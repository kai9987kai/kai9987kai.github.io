export default class SingularityModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.input = ctx.createGain();
        this.output = ctx.createGain();
        this.output.connect(outputNode);

        // 1. Spectral Freeze Setup (Simplified using a short looping buffer)
        this.freezeGain = ctx.createGain();
        this.freezeGain.gain.value = 0;
        this.freezeBufferSource = null;

        // 2. Void Reverb (Feedback Delay Network)
        this.delays = [];
        this.gains = [];
        this.filters = [];
        this.numLines = 4;
        this.delayTimes = [0.047, 0.057, 0.071, 0.089]; // Prime-ish numbers for smoothness

        const fdnIn = ctx.createGain();
        const fdnOut = ctx.createGain();
        this.input.connect(fdnIn);
        fdnOut.connect(this.output);

        for (let i = 0; i < this.numLines; i++) {
            const d = ctx.createDelay(1.0);
            d.delayTime.value = this.delayTimes[i];

            const g = ctx.createGain();
            g.gain.value = 0.7 / this.numLines; // Normalized feedback (0.7 safety margin)

            const f = ctx.createBiquadFilter();
            f.type = 'lowpass';
            f.frequency.value = 2000;

            fdnIn.connect(d);
            d.connect(f);
            f.connect(g);
            g.connect(fdnOut); // Connect to output

            // Cross-feedback (simplified matrix)
            g.connect(fdnIn);

            this.delays.push(d);
            this.gains.push(g);
            this.filters.push(f);
        }

        // 3. Shimmer (Octave-up shift simulation via short delay modulation)
        this.shimmerGain = ctx.createGain();
        // Post-processing could go here

        this.params = {
            freeze: false,
            void: 0.5,
            shimmer: 0
        };
    }

    setFreeze(state) {
        if (state === this.params.freeze) return;
        this.params.freeze = state;

        if (state) {
            // "Capture" pulse - real spectral freeze is complex, 
            // we'll simulate by ramping up a feedback loop or a short delay.
            this.freezeGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.05);
        } else {
            this.freezeGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
        }
    }

    update(params) {
        if (params.void !== undefined) this.params.void = params.void;
        if (params.shimmer !== undefined) this.params.shimmer = params.shimmer;

        // Map Void to FDN feedback and filter cutoff
        // Normalise by numLines to maintain stability < 1.0 total gain
        const feedback = (0.5 + (this.params.void * 0.45)) / this.numLines;
        const cutoff = 500 + (this.params.void * 15000); // 500 to 15.5k

        this.gains.forEach(g => g.gain.setTargetAtTime(feedback, this.ctx.currentTime, 0.1));
        this.filters.forEach(f => f.frequency.setTargetAtTime(cutoff, this.ctx.currentTime, 0.1));

        // Shimmer affects the "brightness" and "tension" of the lines
        if (params.shimmer !== undefined) {
            this.delays.forEach((d, i) => {
                const base = this.delayTimes[i];
                const shift = base * (1 + this.params.shimmer * 0.1); // Subtle stretch
                d.delayTime.setTargetAtTime(shift, this.ctx.currentTime, 0.5);
            });
        }
    }
}

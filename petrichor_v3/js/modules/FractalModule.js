export default class FractalModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.input = ctx.createGain();
        this.output = ctx.createGain();
        this.output.connect(outputNode);

        // Recursive Feedback Network
        this.numLines = 4;
        this.lines = [];
        this.lineGains = [];
        this.lineFilters = [];

        // Matrix Gain nodes for cross-feedback
        this.matrix = [];

        for (let i = 0; i < this.numLines; i++) {
            const delay = ctx.createDelay(1.0);
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            delay.delayTime.value = 0.05 + i * 0.03;
            gain.gain.value = 0; // Default off
            filter.type = 'allpass'; // Phase shifting for complex recursion

            delay.connect(filter);
            filter.connect(gain);

            this.lines.push(delay);
            this.lineGains.push(gain);
            this.lineFilters.push(filter);
        }

        // Connect Input to all lines
        this.lines.forEach(line => this.input.connect(line));

        // Connect all lines to Output
        this.lineGains.forEach(gain => gain.connect(this.output));

        // Cross-Feedback Matrix (Recursive)
        for (let i = 0; i < this.numLines; i++) {
            this.matrix[i] = [];
            for (let j = 0; j < this.numLines; j++) {
                const matrixGain = ctx.createGain();
                matrixGain.gain.value = 0;

                // Connect output of line i back to input of line j
                this.lineGains[i].connect(matrixGain);
                matrixGain.connect(this.lines[j]);

                this.matrix[i][j] = matrixGain;
            }
        }

        this.params = {
            recursion: 0.1,  // Global feedback / depth
            symmetry: 0.5,   // Delay time distribution
            divergence: 0.1  // Filter modulation
        };
    }

    update(params) {
        if (params.recursion !== undefined) this.params.recursion = params.recursion;
        if (params.symmetry !== undefined) this.params.symmetry = params.symmetry;
        if (params.divergence !== undefined) this.params.divergence = params.divergence;

        const now = this.ctx.currentTime;

        // Recursion scales the matrix gains
        // We use a safe normalization factor to prevent signal blowout (Fractal patterns)
        const feedback = this.params.recursion * 0.45; // Max 0.45 per node for stability

        for (let i = 0; i < this.numLines; i++) {
            for (let j = 0; j < this.numLines; j++) {
                // Diagonal bias for some direct feedback
                const bias = (i === j) ? 1.2 : 0.8;
                this.matrix[i][j].gain.setTargetAtTime(feedback * bias, now, 0.1);
            }

            // Output gain per line
            this.lineGains[i].gain.setTargetAtTime(0.5, now, 0.1);

            // Symmetry adjusts delay times
            const baseTime = 0.02 + (i * 0.04 * (1.0 + this.params.symmetry));
            this.lines[i].delayTime.setTargetAtTime(baseTime, now, 0.2);

            // Divergence affects allpass filter frequency
            const freq = 100 + (this.params.divergence * 10000) + (i * 500);
            this.lineFilters[i].frequency.setTargetAtTime(freq, now, 0.1);
        }
    }
}

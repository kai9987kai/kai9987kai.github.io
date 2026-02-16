export default class PulsarModule {
    constructor(ctx, inputNode, outputNode) {
        this.ctx = ctx;
        this.input = inputNode;
        this.output = ctx.createGain();
        this.output.connect(outputNode);

        this.gate = ctx.createGain();
        this.input.disconnect(); // Intercept
        this.input.connect(this.gate);
        this.gate.connect(this.output);

        this.lfo = ctx.createOscillator();
        this.lfoGain = ctx.createGain();
        this.lfo.connect(this.lfoGain);
        this.lfoGain.connect(this.gate.gain);

        this.lfo.type = 'square';
        this.lfoGain.gain.value = 0; // Bias
        this.gate.gain.value = 1.0;

        this.lfo.start();

        this.params = {
            rate: 1 / 4, // subdivision of BPM
            depth: 0,
            shape: 'square',
            bpm: 120
        };
    }

    update(params) {
        if (params.bpm !== undefined) this.params.bpm = params.bpm;
        if (params.rate !== undefined) this.params.rate = params.rate;
        if (params.depth !== undefined) this.params.depth = params.depth;
        if (params.shape !== undefined) {
            this.params.shape = params.shape;
            this.lfo.type = params.shape;
        }

        // Calculate frequency from BPM and rate
        // rate 1 = 1 per beat, 0.25 = 1 per 4 beats, 4 = 4 times per beat
        const bps = this.params.bpm / 60;
        const freq = bps * this.params.rate;
        this.lfo.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.1);

        // Map depth to LFO gain and gate bias
        const depth = this.params.depth;
        this.lfoGain.gain.setTargetAtTime(depth * 0.5, this.ctx.currentTime, 0.1);
        this.gate.gain.setTargetAtTime(1.0 - (depth * 0.5), this.ctx.currentTime, 0.1);
    }
}

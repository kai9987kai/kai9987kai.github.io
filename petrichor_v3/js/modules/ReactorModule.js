export default class ReactorModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.input = ctx.createGain();
        this.output = ctx.createGain();
        this.output.connect(outputNode);

        // 1. Bitcrusher (Simulated via ScriptProcessor or just quantization in waveshaper? 
        // Real bitcrushing usually needs worker or ScriptProcessor. 
        // For now, let's use a Waveshaper for distortion and a simple feedback loop.)

        // 2. Waveshaper (Saturation)
        this.shaper = ctx.createWaveShaper();
        this.shaper.curve = this.makeDistortionCurve(400);
        this.shaper.oversample = '4x';

        // 3. Feedback Loop
        this.feedbackDelay = ctx.createDelay(0.1);
        this.feedbackGain = ctx.createGain();
        this.feedbackFilter = ctx.createBiquadFilter();
        this.feedbackFilter.type = 'highpass';
        this.feedbackFilter.frequency.value = 400;

        // Routing
        this.input.connect(this.shaper);
        this.shaper.connect(this.output);

        // Internal Feedback Loop
        this.shaper.connect(this.feedbackDelay);
        this.feedbackDelay.connect(this.feedbackFilter);
        this.feedbackFilter.connect(this.feedbackGain);
        this.feedbackGain.connect(this.input);

        this.params = {
            drive: 0.1,
            crush: 0,
            meltdown: 0
        };

        this.update({});
    }

    makeDistortionCurve(amount) {
        const k = typeof amount === 'number' ? amount : 50;
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        const deg = Math.PI / 180;
        for (let i = 0; i < n_samples; ++i) {
            const x = i * 2 / n_samples - 1;
            curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
        }
        return curve;
    }

    update(params) {
        if (params.drive !== undefined) this.params.drive = params.drive;
        if (params.crush !== undefined) this.params.crush = params.crush;
        if (params.meltdown !== undefined) this.params.meltdown = params.meltdown;

        // Map Drive to input gain and distortion curve
        // Drive 0-1 maps to gain 1 to 50
        const driveGain = 1 + (this.params.drive * 49);
        this.input.gain.setTargetAtTime(driveGain, this.ctx.currentTime, 0.05);
        this.shaper.curve = this.makeDistortionCurve(driveGain * 10);

        // Meltdown maps to feedback gain
        // Meltdown 0-1 maps to gain 0 to 0.95 (to avoid infinite resonance bang)
        const fbGainVal = this.params.meltdown * 0.95;
        this.feedbackGain.gain.setTargetAtTime(fbGainVal, this.ctx.currentTime, 0.05);

        // Crush (Simulated bitcrushing via feedback delay modulation or just a value for UI viz)
        this.feedbackDelay.delayTime.setTargetAtTime(0.001 + (this.params.crush * 0.05), this.ctx.currentTime, 0.05);
    }
}

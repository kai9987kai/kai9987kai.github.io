import AudioUtils from '../AudioUtils.js';

export default class WindModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;

        this.src = null;
        this.filter = null;
        this.gain = null;
        this.lfo = null;
        this.lfoGain = null;

        this.params = {
            wind: 0
        };

        this.init();
    }

    init() {
        const t = this.ctx.currentTime;

        // 1. Pink Noise Source
        this.src = this.ctx.createBufferSource();
        this.src.buffer = AudioUtils.createPinkNoise(this.ctx);
        this.src.loop = true;

        // 2. Modulated Filter (Bandpass)
        this.filter = this.ctx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.setValueAtTime(400, t);
        this.filter.Q.value = 0.5;

        // 3. LFO for "Gusts"
        this.lfo = this.ctx.createOscillator();
        this.lfo.type = 'sine';
        this.lfo.frequency.value = 0.2; // Slow gusts

        this.lfoGain = this.ctx.createGain();
        this.lfoGain.gain.value = 300; // Modulation depth (Hz)

        // Connect LFO to Filter Frequency
        this.lfo.connect(this.lfoGain);
        this.lfoGain.connect(this.filter.frequency);

        // 4. Output Gain
        this.gain = this.ctx.createGain();
        this.gain.gain.setValueAtTime(0, t);

        // Wiring
        this.src.connect(this.filter);
        this.filter.connect(this.gain);
        this.gain.connect(this.output);

        // Start
        this.src.start();
        this.lfo.start();
    }

    update(params) {
        if (params.wind !== undefined) {
            this.params.wind = params.wind;
            const t = this.ctx.currentTime;

            // Gain: Scale volume
            this.gain.gain.setTargetAtTime(this.params.wind * 0.4, t, 0.2);

            // Filter Base Freq: Windier = Higher pitch whistle. Minimum 200Hz.
            const baseFreq = 200 + (this.params.wind * 600);
            this.filter.frequency.setTargetAtTime(baseFreq, t, 0.2);

            // Filter Q: Windier = More resonant (whistling)
            const res = 0.5 + (this.params.wind * 5);
            this.filter.Q.setTargetAtTime(res, t, 0.2);

            // LFO Rate: Windier = Faster gusts
            const lfoRate = 0.1 + (this.params.wind * 0.8);
            this.lfo.frequency.setTargetAtTime(lfoRate, t, 0.5);

            // LFO Depth: Windier = More variation. 
            // Clamp so baseFreq - lfoDepth is never <= 20Hz
            const maxLfoDepth = Math.max(0, baseFreq - 20);
            const targetLfoDepth = 200 + (this.params.wind * 400);
            this.lfoGain.gain.setTargetAtTime(Math.min(targetLfoDepth, maxLfoDepth), t, 0.5);
        }
    }
}

import AudioUtils from '../AudioUtils.js';

export default class LoFiModule {
    constructor(ctx, inputNode, outputNode) {
        this.ctx = ctx;
        this.input = inputNode;
        this.output = outputNode;

        this.dryGain = null;
        this.wetGain = null;
        this.delayNode = null;
        this.lfo = null;
        this.lfoGain = null;

        this.moduleGain = ctx.createGain();
        this.moduleGain.connect(outputNode);

        this.hissSrc = null;
        this.hissGain = null;

        this.crackleSrc = null;
        this.crackleGain = null;

        this.params = {
            lofi: 0 // 0-1 Master intensity
        };

        this.init();
    }

    init() {
        const t = this.ctx.currentTime;

        // 1. Wow & Flutter (Warble)
        // Signal Flow: Input -> Delay -> WetGain -> Output
        //              Input -> DryGain -> Output (Crossfade)

        this.delayNode = this.ctx.createDelay();
        this.delayNode.delayTime.value = 0.05; // 50ms base delay

        // LFO for modulation
        this.lfo = this.ctx.createOscillator();
        this.lfo.type = 'sine';
        this.lfo.frequency.value = 0.5; // Slow drift

        this.lfoGain = this.ctx.createGain();
        this.lfoGain.gain.value = 0; // Modulation depth (starts at 0)

        this.lfo.connect(this.lfoGain);
        this.lfoGain.connect(this.delayNode.delayTime);
        this.lfo.start();

        // Flutter LFO (Fast)
        this.flutterLfo = this.ctx.createOscillator();
        this.flutterLfo.type = 'triangle';
        this.flutterLfo.frequency.value = 8; // 8-15Hz default

        this.flutterGain = this.ctx.createGain();
        this.flutterGain.gain.value = 0;

        this.flutterLfo.connect(this.flutterGain);
        this.flutterGain.connect(this.delayNode.delayTime);
        this.flutterLfo.start();

        this.input.connect(this.delayNode);

        // 2. Vinyl Hiss (Pink Noise + Highpass)
        this.hissSrc = this.ctx.createBufferSource();
        this.hissSrc.buffer = AudioUtils.createPinkNoise(this.ctx);
        this.hissSrc.loop = true;

        const hissFilter = this.ctx.createBiquadFilter();
        hissFilter.type = 'highpass';
        hissFilter.frequency.value = 5000;

        this.hissGain = this.ctx.createGain();
        this.hissGain.gain.value = 0;

        this.hissSrc.connect(hissFilter);
        hissFilter.connect(this.hissGain);
        this.hissGain.connect(this.moduleGain); // To master module gain

        this.hissSrc.start();

        // 3. Crackle (Random impulses)
        // Using brown noise + thresholding gating (simulated by infrequent random playback or buffer)
        // Simpler: Just a loop of clicks? 
        // Let's use a scripted processor check? No, AudioWorklet is better but too complex.
        // Let's use a pre-baked buffer of clicks.

        const crackleBuf = this.createCrackleBuffer();
        this.crackleSrc = this.ctx.createBufferSource();
        this.crackleSrc.buffer = crackleBuf;
        this.crackleSrc.loop = true;

        this.crackleGain = this.ctx.createGain();
        this.crackleGain.gain.value = 0;

        this.crackleSrc.connect(this.crackleGain);
        this.crackleGain.connect(this.moduleGain);

        this.crackleSrc.start();

        // Output Mixing (Warble effect)
        this.delayNode.connect(this.moduleGain);
    }

    createCrackleBuffer() {
        // Create 5 seconds of random clicks
        const len = this.ctx.sampleRate * 5;
        const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = buf.getChannelData(0);

        for (let i = 0; i < len; i++) {
            if (Math.random() > 0.9999) { // Rare click
                data[i] = (Math.random() * 2 - 1) * 0.8;
                if (i < len - 1) data[i + 1] = -data[i] * 0.5; // DC offset compensation / damping
            } else {
                data[i] = 0;
            }
        }
        return buf;
    }

    update(params) {
        const t = this.ctx.currentTime;

        if (params.hiss !== undefined) {
            this.hissGain.gain.setTargetAtTime(params.hiss * 0.15, t, 0.2);
        }
        if (params.crackle !== undefined) {
            this.crackleGain.gain.setTargetAtTime(params.crackle * 0.25, t, 0.2);
        }
        if (params.wobble !== undefined) {
            const val = params.wobble;
            this.lfoGain.gain.setTargetAtTime(val * 0.005, t, 0.5);
            this.flutterGain.gain.setTargetAtTime(val * 0.002, t, 0.5);
        }
    }

    tapeStop() {
        const t = this.ctx.currentTime;
        // Doppler Pitch Dive
        this.delayNode.delayTime.cancelScheduledValues(t);
        this.delayNode.delayTime.linearRampToValueAtTime(0.5, t + 0.8);

        // Fade Out
        this.moduleGain.gain.cancelScheduledValues(t);
        this.moduleGain.gain.setValueAtTime(1, t);
        this.moduleGain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    }

    tapeStart() {
        const t = this.ctx.currentTime;
        // Reset Delay
        this.delayNode.delayTime.cancelScheduledValues(t);
        this.delayNode.delayTime.setValueAtTime(0.05, t); // Snap for now (pitch jump is ok/cool)

        // Fade In
        this.moduleGain.gain.cancelScheduledValues(t);
        this.moduleGain.gain.setValueAtTime(0, t);
        this.moduleGain.gain.linearRampToValueAtTime(1.0, t + 0.5);
    }
}

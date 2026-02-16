export default class SynthModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;
        this.masterGain = ctx.createGain();
        this.masterGain.connect(this.output);

        this.params = {
            cutoff: 0.5,
            resonance: 0,
            detune: 0.1,
            waveform: 0 // 0 = Saw, 1 = Square
        };
    }

    update(params) {
        if (params.cutoff !== undefined) this.params.cutoff = params.cutoff;
        if (params.resonance !== undefined) this.params.resonance = params.resonance;
        if (params.detune !== undefined) this.params.detune = params.detune;
        if (params.waveform !== undefined) this.params.waveform = params.waveform;
    }

    playNote(midi, time) {
        const t = time;
        const freq = 440 * Math.pow(2, (midi - 69) / 12);
        const dur = 0.2; // Short pluck

        // 1. Oscillators
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();

        // Waveform mixing (Approximation)
        // We can't smoothly crossfade types easily without 2 pairs.
        // Let's just switch for now or use 2 oscs with different types?
        // Let's use Saw for Osc1 and Square for Osc2 and mix levels?
        // Actually, let's keep it simple: Sawtooth base.
        // If waveform > 0.5 use square? 
        // Or Osc1 = Saw, Osc2 = Square.

        osc1.type = 'sawtooth';
        osc2.type = 'square';

        osc1.frequency.value = freq;
        osc2.frequency.value = freq;

        // Detune
        // detune param 0-1 maps to 0-50 cents
        osc2.detune.value = this.params.detune * 50;
        osc1.detune.value = -this.params.detune * 50;

        // Mix
        const mix1 = this.ctx.createGain();
        const mix2 = this.ctx.createGain();

        // Crossfade
        // If waveform = 0 (Saw), osc1 = 1, osc2 = 0
        // If waveform = 1 (Square), osc1 = 0, osc2 = 1
        mix1.gain.value = 1.0 - this.params.waveform;
        mix2.gain.value = this.params.waveform;

        // 2. Filter
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';

        // Cutoff mapping: 0-1 -> 100Hz - 8000Hz (Exponential)
        const minCutoff = 100;
        const maxCutoff = 8000;
        // const cutoffFreq = minCutoff + (maxCutoff - minCutoff) * this.params.cutoff; // Linear
        const cutoffFreq = minCutoff * Math.pow(maxCutoff / minCutoff, this.params.cutoff);

        filter.frequency.setValueAtTime(cutoffFreq, t);
        filter.Q.value = this.params.resonance * 10; // 0-10 Q

        // Filter Envelope
        // Pluck effect
        filter.frequency.exponentialRampToValueAtTime(cutoffFreq * 0.5, t + 0.1);

        // 3. VCA (Amp Envelope)
        const vca = this.ctx.createGain();
        vca.gain.setValueAtTime(0, t);
        vca.gain.linearRampToValueAtTime(0.3, t + 0.02); // Attack
        vca.gain.exponentialRampToValueAtTime(0.001, t + dur); // Decay

        // Wiring
        osc1.connect(mix1);
        osc2.connect(mix2);

        mix1.connect(filter);
        mix2.connect(filter);

        filter.connect(vca);
        vca.connect(this.masterGain);

        osc1.start(t);
        osc2.start(t);
        osc1.stop(t + dur + 0.1);
        osc2.stop(t + dur + 0.1);

        // Cleanup
        setTimeout(() => {
            vca.disconnect();
            // ... disconnect others
        }, (dur + 0.2) * 1000);
    }
}

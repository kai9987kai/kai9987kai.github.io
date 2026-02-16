import AudioUtils from '../AudioUtils.js';

export default class ChronosModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;

        this.cricketsGain = null;
        this.cicadasGain = null;

        this.time = 12; // 0-24
        this.biomeIntensity = 0;

        this.init();
    }

    init() {
        const t = this.ctx.currentTime;

        // --- Night: Crickets (FM Synth Pulse) ---
        // Carrier (High pulse)
        const cricketOsc = this.ctx.createOscillator();
        cricketOsc.type = 'triangle';
        cricketOsc.frequency.value = 4500;

        // Modulator (Chirp rhythm)
        const chirpLFO = this.ctx.createOscillator();
        chirpLFO.type = 'sawtooth';
        chirpLFO.frequency.value = 4; // Chirps per second

        const chirpGain = this.ctx.createGain();
        chirpGain.gain.value = 1000;

        chirpLFO.connect(chirpGain);
        chirpGain.connect(cricketOsc.frequency);

        this.cricketsGain = this.ctx.createGain();
        this.cricketsGain.gain.setValueAtTime(0, t);

        cricketOsc.connect(this.cricketsGain);
        this.cricketsGain.connect(this.output);

        cricketOsc.start();
        chirpLFO.start();


        // --- Day: Cicadas (Filtered Noise) ---
        const noise = this.ctx.createBufferSource();
        noise.buffer = AudioUtils.createWhiteNoise(this.ctx);
        noise.loop = true;

        const bandpass = this.ctx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.value = 6000;
        bandpass.Q.value = 5;

        // AM Modulator (Buzz)
        const buzzLFO = this.ctx.createOscillator();
        buzzLFO.type = 'sine';
        buzzLFO.frequency.value = 80; // Fast buzz

        const buzzGain = this.ctx.createGain(); // Acts as VCA
        buzzGain.gain.value = 0.5;

        // Need to modulate gain of noise...
        // Structure: Noise -> Filter -> VCA (modulated by LFO) -> Out

        const cicadaVCA = this.ctx.createGain();
        cicadaVCA.gain.value = 0;

        // Add 1.0 DC offset to ensure LFO (sine) stays in 0..1 range
        const dcOffset = this.ctx.createConstantSource();
        dcOffset.offset.value = 1.0;
        dcOffset.start();

        const lfoSum = this.ctx.createGain();
        buzzLFO.connect(lfoSum);
        dcOffset.connect(lfoSum);

        lfoSum.connect(cicadaVCA.gain);

        // Actually simpler: Just standard gain node for output
        this.cicadasGain = this.ctx.createGain();
        this.cicadasGain.gain.setValueAtTime(0, t);

        noise.connect(bandpass);
        bandpass.connect(this.cicadasGain);
        this.cicadasGain.connect(this.output);

        noise.start();
    }

    update(params) {
        if (params.time !== undefined) this.time = params.time;
        if (params.biome !== undefined) this.biomeIntensity = params.biome;

        // Calculate Day/Night balance
        // Night: 20:00 - 05:00
        // Day: 06:00 - 19:00
        // Transition: 05-06 and 19-20

        const t = this.ctx.currentTime;
        const ramp = 0.5;

        let nightLevel = 0;
        let dayLevel = 0;

        // Simple distance check from "noon" (12)
        // Midnight is 0 or 24.
        // Distance from 12: 0 (noon) -> 12 (midnight)
        const distFromNoon = Math.abs(this.time - 12);

        if (distFromNoon > 6) {
            // 6PM to 6AM -> Night territory
            // Remap 6..12 to 0..1
            nightLevel = (distFromNoon - 6) / 6;
        } else {
            // 6AM to 6PM -> Day territory
            dayLevel = 1 - (distFromNoon / 6);
        }

        // Apply Intensity limits
        const targetCrickets = nightLevel * this.biomeIntensity * 0.15;
        const targetCicadas = dayLevel * this.biomeIntensity * 0.1;

        this.cricketsGain.gain.setTargetAtTime(targetCrickets, t, ramp);
        this.cicadasGain.gain.setTargetAtTime(targetCicadas, t, ramp);
    }
}

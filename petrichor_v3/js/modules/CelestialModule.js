import AudioUtils from '../AudioUtils.js';

export default class CelestialModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;

        this.masterGain = null;
        this.active = true;

        this.params = {
            wind: 0,
            density: 0.5 // Probability modifier
        };

        // Pentatonic Scale (C Major Pentatonic: C, D, E, G, A) high octaves
        // Frequencies for C6, D6, E6, G6, A6, C7...
        this.frequencies = [
            1046.50, // C6
            1174.66, // D6
            1318.51, // E6
            1567.98, // G6
            1760.00, // A6
            2093.00, // C7
            2349.32, // D7
            2637.02  // E7
        ];

        this.nextChimeTime = 0;
        this.minInterval = 0.5; // Seconds

        this.init();
    }

    init() {
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 1.0;
        this.masterGain.connect(this.output);

        this.schedule();
    }

    update(params) {
        if (params.wind !== undefined) this.params.wind = params.wind;
        // Density isn't in main params yet, might be added or just internal default for now.
        // Let's assume passed in params if we add UI for it.
        if (params.chimes !== undefined) this.params.density = params.chimes;
    }

    schedule() {
        if (!this.active) return;

        // Loop every 100ms to check if we should play a chime
        // Logic: specific probability check based on wind speed

        const now = this.ctx.currentTime;
        if (now >= this.nextChimeTime) {
            this.tryPlayChime();
            // Schedule next check
            // Random interval dependent on wind
            // Higher wind = shorter interval

            // If wind is 0, interval is huge (essentially never)
            if (this.params.wind > 0.1) {
                const baseInterval = 4.0 - (this.params.wind * 3.5); // 0.1->3.65s, 1.0->0.5s
                this.nextChimeTime = now + baseInterval * (0.5 + Math.random());
            } else {
                this.nextChimeTime = now + 1.0; // Check again in 1s
            }
        }

        requestAnimationFrame(() => this.schedule());
    }

    tryPlayChime() {
        if (this.params.wind < 0.1) return;

        // Chance to play
        // Density 0-1
        // Wind 0.1-1

        // At max wind and max density, we want frequent chimes.
        // The scheduling triggers roughly every 0.5s at max wind. 
        // We can just play.

        this.playChime();
    }

    playChime() {
        // FM Synthesis for Metallic Sound
        // Carrier: Sine
        // Modulator: Sine with non-integer ratio (e.g., 2.3) for inharmonic partials
        // Envelopes: Short attack, long exponential decay

        const t = this.ctx.currentTime;
        const freq = this.frequencies[Math.floor(Math.random() * this.frequencies.length)];

        // Output Gain (Velocity)
        const chimeGain = this.ctx.createGain();
        // Lower volume for higher frequencies?
        const velocity = 0.1 + Math.random() * 0.2;
        chimeGain.gain.setValueAtTime(0, t);
        chimeGain.gain.linearRampToValueAtTime(velocity, t + 0.01);
        chimeGain.gain.exponentialRampToValueAtTime(0.001, t + 3.0);
        chimeGain.connect(this.masterGain);

        // Carrier
        const carrier = this.ctx.createOscillator();
        carrier.type = 'sine';
        carrier.frequency.value = freq;

        // Modulator
        const mod = this.ctx.createOscillator();
        mod.type = 'sine';
        // Metallic ratio (e.g. 1 : 1.414 or similar)
        const ratio = 1.2 + Math.random() * 0.5;
        mod.frequency.value = freq * ratio;

        // Mod Index Envelope
        const modGain = this.ctx.createGain();
        // FM Amount
        modGain.gain.setValueAtTime(freq * 2, t); // High modulation start
        modGain.gain.exponentialRampToValueAtTime(1, t + 0.5); // Decay mod faster than amplitude for "ping"

        mod.connect(modGain);
        modGain.connect(carrier.frequency);

        carrier.connect(chimeGain);

        carrier.start(t);
        mod.start(t);

        carrier.stop(t + 3.1);
        mod.stop(t + 3.1);

        // Clean up
        setTimeout(() => {
            chimeGain.disconnect();
        }, 3200);
    }
}

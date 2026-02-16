import AudioUtils from '../AudioUtils.js';

export default class SolarModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;

        this.intensity = 0;
        this.flareChance = 0.1;

        this.masterGain = ctx.createGain();
        this.masterGain.gain.value = 0;
        this.masterGain.connect(this.output);

        this.lastFlareTime = 0;
        this.nodes = null;
    }

    update(params) {
        const t = this.ctx.currentTime;
        const newIntensity = params.solarIntensity || 0;
        this.flareChance = params.flareFrequency || 0.1;

        if (newIntensity !== this.intensity) {
            this.handleIntensityChange(newIntensity, t);
        }

        if (this.intensity > 0) {
            // Random EMI glitch bursts
            if (Math.random() < 0.05 * this.intensity) {
                this.triggerGlitch(t);
            }

            // Occasional "Solar Flare" surges
            if (this.intensity > 0.3 && Date.now() - this.lastFlareTime > (20000 / (this.intensity + this.flareChance))) {
                this.triggerFlare(t);
                this.lastFlareTime = Date.now();
            }

            if (this.nodes) {
                // Modulate drone frequency and width
                const modFreq = 0.1 + this.intensity * 2;
                this.nodes.droneOsc1.frequency.setTargetAtTime(60 + Math.sin(t * 0.5) * 5, t, 1.0);
                this.nodes.droneOsc2.frequency.setTargetAtTime(62 + Math.cos(t * 0.7) * 4, t, 1.0);
                this.nodes.filter.frequency.setTargetAtTime(200 + this.intensity * 2000, t, 1.0);
            }
        }
    }

    handleIntensityChange(val, t) {
        if (val > 0 && !this.nodes) {
            this.startDrone(t);
        } else if (val === 0 && this.nodes) {
            this.stopDrone(t);
        }

        this.intensity = val;
        this.masterGain.gain.setTargetAtTime(this.intensity * 0.4, t, 1.5);
    }

    startDrone(t) {
        // Plasma Drone - Two beating oscillators
        const droneOsc1 = this.ctx.createOscillator();
        droneOsc1.type = 'sawtooth';
        droneOsc1.frequency.value = 60;

        const droneOsc2 = this.ctx.createOscillator();
        droneOsc2.type = 'sawtooth';
        droneOsc2.frequency.value = 62;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;
        filter.Q.value = 10;

        droneOsc1.connect(filter);
        droneOsc2.connect(filter);
        filter.connect(this.masterGain);

        droneOsc1.start(t);
        droneOsc2.start(t);

        this.nodes = { droneOsc1, droneOsc2, filter };
    }

    stopDrone(t) {
        if (!this.nodes) return;
        this.masterGain.gain.setTargetAtTime(0, t, 2.0);
        const nodes = this.nodes;
        this.nodes = null;
        setTimeout(() => {
            nodes.droneOsc1.stop();
            nodes.droneOsc2.stop();
        }, 2000);
    }

    triggerGlitch(t) {
        const dur = 0.05 + Math.random() * 0.1;
        const osc = this.ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(1000 + Math.random() * 8000, t);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.1 * this.intensity, t);
        gain.gain.setValueAtTime(0, t + dur);

        osc.connect(gain);
        gain.connect(this.output);

        osc.start(t);
        osc.stop(t + dur);
    }

    triggerFlare(t) {
        // A wide sweep of EMI
        const dur = 3.0;
        const noise = AudioUtils.createWhiteNoise(this.ctx);
        const src = this.ctx.createBufferSource();
        src.buffer = noise;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(100, t);
        filter.frequency.exponentialRampToValueAtTime(8000, t + dur * 0.5);
        filter.frequency.exponentialRampToValueAtTime(100, t + dur);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.5 * this.intensity, t + 0.5);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.output);

        src.start(t);
        src.stop(t + dur);
    }
}

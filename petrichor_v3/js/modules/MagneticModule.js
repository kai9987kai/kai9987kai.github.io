import AudioUtils from '../AudioUtils.js';

export default class MagneticModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;

        this.intensity = 0;
        this.fluxActive = false;

        this.masterGain = ctx.createGain();
        this.masterGain.gain.value = 0;
        this.masterGain.connect(this.output);

        this.droneOsc = null;
        this.lfo = null;
    }

    update(params) {
        const t = this.ctx.currentTime;
        const newIntensity = params.magneticFlux || 0;
        const isEnabled = params.fluxToggle || false;

        // Solar intensity from Phase 46 adds instability
        const solar = params.solarIntensity || 0;
        const instability = newIntensity + solar * 0.5;

        if (isEnabled && !this.fluxActive) {
            this.startField(t);
        } else if (!isEnabled && this.fluxActive) {
            this.stopField(t);
        }

        if (this.fluxActive) {
            this.masterGain.gain.setTargetAtTime(newIntensity * 0.5, t, 0.5);

            if (this.droneOsc) {
                // Modulate ELF frequency based on instability
                const baseFreq = 30 + instability * 10;
                const jitter = Math.sin(t * 10) * instability * 5;
                this.droneOsc.frequency.setTargetAtTime(baseFreq + jitter, t, 0.1);

                // Random magnetic snaps
                if (Math.random() < 0.02 * instability) {
                    this.triggerSnap(t);
                }
            }
        }

        this.fluxActive = isEnabled;
    }

    startField(t) {
        // ELF Pulse Drone
        this.droneOsc = this.ctx.createOscillator();
        this.droneOsc.type = 'sine';
        this.droneOsc.frequency.value = 30;

        const pulseGain = this.ctx.createGain();

        // PWM-ish modulation using an LFO on the gain
        this.lfo = this.ctx.createOscillator();
        this.lfo.type = 'square';
        this.lfo.frequency.value = 8.0; // Rapid pulsing

        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 0.5;

        this.lfo.connect(lfoGain);
        lfoGain.connect(pulseGain.gain);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(80, t);
        filter.frequency.setTargetAtTime(80, t, 0.1);

        this.droneOsc.connect(pulseGain);
        pulseGain.connect(filter);
        filter.connect(this.masterGain);

        this.droneOsc.start(t);
        this.lfo.start(t);
    }

    stopField(t) {
        this.masterGain.gain.setTargetAtTime(0, t, 1.0);
        const osc = this.droneOsc;
        const mod = this.lfo;
        this.droneOsc = null;
        this.lfo = null;

        setTimeout(() => {
            if (osc) osc.stop();
            if (mod) mod.stop();
        }, 1100);
    }

    triggerSnap(t) {
        const dur = 0.05;
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(800 + Math.random() * 2000, t);
        osc.frequency.exponentialRampToValueAtTime(100, t + dur);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.05 * this.intensity, t);
        gain.gain.linearRampToValueAtTime(0, t + dur);

        osc.connect(gain);
        gain.connect(this.output);

        osc.start(t);
        osc.stop(t + dur);
    }
}

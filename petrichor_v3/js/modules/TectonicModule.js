import AudioUtils from '../AudioUtils.js';

export default class TectonicModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;

        this.stress = 0;
        this.growthRate = 0.1;

        this.masterGain = ctx.createGain();
        this.masterGain.gain.value = 0;
        this.masterGain.connect(this.output);

        this.droneOsc = null;
        this.noise = null;
    }

    update(params) {
        const t = this.ctx.currentTime;
        const newStress = params.tectonicStress || 0;
        this.growthRate = params.tectonicGrowth || 0.1;
        const seismic = params.seismic || 0;

        // Effective stress is combined with global seismic activity
        const effectiveStress = Math.max(newStress, seismic * 0.8);

        if (effectiveStress > 0 && !this.droneOsc) {
            this.startResonance(t);
        } else if (effectiveStress === 0 && this.droneOsc) {
            this.stopResonance(t);
        }

        if (this.droneOsc) {
            this.masterGain.gain.setTargetAtTime(effectiveStress * 0.4, t, 1.0);

            // Modulate resonance frequency based on stress. Floor at 25Hz.
            const freq = 25 + effectiveStress * 30;
            this.droneOsc.frequency.setTargetAtTime(freq, t, 1.0);

            // Random creaking sounds
            if (effectiveStress > 0.2 && Math.random() < 0.01 * effectiveStress) {
                this.triggerCreak(t, effectiveStress);
            }
        }

        this.stress = newStress;
    }

    startResonance(t) {
        this.droneOsc = this.ctx.createOscillator();
        this.droneOsc.type = 'triangle';
        this.droneOsc.frequency.value = 20;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 80;
        filter.Q.value = 5;

        // Add some brown noise for texture
        const noiseNode = AudioUtils.createBrownNoise(this.ctx);
        const noiseSrc = this.ctx.createBufferSource();
        noiseSrc.buffer = noiseNode;
        noiseSrc.loop = true;

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.value = 0.2;

        this.droneOsc.connect(filter);
        noiseSrc.connect(noiseGain);
        noiseGain.connect(filter);
        filter.connect(this.masterGain);

        this.droneOsc.start(t);
        noiseSrc.start(t);
        this.noise = noiseSrc;
    }

    stopResonance(t) {
        this.masterGain.gain.setTargetAtTime(0, t, 2.0);
        const osc = this.droneOsc;
        const n = this.noise;
        this.droneOsc = null;
        this.noise = null;

        setTimeout(() => {
            if (osc) osc.stop();
            if (n) n.stop();
        }, 2100);
    }

    triggerCreak(t, intensity) {
        const dur = 1.0 + Math.random() * 2.0;
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(40 + Math.random() * 60, t);
        osc.frequency.exponentialRampToValueAtTime(10, t + dur);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        const freq = Math.max(800, 200 + intensity * 2000);
        filter.frequency.setTargetAtTime(freq, t, 0.1);
        filter.Q.value = 15;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.3 * intensity, t + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

        // Add rapid amplitude modulation for "shuddering" creak
        const am = this.ctx.createOscillator();
        am.type = 'square';
        am.frequency.value = 15 + Math.random() * 20;
        const amGain = this.ctx.createGain();
        amGain.gain.value = 0.5;
        am.connect(amGain);
        amGain.connect(gain.gain);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        osc.start(t);
        am.start(t);
        osc.stop(t + dur);
        am.stop(t + dur);
    }
}

import AudioUtils from '../AudioUtils.js';

export default class VolcanoModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;

        this.intensity = 0;
        this.ashDensity = 0.5;
        this.ventNodes = null;

        this.masterGain = ctx.createGain();
        this.masterGain.gain.value = 0;
        this.masterGain.connect(this.output);

        this.lastEruptionTime = 0;
    }

    update(params) {
        const t = this.ctx.currentTime;
        const newIntensity = params.volcanoIntensity || 0;

        if (newIntensity !== this.intensity) {
            this.handleIntensityChange(newIntensity, t);
        }

        if (this.intensity > 0) {
            // Random eruption thuds
            if (this.intensity > 0.4 && Date.now() - this.lastEruptionTime > 8000 / this.intensity) {
                this.triggerEruption(t);
                this.lastEruptionTime = Date.now();
            }

            if (this.ventNodes) {
                // Modulate hiss focus based on intensity
                // Modulate hiss focus based on intensity. Floor at 1100 to stay clear of 0Hz with LFO.
                this.ventNodes.hissFilter.frequency.setTargetAtTime(1100 + this.intensity * 2000, t, 1.0);
                this.ventNodes.hissLFO.frequency.setTargetAtTime(0.5 + this.intensity * 2, t, 1.0);
            }
        }
    }

    handleIntensityChange(val, t) {
        if (val > 0 && !this.ventNodes) {
            this.startVents(t);
        } else if (val === 0 && this.ventNodes) {
            this.stopVents(t);
        }

        this.intensity = val;
        this.masterGain.gain.setTargetAtTime(this.intensity * 0.6, t, 1.0);
    }

    startVents(t) {
        // High-pressure hiss (White noise)
        const hissBuffer = AudioUtils.createWhiteNoise(this.ctx);
        const hissSrc = this.ctx.createBufferSource();
        hissSrc.buffer = hissBuffer;
        hissSrc.loop = true;

        const hissFilter = this.ctx.createBiquadFilter();
        hissFilter.type = 'bandpass';
        hissFilter.frequency.value = 2200; // Increased floor for stability
        hissFilter.Q.value = 5.0;

        const hissLFO = this.ctx.createOscillator();
        hissLFO.type = 'sine';
        hissLFO.frequency.value = 1.0;

        const hissLFOGain = this.ctx.createGain();
        hissLFOGain.gain.value = 1000; // Swing +/- 1000

        hissLFO.connect(hissLFOGain);
        hissLFOGain.connect(hissFilter.frequency);

        // Deep Rumble (Brown noise)
        const rumbleBuffer = AudioUtils.createBrownNoise(this.ctx);
        const rumbleSrc = this.ctx.createBufferSource();
        rumbleSrc.buffer = rumbleBuffer;
        rumbleSrc.loop = true;

        const rumbleFilter = this.ctx.createBiquadFilter();
        rumbleFilter.type = 'lowpass';
        rumbleFilter.frequency.value = 60;

        hissSrc.connect(hissFilter);
        hissFilter.connect(this.masterGain);

        rumbleSrc.connect(rumbleFilter);
        rumbleFilter.connect(this.masterGain);

        hissSrc.start(t);
        rumbleSrc.start(t);
        hissLFO.start(t);

        this.ventNodes = { hissSrc, rumbleSrc, hissLFO, hissFilter };
    }

    stopVents(t) {
        if (!this.ventNodes) return;
        this.masterGain.gain.setTargetAtTime(0, t, 2.0);
        const nodes = this.ventNodes;
        this.ventNodes = null;
        setTimeout(() => {
            nodes.hissSrc.stop();
            nodes.rumbleSrc.stop();
            nodes.hissLFO.stop();
        }, 2000);
    }

    triggerEruption(t) {
        const dur = 2.0;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(40, t);
        osc.frequency.exponentialRampToValueAtTime(20, t + dur);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(100, t);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.4 * this.intensity, t + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.output);

        osc.start(t);
        osc.stop(t + dur + 0.1);
    }
}

export default class AuroraModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;

        this.active = false;
        this.glow = 0.5;
        this.speed = 1.0;
        this.solarIntensity = 0;

        this.masterGain = ctx.createGain();
        this.masterGain.gain.value = 0;
        this.masterGain.connect(this.output);

        this.oscillators = [];
        this.gains = [];
    }

    update(params) {
        const t = this.ctx.currentTime;
        const isActive = params.aurora || false;
        this.glow = params.auroraGlow || 0.5;
        this.speed = params.auroraSpeed || 1.0;
        this.solarIntensity = params.solarIntensity || 0;

        if (isActive !== this.active) {
            this.handleStateChange(isActive, t);
        }

        if (this.active) {
            this.masterGain.gain.setTargetAtTime(this.glow * 0.3, t, 1.0);

            // Modulate harmonics based on speed and solar activity
            this.oscillators.forEach((osc, i) => {
                const baseFreq = 50 * (i + 1);
                const drift = Math.sin(t * 0.2 * this.speed + i) * (5 + this.solarIntensity * 20);
                osc.frequency.setTargetAtTime(baseFreq + drift, t, 1.0);

                const g = this.gains[i];
                const gMod = (Math.sin(t * 0.5 * this.speed + i * 1.5) + 1) * 0.5;
                g.gain.setTargetAtTime(gMod * (1 / (i + 1)) * this.glow, t, 1.0);
            });
        }
    }

    handleStateChange(isActive, t) {
        this.active = isActive;
        if (this.active) {
            this.startSpectral(t);
        } else {
            this.stopSpectral(t);
        }
    }

    startSpectral(t) {
        this.oscillators = [];
        this.gains = [];

        const harmonicCount = 6;
        for (let i = 0; i < harmonicCount; i++) {
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = 50 * (i + 1);

            const g = this.ctx.createGain();
            g.gain.value = 0;

            osc.connect(g);
            g.connect(this.masterGain);

            osc.start(t);
            this.oscillators.push(osc);
            this.gains.push(g);
        }
    }

    stopSpectral(t) {
        this.masterGain.gain.setTargetAtTime(0, t, 2.0);
        const oscs = this.oscillators;
        const gs = this.gains;
        this.oscillators = [];
        this.gains = [];

        setTimeout(() => {
            oscs.forEach(o => o.stop());
        }, 2100);
    }
}

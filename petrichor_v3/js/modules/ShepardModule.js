/**
 * ShepardModule.js
 * Psychoacoustic engine with Shepard-Risset glissando tones.
 * Creates the illusion of endlessly rising or falling pitch.
 */
export default class ShepardModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;
        this.masterGain = ctx.createGain();
        this.masterGain.gain.value = 0;
        this.masterGain.connect(this.output);

        this.active = false;
        this.intensity = 0;
        this.direction = 1; // 1 = rising, -1 = falling
        this.speed = 0.5;   // 0 to 1
        this.mode = 'shepard'; // 'shepard' or 'risset'

        // Shepard tone: 8 octaves of sine oscillators
        this.numOctaves = 8;
        this.basePitch = 32.7; // C1
        this.phase = 0; // 0 to 1, represents position within an octave

        this.oscillators = [];
        this.oscGains = [];

        for (let i = 0; i < this.numOctaves; i++) {
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            const gain = ctx.createGain();
            gain.gain.value = 0;
            osc.connect(gain);
            gain.connect(this.masterGain);
            this.oscillators.push(osc);
            this.oscGains.push(gain);
        }

        // Spectral bell curve: loudest in middle octaves, silent at extremes
        this.bellCenter = 4; // octave 4 is loudest
        this.bellWidth = 2.5;

        this.started = false;
        this.lastUpdateTime = 0;
    }

    start() {
        if (this.started) return;
        this.started = true;
        const now = this.ctx.currentTime;
        this.oscillators.forEach(osc => osc.start(now));
    }

    bellCurve(octave) {
        // Gaussian bell curve centered at bellCenter
        const x = octave - this.bellCenter;
        return Math.exp(-(x * x) / (2 * this.bellWidth * this.bellWidth));
    }

    update(params) {
        if (params.shepard !== undefined) {
            this.intensity = params.shepard;
            this.active = this.intensity > 0.01;

            if (this.active && !this.started) {
                this.start();
            }

            this.masterGain.gain.setTargetAtTime(
                this.intensity * 0.25,
                this.ctx.currentTime, 0.3
            );
        }

        if (params.shepardDirection !== undefined) {
            this.direction = params.shepardDirection > 0.5 ? 1 : -1;
        }

        if (params.shepardSpeed !== undefined) {
            this.speed = params.shepardSpeed;
        }

        if (params.shepardMode !== undefined) {
            this.mode = params.shepardMode;
        }

        if (!this.active || !this.started) return;

        const now = this.ctx.currentTime;
        const dt = now - this.lastUpdateTime;
        this.lastUpdateTime = now;

        if (dt > 0.5) return; // Skip large jumps (e.g., tab unfocused)

        // Advance phase
        const speedHz = 0.005 + this.speed * 0.05; // 0.005 to 0.055 octaves per second
        this.phase += this.direction * speedHz * dt;

        // Wrap phase
        if (this.phase >= 1.0) this.phase -= 1.0;
        if (this.phase < 0.0) this.phase += 1.0;

        // Update each oscillator
        for (let i = 0; i < this.numOctaves; i++) {
            // Each oscillator is at octave i + phase
            const octavePosition = i + this.phase;
            const freq = this.basePitch * Math.pow(2, octavePosition);

            // Clamp to audible range
            if (freq < 20 || freq > 16000) {
                this.oscGains[i].gain.setTargetAtTime(0, now, 0.05);
                continue;
            }

            this.oscillators[i].frequency.setTargetAtTime(freq, now, 0.02);

            // Apply bell curve amplitude
            const amplitude = this.bellCurve(octavePosition) * this.intensity * 0.15;
            this.oscGains[i].gain.setTargetAtTime(amplitude, now, 0.05);
        }

        // Risset mode: add micro-detune for richer illusion
        if (this.mode === 'risset') {
            this.oscillators.forEach((osc, i) => {
                osc.detune.setTargetAtTime(
                    (i - this.numOctaves / 2) * 3,
                    now, 0.1
                );
            });
        } else {
            this.oscillators.forEach(osc => {
                osc.detune.setTargetAtTime(0, now, 0.1);
            });
        }
    }

    getPhase() {
        return this.phase;
    }

    getDirection() {
        return this.direction;
    }
}

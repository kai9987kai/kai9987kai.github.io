/**
 * TidalRhythmModule.js
 * Ocean-synced polyrhythmic pulse engine.
 * Creates evolving rhythmic textures from layered delays and filtered noise bursts.
 */
export default class TidalRhythmModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;
        this.masterGain = ctx.createGain();
        this.masterGain.gain.value = 0;
        this.masterGain.connect(this.output);

        this.active = false;
        this.intensity = 0;
        this.tidalPhase = 0;
        this.lastPulseTime = 0;

        // Polyrhythmic layers (3 against 4 against 5)
        this.layers = [
            { ratio: 3, lastBeat: 0, filter: null, gain: null },
            { ratio: 4, lastBeat: 0, filter: null, gain: null },
            { ratio: 5, lastBeat: 0, filter: null, gain: null }
        ];

        this.initLayers();

        // Deep sub oscillator for the tidal "breath"
        this.subOsc = null;
        this.subGain = ctx.createGain();
        this.subGain.gain.value = 0;
        this.subGain.connect(this.masterGain);

        // Delay network for rhythmic echoes
        this.delays = [];
        for (let i = 0; i < 3; i++) {
            const delay = ctx.createDelay(2.0);
            delay.delayTime.value = 0.15 + i * 0.12;
            const fb = ctx.createGain();
            fb.gain.value = 0.3 - i * 0.05;
            const filter = ctx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 300 + i * 400;
            filter.Q.value = 2;

            delay.connect(filter);
            filter.connect(fb);
            fb.connect(delay);
            filter.connect(this.masterGain);

            this.delays.push({ delay, fb, filter });
        }
    }

    initLayers() {
        this.layers.forEach((layer, i) => {
            layer.filter = this.ctx.createBiquadFilter();
            layer.filter.type = 'bandpass';
            layer.filter.frequency.value = 200 + i * 300;
            layer.filter.Q.value = 4 + i * 2;

            layer.gain = this.ctx.createGain();
            layer.gain.gain.value = 0.3;

            layer.filter.connect(layer.gain);
            layer.gain.connect(this.masterGain);

            // Connect to delay network
            if (this.delays && this.delays[i]) {
                layer.gain.connect(this.delays[i].delay);
            }
        });
    }

    update(params) {
        if (params.tidal !== undefined) {
            this.intensity = params.tidal;
            this.active = this.intensity > 0.01;
            this.masterGain.gain.setTargetAtTime(
                this.intensity * 0.6,
                this.ctx.currentTime, 0.3
            );
        }

        if (!this.active) return;

        const now = this.ctx.currentTime;
        const bpm = params.bpm || 120;
        const beatDur = 60 / bpm;

        // Tidal phase: slow sine modulation (~ 12 second cycle like ocean waves)
        this.tidalPhase = (now * Math.PI * 2 / 12) % (Math.PI * 2);
        const tidalMod = (Math.sin(this.tidalPhase) + 1) * 0.5; // 0 to 1

        // Sub oscillator: deep pulse following tidal cycle
        if (!this.subOsc) {
            this.subOsc = this.ctx.createOscillator();
            this.subOsc.type = 'sine';
            this.subOsc.frequency.value = 40;
            this.subOsc.connect(this.subGain);
            this.subOsc.start();
        }
        this.subOsc.frequency.setTargetAtTime(
            35 + tidalMod * 15,
            now, 0.5
        );
        this.subGain.gain.setTargetAtTime(
            this.intensity * 0.15 * tidalMod,
            now, 0.1
        );

        // Trigger polyrhythmic pulses
        this.layers.forEach((layer, i) => {
            const layerBeatDur = beatDur * (4 / layer.ratio);
            if (now - layer.lastBeat >= layerBeatDur) {
                layer.lastBeat = now;
                this.triggerPulse(layer, i, tidalMod);
            }
        });

        // Rain synergy: more rain = denser, wetter sound
        const rainMod = (params.rain || 0) * 0.5;
        this.delays.forEach((d, i) => {
            d.fb.gain.setTargetAtTime(
                0.2 + rainMod * 0.3 - i * 0.03,
                now, 0.3
            );
        });
    }

    triggerPulse(layer, index, tidalMod) {
        const now = this.ctx.currentTime;

        // Noise burst
        const bufLen = Math.floor(this.ctx.sampleRate * 0.05);
        const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
        const data = buf.getChannelData(0);

        for (let i = 0; i < bufLen; i++) {
            const env = 1 - (i / bufLen);
            data[i] = (Math.random() * 2 - 1) * env * env;
        }

        const src = this.ctx.createBufferSource();
        src.buffer = buf;

        const env = this.ctx.createGain();
        env.gain.setValueAtTime(0.4 * this.intensity * (0.5 + tidalMod * 0.5), now);
        env.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

        // Modulate filter frequency with tidal phase
        layer.filter.frequency.setTargetAtTime(
            200 + index * 300 + tidalMod * 500,
            now, 0.05
        );

        src.connect(env);
        env.connect(layer.filter);
        src.start(now);
        src.stop(now + 0.08);
    }

    getPhase() {
        return this.tidalPhase;
    }
}

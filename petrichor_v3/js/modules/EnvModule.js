import AudioUtils from '../AudioUtils.js';

export default class EnvModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;

        // Nodes
        this.rainSrc = null;
        this.rainGain = null;
        this.rainFilter = null;

        this.trafficSrc = null;
        this.trafficGain = null;
        this.trafficFilter = null;

        this.dropGain = null;

        // State
        this.surface = 'concrete';
        this.dropTimer = null;
        this.thunderTimer = null;

        this.params = {
            rain: 0,
            drops: 0,
            thunder: 0,
            traffic: 0
        };

        this.init();
    }

    init() {
        const t = this.ctx.currentTime;

        // Rain
        const whiteBuf = AudioUtils.createWhiteNoise(this.ctx);
        this.rainSrc = this.ctx.createBufferSource();
        this.rainSrc.buffer = whiteBuf;
        this.rainSrc.loop = true;

        this.rainFilter = this.ctx.createBiquadFilter();
        this.rainFilter.type = 'bandpass';
        this.rainFilter.frequency.value = 3500; // Default concrete
        this.rainFilter.Q.value = 0.8;

        this.rainGain = this.ctx.createGain();
        this.rainGain.gain.setValueAtTime(0, t);

        this.rainSrc.connect(this.rainFilter);
        this.rainFilter.connect(this.rainGain);
        this.rainGain.connect(this.output);
        this.rainSrc.start();

        // Traffic
        const brownBuf = AudioUtils.createBrownNoise(this.ctx);
        this.trafficSrc = this.ctx.createBufferSource();
        this.trafficSrc.buffer = brownBuf;
        this.trafficSrc.loop = true;

        this.trafficFilter = this.ctx.createBiquadFilter();
        this.trafficFilter.type = 'lowpass';
        this.trafficFilter.frequency.value = 200;

        this.trafficGain = this.ctx.createGain();
        this.trafficGain.gain.setValueAtTime(0, t);

        this.trafficSrc.connect(this.trafficFilter);
        this.trafficFilter.connect(this.trafficGain);
        this.trafficGain.connect(this.output);
        this.trafficSrc.start();

        // Drops master gain
        this.dropGain = this.ctx.createGain();
        this.dropGain.gain.setValueAtTime(0, t);
        this.dropGain.connect(this.output);

        // Timers
        this.startDroplets();
        this.startThunder();
    }

    update(params) {
        const t = this.ctx.currentTime;
        const ramp = 0.1;

        if (params.rain !== undefined) {
            this.params.rain = params.rain;
            this.rainGain.gain.setTargetAtTime(params.rain * 0.4, t, ramp);
        }

        if (params.traffic !== undefined) {
            this.params.traffic = params.traffic;
            this.trafficGain.gain.setTargetAtTime(params.traffic * 0.3, t, ramp);
            this.trafficFilter.frequency.setTargetAtTime(120 + params.traffic * 180, t, ramp);
        }

        if (params.drops !== undefined) {
            this.params.drops = params.drops;
            this.dropGain.gain.setTargetAtTime(params.drops * 0.6, t, ramp);
        }

        if (params.thunder !== undefined) {
            this.params.thunder = params.thunder;
        }
    }

    setSurface(type) {
        this.surface = type;
        const t = this.ctx.currentTime;
        const p = {
            concrete: { f: 3500, q: 0.8 },
            soil: { f: 1500, q: 0.5 },
            metal: { f: 5000, q: 1.5 },
            leaves: { f: 1200, q: 0.4 }
        }[type] || { f: 3500, q: 0.8 };

        this.rainFilter.frequency.setTargetAtTime(p.f, t, 0.2);
        this.rainFilter.Q.setTargetAtTime(p.q, t, 0.2);
    }

    startDroplets() {
        if (this.dropTimer) clearInterval(this.dropTimer);
        this.dropTimer = setInterval(() => {
            if (this.ctx.state !== 'running') return;
            // Chance based on intensity
            if (Math.random() > this.params.drops * 1.5 + 0.05) return;
            this.spawnDrop();
        }, 80);
    }

    spawnDrop() {
        const t = this.ctx.currentTime;
        // Surface characteristics
        const p = {
            concrete: { f: 2800, d: 0.04, w: 'sine', g: 0.12, fVar: 1800 },
            soil: { f: 800, d: 0.025, w: 'sine', g: 0.06, fVar: 600 },
            metal: { f: 4000, d: 0.08, w: 'triangle', g: 0.09, fVar: 3000 },
            leaves: { f: 600, d: 0.02, w: 'sine', g: 0.04, fVar: 400 }
        }[this.surface];

        const freq = p.f + Math.random() * p.fVar;
        const osc = this.ctx.createOscillator();
        osc.type = p.w;
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.3, t + p.d);

        const env = this.ctx.createGain();
        env.gain.setValueAtTime(p.g, t);
        env.gain.setTargetAtTime(0, t + p.d, 0.005);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = freq * 0.8;
        filter.Q.value = 1.5;

        const pan = this.ctx.createStereoPanner();
        pan.pan.value = Math.random() * 2 - 1;

        osc.connect(filter);
        filter.connect(env);
        env.connect(pan);
        pan.connect(this.dropGain);

        osc.start(t);
        osc.stop(t + p.d + 0.05);
        osc.onended = () => {
            osc.disconnect();
            filter.disconnect();
            env.disconnect();
            pan.disconnect();
        };
    }

    startThunder() {
        if (this.thunderTimer) clearInterval(this.thunderTimer);
        this.thunderTimer = setInterval(() => {
            if (this.ctx.state !== 'running') return;
            // 5% chance scaling with slider
            if (Math.random() < this.params.thunder * 0.05) this.fireThunder();
        }, 2000);
    }

    fireThunder() {
        const t = this.ctx.currentTime;
        const dur = 1.5 + Math.random() * 2;

        console.log("Thunder Fired");

        // Rumble Oscillator
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(40 + Math.random() * 30, t);
        osc.frequency.linearRampToValueAtTime(20, t + dur);

        const oscGain = this.ctx.createGain();
        oscGain.gain.setValueAtTime(0, t);
        oscGain.gain.linearRampToValueAtTime(0.25, t + 0.1);
        oscGain.gain.setTargetAtTime(0, t + dur * 0.8, 0.2);

        const oscFilter = this.ctx.createBiquadFilter();
        oscFilter.type = 'lowpass';
        oscFilter.frequency.value = 150;

        osc.connect(oscFilter);
        oscFilter.connect(oscGain);
        oscGain.connect(this.output);

        // Crackle Noise
        const noise = this.ctx.createBufferSource();
        noise.buffer = AudioUtils.createWhiteNoise(this.ctx);

        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = 800;

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0, t);
        noiseGain.gain.linearRampToValueAtTime(0.12, t + 0.05);
        noiseGain.gain.setTargetAtTime(0, t + 0.1, 0.05);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.output);

        osc.start(t);
        osc.stop(t + dur + 0.5);
        noise.start(t);
        noise.stop(t + 0.5);
    }
}

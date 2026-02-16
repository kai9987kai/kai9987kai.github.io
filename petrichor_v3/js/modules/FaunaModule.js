export default class FaunaModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;
        this.masterGain = ctx.createGain();
        this.masterGain.connect(this.output);

        this.params = {
            time: 12,
            rain: 0,
            life: 0.5 // Density
        };

        this.nextCreatureTime = 0;
        this.active = true;
        this.schedule();
    }

    update(params) {
        if (params.time !== undefined) this.params.time = params.time;
        if (params.rain !== undefined) this.params.rain = params.rain;
        if (params.life !== undefined) this.params.life = params.life;
    }

    schedule() {
        if (!this.active) return;

        const now = this.ctx.currentTime;
        if (now >= this.nextCreatureTime) {
            this.trySpawnCreature();

            // Next spawn depends on density
            // Life 0 = never
            // Life 1 = freq (every 2-5s)
            if (this.params.life > 0.1) {
                const baseInterval = 10 - (this.params.life * 8); // 2s to 10s
                this.nextCreatureTime = now + baseInterval * (0.5 + Math.random());
            } else {
                this.nextCreatureTime = now + 5; // Check again later
            }
        }

        requestAnimationFrame(() => this.schedule());
    }

    trySpawnCreature() {
        if (this.params.life < 0.1) return;

        const isDay = this.params.time >= 6 && this.params.time < 19;
        const isNight = !isDay;
        const isRainy = this.params.rain > 0.4;

        // Probability check against life density
        if (Math.random() > this.params.life) return;

        if (isRainy && Math.random() < 0.6) {
            this.playFrog();
        } else if (isDay) {
            this.playBird();
        } else if (isNight) {
            // Owls are rare
            if (Math.random() < 0.3) this.playOwl();
            else this.playCricket(); // Maybe simple cricket chirp if not handled by Chronos?
            // Chronos handles background crickets loop. This is for one-shot events.
        }
    }

    playBird() {
        const t = this.ctx.currentTime;
        // Simple FM Chirp
        const osc = this.ctx.createOscillator();
        const mod = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const modGain = this.ctx.createGain();

        // High pitch, quick envelope
        const freq = 2000 + Math.random() * 2000;
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.5, t + 0.1);

        mod.frequency.value = 50 + Math.random() * 100;
        modGain.gain.value = 500;

        mod.connect(modGain);
        modGain.connect(osc.frequency);
        osc.connect(gain);
        gain.connect(this.masterGain);

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.1, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

        osc.start(t);
        mod.start(t);
        osc.stop(t + 0.3);
        mod.stop(t + 0.3);

        // Cleanup
        setTimeout(() => gain.disconnect(), 500);
    }

    playOwl() {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        // Hoo... Hoo-hoo
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, t);
        osc.frequency.linearRampToValueAtTime(350, t + 0.4);

        osc.connect(gain);
        gain.connect(this.masterGain);

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.15, t + 0.1);
        gain.gain.linearRampToValueAtTime(0, t + 0.5);

        osc.start(t);
        osc.stop(t + 0.6);

        setTimeout(() => gain.disconnect(), 1000);
    }

    playFrog() {
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.value = 100 + Math.random() * 50;

        filter.type = 'bandpass';
        filter.Q.value = 5;
        filter.frequency.setValueAtTime(600, t);
        filter.frequency.setTargetAtTime(1200, t, 0.1); // SmootherArticulated sweep

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.1, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);

        osc.start(t);
        osc.stop(t + 0.4);

        setTimeout(() => gain.disconnect(), 1000);
    }

    playCricket() {
        // Just a tiny high pitched click/chirp
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.frequency.value = 4000;
        osc.type = 'triangle';

        osc.connect(gain);
        gain.connect(this.masterGain);

        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.05, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

        osc.start(t);
        osc.stop(t + 0.1);
        setTimeout(() => gain.disconnect(), 200);
    }
}

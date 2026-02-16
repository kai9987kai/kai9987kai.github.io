export default class StringsModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;
        this.masterGain = ctx.createGain();
        this.masterGain.gain.value = 0;
        this.masterGain.connect(this.output);

        this.active = false;
        this.timer = null;
        this.volume = 0;

        // C Minor: C, Eb, G
        // Sustained chords
        this.chords = [
            [48, 55, 63], // Cm (Open)
            [46, 53, 60], // Bb (Inverted)
            [51, 58, 65], // Eb (Major)
            [44, 51, 58]  // Ab (Major)
        ];

        this.currentNodes = [];
    }

    setGain(val) {
        this.volume = val;
        this.masterGain.gain.setTargetAtTime(this.volume * 0.5, this.ctx.currentTime, 1.0);

        if (this.volume > 0.05 && !this.active) this.start();
        else if (this.volume <= 0.05 && this.active) this.stop();
    }

    update(params) {
        if (params.strings !== undefined) {
            this.setGain(params.strings);
        }
    }

    start() {
        if (this.active) return;
        this.active = true;
        this.scheduleNextChord();
    }

    stop() {
        this.active = false;
        if (this.timer) clearTimeout(this.timer);
        this.releaseChord();
    }

    scheduleNextChord() {
        if (!this.active) return;

        // Pick a chord
        const chord = this.chords[Math.floor(Math.random() * this.chords.length)];

        this.crossfadeChord(chord);

        // Hold for 8-15 seconds
        const dur = 8000 + Math.random() * 7000;
        this.timer = setTimeout(() => {
            this.scheduleNextChord();
        }, dur);
    }

    releaseChord() {
        const t = this.ctx.currentTime;
        this.currentNodes.forEach(n => {
            n.gain.gain.cancelScheduledValues(t);
            n.gain.gain.setTargetAtTime(0, t, 1.0);
            n.osc.stop(t + 4.0);
        });
        this.currentNodes = [];
    }

    crossfadeChord(chordMidis) {
        const t = this.ctx.currentTime;

        // Fade out current
        this.releaseChord();

        // Fade in new
        const dur = 10; // Overlap duration logic is handled by slow release + new attack

        chordMidis.forEach(midi => {
            const freq = 440 * Math.pow(2, (midi - 69) / 12);

            // Multiple Detuned Saws for thickness
            const createVoice = (detune) => {
                const osc = this.ctx.createOscillator();
                osc.type = 'sawtooth';
                osc.frequency.value = freq;
                osc.detune.value = detune; // +/- cents

                const filter = this.ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = 800 + Math.random() * 400; // Mellow

                const gain = this.ctx.createGain();
                gain.gain.value = 0;

                osc.connect(filter);
                filter.connect(gain);
                gain.connect(this.masterGain);

                osc.start(t);

                // Slow attack
                gain.gain.setTargetAtTime(0.08, t, 2.0); // 2s attack

                return { osc, gain };
            };

            this.currentNodes.push(createVoice(-12));
            this.currentNodes.push(createVoice(12));
        });
    }
}

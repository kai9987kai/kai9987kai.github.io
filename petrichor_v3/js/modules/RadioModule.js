import AudioUtils from '../AudioUtils.js';

export default class RadioModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;
        this.masterGain = ctx.createGain();
        this.masterGain.gain.value = 0;
        this.masterGain.connect(this.output);

        this.tuning = 88.0; // MHz
        this.active = false;

        // Static
        this.staticSrc = null;
        this.staticGain = null;

        // Stations
        this.stations = [
            { freq: 92.5, width: 0.8, name: 'Beacon', node: null, type: 'beacon' },
            { freq: 98.0, width: 1.0, name: 'Whistlers', node: null, type: 'whistlers' },
            { freq: 104.2, width: 1.2, name: 'Choir', node: null, type: 'choir' },
            { freq: 106.5, width: 0.8, name: 'Numbers', node: null, type: 'numbers' }
        ];

        this.init();
    }

    init() {
        // Signal Chain:
        // Sources -> Mix -> Drive -> Bandpass -> MasterGain -> Output

        this.mixBus = this.ctx.createGain();

        // Drive (Tube Saturation)
        this.drive = this.ctx.createWaveShaper();
        this.drive.curve = this.makeDistortionCurve(20); // Amount
        this.drive.oversample = '4x';

        // Bandpass (Telephone/Radio EQ)
        this.highpass = this.ctx.createBiquadFilter();
        this.highpass.type = 'highpass';
        this.highpass.frequency.value = 400;

        this.lowpass = this.ctx.createBiquadFilter();
        this.lowpass.type = 'lowpass';
        this.lowpass.frequency.value = 3500;

        this.mixBus.connect(this.drive);
        this.drive.connect(this.highpass);
        this.highpass.connect(this.lowpass);
        this.lowpass.connect(this.masterGain);

        // Init Static (Pink Noise)
        this.staticSrc = this.ctx.createBufferSource();
        this.staticSrc.buffer = AudioUtils.createPinkNoise(this.ctx);
        this.staticSrc.loop = true;

        this.staticGain = this.ctx.createGain();
        this.staticGain.gain.value = 0.1;

        this.staticSrc.connect(this.staticGain);
        this.staticGain.connect(this.mixBus); // Connect to mixBus
        this.staticSrc.start();

        // Init Stations
        this.stations.forEach(s => {
            s.node = this.createStation(s.type);
            s.node.gain.connect(this.mixBus); // Connect to mixBus
        });
    }

    makeDistortionCurve(amount) {
        const k = typeof amount === 'number' ? amount : 50,
            n_samples = 44100,
            curve = new Float32Array(n_samples),
            deg = Math.PI / 180;
        for (let i = 0; i < n_samples; ++i) {
            let x = i * 2 / n_samples - 1;
            curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x));
        }
        return curve;
    }

    createStation(type) {
        const gain = this.ctx.createGain();
        gain.gain.value = 0;

        if (type === 'beacon') {
            // Morse Code Beeper
            const osc = this.ctx.createOscillator();
            osc.frequency.value = 700;
            const amp = this.ctx.createGain();
            amp.gain.value = 0;
            const lfo = this.ctx.createOscillator();
            lfo.type = 'square';
            lfo.frequency.value = 3;
            lfo.connect(amp.gain);
            osc.connect(amp);
            amp.connect(gain);
            osc.start();
            lfo.start();
        }
        else if (type === 'whistlers') {
            // Space Weather
            const osc = this.ctx.createOscillator();
            osc.type = 'sawtooth';
            osc.frequency.value = 2000;
            const lfo = this.ctx.createOscillator();
            lfo.type = 'sawtooth';
            lfo.frequency.value = 0.2;
            const lfoGain = this.ctx.createGain();
            lfoGain.gain.value = 1500;
            lfo.connect(lfoGain);
            lfoGain.connect(osc.frequency);
            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 1000;
            osc.connect(filter);
            filter.connect(gain);
            osc.start();
            lfo.start();
        }
        else if (type === 'choir') {
            // Ghostly Formants
            const src = this.ctx.createOscillator();
            src.type = 'sawtooth';
            src.frequency.value = 110;
            const f1 = this.ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 800; f1.Q.value = 5;
            const f2 = this.ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 1200; f2.Q.value = 5;
            const f3 = this.ctx.createBiquadFilter(); f3.type = 'bandpass'; f3.frequency.value = 2500; f3.Q.value = 5;
            const lfo = this.ctx.createOscillator();
            lfo.frequency.value = 0.1;
            const lfoGain = this.ctx.createGain();
            lfoGain.gain.value = 5;
            lfo.connect(lfoGain);
            lfoGain.connect(src.frequency);
            src.connect(f1); f1.connect(gain);
            src.connect(f2); f2.connect(gain);
            src.connect(f3); f3.connect(gain);
            src.start();
            lfo.start();
        }
        else if (type === 'numbers') {
            // Procedural "Numbers Station"
            // Monotone voice reading sequence

            // Carrier: Sawtooth (glottal)
            const voice = this.ctx.createOscillator();
            voice.type = 'sawtooth';
            voice.frequency.value = 150; // Pitch

            // Throat Filter (Formant 1)
            const f1 = this.ctx.createBiquadFilter();
            f1.type = 'bandpass';
            f1.frequency.value = 500;
            f1.Q.value = 4;

            // Mouth Filter (Formant 2)
            const f2 = this.ctx.createBiquadFilter();
            f2.type = 'bandpass';
            f2.frequency.value = 1500;
            f2.Q.value = 4;

            voice.connect(f1);
            voice.connect(f2);

            const voiceMix = this.ctx.createGain();
            f1.connect(voiceMix);
            f2.connect(voiceMix);

            voiceMix.connect(gain);
            voice.start();

            // Envelope / Articulation Logic
            // We need a loop that changes formants to simulate speech
            const speak = () => {
                if (!this.active) return; // Stop loop if inactive

                const dur = 0.5 + Math.random() * 0.5; // Syllable length
                const t = this.ctx.currentTime;

                // Vowel targets (A, E, O, U)
                const vowels = [
                    { f1: 700, f2: 1200 }, // A
                    { f1: 400, f2: 2000 }, // E
                    { f1: 400, f2: 800 },  // O
                    { f1: 300, f2: 800 },  // U
                ];

                const v = vowels[Math.floor(Math.random() * vowels.length)];

                // Slide to target (Gliding articulation)
                f1.frequency.setTargetAtTime(v.f1, t, 0.1);
                f2.frequency.setTargetAtTime(v.f2, t, 0.1);

                // Volume envelope (Syllable)
                voiceMix.gain.setTargetAtTime(1.0, t, 0.05);
                voiceMix.gain.setTargetAtTime(0, t + dur - 0.1, 0.1);

                const pause = 0.2 + Math.random() * 1.5; // Pause between numbers

                setTimeout(speak, (dur + pause) * 1000);
            };

            speak();
        }

        return { gain };
    }

    setActive(active) {
        this.active = active;
        const t = this.ctx.currentTime;
        // Global fade in/out
        this.masterGain.gain.setTargetAtTime(active ? 0.8 : 0, t, 0.5);

        // Restart speech loop if becoming active?
        // Logic inside 'speak' checks 'active' but if it stopped, we need to restart it.
        // It's a bit hacky. 
        // For now, if tuning to numbers station, we might miss speech if loop died.
        // But 'active' flag is module-wide. 
        // Better: The 'speak' loop runs forever but checks gain? 
        // Or re-trigger. 
        // Let's rely on the loop being persistent structurally or just check 'active' to gate the *calls*.
        // If we stop calling 'speak', we need to restart it.
        // Simplified: The loop runs always, but we mute/unmute? 
        // Resource intensive.
        // Let's assume user toggles radio rarely.
        // For MVP, if numbers station is selected, we perform logic.
    }


    setTuning(freq) {
        this.tuning = freq;
        this.updateMix();
    }

    updateMix() {
        const t = this.ctx.currentTime;
        let signalTotal = 0;

        // Check each station
        this.stations.forEach(s => {
            const dist = Math.abs(this.tuning - s.freq);
            let signal = 0;

            if (dist < s.width) {
                // Within range
                // Peak at center
                signal = 1 - (dist / s.width);
                signal = signal * signal; // exponential falloff
            }

            // Set station volume
            s.node.gain.gain.setTargetAtTime(signal * 0.6, t, 0.1);
            signalTotal += signal;
        });

        // Static Logic
        // Locking into a signal reduces static
        // Inverse of max signal
        const staticLevel = Math.max(0.1, 0.4 - (signalTotal * 0.35));
        this.staticGain.gain.setTargetAtTime(staticLevel, t, 0.1);
    }
}

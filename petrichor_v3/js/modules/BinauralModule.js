export default class BinauralModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;

        this.leftOsc = null;
        this.rightOsc = null;
        this.leftPan = null;
        this.rightPan = null;
        this.gain = null;

        this.baseFreq = 200;
        this.currentMode = 'alpha';

        this.modes = {
            alpha: 10,  // Relaxed focus
            theta: 6,   // Deep relaxation
            delta: 3    // Sleep
        };

        this.params = {
            binaural: 0
        };

        this.init();
    }

    init() {
        const t = this.ctx.currentTime;

        this.gain = this.ctx.createGain();
        this.gain.gain.setValueAtTime(0, t);
        this.gain.connect(this.output);

        // Left Ear
        this.leftOsc = this.ctx.createOscillator();
        this.leftOsc.type = 'sine';
        this.leftPan = this.ctx.createStereoPanner();
        this.leftPan.pan.value = -1; // Full Left

        this.leftOsc.connect(this.leftPan);
        this.leftPan.connect(this.gain);

        // Right Ear
        this.rightOsc = this.ctx.createOscillator();
        this.rightOsc.type = 'sine';
        this.rightPan = this.ctx.createStereoPanner();
        this.rightPan.pan.value = 1; // Full Right

        this.rightOsc.connect(this.rightPan);
        this.rightPan.connect(this.gain);

        this.updateFrequencies();

        this.leftOsc.start();
        this.rightOsc.start();
    }

    setMode(mode) {
        if (this.modes[mode]) {
            this.currentMode = mode;
            this.updateFrequencies();
        }
    }

    updateFrequencies() {
        const t = this.ctx.currentTime;
        const diff = this.modes[this.currentMode] / 2;

        // Left = Base - (Diff/2)
        // Right = Base + (Diff/2)
        // Difference = Diff

        this.leftOsc.frequency.setTargetAtTime(this.baseFreq - diff, t, 0.1);
        this.rightOsc.frequency.setTargetAtTime(this.baseFreq + diff, t, 0.1);
    }

    update(params) {
        if (params.binaural !== undefined) {
            this.params.binaural = params.binaural;
            const t = this.ctx.currentTime;

            // Mix gain
            this.gain.gain.setTargetAtTime(this.params.binaural * 0.15, t, 0.2);
        }
    }
}

import AudioUtils from '../AudioUtils.js';

export default class ReverbModule {
    constructor(ctx, inputNode) {
        this.ctx = ctx;
        this.input = inputNode;
        this.output = this.ctx.createGain(); // Dedicated output node

        this.convolver = null;
        this.wetGain = null;
        this.dryGain = null;

        this.impulses = {};
        this.currentType = 'street';

        this.init();
    }

    init() {
        this.convolver = this.ctx.createConvolver();

        this.dryGain = this.ctx.createGain();
        this.wetGain = this.ctx.createGain();

        // Wiring: Input -> Dry -> Output
        this.input.connect(this.dryGain);
        this.dryGain.connect(this.output);

        // Wiring: Input -> Convolver -> Wet -> Output
        this.input.connect(this.convolver);
        this.convolver.connect(this.wetGain);
        this.wetGain.connect(this.output);

        // Generate IRs
        this.generateImpulses();
        this.setPreset('street');
    }

    generateImpulses() {
        // decay, dens, bright, stereo
        this.impulses.street = AudioUtils.createImpulseResponse(this.ctx, 1.6, 0.5, 2, 0.6);
        this.impulses.alley = AudioUtils.createImpulseResponse(this.ctx, 0.9, 0.8, 3, 0.3);
        this.impulses.field = AudioUtils.createImpulseResponse(this.ctx, 3.0, 0.2, 1, 0.9);
        this.impulses.hall = AudioUtils.createImpulseResponse(this.ctx, 4.5, 0.6, 0.5, 0.8);
    }

    setPreset(type) {
        if (type === 'none') {
            this.wetGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
            this.dryGain.gain.setTargetAtTime(1, this.ctx.currentTime, 0.2);
            return;
        }

        if (this.impulses[type]) {
            this.currentType = type;
            this.convolver.buffer = this.impulses[type];
            this.wetGain.gain.setTargetAtTime(0.4, this.ctx.currentTime, 0.2);
            this.dryGain.gain.setTargetAtTime(0.6, this.ctx.currentTime, 0.2);
        }
    }
}

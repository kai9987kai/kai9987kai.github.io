export default class PollinatorModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;
        this.masterGain = ctx.createGain();
        this.masterGain.gain.value = 0.3;
        this.masterGain.connect(this.output);

        this.bees = [];
        this.activity = 0.5;
        this.maxBees = 12;
    }

    update(params) {
        if (params.bees !== undefined) this.activity = params.bees;
    }

    syncWithViz(vizBees) {
        // Create/Update audio voices for each bee in the viz
        vizBees.forEach((bee, index) => {
            if (!this.bees[index]) {
                this.bees[index] = this.createBeeVoice();
            }
            this.updateBeeVoice(this.bees[index], bee);
        });

        // Cleanup unused voices
        if (this.bees.length > vizBees.length) {
            for (let i = vizBees.length; i < this.bees.length; i++) {
                this.stopBeeVoice(this.bees[i]);
            }
            this.bees.length = vizBees.length;
        }
    }

    createBeeVoice() {
        const now = this.ctx.currentTime;

        // FM Buzz Synth
        const osc = this.ctx.createOscillator();
        const mod = this.ctx.createOscillator();
        const modGain = this.ctx.createGain();
        const beeGain = this.ctx.createGain();
        const panner = this.ctx.createStereoPanner();

        osc.type = 'sawtooth';
        osc.frequency.value = 150 + Math.random() * 50;

        mod.type = 'sine';
        mod.frequency.value = 40 + Math.random() * 20;
        modGain.gain.value = 200;

        mod.connect(modGain);
        modGain.connect(osc.frequency);

        beeGain.gain.setValueAtTime(0, now);
        beeGain.gain.linearRampToValueAtTime(0.2, now + 0.1);

        osc.connect(beeGain);
        beeGain.connect(panner);
        panner.connect(this.masterGain);

        osc.start(now);
        mod.start(now);

        return { osc, mod, modGain, beeGain, panner };
    }

    updateBeeVoice(voice, beeData) {
        // Panning: beeData.x is 0 to canvas.width
        // StereoPanner.pan is -1 (left) to 1 (right)
        const rawPan = (beeData.x / (beeData.canvasWidth || 800)) * 2 - 1;
        const pan = Math.max(-1, Math.min(1, rawPan));
        voice.panner.pan.value = pan;

        // Pitch varies slightly with movement speed or "effort"
        const speed = Math.sqrt(beeData.vx * beeData.vx + beeData.vy * beeData.vy);
        voice.osc.frequency.setTargetAtTime(150 + speed * 20, this.ctx.currentTime, 0.1);

        // Volume dips if far away (simulated by vertical pos or size if we had 3D, here let's just use activity)
        voice.beeGain.gain.setTargetAtTime(0.2 * this.activity, this.ctx.currentTime, 0.1);
    }

    stopBeeVoice(voice) {
        const now = this.ctx.currentTime;
        voice.beeGain.gain.linearRampToValueAtTime(0, now + 0.1);
        setTimeout(() => {
            voice.osc.stop();
            voice.mod.stop();
            voice.osc.disconnect();
            voice.mod.disconnect();
        }, 200);
    }
}

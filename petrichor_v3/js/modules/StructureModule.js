export default class StructureModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;

        this.params = {
            material: 0.5, // 0 = Glass, 1 = Concrete
            tension: 0.5,  // Tone (Pitch)
        };
    }

    strike() {
        const t = this.ctx.currentTime;

        // 1. Exciter: Short burst of noise
        const exciterLen = 0.01;
        const exciterSource = this.ctx.createBufferSource();
        const exciterBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * exciterLen, this.ctx.sampleRate);
        const data = exciterBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        exciterSource.buffer = exciterBuffer;

        const exciterGain = this.ctx.createGain();
        exciterGain.gain.setValueAtTime(0.5, t);
        exciterGain.gain.exponentialRampToValueAtTime(0.001, t + exciterLen);

        // 2. Resonator: Feedback Delay Line (Karplus-Strong)
        const delay = this.ctx.createDelay(1.0);
        // Map tension to delay time (inverse relationship)
        // Tension 0.0 -> 0.05s (Low pitch), Tension 1.0 -> 0.001s (High pitch)
        const delayTime = 0.05 - (this.params.tension * 0.049);
        delay.delayTime.setValueAtTime(delayTime, t);

        const feedback = this.ctx.createGain();
        // Feedback value determines decay.
        // Material 0 (Glass) -> High feedback (0.99), Material 1 (Concrete) -> Low feedback (0.8)
        const feedbackVal = 0.99 - (this.params.material * 0.15);
        feedback.gain.setValueAtTime(feedbackVal, t);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        // Material also affects brightness of feedback
        filter.frequency.setValueAtTime(20000 - (this.params.material * 18000), t);

        // Routing
        exciterSource.connect(exciterGain);
        exciterGain.connect(delay);
        delay.connect(filter);
        filter.connect(feedback);
        feedback.connect(delay); // Loop back

        delay.connect(this.output);

        exciterSource.start(t);

        // Cleanup after sound decays (approx 4s max)
        setTimeout(() => {
            exciterSource.disconnect();
            exciterGain.disconnect();
            delay.disconnect();
            filter.disconnect();
            feedback.disconnect();
        }, 4000);
    }

    update(params) {
        if (params.material !== undefined) this.params.material = params.material;
        if (params.tension !== undefined) this.params.tension = params.tension;
    }
}

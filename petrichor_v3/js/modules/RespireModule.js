export default class RespireModule {
    constructor(ctx, inputNode, outputNode) {
        this.ctx = ctx;
        this.input = inputNode;
        this.output = outputNode;

        this.breathGain = null;
        this.active = false;

        // 4-7-8 Breathing (seconds)
        // Inhale: 4
        // Hold: 7 
        // Exhale: 8
        this.phases = {
            inhale: 4,
            hold: 7,
            exhale: 8
        };

        // We'll use a simple sine LFO for "box" breathing feeling for now, 
        // or a custom curve if we want strict 4-7-8. 
        // For audio modulation, a simple 0.25Hz (4s) swell is nice but too fast.
        // Let's do a 6-second cycle (5 in, 5 out) for simplicity first?
        // Plan says 4-7-8.

        this.startTime = 0;

        this.init();
    }

    init() {
        this.breathGain = this.ctx.createGain();
        this.breathGain.gain.value = 1; // Default pass-through

        this.input.connect(this.breathGain);
        this.breathGain.connect(this.output);
    }

    update(params) {
        if (params.respire !== undefined) {
            this.active = params.respire;

            if (!this.active) {
                // Reset gain
                this.breathGain.gain.setTargetAtTime(1, this.ctx.currentTime, 0.5);
            }
        }

        if (this.active) {
            this.animateBreath();
        }
    }

    animateBreath() {
        // Check current time within cycle
        const cycleDur = this.phases.inhale + this.phases.hold + this.phases.exhale;
        const t = this.ctx.currentTime % cycleDur;

        // Audio effect: Swell volume slightly during inhale, hold, then standard during exhale?
        // Or dip volume during hold?
        // Let's slight swell (1.2x) on inhale, back to 1.0 on exhale.

        let targetGain = 1.0;

        if (t < this.phases.inhale) {
            // Inhaling (0 -> 4s)
            // Ramp 0.8 -> 1.0
            // actually let's dampen background to focus
        } else if (t < this.phases.inhale + this.phases.hold) {
            // Holding
        } else {
            // Exhaling
        }

        // Actually, let's keep audio subtle. Maybe a low pass filter opening/closing?
        // For now, just a gentle volume drift is okay.

        // 0.8 to 1.0 sine wave matching roughly 10s period
        const breathLFO = Math.sin(this.ctx.currentTime * 2 * Math.PI / 10); // 0.1Hz
        const val = 0.9 + breathLFO * 0.1; // 0.8 to 1.0

        this.breathGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.1);
    }
}

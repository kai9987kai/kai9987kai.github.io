export default class CelestialAlignmentModule {
    constructor(ctx, masterGain) {
        this.ctx = ctx;
        this.masterGain = masterGain;

        this.events = [
            'SOLAR_FLARE',
            'LUNAR_ECLIPSE',
            'METEOR_SHOWER',
            'MAGNETIC_STORM',
            'VOID_RIFT'
        ];

        this.currentEvent = null;
        this.lastEventTime = 0;
        this.nextEventTime = this.ctx.currentTime + 30 + Math.random() * 60; // First event in 30-90s

        // Effects
        this.flareGain = ctx.createGain();
        this.flareGain.gain.value = 0;

        // Connect hack: We need to inject into master chain or modify params.
        // For simplicity, we'll mostly modify params via getParams override/injection
        // But for audio, let's have a dedicated drone or effect.

        this.droneOsc = ctx.createOscillator();
        this.droneOsc.type = 'sawtooth';
        this.droneOsc.frequency.value = 55;
        this.droneGain = ctx.createGain();
        this.droneGain.gain.value = 0;

        this.droneOsc.connect(this.droneGain);
        this.droneGain.connect(masterGain);
        this.droneOsc.start();
    }

    update(params) {
        const t = this.ctx.currentTime;

        // Check Trigger
        if (!this.currentEvent && t > this.nextEventTime) {
            this.triggerEvent();
        }

        // Update Active Event
        if (this.currentEvent) {
            const progress = (t - this.currentEvent.startTime) / this.currentEvent.duration;

            if (progress >= 1) {
                this.endEvent();
            } else {
                this.processEvent(this.currentEvent.type, progress);
            }
        }
    }

    triggerEvent() {
        const type = this.events[Math.floor(Math.random() * this.events.length)];
        const duration = 15 + Math.random() * 10; // 15-25s duration

        this.currentEvent = {
            type: type,
            startTime: this.ctx.currentTime,
            duration: duration
        };

        console.log(`[CELESTIAL] Event Triggered: ${type}`);
    }

    endEvent() {
        console.log(`[CELESTIAL] Event Ended: ${this.currentEvent.type}`);
        this.currentEvent = null;
        this.nextEventTime = this.ctx.currentTime + 60 + Math.random() * 120; // Next in 1-3 mins

        // Reset Audio
        this.droneGain.gain.setTargetAtTime(0, this.ctx.currentTime, 2);
    }

    processEvent(type, progress) {
        // Bell curve intensity: 0 -> 1 -> 0
        const intensity = Math.sin(progress * Math.PI);
        const t = this.ctx.currentTime;

        switch (type) {
            case 'SOLAR_FLARE':
                // Bright, distored, loud high pitch
                this.droneOsc.frequency.setTargetAtTime(110 + intensity * 50, t, 0.1);
                this.droneGain.gain.setTargetAtTime(0.05 * intensity, t, 0.1);
                break;
            case 'LUNAR_ECLIPSE':
                // Dark, deep bass, quiet
                this.droneOsc.frequency.setTargetAtTime(55 - intensity * 20, t, 0.1);
                this.droneGain.gain.setTargetAtTime(0.1 * intensity, t, 0.1);
                break;
            case 'MAGNETIC_STORM':
                // Glitchy, random pitch jumps
                if (Math.random() < 0.1) {
                    this.droneOsc.frequency.setValueAtTime(50 + Math.random() * 500, t);
                }
                this.droneGain.gain.setTargetAtTime(0.08 * intensity, t, 0.1);
                break;
            case 'VOID_RIFT':
                // Silence mostly, spooky wind
                this.droneOsc.frequency.setTargetAtTime(80, t, 0.1);
                this.droneGain.gain.setTargetAtTime(0.02 * intensity, t, 0.1);
                break;
            case 'METEOR_SHOWER':
                // Sparkly (handled by visuals mostly, audio subtle high ping)
                this.droneOsc.frequency.setTargetAtTime(880, t, 0.1);
                this.droneGain.gain.setTargetAtTime(0.01 * intensity, t, 0.1);
                break;
        }
    }

    // Helper for VisualCore to read
    getVisualParams() {
        if (!this.currentEvent) return null;

        const t = this.ctx.currentTime;
        const progress = (t - this.currentEvent.startTime) / this.currentEvent.duration;
        const intensity = Math.sin(progress * Math.PI);

        return {
            type: this.currentEvent.type,
            intensity: intensity
        };
    }
}

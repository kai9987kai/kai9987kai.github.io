export default class FocusModule {
    constructor(audioChassis) {
        this.audio = audioChassis;
        this.state = 'IDLE'; // IDLE, FOCUS, BREAK
        this.timeLeft = 0;
        this.timerInterval = null;

        // Defaults (minutes)
        this.durations = {
            focus: 25,
            break: 5
        };

        // Snapshot of params before focus started
        this.preFocusParams = {};
    }

    startFocus() {
        if (this.state === 'FOCUS') return;

        // Save state
        this.preFocusParams = { ...this.audio.params };

        this.state = 'FOCUS';
        this.timeLeft = this.durations.focus * 60;

        // Apply Focus Mix
        // Reduce distractions: Traffic, Thunder, LoFi, Chimes, Aether
        // Enhance: Rain (White Noise), Binaural (Beta/Gamma for focus?) - Optional

        const updates = {
            traffic: 0,
            thunder: 0,
            lofi: 0,
            chimes: 0,
            harmony: 0, // Aether
            // Maybe boost rain/wind slightly if they were low?
            // rain: Math.max(this.audio.params.rain, 0.5) 
        };

        // Apply updates
        Object.keys(updates).forEach(k => this.audio.setParam(k, updates[k]));

        // Request UI sync via event? 
        // FocusModule isn't connected to UIHub directly. 
        // UIHub should listen to FocusModule or check state.
        // We'll dispatch a custom event on window?
        window.dispatchEvent(new CustomEvent('focus-start', { detail: updates }));

        this.startTimer();
    }

    startBreak() {
        if (this.state === 'BREAK') return;

        this.state = 'BREAK';
        this.timeLeft = this.durations.break * 60;

        // Restore params? Or set "Relax" params?
        // Let's restore.
        this.restoreParams();

        // Maybe ring a gong? (Not implemented)

        window.dispatchEvent(new CustomEvent('focus-break'));
        this.startTimer();
    }

    stop() {
        this.state = 'IDLE';
        this.timeLeft = 0;
        clearInterval(this.timerInterval);
        this.timerInterval = null;

        this.restoreParams();
        window.dispatchEvent(new CustomEvent('focus-stop'));
    }

    restoreParams() {
        // Restore the params we touched
        // But the user might have changed others during focus? 
        // Let's just restore the ones we modified.

        const keysToRestore = ['traffic', 'thunder', 'lofi', 'chimes', 'harmony'];
        const updates = {};
        keysToRestore.forEach(k => {
            if (this.preFocusParams[k] !== undefined) {
                this.audio.setParam(k, this.preFocusParams[k]);
                updates[k] = this.preFocusParams[k];
            }
        });

        // Dispatch event for UI to sync
        window.dispatchEvent(new CustomEvent('focus-restore', { detail: updates }));
    }

    startTimer() {
        if (this.timerInterval) clearInterval(this.timerInterval);

        this.timerInterval = setInterval(() => {
            this.timeLeft--;

            // Notify tick
            window.dispatchEvent(new CustomEvent('focus-tick', {
                detail: {
                    time: this.timeLeft,
                    state: this.state
                }
            }));

            if (this.timeLeft <= 0) {
                if (this.state === 'FOCUS') {
                    this.startBreak();
                } else if (this.state === 'BREAK') {
                    // Cycle done? Or loop?
                    // Let's stop for now.
                    this.stop();
                    // Or auto-start focus?
                }
            }
        }, 1000);
    }

    // Format helper
    static formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
}

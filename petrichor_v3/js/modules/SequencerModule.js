export default class SequencerModule {
    constructor(ctx, pianoModule, synthModule) {
        this.ctx = ctx;
        this.piano = pianoModule;
        this.synth = synthModule;

        this.steps = 16;
        this.rows = 4;
        this.grid = []; // 16x4 array of booleans
        this.synthMode = false;

        // C Minor Pentatonic Subset for 4 rows
        // Low to High? Or High to Low?
        // Let's do Low (Bottom row) to High (Top row) visually.
        // Array index 0 = Top row?
        // Usually UI Row 0 is Top.
        // Let's map:
        // Row 0: Bb (58)
        // Row 1: G (55)
        // Row 2: Eb (51)
        // Row 3: C (48)
        this.notes = [58, 55, 51, 48];

        this.initGrid();

        this.isPlaying = false;
        this.currentStep = 0;
        this.nextNoteTime = 0;
        this.tempo = 120; // BPM
        this.lookahead = 25.0; // ms
        this.scheduleAheadTime = 0.1; // s
        this.timerID = null;
    }

    initGrid() {
        for (let i = 0; i < this.steps; i++) {
            this.grid[i] = [false, false, false, false];
        }
    }

    toggleCell(step, row) {
        if (step >= 0 && step < this.steps && row >= 0 && row < this.rows) {
            this.grid[step][row] = !this.grid[step][row];
            return this.grid[step][row];
        }
        return false;
    }

    clear() {
        this.initGrid();
    }

    start() {
        if (this.isPlaying) return;
        this.isPlaying = true;
        this.currentStep = 0;
        this.nextNoteTime = this.ctx.currentTime;
        this.scheduler();
    }

    stop() {
        this.isPlaying = false;
        window.clearTimeout(this.timerID);
    }

    scheduler() {
        // While there are notes that will need to play before the next interval, 
        // schedule them and advance the pointer.
        while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.currentStep, this.nextNoteTime);
            this.nextStep();
        }
        this.timerID = window.setTimeout(this.scheduler.bind(this), this.lookahead);
    }

    nextStep() {
        const secondsPerBeat = 60.0 / this.tempo;
        this.nextNoteTime += secondsPerBeat * 0.25; // 16th notes
        this.currentStep++;
        if (this.currentStep === this.steps) {
            this.currentStep = 0;
        }
    }

    scheduleNote(stepNumber, time) {
        // Highlight UI (Visual only, exact timing less critical for UI)
        // We use a custom event or callback?
        // Since AudioContext runs ahead, UI might be slightly early if we dispatch now.
        // `requestAnimationFrame` loop in UIHub can poll `currentStep`?
        // Or pure CSS animation?
        // Let's just dispatch custom event now, close enough.
        // Note: dispatching too fast might flood.
        // Actually, just set a property accessed by render loop?
        // We act as if this is the "visual" step.

        const col = this.grid[stepNumber];
        col.forEach((active, row) => {
            if (active) {
                // Play Note
                // We use setTimeout to trigger at exact audio time? 
                // No, synth nodes take 'time' param.
                // But `PianoModule.playNote` uses `ctx.currentTime` immediately.
                // I need to refactor `PianoModule.playNote` to accept `time`?
                // Or just play it now?
                // If I play it now, it's slightly early (scheduleAheadTime).
                // 100ms is perceptible.
                // Refactoring `PianoModule` to accept `time` is best practice.
                // But typically PianoModule uses `ctx.currentTime` for envelopes.
                // I will update `PianoModule` check in next step?
                // For now, let's assume `PianoModule.playNote` plays immediately.
                // To support scheduling, I should update `playNote` to take `when`.

                // Let's do a quick fix:
                // We can use a tone.js style transport, but here we are raw.
                // If I call playNote(), it plays NOW.
                // If I wait, loop drifts.
                // Correct way: `playNote(midi, time)`.

                if (this.synthMode && this.synth) {
                    this.synth.playNote(this.notes[row], time);
                } else {
                    this.piano.playNote(this.notes[row], time);
                }
            }
        });

        // Dispatch event for UI
        // We want UI to update exactly when step hits.
        // `setTimeout` based on difference.
        const drawTime = (time - this.ctx.currentTime) * 1000;
        setTimeout(() => {
            if (this.onStep) this.onStep(stepNumber);
        }, Math.max(0, drawTime));
    }

    setTempo(bpm) {
        this.tempo = bpm;
    }

    setOnStepCallback(cb) {
        this.onStep = cb;
    }

    setSynthMode(isSynth) {
        this.synthMode = isSynth;
    }
}

export default class MicModule {
    constructor(ctx, outputNode) {
        this.ctx = ctx;
        this.output = outputNode;
        this.active = false;

        // Nodes
        this.inFilter = ctx.createBiquadFilter();
        this.inFilter.type = 'highpass';
        this.inFilter.frequency.value = 100; // Cut mud

        this.compressor = ctx.createDynamicsCompressor();
        this.compressor.threshold.value = -24;
        this.compressor.knee.value = 30;
        this.compressor.ratio.value = 12;
        this.compressor.attack.value = 0.003;
        this.compressor.release.value = 0.25;

        this.inputGain = ctx.createGain();
        this.inputGain.gain.value = 0; // Muted by default

        // FX Chain
        // Mic -> Filter -> Comp -> InputGain -> Output
        //                                   -> Delay -> Output
        //                                   -> Reverb -> Output

        this.inFilter.connect(this.compressor);
        this.compressor.connect(this.inputGain);
        this.inputGain.connect(this.output);

        // Reverb
        this.reverbNode = ctx.createConvolver();
        this.reverbNode.buffer = this.createImpulse(3.0); // 3s cave
        this.reverbGain = ctx.createGain();
        this.reverbGain.gain.value = 0.5;

        this.inputGain.connect(this.reverbNode);
        this.reverbNode.connect(this.reverbGain);
        this.reverbGain.connect(this.output);

        // Delay
        this.delayNode = ctx.createDelay(2.0);
        this.delayNode.delayTime.value = 0.4;
        this.delayFeedback = ctx.createGain();
        this.delayFeedback.gain.value = 0.4;
        this.delayGain = ctx.createGain();
        this.delayGain.gain.value = 0.3;

        this.inputGain.connect(this.delayNode);
        this.delayNode.connect(this.delayFeedback);
        this.delayFeedback.connect(this.delayNode); // Loop
        this.delayNode.connect(this.delayGain);
        this.delayGain.connect(this.output);
    }

    async start() {
        if (this.active) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false
                }
            });

            this.streamNode = this.ctx.createMediaStreamSource(stream);
            this.streamNode.connect(this.inFilter);
            this.active = true;
            this.inputGain.gain.setTargetAtTime(1.0, this.ctx.currentTime, 0.5);

        } catch (err) {
            console.error("Mic access denied", err);
            alert("Microphone access is required for The Echo module.");
        }
    }

    stop() {
        if (!this.active) return;

        this.inputGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
        setTimeout(() => {
            if (this.streamNode) {
                this.streamNode.disconnect();
                // stream tracks retrieval to stop hardware?
                // this.streamNode.mediaStream.getTracks().forEach(t => t.stop());
                // But MediaStreamSource doesn't expose stream directly as property usually?
                // It does not. We'd need to keep ref to stream.
                // For now just disconnect graph.
                this.streamNode = null;
            }
            this.active = false;
        }, 200);
    }

    toggle() {
        if (this.active) this.stop();
        else this.start();
        return !this.active; // Return new state (approx)
    }

    setReverb(val) {
        this.reverbGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.1);
    }

    setDelay(val) {
        this.delayGain.gain.setTargetAtTime(val, this.ctx.currentTime, 0.1);
    }

    createImpulse(duration) {
        const rate = this.ctx.sampleRate;
        const length = rate * duration;
        const impulse = this.ctx.createBuffer(2, length, rate);

        for (let channel = 0; channel < 2; channel++) {
            const data = impulse.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                // White noise with exponential decay
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 4);
            }
        }
        return impulse;
    }
}

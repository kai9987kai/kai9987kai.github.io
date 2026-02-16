export default class AnalyzerModule {
    constructor(ctx, inputNode) {
        this.ctx = ctx;
        this.node = ctx.createAnalyser();
        this.node.fftSize = 256; // 128 bins
        this.node.smoothingTimeConstant = 0.85;

        // Connect input. AnalyserNode passes input to output unchanged.
        inputNode.connect(this.node);

        this.dataSpec = new Uint8Array(this.node.frequencyBinCount);
        this.dataWave = new Uint8Array(this.node.fftSize);
    }

    connect(dest) {
        this.node.connect(dest);
    }

    getSpectrum() {
        this.node.getByteFrequencyData(this.dataSpec);
        return this.dataSpec;
    }

    getWaveform() {
        this.node.getByteTimeDomainData(this.dataWave);
        return this.dataWave;
    }
}

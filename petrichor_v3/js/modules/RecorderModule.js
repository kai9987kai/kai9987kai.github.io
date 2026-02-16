export default class RecorderModule {
    constructor(ctx, sourceNode) {
        this.ctx = ctx;
        this.source = sourceNode;
        this.recorder = null;
        this.chunks = [];
        this.isRecording = false;

        this.dest = ctx.createMediaStreamDestination();
        this.source.connect(this.dest);
    }

    start() {
        if (this.isRecording) return;

        try {
            this.chunks = [];
            const options = { mimeType: 'audio/webm' };

            // Check support
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                console.warn(`${options.mimeType} not supported, trying default.`);
                delete options.mimeType;
            }

            this.recorder = new MediaRecorder(this.dest.stream, options);

            this.recorder.ondataavailable = (e) => {
                if (e.data.size > 0) this.chunks.push(e.data);
            };

            this.recorder.onstop = () => {
                this.save();
            };

            this.recorder.start();
            this.isRecording = true;
            console.log("Recording started...");

            return true;
        } catch (e) {
            console.error("Recorder Error:", e);
            return false;
        }
    }

    stop() {
        if (!this.isRecording || !this.recorder) return;
        console.log("Recording stopped...");
        this.recorder.stop();
        this.isRecording = false;
    }

    save() {
        const blob = new Blob(this.chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);

        // Auto Download
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        a.download = `petrichor-session-${timestamp}.webm`;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 100);
    }
}

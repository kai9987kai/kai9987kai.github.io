export default class MonitorViz {
    constructor(specCanvas, scopeCanvas) {
        this.specCtx = specCanvas.getContext('2d');
        this.scopeCtx = scopeCanvas.getContext('2d');

        this.specCanvas = specCanvas;
        this.scopeCanvas = scopeCanvas;

        this.adjustSize();
        // window.addEventListener('resize', () => this.adjustSize());
        // Parent container might not resize often, but canvas resolution matters.
        // For now assume fixed size via CSS/layout, but we need to set internal width/height.
    }

    adjustSize() {
        // Match internal resolution to display size for sharpness
        const resize = (c) => {
            const rect = c.getBoundingClientRect();
            c.width = rect.width;
            c.height = rect.height;
        };
        resize(this.specCanvas);
        resize(this.scopeCanvas);
    }

    render(analyzer) {
        if (!analyzer) return;

        const spec = analyzer.getSpectrum();
        const wave = analyzer.getWaveform();

        this.drawSpectrum(spec);
        this.drawScope(wave);
    }

    drawSpectrum(data) {
        const ctx = this.specCtx;
        const w = this.specCanvas.width;
        const h = this.specCanvas.height;

        ctx.clearRect(0, 0, w, h);

        const barW = (w / data.length) * 2.5;
        let x = 0;

        for (let i = 0; i < data.length; i++) {
            const v = data[i]; // 0-255
            const barH = (v / 255) * h;

            // Gradient color based on frequency
            // Low (Red) -> High (Blue)
            const hue = (i / data.length) * 240 + 180; // Cyan to Purple
            ctx.fillStyle = `hsl(${hue}, 80%, 60%)`;

            ctx.fillRect(x, h - barH, barW, barH);
            x += barW + 1;
        }
    }

    drawScope(data) {
        const ctx = this.scopeCtx;
        const w = this.scopeCanvas.width;
        const h = this.scopeCanvas.height;

        ctx.clearRect(0, 0, w, h);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#00ffaa'; // Radar Green
        ctx.shadowBlur = 4;
        ctx.shadowColor = '#00ffaa';

        ctx.beginPath();
        const sliceWidth = w / data.length;
        let x = 0;

        for (let i = 0; i < data.length; i++) {
            const v = data[i] / 128.0; // 0-2 maps to height
            const y = (v * h) / 2;

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);

            x += sliceWidth;
        }

        ctx.lineTo(w, h / 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
    }
}

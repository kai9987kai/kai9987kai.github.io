export default class KaleidoscopeViz {
    constructor(canvas, analyser) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.analyser = analyser;

        this.active = false;
        this.symmetry = 6;
        this.rotation = 0;
        this.hue = 0;

        this.dataArray = new Uint8Array(256); // Will be set in draw if analyser present
    }

    resize() {
        this.canvas.width = this.canvas.parentElement.clientWidth;
        this.canvas.height = this.canvas.parentElement.clientHeight;
    }

    update(params) {
        if (params.kaleidoscope !== undefined) this.active = params.kaleidoscope;
        if (params.symmetry !== undefined) this.symmetry = params.symmetry;
    }

    draw() {
        if (!this.active || !this.analyser) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            return;
        }

        const w = this.canvas.width;
        const h = this.canvas.height;
        const cx = w / 2;
        const cy = h / 2;
        const maxRadius = Math.min(w, h) / 2;

        // Get Audio Data
        this.analyser.getByteFrequencyData(this.dataArray);

        // Fade out slightly for trails
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        this.ctx.fillRect(0, 0, w, h);

        this.ctx.save();
        this.ctx.translate(cx, cy);
        this.ctx.rotate(this.rotation);

        // Rotate slowly
        this.rotation += 0.002;
        this.hue += 0.5;

        // Symmetry Loop
        const angleStep = (Math.PI * 2) / this.symmetry;

        for (let i = 0; i < this.symmetry; i++) {
            this.ctx.save();
            this.ctx.rotate(i * angleStep);

            // Draw Pattern Slice
            // We map frequency bins to radius
            // Low freqs = Center, High freqs = Edge

            this.ctx.beginPath();

            // Mirror logic? 
            // Let's just draw a line that wiggles based on audio
            // Or a shape.

            // Shape 1: Central Star
            const bass = this.dataArray[10] / 255.0;
            this.ctx.strokeStyle = `hsl(${this.hue}, 80%, 60%)`;
            this.ctx.lineWidth = 2 + bass * 5;
            this.ctx.moveTo(0, 0);
            this.ctx.lineTo(10 + bass * 100, 0);
            this.ctx.stroke();

            // Shape 2: Orbital Rings
            // Iterate through a few bands
            for (let j = 0; j < 20; j++) {
                const val = this.dataArray[j * 5] / 255.0;
                if (val > 0.1) {
                    const r = (j / 20) * maxRadius * 0.8 + 20;
                    const size = val * 10;

                    this.ctx.fillStyle = `hsl(${this.hue + j * 10}, 70%, 50%)`;
                    this.ctx.beginPath();
                    this.ctx.arc(r, 0, size, 0, Math.PI * 2);
                    this.ctx.fill();

                    // Connected lines
                    if (j > 0) {
                        // complex visual clutter, maybe keep simple circles for now
                    }
                }
            }

            this.ctx.restore();
        }

        this.ctx.restore();
    }
}

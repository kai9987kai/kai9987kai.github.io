export default class LensFX {
    constructor(container) {
        this.container = container;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');

        this.canvas.style.position = 'fixed';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.pointerEvents = 'none';
        this.canvas.style.zIndex = '2000'; // Overlay everything
        this.canvas.style.mixBlendMode = 'overlay';

        // CSS Filters Wrapper
        this.fxWrapper = document.getElementById('viz-container'); // Assuming viz is here
        // If not, we might need to apply classes to body or a wrapper.
        // Let's use body for global filters.
        this.target = document.body;

        this.container.appendChild(this.canvas);

        this.params = {
            vhs: false,
            cinema: false,
            dream: false
        };

        this.noiseData = null;
        this.frame = 0;

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.createNoise();
    }

    createNoise() {
        // Pre-render noise to offscreen or just simple random per frame?
        // Per-frame random is fine for modern GPUs if resolution is low.
        // Let's optimize: scale canvas down? 
        // No, let's keep it simple.

        // Just create a small noise pattern to tile?
        // Let's create a 256x256 noise buffer.
        const s = 256;
        const buf = document.createElement('canvas');
        buf.width = s;
        buf.height = s;
        const bctx = buf.getContext('2d');
        const img = bctx.createImageData(s, s);
        for (let i = 0; i < img.data.length; i += 4) {
            const v = Math.random() * 255;
            img.data[i] = v;
            img.data[i + 1] = v;
            img.data[i + 2] = v;
            img.data[i + 3] = 40; // Alpha
        }
        bctx.putImageData(img, 0, 0);
        this.noisePat = this.ctx.createPattern(buf, 'repeat');
    }

    update(params) {
        // Update state
        if (params.vhs !== undefined) this.params.vhs = params.vhs;
        if (params.cinema !== undefined) this.params.cinema = params.cinema;
        if (params.dream !== undefined) this.params.dream = params.dream;

        this.frame++;
        this.render();
        this.updateCSS();
    }

    updateCSS() {
        // Toggle classes on body
        this.target.classList.toggle('fx-vhs', this.params.vhs);
        this.target.classList.toggle('fx-cinema', this.params.cinema);
        this.target.classList.toggle('fx-dream', this.params.dream);
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Cinema Grain
        if (this.params.cinema) {
            this.ctx.globalCompositeOperation = 'overlay';
            this.ctx.fillStyle = this.noisePat;
            // Jitter position
            const ox = Math.random() * 100;
            const oy = Math.random() * 100;
            this.ctx.save();
            this.ctx.translate(ox, oy);
            this.ctx.fillRect(-ox, -oy, this.canvas.width + ox, this.canvas.height + oy);
            this.ctx.restore();

            // Letterbox
            this.ctx.globalCompositeOperation = 'source-over';
            this.ctx.fillStyle = '#000';
            const barH = this.canvas.height * 0.1;
            this.ctx.fillRect(0, 0, this.canvas.width, barH);
            this.ctx.fillRect(0, this.canvas.height - barH, this.canvas.width, barH);
        }

        // VHS Scanlines
        if (this.params.vhs) {
            this.ctx.globalCompositeOperation = 'overlay';
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            // Draw lines every 4px
            for (let y = 0; y < this.canvas.height; y += 4) {
                this.ctx.fillRect(0, y, this.canvas.width, 1);
            }

            // Tracking Bar (Looping vertical bar of distortion/noise)
            // Visualized as a white band?
            const trackY = (this.frame * 2) % (this.canvas.height + 100) - 50;
            if (trackY < this.canvas.height) {
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                this.ctx.fillRect(0, trackY, this.canvas.width, 20);
            }
        }
    }
}

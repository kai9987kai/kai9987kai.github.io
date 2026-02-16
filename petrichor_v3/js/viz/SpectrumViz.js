export default class SpectrumViz {
    constructor(canvas, analyser) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.analyser = analyser;
        this.dataArray = new Uint8Array(analyser.frequencyBinCount);

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    draw() {
        const w = this.canvas.width;
        const h = this.canvas.height;

        // Clear
        this.ctx.clearRect(0, 0, w, h);

        // Get Data
        this.analyser.getByteFrequencyData(this.dataArray);

        const barWidth = w / this.dataArray.length;

        this.ctx.fillStyle = '#64ffda';

        for (let i = 0; i < this.dataArray.length; i++) {
            const v = this.dataArray[i] / 255;
            const y = v * h;

            this.ctx.fillStyle = `rgba(100, 255, 218, ${v})`;
            this.ctx.fillRect(i * barWidth, h - y, barWidth - 1, y);
        }
    }
}

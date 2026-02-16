export default class PerformanceMonitor {
    constructor() {
        this.fps = 0;
        this.frames = 0;
        this.lastTime = performance.now();
        this.container = null;
        this.initUI();
    }

    initUI() {
        this.container = document.createElement('div');
        this.container.style.cssText = `
            position: fixed;
            bottom: 5px;
            left: 5px;
            background: rgba(0,0,0,0.7);
            color: #00ff00;
            font-family: monospace;
            font-size: 10px;
            padding: 4px;
            pointer-events: none;
            z-index: 10001;
        `;
        document.body.appendChild(this.container);
    }

    update() {
        this.frames++;
        const now = performance.now();
        if (now >= this.lastTime + 1000) {
            this.fps = this.frames;
            this.frames = 0;
            this.lastTime = now;
            this.render();
        }
    }

    render() {
        const mem = performance.memory ? (performance.memory.usedJSHeapSize / 1048576).toFixed(1) : 'N/A';

        let audioStatus = 'UNKNOWN';
        if (window.audio && window.audio.context) {
            audioStatus = window.audio.context.state.toUpperCase();
        } else if (document.querySelector('.action-btn.active')) {
            audioStatus = 'RUNNING'; // Fallback check for button state
        } else {
            audioStatus = 'WAITING';
        }

        this.container.textContent = `FPS: ${this.fps} | MEM: ${mem}MB | AUDIO: ${audioStatus}`;

        // Color coding
        if (this.fps < 30) this.container.style.color = 'red';
        else if (audioStatus === 'SUSPENDED' || audioStatus === 'WAITING') this.container.style.color = 'orange';
        else this.container.style.color = '#00ff00';
    }
}

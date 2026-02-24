// main.js
// The orchestrator for Neon Bio-OS

const timeIndicator = document.getElementById('time-indicator');

// Real-time clock
function updateClock() {
    const now = new Date();
    const h = String(now.getHours()).padStart(2, '0');
    const m = String(now.getMinutes()).padStart(2, '0');
    timeIndicator.innerText = `${h}:${m}`;
}
setInterval(updateClock, 1000);
updateClock();

function sizeCanvasToClient(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.width = el.clientWidth;
    el.height = el.clientHeight;
}

function sizeUiCanvases() {
    sizeCanvasToClient('pop-graph');
    sizeCanvasToClient('neural-graph');
}

// Wait for scripts to load, set initial states
window.onload = () => {
    sizeUiCanvases();
};

window.addEventListener('resize', sizeUiCanvases);

// Lightweight keyboard controls for experimentation (ignored while typing).
document.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName?.toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;

    const eco = window.ecoControls || {};
    if (e.code === 'Space') {
        e.preventDefault();
        if (typeof eco.togglePause === 'function') eco.togglePause();
    }
    if (e.key === '[') {
        e.preventDefault();
        const next = Math.max(0.1, ((window.ecoState?.timeScale || 1) - 0.1));
        eco.setTimeScale?.(Number(next.toFixed(1)));
    }
    if (e.key === ']') {
        e.preventDefault();
        const next = Math.min(3, ((window.ecoState?.timeScale || 1) + 0.1));
        eco.setTimeScale?.(Number(next.toFixed(1)));
    }
});

// Main loop tying WebGL and 2D ecosystem together
function animate() {

    // 1. Ecosystem engine runs (updates boids, handles collisions)
    if (typeof loopEco === "function") {
        loopEco();
    }

    // 2. WebGL backend updates (reacts to ecosystem energy)
    if (typeof renderWebGL === "function") {
        renderWebGL();
    }

    // 3. Update Widgets (feed ecosystem stats to the system monitor)
    if (typeof updateMonitor === "function" && window.ecoState) {
        // Debounce slightly to save performance on UI redrawing
        if (Math.random() > 0.8) {
            updateMonitor(window.ecoState);
        }
    }

    requestAnimationFrame(animate);
}

// Start simulation
animate();

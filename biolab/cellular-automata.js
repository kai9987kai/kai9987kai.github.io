(() => {
    const canvas = document.getElementById('ca-canvas');
    const ctx = canvas?.getContext('2d');
    const ruleSelect = document.getElementById('ca-rules');
    const speedInput = document.getElementById('ca-speed');
    const sizeInput = document.getElementById('ca-grid-size');
    const startBtn = document.getElementById('ca-start');
    const pauseBtn = document.getElementById('ca-pause');
    const clearBtn = document.getElementById('ca-clear');
    const randomBtn = document.getElementById('ca-random');

    const genEl = document.getElementById('ca-generation');
    const popEl = document.getElementById('ca-population');
    const densityEl = document.getElementById('ca-density');
    const patternEl = document.getElementById('ca-pattern');

    let gridSize = Number(sizeInput?.value) || 100;
    let cells = new Uint8Array(gridSize * gridSize);
    let buffer = new Uint8Array(gridSize * gridSize);
    let running = false;
    let generation = 0;
    let lastTimestamp = 0;

    const colors = {
        conway: '#6bf9e2',
        'cell-division': '#8b8bff',
        cancer: '#ff9aa2',
        bacteria: '#a0e46b'
    };

    function index(x, y) {
        return y * gridSize + x;
    }

    function neighborsCount(x, y) {
        let count = 0;
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nx = (x + dx + gridSize) % gridSize;
                const ny = (y + dy + gridSize) % gridSize;
                count += cells[index(nx, ny)];
            }
        }
        return count;
    }

    function step() {
        const rule = ruleSelect.value;
        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                const idx = index(x, y);
                const alive = cells[idx];
                const n = neighborsCount(x, y);
                let next = alive;

                switch (rule) {
                    case 'conway':
                        next = n === 3 || (alive && (n === 2 || n === 3)) ? 1 : 0;
                        break;
                    case 'cell-division':
                        next = n >= 3 && n <= 5 ? 1 : alive && n >= 2 && n <= 4 ? 1 : 0;
                        break;
                    case 'cancer':
                        next = n >= 2 ? 1 : alive && n >= 1 ? 1 : 0;
                        if (!next && Math.random() < 0.02) next = 1;
                        break;
                    case 'bacteria':
                        next = n === 3 || (alive && n <= 4) ? 1 : 0;
                        if (alive && n === 0) next = 0;
                        break;
                }
                buffer[idx] = next;
            }
        }
        [cells, buffer] = [buffer, cells];
        generation += 1;
        updateStats();
        draw();
    }

    function draw() {
        if (!ctx || !canvas) return;
        const w = canvas.width;
        const h = canvas.height;
        const cellSizeX = w / gridSize;
        const cellSizeY = h / gridSize;

        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = colors[ruleSelect.value] || '#6bf9e2';
        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                if (cells[index(x, y)]) {
                    ctx.fillRect(x * cellSizeX, y * cellSizeY, cellSizeX, cellSizeY);
                }
            }
        }
    }

    function updateStats() {
        const live = cells.reduce((sum, val) => sum + val, 0);
        const density = ((live / cells.length) * 100).toFixed(1);
        genEl.textContent = generation;
        popEl.textContent = live;
        densityEl.textContent = `${density}%`;
        patternEl.textContent = live === 0 ? 'Extinct' : live > cells.length * 0.4 ? 'Growing' : 'Stable';
    }

    function randomize() {
        for (let i = 0; i < cells.length; i++) {
            cells[i] = Math.random() > 0.82 ? 1 : 0;
        }
        generation = 0;
        updateStats();
        draw();
    }

    function clearGrid() {
        cells.fill(0);
        generation = 0;
        updateStats();
        draw();
    }

    function resizeGrid() {
        gridSize = Math.max(20, Math.min(220, Number(sizeInput.value) || 100));
        cells = new Uint8Array(gridSize * gridSize);
        buffer = new Uint8Array(gridSize * gridSize);
        generation = 0;
        draw();
        bioLab.updateSection('ca', { gridSize });
    }

    function loop(timestamp) {
        const fps = Number(speedInput.value) || 10;
        const frameDuration = 1000 / fps;
        if (running && timestamp - lastTimestamp > frameDuration) {
            step();
            lastTimestamp = timestamp;
        }
        requestAnimationFrame(loop);
    }

    function toggleRunning(state) {
        running = state;
    }

    function hydrate() {
        const state = bioLab.state.ca || {};
        if (state.gridSize) {
            sizeInput.value = state.gridSize;
            gridSize = state.gridSize;
            cells = new Uint8Array(gridSize * gridSize);
            buffer = new Uint8Array(gridSize * gridSize);
        }
        if (state.speed) speedInput.value = state.speed;
        if (state.rule) ruleSelect.value = state.rule;
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (!canvas || !ctx) return;
        hydrate();
        randomize();
        loop(0);

        startBtn?.addEventListener('click', () => toggleRunning(true));
        pauseBtn?.addEventListener('click', () => toggleRunning(false));
        clearBtn?.addEventListener('click', clearGrid);
        randomBtn?.addEventListener('click', randomize);
        sizeInput?.addEventListener('change', resizeGrid);
        ruleSelect?.addEventListener('change', () => bioLab.updateSection('ca', { rule: ruleSelect.value }));
        speedInput?.addEventListener('change', () => bioLab.updateSection('ca', { speed: Number(speedInput.value) }));

        canvas?.addEventListener('click', event => {
            const rect = canvas.getBoundingClientRect();
            const x = Math.floor(((event.clientX - rect.left) / rect.width) * gridSize);
            const y = Math.floor(((event.clientY - rect.top) / rect.height) * gridSize);
            const idx = index(x, y);
            cells[idx] = cells[idx] ? 0 : 1;
            draw();
        });
    });

    bioLab.registerExporter('cellularAutomata', () => ({
        rule: ruleSelect?.value,
        gridSize,
        generation,
        population: cells.reduce((sum, val) => sum + val, 0)
    }));
})();

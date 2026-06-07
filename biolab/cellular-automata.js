(() => {
    const canvas = document.getElementById('ca-canvas');
    const ctx = canvas?.getContext('2d');
    const ruleSelect = document.getElementById('ca-rules');
    const speedInput = document.getElementById('ca-speed');
    const sizeInput = document.getElementById('ca-grid-size');
    const seedInput = document.getElementById('ca-seed');
    const startBtn = document.getElementById('ca-start');
    const pauseBtn = document.getElementById('ca-pause');
    const stepBtn = document.getElementById('ca-step');
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
    let previousLive = 0;
    let random = BioUtils.createRng(2026);

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
                const cellIndex = index(x, y);
                const alive = cells[cellIndex];
                const neighbors = neighborsCount(x, y);
                let next = alive;

                switch (rule) {
                    case 'conway':
                        next =
                            neighbors === 3 || (alive && (neighbors === 2 || neighbors === 3))
                                ? 1
                                : 0;
                        break;
                    case 'cell-division':
                        next =
                            neighbors >= 3 && neighbors <= 5
                                ? 1
                                : alive && neighbors >= 2 && neighbors <= 4
                                  ? 1
                                  : 0;
                        break;
                    case 'cancer':
                        next = neighbors >= 2 || (alive && neighbors >= 1) ? 1 : 0;
                        if (!next && random() < 0.02) next = 1;
                        break;
                    case 'bacteria':
                        next = neighbors === 3 || (alive && neighbors > 0 && neighbors <= 4) ? 1 : 0;
                        break;
                }
                buffer[cellIndex] = next;
            }
        }

        [cells, buffer] = [buffer, cells];
        generation += 1;
        updateStats();
        draw();
        persistState();
    }

    function draw() {
        if (!ctx || !canvas) return;
        const width = canvas.width;
        const height = canvas.height;
        const cellWidth = width / gridSize;
        const cellHeight = height / gridSize;
        ctx.fillStyle = 'rgba(7,10,22,0.96)';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = colors[ruleSelect.value] || '#6bf9e2';

        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                if (cells[index(x, y)]) {
                    ctx.fillRect(x * cellWidth, y * cellHeight, cellWidth + 0.25, cellHeight + 0.25);
                }
            }
        }
    }

    function updateStats() {
        const live = cells.reduce((sum, value) => sum + value, 0);
        const density = (live / cells.length) * 100;
        const delta = live - previousLive;
        let pattern = 'Stable';
        if (live === 0) pattern = 'Extinct';
        else if (Math.abs(delta) <= Math.max(2, live * 0.01)) pattern = 'Stable';
        else if (delta > 0) pattern = 'Growing';
        else pattern = 'Declining';

        genEl.textContent = generation;
        popEl.textContent = live;
        densityEl.textContent = `${density.toFixed(1)}%`;
        patternEl.textContent = pattern;
        previousLive = live;
    }

    function resetRng() {
        const seed = Math.max(1, Number(seedInput.value) || 2026);
        seedInput.value = seed;
        random = BioUtils.createRng(seed);
    }

    function randomize() {
        running = false;
        resetRng();
        for (let i = 0; i < cells.length; i++) cells[i] = random() > 0.82 ? 1 : 0;
        generation = 0;
        previousLive = 0;
        updateStats();
        draw();
        persistState();
    }

    function clearGrid() {
        running = false;
        cells.fill(0);
        generation = 0;
        previousLive = 0;
        updateStats();
        draw();
        persistState();
    }

    function resizeGrid() {
        running = false;
        gridSize = Math.max(20, Math.min(220, Number(sizeInput.value) || 100));
        sizeInput.value = gridSize;
        cells = new Uint8Array(gridSize * gridSize);
        buffer = new Uint8Array(gridSize * gridSize);
        randomize();
    }

    function loop(timestamp) {
        const fps = Number(speedInput.value) || 10;
        const frameDuration = 1000 / fps;
        if (running && timestamp - lastTimestamp >= frameDuration) {
            step();
            lastTimestamp = timestamp;
        }
        requestAnimationFrame(loop);
    }

    function persistState() {
        bioLab.updateSection('ca', {
            rule: ruleSelect.value,
            gridSize,
            speed: Number(speedInput.value),
            seed: Number(seedInput.value),
            generation
        });
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
        if (state.seed) seedInput.value = state.seed;
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (!canvas || !ctx) return;
        hydrate();
        randomize();
        loop(0);

        startBtn?.addEventListener('click', () => (running = true));
        pauseBtn?.addEventListener('click', () => (running = false));
        stepBtn?.addEventListener('click', () => {
            running = false;
            step();
        });
        clearBtn?.addEventListener('click', clearGrid);
        randomBtn?.addEventListener('click', randomize);
        sizeInput?.addEventListener('change', resizeGrid);
        seedInput?.addEventListener('change', randomize);
        ruleSelect?.addEventListener('change', () => {
            persistState();
            draw();
        });
        speedInput?.addEventListener('change', persistState);

        canvas.addEventListener('click', event => {
            const rect = canvas.getBoundingClientRect();
            const x = Math.floor(((event.clientX - rect.left) / rect.width) * gridSize);
            const y = Math.floor(((event.clientY - rect.top) / rect.height) * gridSize);
            if (x < 0 || x >= gridSize || y < 0 || y >= gridSize) return;
            const cellIndex = index(x, y);
            cells[cellIndex] = cells[cellIndex] ? 0 : 1;
            updateStats();
            draw();
        });
    });

    bioLab.registerExporter('cellularAutomata', () => ({
        rule: ruleSelect?.value,
        gridSize,
        seed: Number(seedInput?.value || 0),
        generation,
        population: cells.reduce((sum, value) => sum + value, 0)
    }));
})();

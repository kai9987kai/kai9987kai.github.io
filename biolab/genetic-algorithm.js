(() => {
    const bases = ['A', 'T', 'C', 'G'];
    const targetInput = document.getElementById('ga-target');
    const popInput = document.getElementById('ga-population');
    const mutationInput = document.getElementById('ga-mutation');
    const lengthInput = document.getElementById('ga-length');
    const seedInput = document.getElementById('ga-seed');
    const startBtn = document.getElementById('ga-start');
    const pauseBtn = document.getElementById('ga-pause');
    const stepBtn = document.getElementById('ga-step');
    const resetBtn = document.getElementById('ga-reset');
    const canvas = document.getElementById('ga-canvas');

    const generationEl = document.getElementById('ga-generation');
    const bestFitnessEl = document.getElementById('ga-fitness');
    const avgFitnessEl = document.getElementById('ga-avg-fitness');
    const diversityEl = document.getElementById('ga-diversity');
    const bestSeqEl = document.getElementById('ga-best-sequence');
    const ctx = canvas?.getContext('2d');

    let population = [];
    let generation = 0;
    let running = false;
    let history = [];
    let random = BioUtils.createRng(2026);
    let raf;
    let lastStepAt = 0;

    function randomBase() {
        return bases[Math.floor(random() * bases.length)];
    }

    function randomSequence(length) {
        return Array.from({ length }, randomBase).join('');
    }

    function fitness(sequence, target) {
        let matches = 0;
        for (let i = 0; i < target.length; i++) {
            if (sequence[i] === target[i]) matches += 1;
        }
        return target.length ? matches / target.length : 0;
    }

    function mutate(sequence, rate) {
        const chance = rate / 100;
        return sequence
            .split('')
            .map(base => (random() < chance ? randomBase() : base))
            .join('');
    }

    function crossover(parentA, parentB) {
        const point = Math.floor(random() * parentA.length);
        return parentA.slice(0, point) + parentB.slice(point);
    }

    function calcDiversity(currentPopulation) {
        if (!currentPopulation.length) return 0;
        const sequenceLength = currentPopulation[0].sequence.length;
        let diversityScore = 0;

        for (let position = 0; position < sequenceLength; position++) {
            const counts = { A: 0, T: 0, C: 0, G: 0 };
            currentPopulation.forEach(individual => {
                counts[individual.sequence[position]] += 1;
            });
            const maximum = Math.max(...Object.values(counts));
            diversityScore += 1 - maximum / currentPopulation.length;
        }

        return (diversityScore / sequenceLength) * 100;
    }

    function normalizedTarget() {
        let target = BioUtils.sanitizeDna(targetInput.value);
        const requestedLength = Math.max(10, Math.min(200, Number(lengthInput.value) || 50));
        if (!target) {
            target = randomSequence(requestedLength);
            targetInput.value = target;
        }
        lengthInput.value = target.length;
        targetInput.value = target;
        return target;
    }

    function initPopulation() {
        pause();
        const size = Math.max(10, Math.min(1000, Number(popInput.value) || 100));
        const seed = Math.max(1, Number(seedInput.value) || 2026);
        random = BioUtils.createRng(seed);
        const target = normalizedTarget();
        popInput.value = size;
        seedInput.value = seed;

        population = Array.from({ length: size }, () => ({
            sequence: randomSequence(target.length),
            fitness: 0
        }));
        generation = 0;
        history = [];
        updateDisplays({ best: null, avg: 0, diversity: calcDiversity(population) });
        drawHistory();
        persistConfig();
    }

    function updateDisplays({ best, avg, diversity }) {
        generationEl.textContent = generation;
        bestFitnessEl.textContent = best ? `${(best.fitness * 100).toFixed(1)}%` : '0%';
        avgFitnessEl.textContent = `${(avg * 100).toFixed(1)}%`;
        diversityEl.textContent = `${diversity.toFixed(1)}%`;
        bestSeqEl.textContent = best ? best.sequence : 'Ready to evolve...';
    }

    function drawHistory() {
        if (!ctx || !canvas) return;
        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(0, 0, width, height);

        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= width; x += width / 10) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
        }
        for (let y = 0; y <= height; y += height / 10) {
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
        }
        ctx.stroke();

        if (!history.length) return;
        const stepWidth = width / Math.max(history.length - 1, 1);
        const drawLine = (key, color) => {
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            history.forEach((item, index) => {
                const x = index * stepWidth;
                const y = height - item[key] * height;
                if (index === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
        };

        drawLine('avg', 'rgba(139, 139, 255, 0.9)');
        drawLine('best', 'rgba(107, 249, 226, 0.95)');
    }

    function evaluatePopulation(target) {
        population = population
            .map(individual => ({
                ...individual,
                fitness: fitness(individual.sequence, target)
            }))
            .sort((a, b) => b.fitness - a.fitness);

        const best = population[0];
        const avg =
            population.reduce((total, individual) => total + individual.fitness, 0) /
            population.length;
        const diversity = calcDiversity(population);
        return { best, avg, diversity };
    }

    function evolveGeneration() {
        const target = normalizedTarget();
        const mutationRate = Math.max(0, Math.min(100, Number(mutationInput.value) || 0));
        const metrics = evaluatePopulation(target);
        history.push({ best: metrics.best.fitness, avg: metrics.avg });
        if (history.length > 200) history.shift();
        updateDisplays(metrics);
        drawHistory();

        if (metrics.best.fitness >= 1) {
            pause();
            persistConfig(metrics.best);
            return;
        }

        const survivorCount = Math.max(4, Math.floor(population.length * 0.2));
        const survivors = population.slice(0, survivorCount);
        const children = [];
        while (children.length + survivors.length < population.length) {
            const parentA = survivors[Math.floor(random() * survivors.length)];
            const parentB = survivors[Math.floor(random() * survivors.length)];
            children.push({
                sequence: mutate(crossover(parentA.sequence, parentB.sequence), mutationRate),
                fitness: 0
            });
        }

        population = survivors.concat(children);
        generation += 1;
        generationEl.textContent = generation;
        persistConfig(metrics.best);
    }

    function animationLoop(timestamp) {
        if (!running) return;
        if (timestamp - lastStepAt >= 50) {
            evolveGeneration();
            lastStepAt = timestamp;
        }
        if (running) raf = requestAnimationFrame(animationLoop);
    }

    function start() {
        if (running) return;
        running = true;
        lastStepAt = 0;
        raf = requestAnimationFrame(animationLoop);
    }

    function pause() {
        running = false;
        if (raf) cancelAnimationFrame(raf);
    }

    function stepOnce() {
        pause();
        evolveGeneration();
    }

    function persistConfig(best) {
        bioLab.updateSection('ga', {
            target: targetInput.value,
            populationSize: Number(popInput.value),
            mutation: Number(mutationInput.value),
            length: Number(lengthInput.value),
            seed: Number(seedInput.value),
            generation,
            bestSequence: best?.sequence || population[0]?.sequence || ''
        });
    }

    function hydrateFromState() {
        const state = bioLab.state.ga || {};
        if (state.target) targetInput.value = state.target;
        if (state.populationSize) popInput.value = state.populationSize;
        if (state.length) lengthInput.value = state.length;
        if (state.seed) seedInput.value = state.seed;
        if (typeof state.mutation === 'number') {
            mutationInput.value = state.mutation;
            document.getElementById('ga-mutation-val').textContent = `${state.mutation}%`;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (!canvas || !ctx) return;
        hydrateFromState();
        initPopulation();
        startBtn?.addEventListener('click', start);
        pauseBtn?.addEventListener('click', pause);
        stepBtn?.addEventListener('click', stepOnce);
        resetBtn?.addEventListener('click', initPopulation);

        [targetInput, popInput, lengthInput, seedInput].forEach(input => {
            input?.addEventListener('change', initPopulation);
        });
    });

    bioLab.registerExporter('geneticAlgorithm', () => ({
        generation,
        bestSequence: population[0]?.sequence || '',
        history,
        config: {
            target: targetInput?.value || '',
            populationSize: Number(popInput?.value || 0),
            mutationRate: Number(mutationInput?.value || 0),
            length: Number(lengthInput?.value || 0),
            seed: Number(seedInput?.value || 0)
        }
    }));
})();

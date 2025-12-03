(() => {
    const bases = ['A', 'T', 'C', 'G'];
    const targetInput = document.getElementById('ga-target');
    const popInput = document.getElementById('ga-population');
    const mutationInput = document.getElementById('ga-mutation');
    const lengthInput = document.getElementById('ga-length');
    const startBtn = document.getElementById('ga-start');
    const pauseBtn = document.getElementById('ga-pause');
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
    let raf;

    function randomBase() {
        return bases[Math.floor(Math.random() * bases.length)];
    }

    function randomSequence(length) {
        return Array.from({ length }, randomBase).join('');
    }

    function fitness(seq, target) {
        if (!target) return 0;
        let score = 0;
        for (let i = 0; i < target.length; i++) {
            if (seq[i] === target[i]) score += 1;
        }
        return score / target.length;
    }

    function mutate(seq, rate) {
        const chance = rate / 100;
        return seq
            .split('')
            .map(ch => (Math.random() < chance ? randomBase() : ch))
            .join('');
    }

    function crossover(a, b) {
        const point = Math.floor(Math.random() * a.length);
        return a.slice(0, point) + b.slice(point);
    }

    function calcDiversity(pop) {
        if (!pop.length) return 0;
        const length = pop[0].sequence.length;
        let diversityScore = 0;

        for (let i = 0; i < length; i++) {
            const bucket = { A: 0, T: 0, C: 0, G: 0 };
            pop.forEach(ind => (bucket[ind.sequence[i]] += 1));
            const values = Object.values(bucket).filter(Boolean);
            const positionalDiversity =
                values.length > 1
                    ? 1 - values.reduce((max, val) => Math.max(max, val), 0) / pop.length
                    : 0;
            diversityScore += positionalDiversity;
        }

        return (diversityScore / length) * 100;
    }

    function initPopulation() {
        const size = Number(popInput.value) || 100;
        const length = Number(lengthInput.value) || 50;
        population = Array.from({ length: size }, () => ({
            sequence: randomSequence(length),
            fitness: 0
        }));
        generation = 0;
        history = [];
        updateDisplays({ best: null, avg: 0, diversity: 0 });
        drawHistory();
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
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(0, 0, w, h);

        // grid
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= w; x += w / 10) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
        }
        for (let y = 0; y <= h; y += h / 10) {
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
        }
        ctx.stroke();

        if (!history.length) return;
        const maxPoints = Math.max(history.length, 2);
        const step = w / (maxPoints - 1);

        const drawLine = (key, color) => {
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            history.forEach((item, idx) => {
                const x = idx * step;
                const y = h - item[key] * h;
                if (idx === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
        };

        drawLine('avg', 'rgba(139, 139, 255, 0.9)');
        drawLine('best', 'rgba(107, 249, 226, 0.95)');
    }

    function evolveStep() {
        if (!running) return;
        const target = (targetInput.value || '').toUpperCase();
        const mutationRate = Number(mutationInput.value) || 5;

        population = population.map(ind => ({
            ...ind,
            fitness: fitness(ind.sequence, target)
        }));

        population.sort((a, b) => b.fitness - a.fitness);
        const best = population[0];
        const avg =
            population.reduce((total, ind) => total + ind.fitness, 0) / population.length;
        const diversity = calcDiversity(population);

        history.push({ best: best.fitness, avg });
        if (history.length > 200) history.shift();

        updateDisplays({ best, avg, diversity });
        drawHistory();

        const survivors = population.slice(0, Math.max(4, Math.floor(population.length * 0.2)));
        const children = [];
        while (children.length + survivors.length < population.length) {
            const [p1, p2] = [
                survivors[Math.floor(Math.random() * survivors.length)],
                survivors[Math.floor(Math.random() * survivors.length)]
            ];
            let childSeq = crossover(p1.sequence, p2.sequence);
            childSeq = mutate(childSeq, mutationRate);
            children.push({ sequence: childSeq, fitness: 0 });
        }

        population = survivors.concat(children);
        generation += 1;
        bioLab.updateSection('ga', {
            target,
            populationSize: population.length,
            mutation: mutationRate,
            length: target.length || Number(lengthInput.value),
            generation
        });

        raf = requestAnimationFrame(evolveStep);
    }

    function start() {
        if (running) return;
        running = true;
        raf = requestAnimationFrame(evolveStep);
    }

    function pause() {
        running = false;
        if (raf) cancelAnimationFrame(raf);
    }

    function reset() {
        pause();
        initPopulation();
    }

    function hydrateFromState() {
        const state = bioLab.state.ga || {};
        if (state.target && targetInput) targetInput.value = state.target;
        if (state.populationSize && popInput) popInput.value = state.populationSize;
        if (state.length && lengthInput) lengthInput.value = state.length;
        if (typeof state.mutation === 'number' && mutationInput) {
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
        resetBtn?.addEventListener('click', reset);

        [targetInput, popInput, lengthInput].forEach(input => {
            input?.addEventListener('change', () => {
                bioLab.updateSection('ga', {
                    target: targetInput.value.toUpperCase(),
                    populationSize: Number(popInput.value),
                    length: Number(lengthInput.value)
                });
                initPopulation();
            });
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
            length: Number(lengthInput?.value || 0)
        }
    }));
})();

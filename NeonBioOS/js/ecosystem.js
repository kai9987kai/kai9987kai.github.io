// ecosystem.js
// Phase 3: Adaptive Neuro-Evolutionary Biosphere
// Adds anomaly fields, simulation controls, and richer swarm telemetry.

const ecoCanvas = document.getElementById('ecocanvas');
const ctx = ecoCanvas.getContext('2d');

let width = 0;
let height = 0;

function resizeEco() {
    width = window.innerWidth;
    height = window.innerHeight;
    ecoCanvas.width = width;
    ecoCanvas.height = height;
}

window.addEventListener('resize', resizeEco);
resizeEco();

const agents = [];
const anomalies = [];
const maxPopulation = 240;

let globalActivation = 0;
let generation = 1;
let anomalyIdSeq = 0;
let autoStormCooldown = 120;
let lastLoopTime = performance.now();

const ecoConfig = {
    paused: false,
    timeScale: 1,
    autoStorms: true,
    fieldOverlay: true
};

// Export runtime state for widgets/terminal integration.
window.agents = agents;
window.energyPool = 1000;
window.ecoConfig = ecoConfig;
window.ecoAnomalies = anomalies;
window.ecoControls = window.ecoControls || {};

class Chromosome {
    constructor(parentGenes = null) {
        if (parentGenes) {
            this.speed = this.mutate(parentGenes.speed, 0.5, 1, 5);
            this.sensorRange = this.mutate(parentGenes.sensorRange, 20, 50, 300);
            this.synapseCapacity = Math.floor(this.mutate(parentGenes.synapseCapacity, 1, 1, 10));
            this.energyEfficiency = this.mutate(parentGenes.energyEfficiency, 0.02, 0.05, 0.3);
            const mutatedHue = parentGenes.hue + (Math.random() * 40 - 20);
            this.hue = Math.random() < 0.1 ? ((mutatedHue % 360) + 360) % 360 : parentGenes.hue;
        } else {
            this.speed = 2 + Math.random() * 2;
            this.sensorRange = 100 + Math.random() * 50;
            this.synapseCapacity = Math.floor(2 + Math.random() * 4);
            this.energyEfficiency = 0.1 + Math.random() * 0.1;
            this.hue = Math.random() > 0.5 ? 180 : 280;
        }
    }

    mutate(val, amount, min, max) {
        if (Math.random() < 0.2) {
            const next = val + (Math.random() * amount * 2 - amount);
            return Math.max(min, Math.min(max, next));
        }
        return val;
    }
}

class Agent {
    constructor(x, y, parentGenes = null) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 4;
        this.vy = (Math.random() - 0.5) * 4;

        this.genes = new Chromosome(parentGenes);
        this.size = Math.max(2, this.genes.synapseCapacity);
        this.energy = 100;
        this.age = 0;

        this.synapses = [];
        this.activation = 0;
    }

    update(obstacles, others, simScale, now) {
        if (simScale <= 0) {
            return;
        }

        this.age += simScale;

        // Wander drift
        this.vx += (Math.random() - 0.5) * 0.5 * simScale;
        this.vy += (Math.random() - 0.5) * 0.5 * simScale;

        // Window avoidance
        let avoidX = 0;
        let avoidY = 0;
        for (const rect of obstacles) {
            if (
                this.x > rect.left - 50 && this.x < rect.right + 50 &&
                this.y > rect.top - 50 && this.y < rect.bottom + 50
            ) {
                const cx = rect.left + rect.width / 2;
                const cy = rect.top + rect.height / 2;
                const force = this.genes.sensorRange / 100;
                avoidX += (this.x - cx) * 0.01 * force;
                avoidY += (this.y - cy) * 0.01 * force;
            }
        }

        // Swarm separation and synaptogenesis
        let sepX = 0;
        let sepY = 0;
        let neighbors = 0;

        this.activation *= Math.max(0.75, 1 - 0.08 * simScale);
        this.synapses = this.synapses.filter((s) => {
            const d2 = (this.x - s.target.x) ** 2 + (this.y - s.target.y) ** 2;
            return d2 < (this.genes.sensorRange * 1.5) ** 2;
        });

        for (const other of others) {
            if (other === this) continue;

            const dx = this.x - other.x;
            const dy = this.y - other.y;
            const d2 = dx * dx + dy * dy;

            if (d2 < 400 && d2 > 0) {
                sepX += dx / d2;
                sepY += dy / d2;
                neighbors++;
            }

            if (d2 < this.genes.sensorRange ** 2 && this.synapses.length < this.genes.synapseCapacity) {
                if (!this.synapses.find((s) => s.target === other)) {
                    this.synapses.push({
                        target: other,
                        weight: 0.2 + Math.random() * 0.8
                    });
                }
            }
        }

        if (neighbors > 0) {
            sepX /= neighbors;
            sepY /= neighbors;
        }

        // Environmental anomaly fields (Phase 3)
        const field = sampleAnomalyField(this, now);
        this.vx += (avoidX + sepX * 2 + field.fx) * simScale;
        this.vy += (avoidY + sepY * 2 + field.fy) * simScale;
        this.energy += field.energyDelta * simScale;
        if (field.activationBoost > 0) {
            this.activation = Math.min(1, this.activation + field.activationBoost);
        }

        // Neural firing and signal propagation
        const fireChance = 0.05 * Math.min(simScale, 2);
        if (Math.random() < fireChance && this.synapses.length > 0) {
            const fireStrength = 0.8 + Math.random() * 0.4;
            this.activation = Math.min(1.0, fireStrength);
            globalActivation += fireStrength;
            for (const s of this.synapses) {
                s.target.activation = Math.min(1.0, s.target.activation + s.weight * 0.45 * fireStrength);
            }
        }

        // Kinematics
        const speed = Math.hypot(this.vx, this.vy);
        if (speed > this.genes.speed) {
            this.vx = (this.vx / speed) * this.genes.speed;
            this.vy = (this.vy / speed) * this.genes.speed;
        }

        this.x += this.vx * simScale;
        this.y += this.vy * simScale;

        // Wrap around
        if (this.x < 0) this.x = width;
        if (this.x > width) this.x = 0;
        if (this.y < 0) this.y = height;
        if (this.y > height) this.y = 0;

        // Metabolic cost scales with movement and connectivity
        const metabolism = this.genes.energyEfficiency + (this.synapses.length * 0.01) + (speed * 0.01);
        this.energy -= metabolism * simScale;
    }

    draw(context) {
        // Synapses
        for (const s of this.synapses) {
            const act = (this.activation + s.target.activation) / 2;
            context.beginPath();
            context.moveTo(this.x, this.y);
            context.lineTo(s.target.x, s.target.y);
            context.strokeStyle = `hsla(${this.genes.hue}, 100%, 70%, ${act * 0.8 + 0.04})`;
            context.lineWidth = 0.6 + s.weight * 1.8;
            context.stroke();
        }

        // Node
        const l = 48 + this.activation * 35;
        const alpha = Math.max(0.18, Math.min(1, this.energy / 100));
        context.shadowBlur = 10 + 12 * this.activation;
        context.shadowColor = `hsla(${this.genes.hue}, 100%, 60%, 0.8)`;
        context.beginPath();
        context.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        context.fillStyle = `hsla(${this.genes.hue}, 100%, ${l}%, ${alpha})`;
        context.fill();
        context.shadowBlur = 0;
    }
}

window.Agent = Agent;

function createAnomaly({
    x = Math.random() * width,
    y = Math.random() * height,
    type = 'chaos',
    power = 1,
    ttl = 500 + Math.random() * 500
} = {}) {
    const p = Math.max(0.2, Math.min(5, Number(power) || 1));
    const palette = {
        attractor: 180,
        repulsor: 350,
        chaos: 280
    };

    return {
        id: ++anomalyIdSeq,
        x,
        y,
        type,
        power: p,
        radius: 90 + p * 45 + Math.random() * 50,
        ttl,
        age: 0,
        pulse: Math.random() * Math.PI * 2,
        hue: palette[type] ?? 280
    };
}

function spawnAnomaly(opts = {}) {
    const anomaly = createAnomaly(opts);
    anomalies.push(anomaly);
    return anomaly;
}

function sampleAnomalyField(agent, now) {
    let fx = 0;
    let fy = 0;
    let activationBoost = 0;
    let energyDelta = 0;

    for (const anomaly of anomalies) {
        const dx = anomaly.x - agent.x;
        const dy = anomaly.y - agent.y;
        const d = Math.hypot(dx, dy) || 0.001;

        if (d > anomaly.radius) continue;

        const norm = 1 - d / anomaly.radius;
        const pulse = 0.5 + 0.5 * Math.sin(now * 0.005 + anomaly.pulse);
        const strength = norm * anomaly.power * (0.25 + pulse * 0.75);

        if (anomaly.type === 'attractor') {
            fx += (dx / d) * 0.08 * strength;
            fy += (dy / d) * 0.08 * strength;
            energyDelta += 0.02 * strength;
            activationBoost += 0.01 * strength;
        } else if (anomaly.type === 'repulsor') {
            fx -= (dx / d) * 0.12 * strength;
            fy -= (dy / d) * 0.12 * strength;
            energyDelta -= 0.018 * strength;
            activationBoost += 0.006 * strength;
        } else {
            // Chaos field produces a tangential swirl
            fx += (-dy / d) * 0.11 * strength;
            fy += (dx / d) * 0.11 * strength;
            activationBoost += 0.015 * strength;
            energyDelta += (Math.random() - 0.5) * 0.01 * strength;
        }
    }

    return { fx, fy, activationBoost, energyDelta };
}

function updateAnomalies(simScale) {
    if (simScale <= 0) return;

    for (let i = anomalies.length - 1; i >= 0; i--) {
        const a = anomalies[i];
        a.age += simScale;
        a.ttl -= simScale * 4;
        a.pulse += 0.02 * simScale;

        if (a.type === 'chaos') {
            a.x += Math.sin(a.pulse * 0.8) * 0.6 * simScale;
            a.y += Math.cos(a.pulse * 0.9) * 0.6 * simScale;
        }

        if (a.ttl <= 0) {
            anomalies.splice(i, 1);
        }
    }
}

function drawAnomalies(now) {
    if (!ecoConfig.fieldOverlay || anomalies.length === 0) return;

    for (const a of anomalies) {
        const life = Math.max(0, Math.min(1, a.ttl / 1000));
        const pulse = 0.5 + 0.5 * Math.sin(now * 0.006 + a.pulse);
        const r = a.radius * (0.75 + pulse * 0.35);

        ctx.beginPath();
        ctx.arc(a.x, a.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${a.hue}, 100%, 60%, ${0.05 + life * 0.2})`;
        ctx.lineWidth = 1 + pulse * 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(a.x, a.y, r * 0.35, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${a.hue}, 100%, 50%, ${0.02 + pulse * 0.08})`;
        ctx.fill();
    }
}

function maybeSpawnAutoStorm(now, simScale) {
    if (simScale <= 0 || !ecoConfig.autoStorms || anomalies.length > 8) return;

    autoStormCooldown -= simScale;
    if (autoStormCooldown > 0) return;

    const pressure = Math.min(1.5, agents.length / maxPopulation + globalActivation / 80);
    const probability = 0.03 + pressure * 0.05;

    if (Math.random() < probability) {
        const roll = Math.random();
        const type = roll < 0.34 ? 'attractor' : roll < 0.67 ? 'repulsor' : 'chaos';
        spawnAnomaly({
            x: Math.random() * width,
            y: 40 + Math.random() * Math.max(60, height - 80),
            type,
            power: 0.8 + Math.random() * (1.2 + pressure),
            ttl: 400 + Math.random() * 800
        });
    }

    autoStormCooldown = 90 + Math.random() * 180;
}

function computeEntropyFromBins(bins) {
    const total = bins.reduce((sum, v) => sum + v, 0);
    if (!total) return 0;
    const nonZero = bins.filter(Boolean).length;
    if (nonZero <= 1) return 0;

    let entropy = 0;
    for (const count of bins) {
        if (!count) continue;
        const p = count / total;
        entropy -= p * Math.log(p);
    }
    return entropy / Math.log(nonZero);
}

// Initial population
for (let i = 0; i < 50; i++) {
    agents.push(new Agent(Math.random() * width, Math.random() * height));
}

let disturbance = { x: 0, y: 0, active: false };

window.addEventListener('bio-disturbance', (e) => {
    disturbance = { x: e.detail.x, y: e.detail.y, active: true };
    setTimeout(() => { disturbance.active = false; }, 100);
});

document.addEventListener('click', (e) => {
    if (e.target.id === 'desktop-ui' || e.target.id === 'workspace') {
        window.energyPool += 300;

        if (e.shiftKey) {
            spawnAnomaly({ x: e.clientX, y: e.clientY, type: 'attractor', power: 1.2, ttl: 700 });
        } else if (e.altKey) {
            spawnAnomaly({ x: e.clientX, y: e.clientY, type: 'repulsor', power: 1.4, ttl: 600 });
        } else if (Math.random() < 0.18) {
            spawnAnomaly({ x: e.clientX, y: e.clientY, type: 'chaos', power: 0.8, ttl: 350 });
        }

        for (const a of agents) {
            const dx = e.clientX - a.x;
            const dy = e.clientY - a.y;
            if (dx * dx + dy * dy < 40000) {
                a.energy += 40;
                a.vx += dx * 0.02;
                a.vy += dy * 0.02;
                a.activation = 1.0;
            }
        }
    }
});

window.ecoState = {
    pop: 0,
    gen: 1,
    energy: 100,
    activeNodes: 0,
    globalActivation: 0,
    synapses: 0,
    entropy: 0,
    dominantHue: 180,
    anomalies: 0,
    stormIntensity: 0,
    paused: false,
    timeScale: 1
};

// Control surface for widgets.js / terminal.
window.ecoControls.spawn = function spawnAgents(count = 10, x = width / 2, y = height / 2) {
    const safeCount = Math.max(1, Math.min(200, Math.floor(count)));
    for (let i = 0; i < safeCount; i++) {
        if (agents.length >= maxPopulation) break;
        agents.push(new Agent(
            x + (Math.random() - 0.5) * 40,
            y + (Math.random() - 0.5) * 40
        ));
    }
    return agents.length;
};

window.ecoControls.purge = function purgeAgents() {
    agents.length = 0;
    anomalies.length = 0;
    globalActivation = 0;
    return agents.length;
};

window.ecoControls.setThemeHue = function setThemeHue(hue) {
    const normalized = ((Number(hue) % 360) + 360) % 360;
    agents.forEach((a) => {
        a.genes.hue = normalized;
    });
    return normalized;
};

window.ecoControls.mutate = function mutatePopulation(intensity = 1) {
    const factor = Math.max(0.1, Math.min(5, Number(intensity) || 1));
    agents.forEach((a) => {
        a.genes.speed = Math.max(1, Math.min(5, a.genes.speed + (Math.random() - 0.5) * 0.6 * factor));
        a.genes.sensorRange = Math.max(50, Math.min(300, a.genes.sensorRange + (Math.random() - 0.5) * 28 * factor));
        a.genes.synapseCapacity = Math.max(1, Math.min(10, Math.round(a.genes.synapseCapacity + (Math.random() - 0.5) * 2 * factor)));
        a.genes.energyEfficiency = Math.max(0.05, Math.min(0.3, a.genes.energyEfficiency + (Math.random() - 0.5) * 0.03 * factor));
        if (Math.random() < 0.35) {
            a.genes.hue = ((a.genes.hue + (Math.random() - 0.5) * 80 * factor) % 360 + 360) % 360;
        }
        a.activation = Math.max(a.activation, 0.4);
    });
    globalActivation += 8 * factor;
    if (agents.length > 0) {
        spawnAnomaly({ type: 'chaos', power: Math.min(2.5, 0.7 + factor), ttl: 500 });
    }
    return agents.length;
};

window.ecoControls.radiate = function radiateSwarm(power = 1) {
    const p = Math.max(0.1, Math.min(10, Number(power) || 1));
    window.energyPool += 250 * p;
    agents.forEach((a) => {
        a.energy += 15 * p;
        a.activation = Math.min(1, a.activation + 0.35 * p);
    });
    globalActivation += 15 * p;
    spawnAnomaly({ type: 'attractor', power: Math.min(3, 0.8 + p * 0.25), ttl: 450 + p * 90 });
    return { power: p, energyPool: window.energyPool };
};

window.ecoControls.pause = function pauseSimulation() {
    ecoConfig.paused = true;
    return ecoConfig.paused;
};

window.ecoControls.resume = function resumeSimulation() {
    ecoConfig.paused = false;
    return ecoConfig.paused;
};

window.ecoControls.togglePause = function togglePause() {
    ecoConfig.paused = !ecoConfig.paused;
    return ecoConfig.paused;
};

window.ecoControls.setTimeScale = function setTimeScale(value = 1) {
    ecoConfig.timeScale = Math.max(0.1, Math.min(3, Number(value) || 1));
    return ecoConfig.timeScale;
};

window.ecoControls.setAutoStorms = function setAutoStorms(flag) {
    ecoConfig.autoStorms = !!flag;
    return ecoConfig.autoStorms;
};

window.ecoControls.toggleAutoStorms = function toggleAutoStorms() {
    ecoConfig.autoStorms = !ecoConfig.autoStorms;
    return ecoConfig.autoStorms;
};

window.ecoControls.setFieldOverlay = function setFieldOverlay(flag) {
    ecoConfig.fieldOverlay = !!flag;
    return ecoConfig.fieldOverlay;
};

window.ecoControls.toggleFieldOverlay = function toggleFieldOverlay() {
    ecoConfig.fieldOverlay = !ecoConfig.fieldOverlay;
    return ecoConfig.fieldOverlay;
};

window.ecoControls.storm = function createStorm(type = 'chaos', power = 1) {
    const normalizedType = ['attractor', 'repulsor', 'chaos'].includes(type) ? type : 'chaos';
    return spawnAnomaly({
        type: normalizedType,
        power: Math.max(0.2, Math.min(5, Number(power) || 1))
    });
};

function loopEco() {
    const now = performance.now();
    const deltaFrames = Math.max(0.5, Math.min(2, (now - lastLoopTime) / 16.6667));
    lastLoopTime = now;

    const simScale = ecoConfig.paused ? 0 : ecoConfig.timeScale * deltaFrames;

    ctx.clearRect(0, 0, width, height);

    const obstacles = window.getOSWindowRects ? window.getOSWindowRects() : [];

    globalActivation *= ecoConfig.paused ? 0.99 : Math.max(0.8, 1 - 0.05 * simScale);

    if (!ecoConfig.paused) {
        maybeSpawnAutoStorm(now, simScale);
    }
    updateAnomalies(simScale);
    drawAnomalies(now);

    let activeCount = 0;
    let synapseCount = 0;
    const hueBins = new Array(12).fill(0);
    const geneSums = { speed: 0, sensorRange: 0, synapseCapacity: 0, energyEfficiency: 0 };

    for (let i = agents.length - 1; i >= 0; i--) {
        const a = agents[i];

        if (disturbance.active && !ecoConfig.paused) {
            const dx = a.x - disturbance.x;
            const dy = a.y - disturbance.y;
            const d = Math.hypot(dx, dy) || 1;
            if (d < 150) {
                a.vx += (dx / d) * 3 * Math.min(2, ecoConfig.timeScale);
                a.vy += (dy / d) * 3 * Math.min(2, ecoConfig.timeScale);
                a.synapses = [];
            }
        }

        a.update(obstacles, agents, simScale, now);
        a.draw(ctx);

        if (a.activation > 0.5) activeCount++;
        synapseCount += a.synapses.length;

        geneSums.speed += a.genes.speed;
        geneSums.sensorRange += a.genes.sensorRange;
        geneSums.synapseCapacity += a.genes.synapseCapacity;
        geneSums.energyEfficiency += a.genes.energyEfficiency;
        hueBins[Math.floor((((a.genes.hue % 360) + 360) % 360) / 30) % 12]++;

        if (a.energy <= 0) {
            for (const other of agents) {
                other.synapses = other.synapses.filter((s) => s.target !== a);
            }
            agents.splice(i, 1);
            continue;
        }

        if (!ecoConfig.paused && a.energy > 150 && agents.length < maxPopulation && window.energyPool > 50) {
            a.energy -= 80;
            window.energyPool -= 50;
            agents.push(new Agent(a.x, a.y, a.genes));
            generation++;
        }
    }

    if (!ecoConfig.paused) {
        const anomalyDrain = anomalies.length * 0.08;
        window.energyPool += (0.5 - anomalyDrain) * Math.max(0.5, ecoConfig.timeScale);
    }
    window.energyPool = Math.max(0, window.energyPool);

    const entropy = computeEntropyFromBins(hueBins);
    const dominantBin = hueBins.reduce((bestIndex, count, idx, arr) => (count > arr[bestIndex] ? idx : bestIndex), 0);
    const dominantHue = dominantBin * 30 + 15;
    const stormIntensity = Math.min(1, anomalies.reduce((sum, a) => sum + a.power * (a.ttl / 1000), 0) / 12);

    const avgGenes = agents.length ? {
        speed: geneSums.speed / agents.length,
        sensorRange: geneSums.sensorRange / agents.length,
        synapseCapacity: geneSums.synapseCapacity / agents.length,
        energyEfficiency: geneSums.energyEfficiency / agents.length
    } : {
        speed: 0,
        sensorRange: 0,
        synapseCapacity: 0,
        energyEfficiency: 0
    };

    window.ecoState = {
        pop: agents.length,
        gen: generation,
        energy: Math.min(100, (window.energyPool / 2000) * 100),
        activeNodes: activeCount,
        globalActivation,
        synapses: synapseCount,
        entropy,
        dominantHue,
        anomalies: anomalies.length,
        stormIntensity,
        paused: ecoConfig.paused,
        timeScale: ecoConfig.timeScale,
        autoStorms: ecoConfig.autoStorms,
        fieldOverlay: ecoConfig.fieldOverlay,
        avgGenes
    };

    if (window.setBackdropEnergy) {
        const base = agents.length / maxPopulation;
        const neuralSpike = Math.min(1, globalActivation / 50);
        window.setBackdropEnergy(base + neuralSpike * 0.35 + stormIntensity * 0.2);
    }

    if (window.setBackdropNeuralState) {
        window.setBackdropNeuralState({
            activation: Math.min(1.2, globalActivation / 45),
            entropy,
            storm: stormIntensity,
            hue: dominantHue / 360
        });
    }
}


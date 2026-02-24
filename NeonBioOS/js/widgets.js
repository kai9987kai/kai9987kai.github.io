// widgets.js
// UI logic for monitor, terminal, genome sequencer, and neural observatory.

// System Monitor
const popIndicator = document.getElementById('pop-indicator');
const statGen = document.getElementById('stat-gen');
const statEnergy = document.getElementById('stat-energy');
const statHealth = document.getElementById('stat-health');
const popGraph = document.getElementById('pop-graph');
const gCtx = popGraph.getContext('2d');
const history = [];

function updateMonitor(state) {
    if (!state) return;

    popIndicator.innerText = `Pop: ${state.pop}`;
    statGen.innerText = state.gen;
    statEnergy.innerText = `${Math.round(state.energy)}%`;

    if (state.paused) statHealth.innerText = 'Paused';
    else if (state.anomalies > 5) statHealth.innerText = 'Storm Surge';
    else if (state.pop > 180) statHealth.innerText = 'Critical Mass';
    else if (state.pop > 70) statHealth.innerText = 'Thriving';
    else if (state.pop > 0) statHealth.innerText = 'Stable';
    else statHealth.innerText = 'Extinct';

    history.push(state.pop);
    if (history.length > 100) history.shift();

    drawGraph();
}

function drawGraph() {
    gCtx.clearRect(0, 0, popGraph.width, popGraph.height);
    gCtx.strokeStyle = '#00f3ff';
    gCtx.lineWidth = 2;
    gCtx.beginPath();
    for (let i = 0; i < history.length; i++) {
        const x = (i / 100) * popGraph.width;
        const y = popGraph.height - (history[i] / 240) * popGraph.height;
        if (i === 0) gCtx.moveTo(x, y);
        else gCtx.lineTo(x, y);
    }
    gCtx.stroke();
}

// Terminal
const termOutput = document.getElementById('term-output');
const termInput = document.getElementById('term-input');

function printTerm(msg, type = 'normal') {
    const p = document.createElement('p');
    p.innerText = '> ' + msg;
    if (type !== 'normal') p.classList.add(type);
    termOutput.appendChild(p);
    termOutput.scrollTop = termOutput.scrollHeight;
}

function getEcoControls() {
    return window.ecoControls || {};
}

function parseToggle(arg, fallback) {
    if (arg == null) return fallback;
    const v = String(arg).toLowerCase();
    if (['on', 'true', '1', 'yes'].includes(v)) return true;
    if (['off', 'false', '0', 'no'].includes(v)) return false;
    return fallback;
}

function runTerminalCommand(rawInput) {
    const raw = rawInput.trim();
    const cmd = raw.toLowerCase();
    if (!cmd) return;

    printTerm(cmd, 'normal');

    const [command, ...args] = cmd.split(/\s+/);
    const eco = getEcoControls();

    switch (command) {
        case 'help':
            printTerm('Available commands:', 'system');
            printTerm('- status : Snapshot current ecosystem metrics', 'system');
            printTerm('- spawn [amount] : Insert organisms', 'system');
            printTerm('- purge : Eliminate all biological entities', 'system');
            printTerm('- energy : Inject bio-energy', 'system');
            printTerm('- theme [color|hue] : Shift dominant hue', 'system');
            printTerm('- mutate [intensity] : Trigger genome perturbation', 'system');
            printTerm('- radiate [power] / pulse [power] : Neural energy pulse', 'system');
            printTerm('- pause | resume : Simulation control', 'system');
            printTerm('- speed [0.1-3] : Set time scale', 'system');
            printTerm('- storm [type] [power] : attractor/repulsor/chaos field', 'system');
            printTerm('- autostorm [on|off] : Toggle automatic storms', 'system');
            printTerm('- field [on|off] : Toggle field overlay visuals', 'system');
            break;

        case 'status': {
            const s = window.ecoState || {};
            const entropyText = Number(s.entropy || 0).toFixed(2);
            const speedText = Number(s.timeScale || 1).toFixed(1);
            printTerm(
                `Pop ${s.pop ?? 0} | Synapses ${s.synapses ?? 0} | Activation ${Math.round(((s.globalActivation ?? 0) / 50) * 100)}%`,
                'system'
            );
            printTerm(
                `Entropy ${entropyText} | Storms ${s.anomalies ?? 0} | Speed ${speedText}x`,
                'system'
            );
            break;
        }

        case 'purge':
            if (typeof eco.purge === 'function') eco.purge();
            else if (window.agents) window.agents.length = 0;
            printTerm('Ecosystem purged.', 'error');
            break;

        case 'energy':
            window.energyPool += 2000;
            printTerm('Energy pool overloaded.', 'system');
            break;

        case 'spawn': {
            const amt = Math.max(1, Math.min(200, parseInt(args[0], 10) || 10));
            if (typeof eco.spawn === 'function') {
                eco.spawn(amt, window.innerWidth / 2, window.innerHeight / 2);
            } else if (window.agents && window.Agent) {
                for (let i = 0; i < amt; i++) {
                    window.agents.push(new window.Agent(window.innerWidth / 2, window.innerHeight / 2));
                }
            }
            printTerm(`Spawned ${amt} entities.`, 'system');
            break;
        }

        case 'theme': {
            const color = args[0];
            let hue = 180;
            if (color === 'blue') hue = 200;
            else if (color === 'purple') hue = 280;
            else if (color === 'green') hue = 120;
            else if (color === 'red') hue = 0;
            else if (!Number.isNaN(parseInt(color, 10))) hue = parseInt(color, 10);

            if (typeof eco.setThemeHue === 'function') eco.setThemeHue(hue);
            else if (window.agents) {
                window.agents.forEach((a) => {
                    if (a.genes) a.genes.hue = hue;
                });
            }
            printTerm(`Genetic drift induced. Dominant hue set to ${hue}.`, 'system');
            break;
        }

        case 'mutate': {
            const intensity = Math.max(0.1, Math.min(5, parseFloat(args[0]) || 1));
            if (typeof eco.mutate === 'function') {
                eco.mutate(intensity);
                printTerm(`Mutation cascade triggered (intensity ${intensity.toFixed(1)}).`, 'system');
            } else {
                printTerm('Mutation controls unavailable.', 'error');
            }
            break;
        }

        case 'radiate':
        case 'pulse': {
            const power = Math.max(0.1, Math.min(10, parseFloat(args[0]) || 1));
            if (typeof eco.radiate === 'function') {
                eco.radiate(power);
                printTerm(`Radiation pulse emitted (power ${power.toFixed(1)}).`, 'system');
            } else {
                window.energyPool += 250 * power;
                printTerm(`Energy pulse emitted (fallback, power ${power.toFixed(1)}).`, 'system');
            }
            break;
        }

        case 'pause':
            if (typeof eco.pause === 'function') eco.pause();
            printTerm('Simulation paused.', 'system');
            break;

        case 'resume':
            if (typeof eco.resume === 'function') eco.resume();
            printTerm('Simulation resumed.', 'system');
            break;

        case 'speed': {
            const speed = Math.max(0.1, Math.min(3, parseFloat(args[0]) || 1));
            if (typeof eco.setTimeScale === 'function') eco.setTimeScale(speed);
            printTerm(`Time scale set to ${speed.toFixed(1)}x.`, 'system');
            break;
        }

        case 'storm': {
            let type = 'chaos';
            let power = 1;
            if (args[0]) {
                if (['attractor', 'repulsor', 'chaos'].includes(args[0])) {
                    type = args[0];
                    power = Math.max(0.2, Math.min(5, parseFloat(args[1]) || 1));
                } else {
                    power = Math.max(0.2, Math.min(5, parseFloat(args[0]) || 1));
                }
            }
            if (typeof eco.storm === 'function') {
                eco.storm(type, power);
                printTerm(`Spawned ${type} field (power ${power.toFixed(1)}).`, 'system');
            } else {
                printTerm('Storm generator unavailable.', 'error');
            }
            break;
        }

        case 'autostorm': {
            const next = parseToggle(args[0], !(window.ecoState?.autoStorms));
            let actual = next;
            if (typeof eco.setAutoStorms === 'function') actual = eco.setAutoStorms(next);
            printTerm(`Autostorm ${actual ? 'enabled' : 'disabled'}.`, 'system');
            break;
        }

        case 'field': {
            const next = parseToggle(args[0], !(window.ecoState?.fieldOverlay));
            let actual = next;
            if (typeof eco.setFieldOverlay === 'function') actual = eco.setFieldOverlay(next);
            printTerm(`Field overlay ${actual ? 'enabled' : 'disabled'}.`, 'system');
            break;
        }

        default:
            printTerm('Unknown command. Type "help" for options.', 'error');
    }
}

termInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const value = termInput.value;
        termInput.value = '';
        runTerminalCommand(value);
    }
});

// File Node logic
const fileIcons = document.querySelectorAll('.file-icon');
fileIcons.forEach((icon) => {
    icon.addEventListener('dblclick', () => {
        const type = icon.getAttribute('data-type');
        const eco = getEcoControls();
        if (type === 'hazard') {
            printTerm('WARNING: Virus.exe executed. Repulsor antibodies deployed.', 'error');
            window.agents.forEach((a) => { a.energy -= 50; });
            if (typeof eco.storm === 'function') eco.storm('repulsor', 1.8);
        } else {
            printTerm(`Opened ${icon.innerText}. Parsing into nutrient field.`, 'system');
            window.energyPool += 500;
            if (typeof eco.storm === 'function') eco.storm('attractor', 1.0);
        }
    });
});

// Genome Sequencer
const dnaSpd = document.getElementById('dna-spd');
const dnaSns = document.getElementById('dna-sns');
const dnaSyn = document.getElementById('dna-syn');
const dnaEff = document.getElementById('dna-eff');
const dnaHue = document.getElementById('dna-hue');

function updateGenome() {
    if (!window.agents || window.agents.length === 0) return;

    let sumSpd = 0;
    let sumSns = 0;
    let sumSyn = 0;
    let sumEff = 0;
    let count = 0;
    const hues = {};

    window.agents.forEach((a) => {
        sumSpd += a.genes.speed;
        sumSns += a.genes.sensorRange;
        sumSyn += a.genes.synapseCapacity;
        sumEff += a.genes.energyEfficiency;
        const h = Math.round(a.genes.hue);
        hues[h] = (hues[h] || 0) + 1;
        count++;
    });

    const avgSpd = sumSpd / count;
    const avgSns = sumSns / count;
    const avgSyn = sumSyn / count;
    const avgEff = sumEff / count;

    dnaSpd.style.width = Math.min(100, (avgSpd / 5) * 100) + '%';
    dnaSns.style.width = Math.min(100, (avgSns / 300) * 100) + '%';
    dnaSyn.style.width = Math.min(100, (avgSyn / 10) * 100) + '%';
    dnaEff.style.width = Math.min(100, (avgEff / 0.3) * 100) + '%';

    const domHue = Number(Object.keys(hues).reduce((a, b) => (hues[a] > hues[b] ? a : b), '180'));
    dnaHue.style.background = `hsl(${domHue}, 100%, 50%)`;
    dnaHue.style.boxShadow = `0 0 10px hsla(${domHue}, 100%, 60%, 0.8)`;
    dnaHue.title = `Dominant hue ${domHue}`;
}

// Neural Observatory
const obsActivation = document.getElementById('obs-activation');
const obsSynapses = document.getElementById('obs-synapses');
const obsActiveNodes = document.getElementById('obs-active-nodes');
const obsEntropy = document.getElementById('obs-entropy');
const obsAnomalies = document.getElementById('obs-anomalies');
const obsStormState = document.getElementById('obs-storm-state');
const obsActivationBar = document.getElementById('obs-activation-bar');
const obsEntropyBar = document.getElementById('obs-entropy-bar');
const obsSpeedLabel = document.getElementById('obs-speed-label');
const simSpeed = document.getElementById('sim-speed');
const obsPauseBtn = document.getElementById('obs-pause-btn');
const obsStormBtn = document.getElementById('obs-storm-btn');
const obsRadiateBtn = document.getElementById('obs-radiate-btn');
const obsAutostormBtn = document.getElementById('obs-autostorm-btn');
const obsFieldBtn = document.getElementById('obs-field-btn');
const neuralGraph = document.getElementById('neural-graph');
const nCtx = neuralGraph ? neuralGraph.getContext('2d') : null;
const neuralHistory = [];

function setToggleButtonState(button, isOn, onLabel, offLabel) {
    if (!button) return;
    button.classList.toggle('on', isOn);
    button.classList.toggle('off', !isOn);
    button.textContent = isOn ? onLabel : offLabel;
}

function sizeNeuralGraph() {
    if (!neuralGraph) return;
    const w = Math.max(10, Math.floor(neuralGraph.clientWidth));
    const h = Math.max(10, Math.floor(neuralGraph.clientHeight));
    if (neuralGraph.width !== w) neuralGraph.width = w;
    if (neuralGraph.height !== h) neuralGraph.height = h;
}

function drawNeuralGraph() {
    if (!nCtx || !neuralGraph) return;
    sizeNeuralGraph();

    nCtx.clearRect(0, 0, neuralGraph.width, neuralGraph.height);
    nCtx.lineWidth = 1.5;

    // Activation line
    nCtx.beginPath();
    nCtx.strokeStyle = '#00f3ff';
    for (let i = 0; i < neuralHistory.length; i++) {
        const p = neuralHistory[i];
        const x = (i / Math.max(1, neuralHistory.length - 1)) * neuralGraph.width;
        const y = neuralGraph.height - p.activation * neuralGraph.height;
        if (i === 0) nCtx.moveTo(x, y);
        else nCtx.lineTo(x, y);
    }
    nCtx.stroke();

    // Storm area
    nCtx.beginPath();
    nCtx.strokeStyle = 'rgba(255, 0, 120, 0.65)';
    for (let i = 0; i < neuralHistory.length; i++) {
        const p = neuralHistory[i];
        const x = (i / Math.max(1, neuralHistory.length - 1)) * neuralGraph.width;
        const y = neuralGraph.height - p.storm * neuralGraph.height;
        if (i === 0) nCtx.moveTo(x, y);
        else nCtx.lineTo(x, y);
    }
    nCtx.stroke();

    // Entropy line
    nCtx.beginPath();
    nCtx.strokeStyle = 'rgba(157, 0, 255, 0.8)';
    for (let i = 0; i < neuralHistory.length; i++) {
        const p = neuralHistory[i];
        const x = (i / Math.max(1, neuralHistory.length - 1)) * neuralGraph.width;
        const y = neuralGraph.height - p.entropy * neuralGraph.height;
        if (i === 0) nCtx.moveTo(x, y);
        else nCtx.lineTo(x, y);
    }
    nCtx.stroke();
}

function updateObservatory() {
    const s = window.ecoState;
    if (!s || !obsActivation) return;

    const activationNorm = Math.min(1, (s.globalActivation || 0) / 50);
    const entropyNorm = Math.min(1, s.entropy || 0);
    const stormNorm = Math.min(1, s.stormIntensity || 0);

    obsActivation.textContent = `${Math.round(activationNorm * 100)}%`;
    obsSynapses.textContent = `${s.synapses || 0}`;
    obsActiveNodes.textContent = `${s.activeNodes || 0} active nodes`;
    obsEntropy.textContent = entropyNorm.toFixed(2);
    obsAnomalies.textContent = `${s.anomalies || 0}`;
    obsStormState.textContent = `Auto: ${s.autoStorms ? 'ON' : 'OFF'} | Fields: ${s.fieldOverlay ? 'ON' : 'OFF'}`;

    obsActivationBar.style.width = `${Math.round(activationNorm * 100)}%`;
    obsEntropyBar.style.width = `${Math.round(entropyNorm * 100)}%`;
    obsActivationBar.style.background = `linear-gradient(90deg, #00f3ff, hsl(${Math.round(s.dominantHue || 180)}, 100%, 55%))`;

    if (obsSpeedLabel) obsSpeedLabel.textContent = `${(s.timeScale || 1).toFixed(1)}x`;
    if (simSpeed && document.activeElement !== simSpeed) {
        simSpeed.value = String(s.timeScale || 1);
    }
    if (obsPauseBtn) obsPauseBtn.textContent = s.paused ? 'Resume' : 'Pause';
    setToggleButtonState(obsAutostormBtn, !!s.autoStorms, 'Autostorm ON', 'Autostorm OFF');
    setToggleButtonState(obsFieldBtn, !!s.fieldOverlay, 'Fields ON', 'Fields OFF');

    neuralHistory.push({
        activation: activationNorm,
        entropy: entropyNorm,
        storm: stormNorm
    });
    if (neuralHistory.length > 80) neuralHistory.shift();
    drawNeuralGraph();
}

if (obsPauseBtn) {
    obsPauseBtn.addEventListener('click', () => {
        const eco = getEcoControls();
        if (window.ecoState?.paused) {
            eco.resume?.();
            printTerm('Simulation resumed via observatory.', 'system');
        } else {
            eco.pause?.();
            printTerm('Simulation paused via observatory.', 'system');
        }
    });
}

if (obsStormBtn) {
    obsStormBtn.addEventListener('click', () => {
        getEcoControls().storm?.('chaos', 1.5);
        printTerm('Observatory injected chaos field.', 'system');
    });
}

if (obsRadiateBtn) {
    obsRadiateBtn.addEventListener('click', () => {
        getEcoControls().radiate?.(1.5);
        printTerm('Observatory emitted neural radiation pulse.', 'system');
    });
}

if (obsAutostormBtn) {
    obsAutostormBtn.addEventListener('click', () => {
        const eco = getEcoControls();
        const next = eco.toggleAutoStorms ? eco.toggleAutoStorms() : !(window.ecoState?.autoStorms);
        setToggleButtonState(obsAutostormBtn, !!next, 'Autostorm ON', 'Autostorm OFF');
        printTerm(`Autostorm ${next ? 'enabled' : 'disabled'} via observatory.`, 'system');
    });
}

if (obsFieldBtn) {
    obsFieldBtn.addEventListener('click', () => {
        const eco = getEcoControls();
        const next = eco.toggleFieldOverlay ? eco.toggleFieldOverlay() : !(window.ecoState?.fieldOverlay);
        setToggleButtonState(obsFieldBtn, !!next, 'Fields ON', 'Fields OFF');
        printTerm(`Field overlay ${next ? 'enabled' : 'disabled'} via observatory.`, 'system');
    });
}

if (simSpeed) {
    simSpeed.addEventListener('input', () => {
        const val = Math.max(0.1, Math.min(3, parseFloat(simSpeed.value) || 1));
        getEcoControls().setTimeScale?.(val);
        if (obsSpeedLabel) obsSpeedLabel.textContent = `${val.toFixed(1)}x`;
    });
}

window.addEventListener('resize', sizeNeuralGraph);
setTimeout(sizeNeuralGraph, 0);

// Periodic UI refresh
setInterval(updateGenome, 800);
setInterval(updateObservatory, 200);

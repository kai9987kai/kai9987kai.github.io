const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const hadExternalTimeController = typeof window.advanceTime === 'function';

const WIDTH = 960;
const HEIGHT = 600;
const WIN_SCORE = 7;
const FIXED_STEP = 1 / 120;
const PULSE_COST = 60;
const DASH_COST = 34;

const ui = {
    start: document.getElementById('start-screen'),
    pause: document.getElementById('pause-screen'),
    gameOver: document.getElementById('game-over-screen'),
    tutorial: document.getElementById('tutorial-overlay'),
    tutorialProgress: document.getElementById('tutorial-progress'),
    tutorialText: document.getElementById('tutorial-text'),
    tutorialHint: document.getElementById('tutorial-hint'),
    p1Score: document.getElementById('player1-score'),
    p2Score: document.getElementById('player2-score'),
    p1Focus: document.getElementById('player1-focus'),
    p2Focus: document.getElementById('player2-focus'),
    p1State: document.getElementById('player1-state'),
    p2State: document.getElementById('player2-state'),
    p2Name: document.getElementById('player2-name'),
    rally: document.getElementById('rally-label'),
    ai: document.getElementById('ai-label'),
    winner: document.getElementById('winner-text'),
    summary: document.getElementById('match-summary'),
    toast: document.getElementById('toast'),
    reader: document.getElementById('screen-reader-status'),
    motionToggle: document.getElementById('motion-toggle'),
    contrastToggle: document.getElementById('contrast-toggle'),
    soundToggle: document.getElementById('sound-toggle'),
};

const keys = new Set();
let seed = 0x9e3779b9;
let accumulator = 0;
let lastFrame = 0;
let visualTime = 0;

const state = {
    screen: 'MENU',
    previousScreen: 'PLAYING',
    mode: '1P',
    score: [0, 0],
    rally: 0,
    bestRally: 0,
    serveTimer: 0,
    nextServeDirection: -1,
    powerUpTimer: 8,
    powerUp: null,
    toastTimer: 0,
    shake: 0,
    aiPace: 'Balanced',
    matchTime: 0,
    tutorialStep: 0,
    tutorialComplete: false,
    tutorialFlags: {
        moved: false,
        dashed: false,
        pulsed: false,
        returned: false,
    },
    stats: {
        edgeHits: 0,
        pulseHits: 0,
        powerUps: 0,
    },
};

const settings = loadSettings();
applySettings();

function loadSettings() {
    const defaults = {
        reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
        highContrast: false,
        sound: true,
    };

    try {
        return { ...defaults, ...JSON.parse(localStorage.getItem('neon-rally-settings') || '{}') };
    } catch {
        return defaults;
    }
}

function saveSettings() {
    try {
        localStorage.setItem('neon-rally-settings', JSON.stringify(settings));
    } catch {
        // Local storage may be unavailable for file:// previews.
    }
}

function applySettings() {
    document.body.classList.toggle('reduced-motion', settings.reducedMotion);
    document.body.classList.toggle('high-contrast', settings.highContrast);
    ui.motionToggle.textContent = `Reduced motion: ${settings.reducedMotion ? 'On' : 'Off'}`;
    ui.contrastToggle.textContent = `High contrast: ${settings.highContrast ? 'On' : 'Off'}`;
    ui.soundToggle.textContent = `Sound cues: ${settings.sound ? 'On' : 'Off'}`;
    ui.motionToggle.setAttribute('aria-pressed', settings.reducedMotion);
    ui.contrastToggle.setAttribute('aria-pressed', settings.highContrast);
    ui.soundToggle.setAttribute('aria-pressed', settings.sound);
}

function random() {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
}

function randomRange(min, max) {
    return min + (max - min) * random();
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function roundedRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.lineTo(x + width - r, y);
    context.quadraticCurveTo(x + width, y, x + width, y + r);
    context.lineTo(x + width, y + height - r);
    context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    context.lineTo(x + r, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - r);
    context.lineTo(x, y + r);
    context.quadraticCurveTo(x, y, x + r, y);
    context.closePath();
}

class SoundEngine {
    constructor() {
        this.audioContext = null;
    }

    unlock() {
        if (!settings.sound || this.audioContext) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) this.audioContext = new AudioContext();
    }

    play(frequency, duration = 0.06, type = 'sine', volume = 0.035) {
        if (!settings.sound) return;
        this.unlock();
        if (!this.audioContext) return;

        const now = this.audioContext.currentTime;
        const oscillator = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, now);
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
        oscillator.connect(gain);
        gain.connect(this.audioContext.destination);
        oscillator.start(now);
        oscillator.stop(now + duration);
    }
}

const sound = new SoundEngine();

class Paddle {
    constructor(side) {
        this.side = side;
        this.width = 16;
        this.baseHeight = 104;
        this.height = this.baseHeight;
        this.x = side === 0 ? 34 : WIDTH - 50;
        this.y = HEIGHT / 2 - this.height / 2;
        this.velocity = 0;
        this.energy = 100;
        this.pulseArmed = 0;
        this.wideTimer = 0;
        this.aiTarget = HEIGHT / 2;
        this.aiThinkTimer = 0;
    }

    reset() {
        this.height = this.baseHeight;
        this.y = HEIGHT / 2 - this.height / 2;
        this.velocity = 0;
        this.energy = 100;
        this.pulseArmed = 0;
        this.wideTimer = 0;
        this.aiTarget = HEIGHT / 2;
        this.aiThinkTimer = 0;
    }

    update(dt) {
        if (this.wideTimer > 0) {
            this.wideTimer -= dt;
            if (this.wideTimer <= 0) this.height = this.baseHeight;
        }

        if (this.pulseArmed > 0) this.pulseArmed = Math.max(0, this.pulseArmed - dt);

        if (this.side === 1 && state.mode !== '2P') {
            this.updateAI(dt);
            return;
        }

        const playerOneSolo = this.side === 0 && state.mode !== '2P';
        const up = this.side === 0
            ? keys.has('KeyW') || (playerOneSolo && keys.has('ArrowUp'))
            : keys.has('ArrowUp');
        const down = this.side === 0
            ? keys.has('KeyS') || (playerOneSolo && keys.has('ArrowDown'))
            : keys.has('ArrowDown');
        const dashHeld = this.side === 0
            ? keys.has('ShiftLeft') || (playerOneSolo && keys.has('KeyB'))
            : keys.has('ShiftRight');

        const direction = Number(down) - Number(up);
        const dashing = direction !== 0 && dashHeld && this.energy > 0.5;
        const speed = dashing ? 560 : 340;
        this.velocity = direction * speed;

        if (dashing) {
            this.energy = Math.max(0, this.energy - DASH_COST * dt);
            if (state.mode === 'TUTORIAL' && this.side === 0) state.tutorialFlags.dashed = true;
        } else {
            this.energy = Math.min(100, this.energy + 9 * dt);
        }

        if (direction !== 0 && state.mode === 'TUTORIAL' && this.side === 0) {
            state.tutorialFlags.moved = true;
        }

        this.move(dt);
    }

    updateAI(dt) {
        const primaryBall = getThreateningBall();
        const scoreDelta = state.score[1] - state.score[0];
        const adjustment = scoreDelta >= 2 ? -0.07 : scoreDelta <= -2 ? 0.08 : 0;
        state.aiPace = adjustment > 0 ? 'Challenge' : adjustment < 0 ? 'Assist' : 'Balanced';

        const reaction = clamp(0.13 - adjustment * 0.45, 0.085, 0.18);
        this.aiThinkTimer -= dt;
        if (this.aiThinkTimer <= 0) {
            const home = HEIGHT / 2;
            if (primaryBall && primaryBall.vx > 0) {
                const travelTime = Math.max(0, (this.x - primaryBall.x) / primaryBall.vx);
                const projected = projectY(primaryBall.y, primaryBall.vy, travelTime);
                const readableError = randomRange(-24, 24) * (1 - adjustment);
                this.aiTarget = projected + readableError;
            } else {
                this.aiTarget = home;
            }
            this.aiThinkTimer = reaction;
        }

        const desiredY = this.aiTarget - this.height / 2;
        const difference = desiredY - this.y;
        const maxSpeed = 330 * (1 + adjustment);
        this.velocity = Math.abs(difference) < 7 ? 0 : Math.sign(difference) * maxSpeed;

        if (
            primaryBall &&
            primaryBall.vx > 0 &&
            primaryBall.x > WIDTH * 0.68 &&
            this.energy >= PULSE_COST &&
            this.pulseArmed <= 0 &&
            (state.rally >= 5 || scoreDelta < 0)
        ) {
            this.armPulse();
        }

        this.energy = Math.min(100, this.energy + 8 * dt);
        this.move(dt);
    }

    move(dt) {
        this.y = clamp(this.y + this.velocity * dt, 0, HEIGHT - this.height);
    }

    armPulse() {
        if (this.energy < PULSE_COST || this.pulseArmed > 0) return false;
        this.energy -= PULSE_COST;
        this.pulseArmed = 4;
        if (this.side === 0) {
            showToast('Player 1 Pulse armed');
            if (state.mode === 'TUTORIAL') state.tutorialFlags.pulsed = true;
        } else if (state.mode === '2P') {
            showToast('Player 2 Pulse armed');
        }
        sound.play(520, 0.09, 'triangle');
        return true;
    }

    reward(edgeHit) {
        this.energy = Math.min(100, this.energy + (edgeHit ? 22 : 11));
    }

    makeWide() {
        const center = this.y + this.height / 2;
        this.height = 154;
        this.y = clamp(center - this.height / 2, 0, HEIGHT - this.height);
        this.wideTimer = 8;
    }

    draw() {
        const palette = getPalette();
        const color = this.side === 0 ? palette.cyan : palette.pink;
        const armed = this.pulseArmed > 0;

        ctx.save();
        ctx.shadowBlur = armed ? 30 : 18;
        ctx.shadowColor = armed ? palette.gold : color;
        ctx.fillStyle = color;
        roundedRect(ctx, this.x, this.y, this.width, this.height, 8);
        ctx.fill();

        ctx.fillStyle = armed ? palette.gold : 'rgba(255,255,255,0.8)';
        roundedRect(ctx, this.x + 4, this.y + 7, 3, Math.max(12, this.height - 14), 2);
        ctx.fill();

        if (armed) {
            ctx.strokeStyle = palette.gold;
            ctx.lineWidth = 2;
            roundedRect(ctx, this.x - 5, this.y - 5, this.width + 10, this.height + 10, 12);
            ctx.stroke();
        }
        ctx.restore();
    }
}

let ballId = 0;

class Ball {
    constructor(direction = -1, x = WIDTH / 2, y = randomRange(170, HEIGHT - 170)) {
        this.id = ++ballId;
        this.x = x;
        this.y = y;
        this.radius = 9;
        this.lastHitter = null;
        this.isPulse = false;
        this.trail = [];

        const angle = randomRange(-0.42, 0.42);
        const speed = 400;
        this.vx = Math.cos(angle) * speed * direction;
        this.vy = Math.sin(angle) * speed;
    }

    update(dt) {
        this.trail.unshift({ x: this.x, y: this.y });
        this.trail.length = Math.min(this.trail.length, settings.reducedMotion ? 2 : 11);

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        if (this.y - this.radius <= 0 && this.vy < 0) {
            this.y = this.radius;
            this.vy *= -1;
            sound.play(210, 0.035, 'square', 0.018);
        } else if (this.y + this.radius >= HEIGHT && this.vy > 0) {
            this.y = HEIGHT - this.radius;
            this.vy *= -1;
            sound.play(210, 0.035, 'square', 0.018);
        }

        if (this.vx < 0 && intersectsPaddle(this, paddles[0])) {
            this.hitPaddle(paddles[0], 1);
        } else if (this.vx > 0 && intersectsPaddle(this, paddles[1])) {
            this.hitPaddle(paddles[1], -1);
        }

        if (this.x + this.radius < 0) return 1;
        if (this.x - this.radius > WIDTH) return 0;
        return null;
    }

    hitPaddle(paddle, direction) {
        this.x = direction > 0
            ? paddle.x + paddle.width + this.radius
            : paddle.x - this.radius;

        const relative = clamp((this.y - (paddle.y + paddle.height / 2)) / (paddle.height / 2), -1, 1);
        const edgeHit = Math.abs(relative) >= 0.68;
        let speed = Math.min(820, Math.hypot(this.vx, this.vy) * 1.055 + 7);
        const pulseHit = paddle.pulseArmed > 0;

        if (pulseHit) {
            paddle.pulseArmed = 0;
            speed = Math.max(720, speed * 1.24);
            this.isPulse = true;
            state.stats.pulseHits += 1;
            state.shake = Math.max(state.shake, 8);
            showToast('Pulse launched');
            sound.play(145, 0.16, 'sawtooth', 0.055);
        } else {
            this.isPulse = false;
            sound.play(edgeHit ? 410 : 320, 0.045, 'square', 0.028);
        }

        const angle = relative * 0.92;
        this.vx = direction * Math.max(speed * Math.cos(angle), speed * 0.58);
        this.vy = speed * Math.sin(angle) + paddle.velocity * 0.11;
        this.lastHitter = paddle.side;
        state.rally += 1;
        state.bestRally = Math.max(state.bestRally, state.rally);
        paddle.reward(edgeHit);

        if (edgeHit) {
            state.stats.edgeHits += 1;
            showToast('Edge return +22 Focus');
        }

        if (state.mode === 'TUTORIAL' && paddle.side === 0) {
            state.tutorialFlags.returned = true;
        }

        createBurst(this.x, this.y, paddle.side === 0 ? getPalette().cyan : getPalette().pink, pulseHit ? 24 : 12);
        state.shake = Math.max(state.shake, pulseHit ? 8 : 3);
    }

    draw() {
        const palette = getPalette();
        const color = this.isPulse ? palette.gold : '#ffffff';

        ctx.save();
        for (let i = this.trail.length - 1; i >= 0; i -= 1) {
            const point = this.trail[i];
            const alpha = (1 - i / this.trail.length) * (this.isPulse ? 0.42 : 0.2);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(point.x, point.y, Math.max(2, this.radius * (1 - i / 15)), 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.globalAlpha = 1;
        ctx.shadowBlur = this.isPulse ? 28 : 16;
        ctx.shadowColor = color;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class PowerUp {
    constructor() {
        const options = ['WIDE', 'ECHO', 'CHARGE'];
        this.type = options[Math.floor(random() * options.length)];
        this.x = randomRange(WIDTH * 0.36, WIDTH * 0.64);
        this.y = randomRange(150, HEIGHT - 90);
        this.radius = 25;
        this.life = 8;
    }

    update(dt) {
        this.life -= dt;
    }

    draw() {
        const palette = getPalette();
        const details = {
            WIDE: { color: palette.cyan, label: 'W', name: 'Wide' },
            ECHO: { color: palette.pink, label: '2', name: 'Echo' },
            CHARGE: { color: palette.gold, label: '+', name: 'Charge' },
        }[this.type];
        const pulse = settings.reducedMotion ? 1 : 1 + Math.sin(visualTime * 4) * 0.06;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(pulse, pulse);
        ctx.fillStyle = 'rgba(3, 10, 18, 0.86)';
        ctx.strokeStyle = details.color;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 18;
        ctx.shadowColor = details.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.fillStyle = details.color;
        ctx.font = '900 20px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(details.label, 0, -1);
        ctx.font = '800 9px Inter, sans-serif';
        ctx.fillText(details.name.toUpperCase(), 0, 38);
        ctx.restore();
    }
}

const paddles = [new Paddle(0), new Paddle(1)];
let balls = [new Ball(-1)];
let particles = [];

function getPalette() {
    if (settings.highContrast) {
        return {
            background: '#000000',
            grid: 'rgba(255,255,255,0.2)',
            cyan: '#00ffff',
            pink: '#ff61e5',
            gold: '#ffff00',
        };
    }
    return {
        background: '#050b14',
        grid: 'rgba(66, 151, 196, 0.12)',
        cyan: '#43e8ff',
        pink: '#ff4fd8',
        gold: '#ffd166',
    };
}

function intersectsPaddle(ball, paddle) {
    return (
        ball.x + ball.radius >= paddle.x &&
        ball.x - ball.radius <= paddle.x + paddle.width &&
        ball.y + ball.radius >= paddle.y &&
        ball.y - ball.radius <= paddle.y + paddle.height
    );
}

function projectY(y, velocityY, seconds) {
    const span = HEIGHT * 2;
    let projected = (y + velocityY * seconds) % span;
    if (projected < 0) projected += span;
    return projected > HEIGHT ? span - projected : projected;
}

function getThreateningBall() {
    return balls
        .filter((ball) => ball.vx > 0)
        .sort((a, b) => b.x - a.x)[0] || balls[0];
}

function createBurst(x, y, color, count) {
    if (settings.reducedMotion) return;
    for (let i = 0; i < count; i += 1) {
        const angle = random() * Math.PI * 2;
        const speed = randomRange(55, 210);
        particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: randomRange(0.22, 0.52),
            maxLife: 0.52,
            size: randomRange(2, 5),
            color,
        });
    }
}

function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
        const particle = particles[i];
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vx *= 0.985;
        particle.vy *= 0.985;
        particle.life -= dt;
        if (particle.life <= 0) particles.splice(i, 1);
    }
}

function drawParticles() {
    for (const particle of particles) {
        ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
        ctx.fillStyle = particle.color;
        ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
    }
    ctx.globalAlpha = 1;
}

function startGame(mode) {
    sound.unlock();
    seed = (Date.now() ^ 0x9e3779b9) >>> 0;
    state.mode = mode;
    state.screen = mode === 'TUTORIAL' ? 'TUTORIAL' : 'PLAYING';
    state.previousScreen = state.screen;
    state.score = [0, 0];
    state.rally = 0;
    state.bestRally = 0;
    state.matchTime = 0;
    state.powerUp = null;
    state.powerUpTimer = randomRange(7, 10);
    state.toastTimer = 0;
    state.shake = 0;
    state.aiPace = 'Balanced';
    state.stats = { edgeHits: 0, pulseHits: 0, powerUps: 0 };
    state.tutorialStep = 0;
    state.tutorialComplete = false;
    state.tutorialFlags = { moved: false, dashed: false, pulsed: false, returned: false };
    particles = [];
    paddles.forEach((paddle) => paddle.reset());
    setScreens();
    startRound(mode === 'TUTORIAL' ? -1 : random() > 0.5 ? 1 : -1);
    updateTutorial();
    updateUI();
    announce(mode === 'TUTORIAL' ? 'Practice lab started.' : 'Match started. First to seven.');
}

function startRound(direction) {
    state.rally = 0;
    state.serveTimer = 1.35;
    state.nextServeDirection = direction;
    const tutorialY = paddles[0].y + paddles[0].height / 2;
    balls = [new Ball(direction, WIDTH / 2, state.mode === 'TUTORIAL' ? tutorialY : randomRange(170, HEIGHT - 170))];
    if (state.mode === 'TUTORIAL') balls[0].vy = 0;
}

function restartGame() {
    startGame(state.mode);
}

function returnToMenu() {
    state.screen = 'MENU';
    state.mode = '1P';
    state.score = [0, 0];
    state.rally = 0;
    state.serveTimer = 0;
    state.aiPace = 'Balanced';
    state.powerUp = null;
    paddles.forEach((paddle) => paddle.reset());
    balls = [new Ball(-1, WIDTH / 2, HEIGHT / 2)];
    balls[0].vx = 0;
    balls[0].vy = 0;
    keys.clear();
    setScreens();
    updateUI();
    draw();
    ui.start.querySelector('button').focus();
}

function togglePause() {
    if (state.screen === 'PLAYING' || state.screen === 'TUTORIAL') {
        state.previousScreen = state.screen;
        state.screen = 'PAUSED';
        setScreens();
        document.getElementById('resume-btn').focus();
        announce('Game paused.');
    } else if (state.screen === 'PAUSED') {
        state.screen = state.previousScreen;
        setScreens();
        canvas.focus?.();
        announce('Game resumed.');
    }
}

function gameOver(winner) {
    state.screen = 'GAMEOVER';
    ui.winner.textContent = `${winner === 0 ? 'PLAYER 1' : state.mode === '1P' ? 'AI' : 'PLAYER 2'} WINS`;
    ui.winner.style.color = winner === 0 ? getPalette().cyan : getPalette().pink;
    const saved = updateCareerStats(winner);
    ui.summary.innerHTML = `
        <div><b>${state.bestRally}</b><span>Best rally</span></div>
        <div><b>${state.stats.edgeHits}</b><span>Edge returns</span></div>
        <div><b>${saved.bestRally}</b><span>Career best</span></div>
    `;
    setScreens();
    sound.play(winner === 0 ? 660 : 220, 0.32, 'triangle', 0.05);
    announce(`${ui.winner.textContent}. Final score ${state.score[0]} to ${state.score[1]}.`);
    document.getElementById('rematch-btn').focus();
}

function updateCareerStats(winner) {
    let career = { matches: 0, wins: 0, bestRally: 0 };
    try {
        career = { ...career, ...JSON.parse(localStorage.getItem('neon-rally-career') || '{}') };
        career.matches += 1;
        if (winner === 0) career.wins += 1;
        career.bestRally = Math.max(career.bestRally, state.bestRally);
        localStorage.setItem('neon-rally-career', JSON.stringify(career));
    } catch {
        career.bestRally = Math.max(career.bestRally, state.bestRally);
    }
    return career;
}

function setScreens() {
    ui.start.hidden = state.screen !== 'MENU';
    ui.pause.hidden = state.screen !== 'PAUSED';
    ui.gameOver.hidden = state.screen !== 'GAMEOVER';
    ui.tutorial.hidden = state.screen !== 'TUTORIAL';
}

function showToast(message, duration = 1.25) {
    ui.toast.textContent = message;
    state.toastTimer = duration;
    ui.toast.classList.add('visible');
}

function announce(message) {
    ui.reader.textContent = '';
    requestAnimationFrame(() => {
        ui.reader.textContent = message;
    });
}

function armPlayerPulse(side) {
    if (state.screen !== 'PLAYING' && state.screen !== 'TUTORIAL') return;
    if (side === 1 && state.mode !== '2P') return;
    paddles[side].armPulse();
}

function update(dt) {
    visualTime += dt;

    if (state.toastTimer > 0) {
        state.toastTimer -= dt;
        if (state.toastTimer <= 0) ui.toast.classList.remove('visible');
    }

    if (state.screen !== 'PLAYING' && state.screen !== 'TUTORIAL') {
        updateParticles(dt);
        return;
    }

    state.matchTime += dt;
    paddles[0].update(dt);
    paddles[1].update(dt);

    if (state.serveTimer > 0) {
        state.serveTimer -= dt;
        if (state.serveTimer <= 0) {
            state.serveTimer = 0;
            sound.play(620, 0.08, 'square', 0.025);
            announce('Serve.');
        }
        updateParticles(dt);
        updateTutorial();
        updateUI();
        return;
    }

    for (let i = balls.length - 1; i >= 0; i -= 1) {
        const scorer = balls[i].update(dt);
        if (scorer !== null) {
            if (state.mode === 'TUTORIAL') {
                startRound(-1);
                break;
            }

            scorePoint(scorer, balls[i].y);
            balls.splice(i, 1);
            if (state.screen === 'GAMEOVER') break;
        }
    }

    if (state.screen !== 'GAMEOVER' && balls.length === 0) {
        startRound(state.nextServeDirection);
    }

    if (state.mode !== 'TUTORIAL') updatePowerUps(dt);
    updateParticles(dt);
    updateTutorial();
    state.shake = Math.max(0, state.shake - 24 * dt);
    updateUI();
}

function scorePoint(scorer, y) {
    state.score[scorer] += 1;
    state.nextServeDirection = scorer === 0 ? 1 : -1;
    state.shake = settings.reducedMotion ? 0 : 12;
    createBurst(scorer === 0 ? WIDTH : 0, y, '#ffffff', 28);
    showToast(`${scorer === 0 ? 'Player 1' : state.mode === '1P' ? 'AI' : 'Player 2'} scores`);
    sound.play(scorer === 0 ? 720 : 180, 0.18, 'sawtooth', 0.045);
    announce(`Score ${state.score[0]} to ${state.score[1]}.`);

    if (state.score[scorer] >= WIN_SCORE) {
        gameOver(scorer);
    }
}

function updatePowerUps(dt) {
    if (!state.powerUp) {
        state.powerUpTimer -= dt;
        if (state.powerUpTimer <= 0) {
            state.powerUp = new PowerUp();
            state.powerUpTimer = randomRange(9, 13);
            showToast(`${state.powerUp.type} pickup active`);
        }
        return;
    }

    state.powerUp.update(dt);
    for (const ball of balls) {
        const distance = Math.hypot(ball.x - state.powerUp.x, ball.y - state.powerUp.y);
        if (distance <= ball.radius + state.powerUp.radius) {
            collectPowerUp(state.powerUp, ball);
            state.powerUp = null;
            return;
        }
    }

    if (state.powerUp.life <= 0) state.powerUp = null;
}

function collectPowerUp(powerUp, ball) {
    const owner = ball.lastHitter ?? (ball.vx > 0 ? 0 : 1);
    const paddle = paddles[owner];
    state.stats.powerUps += 1;

    if (powerUp.type === 'WIDE') {
        paddle.makeWide();
        showToast(`${owner === 0 ? 'Player 1' : state.mode === '1P' ? 'AI' : 'Player 2'} gains Wide`);
    } else if (powerUp.type === 'CHARGE') {
        paddle.energy = Math.min(100, paddle.energy + 45);
        showToast('Focus +45');
    } else {
        const echo = new Ball(Math.sign(ball.vx), ball.x, ball.y);
        echo.vx = ball.vx * 0.9;
        echo.vy = -ball.vy || 260;
        echo.lastHitter = ball.lastHitter;
        balls.push(echo);
        showToast('Echo ball released');
    }

    createBurst(powerUp.x, powerUp.y, getPalette().gold, 24);
    sound.play(880, 0.12, 'triangle', 0.04);
}

const tutorialSteps = [
    {
        text: 'Move your paddle with W and S.',
        hint: 'Arrow keys also work in one-player modes.',
        complete: () => state.tutorialFlags.moved,
    },
    {
        text: 'Hold Left Shift while moving to dash.',
        hint: 'Dashing spends Focus, so use it for urgent saves.',
        complete: () => state.tutorialFlags.dashed,
    },
    {
        text: 'Press E to arm a Pulse shot.',
        hint: 'Pulse costs 60 Focus and empowers your next return.',
        complete: () => state.tutorialFlags.pulsed,
    },
    {
        text: 'Return the ball to complete the drill.',
        hint: 'Aim near a paddle edge for extra Focus.',
        complete: () => state.tutorialFlags.returned,
    },
];

function updateTutorial() {
    if (state.screen !== 'TUTORIAL' || state.tutorialComplete) return;

    const step = tutorialSteps[state.tutorialStep];
    if (step?.complete()) {
        state.tutorialStep += 1;
        if (state.tutorialStep >= tutorialSteps.length) {
            state.tutorialComplete = true;
            ui.tutorialProgress.textContent = 'Practice complete';
            ui.tutorialText.textContent = 'You are ready for a match.';
            ui.tutorialHint.textContent = 'Press R to repeat or Escape for the main menu.';
            showToast('Practice complete', 2);
            sound.play(760, 0.24, 'triangle', 0.05);
            return;
        }
    }

    const current = tutorialSteps[state.tutorialStep];
    ui.tutorialProgress.textContent = `Drill ${state.tutorialStep + 1} / ${tutorialSteps.length}`;
    ui.tutorialText.textContent = current.text;
    ui.tutorialHint.textContent = current.hint;
}

function updateUI() {
    ui.p1Score.textContent = state.score[0];
    ui.p2Score.textContent = state.score[1];
    ui.p1Focus.style.width = `${paddles[0].energy}%`;
    ui.p2Focus.style.width = `${paddles[1].energy}%`;
    ui.p1State.textContent = paddles[0].pulseArmed > 0
        ? `Pulse armed ${paddles[0].pulseArmed.toFixed(1)}s`
        : `Focus ${Math.round(paddles[0].energy)}`;
    ui.p2State.textContent = paddles[1].pulseArmed > 0
        ? `Pulse armed ${paddles[1].pulseArmed.toFixed(1)}s`
        : `Focus ${Math.round(paddles[1].energy)}`;
    ui.p2Name.textContent = state.mode === '2P' ? 'Player 2' : state.mode === 'TUTORIAL' ? 'Training AI' : 'Adaptive AI';
    ui.rally.textContent = state.serveTimer > 0
        ? `Serve ${Math.max(1, Math.ceil(state.serveTimer))}`
        : state.rally > 0 ? `Rally ${state.rally}` : 'Live';
    ui.ai.textContent = state.mode === '1P' ? `AI pace: ${state.aiPace}` : '';
}

function draw() {
    const palette = getPalette();
    const shakeX = state.shake > 0 && !settings.reducedMotion ? randomRange(-state.shake, state.shake) : 0;
    const shakeY = state.shake > 0 && !settings.reducedMotion ? randomRange(-state.shake, state.shake) : 0;

    ctx.save();
    ctx.fillStyle = palette.background;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    drawArena(palette);
    ctx.save();
    ctx.translate(shakeX, shakeY);

    if (state.powerUp) state.powerUp.draw();
    drawParticles();
    paddles.forEach((paddle) => paddle.draw());
    balls.forEach((ball) => ball.draw());

    if (state.serveTimer > 0 && (state.screen === 'PLAYING' || state.screen === 'TUTORIAL')) {
        drawServeCountdown(palette);
    }
    ctx.restore();
    drawCanvasHud(palette);
    ctx.restore();
}

function drawCanvasHud(palette) {
    const drawPanel = (x, width) => {
        ctx.fillStyle = 'rgba(3, 9, 17, 0.82)';
        ctx.strokeStyle = settings.highContrast ? '#ffffff' : 'rgba(151, 220, 255, 0.28)';
        ctx.lineWidth = 1;
        roundedRect(ctx, x, 16, width, 67, 11);
        ctx.fill();
        ctx.stroke();
    };

    drawPanel(18, 246);
    drawPanel(350, 260);
    drawPanel(696, 246);

    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.font = '800 11px Inter, sans-serif';
    ctx.fillStyle = settings.highContrast ? '#ffffff' : '#a9b8c9';
    ctx.textAlign = 'left';
    ctx.fillText('PLAYER 1', 32, 34);
    ctx.textAlign = 'right';
    ctx.fillText(state.mode === '2P' ? 'PLAYER 2' : state.mode === 'TUTORIAL' ? 'TRAINING AI' : 'ADAPTIVE AI', 928, 34);

    ctx.font = '900 28px Inter, sans-serif';
    ctx.fillStyle = palette.cyan;
    ctx.textAlign = 'right';
    ctx.fillText(String(state.score[0]), 248, 38);
    ctx.fillStyle = palette.pink;
    ctx.textAlign = 'left';
    ctx.fillText(String(state.score[1]), 712, 38);

    drawCanvasMeter(32, 53, 216, paddles[0].energy, palette.cyan);
    drawCanvasMeter(712, 53, 216, paddles[1].energy, palette.pink);

    ctx.font = '800 9px Inter, sans-serif';
    ctx.fillStyle = paddles[0].pulseArmed > 0 ? palette.gold : '#a9b8c9';
    ctx.textAlign = 'left';
    ctx.fillText(paddles[0].pulseArmed > 0 ? 'PULSE ARMED' : `FOCUS ${Math.round(paddles[0].energy)}`, 32, 72);
    ctx.fillStyle = paddles[1].pulseArmed > 0 ? palette.gold : '#a9b8c9';
    ctx.textAlign = 'right';
    ctx.fillText(paddles[1].pulseArmed > 0 ? 'PULSE ARMED' : `FOCUS ${Math.round(paddles[1].energy)}`, 928, 72);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#a9b8c9';
    ctx.font = '800 9px Inter, sans-serif';
    ctx.fillText('FIRST TO 7', WIDTH / 2, 31);
    ctx.fillStyle = palette.gold;
    ctx.font = '900 16px Inter, sans-serif';
    const rallyText = state.serveTimer > 0
        ? `SERVE ${Math.max(1, Math.ceil(state.serveTimer))}`
        : state.rally > 0 ? `RALLY ${state.rally}` : 'LIVE';
    ctx.fillText(rallyText, WIDTH / 2, 51);
    ctx.fillStyle = '#a9b8c9';
    ctx.font = '800 9px Inter, sans-serif';
    ctx.fillText(state.mode === '1P' ? `AI PACE: ${state.aiPace.toUpperCase()}` : 'FOCUS FUELS DASH + PULSE', WIDTH / 2, 70);
    ctx.restore();
}

function drawCanvasMeter(x, y, width, value, color) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundedRect(ctx, x, y, width, 6, 3);
    ctx.fill();
    ctx.fillStyle = color;
    roundedRect(ctx, x, y, width * clamp(value / 100, 0, 1), 6, 3);
    ctx.fill();
}

function drawArena(palette) {
    const glow = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 40, WIDTH / 2, HEIGHT / 2, 520);
    glow.addColorStop(0, 'rgba(26, 70, 104, 0.2)');
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.save();
    ctx.strokeStyle = palette.grid;
    ctx.lineWidth = 1;
    for (let x = 0; x <= WIDTH; x += 60) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, HEIGHT);
        ctx.stroke();
    }
    for (let y = 0; y <= HEIGHT; y += 60) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(WIDTH, y);
        ctx.stroke();
    }

    ctx.strokeStyle = settings.highContrast ? '#ffffff' : 'rgba(150, 219, 255, 0.22)';
    ctx.setLineDash([8, 14]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2, 0);
    ctx.lineTo(WIDTH / 2, HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);

    const leftGoal = ctx.createLinearGradient(0, 0, 70, 0);
    leftGoal.addColorStop(0, 'rgba(255, 79, 216, 0.2)');
    leftGoal.addColorStop(1, 'rgba(255, 79, 216, 0)');
    ctx.fillStyle = leftGoal;
    ctx.fillRect(0, 0, 72, HEIGHT);

    const rightGoal = ctx.createLinearGradient(WIDTH, 0, WIDTH - 70, 0);
    rightGoal.addColorStop(0, 'rgba(67, 232, 255, 0.2)');
    rightGoal.addColorStop(1, 'rgba(67, 232, 255, 0)');
    ctx.fillStyle = rightGoal;
    ctx.fillRect(WIDTH - 72, 0, 72, HEIGHT);
    ctx.restore();
}

function drawServeCountdown(palette) {
    const number = Math.max(1, Math.ceil(state.serveTimer));
    ctx.save();
    ctx.fillStyle = 'rgba(2, 7, 13, 0.68)';
    ctx.beginPath();
    ctx.arc(WIDTH / 2, HEIGHT / 2, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = palette.gold;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 48px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(number, WIDTH / 2, HEIGHT / 2 + 1);
    ctx.restore();
}

function stepFixed(seconds) {
    const steps = Math.max(1, Math.ceil(seconds / FIXED_STEP));
    const dt = seconds / steps;
    for (let i = 0; i < steps; i += 1) update(dt);
    draw();
}

function frame(timestamp) {
    if (!lastFrame) lastFrame = timestamp;
    const elapsed = Math.min(0.05, (timestamp - lastFrame) / 1000);
    lastFrame = timestamp;
    accumulator += elapsed;

    while (accumulator >= FIXED_STEP) {
        update(FIXED_STEP);
        accumulator -= FIXED_STEP;
    }
    draw();
    requestAnimationFrame(frame);
}

window.advanceTime = (milliseconds) => {
    stepFixed(Math.max(0, milliseconds) / 1000);
    return Promise.resolve();
};

window.render_game_to_text = () => JSON.stringify({
    coordinates: 'Origin is top-left; +x moves right; +y moves down; field is 960x600.',
    screen: state.screen,
    mode: state.mode,
    score: { player1: state.score[0], player2: state.score[1], target: WIN_SCORE },
    rally: state.rally,
    bestRally: state.bestRally,
    serveInSeconds: Number(state.serveTimer.toFixed(2)),
    players: paddles.map((paddle) => ({
        side: paddle.side === 0 ? 'left' : 'right',
        x: Math.round(paddle.x),
        y: Math.round(paddle.y),
        height: Math.round(paddle.height),
        velocityY: Math.round(paddle.velocity),
        focus: Math.round(paddle.energy),
        pulseArmedSeconds: Number(paddle.pulseArmed.toFixed(2)),
    })),
    balls: balls.map((ball) => ({
        x: Math.round(ball.x),
        y: Math.round(ball.y),
        velocityX: Math.round(ball.vx),
        velocityY: Math.round(ball.vy),
        pulse: ball.isPulse,
    })),
    powerUp: state.powerUp
        ? { type: state.powerUp.type, x: Math.round(state.powerUp.x), y: Math.round(state.powerUp.y), life: Number(state.powerUp.life.toFixed(1)) }
        : null,
    aiPace: state.mode === '1P' ? state.aiPace : null,
    tutorial: state.mode === 'TUTORIAL'
        ? { step: state.tutorialStep + 1, complete: state.tutorialComplete }
        : null,
    settings,
});

window.__neonRallyDebug = {
    start: startGame,
    score: (side) => scorePoint(side === 1 ? 1 : 0, HEIGHT / 2),
    spawnPowerUp: (type = 'CHARGE') => {
        state.powerUp = new PowerUp();
        state.powerUp.type = type;
        return state.powerUp;
    },
    grantPowerUp: (type = 'CHARGE', side = 0) => {
        collectPowerUp({ type, x: WIDTH / 2, y: HEIGHT / 2 }, { lastHitter: side, vx: side === 0 ? 1 : -1 });
        return window.render_game_to_text();
    },
};

window.addEventListener('keydown', (event) => {
    const gameKeys = [
        'KeyW', 'KeyS', 'ArrowUp', 'ArrowDown', 'ShiftLeft', 'ShiftRight',
        'KeyE', 'Enter', 'Space', 'KeyP', 'Escape', 'KeyR', 'KeyF', 'KeyA', 'KeyB',
    ];
    if (gameKeys.includes(event.code)) event.preventDefault();
    keys.add(event.code);

    if (event.repeat) return;
    if (event.code === 'KeyF') toggleFullscreen();
    if (event.code === 'KeyR' && state.screen !== 'MENU') restartGame();

    if (event.code === 'Escape' && state.screen === 'TUTORIAL') {
        returnToMenu();
    } else if ((event.code === 'KeyP' || event.code === 'Escape') && state.screen !== 'MENU' && state.screen !== 'GAMEOVER') {
        togglePause();
    }

    if (event.code === 'KeyE' || event.code === 'KeyA' || (event.code === 'Space' && state.mode !== '2P')) {
        armPlayerPulse(0);
    }
    if (event.code === 'Enter' && state.mode === '2P') armPlayerPulse(1);
});

window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
});

window.addEventListener('blur', () => {
    keys.clear();
    if (state.screen === 'PLAYING' || state.screen === 'TUTORIAL') togglePause();
});

async function toggleFullscreen() {
    try {
        if (!document.fullscreenElement) {
            await document.getElementById('game-container').requestFullscreen();
        } else {
            await document.exitFullscreen();
        }
    } catch {
        showToast('Fullscreen unavailable');
    }
}

document.getElementById('one-player-btn').addEventListener('click', () => startGame('1P'));
document.getElementById('two-player-btn').addEventListener('click', () => startGame('2P'));
document.getElementById('tutorial-btn').addEventListener('click', () => startGame('TUTORIAL'));
document.getElementById('resume-btn').addEventListener('click', togglePause);
document.getElementById('rematch-btn').addEventListener('click', restartGame);
document.querySelectorAll('.menu-btn').forEach((button) => button.addEventListener('click', returnToMenu));

ui.motionToggle.addEventListener('click', () => {
    settings.reducedMotion = !settings.reducedMotion;
    applySettings();
    saveSettings();
});

ui.contrastToggle.addEventListener('click', () => {
    settings.highContrast = !settings.highContrast;
    applySettings();
    saveSettings();
    draw();
});

ui.soundToggle.addEventListener('click', () => {
    settings.sound = !settings.sound;
    applySettings();
    saveSettings();
    if (settings.sound) sound.play(520, 0.08, 'triangle');
});

setScreens();
updateUI();
draw();
if (!hadExternalTimeController) requestAnimationFrame(frame);

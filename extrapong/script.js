const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game Constants
const SCREEN_WIDTH = 800;
const SCREEN_HEIGHT = 600;
const WIN_SCORE = 10;

// Set canvas size
canvas.width = SCREEN_WIDTH;
canvas.height = SCREEN_HEIGHT;

// Game State
let gameState = 'MENU'; // MENU, PLAYING, GAMEOVER, TUTORIAL
let gameMode = '2P'; // 1P, 2P, TUTORIAL
let lastTime = 0;
let shake = 0;

// Input Handling
const keys = {};

window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Space') {
        if (gameState === 'GAMEOVER') {
            restartGame();
        } else if (gameState === 'PLAYING' || gameState === 'TUTORIAL') {
            // Optional: Pause
        }
    }
    if (e.code === 'KeyP' && (gameState === 'PLAYING' || gameState === 'TUTORIAL')) {
        // Pause logic could go here
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// UI Functions
function selectMode(mode) {
    gameMode = mode;
    if (mode === 'TUTORIAL') {
        startTutorial();
    } else {
        startGame();
    }
}

function returnToMenu() {
    gameState = 'MENU';
    document.getElementById('game-over-screen').style.display = 'none';
    document.getElementById('start-screen').style.display = 'block';
    document.getElementById('tutorial-overlay').style.display = 'none';
}

function restartGame() {
    if (gameMode === 'TUTORIAL') {
        startTutorial();
    } else {
        startGame();
    }
}

// Particles
class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 3 + 1;
        this.speedX = (Math.random() * 4 - 2);
        this.speedY = (Math.random() * 4 - 2);
        this.life = 1.0;
        this.decay = Math.random() * 0.03 + 0.01;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= this.decay;
    }

    draw(ctx) {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.globalAlpha = 1.0;
    }
}

let particles = [];

function createExplosion(x, y, color) {
    for (let i = 0; i < 15; i++) {
        particles.push(new Particle(x, y, color));
    }
}

// PowerUps
class PowerUp {
    constructor(fixedType = null) {
        this.x = Math.random() * (SCREEN_WIDTH - 200) + 100;
        this.y = Math.random() * (SCREEN_HEIGHT - 100) + 50;
        this.size = 20;
        this.type = fixedType || (Math.random() > 0.5 ? 'MULTIBALL' : 'BIGPADDLE');
        this.color = this.type === 'MULTIBALL' ? '#ffff00' : '#00ff00';
        this.life = 5000; // 5 seconds to pick up
    }

    update(deltaTime) {
        this.life -= deltaTime;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        
        ctx.beginPath();
        if (this.type === 'MULTIBALL') {
            ctx.arc(this.x + 10, this.y + 10, 8, 0, Math.PI * 2);
        } else {
            ctx.fillRect(this.x, this.y, this.size, this.size);
        }
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}

let powerUps = [];

// Entities
class Paddle {
    constructor(x, y, isPlayerOne) {
        this.x = x;
        this.y = y;
        this.width = 10;
        this.baseHeight = 100;
        this.height = this.baseHeight;
        this.normalSpeed = 0.6;
        this.dashSpeed = 1.2;
        this.currentSpeed = this.normalSpeed;
        this.score = 0;
        this.isPlayerOne = isPlayerOne;
        this.dy = 0;
        this.color = isPlayerOne ? '#00f3ff' : '#ff00ff';
        this.bigPaddleTimer = 0;
        
        // AI State
        this.aiReactionTimer = 0;
        this.aiTargetY = y;
    }

    update(deltaTime, ball) {
        // Powerup Timer
        if (this.bigPaddleTimer > 0) {
            this.bigPaddleTimer -= deltaTime;
            if (this.bigPaddleTimer <= 0) {
                this.height = this.baseHeight;
            }
        }

        this.dy = 0;
        this.currentSpeed = this.normalSpeed;

        if (this.isPlayerOne) {
            // Player 1 Control
            if (keys['ShiftLeft']) this.currentSpeed = this.dashSpeed;
            if (keys['KeyW']) this.dy = -this.currentSpeed;
            if (keys['KeyS']) this.dy = this.currentSpeed;
        } else {
            // Player 2 Control (Human or AI)
            if (gameMode === '1P') {
                this.updateAI(deltaTime, ball);
            } else {
                if (keys['ShiftRight']) this.currentSpeed = this.dashSpeed;
                if (keys['ArrowUp']) this.dy = -this.currentSpeed;
                if (keys['ArrowDown']) this.dy = this.currentSpeed;
            }
        }

        this.y += this.dy * deltaTime;

        // Wall collision
        if (this.y < 0) this.y = 0;
        if (this.y + this.height > SCREEN_HEIGHT) this.y = SCREEN_HEIGHT - this.height;
    }

    updateAI(deltaTime, ball) {
        // Simple AI
        // Only react if ball is moving towards AI
        if (ball && ball.dx > 0) {
            // Add reaction delay
            this.aiReactionTimer += deltaTime;
            if (this.aiReactionTimer > 50) { // Update target every 50ms
                this.aiTargetY = ball.y - this.height / 2;
                this.aiReactionTimer = 0;
            }

            const diff = this.aiTargetY - this.y;
            if (Math.abs(diff) > 10) {
                this.dy = Math.sign(diff) * this.currentSpeed;
                // Dash if far away
                if (Math.abs(diff) > 150) {
                    this.currentSpeed = this.dashSpeed;
                }
            }
        } else {
            // Return to center
            const diff = (SCREEN_HEIGHT / 2 - this.height / 2) - this.y;
            if (Math.abs(diff) > 10) {
                this.dy = Math.sign(diff) * this.currentSpeed * 0.5;
            }
        }
    }

    activateBigPaddle() {
        this.height = 150;
        this.bigPaddleTimer = 10000; // 10 seconds
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.shadowBlur = 20;
        ctx.shadowColor = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.shadowBlur = 0;
    }
}

class Ball {
    constructor() {
        this.size = 10;
        this.reset();
        this.lastHitter = null; // 'p1' or 'p2'
    }

    reset() {
        this.x = SCREEN_WIDTH / 2;
        this.y = SCREEN_HEIGHT / 2;
        this.speed = 0.5;
        // Random start direction
        const angle = (Math.random() * Math.PI / 4) - (Math.PI / 8); 
        const direction = Math.random() > 0.5 ? 1 : -1;
        this.dx = Math.cos(angle) * this.speed * direction;
        this.dy = Math.sin(angle) * this.speed;
        this.lastHitter = null;
    }

    update(deltaTime, p1, p2) {
        this.x += this.dx * deltaTime;
        this.y += this.dy * deltaTime;

        // Wall collision (Top/Bottom)
        if (this.y < 0 || this.y + this.size > SCREEN_HEIGHT) {
            this.dy *= -1;
            if (this.y < 0) this.y = 0;
            if (this.y + this.size > SCREEN_HEIGHT) this.y = SCREEN_HEIGHT - this.size;
        }

        // Paddle collision
        const p1Col = this.x < p1.x + p1.width && this.x + this.size > p1.x && this.y < p1.y + p1.height && this.y + this.size > p1.y;
        const p2Col = this.x < p2.x + p2.width && this.x + this.size > p2.x && this.y < p2.y + p2.height && this.y + this.size > p2.y;

        if (p1Col) {
            this.dx = Math.abs(this.dx);
            this.increaseSpeed();
            this.x = p1.x + p1.width;
            this.dy += p1.dy * 0.3;
            this.lastHitter = p1;
            createExplosion(this.x, this.y + this.size/2, p1.color);
            shake = 5;
            return 'HIT_P1';
        }
        if (p2Col) {
            this.dx = -Math.abs(this.dx);
            this.increaseSpeed();
            this.x = p2.x - this.size;
            this.dy += p2.dy * 0.3;
            this.lastHitter = p2;
            createExplosion(this.x + this.size, this.y + this.size/2, p2.color);
            shake = 5;
            return 'HIT_P2';
        }

        // Scoring (Return status instead of handling it directly)
        if (this.x < 0) return 'SCORE_P2';
        if (this.x > SCREEN_WIDTH) return 'SCORE_P1';
        
        return null;
    }

    increaseSpeed() {
        this.dx *= 1.05;
        this.dy *= 1.05;
        const maxSpeed = 1.8;
        if (Math.abs(this.dx) > maxSpeed) this.dx = Math.sign(this.dx) * maxSpeed;
        if (Math.abs(this.dy) > maxSpeed) this.dy = Math.sign(this.dy) * maxSpeed;
    }

    draw(ctx) {
        ctx.fillStyle = '#fff';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#fff';
        ctx.fillRect(this.x, this.y, this.size, this.size);
        ctx.shadowBlur = 0;
    }
}

const player1 = new Paddle(20, SCREEN_HEIGHT / 2 - 50, true);
const player2 = new Paddle(SCREEN_WIDTH - 30, SCREEN_HEIGHT / 2 - 50, false);
let balls = [new Ball()];

// Tutorial State
let tutorialStep = 0;
let tutorialTimer = 0;
const tutorialSteps = [
    { text: "Welcome! Press W and S to move your paddle.", check: () => keys['KeyW'] || keys['KeyS'] },
    { text: "Good! Now hit the ball.", check: (event) => event === 'HIT_P1' },
    { text: "Hold LEFT SHIFT to Dash for speed!", check: () => keys['ShiftLeft'] },
    { text: "Collect the Power-up!", check: (event) => event === 'POWERUP' },
    { text: "Great job! You are ready.", check: () => false, timer: 3000 }
];

function updateScore() {
    document.getElementById('player1-score').innerText = player1.score;
    document.getElementById('player2-score').innerText = player2.score;
}

function startGame() {
    gameState = 'PLAYING';
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('game-over-screen').style.display = 'none';
    document.getElementById('tutorial-overlay').style.display = 'none';
    player1.score = 0;
    player2.score = 0;
    updateScore();
    balls = [new Ball()];
    particles = [];
    powerUps = [];
    shake = 0;
}

function startTutorial() {
    gameState = 'TUTORIAL';
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('game-over-screen').style.display = 'none';
    document.getElementById('tutorial-overlay').style.display = 'block';
    player1.score = 0;
    player2.score = 0;
    updateScore();
    balls = [new Ball()];
    balls[0].dx = 0; // Stop ball initially
    balls[0].dy = 0;
    particles = [];
    powerUps = [];
    shake = 0;
    tutorialStep = 0;
    tutorialTimer = 0;
    updateTutorialUI();
}

function updateTutorialUI() {
    if (tutorialStep < tutorialSteps.length) {
        document.getElementById('tutorial-text').innerText = tutorialSteps[tutorialStep].text;
    }
}

function gameOver() {
    gameState = 'GAMEOVER';
    const winner = player1.score >= WIN_SCORE ? 'PLAYER 1' : 'PLAYER 2';
    const color = player1.score >= WIN_SCORE ? '#00f3ff' : '#ff00ff';
    const goScreen = document.getElementById('game-over-screen');
    const winnerText = document.getElementById('winner-text');
    
    goScreen.style.display = 'block';
    goScreen.style.borderColor = color;
    goScreen.style.boxShadow = `0 0 30px ${color}`;
    winnerText.innerText = `${winner} WINS`;
    winnerText.style.color = color;
    winnerText.style.textShadow = `0 0 20px ${color}`;
}

function spawnPowerUp() {
    if (Math.random() < 0.003 && powerUps.length < 3) {
        powerUps.push(new PowerUp());
    }
}

function update(deltaTime) {
    if (gameState !== 'PLAYING' && gameState !== 'TUTORIAL') return;
    
    // Screen Shake Decay
    if (shake > 0) shake -= deltaTime * 0.1;
    if (shake < 0) shake = 0;

    // Tutorial Logic
    if (gameState === 'TUTORIAL') {
        const currentObj = tutorialSteps[tutorialStep];
        
        // Special ball behavior for tutorial
        if (tutorialStep === 1 && balls[0].dx === 0) {
            balls[0].reset(); // Start ball moving for hit step
            balls[0].dx = -Math.abs(balls[0].dx); // Ensure it comes to player
        }
        if (tutorialStep === 3 && powerUps.length === 0) {
            powerUps.push(new PowerUp('BIGPADDLE'));
            powerUps[0].x = 200; // Place near player
            powerUps[0].y = 300;
        }

        // Check completion
        if (currentObj.check()) {
            tutorialStep++;
            if (tutorialStep >= tutorialSteps.length) {
                returnToMenu();
            } else {
                updateTutorialUI();
            }
        } else if (currentObj.timer) {
            tutorialTimer += deltaTime;
            if (tutorialTimer > currentObj.timer) {
                tutorialStep++;
                if (tutorialStep >= tutorialSteps.length) {
                    returnToMenu();
                } else {
                    updateTutorialUI();
                }
            }
        }
    }

    // Entity Updates
    player1.update(deltaTime, balls[0]); // Pass ball for potential AI (though P1 is human)
    player2.update(deltaTime, balls[0]);

    // Update Balls
    for (let i = balls.length - 1; i >= 0; i--) {
        const result = balls[i].update(deltaTime, player1, player2);
        
        // Tutorial Check
        if (gameState === 'TUTORIAL' && tutorialStep === 1 && result === 'HIT_P1') {
             tutorialStep++;
             updateTutorialUI();
        }

        if (result === 'SCORE_P2') {
            if (gameState !== 'TUTORIAL') player2.score++;
            updateScore();
            createExplosion(balls[i].x, balls[i].y, '#fff');
            balls.splice(i, 1);
            shake = 10;
        } else if (result === 'SCORE_P1') {
            if (gameState !== 'TUTORIAL') player1.score++;
            updateScore();
            createExplosion(balls[i].x, balls[i].y, '#fff');
            balls.splice(i, 1);
            shake = 10;
        }
    }

    // Check Win
    if (gameState === 'PLAYING' && (player1.score >= WIN_SCORE || player2.score >= WIN_SCORE)) {
        gameOver();
    }

    // Reset if no balls (and not game over)
    if (balls.length === 0 && (gameState === 'PLAYING' || gameState === 'TUTORIAL')) {
        balls.push(new Ball());
        if (gameState === 'TUTORIAL' && tutorialStep === 1) {
             balls[0].dx = -Math.abs(balls[0].dx); // Ensure it comes to player
        }
    }

    // PowerUps
    if (gameState === 'PLAYING') spawnPowerUp();
    
    for (let i = powerUps.length - 1; i >= 0; i--) {
        powerUps[i].update(deltaTime);
        
        // Collision with balls
        let collected = false;
        for (let ball of balls) {
            // Simple Circle-Rect or Rect-Rect collision
            if (ball.x < powerUps[i].x + powerUps[i].size &&
                ball.x + ball.size > powerUps[i].x &&
                ball.y < powerUps[i].y + powerUps[i].size &&
                ball.y + ball.size > powerUps[i].y) {
                
                // Activate
                if (powerUps[i].type === 'MULTIBALL') {
                    let newBall = new Ball();
                    newBall.x = ball.x;
                    newBall.y = ball.y;
                    newBall.dx = -ball.dx;
                    newBall.dy = -ball.dy;
                    balls.push(newBall);
                } else if (powerUps[i].type === 'BIGPADDLE') {
                    if (ball.lastHitter) {
                        ball.lastHitter.activateBigPaddle();
                    }
                }
                collected = true;
                
                if (gameState === 'TUTORIAL' && tutorialStep === 3) {
                    tutorialStep++;
                    updateTutorialUI();
                }
                break;
            }
        }

        if (collected || powerUps[i].life <= 0) {
            powerUps.splice(i, 1);
        }
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update();
        if (particles[i].life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function draw() {
    // Clear screen
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    if (shake > 0) {
        const dx = (Math.random() - 0.5) * shake;
        const dy = (Math.random() - 0.5) * shake;
        ctx.translate(dx, dy);
    }

    // Draw Net
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw entities
    powerUps.forEach(p => p.draw(ctx));
    particles.forEach(p => p.draw(ctx));
    player1.draw(ctx);
    player2.draw(ctx);
    balls.forEach(b => b.draw(ctx));

    ctx.restore();
}

function gameLoop(timestamp) {
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    update(deltaTime);
    draw();

    requestAnimationFrame(gameLoop);
}

// Start Loop
requestAnimationFrame(gameLoop);

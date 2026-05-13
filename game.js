(() => {
    // --- Config ---
    const GRID_SIZE = 20;
    const BASE_INTERVAL = 150; // ms, slowest speed
    const MIN_INTERVAL = 60;   // ms, fastest speed
    const SPEED_STEP = 50;     // score per speed level
    const MAX_SPEED_LEVEL = 5;
    const SCORE_PER_FOOD = 10;

    // --- DOM ---
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const scoreEl = document.getElementById('score');
    const speedEl = document.getElementById('speed');
    const bestEl = document.getElementById('best');

    // --- State ---
    let snake, food, direction, nextDirection, score, speedLevel, state;
    let accumulator, lastTime, cellSize;

    const DIR = { UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3 };
    const OPP = { 0: 2, 1: 3, 2: 0, 3: 1 }; // opposite directions

    // --- Init ---
    function resizeCanvas() {
        const maxPx = Math.max(320, Math.min(window.innerWidth - 32, window.innerHeight - 80, 560));
        const px = Math.floor(maxPx / GRID_SIZE) * GRID_SIZE;
        canvas.width = px;
        canvas.height = px;
        cellSize = px / GRID_SIZE;
    }

    function init() {
        const mid = Math.floor(GRID_SIZE / 2);
        snake = [
            { x: mid, y: mid },
            { x: mid - 1, y: mid },
            { x: mid - 2, y: mid },
        ];
        direction = DIR.RIGHT;
        nextDirection = DIR.RIGHT;
        score = 0;
        speedLevel = 1;
        state = 'IDLE';
        accumulator = 0;
        lastTime = 0;
        spawnFood();
        updateHUD();
    }

    function spawnFood() {
        const occupied = new Set(snake.map(s => `${s.x},${s.y}`));
        let pos;
        do {
            pos = {
                x: Math.floor(Math.random() * GRID_SIZE),
                y: Math.floor(Math.random() * GRID_SIZE),
            };
        } while (occupied.has(`${pos.x},${pos.y}`));
        food = pos;
    }

    function updateHUD() {
        scoreEl.textContent = score;
        speedEl.textContent = speedLevel;
        bestEl.textContent = getBest();
    }

    // --- High Score ---
    function getBest() {
        try { return parseInt(localStorage.getItem('snake_best') || '0', 10); }
        catch { return 0; }
    }

    function saveBest() {
        try {
            const best = getBest();
            if (score > best) localStorage.setItem('snake_best', score);
        } catch {}
    }

    // --- Speed ---
    function getInterval() {
        const step = (BASE_INTERVAL - MIN_INTERVAL) / (MAX_SPEED_LEVEL - 1);
        return BASE_INTERVAL - (speedLevel - 1) * step;
    }

    // --- Input ---
    function setDirection(d) {
        if (state === 'PLAYING' && d !== OPP[nextDirection]) {
            nextDirection = d;
        }
    }

    document.addEventListener('keydown', (e) => {
        const key = e.key;
        if (key === 'ArrowUp' || key === 'w' || key === 'W') { setDirection(DIR.UP); e.preventDefault(); }
        else if (key === 'ArrowRight' || key === 'd' || key === 'D') { setDirection(DIR.RIGHT); e.preventDefault(); }
        else if (key === 'ArrowDown' || key === 's' || key === 'S') { setDirection(DIR.DOWN); e.preventDefault(); }
        else if (key === 'ArrowLeft' || key === 'a' || key === 'A') { setDirection(DIR.LEFT); e.preventDefault(); }
        else if (key === ' ') {
            e.preventDefault();
            if (state === 'IDLE' || state === 'GAMEOVER') startGame();
        }
        else if (key === 'p' || key === 'P' || key === 'Escape') {
            if (state === 'PLAYING') state = 'PAUSED';
            else if (state === 'PAUSED') state = 'PLAYING';
        }
    });

    // Touch support
    let touchStart = null;
    canvas.addEventListener('touchstart', (e) => {
        const t = e.touches[0];
        touchStart = { x: t.clientX, y: t.clientY };
        e.preventDefault();
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        if (!touchStart) return;
        const t = e.changedTouches[0];
        const dx = t.clientX - touchStart.x;
        const dy = t.clientY - touchStart.y;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (Math.max(absDx, absDy) < 20) {
            // Tap — treat as start / restart
            if (state === 'IDLE' || state === 'GAMEOVER') startGame();
            touchStart = null;
            return;
        }

        if (absDx > absDy) {
            setDirection(dx > 0 ? DIR.RIGHT : DIR.LEFT);
        } else {
            setDirection(dy > 0 ? DIR.DOWN : DIR.UP);
        }
        touchStart = null;
        e.preventDefault();
    }, { passive: false });

    // --- Game Logic ---
    function startGame() {
        init();
        state = 'PLAYING';
    }

    function update() {
        direction = nextDirection;
        const head = snake[0];
        const deltas = [
            { x: 0, y: -1 }, // UP
            { x: 1, y: 0 },  // RIGHT
            { x: 0, y: 1 },  // DOWN
            { x: -1, y: 0 }, // LEFT
        ];
        const newHead = {
            x: head.x + deltas[direction].x,
            y: head.y + deltas[direction].y,
        };

        // Wall collision
        if (newHead.x < 0 || newHead.x >= GRID_SIZE ||
            newHead.y < 0 || newHead.y >= GRID_SIZE) {
            gameOver();
            return;
        }

        // Self collision
        for (let i = 0; i < snake.length; i++) {
            if (snake[i].x === newHead.x && snake[i].y === newHead.y) {
                gameOver();
                return;
            }
        }

        snake.unshift(newHead);

        // Eat food?
        if (newHead.x === food.x && newHead.y === food.y) {
            score += SCORE_PER_FOOD;
            speedLevel = Math.min(MAX_SPEED_LEVEL, 1 + Math.floor(score / SPEED_STEP));
            spawnFood();
            updateHUD();
        } else {
            snake.pop();
        }
    }

    function gameOver() {
        state = 'GAMEOVER';
        saveBest();
        updateHUD();
    }

    // --- Rendering ---
    let pulsePhase = 0;

    function draw() {
        const W = canvas.width;
        const H = canvas.height;
        pulsePhase += state === 'PLAYING' ? 0.06 : 0;

        // Background
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, W, H);

        // Grid
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= GRID_SIZE; i++) {
            const p = i * cellSize;
            ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, H); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(W, p); ctx.stroke();
        }

        // Food — pulsing circle
        const fx = food.x * cellSize + cellSize / 2;
        const fy = food.y * cellSize + cellSize / 2;
        const pulse = 0.8 + 0.2 * Math.sin(pulsePhase);
        const radius = (cellSize / 2 - 2) * pulse;

        ctx.beginPath();
        ctx.arc(fx, fy, radius, 0, Math.PI * 2);
        ctx.fillStyle = '#e63946';
        ctx.shadowColor = '#e63946';
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Snake
        const len = snake.length;
        for (let i = len - 1; i >= 0; i--) {
            const s = snake[i];
            const t = i / Math.max(len - 1, 1); // 0 = head, 1 = tail
            const r = lerp(78, 45, t);
            const g = lerp(204, 106, t);
            const b = lerp(163, 79, t);

            const pad = i === 0 ? 1 : 2;
            const x = s.x * cellSize + pad;
            const y = s.y * cellSize + pad;
            const size = cellSize - pad * 2;

            ctx.fillStyle = `rgb(${r},${g},${b})`;
            roundRect(ctx, x, y, size, size, 4);
            ctx.fill();
        }

        // Snake eyes
        if (snake.length > 0) {
            const h = snake[0];
            const cx = h.x * cellSize + cellSize / 2;
            const cy = h.y * cellSize + cellSize / 2;
            const ed = cellSize * 0.18;
            let e1, e2;
            if (direction === DIR.UP) {
                e1 = { x: cx - ed, y: cy - ed }; e2 = { x: cx + ed, y: cy - ed };
            } else if (direction === DIR.DOWN) {
                e1 = { x: cx - ed, y: cy + ed }; e2 = { x: cx + ed, y: cy + ed };
            } else if (direction === DIR.LEFT) {
                e1 = { x: cx - ed, y: cy - ed }; e2 = { x: cx - ed, y: cy + ed };
            } else {
                e1 = { x: cx + ed, y: cy - ed }; e2 = { x: cx + ed, y: cy + ed };
            }
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(e1.x, e1.y, 2.5, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(e2.x, e2.y, 2.5, 0, Math.PI * 2); ctx.fill();
        }

        // Overlays
        if (state === 'IDLE') drawOverlay('贪吃蛇', '按空格或点击开始');
        else if (state === 'PAUSED') drawOverlay('暂停', '按 P 或 Esc 继续');
        else if (state === 'GAMEOVER') drawOverlay('游戏结束', `得分: ${score}\n按空格或点击重新开始`);
    }

    function drawOverlay(title, sub) {
        const W = canvas.width;
        const H = canvas.height;

        ctx.fillStyle = 'rgba(15,15,26,0.75)';
        ctx.fillRect(0, 0, W, H);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        ctx.fillStyle = '#4ecca3';
        ctx.font = `bold ${W * 0.07}px 'Segoe UI', sans-serif`;
        ctx.fillText(title, W / 2, H / 2 - W * 0.06);

        ctx.fillStyle = '#ccc';
        const lines = sub.split('\n');
        ctx.font = `${W * 0.032}px 'Segoe UI', sans-serif`;
        lines.forEach((line, i) => {
            ctx.fillText(line, W / 2, H / 2 + W * 0.04 + i * W * 0.05);
        });
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    function lerp(a, b, t) {
        return Math.round(a + (b - a) * t);
    }

    // --- Main Loop ---
    function loop(timestamp) {
        if (!lastTime) lastTime = timestamp;
        const dt = Math.min(timestamp - lastTime, 500);
        lastTime = timestamp;

        if (state === 'PLAYING') {
            accumulator += dt;
            const interval = getInterval();
            while (accumulator >= interval) {
                update();
                accumulator -= interval;
                // If game ended during update, stop processing
                if (state !== 'PLAYING') { accumulator = 0; break; }
            }
        }

        draw();
        requestAnimationFrame(loop);
    }

    // --- Boot ---
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    init();
    requestAnimationFrame(loop);
})();
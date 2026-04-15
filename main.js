// ─────────────────────────────────────────────
//  BREAKOUT  main.js
// ─────────────────────────────────────────────

const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');

const W = canvas.width;   // 480
const H = canvas.height;  // 420

// ── Layout constants ─────────────────────────
const PADDLE_H    = 10;
const PADDLE_Y    = H - 28;
const BALL_R      = 7;

const COLS        = 10;
const ROWS        = 5;
const BRICK_W     = 42;
const BRICK_H     = 15;
const BRICK_GAP   = 3;
const BRICK_TOP   = 48;
const BRICK_LEFT  = (W - (BRICK_W + BRICK_GAP) * COLS + BRICK_GAP) / 2;

const ROW_COLORS  = ['#e94560', '#f5a623', '#f8e71c', '#7ed321', '#4a90e2'];

// ── Game state ────────────────────────────────
const game = (() => {
  let score, lives, level;
  let paddle, ball, bricks;
  let state;        // 'ready' | 'playing' | 'over' | 'clear'
  let animId;

  // Input
  const keys = {};
  document.addEventListener('keydown', e => {
    keys[e.key] = true;
    if ((e.key === ' ' || e.key === 'Enter') && state === 'ready') launch();
  });
  document.addEventListener('keyup',   e => { keys[e.key] = false; });

  canvas.addEventListener('mousemove', e => {
    const mx = e.clientX - canvas.getBoundingClientRect().left;
    paddle.x = clamp(mx - paddle.w / 2, 0, W - paddle.w);
    if (!ball.launched) ball.x = paddle.x + paddle.w / 2;
  });

  canvas.addEventListener('click', () => { if (state === 'ready') launch(); });

  // ── Helpers ─────────────────────────────────
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function setOverlay(msg, showBtn) {
    document.getElementById('overlay-msg').textContent = msg;
    document.getElementById('restart-btn').style.display = showBtn ? 'inline-block' : 'none';
  }

  function updateHUD() {
    document.getElementById('score').textContent = score;
    document.getElementById('lives').textContent = lives;
    document.getElementById('level').textContent = level;
  }

  // ── Factories ────────────────────────────────
  function makePaddle() {
    const w = Math.max(50, 80 - (level - 1) * 4);
    return { x: W / 2 - w / 2, y: PADDLE_Y, w };
  }

  function makeBall() {
    const speed = 3.5 + (level - 1) * 0.4;
    const angle = (Math.random() * 60 - 30) * Math.PI / 180; // ±30° from straight up
    return {
      x: paddle.x + paddle.w / 2,
      y: PADDLE_Y - BALL_R - 2,
      dx: speed * Math.sin(angle),
      dy: -speed * Math.cos(angle),
      launched: false,
    };
  }

  function makeBricks() {
    const arr = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        arr.push({
          x: BRICK_LEFT + c * (BRICK_W + BRICK_GAP),
          y: BRICK_TOP  + r * (BRICK_H + BRICK_GAP),
          color: ROW_COLORS[r % ROW_COLORS.length],
          alive: true,
        });
      }
    }
    return arr;
  }

  // ── Init / Reset ─────────────────────────────
  function init() {
    score = 0; lives = 3; level = 1;
    newRound(true);
    updateHUD();
    cancelAnimationFrame(animId);
    loop();
  }

  function newRound(freshBricks) {
    paddle = makePaddle();
    if (freshBricks) bricks = makeBricks();
    ball   = makeBall();
    state  = 'ready';
    setOverlay('スペース または クリックで発射', false);
  }

  function launch() {
    ball.launched = true;
    state = 'playing';
    setOverlay('', false);
  }

  // ── Update ───────────────────────────────────
  function update() {
    if (state !== 'playing') return;

    // Paddle keyboard control
    const pSpeed = 6;
    if (keys['ArrowLeft'])  paddle.x = clamp(paddle.x - pSpeed, 0, W - paddle.w);
    if (keys['ArrowRight']) paddle.x = clamp(paddle.x + pSpeed, 0, W - paddle.w);

    // Move ball
    ball.x += ball.dx;
    ball.y += ball.dy;

    // Wall collisions
    if (ball.x - BALL_R < 0)  { ball.x = BALL_R;     ball.dx =  Math.abs(ball.dx); }
    if (ball.x + BALL_R > W)  { ball.x = W - BALL_R; ball.dx = -Math.abs(ball.dx); }
    if (ball.y - BALL_R < 0)  { ball.y = BALL_R;     ball.dy =  Math.abs(ball.dy); }

    // Paddle collision
    if (
      ball.dy > 0 &&
      ball.y + BALL_R >= paddle.y &&
      ball.y - BALL_R <= paddle.y + PADDLE_H &&
      ball.x >= paddle.x - BALL_R &&
      ball.x <= paddle.x + paddle.w + BALL_R
    ) {
      ball.y = paddle.y - BALL_R;
      const ratio = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2); // -1 … 1
      const maxAngle = Math.PI / 3;  // 60°
      const spd = Math.hypot(ball.dx, ball.dy);
      ball.dx = spd * Math.sin(ratio * maxAngle);
      ball.dy = -spd * Math.cos(ratio * maxAngle);
    }

    // Brick collisions
    for (const b of bricks) {
      if (!b.alive) continue;

      const bx2 = b.x + BRICK_W, by2 = b.y + BRICK_H;
      if (ball.x + BALL_R < b.x || ball.x - BALL_R > bx2) continue;
      if (ball.y + BALL_R < b.y || ball.y - BALL_R > by2) continue;

      b.alive = false;
      score += 10 * level;
      updateHUD();

      // Determine bounce axis from smallest overlap
      const overlapX = Math.min(ball.x + BALL_R - b.x,  bx2 - (ball.x - BALL_R));
      const overlapY = Math.min(ball.y + BALL_R - b.y,  by2 - (ball.y - BALL_R));
      if (overlapX < overlapY) ball.dx *= -1;
      else                     ball.dy *= -1;

      break; // one brick per frame
    }

    // Ball out of bounds (bottom)
    if (ball.y - BALL_R > H) {
      lives--;
      updateHUD();
      if (lives <= 0) {
        state = 'over';
        setOverlay('GAME OVER  —  SCORE: ' + score, true);
      } else {
        newRound(false);
      }
      return;
    }

    // All bricks cleared
    if (bricks.every(b => !b.alive)) {
      level++;
      updateHUD();
      newRound(true);
    }
  }

  // ── Draw ─────────────────────────────────────
  function draw() {
    ctx.clearRect(0, 0, W, H);

    // Bricks
    for (const b of bricks) {
      if (!b.alive) continue;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, BRICK_W, BRICK_H, 3);
      ctx.fill();
      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(b.x + 2, b.y + 2, BRICK_W - 4, 4);
    }

    // Paddle
    const pg = ctx.createLinearGradient(0, paddle.y, 0, paddle.y + PADDLE_H);
    pg.addColorStop(0, '#6ab0f5');
    pg.addColorStop(1, '#0f3460');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.roundRect(paddle.x, paddle.y, paddle.w, PADDLE_H, 5);
    ctx.fill();

    // Ball
    const bg = ctx.createRadialGradient(ball.x - 2, ball.y - 2, 1, ball.x, ball.y, BALL_R);
    bg.addColorStop(0, '#fff');
    bg.addColorStop(1, '#e94560');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Loop ─────────────────────────────────────
  function loop() {
    update();
    draw();
    animId = requestAnimationFrame(loop);
  }

  // ── Public ───────────────────────────────────
  return {
    start:   () => { init(); },
    restart: () => { cancelAnimationFrame(animId); init(); },
  };
})();

game.start();

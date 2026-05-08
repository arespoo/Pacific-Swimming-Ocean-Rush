"use strict";

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const overlay = document.getElementById("overlay");
const wrapper = document.getElementById("gameWrapper");
const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("bestScore");
const hintEl = document.getElementById("hint");
const soundToggle = document.getElementById("soundToggle");

// ===== AUDIO SYSTEM =====
let audioContext = null;
let soundEnabled = true;

function initAudioContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioContext;
}

function playTone(frequency, duration, type = 'sine', volume = 0.3) {
  if (!soundEnabled) return;
  try {
    const ctx = initAudioContext();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    osc.start(now);
    osc.stop(now + duration);
  } catch (e) {
    console.warn('Audio playback failed:', e);
  }
}

function playBeepSequence(frequencies, duration = 0.1, interval = 0.12, volume = 0.2) {
  if (!soundEnabled) return;
  frequencies.forEach((freq, i) => {
    setTimeout(() => playTone(freq, duration, 'sine', volume), interval * 1000 * i);
  });
}

// Sound effects
const sounds = {
  beat: () => playTone(440, 0.08, 'sine', 0.15),
  swim: () => playTone(880, 0.12, 'sine', 0.25),
  dashBonus: () => playBeepSequence([523, 659, 784], 0.1, 0.08, 0.3),
  passObstacle: () => playTone(587, 0.15, 'sine', 0.2),
  goldPickup: () => playBeepSequence([880, 1050, 1240], 0.08, 0.05, 0.35),
  gameOver: () => playBeepSequence([392, 329, 262], 0.15, 0.1, 0.35),
  countdownBeep: () => playTone(800, 0.1, 'sine', 0.25),
  countdownGo: () => playBeepSequence([523, 784], 0.15, 0.12, 0.3),
};

function toggleSound() {
  soundEnabled = !soundEnabled;
  soundToggle.textContent = soundEnabled ? '🔊' : '🔇';
  soundToggle.classList.toggle('muted', !soundEnabled);
  localStorage.setItem('soundEnabled', soundEnabled);
}

// Load sound preference from localStorage
soundEnabled = localStorage.getItem('soundEnabled') !== 'false';
soundToggle.textContent = soundEnabled ? '🔊' : '🔇';
soundToggle.classList.toggle('muted', !soundEnabled);
soundToggle.addEventListener('click', toggleSound);


// Make dolphinOptions global so leaderboard-ui.js can access it safely
window.dolphinOptions = [
  {
    name: "Spike",
    normal: "./assets/dolphin1.jpg",
    glide: "./assets/movement instructions/dolphin1/glide.png",
    flap: "./assets/movement instructions/dolphin1/flap.png",
    fall: "./assets/movement instructions/dolphin1/fall.png"
  },
  {
    name: "Aqua",
    normal: "./assets/dolphin2.jpg",
    glide: "./assets/movement instructions/dolphin2/glide.png",
    flap: "./assets/movement instructions/dolphin2/flap.png",
    fall: "./assets/movement instructions/dolphin2/fall.png"
  },
  {
    name: "Ember",
    normal: "./assets/dolphin3.jpg",
    glide: "./assets/movement instructions/dolphin3/glide.png",
    flap: "./assets/movement instructions/dolphin3/flap.png",
    fall: "./assets/movement instructions/dolphin3/fall.png"
  },
  {
    name: "Zombie",
    normal: "./assets/dolphin4.jpg",
    glide: "./assets/movement instructions/dolphin4/glide.png",
    flap: "./assets/movement instructions/dolphin4/flap.png",
    fall: "./assets/movement instructions/dolphin4/fall.png"
  },
  {
    name: "Blaze",
    normal: "./assets/dolphin5.jpg",
    glide: "./assets/movement instructions/dolphin5/glide.png",
    flap: "./assets/movement instructions/dolphin5/flap.png",
    fall: "./assets/movement instructions/dolphin5/fall.png"
  },
];

const dolphinImages = {};
dolphinOptions.forEach((option, index) => {
  dolphinImages[index] = {
    glide: new Image(),
    flap: new Image(),
    fall: new Image()
  };
  dolphinImages[index].glide.src = option.glide;
  dolphinImages[index].flap.src = option.flap;
  dolphinImages[index].fall.src = option.fall;
});

const backgroundImage = new Image();
backgroundImage.src = "./assets/Background/background.png";

const obstacleNames = ["net", "shark", "submarine"];
const obstacleImages = {};
obstacleNames.forEach(name => {
  const image = new Image();
  image.src = `./assets/obstacles/${name}.png`;
  obstacleImages[name] = image;
});

const goldImage = new Image();
goldImage.src = "./assets/gold.png";

// Make selectedDolphin global so leaderboard-ui.js can access and modify it
window.selectedDolphin = 0;
let width = 0;
let height = 0;
let dpr = window.devicePixelRatio || 1;

const gameState = {
  playing: false,
  waiting: false,
  countdown: 3,
  countdownTimer: 0,
  over: false,
  score: 0,
  bestScore: 0,
  speed: 3.1,
  spawnTimer: 0,
  beatTimer: 0,
  elapsedTime: 0,
  beatInterval: 0.75,
  dashWindow: 0.18,
};

function loadPreferences() {
  const savedScore = Number(localStorage.getItem('bestScore'));
  if (!Number.isNaN(savedScore)) {
    gameState.bestScore = savedScore;
  }

  const savedDolphin = Number(localStorage.getItem('selectedDolphin'));
  if (!Number.isNaN(savedDolphin) && Number.isInteger(savedDolphin) && savedDolphin >= 0 && savedDolphin < dolphinOptions.length) {
    window.selectedDolphin = savedDolphin;
  }
}

function saveBestScore() {
  localStorage.setItem('bestScore', String(gameState.bestScore));
}

function saveSelectedDolphin(index) {
  localStorage.setItem('selectedDolphin', String(index));
}

const dolphin = {
  x: 100,
  y: 0,
  width: 120,
  height: 76,
  vy: 0,
  gravity: 0.22,
  swimStrength: -7.6,
  maxFall: 7.5,
  dashActive: false,
  dashTimer: 0,
  state: 'glide',
  flapTimer: 0,
};

const obstacles = [];
const goldPopups = [];
const colors = {
  sky: "#0b2a4c",
  sea: "#07354e",
  wave: "#1c6a9d",
  coral: "#ff7f50",
  rock: "#8a5f3f",
};
const hitPadding = 3;
const obstaclePadding = 2;

function resize() {
  const rect = wrapper ? wrapper.getBoundingClientRect() : canvas.getBoundingClientRect();
  width = rect.width;
  height = rect.height;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  dolphin.y = Math.min(dolphin.y, height - dolphin.height - 10);
}

window.addEventListener("resize", resize);
resize();

function updateUI() {
  scoreEl.textContent = String(gameState.score);
  bestScoreEl.textContent = String(gameState.bestScore);
  hintEl.textContent = gameState.playing
    ? "Keep tapping in rhythm for a boost."
    : "Tap / click / space to swim. Hit the beat for a dash!";
}

function boxIntersect(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function getBeatProgress() {
  return (gameState.beatTimer % gameState.beatInterval) / gameState.beatInterval;
}

function swim() {
  if (!gameState.playing) {
    startGame();
    return;
  }

  const progress = getBeatProgress();
  const beatDistance = Math.min(progress, 1 - progress);
  const onBeat = beatDistance < gameState.dashWindow / gameState.beatInterval;
  dolphin.vy = dolphin.swimStrength * (onBeat ? 1.12 : 1);

  if (onBeat) {
    dolphin.dashActive = true;
    dolphin.dashTimer = 0.18;
    gameState.score += 1;
    updateUI();
    sounds.dashBonus();
  } else {
    sounds.swim();
  }

  dolphin.state = 'flap';
  dolphin.flapTimer = 0.16;
}

function setSelectedDolphin(index) {
  const selectionGrid = document.getElementById("dolphinSelect");
  const selectionHint = document.getElementById("selectionHint");
  window.selectedDolphin = index;
  saveSelectedDolphin(index);

  const cells = selectionGrid.querySelectorAll(".selection-cell");
  cells.forEach((cell, idx) => {
    cell.classList.toggle("active", idx === index);
  });
  selectionHint.textContent = "Selected dolphin. Press Start to race!";
}

function createSelectionUI() {
  const selectionGrid = document.getElementById("dolphinSelect");
  dolphinOptions.forEach((option, index) => {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "selection-cell";
    cell.setAttribute("aria-label", `Select dolphin ${index + 1}`);
    cell.innerHTML = `
      <div class="selection-thumb">
        <img src="${option.normal}" alt="${option.name}">
      </div>
      <div class="selection-name">${option.name}</div>
    `;
    cell.addEventListener("click", () => setSelectedDolphin(index));
    selectionGrid.appendChild(cell);
  });
  setSelectedDolphin(selectedDolphin);
}

function resetGame() {
  gameState.waiting = false;
  gameState.playing = true;
  gameState.over = false;
  gameState.score = 0;
  gameState.speed = 3.5;
  gameState.spawnTimer = 0;
  gameState.beatTimer = 0;
  gameState.elapsedTime = 0;
  obstacles.length = 0;
  dolphin.y = height * 0.45;
  dolphin.vy = 0;
  dolphin.dashActive = false;
  dolphin.dashTimer = 0;
  dolphin.state = 'glide';
  dolphin.flapTimer = 0;

  const startBtn = document.getElementById('startButton');
  if (startBtn) startBtn.disabled = false;

  overlay.classList.add("hidden");
  leaderboardUI.hidePlayerNameDisplay();
  updateUI();
}

function startGame() {
  if (gameState.waiting || gameState.playing) return;
  gameState.waiting = true;
  gameState.countdown = 3;
  gameState.countdownTimer = 0;

  const startBtn = document.getElementById('startButton');
  if (startBtn) startBtn.disabled = true;

  const selectionGrid = document.getElementById('dolphinSelect');
  if (selectionGrid) {
    selectionGrid.querySelectorAll(".selection-cell").forEach(cell => cell.disabled = true);
  }

  overlay.classList.add("hidden");
}

async function endGame() {
  gameState.over = true;
  gameState.playing = false;
  dolphin.state = 'fall';
  sounds.gameOver();
  
  // Update leaderboard with final score (Firebase)
  const playerName = leaderboardUI.currentPlayerName || 'Anonymous';
  await leaderboardManager.addScore(playerName, gameState.score);
  
  // Show game over screen with leaderboard
  await leaderboardUI.showGameOverScreen(gameState.score);
  
  if (gameState.score > gameState.bestScore) {
    gameState.bestScore = gameState.score;
    saveBestScore();
  }
  updateUI();
}

function spawnObstacle() {
  const shouldSpawnGold = Math.random() < 0.18;
  const minY = 16;
  const maxY = Math.max(minY, height - 60 - 16);
  const spawnY = minY + Math.random() * (maxY - minY);

  if (shouldSpawnGold) {
    const goldSize = 40 + Math.random() * 14;
    obstacles.push({
      x: width + 20,
      y: spawnY,
      width: goldSize,
      height: goldSize,
      type: 'gold',
      collected: false,
    });
    return;
  }

  const obstacleType = obstacleNames[Math.floor(Math.random() * obstacleNames.length)];
  const baseWidth = 92 + Math.random() * 42;
  const img = obstacleImages[obstacleType];
  const aspect = img && img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1.0;
  const obstacleWidth = baseWidth;
  const obstacleHeight = obstacleWidth / aspect;
  const obstacleY = minY + Math.random() * Math.max(0, height - obstacleHeight - 16 - minY);
  obstacles.push({
    x: width + 20,
    y: obstacleY,
    width: obstacleWidth,
    height: obstacleHeight,
    type: obstacleType,
    passed: false,
  });
}

function drawBackground() {
  if (backgroundImage.complete && backgroundImage.naturalWidth) {
    const aspect = backgroundImage.width / backgroundImage.height;
    let drawWidth = width;
    let drawHeight = height;
    if (width / height > aspect) {
      drawHeight = width / aspect;
    } else {
      drawWidth = height * aspect;
    }
    const offsetX = (width - drawWidth) * 0.5;
    const offsetY = (height - drawHeight) * 0.5;
    ctx.drawImage(backgroundImage, offsetX, offsetY, drawWidth, drawHeight);
  } else {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, colors.sky);
    gradient.addColorStop(0.55, "#045b81");
    gradient.addColorStop(1, colors.sea);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  ctx.fillStyle = "rgba(255,255,255,0.08)";
  for (let i = 0; i < 8; i++) {
    const y = height * 0.72 + i * 22;
    ctx.beginPath();
    ctx.moveTo(-120, y);
    for (let x = -120; x <= width + 120; x += 40) {
      ctx.quadraticCurveTo(
        x + 20,
        y + 18 * Math.sin((x + i * 40) * 0.06 + performance.now() * 0.0015),
        x + 40,
        y
      );
    }
    ctx.lineTo(width + 120, height);
    ctx.lineTo(-120, height);
    ctx.closePath();
    ctx.fill();
  }
}

function drawDolphin() {
  const x = dolphin.x;
  const y = dolphin.y;
  const w = dolphin.width;
  const h = dolphin.height;
  const images = dolphinImages[window.selectedDolphin];
  const image = images[dolphin.state] || images.glide;
  ctx.save();
  ctx.translate(x + w * 0.5, y + h * 0.5);
  const angle = Math.atan2(dolphin.vy, 12);
  ctx.rotate(angle);
  ctx.translate(-x - w * 0.5, -y - h * 0.5);
  ctx.drawImage(image, x, y, w, h);

  if (dolphin.dashActive) {
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + w * 0.08, y + h * 0.7);
    ctx.lineTo(x - 18, y + h * 0.9);
    ctx.stroke();
  }
  ctx.restore();
}

function drawObstacles() {
  obstacles.forEach(obs => {
    if (obs.type === 'gold') {
      if (goldImage.complete && goldImage.naturalWidth && goldImage.naturalHeight) {
        ctx.drawImage(goldImage, obs.x, obs.y, obs.width, obs.height);
      } else {
        ctx.fillStyle = '#ffd700';
        ctx.beginPath();
        ctx.arc(obs.x + obs.width * 0.5, obs.y + obs.height * 0.5, obs.width * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }

    const img = obstacleImages[obs.type];
    if (img.complete && img.naturalWidth && img.naturalHeight) {
      ctx.drawImage(img, obs.x, obs.y, obs.width, obs.height);
    } else {
      ctx.fillStyle = colors.coral;
      ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    }
  });
}

function addGoldPopup(x, y, points) {
  goldPopups.push({
    x,
    y,
    vy: -28,
    alpha: 1,
    life: 0,
    duration: 1.8,
    text: `+ ${points} PTS`,
    scale: 1.1,
  });
}

function drawGoldPopups(deltaTime) {
  const activePopups = [];
  goldPopups.forEach(popup => {
    popup.y += popup.vy * deltaTime;
    popup.life += deltaTime;
    popup.alpha = Math.max(0, 1 - popup.life / popup.duration);
    popup.scale = 1.1 + Math.sin((popup.life / popup.duration) * Math.PI) * 0.18;
    if (popup.alpha > 0) {
      ctx.save();
      ctx.translate(popup.x, popup.y);
      ctx.scale(popup.scale, popup.scale);
      ctx.shadowColor = `rgba(255, 235, 120, ${popup.alpha * 0.75})`;
      ctx.shadowBlur = 18;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.font = "900 28px Inter, Arial, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = `rgba(255, 240, 130, ${popup.alpha})`;
      ctx.fillText(popup.text, 0, 0);
      ctx.strokeStyle = `rgba(30, 20, 10, ${popup.alpha})`;
      ctx.lineWidth = 4;
      ctx.strokeText(popup.text, 0, 0);
      ctx.restore();
      activePopups.push(popup);
    }
  });
  goldPopups.splice(0, goldPopups.length, ...activePopups);
}

function drawBeatMeter() {
  const progress = getBeatProgress();
  const meterWidth = 180;
  const meterHeight = 10;
  const x = width - meterWidth - 18;
  const y = 18;
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fillRect(x, y, meterWidth, meterHeight);
  ctx.fillStyle = progress > 0.98 || progress < 0.02 ? "#9cff7d" : "#54c8ff";
  ctx.fillRect(x, y, meterWidth * progress, meterHeight);
  ctx.strokeStyle = "#ffffff55";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, meterWidth, meterHeight);
  ctx.fillStyle = "#e4f8ff";
  ctx.font = "12px Inter, Arial, sans-serif";
  ctx.fillText("beat", x, y - 8);
}

function detectCollision(obs) {
  const player = {
    x: dolphin.x + hitPadding,
    y: dolphin.y + hitPadding,
    width: dolphin.width - hitPadding * 2,
    height: dolphin.height - hitPadding * 2,
  };

  const shrinkFactor = obs.type === "shark" ? 0.35 : obs.type === "submarine" ? 0.28 : 0.18;
  const obstacleBox = {
    x: obs.x + obs.width * shrinkFactor,
    y: obs.y + obs.height * shrinkFactor,
    width: Math.max(0, obs.width * (1 - shrinkFactor * 2)),
    height: Math.max(0, obs.height * (1 - shrinkFactor * 2)),
  };

  return boxIntersect(player, obstacleBox);
}

function drawHud() {
  // Score display moved to top HUD - removed from canvas
}

function drawCountdown() {
  if (!gameState.waiting) return;
  // Removed dark background overlay
  ctx.fillStyle = "#7ef0ff";
  ctx.font = `bold ${Math.floor(height * 0.18)}px Inter, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(gameState.countdown), width * 0.5, height * 0.5);
  ctx.font = `500 ${Math.floor(height * 0.04)}px Inter, Arial, sans-serif`;
  ctx.fillText("Get Ready", width * 0.5, height * 0.68);
}

let lastTime = 0;
function gameLoop(timestamp) {
  const deltaTime = Math.min((timestamp - lastTime) / 1000, 0.033);
  lastTime = timestamp;
  drawBackground();
  if (gameState.waiting) {
    gameState.countdownTimer += deltaTime;
    if (gameState.countdownTimer >= 1) {
      gameState.countdownTimer -= 1;
      gameState.countdown -= 1;
      if (gameState.countdown > 0) {
        sounds.countdownBeep();
      } else {
        sounds.countdownGo();
        resetGame();
        // Show player name in HUD after game starts
        leaderboardUI.updatePlayerNameDisplay(leaderboardUI.currentPlayerName);
      }
    }
  }

  if (gameState.playing) {
    gameState.beatTimer += deltaTime;
    gameState.elapsedTime += deltaTime;
    dolphin.vy += dolphin.gravity;
    dolphin.vy = Math.min(dolphin.vy, dolphin.maxFall);
    dolphin.y += dolphin.vy;

    if (dolphin.y < 14) {
      endGame();
    }
    if (dolphin.y + dolphin.height > height - 6) {
      dolphin.y = height - dolphin.height - 6;
      dolphin.vy = 0;
      endGame();
    }

    if (dolphin.dashActive) {
      dolphin.dashTimer -= deltaTime;
      if (dolphin.dashTimer <= 0) {
        dolphin.dashActive = false;
      }
    }

    if (dolphin.state === 'flap') {
      dolphin.flapTimer -= deltaTime;
      if (dolphin.flapTimer <= 0) {
        dolphin.state = 'glide';
      }
    }

    gameState.spawnTimer += deltaTime;
    const spawnRate = Math.max(0.9, 1.8 - Math.min(gameState.score * 0.03, 0.7) - Math.min(gameState.elapsedTime * 0.01, 0.5));
    if (gameState.spawnTimer > spawnRate) {
      gameState.spawnTimer = 0;
      spawnObstacle();
    }

    const scoreBoost = 1 + Math.min(gameState.score * 0.01, 0.4);
    const timeBoost = 1 + Math.min(gameState.elapsedTime * 0.03, 1.0);
    const moveSpeed = (gameState.speed * scoreBoost * timeBoost) + (dolphin.dashActive ? 1.2 : 0);
    obstacles.forEach(obs => {
      obs.x -= moveSpeed;

      if (obs.type === 'gold') {
        if (!obs.collected && boxIntersect({
          x: dolphin.x + hitPadding,
          y: dolphin.y + hitPadding,
          width: dolphin.width - hitPadding * 2,
          height: dolphin.height - hitPadding * 2,
        }, obs)) {
          obs.collected = true;
          obs.x = -200;
          gameState.score += 10;
          addGoldPopup(obs.x + obs.width * 0.5, obs.y + obs.height * 0.5, 10);
          sounds.goldPickup();
          updateUI();
        }
        return;
      }

      if (!obs.passed && obs.x + 34 < dolphin.x) {
        obs.passed = true;
        gameState.score += 1;
        sounds.passObstacle();
        updateUI();
      }
      if (detectCollision(obs)) {
        endGame();
      }
    });
    while (obstacles.length && obstacles[0].x < -120) obstacles.shift();
  }

  drawObstacles();
  drawGoldPopups(deltaTime);
  drawDolphin();
  drawBeatMeter();
  drawHud();
  drawCountdown();
  requestAnimationFrame(gameLoop);
}

function handleInput(event) {
  if (!overlay.classList.contains("hidden")) return;
  if (event.type === "keydown") {
    if (event.code !== "Space") return;
  }
  if (event.type === "pointerdown" || event.type === "touchstart") {
    if (event.target.closest("button")) return;
  }
  if (!gameState.playing) return;
  event.preventDefault();
  swim();
}

const startButton = document.getElementById("startButton");
startButton.addEventListener("click", startGame);
window.addEventListener("keydown", handleInput, { passive: false });
window.addEventListener("pointerdown", handleInput, { passive: false });
window.addEventListener("touchstart", handleInput, { passive: false });

loadPreferences();

// Initialize with leaderboard start game screen (Firebase connected)
leaderboardUI.showStartGameScreen();

updateUI();
requestAnimationFrame(timestamp => {
  lastTime = timestamp;
  gameLoop(timestamp);
});

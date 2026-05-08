"use strict";

/**
 * Leaderboard UI Manager
 * Handles all UI interactions and displays for Firebase leaderboard
 */

class LeaderboardUI {
  constructor() {
    this.currentPlayerName = null;
    this.screens = {
      DOLPHIN_SELECT: 'dolphinSelect',
      START_GAME: 'startGame',
      GAME_OVER: 'gameOver'
    };
    this.currentScreen = this.screens.DOLPHIN_SELECT;
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get medal emoji based on rank
   */
  getMedalEmoji(rank) {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
    }
  }

  /**
   * Show Start Game screen with player name input
   */
  async showStartGameScreen() {
    const overlay = document.getElementById('overlay');
    const panel = overlay.querySelector('.panel');
    
    panel.innerHTML = `
      <h2>🐬 Ocean Rush</h2>
      <p>Enter your name and pick your dolphin!</p>
      
      <input 
        type="text" 
        class="player-name-input" 
        id="playerNameInput" 
        placeholder="Enter your name" 
        maxlength="30"
        autocomplete="off"
      >
      
      <div id="dolphinSelect" class="selection-grid" style="margin-top: 10px;"></div>
      <p id="selectionHint" style="font-size: 0.85rem; margin-top: 5px; color: #a8d0ff;">Tap to choose your dolphin</p>

      <div class="leaderboard-mini" id="miniLeaderboard">
        <h3>🏆 Loading Top Players...</h3>
      </div>
      
      <div class="button-group">
        <button class="primary-btn" id="startButton">Start Racing!</button>
      </div>
    `;

    // Populate dolphin selection
    const selectionGrid = panel.querySelector('#dolphinSelect');
    selectionGrid.innerHTML = '';
    window.dolphinOptions.forEach((option, index) => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'selection-cell';
      if (index === window.selectedDolphin) cell.classList.add('active');
      cell.innerHTML = `
        <div class="selection-thumb">
          <img src="${option.normal}" alt="${option.name}">
        </div>
        <div class="selection-name">${option.name}</div>
      `;
      cell.addEventListener('click', () => {
        window.selectedDolphin = index;
        saveSelectedDolphin(index);
        panel.querySelectorAll('.selection-cell').forEach((c, i) => {
          c.classList.toggle('active', i === index);
        });
      });
      selectionGrid.appendChild(cell);
    });

    // Display mini leaderboard (async)
    await this.updateMiniLeaderboard();

    // Setup event listeners
    const playerNameInput = document.getElementById('playerNameInput');
    const startBtn = document.getElementById('startButton');

    // Pre-fill name if it exists in session
    const savedName = sessionStorage.getItem('currentPlayerName');
    if (savedName) playerNameInput.value = savedName;

    playerNameInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        startBtn.click();
      }
    });

    startBtn.addEventListener('click', () => {
      const name = playerNameInput.value.trim();
      if (name.length < 1) {
        alert('Please enter a name!');
        return;
      }
      this.currentPlayerName = name;
      sessionStorage.setItem('currentPlayerName', name);
      startGame();
    });

    playerNameInput.focus();
    overlay.classList.remove('hidden');
    this.currentScreen = this.screens.START_GAME;
  }

  /**
   * Update mini leaderboard display (async Firebase fetch)
   */
  async updateMiniLeaderboard() {
    const container = document.getElementById('miniLeaderboard');
    if (!container) return;

    try {
      const top5 = (await leaderboardManager.getTop10()).slice(0, 5);

      if (top5.length === 0) {
        container.innerHTML = `
          <h3>🏆 Today's Top Players</h3>
          <div class="empty-leaderboard">No scores yet. Be the first!</div>
        `;
        return;
      }

      let html = '<h3>🏆 Today\'s Top Players</h3><div class="mini-leaderboard-list">';
      top5.forEach(entry => {
        const medal = this.getMedalEmoji(entry.rank);
        const nameEscaped = this.escapeHtml(entry.name);
        html += `
          <div class="mini-leaderboard-entry">
            <div class="medal">${medal}</div>
            <div class="name">${nameEscaped}</div>
            <div class="score">${entry.score}</div>
          </div>
        `;
      });
      html += '</div>';

      container.innerHTML = html;
    } catch (error) {
      console.error('Error updating mini leaderboard:', error);
      container.innerHTML = `
        <h3>🏆 Today's Top Players</h3>
        <div class="empty-leaderboard">⚠️ Error loading leaderboard</div>
      `;
    }
  }

  /**
   * Show Game Over screen with leaderboard (async Firebase fetch)
   */
  async showGameOverScreen(finalScore) {
    const overlay = document.getElementById('overlay');
    const panel = overlay.querySelector('.panel');

    // Show loading state
    panel.innerHTML = `
      <h2>Game Over</h2>
      <div class="final-score">Your Score: ${finalScore}</div>
      <h3>📊 Loading Leaderboard...</h3>
      <div style="text-align: center; padding: 20px;">
        <p>⏳ Syncing with server...</p>
      </div>
    `;

    try {
      const playerRank = await leaderboardManager.getPlayerRank(this.currentPlayerName);
      const top10 = await leaderboardManager.getTop10();

      let leaderboardHtml = '';
      if (top10.length === 0) {
        leaderboardHtml = '<div class="empty-leaderboard">No scores recorded yet.</div>';
      } else {
        leaderboardHtml = '<div class="game-over-leaderboard">';
        top10.forEach(entry => {
          const medal = this.getMedalEmoji(entry.rank);
          const nameEscaped = this.escapeHtml(entry.name);
          const isCurrentPlayer = this.currentPlayerName && entry.name.toLowerCase() === this.currentPlayerName.toLowerCase();
          const highlightClass = isCurrentPlayer ? 'highlight' : '';
          
          leaderboardHtml += `
            <div class="leaderboard-row ${highlightClass}">
              <div class="medal">${medal}</div>
              <div class="name">${nameEscaped}</div>
              <div class="score">${entry.score}</div>
            </div>
          `;
        });
        leaderboardHtml += '</div>';
      }

      let rankMessage = '';
      if (playerRank > 0 && playerRank <= 10) {
        rankMessage = `<div class="rank-message">🎉 You're #${playerRank} on the leaderboard!</div>`;
      } else if (playerRank > 10) {
        rankMessage = `<div class="rank-message">Keep practicing! You're ranked #${playerRank}.</div>`;
      }

      panel.innerHTML = `
        <h2>Game Over</h2>
        <div class="final-score">Your Score: ${finalScore}</div>
        ${rankMessage}
        <h3>🏆 Today's Leaderboard</h3>
        ${leaderboardHtml}
        
        <div class="button-group">
          <button class="primary-btn" id="tryAgainButton">Try Again</button>
          <button class="secondary-btn" id="mainMenuButton">Main Menu</button>
        </div>
      `;

      // Setup event listeners
      const tryAgainButton = document.getElementById('tryAgainButton');
      const mainMenuButton = document.getElementById('mainMenuButton');

      tryAgainButton.addEventListener('click', () => {
        resetGame();
        overlay.classList.add('hidden');
      });

      mainMenuButton.addEventListener('click', () => {
        this.showStartGameScreen();
      });
    } catch (error) {
      console.error('Error showing game over screen:', error);
      panel.innerHTML = `
        <h2>Game Over</h2>
        <div class="final-score">Your Score: ${finalScore}</div>
        <p style="color: #ff6464;">⚠️ Error loading leaderboard</p>
        <div class="button-group">
          <button class="primary-btn" id="tryAgainButton">Try Again</button>
          <button class="secondary-btn" id="mainMenuButton">Main Menu</button>
        </div>
      `;

      const tryAgainButton = document.getElementById('tryAgainButton');
      const mainMenuButton = document.getElementById('mainMenuButton');

      tryAgainButton.addEventListener('click', () => {
        resetGame();
        overlay.classList.add('hidden');
      });

      mainMenuButton.addEventListener('click', () => {
        this.showStartGameScreen();
      });
    }

    overlay.classList.remove('hidden');
    this.currentScreen = this.screens.GAME_OVER;
  }

  /**
   * Update player name display in HUD
   */
  updatePlayerNameDisplay(playerName) {
    let playerDisplay = document.getElementById('playerNameDisplay');
    if (!playerDisplay) {
      // Create if doesn't exist
      const hud = document.getElementById('hud');
      playerDisplay = document.createElement('div');
      playerDisplay.id = 'playerNameDisplay';
      playerDisplay.className = 'scores';
      hud.appendChild(playerDisplay);
    }
    
    playerDisplay.innerHTML = `<div>Player: <span>${this.escapeHtml(playerName)}</span></div>`;
    playerDisplay.style.display = 'flex';
  }

  /**
   * Hide player name display
   */
  hidePlayerNameDisplay() {
    const playerDisplay = document.getElementById('playerNameDisplay');
    if (playerDisplay) {
      playerDisplay.style.display = 'none';
    }
  }
}

// Create global UI instance
const leaderboardUI = new LeaderboardUI();

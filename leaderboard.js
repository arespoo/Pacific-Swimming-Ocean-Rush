// Firebase Configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getDatabase, ref, set, get, query, orderByChild, equalTo, onValue } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBi7aOAg8CJXmaCPYLGxQsFp1IXNlBLGqQ",
  authDomain: "pacific-pod-ocean-rush.firebaseapp.com",
  databaseURL: "https://pacific-pod-ocean-rush-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "pacific-pod-ocean-rush",
  storageBucket: "pacific-pod-ocean-rush.firebasestorage.app",
  messagingSenderId: "454607350078",
  appId: "1:454607350078:web:e66fc0f4ab3b496cfba46f",
  measurementId: "G-30F15W76PK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

/**
 * Firebase Leaderboard Manager
 * Syncs scores with Realtime Database
 */

class FirebaseLeaderboardManager {
  constructor() {
    this.localLeaderboard = [];
    this.isOnline = navigator.onLine;
    this.syncInProgress = false;
    
    // Monitor online/offline status
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
  }

  handleOnline() {
    this.isOnline = true;
    console.log('🟢 Back online - syncing leaderboard');
    this.syncWithFirebase();
  }

  handleOffline() {
    this.isOnline = false;
    console.log('🔴 Offline mode - changes will sync when back online');
  }

  /**
   * Get today's date string
   */
  getTodayDate() {
    const d = new Date();
    // Trả về định dạng YYYY-MM-DD theo giờ UTC (Reset lúc 00:00 UTC)
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }

  /**
   * Add or update score to Firebase
   */
  async addScore(playerName, score) {
    if (!playerName || typeof score !== 'number') {
      console.error('Invalid player name or score');
      return false;
    }

    // Giới hạn tên tối đa 30 ký tự
    const limitedName = playerName.substring(0, 30);
    const today = this.getTodayDate();
    const sanitizedName = limitedName.toLowerCase().replace(/[\.\$\#\[\]\s+]/g, '_');
    const scoreKey = `${today}_${sanitizedName}`;
    try {
      if (!this.isOnline) {
        // Save to local storage if offline
        this.saveToLocalStorage(playerName, score, today);
        return true;
      }

      // Fetch existing score
      const scoreRef = ref(database, `leaderboard/${scoreKey}`);
      const snapshot = await get(scoreRef);
      
      let shouldUpdate = true;
      if (snapshot.exists()) {
        const existing = snapshot.val();
        if (score <= existing.score) {
          shouldUpdate = false;
        }
      }

      if (shouldUpdate) {
        await set(scoreRef, {
          name: limitedName,
          score: score,
          date: today,
          timestamp: Date.now()
        });
      }

      return true;
    } catch (error) {
      console.error('Error adding score to Firebase:', error);
      // Fallback to local storage
      this.saveToLocalStorage(playerName, score, today);
      return true;
    }
  }

  /**
   * Get top 10 leaderboard for today
   */
  async getTop10() {
    const today = this.getTodayDate();

    try {
      if (!this.isOnline) {
        return this.getFromLocalStorage(today);
      }

      // Sử dụng query để chỉ lấy dữ liệu của ngày hôm nay từ server
      const leaderboardRef = ref(database, 'leaderboard');
      const todayQuery = query(leaderboardRef, orderByChild('date'), equalTo(today));
      const snapshot = await get(todayQuery);

      if (!snapshot.exists()) {
        return [];
      }
      const todayScores = Object.values(snapshot.val());

      // Sort by score descending, then by timestamp ascending
      todayScores.sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return a.timestamp - b.timestamp;
      });

      // Return top 10 with rank
      return todayScores.slice(0, 10).map((entry, index) => ({
        ...entry,
        rank: index + 1
      }));
    } catch (error) {
      console.error('Error fetching leaderboard from Firebase:', error);
      return this.getFromLocalStorage(today);
    }
  }

  /**
   * Get player rank
   */
  async getPlayerRank(playerName) {
    const top10 = await this.getTop10();
    const entry = top10.find(e => e.name.toLowerCase() === playerName.toLowerCase());
    return entry ? entry.rank : 0;
  }

  /**
   * Save to local storage for offline support
   */
  saveToLocalStorage(playerName, score, date) {
    const key = `${date}_${playerName}`;
    const existing = localStorage.getItem(`oceanRush_${key}`);
    
    if (!existing || score > JSON.parse(existing).score) {
      localStorage.setItem(`oceanRush_${key}`, JSON.stringify({
        name: playerName,
        score: score,
        date: date,
        timestamp: Date.now(),
        synced: false
      }));
    }
  }

  /**
   * Get from local storage
   */
  getFromLocalStorage(date) {
    const scores = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith('oceanRush_') && key.includes(date)) {
        const data = JSON.parse(localStorage.getItem(key));
        scores.push(data);
      }
    }

    scores.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.timestamp - b.timestamp;
    });

    return scores.slice(0, 10).map((entry, index) => ({
      ...entry,
      rank: index + 1
    }));
  }

  /**
   * Sync offline scores to Firebase
   */
  async syncWithFirebase() {
    if (this.syncInProgress || !this.isOnline) return;

    this.syncInProgress = true;
    const today = this.getTodayDate();

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('oceanRush_')) {
          const data = JSON.parse(localStorage.getItem(key));
          
          if (!data.synced) {
            await this.addScore(data.name, data.score);
            data.synced = true;
            localStorage.setItem(key, JSON.stringify(data));
          }
        }
      }

      console.log('✅ Sync completed');
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Listen to realtime updates
   */
  onLeaderboardUpdate(callback) {
    const leaderboardRef = ref(database, 'leaderboard');
    const today = this.getTodayDate();
    const todayQuery = query(leaderboardRef, orderByChild('date'), equalTo(today));
    
    try {
      onValue(todayQuery, (snapshot) => {
        if (snapshot.exists()) {
          const data = Object.values(snapshot.val());
          
          data.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.timestamp - b.timestamp;
          });

          const top10 = data.slice(0, 10).map((entry, index) => ({
            ...entry,
            rank: index + 1
          }));
        
          callback(top10);
        }
      });
    } catch (error) {
      console.error('Error setting up realtime listener:', error);
    }
  }

  /**
   * Clear all data (for testing)
   */
  async clearAll() {
    try {
      const leaderboardRef = ref(database, 'leaderboard');
      await set(leaderboardRef, null);
      console.log('Leaderboard cleared');
    } catch (error) {
      console.error('Error clearing leaderboard:', error);
    }
  }
}

// Create global instance
const leaderboardManager = new FirebaseLeaderboardManager();

// Expose to window so other scripts (like main.js) can access it
window.leaderboardManager = leaderboardManager;

// Sync on load
window.addEventListener('load', () => {
  leaderboardManager.syncWithFirebase();
});

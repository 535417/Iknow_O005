// LocalStorage management for user state and training logs

const Storage = {
  KEYS: {
    USER_STATE: 'orient_user_state',
    TRAINING_LOGS: 'orient_training_logs',
    CONFUSION_MATRIX: 'orient_confusion_matrix',
    FAVORITES: 'orient_favorites',
    DAILY_STATS: 'orient_daily_stats'
  },

  // Initialize user state for all legends
  initUserState() {
    const state = {};
    ALL_LEGENDS.forEach(legend => {
      state[legend.id] = {
        recognition_score: 0,
        recall_score: 0,
        speed_score: 0,
        confusion_risk: 0,
        uncertainty: 0.5,
        last_seen: null,
        last_correct: null,
        streak: 0,
        total_seen: 0,
        total_correct: 0,
        mastery_level: 'new'
      };
    });
    localStorage.setItem(this.KEYS.USER_STATE, JSON.stringify(state));
    return state;
  },

  // Get user state
  getUserState() {
    let state = localStorage.getItem(this.KEYS.USER_STATE);
    if (!state) {
      state = this.initUserState();
    } else {
      state = JSON.parse(state);
    }
    return state;
  },

  // Update single legend state
  updateLegendState(legendId, updates) {
    const state = this.getUserState();
    if (state[legendId]) {
      Object.assign(state[legendId], updates);
      state[legendId].mastery_level = this.calculateMasteryLevel(state[legendId]);
      localStorage.setItem(this.KEYS.USER_STATE, JSON.stringify(state));
    }
    return state[legendId];
  },

  // Calculate mastery level based on scores
  calculateMasteryLevel(legendState) {
    const avg = (legendState.recognition_score + legendState.recall_score + legendState.speed_score) / 3;
    if (avg >= 0.9) return 'automatic';
    if (avg >= 0.7) return 'stable';
    if (avg >= 0.4) return 'learning';
    return 'new';
  },

  // Add training log
  addTrainingLog(log) {
    const logs = this.getTrainingLogs();
    log.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
    log.timestamp = new Date().toISOString();
    logs.push(log);
    
    // Keep last 10000 logs
    if (logs.length > 10000) {
      logs.splice(0, logs.length - 10000);
    }
    
    localStorage.setItem(this.KEYS.TRAINING_LOGS, JSON.stringify(logs));
    return log;
  },

  // Get training logs
  getTrainingLogs() {
    const logs = localStorage.getItem(this.KEYS.TRAINING_LOGS);
    return logs ? JSON.parse(logs) : [];
  },

  // Get confusion matrix
  getConfusionMatrix() {
    const matrix = localStorage.getItem(this.KEYS.CONFUSION_MATRIX);
    return matrix ? JSON.parse(matrix) : {};
  },

  // Update confusion matrix
  updateConfusionMatrix(legendA, legendB, weight) {
    const matrix = this.getConfusionMatrix();
    const key = `${legendA}->${legendB}`;
    matrix[key] = (matrix[key] || 0) + weight;
    localStorage.setItem(this.KEYS.CONFUSION_MATRIX, JSON.stringify(matrix));
    return matrix;
  },

  // Get favorites
  getFavorites() {
    const fav = localStorage.getItem(this.KEYS.FAVORITES);
    return fav ? JSON.parse(fav) : [];
  },

  // Toggle favorite
  toggleFavorite(legendId) {
    const fav = this.getFavorites();
    const idx = fav.indexOf(legendId);
    if (idx === -1) {
      fav.push(legendId);
    } else {
      fav.splice(idx, 1);
    }
    localStorage.setItem(this.KEYS.FAVORITES, JSON.stringify(fav));
    return fav;
  },

  // Get daily stats
  getDailyStats() {
    const today = new Date().toISOString().split('T')[0];
    const stats = localStorage.getItem(this.KEYS.DAILY_STATS);
    const parsed = stats ? JSON.parse(stats) : {};
    
    if (!parsed[today]) {
      parsed[today] = {
        total: 0,
        correct: 0,
        wrong: 0,
        mode_counts: { choice: 0, flip: 0, flash: 0 },
        time_spent: 0,
        legends_seen: []
      };
    }
    
    return { date: today, stats: parsed[today], all: parsed };
  },

  // Update daily stats
  updateDailyStats(updates) {
    const { date, stats, all } = this.getDailyStats();
    Object.assign(stats, updates);
    all[date] = stats;
    localStorage.setItem(this.KEYS.DAILY_STATS, JSON.stringify(all));
    return stats;
  },

  // Get weak legends (high confusion risk or low scores)
  getWeakLegends(limit = 10) {
    const state = this.getUserState();
    return ALL_LEGENDS
      .map(legend => ({
        ...legend,
        state: state[legend.id]
      }))
      .filter(l => l.state && l.state.total_seen > 0)
      .sort((a, b) => {
        const scoreA = a.state.confusion_risk * 0.4 + a.state.uncertainty * 0.3 + (1 - a.state.speed_score) * 0.3;
        const scoreB = b.state.confusion_risk * 0.4 + b.state.uncertainty * 0.3 + (1 - b.state.speed_score) * 0.3;
        return scoreB - scoreA;
      })
      .slice(0, limit);
  },

  // Get today's recommended legends
  getTodayRecommended(limit = 20) {
    const state = this.getUserState();
    const { stats } = this.getDailyStats();
    
    return ALL_LEGENDS
      .map(legend => ({
        ...legend,
        state: state[legend.id],
        priority: this.calculatePriority(state[legend.id])
      }))
      .filter(l => !stats.legends_seen.includes(l.id))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, limit);
  },

  // Calculate priority score for scheduling
  calculatePriority(legendState) {
    if (!legendState) return 1;
    return (
      0.35 * (legendState.confusion_risk || 0) +
      0.30 * (legendState.uncertainty || 0.5) +
      0.25 * (1 - (legendState.speed_score || 0)) +
      0.10 * (1 - (legendState.recall_score || 0))
    );
  },

  // Reset all data
  resetAll() {
    Object.values(this.KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
  }
};
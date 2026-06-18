// Priority scheduling algorithm for legend selection

const Scheduler = {
  // Calculate priority score for a legend
  calculatePriority(legendState) {
    if (!legendState) return 1;
    
    return (
      0.35 * (legendState.confusion_risk || 0) +
      0.30 * (legendState.uncertainty || 0.5) +
      0.25 * (1 - (legendState.speed_score || 0)) +
      0.10 * (1 - (legendState.recall_score || 0))
    );
  },

  // Pick next legend using weighted random from top-K
  pickNextLegend(legends, excludeIds = []) {
    const state = Storage.getUserState();
    
    // Calculate priority for each legend
    const scored = legends
      .filter(l => !excludeIds.includes(l.id))
      .map(legend => ({
        ...legend,
        priority: this.calculatePriority(state[legend.id])
      }));
    
    // Sort by priority (highest first)
    scored.sort((a, b) => b.priority - a.priority);
    
    // Take top-K for weighted random selection
    const topK = scored.slice(0, 20);
    
    if (topK.length === 0) return null;
    
    // Weighted random selection from top-K
    const weights = topK.map(l => l.priority + 0.1); // Add small base weight
    const index = this.weightedRandom(weights);
    
    return topK[index];
  },

  // Weighted random selection
  weightedRandom(weights) {
    const sum = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * sum;
    
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) return i;
    }
    
    return weights.length - 1;
  },

  // Select training mode based on legend state
  selectMode(legendState) {
    if (!legendState) return 'choice';
    
    // High confusion risk -> choice mode (fix confusion)
    if (legendState.confusion_risk > 0.7) {
      return 'choice';
    }
    
    // Low recall -> flip mode (strengthen memory)
    if (legendState.recall_score < 0.5) {
      return 'flip';
    }
    
    // Low speed -> flash mode (automation)
    if (legendState.speed_score < 0.6) {
      return 'flash';
    }
    
    // Otherwise weighted random
    const modes = ['choice', 'flip', 'flash'];
    const weights = [0.4, 0.3, 0.3];
    return modes[this.weightedRandom(weights)];
  },

  // Get today's training session (20 minutes)
  getSessionLegends(count = 20) {
    const state = Storage.getUserState();
    const { stats } = Storage.getDailyStats();
    
    // Phase 1: Warmup (20%) - known legends
    const warmupCount = Math.floor(count * 0.2);
    const warmup = this.getWarmupLegends(warmupCount);
    
    // Phase 2: Confusion fix (35%) - high confusion pairs
    const confusionCount = Math.floor(count * 0.35);
    const confusion = this.getConfusionLegends(confusionCount);
    
    // Phase 3: Speed training (25%) - low automation
    const speedCount = Math.floor(count * 0.25);
    const speed = this.getSpeedLegends(speedCount);
    
    // Phase 4: Weakness review (20%) - uncertain legends
    const weaknessCount = count - warmupCount - confusionCount - speedCount;
    const weakness = this.getWeaknessLegends(weaknessCount);
    
    // Combine and deduplicate
    const session = [];
    const seen = new Set();
    
    [...warmup, ...confusion, ...speed, ...weakness].forEach(legend => {
      if (!seen.has(legend.id) && !stats.legends_seen.includes(legend.id)) {
        seen.add(legend.id);
        session.push(legend);
      }
    });
    
    // Fill remaining slots if needed
    if (session.length < count) {
      const remaining = ALL_LEGENDS
        .filter(l => !seen.has(l.id) && !stats.legends_seen.includes(l.id))
        .sort(() => Math.random() - 0.5)
        .slice(0, count - session.length);
      session.push(...remaining);
    }
    
    return session.slice(0, count);
  },

  // Get warmup legends (already somewhat known)
  getWarmupLegends(count) {
    const state = Storage.getUserState();
    return ALL_LEGENDS
      .filter(l => {
        const s = state[l.id];
        return s && s.total_seen > 2 && s.mastery_level !== 'new';
      })
      .sort(() => Math.random() - 0.5)
      .slice(0, count);
  },

  // Get confusion-focused legends
  getConfusionLegends(count) {
    const state = Storage.getUserState();
    return ALL_LEGENDS
      .filter(l => {
        const s = state[l.id];
        return s && s.confusion_risk > 0.3;
      })
      .sort((a, b) => (state[b.id]?.confusion_risk || 0) - (state[a.id]?.confusion_risk || 0))
      .slice(0, count);
  },

  // Get speed-focused legends
  getSpeedLegends(count) {
    const state = Storage.getUserState();
    return ALL_LEGENDS
      .filter(l => {
        const s = state[l.id];
        return s && s.total_seen > 0 && s.speed_score < 0.6;
      })
      .sort((a, b) => (state[a.id]?.speed_score || 0) - (state[b.id]?.speed_score || 0))
      .slice(0, count);
  },

  // Get weakness legends (high uncertainty)
  getWeaknessLegends(count) {
    const state = Storage.getUserState();
    return ALL_LEGENDS
      .filter(l => {
        const s = state[l.id];
        return s && s.uncertainty > 0.4;
      })
      .sort((a, b) => (state[b.id]?.uncertainty || 0) - (state[a.id]?.uncertainty || 0))
      .slice(0, count);
  },

  // Get legends by mastery level
  getLegendsByMastery(level) {
    const state = Storage.getUserState();
    return ALL_LEGENDS.filter(l => state[l.id]?.mastery_level === level);
  },

  // Get statistics
  getStats() {
    const state = Storage.getUserState();
    const levels = { new: 0, learning: 0, stable: 0, automatic: 0 };
    
    Object.values(state).forEach(s => {
      levels[s.mastery_level] = (levels[s.mastery_level] || 0) + 1;
    });
    
    const totalSeen = Object.values(state).filter(s => s.total_seen > 0).length;
    const avgSpeed = Object.values(state)
      .filter(s => s.speed_score > 0)
      .reduce((sum, s) => sum + s.speed_score, 0) / (totalSeen || 1);
    
    return {
      total: ALL_LEGENDS.length,
      seen: totalSeen,
      levels,
      avgSpeed: Math.round(avgSpeed * 100),
      avgRecognition: Math.round(
        Object.values(state).reduce((sum, s) => sum + s.recognition_score, 0) / ALL_LEGENDS.length * 100
      )
    };
  }
};
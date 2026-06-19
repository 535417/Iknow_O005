// Confusion matrix engine for tracking legend confusion relationships

const ConfusionEngine = {
  // Update confusion when user makes a mistake
  updateOnMistake(correctLegendId, selectedLegendId, mode, reactionTime) {
    let weight = 1;
    
    // Weight based on mode and reaction time
    if (mode === 'flash') {
      weight = 2; // Flash mistakes are most severe
    } else if (reactionTime > 1500) {
      weight = 1.5; // Hesitant mistakes
    }
    
    // Update confusion matrix
    Storage.updateConfusionMatrix(correctLegendId, selectedLegendId, weight);
    
    // Update user state for both legends
    const state = Storage.getUserState();
    
    // Update correct legend - increase confusion risk
    if (state[correctLegendId]) {
      state[correctLegendId].confusion_risk = Math.min(1, (state[correctLegendId].confusion_risk || 0) + 0.1);
      state[correctLegendId].uncertainty = Math.min(1, (state[correctLegendId].uncertainty || 0) + 0.05);
    }
    
    // Update selected (wrong) legend - it's being confused with correct one
    if (state[selectedLegendId]) {
      state[selectedLegendId].confusion_risk = Math.min(1, (state[selectedLegendId].confusion_risk || 0) + 0.05);
    }
    
    localStorage.setItem(Storage.KEYS.USER_STATE, JSON.stringify(state));
  },

  // Update when user answers correctly
  updateOnCorrect(legendId, mode, reactionTime) {
    const state = Storage.getUserState();
    if (!state[legendId]) return;
    
    const legendState = state[legendId];
    
    // Decrease confusion risk on correct answer
    legendState.confusion_risk = Math.max(0, (legendState.confusion_risk || 0) * 0.9);
    
    // Update scores based on mode
    // speed > recognition > recall (product goal)
    switch (mode) {
      case 'choice':
        legendState.recognition_score = Math.min(1, (legendState.recognition_score || 0) + 0.05);
        break;
      case 'flip':
        // Lower gain - flip is for exposing gaps, not fast leveling
        legendState.recall_score = Math.min(1, (legendState.recall_score || 0) + 0.03);
        break;
      case 'flash':
        // Higher gain - speed is the ultimate goal
        if (reactionTime < 500) {
          legendState.speed_score = Math.min(1, (legendState.speed_score || 0) + 0.15);
        } else if (reactionTime < 1200) {
          legendState.speed_score = Math.min(1, (legendState.speed_score || 0) + 0.08);
        }
        break;
    }
    
    // Decrease uncertainty
    legendState.uncertainty = Math.max(0, (legendState.uncertainty || 0) * 0.95);
    
    // Update streak
    const today = new Date().toISOString().split('T')[0];
    const lastCorrect = legendState.last_correct ? new Date(legendState.last_correct).toISOString().split('T')[0] : null;
    
    if (lastCorrect === today) {
      // Already correct today, don't increment streak
    } else if (lastCorrect === new Date(Date.now() - 86400000).toISOString().split('T')[0]) {
      legendState.streak = (legendState.streak || 0) + 1;
    } else {
      legendState.streak = 1;
    }
    
    legendState.last_correct = new Date().toISOString();
    legendState.total_correct = (legendState.total_correct || 0) + 1;
    
    localStorage.setItem(Storage.KEYS.USER_STATE, JSON.stringify(state));
  },

  // Update when user answers wrong (no specific target)
  updateOnWrong(legendId, mode) {
    const state = Storage.getUserState();
    if (!state[legendId]) return;
    
    const legendState = state[legendId];
    
    // Increase uncertainty and confusion risk
    legendState.uncertainty = Math.min(1, (legendState.uncertainty || 0) + 0.05);
    legendState.confusion_risk = Math.min(1, (legendState.confusion_risk || 0) + 0.1);
    
    // Decrease scores slightly
    switch (mode) {
      case 'choice':
        legendState.recognition_score = Math.max(0, (legendState.recognition_score || 0) - 0.03);
        break;
      case 'flip':
        legendState.recall_score = Math.max(0, (legendState.recall_score || 0) - 0.05);
        break;
      case 'flash':
        legendState.speed_score = Math.max(0, (legendState.speed_score || 0) - 0.05);
        break;
    }
    
    legendState.streak = 0;
    
    localStorage.setItem(Storage.KEYS.USER_STATE, JSON.stringify(state));
  },

  // Get confusion partners for a legend
  getConfusionPartners(legendId, limit = 5) {
    const matrix = Storage.getConfusionMatrix();
    const partners = [];
    
    // Find all confusion entries for this legend
    Object.entries(matrix).forEach(([key, value]) => {
      const [from, to] = key.split('->');
      if (from === legendId && value > 0) {
        partners.push({ id: to, strength: value });
      }
    });
    
    // Sort by strength and return top N
    return partners
      .sort((a, b) => b.strength - a.strength)
      .slice(0, limit)
      .map(p => {
        const legend = ALL_LEGENDS.find(l => l.id === p.id);
        return { ...legend, confusionStrength: p.strength };
      });
  },

  // Get most confused pairs overall
  getMostConfusedPairs(limit = 10) {
    const matrix = Storage.getConfusionMatrix();
    return Object.entries(matrix)
      .filter(([_, value]) => value > 0)
      .map(([key, value]) => {
        const [from, to] = key.split('->');
        const legendA = ALL_LEGENDS.find(l => l.id === from);
        const legendB = ALL_LEGENDS.find(l => l.id === to);
        return { legendA, legendB, strength: value };
      })
      .filter(p => p.legendA && p.legendB)
      .sort((a, b) => b.strength - a.strength)
      .slice(0, limit);
  },

  // Generate confusion-based distractors for choice mode
  generateDistractors(correctLegendId, count = 3) {
    const matrix = Storage.getConfusionMatrix();
    const state = Storage.getUserState();
    
    // Get confusion partners
    const partners = this.getConfusionPartners(correctLegendId, 10);
    
    // If not enough confusion partners, add random legends from same category
    const correctLegend = ALL_LEGENDS.find(l => l.id === correctLegendId);
    if (partners.length < count) {
      const sameCategory = ALL_LEGENDS
        .filter(l => l.id !== correctLegendId && l.category === correctLegend.category)
        .sort(() => Math.random() - 0.5)
        .slice(0, count - partners.length);
      
      partners.push(...sameCategory.map(l => ({ ...l, confusionStrength: 0 })));
    }
    
    // If still not enough, add random legends
    if (partners.length < count) {
      const random = ALL_LEGENDS
        .filter(l => l.id !== correctLegendId && !partners.find(p => p.id === l.id))
        .sort(() => Math.random() - 0.5)
        .slice(0, count - partners.length);
      
      partners.push(...random.map(l => ({ ...l, confusionStrength: 0 })));
    }
    
    // Shuffle and return requested count
    return partners
      .sort(() => Math.random() - 0.5)
      .slice(0, count);
  },

  // Get legends that are most often confused (source side)
  // These are the legends that need targeted training
  getMostConfusedSources(limit = 10) {
    const matrix = Storage.getConfusionMatrix();
    const sourceConfusion = {};
    
    // Aggregate confusion by source legend
    Object.entries(matrix).forEach(([key, value]) => {
      const [from, to] = key.split('->');
      if (!sourceConfusion[from]) {
        sourceConfusion[from] = { total: 0, targets: {} };
      }
      sourceConfusion[from].total += value;
      sourceConfusion[from].targets[to] = value;
    });
    
    // Convert to array and sort by total confusion
    return Object.entries(sourceConfusion)
      .map(([id, data]) => ({
        id,
        totalConfusion: data.total,
        topTarget: Object.entries(data.targets)
          .sort((a, b) => b[1] - a[1])[0],
        legend: ALL_LEGENDS.find(l => l.id === id)
      }))
      .filter(item => item.legend)
      .sort((a, b) => b.totalConfusion - a.totalConfusion)
      .slice(0, limit)
      .map(item => ({
        ...item.legend,
        totalConfusion: item.totalConfusion,
        topConfusionTarget: item.topTarget ? {
          id: item.topTarget[0],
          name: ALL_LEGENDS.find(l => l.id === item.topTarget[0])?.name,
          strength: item.topTarget[1]
        } : null
      }));
  }
};
// Confusion matrix engine for tracking legend confusion relationships

// Fisher-Yates shuffle (unbiased)
function shuffleConfusion(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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
    
    // Update correct legend - increase confusion risk
    const correctState = Storage.getUserState()[correctLegendId];
    if (correctState) {
      Storage.updateLegendState(correctLegendId, {
        confusion_risk: Math.min(1, (correctState.confusion_risk || 0) + 0.1),
        uncertainty: Math.min(1, (correctState.uncertainty || 0) + 0.05)
      });
    }
    
    // Update selected (wrong) legend
    const selectedState = Storage.getUserState()[selectedLegendId];
    if (selectedState) {
      Storage.updateLegendState(selectedLegendId, {
        confusion_risk: Math.min(1, (selectedState.confusion_risk || 0) + 0.05)
      });
    }
  },

  // Update when user answers correctly
  updateOnCorrect(legendId, mode, reactionTime) {
    const state = Storage.getUserState()[legendId];
    if (!state) return;
    
    const updates = {};
    
    // Decrease confusion risk on correct answer
    updates.confusion_risk = Math.max(0, (state.confusion_risk || 0) * 0.9);
    
    // Update scores based on mode
    switch (mode) {
      case 'choice':
        updates.recognition_score = Math.min(1, (state.recognition_score || 0) + 0.05);
        break;
      case 'flip':
        updates.recall_score = Math.min(1, (state.recall_score || 0) + 0.03);
        break;
      case 'flash':
        if (reactionTime < 500) {
          updates.speed_score = Math.min(1, (state.speed_score || 0) + 0.15);
        } else if (reactionTime < 1200) {
          updates.speed_score = Math.min(1, (state.speed_score || 0) + 0.08);
        }
        break;
    }
    
    // Decrease uncertainty
    updates.uncertainty = Math.max(0, (state.uncertainty || 0) * 0.95);
    
    // Update streak
    const today = new Date().toISOString().split('T')[0];
    const lastCorrect = state.last_correct ? new Date(state.last_correct).toISOString().split('T')[0] : null;
    
    if (lastCorrect === today) {
      // Already correct today, don't increment streak
    } else if (lastCorrect === new Date(Date.now() - 86400000).toISOString().split('T')[0]) {
      updates.streak = (state.streak || 0) + 1;
    } else {
      updates.streak = 1;
    }
    
    updates.last_correct = new Date().toISOString();
    updates.total_correct = (state.total_correct || 0) + 1;
    
    Storage.updateLegendState(legendId, updates);
  },

  // Update when user answers wrong (no specific target)
  updateOnWrong(legendId, mode) {
    const state = Storage.getUserState()[legendId];
    if (!state) return;
    
    const updates = {
      uncertainty: Math.min(1, (state.uncertainty || 0) + 0.05),
      confusion_risk: Math.min(1, (state.confusion_risk || 0) + 0.1),
      streak: 0
    };
    
    // Decrease scores slightly
    switch (mode) {
      case 'choice':
        updates.recognition_score = Math.max(0, (state.recognition_score || 0) - 0.03);
        break;
      case 'flip':
        updates.recall_score = Math.max(0, (state.recall_score || 0) - 0.05);
        break;
      case 'flash':
        updates.speed_score = Math.max(0, (state.speed_score || 0) - 0.05);
        break;
    }
    
    Storage.updateLegendState(legendId, updates);
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
  // Generate confusion-based distractors for choice mode
  // Optimized: if confusion exists, at least 1 confusion distractor
  generateDistractors(correctLegendId, count = 3) {
    const matrix = Storage.getConfusionMatrix();
    const state = Storage.getUserState();
    const correctLegend = ALL_LEGENDS.find(l => l.id === correctLegendId);
    
    if (!correctLegend) return [];
    
    // Get confusion partners (sorted by strength)
    const confusionPartners = this.getConfusionPartners(correctLegendId, 10);
    
    // Get same category legends (excluding correct and already selected)
    const sameCategory = shuffleConfusion(
      ALL_LEGENDS.filter(l => l.id !== correctLegendId && l.category === correctLegend.category)
    );
    
    // Build distractor list
    const result = [];
    const usedIds = new Set([correctLegendId]);
    
    // Step 1: If confusion exists, add at least 1 confusion distractor
    if (confusionPartners.length > 0) {
      const firstConfusion = confusionPartners[0];
      result.push(firstConfusion);
      usedIds.add(firstConfusion.id);
    }
    
    // Step 2: Fill remaining with mix of confusion + same category
    while (result.length < count) {
      let added = false;
      
      // Try to add confusion partner
      for (const partner of confusionPartners) {
        if (!usedIds.has(partner.id) && result.length < count) {
          result.push(partner);
          usedIds.add(partner.id);
          added = true;
          break;
        }
      }
      
      // If no more confusion partners, add from same category
      if (!added) {
        for (const legend of sameCategory) {
          if (!usedIds.has(legend.id) && result.length < count) {
            result.push({ ...legend, confusionStrength: 0 });
            usedIds.add(legend.id);
            added = true;
            break;
          }
        }
      }
      
      // If still not enough, add random
      if (!added) {
        const random = shuffleConfusion(
          ALL_LEGENDS.filter(l => !usedIds.has(l.id))
        );
        
        if (random.length > 0) {
          result.push({ ...random[0], confusionStrength: 0 });
          usedIds.add(random[0].id);
        } else {
          break; // No more legends available
        }
      }
    }
    
    // Shuffle and return
    return shuffleConfusion(result).slice(0, count);
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
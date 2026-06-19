// Training modes: choice, flip, flash

const Training = {
  currentSession: null,
  currentQuestion: null,
  startTime: null,
  timerInterval: null,

  // Start a new training session
  startSession(mode, count = 20) {
    // Dynamic scheduling: only store mode and count
    // Legends will be picked one by one using priority
    this.currentSession = {
      mode: mode === 'auto' ? null : mode,
      targetCount: count,
      answeredIds: [],  // Track answered legend IDs to avoid repeats
      recentIds: [],    // Track recently shown IDs (last 10) for recency penalty
      results: [],
      startTime: Date.now()
    };
    
    return this.currentSession;
  },

  // Get next question - uses dynamic scheduling
  getNextQuestion() {
    if (!this.currentSession) return null;
    if (this.currentSession.results.length >= this.currentSession.targetCount) {
      return null; // Session complete
    }
    
    // Dynamic scheduling: pick next legend based on current priority
    // Pass recentIds for recency penalty
    const legend = Scheduler.pickNextLegend(
      ALL_LEGENDS, 
      this.currentSession.answeredIds,
      this.currentSession.recentIds
    );
    if (!legend) return null; // No more legends available
    
    const state = Storage.getUserState()[legend.id];
    
    // Determine mode for this question
    const mode = this.currentSession.mode || Scheduler.selectMode(state);
    
    this.currentQuestion = {
      legend: legend,
      mode: mode,
      startTime: Date.now(),
      answered: false
    };
    
    // Generate question based on mode
    switch (mode) {
      case 'choice':
        return this.generateChoiceQuestion(legend);
      case 'flip':
        return this.generateFlipQuestion(legend);
      case 'flash':
        return this.generateFlashQuestion(legend);
      default:
        return this.generateChoiceQuestion(legend);
    }
  },

  // Generate choice question (4 options)
  generateChoiceQuestion(legend) {
    const distractors = ConfusionEngine.generateDistractors(legend.id, 3);
    const options = [legend, ...distractors].sort(() => Math.random() - 0.5);
    
    return {
      type: 'choice',
      legend: legend,
      options: options,
      correctIndex: options.findIndex(o => o.id === legend.id),
      timeLimit: 5000 // 5 seconds
    };
  },

  // Generate flip question
  generateFlipQuestion(legend) {
    return {
      type: 'flip',
      legend: legend,
      // User self-reports: sure, unsure, wrong
    };
  },

  // Generate flash question
  generateFlashQuestion(legend) {
    return {
      type: 'flash',
      legend: legend,
      displayTime: 800, // 0.8 seconds
      timeLimit: 3000 // 3 seconds to answer after flash
    };
  },

  // Submit answer for choice mode
  submitChoiceAnswer(selectedIndex, correctIndex) {
    if (!this.currentQuestion) return;
    
    const reactionTime = Date.now() - this.currentQuestion.startTime;
    const isCorrect = selectedIndex === correctIndex;
    const legend = this.currentQuestion.legend;
    
    // Record result
    const result = {
      legendId: legend.id,
      mode: 'choice',
      correct: isCorrect,
      reactionTime: reactionTime,
      selectedOption: this.currentQuestion.options[selectedIndex]?.id,
      correctAnswer: legend.id
    };
    
    this.currentSession.results.push(result);
    this.currentSession.answeredIds.push(legend.id);
    
    // Update recentIds for recency penalty (keep last 10)
    this.currentSession.recentIds.push(legend.id);
    if (this.currentSession.recentIds.length > 10) {
      this.currentSession.recentIds.shift();
    }
    
    // Update state
    if (isCorrect) {
      ConfusionEngine.updateOnCorrect(legend.id, 'choice', reactionTime);
    } else {
      ConfusionEngine.updateOnMistake(
        legend.id,
        this.currentQuestion.options[selectedIndex].id,
        'choice',
        reactionTime
      );
    }
    
    // Update legend state
    const state = Storage.getUserState()[legend.id];
    Storage.updateLegendState(legend.id, {
      last_seen: new Date().toISOString(),
      total_seen: (state.total_seen || 0) + 1
    });
    
    // Log training
    Storage.addTrainingLog(result);
    
    // Update daily stats
    this.updateDailyStats('choice', isCorrect);
    
    this.currentSession.currentIndex++;
    this.currentQuestion = null;
    
    return result;
  },

  // Submit answer for flip mode
  submitFlipAnswer(selfReport) {
    if (!this.currentQuestion) return;
    
    const reactionTime = Date.now() - this.currentQuestion.startTime;
    const legend = this.currentQuestion.legend;
    
    let isCorrect = false;
    switch (selfReport) {
      case 'sure':
        isCorrect = true;
        ConfusionEngine.updateOnCorrect(legend.id, 'flip', reactionTime);
        break;
      case 'unsure':
        // Partial credit
        const state = Storage.getUserState()[legend.id];
        Storage.updateLegendState(legend.id, {
          recall_score: Math.min(1, (state.recall_score || 0) + 0.02),
          uncertainty: Math.min(1, (state.uncertainty || 0) + 0.02)
        });
        break;
      case 'wrong':
        ConfusionEngine.updateOnWrong(legend.id, 'flip');
        break;
    }
    
    const result = {
      legendId: legend.id,
      mode: 'flip',
      selfReport: selfReport,
      correct: isCorrect,
      reactionTime: reactionTime
    };
    
    this.currentSession.results.push(result);
    this.currentSession.answeredIds.push(legend.id);
    
    // Update recentIds for recency penalty (keep last 10)
    this.currentSession.recentIds.push(legend.id);
    if (this.currentSession.recentIds.length > 10) {
      this.currentSession.recentIds.shift();
    }
    
    // Update legend state
    const currentState = Storage.getUserState()[legend.id];
    Storage.updateLegendState(legend.id, {
      last_seen: new Date().toISOString(),
      total_seen: (currentState.total_seen || 0) + 1
    });
    
    // Log training
    Storage.addTrainingLog(result);
    
    // Update daily stats
    this.updateDailyStats('flip', isCorrect);
    
    this.currentSession.currentIndex++;
    this.currentQuestion = null;
    
    return result;
  },

  // Submit answer for flash mode
  submitFlashAnswer(isCorrect, hesitated = false) {
    if (!this.currentQuestion) return;
    
    const reactionTime = Date.now() - this.currentQuestion.startTime;
    const legend = this.currentQuestion.legend;
    
    const result = {
      legendId: legend.id,
      mode: 'flash',
      correct: isCorrect,
      reactionTime: reactionTime,
      hesitated: hesitated
    };
    
    this.currentSession.results.push(result);
    this.currentSession.answeredIds.push(legend.id);
    
    // Update recentIds for recency penalty (keep last 10)
    this.currentSession.recentIds.push(legend.id);
    if (this.currentSession.recentIds.length > 10) {
      this.currentSession.recentIds.shift();
    }
    
    // Update state
    if (isCorrect) {
      ConfusionEngine.updateOnCorrect(legend.id, 'flash', reactionTime);
    } else {
      ConfusionEngine.updateOnWrong(legend.id, 'flash');
    }
    
    // Update legend state
    const state = Storage.getUserState()[legend.id];
    Storage.updateLegendState(legend.id, {
      last_seen: new Date().toISOString(),
      total_seen: (state.total_seen || 0) + 1
    });
    
    // Log training
    Storage.addTrainingLog(result);
    
    // Update daily stats
    this.updateDailyStats('flash', isCorrect);
    
    this.currentSession.currentIndex++;
    this.currentQuestion = null;
    
    return result;
  },

  // Update daily statistics
  updateDailyStats(mode, isCorrect) {
    const { stats } = Storage.getDailyStats();
    
    stats.total++;
    if (isCorrect) {
      stats.correct++;
    } else {
      stats.wrong++;
    }
    
    stats.mode_counts[mode] = (stats.mode_counts[mode] || 0) + 1;
    stats.time_spent = Date.now() - this.currentSession.startTime;
    
    // Add legend to seen list
    const legendId = this.currentQuestion?.legend?.id;
    if (legendId && !stats.legends_seen.includes(legendId)) {
      stats.legends_seen.push(legendId);
    }
    
    Storage.updateDailyStats(stats);
  },

  // Get session summary
  getSessionSummary() {
    if (!this.currentSession) return null;
    
    const results = this.currentSession.results;
    const total = results.length;
    const correct = results.filter(r => r.correct).length;
    const avgReactionTime = results.reduce((sum, r) => sum + r.reactionTime, 0) / (total || 1);
    
    const modeCounts = { choice: 0, flip: 0, flash: 0 };
    results.forEach(r => modeCounts[r.mode]++);
    
    return {
      total,
      correct,
      wrong: total - correct,
      accuracy: Math.round(correct / (total || 1) * 100),
      avgReactionTime: Math.round(avgReactionTime),
      modeCounts,
      duration: Date.now() - this.currentSession.startTime,
      legends: results.map(r => r.legendId)
    };
  },

  // End current session
  endSession() {
    const summary = this.getSessionSummary();
    this.currentSession = null;
    this.currentQuestion = null;
    return summary;
  },

  // Cancel current session
  cancelSession() {
    this.currentSession = null;
    this.currentQuestion = null;
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }
};
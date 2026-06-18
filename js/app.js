// Main application logic and UI

const App = {
  currentView: 'home',
  currentTraining: null,
  flashTimer: null,
  choiceTimer: null,

  // Initialize app
  init() {
    // Ensure user state exists
    if (!localStorage.getItem(Storage.KEYS.USER_STATE)) {
      Storage.initUserState();
    }
    
    this.bindEvents();
    this.showView('home');
    this.updateHomeStats();
  },

  // Bind global events
  bindEvents() {
    // Navigation
    document.querySelectorAll('[data-view]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        this.showView(el.dataset.view);
      });
    });
    
    // Search
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchLegends(e.target.value);
      });
    }
    
    // Standard filter tabs
    document.querySelectorAll('.std-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('.std-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.filterByStandard(tab.dataset.std);
      });
    });
    
    // Category filter
    const categoryFilter = document.getElementById('categoryFilter');
    if (categoryFilter) {
      categoryFilter.addEventListener('change', (e) => {
        this.filterByCategory(e.target.value);
      });
    }
  },

  // Show view
  showView(view) {
    this.currentView = view;
    
    // Hide all views
    document.querySelectorAll('.view').forEach(v => {
      v.classList.remove('active');
    });
    
    // Show target view
    const targetView = document.getElementById(view + 'View');
    if (targetView) {
      targetView.classList.add('active');
    }
    
    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === view);
    });
    
    // Load view content
    switch (view) {
      case 'home':
        this.updateHomeStats();
        break;
      case 'library':
        this.renderLibrary();
        break;
      case 'training':
        this.showTrainingSetup();
        break;
    }
  },

  // Update home statistics
  updateHomeStats() {
    const stats = Scheduler.getStats();
    const dailyStats = Storage.getDailyStats();
    
    // Update stat cards
    document.getElementById('totalSeen').textContent = stats.seen;
    document.getElementById('avgSpeed').textContent = stats.avgSpeed + '%';
    document.getElementById('todayCount').textContent = dailyStats.stats.total;
    
    // Update mastery levels
    document.getElementById('newCount').textContent = stats.levels.new;
    document.getElementById('learningCount').textContent = stats.levels.learning;
    document.getElementById('stableCount').textContent = stats.levels.stable;
    document.getElementById('automaticCount').textContent = stats.levels.automatic;
    
    // Update progress bar
    const progress = Math.round(stats.seen / stats.total * 100);
    document.getElementById('progressBar').style.width = progress + '%';
    document.getElementById('progressText').textContent = progress + '%';
    
    // Render weak legends
    this.renderWeakLegends();
    
    // Render recommended
    this.renderRecommended();
  },

  // Render weak legends on home page
  renderWeakLegends() {
    const weak = Storage.getWeakLegends(5);
    const container = document.getElementById('weakLegends');
    
    if (weak.length === 0) {
      container.innerHTML = '<div class="empty-hint">暂无弱点图例，继续保持！</div>';
      return;
    }
    
    container.innerHTML = weak.map(legend => `
      <div class="weak-item" data-id="${legend.id}">
        <img src="${legend.icon}" alt="${legend.name}" class="weak-icon">
        <div class="weak-info">
          <div class="weak-name">${legend.name}</div>
          <div class="weak-tags">
            ${legend.state.confusion_risk > 0.5 ? '<span class="tag tag-confusion">易混淆</span>' : ''}
            ${legend.state.uncertainty > 0.5 ? '<span class="tag tag-uncertain">不确定</span>' : ''}
            ${legend.state.speed_score < 0.3 ? '<span class="tag tag-slow">反应慢</span>' : ''}
          </div>
        </div>
        <button class="btn-practice" data-id="${legend.id}">练习</button>
      </div>
    `).join('');
    
    // Bind practice buttons
    container.querySelectorAll('.btn-practice').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.startSinglePractice(btn.dataset.id);
      });
    });
    
    // Bind item clicks for detail
    container.querySelectorAll('.weak-item').forEach(item => {
      item.addEventListener('click', () => {
        this.showLegendDetail(item.dataset.id);
      });
    });
  },

  // Render recommended legends
  renderRecommended() {
    const recommended = Storage.getTodayRecommended(8);
    const container = document.getElementById('recommended');
    
    if (recommended.length === 0) {
      container.innerHTML = '<div class="empty-hint">今日训练已完成！</div>';
      return;
    }
    
    container.innerHTML = recommended.map(legend => `
      <div class="rec-item" data-id="${legend.id}">
        <img src="${legend.icon}" alt="${legend.name}" class="rec-icon">
        <div class="rec-name">${legend.name}</div>
      </div>
    `).join('');
    
    container.querySelectorAll('.rec-item').forEach(item => {
      item.addEventListener('click', () => {
        this.showLegendDetail(item.dataset.id);
      });
    });
  },

  // Start single legend practice
  startSinglePractice(legendId) {
    const legend = ALL_LEGENDS.find(l => l.id === legendId);
    if (!legend) return;
    
    Training.startSession('auto', 1);
    Training.currentSession.legends = [legend];
    Training.currentSession.currentIndex = 0;
    
    this.showView('training');
    this.showTrainingQuestion();
  },

  // Show training setup
  showTrainingSetup() {
    const setupHtml = `
      <div class="training-setup">
        <h2>选择训练模式</h2>
        <div class="mode-cards">
          <div class="mode-card" data-mode="auto">
            <div class="mode-icon">🎯</div>
            <div class="mode-name">智能训练</div>
            <div class="mode-desc">系统自动安排，平衡提升</div>
          </div>
          <div class="mode-card" data-mode="choice">
            <div class="mode-icon">📝</div>
            <div class="mode-name">选择题</div>
            <div class="mode-desc">识别能力训练</div>
          </div>
          <div class="mode-card" data-mode="flip">
            <div class="mode-icon">🔄</div>
            <div class="mode-name">翻转卡</div>
            <div class="mode-desc">回忆能力训练</div>
          </div>
          <div class="mode-card" data-mode="flash">
            <div class="mode-icon">⚡</div>
            <div class="mode-name">闪卡</div>
            <div class="mode-desc">秒认能力训练</div>
          </div>
        </div>
        <div class="count-selector">
          <label>题目数量：</label>
          <select id="questionCount">
            <option value="10">10 题 (~5分钟)</option>
            <option value="20" selected>20 题 (~10分钟)</option>
            <option value="30">30 题 (~15分钟)</option>
            <option value="40">40 题 (~20分钟)</option>
          </select>
        </div>
        <button id="startTraining" class="btn-primary">开始训练</button>
      </div>
    `;
    
    document.getElementById('trainingContent').innerHTML = setupHtml;
    
    // Bind mode selection
    let selectedMode = 'auto';
    document.querySelectorAll('.mode-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        selectedMode = card.dataset.mode;
      });
    });
    
    // Default select auto
    document.querySelector('.mode-card[data-mode="auto"]').classList.add('selected');
    
    // Bind start button
    document.getElementById('startTraining').addEventListener('click', () => {
      const count = parseInt(document.getElementById('questionCount').value);
      Training.startSession(selectedMode, count);
      this.showTrainingQuestion();
    });
  },

  // Show training question
  showTrainingQuestion() {
    const question = Training.getNextQuestion();
    
    if (!question) {
      this.showTrainingSummary();
      return;
    }
    
    switch (question.type) {
      case 'choice':
        this.showChoiceQuestion(question);
        break;
      case 'flip':
        this.showFlipQuestion(question);
        break;
      case 'flash':
        this.showFlashQuestion(question);
        break;
    }
    
    // Update progress
    this.updateTrainingProgress();
  },

  // Show choice question
  showChoiceQuestion(question) {
    const container = document.getElementById('trainingContent');
    
    container.innerHTML = `
      <div class="question-header">
        <span class="question-type">选择题</span>
        <span class="question-progress">${Training.currentSession.currentIndex + 1}/${Training.currentSession.legends.length}</span>
      </div>
      <div class="question-timer">
        <div class="timer-bar" id="timerBar"></div>
      </div>
      <div class="question-image">
        <img src="${question.legend.icon}" alt="${question.legend.name}">
      </div>
      <div class="question-prompt">这个图例是什么？</div>
      <div class="options-grid">
        ${question.options.map((opt, idx) => `
          <button class="option-btn" data-index="${idx}">
            <img src="${opt.icon}" alt="${opt.name}">
            <span>${opt.name}</span>
          </button>
        `).join('')}
      </div>
    `;
    
    // Start timer
    this.startChoiceTimer(question.timeLimit);
    
    // Bind option clicks
    container.querySelectorAll('.option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!Training.currentQuestion?.answered) {
          Training.currentQuestion.answered = true;
          this.stopChoiceTimer();
          
          const selectedIndex = parseInt(btn.dataset.index);
          const result = Training.submitChoiceAnswer(selectedIndex, question.correctIndex);
          
          // Show feedback
          this.showChoiceFeedback(selectedIndex, question.correctIndex, result);
        }
      });
    });
  },

  // Start choice timer
  startChoiceTimer(timeLimit) {
    const timerBar = document.getElementById('timerBar');
    if (!timerBar) return;
    
    const startTime = Date.now();
    
    this.choiceTimer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / timeLimit, 1);
      timerBar.style.width = (progress * 100) + '%';
      
      if (progress >= 1) {
        this.stopChoiceTimer();
        if (!Training.currentQuestion?.answered) {
          Training.currentQuestion.answered = true;
          Training.submitChoiceAnswer(-1, question.correctIndex);
          this.showChoiceFeedback(-1, question.correctIndex, { correct: false });
        }
      }
    }, 50);
  },

  // Stop choice timer
  stopChoiceTimer() {
    if (this.choiceTimer) {
      clearInterval(this.choiceTimer);
      this.choiceTimer = null;
    }
  },

  // Show choice feedback
  showChoiceFeedback(selectedIndex, correctIndex, result) {
    const options = document.querySelectorAll('.option-btn');
    
    options.forEach((btn, idx) => {
      if (idx === correctIndex) {
        btn.classList.add('correct');
      } else if (idx === selectedIndex && !result.correct) {
        btn.classList.add('wrong');
      }
      btn.disabled = true;
    });
    
    // Auto advance after delay
    setTimeout(() => {
      this.showTrainingQuestion();
    }, 1500);
  },

  // Show flip question
  showFlipQuestion(question) {
    const container = document.getElementById('trainingContent');
    
    container.innerHTML = `
      <div class="question-header">
        <span class="question-type">翻转卡</span>
        <span class="question-progress">${Training.currentSession.currentIndex + 1}/${Training.currentSession.legends.length}</span>
      </div>
      <div class="flip-card" id="flipCard">
        <div class="flip-front">
          <div class="question-image">
            <img src="${question.legend.icon}" alt="图例">
          </div>
          <div class="flip-hint">点击翻转查看答案</div>
        </div>
        <div class="flip-back">
          <div class="answer-name">${question.legend.name}</div>
          <div class="answer-en">${question.legend.name_en}</div>
          <div class="answer-desc">${question.legend.description?.substring(0, 100)}...</div>
        </div>
      </div>
      <div class="self-report" id="selfReport" style="display:none">
        <div class="report-prompt">你回答得如何？</div>
        <div class="report-buttons">
          <button class="report-btn report-sure" data-report="sure">✔ 完全正确</button>
          <button class="report-btn report-unsure" data-report="unsure">⚠ 模糊记得</button>
          <button class="report-btn report-wrong" data-report="wrong">✘ 完全不会</button>
        </div>
      </div>
    `;
    
    // Bind flip
    const flipCard = document.getElementById('flipCard');
    const selfReport = document.getElementById('selfReport');
    
    flipCard.addEventListener('click', () => {
      flipCard.classList.add('flipped');
      selfReport.style.display = 'block';
    });
    
    // Bind report buttons
    selfReport.querySelectorAll('.report-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const result = Training.submitFlipAnswer(btn.dataset.report);
        this.showTrainingQuestion();
      });
    });
  },

  // Show flash question
  showFlashQuestion(question) {
    const container = document.getElementById('trainingContent');
    
    container.innerHTML = `
      <div class="question-header">
        <span class="question-type">闪卡</span>
        <span class="question-progress">${Training.currentSession.currentIndex + 1}/${Training.currentSession.legends.length}</span>
      </div>
      <div class="flash-area" id="flashArea">
        <div class="flash-image" id="flashImage">
          <img src="${question.legend.icon}" alt="图例">
        </div>
        <div class="flash-timer" id="flashTimer">准备中...</div>
      </div>
      <div class="flash-answer" id="flashAnswer" style="display:none">
        <div class="answer-prompt">你认识这个图例吗？</div>
        <div class="answer-buttons">
          <button class="answer-btn answer-correct" data-correct="true">✔ 认识</button>
          <button class="answer-btn answer-wrong" data-correct="false">✘ 不认识</button>
        </div>
        <div class="hesitate-option">
          <label>
            <input type="checkbox" id="hesitated"> 我犹豫了
          </label>
        </div>
      </div>
    `;
    
    // Flash sequence
    const flashImage = document.getElementById('flashImage');
    const flashTimer = document.getElementById('flashTimer');
    const flashAnswer = document.getElementById('flashAnswer');
    
    // Show image
    flashTimer.textContent = '请记住这个图例...';
    
    // Hide after displayTime
    this.flashTimer = setTimeout(() => {
      flashImage.style.opacity = '0';
      flashTimer.textContent = '图例已消失';
      
      // Show answer buttons
      setTimeout(() => {
        flashAnswer.style.display = 'block';
      }, 300);
    }, question.displayTime);
    
    // Bind answer buttons
    flashAnswer.querySelectorAll('.answer-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const isCorrect = btn.dataset.correct === 'true';
        const hesitated = document.getElementById('hesitated')?.checked || false;
        Training.submitFlashAnswer(isCorrect, hesitated);
        this.showTrainingQuestion();
      });
    });
  },

  // Update training progress
  updateTrainingProgress() {
    if (!Training.currentSession) return;
    
    const progress = Training.currentSession.currentIndex / Training.currentSession.legends.length * 100;
    const progressBar = document.getElementById('trainingProgress');
    if (progressBar) {
      progressBar.style.width = progress + '%';
    }
  },

  // Show training summary
  showTrainingSummary() {
    const summary = Training.getSessionSummary();
    Training.endSession();
    
    const container = document.getElementById('trainingContent');
    
    container.innerHTML = `
      <div class="training-summary">
        <div class="summary-icon">🎉</div>
        <h2>训练完成！</h2>
        
        <div class="summary-stats">
          <div class="summary-stat">
            <div class="stat-value">${summary.total}</div>
            <div class="stat-label">总题数</div>
          </div>
          <div class="summary-stat">
            <div class="stat-value">${summary.accuracy}%</div>
            <div class="stat-label">正确率</div>
          </div>
          <div class="summary-stat">
            <div class="stat-value">${summary.avgReactionTime}ms</div>
            <div class="stat-label">平均反应</div>
          </div>
        </div>
        
        <div class="summary-modes">
          <div class="mode-stat">
            <span class="mode-icon">📝</span>
            <span>选择题：${summary.modeCounts.choice}</span>
          </div>
          <div class="mode-stat">
            <span class="mode-icon">🔄</span>
            <span>翻转卡：${summary.modeCounts.flip}</span>
          </div>
          <div class="mode-stat">
            <span class="mode-icon">⚡</span>
            <span>闪卡：${summary.modeCounts.flash}</span>
          </div>
        </div>
        
        <div class="summary-actions">
          <button class="btn-primary" onclick="App.showView('home')">返回首页</button>
          <button class="btn-secondary" onclick="App.showView('training')">继续训练</button>
        </div>
      </div>
    `;
  },

  // Render library
  renderLibrary() {
    const container = document.getElementById('libraryContent');
    const state = Storage.getUserState();
    
    container.innerHTML = ALL_LEGENDS.map(legend => `
      <div class="legend-card" data-id="${legend.id}" data-std="${legend.standard}" data-cat="${legend.category}">
        <div class="legend-icon">
          <img src="${legend.icon}" alt="${legend.name}" loading="lazy">
        </div>
        <div class="legend-info">
          <div class="legend-code">${legend.code}</div>
          <div class="legend-name">${legend.name}</div>
          <div class="legend-en">${legend.name_en}</div>
        </div>
        <div class="legend-status">
          <div class="status-dot ${state[legend.id]?.mastery_level || 'new'}"></div>
        </div>
      </div>
    `).join('');
    
    // Bind clicks
    container.querySelectorAll('.legend-card').forEach(card => {
      card.addEventListener('click', () => {
        this.showLegendDetail(card.dataset.id);
      });
    });
  },

  // Search legends
  searchLegends(query) {
    const q = query.toLowerCase().trim();
    const cards = document.querySelectorAll('.legend-card');
    
    cards.forEach(card => {
      const id = card.dataset.id;
      const legend = ALL_LEGENDS.find(l => l.id === id);
      if (!legend) return;
      
      const match = !q || 
        legend.code.toLowerCase().includes(q) ||
        legend.name.toLowerCase().includes(q) ||
        legend.name_en.toLowerCase().includes(q);
      
      card.style.display = match ? 'flex' : 'none';
    });
  },

  // Filter by standard
  filterByStandard(std) {
    const cards = document.querySelectorAll('.legend-card');
    cards.forEach(card => {
      if (std === 'all' || card.dataset.std === std) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  },

  // Filter by category
  filterByCategory(category) {
    const cards = document.querySelectorAll('.legend-card');
    cards.forEach(card => {
      if (!category || card.dataset.cat === category) {
        card.style.display = 'flex';
      } else {
        card.style.display = 'none';
      }
    });
  },

  // Show legend detail
  showLegendDetail(legendId) {
    const legend = ALL_LEGENDS.find(l => l.id === legendId);
    if (!legend) return;
    
    const state = Storage.getUserState()[legendId];
    const partners = ConfusionEngine.getConfusionPartners(legendId);
    const isFav = Storage.getFavorites().includes(legendId);
    
    const container = document.getElementById('detailContent');
    
    container.innerHTML = `
      <div class="detail-header">
        <button class="btn-back" onclick="App.showView('library')">← 返回</button>
        <button class="btn-fav ${isFav ? 'active' : ''}" data-id="${legendId}">
          ${isFav ? '★' : '☆'}
        </button>
      </div>
      
      <div class="detail-image">
        <img src="${legend.icon}" alt="${legend.name}">
      </div>
      
      <div class="detail-info">
        <div class="detail-code">${legend.code}</div>
        <div class="detail-name">${legend.name}</div>
        <div class="detail-en">${legend.name_en}</div>
        <div class="detail-standard">${STANDARD_NAMES[legend.standard]}</div>
        <div class="detail-category">${CATEGORY_NAMES[legend.category] || legend.category}</div>
      </div>
      
      <div class="detail-scores">
        <h3>记忆状态</h3>
        <div class="score-bars">
          <div class="score-item">
            <span class="score-label">识别能力</span>
            <div class="score-bar">
              <div class="score-fill" style="width:${(state?.recognition_score || 0) * 100}%"></div>
            </div>
            <span class="score-value">${Math.round((state?.recognition_score || 0) * 100)}%</span>
          </div>
          <div class="score-item">
            <span class="score-label">回忆能力</span>
            <div class="score-bar">
              <div class="score-fill" style="width:${(state?.recall_score || 0) * 100}%"></div>
            </div>
            <span class="score-value">${Math.round((state?.recall_score || 0) * 100)}%</span>
          </div>
          <div class="score-item">
            <span class="score-label">秒认能力</span>
            <div class="score-bar">
              <div class="score-fill" style="width:${(state?.speed_score || 0) * 100}%"></div>
            </div>
            <span class="score-value">${Math.round((state?.speed_score || 0) * 100)}%</span>
          </div>
          <div class="score-item">
            <span class="score-label">混淆风险</span>
            <div class="score-bar risk">
              <div class="score-fill" style="width:${(state?.confusion_risk || 0) * 100}%"></div>
            </div>
            <span class="score-value">${Math.round((state?.confusion_risk || 0) * 100)}%</span>
          </div>
        </div>
      </div>
      
      ${partners.length > 0 ? `
        <div class="detail-confusion">
          <h3>易混淆图例</h3>
          <div class="confusion-list">
            ${partners.map(p => `
              <div class="confusion-item" data-id="${p.id}">
                <img src="${p.icon}" alt="${p.name}">
                <span>${p.name}</span>
                <span class="confusion-strength">${Math.round(p.confusionStrength * 100)}%</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
      
      <div class="detail-desc">
        <h3>描述</h3>
        <p>${legend.description || '暂无描述'}</p>
      </div>
      
      <div class="detail-actions">
        <button class="btn-primary" onclick="App.startSinglePractice('${legendId}')">开始练习</button>
      </div>
    `;
    
    // Bind favorite toggle
    container.querySelector('.btn-fav')?.addEventListener('click', (e) => {
      Storage.toggleFavorite(legendId);
      e.target.classList.toggle('active');
      e.target.textContent = e.target.classList.contains('active') ? '★' : '☆';
    });
    
    // Bind confusion item clicks
    container.querySelectorAll('.confusion-item').forEach(item => {
      item.addEventListener('click', () => {
        this.showLegendDetail(item.dataset.id);
      });
    });
    
    this.showView('detail');
  }
};
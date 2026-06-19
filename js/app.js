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
    
    // Update uncertainty based on time since last verification
    Storage.updateUncertaintyByTime();
    
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
    
    // Update header title based on view
    const headerTitle = document.getElementById('headerTitle');
    const headerSubtitle = document.getElementById('headerSubtitle');
    
    switch (view) {
      case 'home':
      case 'training':
        headerTitle.textContent = '定向越野图例训练';
        headerSubtitle.textContent = 'Orienteering Legend Training System';
        break;
      case 'library':
        headerTitle.textContent = '🗺️ 定向地图图例库';
        headerSubtitle.textContent = 'Orienteering Map Legend Reference';
        break;
    }
    
    // Load view content
    switch (view) {
      case 'home':
        this.updateHomeStats();
        break;
      case 'library':
        // iframe loaded, no need to render
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
        <span class="question-progress">${Training.currentSession.results.length + 1}/${Training.currentSession.targetCount}</span>
      </div>
      <div class="question-timer">
        <div class="timer-bar" id="timerBar"></div>
      </div>
      <div class="question-image">
        <img src="${question.legend.icon}" alt="${question.legend.name}">
      </div>
      <div class="question-prompt">这个图例的含义是？</div>
      <div class="options-grid">
        ${question.options.map((opt, idx) => `
          <button class="option-btn" data-index="${idx}">
            <span class="option-text">${opt.name}</span>
          </button>
        `).join('')}
      </div>
    `;
    
    // Start timer
    this.startChoiceTimer(question.timeLimit);
    
    // Bind option clicks using event delegation (more reliable)
    const optionsGrid = container.querySelector('.options-grid');
    optionsGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('.option-btn');
      if (!btn || Training.currentQuestion?.answered) return;
      
      Training.currentQuestion.answered = true;
      this.stopChoiceTimer();
      
      const selectedIndex = parseInt(btn.dataset.index);
      const result = Training.submitChoiceAnswer(selectedIndex, question.correctIndex);
      
      // Show feedback
      this.showChoiceFeedback(selectedIndex, question.correctIndex, result);
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
    const container = document.getElementById('trainingContent');
    const options = container.querySelectorAll('.option-btn');
    
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
      App.showTrainingQuestion();
    }, 1500);
  },

  // Show flip question
  showFlipQuestion(question) {
    const container = document.getElementById('trainingContent');
    
    container.innerHTML = `
      <div class="question-header">
        <span class="question-type">翻转卡</span>
        <span class="question-progress">${Training.currentSession.results.length + 1}/${Training.currentSession.targetCount}</span>
      </div>
      <div class="flip-container">
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
        <span class="question-progress">${Training.currentSession.results.length + 1}/${Training.currentSession.targetCount}</span>
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

  // Update training progress - uses dynamic scheduling
  updateTrainingProgress() {
    if (!Training.currentSession) return;
    
    const progress = Training.currentSession.results.length / Training.currentSession.targetCount * 100;
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

  // Library state
  libraryCollapseState: {},
  libraryEventsBound: false,

  // Render library - O-legend style layout
  renderLibrary() {
    const container = document.getElementById('libraryContent');
    
    // Group by standard
    const groups = { issprom2019: [], isom2017: [], iscd2018: [] };
    ALL_LEGENDS.forEach(legend => {
      if (groups[legend.standard]) {
        groups[legend.standard].push(legend);
      }
    });
    
    const stdOrder = ['issprom2019', 'isom2017', 'iscd2018'];
    const stdLabels = {
      issprom2019: 'ISSprOM 2019-2',
      isom2017: 'ISOM 2017-2',
      iscd2018: 'ISCD 2018'
    };
    
    const catMap = {
      issprom2019: {
        1: '地貌', 2: '岩壁和石块', 3: '水体和沼泽', 4: '植被', 
        5: '人工地物', 6: '技术符号', 7: '线路设计符号'
      },
      isom2017: {
        1: '地貌', 2: '岩壁和石块', 3: '水体和沼泽', 4: '植被', 
        5: '人工地物', 6: '技术符号', 7: '线路设计符号'
      },
      iscd2018: {
        0: '位置信息', 1: '地貌', 2: '岩壁和石块', 3: '水体和沼泽', 
        4: '植被', 5: '人工地物', 6: '突出地物', 8: '外观信息',
        10: '组合', 11: '拐弯', 12: '点标旗位置', 13: '其他', 15: '强制通道'
      }
    };
    
    function getCategoryForLegend(legend) {
      const num = parseFloat(legend.code);
      if (legend.standard === 'iscd2018') {
        if (num === 0) return 0;
        if (num >= 1 && num < 2) return 1;
        if (num >= 2 && num < 3) return 2;
        if (num >= 3 && num < 4) return 3;
        if (num >= 4 && num < 5) return 4;
        if (num >= 5 && num < 6) return 5;
        if (num >= 6 && num < 7) return 6;
        if (num >= 8 && num < 9) return 8;
        if (num >= 10 && num < 11) return 10;
        if (num >= 11 && num < 12) return 11;
        if (num >= 12 && num < 13) return 12;
        if (num >= 13 && num < 14) return 13;
        if (num >= 15) return 15;
        return -1;
      }
      if (num >= 100 && num < 200) return 1;
      if (num >= 200 && num < 300) return 2;
      if (num >= 300 && num < 400) return 3;
      if (num >= 400 && num < 500) return 4;
      if (num >= 500 && num < 600) return 5;
      if (num >= 600 && num < 700) return 6;
      if (num >= 700) return 7;
      return -1;
    }
    
    // Build HTML
    let html = '<div class="list-wrap">';
    
    stdOrder.forEach(std => {
      const stdItems = groups[std];
      if (!stdItems || stdItems.length === 0) return;
      
      const isStdCollapsed = this.libraryCollapseState[std] !== undefined 
        ? this.libraryCollapseState[std] 
        : (std !== 'issprom2019');
      
      const stdCollapsedCls = isStdCollapsed ? ' collapsed' : '';
      
      html += `<div class="group-header${stdCollapsedCls}" data-std-group="${std}">
        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        <span>${stdLabels[std]} <small>· ${stdItems.length} 项</small></span>
      </div>`;
      
      html += `<div class="group-items${stdCollapsedCls}" data-std-group="${std}">`;
      
      // Group by category
      const categories = {};
      stdItems.forEach(item => {
        const cat = getCategoryForLegend(item);
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(item);
      });
      
      const catKeys = Object.keys(categories).sort((a, b) => a - b);
      const cats = catMap[std] || {};
      
      catKeys.forEach(catId => {
        const catItems = categories[catId];
        const catName = cats[catId] || '其他';
        
        const catKey = `${std}_${catId}`;
        const isCatCollapsed = this.libraryCollapseState[catKey] !== undefined 
          ? this.libraryCollapseState[catKey] 
          : true;
        
        const catCollapsedCls = isCatCollapsed ? ' collapsed' : '';
        
        html += `<div class="group-header cat-header${catCollapsedCls}" data-cat="${catKey}">
          <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          <span>${catName} <small>· ${catItems.length} 项</small></span>
        </div>`;
        
        html += `<div class="group-items cat-items${catCollapsedCls}" data-cat="${catKey}">`;
        catItems.forEach(legend => {
          html += `<div class="card" data-std="${legend.standard}" data-id="${legend.id}">
            <div class="img-col"><div class="img-wrap"><img src="${legend.icon}" alt="${legend.code} ${legend.name}" loading="lazy"></div></div>
            <div class="text-col">
              <div class="code">${legend.code}</div>
              <div class="name">${legend.name}</div>
              ${legend.name_en ? `<div class="en-sub">${legend.name_en}</div>` : ''}
            </div>
          </div>`;
        });
        html += '</div>';
      });
      
      html += '</div>';
    });
    
    html += '</div>';
    container.innerHTML = html;
    
    // Bind events only once (event delegation)
    if (!this.libraryEventsBound) {
      this.libraryEventsBound = true;
      
      container.addEventListener('click', (e) => {
        // Card click -> open detail
        const card = e.target.closest('.card');
        if (card) {
          this.showLegendDetail(card.dataset.id);
          return;
        }
        
        // Group header click -> toggle collapse
        const header = e.target.closest('.group-header');
        if (header) {
          const stdGroup = header.dataset.stdGroup;
          const catGroup = header.dataset.cat;
          
          if (stdGroup) {
            // Toggle standard group
            const items = container.querySelector(`.group-items[data-std-group="${stdGroup}"]`);
            if (items) {
              header.classList.toggle('collapsed');
              items.classList.toggle('collapsed');
              this.libraryCollapseState[stdGroup] = header.classList.contains('collapsed');
            }
          } else if (catGroup) {
            // Toggle category group
            const items = container.querySelector(`.group-items[data-cat="${catGroup}"]`);
            if (items) {
              header.classList.toggle('collapsed');
              items.classList.toggle('collapsed');
              this.libraryCollapseState[catGroup] = header.classList.contains('collapsed');
            }
          }
        }
      });
    }
  },

  // Search legends
  searchLegends(query) {
    const q = query.toLowerCase().trim();
    
    if (!q) {
      this.renderLibrary();
      return;
    }
    
    // Search mode: show matching items grouped by standard
    const results = { issprom2019: [], isom2017: [], iscd2018: [] };
    ALL_LEGENDS.forEach(legend => {
      const match = legend.code.toLowerCase().includes(q) ||
        legend.name.toLowerCase().includes(q) ||
        legend.name_en.toLowerCase().includes(q);
      
      if (match && results[legend.standard]) {
        results[legend.standard].push(legend);
      }
    });
    
    const container = document.getElementById('libraryContent');
    const stdLabels = {
      issprom2019: 'ISSprOM 2019-2',
      isom2017: 'ISOM 2017-2',
      iscd2018: 'ISCD 2018'
    };
    
    const stdOrder = ['issprom2019', 'isom2017', 'iscd2018'];
    let html = '<div class="list-wrap">';
    let totalResults = 0;
    
    stdOrder.forEach(std => {
      const items = results[std];
      if (items.length === 0) return;
      totalResults += items.length;
      
      html += `<div class="group-header" data-std-group="${std}">
        <svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        <span>${stdLabels[std]} <small>· ${items.length} 个结果</small></span>
      </div>`;
      
      html += `<div class="group-items" data-std-group="${std}">`;
      items.forEach(legend => {
        html += `<div class="card" data-std="${legend.standard}" data-id="${legend.id}">
          <div class="img-col"><div class="img-wrap"><img src="${legend.icon}" alt="${legend.code} ${legend.name}" loading="lazy"></div></div>
          <div class="text-col">
            <div class="code">${legend.code}</div>
            <div class="name">${legend.name}</div>
            ${legend.name_en ? `<div class="en-sub">${legend.name_en}</div>` : ''}
          </div>
        </div>`;
      });
      html += '</div>';
    });
    
    html += '</div>';
    
    if (totalResults === 0) {
      container.innerHTML = '<div class="empty-hint">没有找到匹配的图例</div>';
    } else {
      container.innerHTML = html;
    }
  },

  // Filter by standard (kept for compatibility but not used in new UI)
  filterByStandard(std) {
    // No longer needed - standards are grouped in the main view
  },

  // Filter by category (kept for compatibility but not used in new UI)
  filterByCategory(category) {
    // No longer needed - categories are grouped within standards
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
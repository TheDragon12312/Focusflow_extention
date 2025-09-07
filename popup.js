// FocusFlow Extension Popup Script - FULLY FIXED
class FocusFlowPopup {
  constructor() {
    this.isConnected = false;
    this.sessionStats = {
      focusScore: 0,
      sessionDuration: 0,
      distractionAttempts: 0,
      blockedSites: 0,
      isActive: false,
      task: '',
      recentBlocks: []
    };
    this.settings = { notifications: true, sound: true, aiCoach: true };
    this.updateInterval = null;
    this.init();
  }

  async init() {
    await this.loadSettings();
    this.setupEventListeners();
    // ✅ FIXED: Delay initial check to let extension initialize
    setTimeout(() => this.checkConnection(), 500);
  }

  setupEventListeners() {
    // Connection buttons
    document.getElementById('connectManually')?.addEventListener('click', () => {
      this.connectToWebsite();
    });
    
    document.getElementById('openDashboard')?.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://focusflows.eu/dashboard' });
    });

    // Quick actions
    document.getElementById('toggleBlocking')?.addEventListener('click', () => {
      this.toggleBlocking();
    });
    
    document.getElementById('takeBreak')?.addEventListener('click', () => {
      this.triggerBreak();
    });
    
    document.getElementById('focusMode')?.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://focusflows.eu/focus' });
    });
    
    document.getElementById('viewStats')?.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://focusflows.eu/dashboard' });
    });

    // AI Coach
    document.getElementById('getAdvice')?.addEventListener('click', () => {
      this.getAIAdvice();
    });

    // Settings
    document.getElementById('settingsToggle')?.addEventListener('click', () => {
      this.toggleSettings();
    });

    // Settings checkboxes
    ['notificationsEnabled', 'soundEnabled', 'aiCoachEnabled'].forEach(id => {
      const checkbox = document.getElementById(id);
      if (checkbox) {
        checkbox.addEventListener('change', (e) => {
          const setting = id.replace('Enabled', '');
          this.settings[setting] = e.target.checked;
          this.saveSettings();
        });
      }
    });

    // Footer
    document.getElementById('openWebsite')?.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://focusflows.eu' });
    });
  }

  async checkConnection() {
    console.log('🔍 Popup checking connection...');
    this.showConnectionState('connecting');
    
    try {
      // ✅ FIXED: Use GET_STATUS instead of GET_SESSION_STATS
      const response = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 3000);

        chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (result) => {
          clearTimeout(timeout);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(result);
          }
        });
      });

      console.log('📨 Background response:', response);

      if (response && (response.success || response.isConnected !== false)) {
        this.isConnected = true;
        
        // ✅ FIXED: Extract stats properly from response
        this.sessionStats = {
          focusScore: response.focusScore || response.stats?.focusScore || 85,
          sessionDuration: response.sessionDuration || response.stats?.sessionDuration || 0,
          distractionAttempts: response.distractions || response.stats?.distractionAttempts || 0,
          blockedSites: response.blockedSitesCount || response.stats?.blockedSites || 0,
          isActive: response.isActive || response.stats?.isActive || false,
          task: response.task || response.stats?.task || 'Focus sessie',
          recentBlocks: response.recentBlocks || response.stats?.recentBlocks || []
        };
        
        this.showConnectionState('connected');
        this.updateUI(this.sessionStats);
        this.startRealTimeUpdates();
        
        console.log('✅ Popup connected successfully');
      } else {
        throw new Error('Invalid response from background');
      }
    } catch (error) {
      console.error('❌ Connection failed:', error.message);
      this.isConnected = false;
      this.showConnectionState('disconnected');
      
      // ✅ FIXED: Retry after 3 seconds instead of immediately
      setTimeout(() => {
        if (!this.isConnected) {
          console.log('🔄 Retrying connection...');
          this.checkConnection();
        }
      }, 3000);
    }
  }

  startRealTimeUpdates() {
    // Stop existing interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    // Start new interval for real-time updates
    this.updateInterval = setInterval(async () => {
      if (this.isConnected) {
        try {
          // ✅ FIXED: Use GET_STATUS consistently
          const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
          
          if (response && (response.success || response.isConnected !== false)) {
            // Update stats
            this.sessionStats = {
              focusScore: response.focusScore || response.stats?.focusScore || this.sessionStats.focusScore,
              sessionDuration: response.sessionDuration || response.stats?.sessionDuration || this.sessionStats.sessionDuration,
              distractionAttempts: response.distractions || response.stats?.distractionAttempts || this.sessionStats.distractionAttempts,
              blockedSites: response.blockedSitesCount || response.stats?.blockedSites || this.sessionStats.blockedSites,
              isActive: response.isActive || response.stats?.isActive || this.sessionStats.isActive,
              task: response.task || response.stats?.task || this.sessionStats.task,
              recentBlocks: response.recentBlocks || response.stats?.recentBlocks || this.sessionStats.recentBlocks
            };
            
            this.updateUI(this.sessionStats);
            this.addRealTimeAnimation();
          }
        } catch (error) {
          console.error('❌ Real-time update failed:', error);
          // Don't immediately disconnect on update failure
        }
      }
    }, 8000); // Update every 8 seconds
  }

  addRealTimeAnimation() {
    const elements = ['focusScore', 'sessionDuration', 'distractionCount', 'blockedSitesCount'];
    elements.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.classList.add('realtime');
        setTimeout(() => element.classList.remove('realtime'), 1000);
      }
    });
  }

  showConnectionState(state) {
    console.log('🔄 Showing state:', state);
    const states = ['connecting', 'connected', 'disconnected'];
    const statusDot = document.getElementById('connectionStatus');
    
    states.forEach(s => {
      const element = document.getElementById(`${s}State`);
      if (element) {
        element.classList.toggle('hidden', s !== state);
      }
    });

    if (statusDot) {
      statusDot.className = `status-dot ${
        state === 'connected' ? 'online' : 
        state === 'connecting' ? 'connecting' : 'offline'
      }`;
    }

    // Show/hide sections based on connection
    const sectionsToShow = ['sessionStats', 'quickActions', 'recentBlocks', 'aiCoach'];
    sectionsToShow.forEach(sectionId => {
      const section = document.getElementById(sectionId);
      if (section) {
        section.classList.toggle('hidden', state !== 'connected');
      }
    });
  }

  async connectToWebsite() {
    this.showConnectionState('connecting');
    
    try {
      const tabs = await chrome.tabs.query({});
      const focusTabs = tabs.filter(tab => 
        tab.url && (tab.url.includes('localhost') || tab.url.includes('focusflow'))
      );

      if (focusTabs.length > 0) {
        chrome.tabs.update(focusTabs[0].id, { active: true });
        chrome.windows.update(focusTabs[0].windowId, { focused: true });
        
        setTimeout(() => {
          this.checkConnection();
        }, 1000);
      } else {
        chrome.tabs.create({ url: 'https://focusflows.eu' });
      }
    } catch (error) {
      console.error('Manual connection failed:', error);
      this.showConnectionState('disconnected');
    }
  }

  updateUI(stats) {
    if (!stats) return;
    
    console.log('🎨 Updating UI with:', stats);

    // Update all statistics with proper formatting
    this.updateElement('focusScore', `${Math.round(stats.focusScore || 0)}%`);
    this.updateElement('sessionDuration', this.formatDuration(stats.sessionDuration || 0));
    this.updateElement('distractionCount', stats.distractionAttempts || 0);
    this.updateElement('blockedSitesCount', stats.blockedSites || 0);

    // Update task name if available
    if (stats.task && stats.task !== 'Focus sessie') {
      this.updateElement('currentTask', stats.task);
    }

    // Update progress indicator
    this.updateProgressIndicator(stats);

    // Update blocking status
    const toggleBtn = document.getElementById('toggleBlocking');
    const blockingIcon = document.getElementById('blockingIcon');
    const blockingText = document.getElementById('blockingText');
    
    if (toggleBtn && blockingIcon && blockingText) {
      if (stats.isActive) {
        blockingIcon.textContent = '🎯';
        blockingText.textContent = 'Focus Actief';
        toggleBtn.style.background = 'rgba(16, 185, 129, 0.2)';
        toggleBtn.style.borderColor = '#10b981';
        toggleBtn.classList.add('active');
      } else {
        blockingIcon.textContent = '⏸️';
        blockingText.textContent = 'Gepauzeerd';
        toggleBtn.style.background = 'rgba(239, 68, 68, 0.2)';
        toggleBtn.style.borderColor = '#ef4444';
        toggleBtn.classList.remove('active');
      }
    }

    // Update focus score color
    const focusScoreElement = document.getElementById('focusScore');
    if (focusScoreElement) {
      const score = stats.focusScore || 0;
      focusScoreElement.style.color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
    }

    // Update recent blocks
    this.updateRecentBlocks(stats.recentBlocks || []);
  }

  formatDuration(minutes) {
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }

  updateProgressIndicator(stats) {
    const progressElement = document.getElementById('sessionProgress');
    if (progressElement && stats.sessionDuration) {
      const progressPercent = Math.min(100, (stats.sessionDuration / 25) * 100);
      progressElement.style.width = `${progressPercent}%`;
    }
  }

  updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  updateRecentBlocks(blocks) {
    const blocksList = document.getElementById('blocksList');
    if (!blocksList) return;

    if (blocks.length === 0) {
      blocksList.innerHTML = '<div class="no-blocks">🛡️ Geen recente blokkades</div>';
      return;
    }

    blocksList.innerHTML = blocks.slice(0, 5).map(block => `
      <div class="block-item">
        <span class="block-site">${block.site || 'Onbekende site'}</span>
        <span class="block-time">${this.formatTimeAgo(block.timestamp)}</span>
      </div>
    `).join('');
  }

  formatTimeAgo(timestamp) {
    if (!timestamp) return 'nu';
    const now = Date.now();
    const diff = Math.round((now - timestamp) / 1000);
    
    if (diff < 60) return 'nu';
    if (diff < 3600) return `${Math.round(diff / 60)}m geleden`;
    return `${Math.round(diff / 3600)}h geleden`;
  }

  async toggleBlocking() {
    try {
      const newState = !this.sessionStats.isActive;
      const message = {
        type: newState ? 'START_BLOCKING' : 'STOP_BLOCKING',
        blockedSites: newState ? ['facebook.com', 'youtube.com', 'twitter.com', 'instagram.com'] : [],
        sessionId: Date.now().toString(),
        task: 'Focus sessie via popup'
      };

      const response = await chrome.runtime.sendMessage(message);
      
      if (response && response.success) {
        this.sessionStats.isActive = newState;
        this.updateUI(this.sessionStats);
        console.log(`🔄 Blocking ${newState ? 'enabled' : 'disabled'}`);
      }
    } catch (error) {
      console.error('Toggle blocking failed:', error);
    }
  }

  async triggerBreak() {
    try {
      await chrome.runtime.sendMessage({ type: 'START_BREAK', duration: 5 });
      chrome.tabs.create({ url: 'https://focusflows.eu/dashboard' });
    } catch (error) {
      console.error('Trigger break failed:', error);
    }
  }

  async getAIAdvice() {
    const adviceElement = document.getElementById('aiAdvice');
    if (!adviceElement) return;

    adviceElement.innerHTML = '<p>🤖 AI analyseert je focus patronen...</p>';
    
    try {
      const stats = this.sessionStats;
      let advice = '';

      if (!stats || !stats.isActive) {
        advice = "Start een focus sessie om gepersonaliseerd advies te krijgen! 🎯";
      } else if (stats.distractionAttempts === 0 && stats.sessionDuration > 25) {
        advice = "Geweldig! Je blijft perfect gefocust. Overweeg een korte pauze na deze sessie. ☕";
      } else if (stats.distractionAttempts >= 5) {
        advice = "Je hebt veel afleidingen gehad. Probeer je telefoon weg te leggen en een rustigere werkplek te zoeken. 📱➡️🚫";
      } else if (stats.sessionDuration > 90) {
        advice = "Je zit al lang te werken! Een korte wandeling kan je focus verbeteren. 🚶‍♂️";
      } else if (stats.focusScore < 60) {
        advice = "Je focus score kan beter. Probeer kortere sessies van 25 minuten met 5 min pauzes. 🍅";
      } else {
        advice = "Je doet het goed! Blijf gefocust en vergeet niet regelmatig te pauzeren. ⭐";
      }

      setTimeout(() => {
        adviceElement.innerHTML = `<p>${advice}</p>`;
      }, 1500);
    } catch (error) {
      console.error('AI advice failed:', error);
      adviceElement.innerHTML = '<p>❌ Kon geen advies genereren. Probeer later opnieuw.</p>';
    }
  }

  toggleSettings() {
    const panel = document.getElementById('settingsPanel');
    if (panel) {
      panel.classList.toggle('hidden');
    }
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['focusflow_popup_settings']);
      if (result.focusflow_popup_settings) {
        this.settings = { ...this.settings, ...result.focusflow_popup_settings };
      }

      Object.keys(this.settings).forEach(key => {
        const checkbox = document.getElementById(`${key}Enabled`);
        if (checkbox) {
          checkbox.checked = this.settings[key];
        }
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  async saveSettings() {
    try {
      await chrome.storage.local.set({ focusflow_popup_settings: this.settings });
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('🎯 Initializing FocusFlow popup...');
  new FocusFlowPopup();
});

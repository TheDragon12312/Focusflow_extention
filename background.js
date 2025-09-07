// background.js (MV3) - FIX GET_STATUS case
console.log('🚀 FocusFlow Background Script Starting...');

let sessionState = { 
  isBlocking: false, 
  blockedSites: [], 
  sessionId: null, 
  startTime: null 
};

// ✅ FIXED: Add proper session stats for popup
let sessionStats = {
  focusScore: 85,
  sessionDuration: 0,
  distractionAttempts: 0,
  blockedSites: 0,
  sessionStartTime: null,
  isActive: false,
  task: '',
  recentBlocks: []
};

// ✅ FIXED: Update handleMessage function
const handleMessage = (message, sender, sendResponse) => {
  console.log('📨 Background received:', message?.type);
  
  try {
    switch (message?.type) {
      case 'HEALTH_CHECK':
      case 'PING':
        sendResponse({ 
          status: 'connected', 
          pong: true, 
          extensionId: chrome.runtime.id, 
          timestamp: Date.now(),
          ...sessionStats  // ✅ Include stats in ping response
        });
        return true;

      case 'GET_STATUS':
        // ✅ FIXED: Calculate session duration if active
        if (sessionStats.isActive && sessionStats.sessionStartTime) {
          sessionStats.sessionDuration = Math.floor((Date.now() - sessionStats.sessionStartTime) / 60000);
        }
        
        // ✅ FIXED: Return exactly what popup expects
        const statusResponse = {
          success: true,
          isConnected: true,
          
          // Session state
          isBlocking: sessionState.isBlocking,
          blockedSites: sessionState.blockedSites,
          sessionId: sessionState.sessionId,
          startTime: sessionState.startTime,
          
          // Stats that popup needs
          focusScore: sessionStats.focusScore || 85,
          sessionDuration: sessionStats.sessionDuration || 0,
          distractions: sessionStats.distractionAttempts || 0,
          blockedSitesCount: sessionStats.blockedSites || 0,
          isActive: sessionStats.isActive || sessionState.isBlocking,
          task: sessionStats.task || 'Focus sessie',
          recentBlocks: sessionStats.recentBlocks || [],
          
          // Additional stats popup might want
          stats: sessionStats,
          timestamp: Date.now()
        };
        
        console.log('📊 Sending status to popup:', statusResponse);
        sendResponse(statusResponse);
        return true;

      case 'START_BLOCKING':
        sessionState = { 
          isBlocking: true, 
          blockedSites: message.blockedSites || [], 
          sessionId: message.sessionId || Date.now().toString(), 
          startTime: Date.now() 
        };
        
        // ✅ Update stats when blocking starts
        sessionStats = {
          ...sessionStats,
          isActive: true,
          sessionStartTime: Date.now(),
          task: message.task || 'Focus sessie'
        };
        
        chrome.storage.local.set({
          focusflow_blocking_active: true,
          focusflow_blocked_sites: sessionState.blockedSites,
          focusflow_session_id: sessionState.sessionId,
          focusflow_session_stats: sessionStats
        }, () => {
          broadcastToContentScripts({ 
            type: 'UPDATE_BLOCKING_STATUS', 
            isActive: true, 
            blockedSites: sessionState.blockedSites 
          });
          sendResponse({ success: true, sessionId: sessionState.sessionId, stats: sessionStats });
        });
        return true;

      case 'STOP_BLOCKING':
        sessionState.isBlocking = false;
        sessionState.blockedSites = [];
        sessionStats.isActive = false;
        
        chrome.storage.local.set({ 
          focusflow_blocking_active: false, 
          focusflow_blocked_sites: [],
          focusflow_session_stats: sessionStats
        }, () => {
          broadcastToContentScripts({ 
            type: 'UPDATE_BLOCKING_STATUS', 
            isActive: false, 
            blockedSites: [] 
          });
          sendResponse({ success: true, finalStats: sessionStats });
        });
        return true;

      case 'SITE_BLOCKED':
        sessionStats.blockedSites++;
        sessionStats.distractionAttempts++;
        sessionStats.focusScore = Math.max(0, sessionStats.focusScore - 3);
        
        // ✅ Add to recent blocks list
        const blockEntry = {
          site: message.site,
          url: message.url,
          timestamp: Date.now(),
          timeAgo: 'nu'
        };
        
        sessionStats.recentBlocks = sessionStats.recentBlocks || [];
        sessionStats.recentBlocks.unshift(blockEntry);
        if (sessionStats.recentBlocks.length > 10) {
          sessionStats.recentBlocks = sessionStats.recentBlocks.slice(0, 10);
        }
        
        chrome.storage.local.set({ focusflow_session_stats: sessionStats });
        logBlockedAttempt(message.site, message.url);
        
        console.log('🛡️ Site blocked:', message.site, 'Updated stats:', sessionStats);
        sendResponse({ success: true, stats: sessionStats });
        return true;

      case 'SYNC_SETTINGS':
        const active = !!message?.data?.active;
        const sites = Array.isArray(message?.data?.blockedSites) ? message.data.blockedSites : [];
        
        sessionState.isBlocking = active;
        sessionState.blockedSites = sites;
        sessionStats.isActive = active;
        
        chrome.storage.local.set({ 
          focusflow_blocking_active: active, 
          focusflow_blocked_sites: sites,
          focusflow_session_stats: sessionStats
        }, () => {
          broadcastToContentScripts({ 
            type: 'UPDATE_BLOCKING_STATUS', 
            isActive: active, 
            blockedSites: sites 
          });
          sendResponse({ success: true, stats: sessionStats });
        });
        return true;

      case 'RETURN_TO_FOCUS':
      case 'START_BREAK':
        if (sender.tab?.id) {
          chrome.tabs.remove(sender.tab.id, () => 
            sendResponse({ success: !chrome.runtime.lastError })
          );
          return true;
        }
        sendResponse({ success: true });
        return true;

      default:
        console.log('❓ Unknown message type:', message?.type);
        sendResponse({ success: false, error: 'Unknown message type' });
        return false;
    }
  } catch (e) {
    console.error('❌ Background error:', e);
    sendResponse({ success: false, error: e?.message || 'background error' });
    return false;
  }
};

// ✅ Setup message listeners
try {
  if (chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener(handleMessage);
    console.log('✅ Internal message listener ready');
  }
} catch (error) {
  console.error('❌ Error setting up listeners:', error);
}

// ✅ External messages from website
try {
  if (chrome.runtime.onMessageExternal) {
    chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
      const origin = sender.origin || (sender.url ? new URL(sender.url).origin : '');
      const allowed = ['https://focusflows.eu'];
      
      if (!allowed.includes(origin)) {
        sendResponse({ success: false, error: 'Origin not allowed' });
        return false;
      }
      
      return handleMessage(message, sender, sendResponse);
    });
    console.log('✅ External message listener ready');
  }
} catch (error) {
  console.error('❌ Error setting up external listeners:', error);
}

// ✅ Broadcast function (same as before)
function broadcastToContentScripts(message) {
  chrome.tabs.query({ url: ['http://*/*','https://*/*'] }, (tabs) => {
    tabs.forEach((tab) => {
      if (!tab.id) return;
      
      try {
        chrome.tabs.sendMessage(tab.id, {
          type: 'FOCUSFLOW_BACKGROUND_MESSAGE',
          payload: message
        }, () => {
          if (chrome.runtime.lastError) { /* ignore */ }
        });
      } catch (error) {
        console.error('Error broadcasting to tab:', tab.id, error);
      }
    });
  });
}

function logBlockedAttempt(site, url) {
  const attempt = { 
    site, 
    url, 
    timestamp: Date.now(), 
    sessionId: sessionState.sessionId 
  };
  
  chrome.storage.local.get(['focusflow_blocked_attempts'], (result) => {
    const list = Array.isArray(result.focusflow_blocked_attempts) ? result.focusflow_blocked_attempts : [];
    list.push(attempt);
    if (list.length > 100) list.splice(0, list.length - 100);
    chrome.storage.local.set({ focusflow_blocked_attempts: list });
  });
}

// ✅ Update stats timer
setInterval(() => {
  if (sessionStats.isActive && sessionStats.sessionStartTime) {
    const oldDuration = sessionStats.sessionDuration;
    sessionStats.sessionDuration = Math.floor((Date.now() - sessionStats.sessionStartTime) / 60000);
    
    if (sessionStats.sessionDuration !== oldDuration) {
      chrome.storage.local.set({ focusflow_session_stats: sessionStats });
    }
  }
}, 30000);

// ✅ ENSURE: Message listener is always registered
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Background received:', message?.type);
  
  // Always return true to indicate async response
  handleMessage(message, sender, sendResponse);
  return true;
});

// ✅ KEEP-ALIVE: Prevent service worker from sleeping during critical operations
const keepAlive = () => {
  chrome.runtime.getPlatformInfo(() => {
    // This simple operation keeps the service worker active
  });
};

// Keep alive during active sessions
setInterval(keepAlive, 25000); // Every 25 seconds


// ✅ Initialize on startup  
const initializeBackground = () => {
  console.log('🔧 Initializing background script...');
  chrome.storage.local.set({ 
    focusflow_blocking_active: false, 
    focusflow_blocked_sites: [] 
  });
  console.log('✅ Background script initialized');
};

initializeBackground();

// ✅ Handle extension events
if (chrome.runtime.onStartup) {
  chrome.runtime.onStartup.addListener(() => {
    console.log('🔄 Extension startup');
    initializeBackground();
  });
}

if (chrome.runtime.onInstalled) {
  chrome.runtime.onInstalled.addListener((details) => {
    console.log('📦 Extension installed/updated:', details.reason);
    initializeBackground();
  });
}

console.log('✅ FocusFlow Background Script Ready - Fixed Popup Communication');

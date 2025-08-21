// FocusFlow Extension Background Script
console.log('🚀 FocusFlow Extension Background Script Started');

// Extension state
let isActive = false;
let blockedSites = [];
let currentSessionId = null;
let blockedTabs = new Set();

// Listen for messages from external sources (web pages)
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  console.log('📨 Message received from external:', request, sender);
  
  switch (request.type) {
    case 'HEALTH_CHECK':
      console.log('💓 Health check received');
      sendResponse({ 
        status: 'connected', 
        extensionId: chrome.runtime.id,
        timestamp: Date.now(),
        version: chrome.runtime.getManifest().version
      });
      return true;
      
    case 'START_BLOCKING':
      isActive = true;
      blockedSites = request.blockedSites || [];
      currentSessionId = request.sessionId;
      console.log('🚫 Blocking started:', blockedSites);
      
      // Store in chrome storage for persistence
      chrome.storage.local.set({
        isActive: true,
        blockedSites: blockedSites,
        sessionId: currentSessionId
      });
      
      sendResponse({ success: true, message: 'Blocking started', sitesCount: blockedSites.length });
      break;
      
    case 'STOP_BLOCKING':
      isActive = false;
      blockedSites = [];
      currentSessionId = null;
      blockedTabs.clear();
      console.log('✅ Blocking stopped');
      
      chrome.storage.local.set({
        isActive: false,
        blockedSites: [],
        sessionId: null
      });
      
      sendResponse({ success: true, message: 'Blocking stopped' });
      break;
      
    case 'SYNC_SETTINGS':
      isActive = request.data.active;
      blockedSites = request.data.blockedSites || [];
      currentSessionId = request.data.sessionId;
      console.log('🔄 Settings synced:', request.data);
      
      chrome.storage.local.set({
        isActive: isActive,
        blockedSites: blockedSites,
        sessionId: currentSessionId
      });
      
      sendResponse({ success: true, message: 'Settings synced' });
      break;
      
    case 'GET_STATUS':
      sendResponse({
        isActive: isActive,
        blockedSites: blockedSites,
        sessionId: currentSessionId,
        blockedTabsCount: blockedTabs.size
      });
      break;
      
    default:
      console.warn('❓ Unknown message type:', request.type);
      sendResponse({ error: 'Unknown message type' });
  }
  
  return true; // Keep message channel open for async response
});

// Listen for tab updates (URL changes)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!isActive || !changeInfo.url || blockedSites.length === 0) {
    return;
  }
  
  const currentUrl = changeInfo.url.toLowerCase();
  console.log('🔍 Checking URL:', currentUrl);
  
  // Check if URL matches any blocked site
  const isBlocked = blockedSites.some(site => {
    const siteLower = site.toLowerCase();
    return currentUrl.includes(siteLower) || 
           currentUrl.includes(siteLower.replace('www.', '')) ||
           currentUrl.startsWith(`https://${siteLower}`) ||
           currentUrl.startsWith(`http://${siteLower}`);
  });
  
  if (isBlocked) {
    console.log('🚫 BLOCKING:', currentUrl);
    blockedTabs.add(tabId);
    
    // Log the distraction
    logDistraction(currentUrl, tabId);
    
    // Redirect to blocked page
    const blockedPageUrl = chrome.runtime.getURL('blocked.html') + 
                          '?site=' + encodeURIComponent(currentUrl) + 
                          '&sessionId=' + encodeURIComponent(currentSessionId || '');
    
    chrome.tabs.update(tabId, { url: blockedPageUrl });
    
    // Show notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon.png',
      title: 'FocusFlow - Website Blocked',
      message: `Blocked: ${new URL(currentUrl).hostname}`,
      buttons: [
        { title: 'Back to Focus' },
        { title: 'Take Break' }
      ]
    });
  }
});

// Handle notification clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    // Back to Focus - could redirect to focus page
    console.log('User chose to go back to focus');
  } else if (buttonIndex === 1) {
    // Take Break
    console.log('User chose to take a break');
  }
  chrome.notifications.clear(notificationId);
});

// Function to log distractions
function logDistraction(site, tabId) {
  const distractionData = {
    site: site,
    timestamp: Date.now(),
    sessionId: currentSessionId,
    tabId: tabId
  };
  
  console.log('📝 Distraction logged:', distractionData);
  
  // Send to content script for localStorage sync
  chrome.tabs.sendMessage(tabId, {
    type: 'LOG_DISTRACTION',
    data: distractionData
  }).catch(() => {
    // Ignore errors if content script not ready
    console.log('Could not send message to content script');
  });
  
  // Store in extension storage
  chrome.storage.local.get(['distractionLog'], (result) => {
    const log = result.distractionLog || [];
    log.push(distractionData);
    
    // Keep only last 100 entries
    if (log.length > 100) {
      log.splice(0, log.length - 100);
    }
    
    chrome.storage.local.set({ distractionLog: log });
  });
}

// Listen for tab removal to clean up
chrome.tabs.onRemoved.addListener((tabId) => {
  blockedTabs.delete(tabId);
});

// Restore state when extension starts
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(['isActive', 'blockedSites', 'sessionId'], (result) => {
    isActive = result.isActive || false;
    blockedSites = result.blockedSites || [];
    currentSessionId = result.sessionId || null;
    
    console.log('🔄 State restored:', { isActive, blockedSites, currentSessionId });
  });
});

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('✅ FocusFlow Extension installed and ready');
  
  chrome.storage.local.set({
    isActive: false,
    blockedSites: [],
    sessionId: null,
    distractionLog: []
  });
});

// Keep service worker alive
chrome.runtime.onConnect.addListener((port) => {
  console.log('🔌 Port connected:', port.name);
});

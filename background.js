// background.js - Complete werkende versie
console.log('🔧 FocusFlow Background Script loaded');

// ✅ CRUCIAAL: Luister naar EXTERNAL messages van je web app
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  console.log('📨 External message received:', message);
  console.log('📨 From sender:', sender.url);
  
  if (message.type === 'PING') {
    console.log('🏓 Ping received, sending pong');
    sendResponse({ status: 'pong', connected: true });
    return true;
  }
  
  if (message.type === 'SYNC_SETTINGS') {
    console.log('🔄 SYNC_SETTINGS received with data:', message.data);
    
    const { active, blockedSites, sessionId } = message.data;
    
    // ✅ BELANGRIJKSTE DEEL: Sla data op in Chrome Storage
    chrome.storage.local.set({
      focusflow_active: active,
      focusflow_blocked_sites: blockedSites, // Dit moet aankomen!
      focusflow_session_id: sessionId,
      focusflow_last_sync: Date.now()
    }).then(() => {
      console.log('✅ Data successfully saved to Chrome storage:');
      console.log('   - Active:', active);  
      console.log('   - Blocked sites:', blockedSites);
      console.log('   - Sites count:', blockedSites.length);
      
      // Verstuur success response terug
      sendResponse({ 
        success: true, 
        savedSites: blockedSites,
        message: `${blockedSites.length} sites opgeslagen in extensie storage`
      });
      
      // ✅ Trigger content scripts om data opnieuw te laden
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          chrome.tabs.sendMessage(tab.id, {
            type: 'STORAGE_UPDATED',
            data: { active, blockedSites }
          }, () => {
            // Ignore errors voor tabs die geen content script hebben
            chrome.runtime.lastError;
          });
        });
      });
      
    }).catch(error => {
      console.error('❌ Failed to save to Chrome storage:', error);
      sendResponse({ success: false, error: error.message });
    });
    
    return true; // Voor async response
  }
});

// ✅ Badge management
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.focusflow_active) {
    const isActive = changes.focusflow_active.newValue;
    
    chrome.action.setBadgeText({
      text: isActive ? 'ON' : ''
    });
    
    chrome.action.setBadgeBackgroundColor({
      color: isActive ? '#28a745' : '#dc3545'
    });
    
    console.log('🔰 Badge updated:', isActive ? 'ACTIVE' : 'INACTIVE');
  }
});

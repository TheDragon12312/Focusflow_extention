// FocusFlow Content Script
console.log('📋 FocusFlow Content Script loaded on:', window.location.href);

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Content script received message:', request);
  
  if (request.type === 'LOG_DISTRACTION') {
    // Log distraction to localStorage for web app sync
    try {
      const distractionLog = JSON.parse(localStorage.getItem('focusflow_distraction_log') || '[]');
      
      const logEntry = {
        ...request.data,
        processed: false,
        url: window.location.href
      };
      
      distractionLog.push(logEntry);
      
      // Keep only last 50 entries
      if (distractionLog.length > 50) {
        distractionLog.splice(0, distractionLog.length - 50);
      }
      
      localStorage.setItem('focusflow_distraction_log', JSON.stringify(distractionLog));
      
      // Trigger storage event for other tabs
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'focusflow_distraction_log',
        newValue: JSON.stringify(distractionLog),
        oldValue: JSON.stringify(distractionLog.slice(0, -1))
      }));
      
      console.log('📝 Distraction logged to localStorage');
      
    } catch (error) {
      console.error('❌ Error logging distraction:', error);
    }
  }
  
  sendResponse({ success: true });
});

// Inject extension detection into page
function injectExtensionDetection() {
  const script = document.createElement('script');
  script.textContent = `
    // Signal that FocusFlow extension is available
    window.focusflowExtensionAvailable = true;
    window.focusflowExtensionId = '${chrome.runtime.id}';
    
    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('focusflowExtensionReady', {
      detail: {
        extensionId: '${chrome.runtime.id}',
        version: '${chrome.runtime.getManifest().version}'
      }
    }));
    
    console.log('✅ FocusFlow Extension detected and ready');
  `;
  
  (document.head || document.documentElement).appendChild(script);
  script.remove();
}

// Inject detection script
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectExtensionDetection);
} else {
  injectExtensionDetection();
}

// Handle user returning to focus session
window.addEventListener('focus', () => {
  if (window.location.href.includes('focusflow') || 
      window.location.href.includes('localhost') ||
      document.title.includes('FocusFlow')) {
    
    try {
      localStorage.setItem('focusflow_user_returned', JSON.stringify({
        timestamp: Date.now(),
        url: window.location.href
      }));
      
      console.log('👤 User returned to focus session');
    } catch (error) {
      console.error('Error logging user return:', error);
    }
  }
});

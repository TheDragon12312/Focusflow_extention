// FocusFlow Content Script - Enhanced Version
console.log('📋 FocusFlow Content Script loaded on:', window.location.href);

// Inject extension detection IMMEDIATELY
(function() {
  const extensionId = chrome.runtime.id;
  const version = chrome.runtime.getManifest().version;
  
  console.log('🚀 Injecting extension detection with ID:', extensionId);
  
  // Method 1: Direct window properties
  window.focusflowExtensionAvailable = true;
  window.focusflowExtensionId = extensionId;
  
  // Method 2: Inject script into page context
  const script = document.createElement('script');
  script.textContent = `
    (function() {
      console.log('🎯 Extension detection script injected');
      
      // Set global variables
      window.focusflowExtensionAvailable = true;
      window.focusflowExtensionId = '${extensionId}';
      
      // Dispatch immediate event
      try {
        const event = new CustomEvent('focusflowExtensionReady', {
          detail: {
            extensionId: '${extensionId}',
            version: '${version}',
            timestamp: Date.now()
          },
          bubbles: true,
          cancelable: true
        });
        
        document.dispatchEvent(event);
        window.dispatchEvent(event);
        
        console.log('✅ FocusFlow Extension event dispatched. ID:', '${extensionId}');
      } catch (error) {
        console.error('❌ Error dispatching extension event:', error);
      }
    })();
  `;
  
  // Inject script
  try {
    (document.head || document.documentElement || document.body).appendChild(script);
    script.remove();
    console.log('✅ Extension detection script injected successfully');
  } catch (error) {
    console.error('❌ Failed to inject extension detection script:', error);
  }
  
  // Method 3: Fallback - dispatch event directly from content script
  setTimeout(() => {
    try {
      const fallbackEvent = new CustomEvent('focusflowExtensionReady', {
        detail: {
          extensionId: extensionId,
          version: version,
          timestamp: Date.now(),
          source: 'content_script_fallback'
        }
      });
      
      document.dispatchEvent(fallbackEvent);
      window.dispatchEvent(fallbackEvent);
      
      console.log('🔄 Fallback extension event dispatched');
    } catch (error) {
      console.error('❌ Fallback event failed:', error);
    }
  }, 100);
})();

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
  return true;
});

// Additional detection method - listen for page events
document.addEventListener('DOMContentLoaded', () => {
  console.log('📄 DOM Content Loaded - triggering additional detection');
  
  // Trigger detection again after DOM is ready
  setTimeout(() => {
    const event = new CustomEvent('focusflowExtensionReady', {
      detail: {
        extensionId: chrome.runtime.id,
        version: chrome.runtime.getManifest().version,
        source: 'dom_ready'
      }
    });
    
    document.dispatchEvent(event);
    window.dispatchEvent(event);
  }, 50);
});

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

console.log('✅ FocusFlow Content Script fully initialized');

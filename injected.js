// injected.js - FIXED: Removed Chrome Runtime Dependency

(() => {
'use strict';

const BRIDGE_REQ = 'FOCUSFLOW_BRIDGE_REQUEST';
const BRIDGE_RES = 'FOCUSFLOW_BRIDGE_RESPONSE';

try {
  if (window.focusflowExtensionAvailable) return;
  
  console.log('🧩 FocusFlow: Initializing injected bridge...');
  window.focusflowExtensionAvailable = true;

  // ✅ FIXED: Simplified connection tracking without chrome.runtime dependency
  let messageResponseHandlers = new Map();
  let isConnected = false;
  let connectionAttempts = 0;
  const maxConnectionAttempts = 3;

  // ✅ FIXED: Simple connection test via postMessage instead of chrome.runtime
  function testConnection() {
    return new Promise((resolve) => {
      const testId = 'test_' + Date.now();
      const timeout = setTimeout(() => {
        messageResponseHandlers.delete(testId);
        resolve(false);
      }, 2000);

      const handler = (evt) => {
        const d = evt.data || {};
        if (d && d.type === BRIDGE_RES && d.reqId === testId) {
          clearTimeout(timeout);
          messageResponseHandlers.delete(testId);
          window.removeEventListener('message', handler);
          resolve(!d.error);
        }
      };

      window.addEventListener('message', handler);
      messageResponseHandlers.set(testId, handler);

      try {
        window.postMessage({
          type: BRIDGE_REQ,
          reqId: testId,
          payload: { type: 'PING', timestamp: Date.now() }
        }, '*');
      } catch (error) {
        clearTimeout(timeout);
        messageResponseHandlers.delete(testId);
        window.removeEventListener('message', handler);
        resolve(false);
      }
    });
  }

  // ✅ FIXED: Enhanced send function without chrome.runtime dependency
  function send(message, retryCount = 0) {
    return new Promise((resolve, reject) => {
      const reqId = 'req_' + Math.random().toString(36).slice(2) + '_' + Date.now();
      
      const timeout = setTimeout(() => {
        const handler = messageResponseHandlers.get(reqId);
        if (handler) {
          window.removeEventListener('message', handler);
          messageResponseHandlers.delete(reqId);
        }
        
        if (retryCount < 2) {
          console.log(`⚠️ Message timeout, retrying... (${retryCount + 1}/3)`);
          setTimeout(() => {
            send(message, retryCount + 1).then(resolve).catch(reject);
          }, 1000 + (retryCount * 1000));
        } else {
          reject(new Error('Extension communication timeout. Extension may be temporarily unavailable.'));
        }
      }, 5000);

      const handler = (evt) => {
        const d = evt.data || {};
        if (d && d.type === BRIDGE_RES && d.reqId === reqId) {
          clearTimeout(timeout);
          window.removeEventListener('message', handler);
          messageResponseHandlers.delete(reqId);

          if (d.error) {
            // ✅ FIXED: Better error classification
            if (d.error.includes('receiving end does not exist') ||
                d.error.includes('message port closed') ||
                d.error.includes('Extension context invalidated')) {
              
              console.log('⚠️ Extension temporarily unavailable:', d.error);
              isConnected = false;
              
              if (retryCount < 2) {
                setTimeout(() => {
                  send(message, retryCount + 1).then(resolve).catch(reject);
                }, 2000);
                return;
              }
            }
            reject(new Error(d.error));
          } else {
            isConnected = true;
            connectionAttempts = 0;
            resolve(d.payload || {});
          }
        }
      };

      window.addEventListener('message', handler);
      messageResponseHandlers.set(reqId, handler);

      try {
        window.postMessage({
          type: BRIDGE_REQ,
          reqId,
          payload: {
            ...message,
            timestamp: Date.now(),
            retryCount
          }
        }, '*');
      } catch (error) {
        clearTimeout(timeout);
        window.removeEventListener('message', handler);
        messageResponseHandlers.delete(reqId);
        reject(new Error('Failed to send message: ' + error.message));
      }
    });
  }

  // ✅ FIXED: Simplified extension API without context invalidation issues
  window.focusflowExtension = {
    sendMessage: (message) => send(message),
    
    isConnected: () => isConnected,
    
    // ✅ FIXED: Simple health check that doesn't rely on chrome.runtime
    healthCheck: async () => {
      try {
        const response = await send({ type: 'PING' });
        return response && (response.pong || response.status === 'connected');
      } catch (error) {
        console.log('Health check failed:', error.message);
        return false;
      }
    },

    // ✅ FIXED: Simplified reconnect method
    reconnect: async () => {
      console.log('🔄 Manual reconnect attempt...');
      isConnected = false;
      connectionAttempts = 0;
      
      const connected = await testConnection();
      if (connected) {
        console.log('✅ Reconnection successful');
        isConnected = true;
        window.dispatchEvent(new CustomEvent('focusflow-extension-ready', {
          detail: { reconnected: true }
        }));
        return true;
      } else {
        console.log('❌ Reconnection failed');
        return false;
      }
    }
  };

  // ✅ FIXED: Initial connection test without chrome.runtime
  testConnection().then(connected => {
    isConnected = connected;
    
    if (connected) {
      console.log('✅ Extension bridge established successfully');
    } else {
      console.log('⚠️ Extension bridge not immediately available (normal during startup)');
    }

    // Always dispatch ready event for website to handle
    try {
      window.dispatchEvent(new CustomEvent('focusflow-extension-ready', {
        detail: { 
          initial: true, 
          connected: connected,
          timestamp: Date.now()
        }
      }));
    } catch (e) {
      console.log('Event dispatch failed:', e.message);
    }
  });

  // ✅ FIXED: Periodic health check without chrome.runtime dependency  
  setInterval(async () => {
    if (!isConnected) {
      console.log('🔄 Attempting to restore connection...');
      const reconnected = await testConnection();
      if (reconnected) {
        isConnected = true;
        console.log('✅ Connection restored automatically');
        window.dispatchEvent(new CustomEvent('focusflow-extension-ready', {
          detail: { recovered: true }
        }));
      }
    }
  }, 15000); // Check every 15 seconds

  console.log('🧩 FocusFlow: injected.js ready (fixed context handling)');

} catch (e) {
  console.error('🔄 Error in injected.js setup:', e);
}

})();

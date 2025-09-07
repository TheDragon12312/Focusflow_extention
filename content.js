// content.js (MV3-safe, CSP-proof) - FIXED VERSION
(() => {
  'use strict';

  const BRIDGE_REQ = 'FOCUSFLOW_BRIDGE_REQUEST';
  const BRIDGE_RES = 'FOCUSFLOW_BRIDGE_RESPONSE';

  // Inject extern script in page context
  function injectScript(src) {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL(src);
    s.async = false;
    s.onload = () => s.remove();
    (document.head || document.documentElement).appendChild(s);
  }

  // Proxy page <-> background via content script
  function setupPostMessageProxy() {
    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      const data = event.data || {};
      if (data.type !== BRIDGE_REQ) return;

      const { reqId, payload } = data;
      try {
        chrome.runtime.sendMessage(payload, (response) => {
          const err = chrome.runtime.lastError ? chrome.runtime.lastError.message : null;
          window.postMessage({ 
            type: BRIDGE_RES, 
            reqId, 
            payload: response || {}, 
            error: err || null 
          }, '*');
        });
      } catch (err) {
        window.postMessage({ 
          type: BRIDGE_RES, 
          reqId, 
          payload: null, 
          error: (err && err.message) || 'proxy error' 
        }, '*');
      }
    });
  }

  class FocusFlowContent {
    constructor() {
      this.isBlocking = false;
      this.blockedSites = [];
      this.onStorageChanged = this.onStorageChanged.bind(this);
      this.init();
    }

    async init() {
      injectScript('injected.js');
      setupPostMessageProxy();
      await this.readBlockingStatus();
      this.checkCurrentSite();

      // ✅ FIXED: Replace chrome.runtime.onMessage.addListener with window messaging
      window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        const data = event.data || {};
        
        // Listen for messages from background script via window messaging
        if (data.type === 'FOCUSFLOW_BACKGROUND_MESSAGE') {
          const message = data.payload;
          try {
            if (message?.type === 'UPDATE_BLOCKING_STATUS') {
              this.isBlocking = !!message.isActive;
              this.blockedSites = Array.isArray(message.blockedSites) ? message.blockedSites : [];
              if (this.isBlocking) {
                this.checkCurrentSite();
              } else {
                this.removeOverlayIfAny();
              }
            } else if (message?.type === 'PING') {
              // Send response back via window messaging
              window.postMessage({
                type: 'FOCUSFLOW_CONTENT_RESPONSE',
                payload: { pong: true }
              }, '*');
            }
          } catch (e) {
            console.error('❌ Message handling error:', e);
          }
        }
      });

      chrome.storage.onChanged.addListener(this.onStorageChanged);
      console.log('✅ FocusFlow Content Script initialized with window messaging');
    }

    async readBlockingStatus() {
      const { focusflow_blocking_active, focusflow_blocked_sites } =
        await chrome.storage.local.get(['focusflow_blocking_active', 'focusflow_blocked_sites']);
      this.isBlocking = !!focusflow_blocking_active;
      this.blockedSites = Array.isArray(focusflow_blocked_sites) ? focusflow_blocked_sites : [];
    }

    onStorageChanged(changes, areaName) {
      if (areaName !== 'local') return;
      let changed = false;

      if ('focusflow_blocking_active' in changes) {
        this.isBlocking = !!changes.focusflow_blocking_active.newValue;
        changed = true;
      }

      if ('focusflow_blocked_sites' in changes) {
        const val = changes.focusflow_blocked_sites.newValue;
        this.blockedSites = Array.isArray(val) ? val : [];
        changed = true;
      }

      if (changed) {
        this.isBlocking ? this.checkCurrentSite() : this.removeOverlayIfAny();
      }
    }

    checkCurrentSite() {
      if (!this.isBlocking || !this.blockedSites?.length) return;
      const href = (window.location?.href || '').toLowerCase();
      if (href.startsWith('chrome-extension://')) return;
      const hit = this.blockedSites.find((s) => href.includes(String(s).toLowerCase()));
      if (hit) this.blockCurrentSite(hit);
    }

    blockCurrentSite(site) {
      this.createBlockingOverlay(site);
      try {
        chrome.runtime.sendMessage({ 
          type: 'SITE_BLOCKED', 
          site, 
          url: window.location.href, 
          timestamp: Date.now() 
        }, () => {});
      } catch {}
    }

    removeOverlayIfAny() { 
      const el = document.getElementById('focusflow-blocking-overlay'); 
      if (el) el.remove(); 
    }

    createBlockingOverlay(site) {
      this.removeOverlayIfAny();
      
      const overlay = document.createElement('div');
      overlay.id = 'focusflow-blocking-overlay';
      overlay.setAttribute('style', 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,rgba(102,126,234,.95) 0%,rgba(118,75,162,.95) 100%);backdrop-filter:blur(10px);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;');

      const card = document.createElement('div');
      card.setAttribute('style','background:rgba(255,255,255,.96);border-radius:20px;padding:32px;width:min(520px,90vw);text-align:center;box-shadow:0 20px 40px rgba(0,0,0,.15);');

      const icon = document.createElement('div'); 
      icon.textContent = '🚫'; 
      icon.setAttribute('style','font-size:64px;margin-bottom:12px;');

      const title = document.createElement('h1'); 
      title.textContent = 'Website Geblokkeerd'; 
      title.setAttribute('style','margin:0 0 8px;font-size:28px;color:#111;font-weight:700;');

      const msg = document.createElement('p'); 
      msg.innerHTML = `${site} is geblokkeerd tijdens je focus sessie.`; 
      msg.setAttribute('style','margin:0 0 20px;color:#555;');

      const hint = document.createElement('div'); 
      hint.textContent = '🎯 Blijf gefocust – je doelen zijn dichterbij dan je denkt!'; 
      hint.setAttribute('style','margin:0 0 20px;padding:10px 14px;border-radius:9999px;background:rgba(59,130,246,.12);color:#2563eb;font-weight:600;display:inline-block;');

      const actions = document.createElement('div'); 
      actions.setAttribute('style','display:flex;flex-direction:column;gap:10px;margin:18px 0 6px;');

      const backBtn = document.createElement('button'); 
      backBtn.textContent = '🎯 Terug naar Focus'; 
      backBtn.setAttribute('style','padding:12px 16px;border:none;border-radius:12px;background:#3b82f6;color:#fff;font-weight:700;cursor:pointer;'); 
      backBtn.addEventListener('click', () => this.handleReturnToFocus());

      const breakBtn = document.createElement('button'); 
      breakBtn.textContent = '☕ Korte Pauze (5min)'; 
      breakBtn.setAttribute('style','padding:12px 16px;border:1px solid rgba(0,0,0,.1);border-radius:12px;background:#fff;color:#374151;font-weight:700;cursor:pointer;'); 
      breakBtn.addEventListener('click', () => this.handleTakeBreak());

      const footer = document.createElement('p'); 
      footer.textContent = '💡 Tip: Gebruik deze pauze om water te drinken of even te bewegen.'; 
      footer.setAttribute('style','margin:12px 0 0;color:#666;font-size:14px;');

      actions.append(backBtn, breakBtn); 
      card.append(icon, title, msg, hint, actions, footer); 
      overlay.append(card); 
      document.documentElement.append(overlay);
    }

    handleReturnToFocus() { 
      try { 
        chrome.runtime.sendMessage({ 
          type: 'RETURN_TO_FOCUS', 
          timestamp: Date.now() 
        }, () => {}); 
      } catch {} 
      this.removeOverlayIfAny(); 
      try { 
        window.location.href = 'https://focusflows.eu/focus'; 
      } catch {} 
    }

    handleTakeBreak() { 
      try { 
        chrome.runtime.sendMessage({ 
          type: 'START_BREAK', 
          duration: 5, 
          timestamp: Date.now() 
        }, () => {}); 
      } catch {} 
      this.removeOverlayIfAny(); 
      try { 
        window.location.href = 'https://focusflows.eu/dashboard'; 
      } catch {} 
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new FocusFlowContent());
  } else {
    new FocusFlowContent();
  }
})();

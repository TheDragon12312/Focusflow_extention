// content.js - Volledig werkende versie
(function() {
  'use strict';
  
  let isBlocked = false;
  let blockedSites = [];
  let focusActive = false;

  // ✅ CORRECTE functie om te checken of site geblokkeerd moet worden
  function shouldBlockSite() {
    const currentDomain = window.location.hostname.toLowerCase();
    const currentUrl = window.location.href.toLowerCase();
    
    console.log('🔍 Checking if should block:', {
      currentDomain,
      currentUrl,
      blockedSites,
      focusActive
    });
    
    if (!blockedSites || blockedSites.length === 0) {
      console.log('❌ No blocked sites configured');
      return false;
    }
    
    return blockedSites.some(site => {
      // ✅ GEFIXTE SYNTAX - alle .replace() calls correct afgesloten
      const cleanSite = site.toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/$/, ''); // ✅ Dit was de ontbrekende regel!
      
      const matches = currentDomain.includes(cleanSite) || 
                      currentUrl.includes(cleanSite) ||
                      currentDomain === cleanSite ||
                      currentDomain === `www.${cleanSite}`;
      
      console.log(`🔍 Testing "${cleanSite}" against "${currentDomain}": ${matches}`);
      return matches;
    });
  }

  // ✅ VERBETERDE blocking functie
  function blockPageCompletely() {
    if (isBlocked) return;
    
    console.log('🚫 BLOCKING PAGE COMPLETELY!');
    isBlocked = true;
    
    // Stop pagina loading
    window.stop();
    
    // Vervang volledige pagina
    const blockingHTML = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>🧠 FocusFlow - Website Blocked</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            overflow: hidden;
          }
          .container {
            text-align: center;
            max-width: 600px;
            padding: 40px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            backdrop-filter: blur(15px);
            animation: slideIn 0.5s ease-out;
          }
          @keyframes slideIn {
            from { opacity: 0; transform: translateY(-50px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .brain-icon {
            font-size: 4rem;
            margin-bottom: 20px;
            animation: pulse 2s infinite;
          }
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
          }
          h1 { font-size: 2.5rem; margin-bottom: 15px; font-weight: 700; }
          .blocked-site {
            font-size: 1.2rem;
            margin-bottom: 20px;
            padding: 10px 20px;
            background: rgba(255, 255, 255, 0.2);
            border-radius: 10px;
            font-weight: 600;
          }
          .message { font-size: 1.1rem; margin-bottom: 30px; line-height: 1.6; }
          .stats {
            margin: 30px 0;
            padding: 20px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 15px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
          }
          .btn {
            padding: 15px 30px;
            border: none;
            border-radius: 10px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            margin: 10px;
          }
          .btn-primary { background: #28a745; color: white; }
          .btn-primary:hover { background: #218838; transform: translateY(-2px); }
          .btn-danger { background: #dc3545; color: white; }
          .btn-danger:hover { background: #c82333; transform: translateY(-2px); }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="brain-icon">🧠</div>
          <h1>Website Blocked</h1>
          <div class="blocked-site"><strong>${window.location.hostname}</strong></div>
          <div class="message">
            This website has been blocked during your focus session to help you stay concentrated on your goals.
          </div>
          <div class="stats">
            <div>⏰ Time<br><strong>${new Date().toLocaleTimeString('en-US')}</strong></div>
            <div>🎯 Status<br><strong>Focus Active</strong></div>
            <div>💪 Focus<br><strong>Stay Strong!</strong></div>
          </div>
          <button class="btn btn-primary" id="returnButton">
            🔄 Back to FocusFlow
          </button>
          <button class="btn btn-danger" id="proceedButton">
            ⚠️ Continue Anyway (-10 Score)
          </button>
        </div>

        <script>
          // Define functions first
          function returnToFocusFlow() {
            window.open('https://focusflow.alwaysdata.net/focus', '_self');
          }
          
          function proceedAnyway() {
            if (confirm('⚠️ Your focus score will be reduced.\n\nAre you sure you want to continue?')) {
              chrome.storage.local.set({
                focusflow_temporary_allow: window.location.hostname,
                focusflow_temporary_allow_timestamp: Date.now()
              }, () => {
                window.location.reload();
              });
            }
          }

          // Add event listeners after functions are defined
          document.getElementById('returnButton').addEventListener('click', returnToFocusFlow);
          document.getElementById('proceedButton').addEventListener('click', proceedAnyway);
        </script>
      </body>
      </html>
    `;
    
    document.open();
    document.write(blockingHTML);
    document.close();
  }

  // ✅ VERBETERDE storage check functie
  function checkBlockingStatus() {
    console.log('🔍 Checking blocking status...');
    
    // Check Chrome storage met error handling
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([
        'focusflow_active', 
        'focusflow_blocked_sites',
        'focusflow_temporary_allow',
        'focusflow_temporary_allow_timestamp'
      ], (result) => {
        if (chrome.runtime.lastError) {
          console.error('❌ Chrome storage error:', chrome.runtime.lastError);
          return;
        }
        
        focusActive = result.focusflow_active || false;
        blockedSites = result.focusflow_blocked_sites || [];
        
        // Check temporary allow
        const tempAllow = result.focusflow_temporary_allow;
        const tempTimestamp = result.focusflow_temporary_allow_timestamp;
        const currentTime = Date.now();
        
        if (tempAllow === window.location.hostname && 
            tempTimestamp && 
            (currentTime - tempTimestamp) < (30 * 60 * 1000)) {
          console.log('🟡 Temporary allow active for this site');
          return;
        }
        
        console.log('🔍 FocusFlow Content Script Status:', {
          active: focusActive,
          blockedSites: blockedSites,
          blockedSitesLength: blockedSites.length,
          currentDomain: window.location.hostname,
          shouldBlock: shouldBlockSite()
        });
        
        if (focusActive && shouldBlockSite()) {
          console.log('🚫 SHOULD BLOCK - Executing block!');
          blockPageCompletely();
        } else {
          console.log('✅ Page allowed - not blocking');
        }
      });
    } else {
      console.error('❌ Chrome storage API not available');
    }
  }

  // ✅ EXECUTE ONMIDDELLIJK bij page load
  console.log('🔍 FocusFlow content script loading on:', window.location.hostname);
  
  // Check status zodra script laadt
  checkBlockingStatus();

  // ✅ Listen naar storage changes voor real-time updates
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
        if (changes.focusflow_active || changes.focusflow_blocked_sites) {
          console.log('🔄 Storage changed, re-checking blocking status');
          checkBlockingStatus();
        }
      }
    });
  }

  // Prevent navigation bypass
  window.addEventListener('beforeunload', (event) => {
    if (focusActive && shouldBlockSite()) {
      event.preventDefault();
      event.returnValue = 'This website is blocked during your focus session.';
      return event.returnValue;
    }
  });

})();

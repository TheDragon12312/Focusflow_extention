// popup.js - Met site toevoeg functionaliteit
document.addEventListener('DOMContentLoaded', function() {
  console.log('🔧 FocusFlow popup loaded');
  
  // DOM elements
  const statusElement = document.getElementById('status');
  const blockedSitesElement = document.getElementById('blocked-sites');
  const sitesCountElement = document.getElementById('sites-count');
  const toggleButton = document.getElementById('toggle-blocking');
  const settingsButton = document.getElementById('open-settings');
  const statsElement = document.getElementById('stats');
  const errorMessageElement = document.getElementById('error-message');
  const successMessageElement = document.getElementById('success-message');
  
  // ✅ NIEUWE ELEMENTEN VOOR SITE TOEVOEGEN
  const siteInput = document.getElementById('site-input');
  const addSiteBtn = document.getElementById('add-site-btn');
  const quickAddBtns = document.querySelectorAll('.quick-add-btn');
  
  // Initialize popup
  loadExtensionStatus();
  
  // Event listeners
  toggleButton?.addEventListener('click', toggleBlocking);
  settingsButton?.addEventListener('click', openFocusFlowApp);
  
  // ✅ NIEUWE EVENT LISTENERS
  addSiteBtn?.addEventListener('click', addSiteFromInput);
  siteInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addSiteFromInput();
    }
  });
  
  // Quick add buttons
  quickAddBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const site = btn.dataset.site;
      addSite(site);
    });
  });
  
  // ✅ FUNCTIE: Site toevoegen vanuit input veld
  function addSiteFromInput() {
    const siteUrl = siteInput.value.trim();
    if (siteUrl) {
      addSite(siteUrl);
      siteInput.value = ''; // Clear input
    }
  }
  
  // ✅ FUNCTIE: Site toevoegen aan blocked lijst
  async function addSite(siteUrl) {
    try {
      // Valideer en clean de URL
      const cleanedSite = cleanSiteUrl(siteUrl);
      
      if (!cleanedSite) {
        showError('Ongeldige website URL');
        return;
      }
      
      // Haal huidige blocked sites op
      const result = await chrome.storage.local.get(['focusflow_blocked_sites']);
      let blockedSites = result.focusflow_blocked_sites || [];
      
      // Check of site al bestaat
      if (blockedSites.includes(cleanedSite)) {
        showError(`${cleanedSite} staat al in de lijst`);
        return;
      }
      
      // Voeg toe aan lijst
      blockedSites.push(cleanedSite);
      
      // Sla op in Chrome storage
      await chrome.storage.local.set({
        focusflow_blocked_sites: blockedSites,
        focusflow_last_update: Date.now()
      });
      
      console.log('✅ Site added:', cleanedSite);
      console.log('✅ Updated blocked sites:', blockedSites);
      
      // Success feedback
      showSuccess(`✅ ${cleanedSite} toegevoegd aan blokkering`);
      
      // Herlaad UI
      loadExtensionStatus();
      
      // ✅ SYNC TERUG NAAR FOCUSFLOW APP
      await syncToFocusFlowApp(blockedSites);
      
    } catch (error) {
      console.error('❌ Failed to add site:', error);
      showError(`Kon ${siteUrl} niet toevoegen: ${error.message}`);
    }
  }
  
  // ✅ FUNCTIE: Site verwijderen
  async function removeSite(siteToRemove) {
    try {
      const result = await chrome.storage.local.get(['focusflow_blocked_sites']);
      let blockedSites = result.focusflow_blocked_sites || [];
      
      // Filter out de site
      blockedSites = blockedSites.filter(site => site !== siteToRemove);
      
      // Sla op
      await chrome.storage.local.set({
        focusflow_blocked_sites: blockedSites,
        focusflow_last_update: Date.now()
      });
      
      console.log('✅ Site removed:', siteToRemove);
      showSuccess(`✅ ${siteToRemove} verwijderd uit blokkering`);
      
      // Herlaad UI
      loadExtensionStatus();
      
      // Sync terug naar app
      await syncToFocusFlowApp(blockedSites);
      
    } catch (error) {
      console.error('❌ Failed to remove site:', error);
      showError(`Kon ${siteToRemove} niet verwijderen`);
    }
  }
  
  // ✅ FUNCTIE: Clean en valideer site URL
  function cleanSiteUrl(url) {
    if (!url || typeof url !== 'string') return null;
    
    // Verwijder protocol, www, en trailing slashes
    let cleaned = url.toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '')
      .trim();
    
    // Basic validatie
    if (!cleaned || cleaned.includes(' ') || !cleaned.includes('.')) {
      return null;
    }
    
    return cleaned;
  }
  
  // ✅ FUNCTIE: Sync blocked sites terug naar FocusFlow app
  async function syncToFocusFlowApp(blockedSites) {
    try {
      // Probeer te syncen naar FocusFlow app via localStorage
      // (Dit werkt als gebruiker FocusFlow app open heeft in andere tab)
      const syncData = {
        source: 'extension',
        blockedSites: blockedSites,
        timestamp: Date.now(),
        action: 'sites_updated_from_extension'
      };
      
      // Set localStorage event dat FocusFlow app kan oppikken
      localStorage.setItem('focusflow_extension_sync', JSON.stringify(syncData));
      
      console.log('🔄 Synced to FocusFlow app via localStorage');
      
    } catch (error) {
      console.log('⚠️ Could not sync to FocusFlow app:', error.message);
      // Dit is niet kritiek - extensie werkt nog steeds
    }
  }
  
  // Load current extension status
  async function loadExtensionStatus() {
    try {
      const result = await chrome.storage.local.get([
        'focusflow_active',
        'focusflow_blocked_sites',
        'focusflow_session_id',
        'focusflow_last_sync'
      ]);
      
      const isActive = result.focusflow_active || false;
      const blockedSites = result.focusflow_blocked_sites || [];
      const lastSync = result.focusflow_last_sync;
      
      console.log('📊 Extension status:', { isActive, sites: blockedSites.length });
      
      updateUI(isActive, blockedSites, lastSync);
      
    } catch (error) {
      console.error('❌ Failed to load status:', error);
      showError('Kon extensie status niet laden');
    }
  }
  
  // ✅ VERBETERDE UI UPDATE MET REMOVE FUNCTIONALITEIT
  function updateUI(isActive, blockedSites, lastSync) {
    // Update status indicator
    if (statusElement) {
      statusElement.textContent = isActive ? '🟢 Actief' : '🔴 Inactief';
      statusElement.className = isActive ? 'status active' : 'status inactive';
    }
    
    // Update toggle button
    if (toggleButton) {
      toggleButton.textContent = isActive ? '⏸️ Stop Blocking' : '▶️ Start Blocking';
      toggleButton.className = isActive ? 'btn btn-danger' : 'btn btn-success';
    }
    
    // Update sites count
    if (sitesCountElement) {
      sitesCountElement.textContent = blockedSites.length;
    }
    
    // ✅ VERBETERDE BLOCKED SITES LIJST MET REMOVE BUTTONS
    if (blockedSitesElement) {
      if (blockedSites.length > 0) {
        const sitesList = blockedSites.map(site => `
          <div class="site-item">
            <div class="site-name">
              <span>🚫</span>
              <span>${site}</span>
            </div>
            <button class="remove-btn" onclick="removeSiteHandler('${site}')">
              ❌
            </button>
          </div>
        `).join('');
        
        blockedSitesElement.innerHTML = `<div class="sites-list">${sitesList}</div>`;
      } else {
        blockedSitesElement.innerHTML = '<p class="no-sites">Geen sites geblokkeerd</p>';
      }
    }
    
    // Update stats
    if (statsElement) {
      const syncTime = lastSync ? new Date(lastSync).toLocaleTimeString('nl-NL') : 'Nooit';
      statsElement.innerHTML = `
        <div class="stat-item">
          <span class="stat-label">Status:</span>
          <span class="stat-value">${isActive ? 'Blocking Actief' : 'Gestopt'}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Websites:</span>
          <span class="stat-value">${blockedSites.length} geblokkeerd</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Laatste Update:</span>
          <span class="stat-value">${syncTime}</span>
        </div>
      `;
    }
  }
  
  // ✅ GLOBAL FUNCTIE VOOR REMOVE BUTTONS (nodig voor onclick in HTML)
  window.removeSiteHandler = function(site) {
    if (confirm(`Weet je zeker dat je ${site} wilt verwijderen uit de blokkering?`)) {
      removeSite(site);
    }
  };
  
  // Toggle blocking status
  async function toggleBlocking() {
    try {
      const result = await chrome.storage.local.get(['focusflow_active']);
      const currentStatus = result.focusflow_active || false;
      const newStatus = !currentStatus;
      
      await chrome.storage.local.set({
        focusflow_active: newStatus,
        focusflow_last_toggle: Date.now()
      });
      
      console.log('🔄 Blocking toggled:', newStatus);
      
      loadExtensionStatus();
      showSuccess(newStatus ? '✅ Blocking Geactiveerd' : '⏸️ Blocking Gestopt');
      
    } catch (error) {
      console.error('❌ Failed to toggle blocking:', error);
      showError('Kon blocking status niet wijzigen');
    }
  }
  
  // Open FocusFlow web app
  function openFocusFlowApp() {
    chrome.tabs.create({
      url: 'https://focusflow.alwaysdata.net/',
      active: true
    });
    window.close();
  }
  
  // ✅ VERBETERDE MESSAGE FUNCTIES
  function showSuccess(message) {
    if (successMessageElement) {
      successMessageElement.textContent = message;
      successMessageElement.style.display = 'block';
      errorMessageElement.style.display = 'none';
      
      setTimeout(() => {
        successMessageElement.style.display = 'none';
      }, 3000);
    }
  }
  
  function showError(message) {
    if (errorMessageElement) {
      errorMessageElement.textContent = message;
      errorMessageElement.style.display = 'block';
      successMessageElement.style.display = 'none';
      
      setTimeout(() => {
        errorMessageElement.style.display = 'none';
      }, 5000);
    }
  }
  
  // Keyboard shortcuts
  document.addEventListener('keydown', function(event) {
    if (event.code === 'Space' && event.target !== siteInput) {
      event.preventDefault();
      toggleBlocking();
    }
    
    if (event.code === 'Enter' && event.target !== siteInput) {
      event.preventDefault();
      openFocusFlowApp();
    }
    
    if (event.code === 'Escape') {
      window.close();
    }
  });
  
  // Auto-refresh status every 3 seconds
  setInterval(loadExtensionStatus, 3000);
});

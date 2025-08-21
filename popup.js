// Popup script for FocusFlow Extension
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🎯 FocusFlow popup loaded');
    
    // Get current status
    updateStatus();
    
    // Setup event listeners
    document.getElementById('open-focus').addEventListener('click', () => {
        chrome.tabs.create({ url: 'http://localhost:5173/focus' });
        window.close();
    });
    
    document.getElementById('stop-session').addEventListener('click', () => {
        // Send stop message to background script
        chrome.runtime.sendMessage({
            type: 'STOP_BLOCKING'
        }, () => {
            updateStatus();
        });
    });
    
    // Update every 2 seconds
    setInterval(updateStatus, 2000);
});

async function updateStatus() {
    try {
        // Get status from background script
        const response = await chrome.runtime.sendMessage({
            type: 'GET_STATUS'
        });
        
        const statusDiv = document.getElementById('status');
        const blockedCount = document.getElementById('blocked-count');
        const sessionId = document.getElementById('session-id');
        
        if (response.isActive) {
            statusDiv.className = 'status active';
            statusDiv.textContent = '✅ Active - Blocking Sites';
        } else {
            statusDiv.className = 'status inactive';
            statusDiv.textContent = '⏸️ Not Active';
        }
        
        blockedCount.textContent = response.blockedSites?.length || 0;
        sessionId.textContent = response.sessionId || 'None';
        
    } catch (error) {
        console.error('Error updating status:', error);
    }
}

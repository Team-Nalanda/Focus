document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('settingsForm');
    const apiKeyInput = document.getElementById('apiKey');
    const firebaseConfigInput = document.getElementById('firebaseConfig');
    const statusMessage = document.getElementById('statusMessage');

    // Load existing settings
    chrome.storage.local.get(['apiKey', 'firebaseConfig'], (result) => {
        if (result.apiKey) {
            apiKeyInput.value = result.apiKey;
        }
        if (result.firebaseConfig) {
            firebaseConfigInput.value = JSON.stringify(result.firebaseConfig, null, 2);
        }
    });

    // Save settings
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        let firebaseConfigObj = null;
        try {
            firebaseConfigObj = JSON.parse(firebaseConfigInput.value);
        } catch (error) {
            showStatus('Invalid Firebase Config JSON format. Please check and try again.', 'error');
            return;
        }

        const newSettings = {
            apiKey: apiKeyInput.value.trim(),
            firebaseConfig: firebaseConfigObj
        };

        chrome.storage.local.set(newSettings, () => {
            showStatus('Settings saved successfully!', 'success');
        });
    });

    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.classList.remove('hidden', 'bg-green-500/20', 'text-green-400', 'bg-red-500/20', 'text-red-400');
        
        if (type === 'success') {
            statusMessage.classList.add('bg-green-500/20', 'text-green-400');
        } else {
            statusMessage.classList.add('bg-red-500/20', 'text-red-400');
        }
        
        setTimeout(() => {
            statusMessage.classList.add('hidden');
        }, 3000);
    }
});

import GeminiHelper from './gemini-api.js';
import FirebaseHelper from './firebase-config.js';

async function getSessionState() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['sessionActive', 'currentTask'], (data) => {
            resolve({ active: !!data.sessionActive, task: data.currentTask || "" });
        });
    });
}

// Open Side Panel when the extension icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "SESSION_STARTED") {
        console.log("FocusFlow background session started for:", message.task);
    } else if (message.action === "SESSION_ENDED" || message.action === "SESSION_PAUSED") {
        console.log("FocusFlow background session stopped.");
    }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const state = await getSessionState();
    if (!state.active) return;
    
    try {
        const tab = await chrome.tabs.get(activeInfo.tabId);
        if (tab && tab.url && !tab.url.startsWith('chrome://')) {
            checkUrlRelevance(tab.url, state.task);
        }
    } catch (e) {
        console.error("Error getting tab info:", e);
    }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete' || !tab.url || tab.url.startsWith('chrome://')) return;
    
    const state = await getSessionState();
    if (!state.active) return;

    checkUrlRelevance(tab.url, state.task);
});

async function checkUrlRelevance(url, taskTitle) {
    if(!url || url.length < 5) return;

    console.log("Checking relevance for:", url);

    const apiReady = await GeminiHelper.init();
    if (!apiReady) return;

    const evaluation = await GeminiHelper.determineRelevance(taskTitle, url);
    console.log("Gemini Evaluation:", evaluation);

    if (evaluation && evaluation.isDistraction) {
        // 1. Send nudge notification
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png', 
            title: 'FocusFlow AI Reminder',
            message: evaluation.nudgeMsg || `You got off track. Back to "${taskTitle}"!`,
            priority: 2
        });

        // 2. Log to Firebase
        const fbReady = await FirebaseHelper.init();
        if (fbReady) {
            await FirebaseHelper.logDistraction(taskTitle, url);
        }
    }
}

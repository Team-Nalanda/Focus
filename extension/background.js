import GeminiHelper from './gemini-api.js';
import FirebaseHelper from './firebase-config.js';

let currentUid = null;

// Open Side Panel when the extension icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// Helper for safe communication with the popup (prevents error if popup is closed)
function safeSendMessage(message) {
    chrome.runtime.sendMessage(message, () => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
            // Silently ignore: this usually just means the popup is closed
            console.log("Communication info: Popup closed, skipping UI sync.");
        }
    });
}

// 1. Initial load of active session and UID
chrome.storage.local.get(['uid', 'sessionActive'], (data) => {
    if (data.uid) currentUid = data.uid;
});

// 2. Listen for authentication sync from the website
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    if (message.action === 'AUTH_SYNC' && message.uid) {
        console.log('Received UID from Focus website:', message.uid);
        currentUid = message.uid;
        chrome.storage.local.set({ uid: message.uid });

        // Push some UI feedback to popup if open
        safeSendMessage({ action: 'AUTH_UPDATED', authenticated: true });
    }
});

// 3. Session State Monitor
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.action === "SESSION_STARTED") {
        console.log("Session started for:", message.task);
        
        let sessionId = message.sessionId;
        if (!sessionId && currentUid) {
            sessionId = await FirebaseHelper.createSession(currentUid, { task: message.task });
            if (sessionId) {
                chrome.storage.local.set({ 
                    firestoreSessionId: sessionId,
                    sessionActive: true,
                    currentTask: message.task 
                }, () => {
                    // Trigger immediate capture of current tab
                    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                        if (tabs[0]) handleActivityChange(tabs[0].id);
                    });
                });
            }
        }

        syncLiveStatus(true, { 
            task: message.task, 
            startTime: message.startTime, 
            endTime: message.endTime,
            firestoreSessionId: sessionId
        });
    } else if (message.action === "SESSION_ENDED" || message.action === "SESSION_PAUSED") {
        console.log("Session stopped.");
        syncLiveStatus(false);
    } else if (message.action === "SESSION_RESUMED") {
        syncLiveStatus(true, { endTime: message.endTime });
    }
});

// 3.1 Listen for session sync from website (direct message)
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
    if (message.action === 'SESSION_SYNC' && message.sessionId) {
        console.log('Received Session ID from website:', message.sessionId);
        chrome.storage.local.set({ 
            firestoreSessionId: message.sessionId,
            sessionActive: !!message.active
        }, () => {
            // Trigger immediate capture after state sync
            if (!!message.active && currentUid) {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0]) handleActivityChange(tabs[0].id);
                });
            }
        });
        safeSendMessage({ action: 'SESSION_STARTED_REMOTE', sessionId: message.sessionId });
    } else if (message.action === 'SESSION_STOP') {
        console.log('Session stopped from website. Purging local state.');
        chrome.storage.local.clear(() => {
            console.log('Local storage cleared.');
            safeSendMessage({ action: 'SESSION_STOPPED_REMOTE' });
        });
    }
});

async function syncLiveStatus(active, extraData = {}) {
    if (!currentUid) return;
    await FirebaseHelper.init();
    await FirebaseHelper.updateLiveSession(currentUid, { active, ...extraData });
}

// 4. Activity Tracking (The Triple Sync)
const INTERNAL_DOMAINS = ['localhost', '127.0.0.1', 'focus-flow-app.vercel.app'];

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    handleActivityChange(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        handleActivityChange(tabId);
    }
});

async function handleActivityChange(tabId) {
    chrome.storage.local.get(['sessionActive', 'currentTask'], async (data) => {
        if (!data.sessionActive || !currentUid) return;

        try {
            const tab = await chrome.tabs.get(tabId);
            if (!tab || !tab.url || tab.url.startsWith('chrome://')) return;

            const url = new URL(tab.url);
            const domain = url.hostname;
            const title = tab.title || domain;

            // ── FILTER: Skip tracking the Focus App itself ──
            if (INTERNAL_DOMAINS.some(d => domain.includes(d))) {
                console.log("Skipping focus app tracking.");
                return; 
            }

            console.log(`Tracking change to: ${title}`);

            // C. AI Relevance Check
            const evaluation = await GeminiHelper.determineRelevance(data.currentTask, tab.url);
            const activityType = evaluation.isDistraction ? "Distracting" : "Productive";

            // A. Update RTDB Live State (Dashboard Top Monitor)
            await FirebaseHelper.updateLiveSession(currentUid, {
                currentApp: { name: title, startTime: Date.now() }
            });

            // B. Push to RTDB History (Dashboard Timeline)
            await FirebaseHelper.pushLiveActivity(currentUid, title, activityType);

            // D. AI Interactive Nudge Check
            if (evaluation && evaluation.isDistraction) {
                console.log("Distraction detected! Injecting interactive nudge...");
                
                // 1. Inject the styles
                chrome.scripting.insertCSS({
                    target: { tabId: tabId },
                    files: ['nudge.css']
                });

                // 2. Pass the nudge message and inject the script
                chrome.scripting.executeScript({
                    target: { tabId: tabId },
                    func: (msg) => { window.focusNudgeMessage = msg; },
                    args: [evaluation.nudgeMsg || "Focus seems to be wandering off. Time to get back to work?"]
                }).then(() => {
                    chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        files: ['nudge.js']
                    });
                });
            }

            // D. Permanent Firestore Log (Tasks & Sessions Page)
            await FirebaseHelper.logActivity(currentUid, {
                appName: title,
                type: evaluation.isDistraction ? "Distracting" : "Productive",
                sessionId: await getSessionIdFromStorage()
            });

        } catch (e) {
            console.error("Activity tracking error:", e);
        }
    });
}

async function getSessionIdFromStorage() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['firestoreSessionId'], (data) => {
            resolve(data.firestoreSessionId || null);
        });
    });
}

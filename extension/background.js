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
    } else if (message.action === 'OPEN_SIDEPANEL') {
        console.log('Website requested side panel open.');
        // Open the side panel for the sender tab
        try {
            chrome.sidePanel.open({ tabId: sender.tab?.id }).then(() => {
                sendResponse({ success: true });
            }).catch((err) => {
                console.warn('Could not open side panel:', err);
                sendResponse({ success: false, error: err.message });
            });
        } catch (e) {
            console.warn('sidePanel.open not available:', e);
            sendResponse({ success: false, error: 'sidePanel.open not supported' });
        }
        return true; // Keep the message channel open for async sendResponse
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
        
        // Also complete the session in Firestore
        chrome.storage.local.get(['firestoreSessionId'], async (data) => {
            if (data.firestoreSessionId && currentUid) {
                console.log("Marking Firestore session as completed:", data.firestoreSessionId);
                await FirebaseHelper.init();
                await FirebaseHelper.completeSession(currentUid, data.firestoreSessionId);
                
                // Clear the session ID from storage after completion so next session starts fresh
                if (message.action === "SESSION_ENDED") {
                    chrome.storage.local.remove(['firestoreSessionId', 'sessionActive', 'currentTask']);
                }
            }
        });
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
const TAB_DELAY_MS = 3000; // 3s delay so user has time to navigate to their intended site
const pendingTabTimers = new Map(); // tabId -> timeoutId (debounce per tab)

function scheduleActivityCheck(tabId) {
    // Clear any pending check for this tab (debounce)
    if (pendingTabTimers.has(tabId)) {
        clearTimeout(pendingTabTimers.get(tabId));
    }
    const timerId = setTimeout(() => {
        pendingTabTimers.delete(tabId);
        handleActivityChange(tabId);
    }, TAB_DELAY_MS);
    pendingTabTimers.set(tabId, timerId);
}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    scheduleActivityCheck(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        scheduleActivityCheck(tabId);
    }
});

async function handleActivityChange(tabId) {
    chrome.storage.local.get(['sessionActive', 'currentTask'], async (data) => {
        if (!data.sessionActive || !currentUid) return;

        try {
            const tab = await chrome.tabs.get(tabId);
            if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://') || tab.url === 'about:blank') return;

            const url = new URL(tab.url);
            const domain = url.hostname;
            const title = tab.title || domain;

            // ── FILTER: Skip tracking the Focus App itself ──
            if (INTERNAL_DOMAINS.some(d => domain.includes(d))) {
                console.log("Skipping focus app tracking.");
                return;
            }

            console.log(`Tracking change to: ${title}`);

            // ── STEP 1: Check static rules immediately (no AI needed) ──
            const staticDistraction = isStaticDistraction(domain);
            const staticProductive = isStaticProductive(domain);
            const knownType = staticDistraction ? "Distracting" : (staticProductive ? "Productive" : null);

            // ── STEP 2: Send data to Firebase RIGHT AWAY using known type or Neutral ──
            const sessionId = await getSessionIdFromStorage();
            const immediateType = knownType || "Neutral";

            // A. Update RTDB Live State (Dashboard Top Monitor)
            await FirebaseHelper.updateLiveSession(currentUid, {
                currentApp: { name: title, startTime: Date.now() }
            });

            // B. Push to RTDB History (Dashboard Timeline)
            await FirebaseHelper.pushLiveActivity(currentUid, title, immediateType);

            // C. Permanent Firestore Log — also immediate
            await FirebaseHelper.logActivity(currentUid, {
                appName: title,
                type: immediateType,
                sessionId: sessionId
            });

            // ── STEP 3: If it's a known static distraction, nudge immediately ──
            if (staticDistraction) {
                console.log("Static distraction detected! Injecting nudge...");
                injectNudge(tabId, "This site is a known distraction. Time to refocus!");
            }

            // ── STEP 4: For unknown sites, run AI check in the background (non-blocking) ──
            if (knownType === null) {
                GeminiHelper.determineRelevance(data.currentTask, tab.url).then((evaluation) => {
                    if (!evaluation) return;
                    if (evaluation.isDistraction) {
                        console.log("AI distraction detected! Injecting nudge...");
                        injectNudge(tabId, evaluation.nudgeMsg || "Focus seems to be wandering. Time to get back to work?");
                        // Update logs with the AI-refined type
                        FirebaseHelper.pushLiveActivity(currentUid, title, "Distracting").catch(() => { });
                        FirebaseHelper.logActivity(currentUid, {
                            appName: title,
                            type: "Distracting",
                            sessionId: sessionId
                        }).catch(() => { });
                    }
                }).catch((err) => {
                    console.warn("AI check failed (non-critical):", err.message);
                });
            }

        } catch (e) {
            console.error("Activity tracking error:", e);
        }
    });
}

function isStaticDistraction(domain) {
    const STATIC_DISTRACTIONS = ['x.com', 'facebook.com', 'youtube.com', 'twitter.com', 'instagram.com', 'netflix.com', 'reddit.com', 'tiktok.com', 'twitch.tv'];
    return STATIC_DISTRACTIONS.some(d => domain.includes(d));
}

function isStaticProductive(domain) {
    const STATIC_PRODUCTIVE = ['github.com', 'stackoverflow.com', 'localhost', 'docs.google.com', 'visualstudio.com', 'npmjs.com', 'pnpm.io'];
    return STATIC_PRODUCTIVE.some(d => domain.includes(d));
}

function injectNudge(tabId, message) {
    // Set the message on the page then inject nudge.js
    // nudge.js self-loads its CSS via Shadow DOM + chrome.runtime.getURL
    chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: (msg) => { window.focusNudgeMessage = msg; },
        args: [message]
    }).then(() => {
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['nudge.js']
        });
    }).catch((err) => {
        console.warn('Could not inject nudge into tab:', err.message);
    });
}

async function getSessionIdFromStorage() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['firestoreSessionId'], (data) => {
            resolve(data.firestoreSessionId || null);
        });
    });
}

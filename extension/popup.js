import GeminiHelper from './gemini-api.js';
import FirebaseHelper from './firebase-config.js';

let timerInterval;
let remainingSeconds = 0;
let totalSeconds = 0;
let isPaused = false;

document.addEventListener('DOMContentLoaded', () => {

    // ── DOM refs ──
    const authOverlay = document.getElementById('authOverlay');
    const homeView = document.getElementById('homeView');
    const sessionView = document.getElementById('sessionView');
    const settingsView = document.getElementById('settingsView');
    const taskInput = document.getElementById('taskInput');
    const hoursInput = document.getElementById('hoursInput');
    const minutesInput = document.getElementById('minutesInput');
    const startSessionBtn = document.getElementById('startSessionBtn');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const activeTaskDisplay = document.getElementById('activeTaskDisplay');
    const aiTipDisplay = document.getElementById('aiTipDisplay');
    const countdownDisplay = document.getElementById('countdownDisplay');
    const timerProgressCircle = document.getElementById('timerProgressCircle');
    const pauseBtn = document.getElementById('pauseBtn');
    const pauseIconContainer = document.getElementById('pauseIconContainer');
    const finishBtn = document.getElementById('finishBtn');
    const statusBadge = document.getElementById('statusBadge');
    const statusText = document.getElementById('statusText');
    const historyView = document.getElementById('historyView');
    const historyList = document.getElementById('historyList');

    // Settings refs
    const uidInput = document.getElementById('uidInput');
    const authText = document.getElementById('authText');
    const authDot = document.getElementById('authDot');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const settingsStatus = document.getElementById('settingsStatus');

    const aiDecideTime = document.getElementById('aiDecideTime');
    const timePickerContainer = document.getElementById('timePickerContainer');

    aiDecideTime.addEventListener('change', () => {
        timePickerContainer.style.opacity = aiDecideTime.checked ? '0.3' : '1';
        timePickerContainer.style.pointerEvents = aiDecideTime.checked ? 'none' : 'auto';
    });

    // ── Tab navigation ──
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            navTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

            if (target === 'focus') {
                chrome.storage.local.get(['sessionActive'], (data) => {
                    if (data.sessionActive) sessionView.classList.add('active');
                    else homeView.classList.add('active');
                });
            } else if (target === 'history') {
                historyView.classList.add('active');
                loadHistory();
            } else if (target === 'settings') {
                settingsView.classList.add('active');
            }
        });
    });

    // ── Load settings & Auth Status ──
    function loadSettings() {
        chrome.storage.local.get(['uid'], (result) => {
            if (result.uid) {
                uidInput.value = result.uid;
                authText.textContent = "Authenticated via Site";
                authText.style.color = "var(--accent)";
                authDot.style.background = "var(--accent)";
                
                // Unlock UI
                authOverlay.classList.add('hidden');
                document.body.classList.remove('auth-locked');
            } else {
                authText.textContent = "Not Authenticated. Login on Focus Site.";
                authText.style.color = "var(--text-muted)";
                authDot.style.background = "#444";
                
                // Lock UI
                authOverlay.classList.remove('hidden');
                document.body.classList.add('auth-locked');
            }
        });
    }
    loadSettings();

    // Listen for Auth & Session Updates from Background
    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'AUTH_UPDATED') {
            loadSettings();
        } else if (message.action === 'SESSION_STOPPED_REMOTE') {
            console.log("Session stopped remotely.");
            finishSession(); // Reset local UI and state
        } else if (message.action === 'SESSION_STARTED_REMOTE') {
            console.log("Session started remotely.");
            checkActiveSession(); // Reload state and show timer
        }
    });

    // ── Save settings ──
    saveSettingsBtn.addEventListener('click', () => {
        const uid = uidInput.value.trim();
        chrome.storage.local.set({ uid }, () => {
            showSettingsStatus('Settings saved!', 'success');
            loadSettings();
        });
    });

    function showSettingsStatus(msg, type) {
        settingsStatus.textContent = msg;
        settingsStatus.className = 'status-msg ' + type;
        settingsStatus.classList.remove('hidden');
        setTimeout(() => settingsStatus.classList.add('hidden'), 3000);
    }

    // ── Restore active session ──
    chrome.storage.local.get(['sessionActive', 'currentTask', 'sessionEndTime', 'totalSeconds', 'aiTip'], (data) => {
        if (data.sessionActive) {
            totalSeconds = data.totalSeconds || 25 * 60;
            const now = Date.now();
            const end = data.sessionEndTime;
            if (end > now) {
                remainingSeconds = Math.floor((end - now) / 1000);
                activeTaskDisplay.textContent = data.currentTask || 'Focus Session';
                if (data.aiTip) aiTipDisplay.textContent = data.aiTip;
                setActiveState(true);
                showSessionView();
                startTimerInterval();
            } else {
                finishSession();
            }
        }
    });

    // ── Start session ──
    startSessionBtn.addEventListener('click', async () => {
        const task = taskInput.value.trim();
        if (!task) return alert("Please describe what you're working on.");

        chrome.storage.local.get(['uid'], async (storage) => {
            if (!storage.uid) return; // Should be locked anyway

            showLoading(true);
            let tip = '';
            let aiDuration = 25;
            try {
                const stats = await GeminiHelper.analyzeTaskDuration(task);
                tip = stats.tip || '';
                aiDuration = stats.duration || 25;
            } catch (e) {
                console.warn('AI analysis failed, continuing with manual time.', e);
            }

            const minutes = aiDecideTime.checked ? aiDuration : (parseInt(minutesInput.value) + (parseInt(hoursInput.value) * 60) || 25);
            totalSeconds = minutes * 60;
            remainingSeconds = totalSeconds;
            activeTaskDisplay.textContent = task;
            if (tip) aiTipDisplay.textContent = `"${tip}"`;

            const sessionStartTime = Date.now();
            const sessionEndTime = sessionStartTime + (remainingSeconds * 1000);
            
            chrome.storage.local.set({
                sessionActive: true,
                currentTask: task,
                totalSeconds: totalSeconds,
                sessionStartTime: sessionStartTime,
                sessionEndTime: sessionEndTime,
                aiTip: tip ? `"${tip}"` : ''
            }, () => {
                setActiveState(true);
                showSessionView();
                startTimerInterval();
                showLoading(false);
                
                // Sync to RTDB
                chrome.runtime.sendMessage({ 
                    action: "SESSION_STARTED", 
                    task: task,
                    startTime: sessionStartTime,
                    endTime: sessionEndTime
                });
            });
        });
    });

    pauseBtn.addEventListener('click', () => {
        isPaused = !isPaused;
        if (isPaused) {
            clearInterval(timerInterval);
            pauseIconContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
            chrome.runtime.sendMessage({ action: "SESSION_PAUSED" });
            setActiveState(false);
        } else {
            const newEndTime = Date.now() + (remainingSeconds * 1000);
            chrome.storage.local.set({ sessionEndTime: newEndTime });
            startTimerInterval();
            pauseIconContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
            setActiveState(true);
            
            // Sync updated end time
            chrome.runtime.sendMessage({ action: "SESSION_RESUMED", endTime: newEndTime });
        }
    });

    finishBtn.addEventListener('click', finishSession);

    function startTimerInterval() {
        clearInterval(timerInterval);
        updateTimerDisplay();
        timerInterval = setInterval(() => {
            remainingSeconds--;
            if (remainingSeconds <= 0) finishSession();
            else updateTimerDisplay();
        }, 1000);
    }

    function updateTimerDisplay() {
        const m = Math.floor(remainingSeconds / 60).toString().padStart(2, '0');
        const s = (remainingSeconds % 60).toString().padStart(2, '0');
        countdownDisplay.textContent = `${m}:${s}`;
        const progress = remainingSeconds / totalSeconds;
        timerProgressCircle.style.strokeDashoffset = 465 - (progress * 465);
    }

    function finishSession() {
        clearInterval(timerInterval);
        chrome.storage.local.set({ sessionActive: false, currentTask: null, sessionEndTime: null, sessionStartTime: null, aiTip: null });
        chrome.runtime.sendMessage({ action: "SESSION_ENDED" });
        isPaused = false;
        setActiveState(false);
        showHomeView();
    }

    function showHomeView() {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        homeView.classList.add('active');
    }
    function showSessionView() {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        sessionView.classList.add('active');
    }
    function showLoading(show) {
        if (show) loadingOverlay.classList.remove('hidden');
        else loadingOverlay.classList.add('hidden');
    }
    function setActiveState(active) {
        if (active) {
            statusBadge.className = 'status-badge active';
            statusText.textContent = 'Focusing';
        } else {
            statusBadge.className = 'status-badge idle';
            statusText.textContent = 'Idle';
        }
    }

    async function loadHistory() {
        chrome.storage.local.get(['uid'], async (data) => {
            if (!data.uid) {
                historyList.innerHTML = '<div class="history-item loading"><p>Login on the website to view history.</p></div>';
                return;
            }

            try {
                historyList.innerHTML = '<div class="history-item loading"><p>Syncing recent sessions...</p></div>';
                await FirebaseHelper.init();
                const sessions = await FirebaseHelper.getSessions(data.uid, 10);
                
                if (sessions.length === 0) {
                    historyList.innerHTML = '<div class="history-item loading" style="border-style: none;"><p>No focus sessions found yet.</p></div>';
                    return;
                }

                historyList.innerHTML = ''; // Clear loading
                sessions.forEach((session, index) => {
                    const date = session.Start_Time?.toDate ? session.Start_Time.toDate().toLocaleDateString() : 'Recent';
                    const score = session.FocusAnalysis?.Focus_Score || session.Focus_Level || 0;
                    
                    const item = document.createElement('div');
                    item.className = 'history-item fade-in';
                    item.style.animationDelay = `${index * 0.05}s`;
                    
                    const scoreColor = score >= 85 ? 'var(--accent)' : score >= 60 ? 'var(--warning)' : 'var(--danger)';
                    
                    item.innerHTML = `
                        <div class="history-info">
                            <span class="history-task">${session.Task || 'Focus Session'}</span>
                            <span class="history-date">${date}</span>
                        </div>
                        <div class="history-score" style="color: ${scoreColor}">${score}%</div>
                    `;
                    historyList.appendChild(item);
                });
            } catch (error) {
                console.error("Error loading history:", error);
                historyList.innerHTML = '<div class="history-item loading"><p>Failed to load history.</p></div>';
            }
        });
    }
});

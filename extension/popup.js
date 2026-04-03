import GeminiHelper from './gemini-api.js';

let timerInterval;
let remainingSeconds = 0;
let totalSeconds = 0;
let isPaused = false;

document.addEventListener('DOMContentLoaded', () => {

    // ── DOM refs ──
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

    // Settings refs
    const apiKeyInput = document.getElementById('apiKeyInput');
    const firebaseConfigInput = document.getElementById('firebaseConfigInput');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const settingsStatus = document.getElementById('settingsStatus');

    // AI decide toggle
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

            // Hide all views
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

            if (target === 'focus') {
                // Show either home or session depending on state
                chrome.storage.local.get(['sessionActive'], (data) => {
                    if (data.sessionActive) {
                        sessionView.classList.add('active');
                    } else {
                        homeView.classList.add('active');
                    }
                });
            } else if (target === 'settings') {
                settingsView.classList.add('active');
            }
        });
    });

    // ── Load settings ──
    chrome.storage.local.get(['apiKey', 'firebaseConfig'], (result) => {
        if (result.apiKey) apiKeyInput.value = result.apiKey;
        if (result.firebaseConfig) firebaseConfigInput.value = JSON.stringify(result.firebaseConfig, null, 2);
    });

    // ── Save settings ──
    saveSettingsBtn.addEventListener('click', () => {
        let firebaseConfigObj = null;
        const fbVal = firebaseConfigInput.value.trim();
        if (fbVal) {
            try {
                firebaseConfigObj = JSON.parse(fbVal);
            } catch (e) {
                showSettingsStatus('Invalid JSON format.', 'error');
                return;
            }
        }
        const newSettings = {};
        if (apiKeyInput.value.trim()) newSettings.apiKey = apiKeyInput.value.trim();
        if (firebaseConfigObj) newSettings.firebaseConfig = firebaseConfigObj;

        chrome.storage.local.set(newSettings, () => {
            showSettingsStatus('Settings saved!', 'success');
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

        const letAiDecide = aiDecideTime.checked;
        const hours = parseInt(hoursInput.value, 10) || 0;
        const mins = parseInt(minutesInput.value, 10) || 0;
        const manualTotalMinutes = (hours * 60) + mins;

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

        // Use AI duration if toggled, manual if set, fallback 25
        const minutes = letAiDecide ? aiDuration : (manualTotalMinutes > 0 ? manualTotalMinutes : 25);

        totalSeconds = minutes * 60;
        remainingSeconds = totalSeconds;
        activeTaskDisplay.textContent = task;
        if (tip) aiTipDisplay.textContent = `"${tip}"`;

        const sessionEndTime = Date.now() + (remainingSeconds * 1000);

        chrome.storage.local.set({
            sessionActive: true,
            currentTask: task,
            totalSeconds: totalSeconds,
            sessionEndTime: sessionEndTime,
            aiTip: tip ? `"${tip}"` : ''
        }, () => {
            setActiveState(true);
            showSessionView();
            startTimerInterval();
            showLoading(false);
            chrome.runtime.sendMessage({ action: "SESSION_STARTED", task: task });
        });
    });

    // ── Pause ──
    pauseBtn.addEventListener('click', () => {
        isPaused = !isPaused;
        if (isPaused) {
            clearInterval(timerInterval);
            pauseIconContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
            chrome.storage.local.set({ sessionActive: false });
            chrome.runtime.sendMessage({ action: "SESSION_PAUSED" });
            setActiveState(false);
        } else {
            const newEndTime = Date.now() + (remainingSeconds * 1000);
            chrome.storage.local.set({ sessionActive: true, sessionEndTime: newEndTime });
            startTimerInterval();
            pauseIconContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
            chrome.runtime.sendMessage({ action: "SESSION_RESUMED" });
            setActiveState(true);
        }
    });

    // ── Finish ──
    finishBtn.addEventListener('click', finishSession);

    function startTimerInterval() {
        clearInterval(timerInterval);
        updateTimerDisplay();
        timerInterval = setInterval(() => {
            remainingSeconds--;
            if (remainingSeconds <= 0) {
                finishSession();
            } else {
                updateTimerDisplay();
            }
        }, 1000);
    }

    function updateTimerDisplay() {
        const h = Math.floor(remainingSeconds / 3600);
        const m = Math.floor((remainingSeconds % 3600) / 60).toString().padStart(2, '0');
        const s = (remainingSeconds % 60).toString().padStart(2, '0');
        countdownDisplay.textContent = h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;

        const circleCircumference = 465; // 2 * pi * 74
        const progress = remainingSeconds / totalSeconds;
        const dashOffset = circleCircumference - (progress * circleCircumference);
        timerProgressCircle.style.strokeDashoffset = dashOffset;
    }

    function finishSession() {
        clearInterval(timerInterval);
        chrome.storage.local.set({ sessionActive: false, currentTask: null, sessionEndTime: null, aiTip: null });
        chrome.runtime.sendMessage({ action: "SESSION_ENDED" });
        isPaused = false;
        pauseIconContainer.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="icon-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
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
});
